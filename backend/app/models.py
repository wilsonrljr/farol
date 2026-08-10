"""Pydantic data models for Farol API.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
"""

from enum import Enum
from itertools import pairwise
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .core.amortization import relevant_schedule_months
from .core.costs import AdditionalCostsCalculator

ScenarioType = Literal["buy", "rent_invest", "invest_buy"]
ComparisonStatus = Literal[
    "comparable",
    "exploratory",
    "incomparable",
    "no_feasible_scenario",
]

# Public-input limits are intentionally generous for real financial plans while
# keeping arithmetic comfortably inside IEEE-754 finite ranges.
MAX_FINANCIAL_AMOUNT = 1_000_000_000_000_000.0
MAX_MONTHLY_INTEREST_RATE = 100.0
MAX_SCHEDULE_OCCURRENCES = 600
MAX_EXPANDED_SCHEDULE_EVENTS = 10_000
MAX_MONTHLY_PERCENTAGE_CONTRIBUTION = 100.0


class StrictInputModel(BaseModel):
    """Base contract for public request payloads.

    Rejecting unknown keys and non-finite numbers avoids successful requests
    whose misspelled or JSON-incompatible values are silently ignored.
    """

    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


def _validate_investment_return_ranges(returns: list["InvestmentReturnInput"]) -> None:
    """Validate that investment return ranges do not overlap.

    The core engine also enforces this month-by-month, but validating up-front
    yields clearer API errors.
    """

    if not returns:
        return

    ordered = sorted(returns, key=lambda r: r.start_month)
    prev_start = ordered[0].start_month
    prev_end = ordered[0].end_month

    for r in ordered[1:]:
        # If the previous range is open-ended, everything after overlaps.
        if prev_end is None:
            raise ValueError(
                "Overlapping investment return ranges are not allowed: "
                f"[{prev_start}-{prev_end or '∞'}] overlaps with [{r.start_month}-{r.end_month or '∞'}]"
            )

        # Overlap exists if the next range starts on/before the previous end.
        if r.start_month <= prev_end:
            raise ValueError(
                "Overlapping investment return ranges are not allowed: "
                f"[{prev_start}-{prev_end}] overlaps with [{r.start_month}-{r.end_month or '∞'}]"
            )

        prev_start = r.start_month
        prev_end = r.end_month


def _validate_investment_return_coverage(
    returns: list["InvestmentReturnInput"],
) -> None:
    """Validate that investment return ranges cover the whole horizon continuously.

    Business rule for UX/safety:
    - The first range must start at month 1.
    - Ranges must be contiguous (no gaps).
    - The last range must be open-ended (end_month=None).

    Without this, missing months silently become 0% return, which is usually an
    input mistake and produces misleading results.
    """

    if not returns:
        raise ValueError("investment_returns must not be empty")

    ordered = sorted(returns, key=lambda r: r.start_month)
    if ordered[0].start_month != 1:
        raise ValueError("investment_returns must start at month 1")

    for prev, cur in pairwise(ordered):
        if prev.end_month is None:
            raise ValueError(
                "investment_returns must be continuous; an open-ended range cannot be followed by another"
            )
        expected_next_start = prev.end_month + 1
        if cur.start_month != expected_next_start:
            raise ValueError(
                "investment_returns must be continuous (no gaps). "
                f"Expected next start_month={expected_next_start}, got {cur.start_month}"
            )

    if ordered[-1].end_month is not None:
        raise ValueError(
            "investment_returns must end with an open-ended range (end_month=null)"
        )


class AmortizationInput(StrictInputModel):
    # Original fields (backward compatibility): single event when only month + value provided
    month: int | None = Field(
        None, description="Month when the amortization occurs (for single events)"
    )
    value: float = Field(
        ...,
        le=MAX_FINANCIAL_AMOUNT,
        description="Amortization value or percentage depending on value_type",
    )
    # Extended recurrence / behavior fields
    end_month: int | None = Field(
        None, description="Last month (inclusive) for recurring amortizations"
    )
    interval_months: int | None = Field(
        None, description="Interval in months for recurrence (e.g. 12 for annual)"
    )
    occurrences: int | None = Field(
        None,
        ge=1,
        le=MAX_SCHEDULE_OCCURRENCES,
        description="Number of occurrences (alternative to end_month)",
    )
    value_type: Literal["fixed", "percentage"] | None = Field(
        "fixed",
        description="Whether value is fixed currency or percentage of outstanding balance",
    )
    inflation_adjust: bool | None = Field(
        False,
        description="If true, fixed values are inflation-adjusted from the first occurrence month",
    )
    funding_source: Literal["cash", "fgts", "bonus", "13_salario"] | None = Field(
        "cash",
        description="Source of funds for extra amortization: cash (default), FGTS, bonus, or 13_salario (13th salary)",
    )

    @model_validator(mode="after")
    def validate_recurrence(self) -> "AmortizationInput":
        # Backward compatibility: treat null value_type as fixed.
        if self.value_type is None:
            self.value_type = "fixed"

        if self.month is not None and self.month < 1:
            raise ValueError("month must be >= 1")
        if self.month is None and self.interval_months is None:
            raise ValueError(
                "month is required for a single amortization; set interval_months for a recurrence starting at month 1"
            )
        if self.end_month is not None and self.end_month < 1:
            raise ValueError("end_month must be >= 1")
        if (
            self.month is not None
            and self.end_month is not None
            and self.end_month < self.month
        ):
            raise ValueError("end_month must be >= month")
        if self.occurrences is not None and self.occurrences < 1:
            raise ValueError("occurrences must be >= 1")
        if self.occurrences is not None and self.end_month is not None:
            raise ValueError(
                "Provide either occurrences or end_month for recurring amortization, not both"
            )
        if self.interval_months is None and (self.occurrences or self.end_month):
            raise ValueError(
                "interval_months must be set when occurrences or end_month are provided"
            )
        if self.interval_months is not None and self.interval_months <= 0:
            raise ValueError("interval_months must be positive")

        if self.value < 0:
            raise ValueError("value must be >= 0")
        if self.value_type == "percentage" and self.value > 100:
            raise ValueError("percentage value must be <= 100")

        if self.funding_source is None:
            self.funding_source = "cash"

        return self


class ContributionInput(StrictInputModel):
    """Scheduled contributions (aportes) used by the invest-then-buy scenario.

    This intentionally mirrors the recurrence fields of AmortizationInput, but the
    semantics are different:
    - fixed: fixed currency deposit into the investment account
    - percentage: percentage of the current investment balance (not loan balance)
    """

    month: int | None = Field(
        None, description="Month when the contribution occurs (for single events)"
    )
    value: float = Field(
        ...,
        le=MAX_FINANCIAL_AMOUNT,
        description="Contribution value or percentage depending on value_type",
    )
    end_month: int | None = Field(
        None, description="Last month (inclusive) for recurring contributions"
    )
    interval_months: int | None = Field(
        None, description="Interval in months for recurrence (e.g. 12 for annual)"
    )
    occurrences: int | None = Field(
        None,
        ge=1,
        le=MAX_SCHEDULE_OCCURRENCES,
        description="Number of occurrences (alternative to end_month)",
    )
    value_type: Literal["fixed", "percentage"] | None = Field(
        "fixed",
        description="Whether value is fixed currency or percentage of investment balance",
    )
    inflation_adjust: bool | None = Field(
        False,
        description="If true, fixed values are inflation-adjusted from the first occurrence month",
    )

    applies_to: list[Literal["buy", "rent_invest", "invest_buy"]] | None = Field(
        None,
        description=(
            "Optional list of scenario types where this contribution is applied. "
            "If omitted (null), the contribution applies to all scenarios (backward-compatible). "
            "Allowed values: buy, rent_invest, invest_buy."
        ),
    )

    @model_validator(mode="after")
    def validate_recurrence(self) -> "ContributionInput":
        if self.value_type is None:
            self.value_type = "fixed"

        if self.month is not None and self.month < 1:
            raise ValueError("month must be >= 1")
        if self.month is None and self.interval_months is None:
            raise ValueError(
                "month is required for a single contribution; set interval_months for a recurrence starting at month 1"
            )
        if self.end_month is not None and self.end_month < 1:
            raise ValueError("end_month must be >= 1")
        if (
            self.month is not None
            and self.end_month is not None
            and self.end_month < self.month
        ):
            raise ValueError("end_month must be >= month")
        if self.occurrences is not None and self.occurrences < 1:
            raise ValueError("occurrences must be >= 1")
        if self.occurrences is not None and self.end_month is not None:
            raise ValueError(
                "Provide either occurrences or end_month for recurring contribution, not both"
            )
        if self.interval_months is None and (self.occurrences or self.end_month):
            raise ValueError(
                "interval_months must be set when occurrences or end_month are provided"
            )
        if self.interval_months is not None and self.interval_months <= 0:
            raise ValueError("interval_months must be positive")

        if self.value < 0:
            raise ValueError("value must be >= 0")
        if self.value_type == "percentage" and self.value > 100:
            raise ValueError("percentage value must be <= 100")

        if self.applies_to is not None:
            if len(self.applies_to) == 0:
                raise ValueError("applies_to must have at least one scenario")
            # De-duplicate while preserving order
            seen: set[str] = set()
            deduped: list[str] = []
            for s in self.applies_to:
                if s not in seen:
                    seen.add(s)
                    deduped.append(s)
            # Pydantic type is Literal list, but keep runtime data as list[str]
            self.applies_to = deduped  # type: ignore[assignment]

        return self


def _validate_schedule_load(
    *,
    amortizations: list[AmortizationInput] | None,
    contributions: list[ContributionInput] | None,
    term_months: int,
) -> None:
    """Bound expanded work and percentage compounding for public requests."""

    schedules = [*(amortizations or []), *(contributions or [])]
    expanded_events = sum(
        len(relevant_schedule_months(schedule, term_months)) for schedule in schedules
    )
    if expanded_events > MAX_EXPANDED_SCHEDULE_EVENTS:
        raise ValueError(
            "scheduled events exceed the maximum expanded limit "
            f"of {MAX_EXPANDED_SCHEDULE_EVENTS}"
        )

    if not contributions:
        return

    percentage_by_scenario_month: dict[tuple[str, int], float] = {}
    all_scenarios = ("buy", "rent_invest", "invest_buy")
    for contribution in contributions:
        if contribution.value_type != "percentage":
            continue
        scenarios = contribution.applies_to or list(all_scenarios)
        for month in relevant_schedule_months(contribution, term_months):
            for scenario in scenarios:
                key = (scenario, month)
                total = percentage_by_scenario_month.get(key, 0.0) + contribution.value
                if total > MAX_MONTHLY_PERCENTAGE_CONTRIBUTION:
                    raise ValueError(
                        "percentage contributions may total at most 100% of the "
                        f"investment balance per scenario and month (scenario={scenario}, month={month})"
                    )
                percentage_by_scenario_month[key] = total


class InvestmentReturnInput(StrictInputModel):
    start_month: int = Field(..., description="Starting month for this return rate")
    end_month: int | None = Field(
        None, description="Ending month for this return rate (None means until the end)"
    )
    annual_rate: float = Field(..., description="Annual return rate (in percentage)")

    @model_validator(mode="after")
    def validate_months(self) -> "InvestmentReturnInput":
        if self.start_month < 1:
            raise ValueError("start_month must be >= 1")
        if self.end_month is not None and self.end_month < 1:
            raise ValueError("end_month must be >= 1")
        if self.end_month is not None and self.end_month < self.start_month:
            raise ValueError("end_month must be >= start_month")

        # Avoid invalid compounding math for rates <= -100% (base <= 0).
        if self.annual_rate <= -100.0:
            raise ValueError("annual_rate must be > -100")
        if self.annual_rate > 1000.0:
            raise ValueError("annual_rate must be <= 1000")
        return self


class InvestmentTaxInput(StrictInputModel):
    enabled: bool = Field(
        False,
        description="If true, applies an effective tax rate over monthly investment returns (approximation).",
    )
    mode: Literal["monthly", "on_withdrawal"] = Field(
        "on_withdrawal",
        description=(
            "Taxation mode. 'on_withdrawal' is closer to Brazilian practice (tax on realized gains when selling/rescuing). "
            "'monthly' keeps the previous simplified behavior (tax each month on positive returns)."
        ),
    )
    effective_tax_rate: float = Field(
        15.0,
        ge=0.0,
        le=100.0,
        description="Effective tax rate applied to positive monthly investment returns (percentage).",
    )


class FGTSInput(StrictInputModel):
    initial_balance: float = Field(
        0.0,
        ge=0.0,
        le=MAX_FINANCIAL_AMOUNT,
        description="Initial FGTS balance available (R$).",
    )
    monthly_contribution: float = Field(
        0.0,
        ge=0.0,
        le=MAX_FINANCIAL_AMOUNT,
        description="Monthly FGTS contribution (R$).",
    )
    annual_yield_rate: float = Field(
        0.0,
        ge=0.0,
        le=100.0,
        description="Annual FGTS yield rate (percentage). If 0, balance does not grow.",
    )
    use_at_purchase: bool = Field(
        True, description="If true, uses FGTS balance at the purchase event."
    )
    max_withdrawal_at_purchase: float | None = Field(
        None,
        ge=0.0,
        le=MAX_FINANCIAL_AMOUNT,
        description="Maximum FGTS withdrawal at purchase (R$). None means withdraw up to full balance.",
    )


class FGTSWithdrawalRecord(BaseModel):
    month: int
    amount: float
    reason: Literal["purchase", "amortization"]
    success: bool
    requested_amount: float | None = None
    error: Literal["insufficient_balance", "cooldown_active", None] | None = None
    cooldown_ends_at: int | None = None
    balance_after: float | None = None


class PurchaseBreakdown(BaseModel):
    property_value: float
    cash_down_payment: float
    fgts_at_purchase: float
    total_down_payment: float
    financed_amount: float
    upfront_costs: float
    total_cash_needed: float


class FGTSUsageSummary(BaseModel):
    initial_balance: float
    total_contributions: float
    total_withdrawn: float
    withdrawn_at_purchase: float
    withdrawn_for_amortizations: float
    blocked_count: int
    blocked_total_value: float
    final_balance: float
    withdrawal_history: list[FGTSWithdrawalRecord]


class MonthlyRecord(BaseModel):
    month: int
    cash_flow: float

    scenario_type: str | None = None
    status: str | None = None
    phase: str | None = None

    equity: float | None = None
    investment_balance: float | None = None
    property_value: float | None = None

    # Loan-related
    installment: float | None = None
    installment_base: float | None = None
    principal_payment: float | None = None
    principal_base: float | None = None
    interest_payment: float | None = None
    # Extra amortization (subset of principal_payment)
    extra_amortization: float | None = None
    extra_amortization_cash: float | None = None
    extra_amortization_fgts: float | None = None
    extra_amortization_bonus: float | None = None
    extra_amortization_13_salario: float | None = None
    outstanding_balance: float | None = None
    equity_percentage: float | None = None

    # Rent/invest-related
    rent_due: float | None = None
    rent_paid: float | None = None
    rent_shortfall: float | None = None
    housing_due: float | None = None
    housing_paid: float | None = None
    housing_shortfall: float | None = None
    liquid_wealth: float | None = None
    cumulative_rent_paid: float | None = None
    cumulative_investment_gains: float | None = None
    investment_roi_percentage: float | None = None

    # Costs
    # One-off cash allocation (e.g., month-1 down payment invested/paid).
    initial_allocation: float | None = None
    monthly_hoa: float | None = None
    monthly_property_tax: float | None = None
    monthly_additional_costs: float | None = None
    total_monthly_cost: float | None = None
    cumulative_payments: float | None = None
    cumulative_interest: float | None = None

    # Invest-then-buy progress
    additional_investment: float | None = None
    target_purchase_cost: float | None = None
    progress_percent: float | None = None
    shortfall: float | None = None
    is_milestone: bool | None = None
    purchase_month: int | None = None
    purchase_price: float | None = None
    projected_purchase_month: int | None = None
    estimated_months_remaining: int | None = None

    # Scheduled contributions (derived from amortizations)
    extra_contribution_fixed: float | None = None
    extra_contribution_percentage: float | None = None
    extra_contribution_total: float | None = None

    # Sustainability & external cover
    rent_withdrawal_from_investment: float | None = None
    remaining_investment_before_return: float | None = None
    external_cover: float | None = None
    # DEPRECATED: external_surplus_invested is no longer used (surplus not auto-invested)
    external_surplus_invested: float | None = None
    # NEW: income_surplus_available shows how much is left from income after housing costs
    # This is for budget validation - NOT automatically invested
    income_surplus_available: float | None = None
    # NEW: effective_income shows the inflation-adjusted income for the month
    effective_income: float | None = None
    # Canonical resource ledger. Initial allocations are covered by total_savings
    # and do not appear in required_cash_outflow.
    required_cash_outflow: float | None = None
    funded_from_resources: float | None = None
    residual_cash_balance: float | None = None
    cash_reserve_used_for_purchase: float | None = Field(
        None,
        description="Non-yielding accumulated income converted into the cash purchase in this month.",
    )
    unfunded_amount: float | None = None
    cumulative_unfunded_amount: float | None = None
    sustainable_withdrawal_ratio: float | None = None
    burn_month: bool | None = None

    # Withdrawals (for tax-on-withdrawal mode)
    investment_withdrawal_gross: float | None = None
    investment_withdrawal_net: float | None = None
    investment_withdrawal_realized_gain: float | None = None
    investment_withdrawal_tax_paid: float | None = None

    # New: Investment tax (approximation)
    investment_return_gross: float | None = None
    investment_tax_paid: float | None = None
    investment_return_net: float | None = None

    # New: FGTS
    fgts_balance: float | None = None
    fgts_used: float | None = None

    # New: Upfront costs always paid cash
    upfront_additional_costs: float | None = None


class AdditionalCostsInput(StrictInputModel):
    itbi_percentage: float = Field(
        2.0,
        ge=0.0,
        le=100.0,
        description=(
            "ITBI (% do valor do imóvel). Dica (Brasil): normalmente ~2% a 3% dependendo do município."
        ),
    )
    deed_percentage: float = Field(
        1.0,
        ge=0.0,
        le=100.0,
        description=(
            "Custos de escritura/registro (% do valor do imóvel). Dica (Brasil): frequentemente ~1% a 2% (varia por estado/cartório)."
        ),
    )
    monthly_hoa: float | None = Field(
        None,
        ge=0.0,
        le=MAX_FINANCIAL_AMOUNT,
        description=(
            "Condomínio mensal (R$). Dica: informe o valor atual; a simulação pode corrigir por inflação."
        ),
    )
    monthly_property_tax: float | None = Field(
        None,
        ge=0.0,
        le=MAX_FINANCIAL_AMOUNT,
        description=(
            "IPTU mensal (R$). Dica: se você só tem o valor anual, divida por 12 e informe aqui."
        ),
    )


class LoanSimulationInput(StrictInputModel):
    property_value: float = Field(
        ..., gt=0.0, le=MAX_FINANCIAL_AMOUNT, description="Total property value"
    )
    down_payment: float = Field(
        ..., ge=0.0, le=MAX_FINANCIAL_AMOUNT, description="Down payment value"
    )
    loan_term_years: int = Field(..., gt=0, le=50, description="Loan term in years")
    annual_interest_rate: float | None = Field(
        None, ge=0.0, le=1000.0, description="Annual interest rate (in percentage)"
    )
    monthly_interest_rate: float | None = Field(
        None,
        ge=0.0,
        le=MAX_MONTHLY_INTEREST_RATE,
        description="Monthly interest rate (in percentage)",
    )
    loan_type: Literal["SAC", "PRICE"] = Field(
        ..., description="Loan type: SAC or PRICE"
    )
    amortizations: list[AmortizationInput] | None = Field(
        None, max_length=500, description="Extra amortizations"
    )
    additional_costs: AdditionalCostsInput = Field(
        ...,
        description=(
            "Custos adicionais obrigatórios (ITBI/escritura/condomínio/IPTU). "
            "Dica: se não souber, use ITBI=2% e escritura/registro=1% como aproximação inicial."
        ),
    )
    inflation_rate: float | None = Field(
        None,
        ge=0.0,
        le=1000.0,
        description="Annual inflation rate for general costs (in percentage)",
    )
    rent_inflation_rate: float | None = Field(
        None,
        ge=0.0,
        le=1000.0,
        description="Annual rent inflation rate (in percentage) - if not provided, uses inflation_rate",
    )
    property_appreciation_rate: float | None = Field(
        None,
        ge=0.0,
        le=1000.0,
        description="Annual property appreciation rate (in percentage) - if not provided, uses inflation_rate",
    )

    @model_validator(mode="after")
    def validate_financing_fields(self) -> "LoanSimulationInput":
        if self.down_payment > self.property_value:
            raise ValueError("down_payment must be <= property_value")
        if (self.annual_interest_rate is None) == (self.monthly_interest_rate is None):
            raise ValueError(
                "Provide exactly one of annual_interest_rate or monthly_interest_rate"
            )
        _validate_schedule_load(
            amortizations=self.amortizations,
            contributions=None,
            term_months=self.loan_term_years * 12,
        )
        return self


class ComparisonInput(StrictInputModel):
    property_value: float = Field(
        ..., gt=0.0, le=MAX_FINANCIAL_AMOUNT, description="Total property value"
    )
    down_payment: float = Field(
        ..., ge=0.0, le=MAX_FINANCIAL_AMOUNT, description="Down payment value"
    )
    total_savings: float | None = Field(
        None,
        ge=0.0,
        le=MAX_FINANCIAL_AMOUNT,
        description=(
            "Total liquid savings available at month 1 (cash). If provided, it must cover the cash down payment "
            "AND the upfront transaction costs (ITBI + deed) calculated from additional_costs. "
            "The remaining amount becomes initial_investment."
        ),
    )
    loan_term_years: int = Field(..., gt=0, le=50, description="Loan term in years")
    annual_interest_rate: float | None = Field(
        None, ge=0.0, le=1000.0, description="Annual interest rate (in percentage)"
    )
    monthly_interest_rate: float | None = Field(
        None,
        ge=0.0,
        le=MAX_MONTHLY_INTEREST_RATE,
        description="Monthly interest rate (in percentage)",
    )
    loan_type: Literal["SAC", "PRICE"] = Field(
        ..., description="Loan type: SAC or PRICE"
    )
    rent_value: float | None = Field(
        None, ge=0.0, le=MAX_FINANCIAL_AMOUNT, description="Monthly rent value"
    )
    rent_percentage: float | None = Field(
        None,
        ge=0.0,
        le=100.0,
        description="Monthly rent as percentage of property value",
    )
    investment_returns: list[InvestmentReturnInput] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Investment return rates over time",
    )
    amortizations: list[AmortizationInput] | None = Field(
        None, max_length=500, description="Extra amortizations"
    )
    contributions: list[ContributionInput] | None = Field(
        None,
        max_length=500,
        description=(
            "Scheduled investment contributions (aportes) for all investment scenarios. "
            "Applied to both 'rent and invest' and 'invest then buy' scenarios."
        ),
    )
    continue_contributions_after_purchase: bool = Field(
        True,
        description=(
            "If true, scheduled contributions continue after property purchase in the invest-then-buy scenario. "
            "If false, contributions stop at the purchase month (legacy behavior)."
        ),
    )
    additional_costs: AdditionalCostsInput = Field(
        ...,
        description=(
            "Custos adicionais obrigatórios (ITBI/escritura/condomínio/IPTU). "
            "Dica: se não souber, use ITBI=2% e escritura/registro=1% como aproximação inicial."
        ),
    )
    inflation_rate: float | None = Field(
        None,
        ge=0.0,
        le=1000.0,
        description="Annual inflation rate for general costs (in percentage)",
    )
    rent_inflation_rate: float | None = Field(
        None,
        ge=0.0,
        le=1000.0,
        description="Annual rent inflation rate (in percentage) - if not provided, uses inflation_rate",
    )
    property_appreciation_rate: float | None = Field(
        None,
        ge=0.0,
        le=1000.0,
        description="Annual property appreciation rate (in percentage) - if not provided, uses inflation_rate",
    )
    monthly_net_income: float | None = Field(
        None,
        ge=0.0,
        le=MAX_FINANCIAL_AMOUNT,
        description=(
            "Monthly net income. When provided, rent and monthly costs are paid from income. "
            "Any surplus is retained as non-yielding cash in the common resource ledger. "
            "If resources are insufficient, the shortfall becomes an explicit liability."
        ),
    )
    monthly_net_income_adjust_inflation: bool = Field(
        False,
        description=(
            "If true, monthly net income is adjusted by inflation over time (uses inflation_rate)."
        ),
    )

    investment_tax: InvestmentTaxInput | None = Field(
        None,
        description="Optional effective taxation over monthly investment returns (approximation).",
    )
    fgts: FGTSInput | None = Field(
        None,
        description="Optional FGTS balance and usage rules (MVP: use only at purchase).",
    )

    @model_validator(mode="after")
    def validate_month_fields(self) -> "ComparisonInput":
        if self.down_payment > self.property_value:
            raise ValueError("down_payment must be <= property_value")
        if (self.annual_interest_rate is None) == (self.monthly_interest_rate is None):
            raise ValueError(
                "Provide exactly one of annual_interest_rate or monthly_interest_rate"
            )
        if (self.rent_value is None) == (self.rent_percentage is None):
            raise ValueError("Provide exactly one of rent_value or rent_percentage")
        if self.total_savings is not None:
            # total_savings represents the user's total liquid cash available at month 1.
            # It must cover the cash down payment and the upfront transaction costs.
            costs = AdditionalCostsCalculator.from_input(
                self.additional_costs
            ).calculate(self.property_value)
            total_upfront = float(costs["total_upfront"])
            min_required = self.down_payment + total_upfront
            if self.total_savings < min_required:
                raise ValueError(
                    "total_savings must be >= down_payment + upfront_costs (ITBI + deed)"
                )

        _validate_investment_return_coverage(list(self.investment_returns or []))

        _validate_investment_return_ranges(list(self.investment_returns or []))
        _validate_schedule_load(
            amortizations=self.amortizations,
            contributions=self.contributions,
            term_months=self.loan_term_years * 12,
        )
        return self

    @property
    def initial_investment(self) -> float:
        """Calculated initial investment capital.

        When total_savings is provided, we treat it as the user's total liquid cash
        available at month 1. The cash down payment and upfront transaction costs
        are paid from this pool; whatever remains is invested (initial_investment).
        """
        if self.total_savings is not None:
            costs = AdditionalCostsCalculator.from_input(
                self.additional_costs
            ).calculate(self.property_value)
            total_upfront = float(costs["total_upfront"])
            return self.total_savings - self.down_payment - total_upfront
        return 0.0


class LoanInstallment(BaseModel):
    month: int
    installment: float
    amortization: float
    interest: float
    outstanding_balance: float
    extra_amortization: float = 0
    extra_amortization_cash: float = 0
    extra_amortization_fgts: float = 0


class LoanSimulationResult(BaseModel):
    loan_value: float
    total_paid: float
    total_interest_paid: float
    installments: list[LoanInstallment]
    # New optional metadata fields (populated when amortizações extras encurtam o prazo)
    original_term_months: int | None = Field(
        None, description="Planned term in months before extra amortizations"
    )
    actual_term_months: int | None = Field(
        None, description="Actual term in months until balance reached zero"
    )
    months_saved: int | None = Field(
        None, description="original_term_months - actual_term_months when applicable"
    )
    total_extra_amortization: float | None = Field(
        None, description="Sum of all extra amortizations applied"
    )


class ComparisonScenario(BaseModel):
    name: str
    scenario_type: ScenarioType = Field(
        ...,
        description="Stable identifier for the scenario (used for metrics and comparisons)",
    )
    total_cost: float
    final_equity: float
    # New: explicit wealth/consumption semantics (backward-compatible)
    initial_wealth: float | None = Field(
        None,
        description=(
            "Estimated wealth available at month 1 (cash + FGTS initial balance when provided). "
            "This is a reporting field and does not change simulation behavior."
        ),
    )
    final_wealth: float | None = Field(
        None,
        description="Alias for final_equity for clarity in wealth reporting.",
    )
    net_worth_change: float | None = Field(
        None,
        description="final_wealth - initial_wealth (positive means wealth increased).",
    )
    total_consumption: float | None = Field(
        None,
        description=(
            "Approximation of 'non-asset' spending (e.g., rent, interest, HOA/IPTU, transaction costs). "
            "Excludes principal transfers into assets."
        ),
    )
    final_assets: float | None = Field(
        None, description="Gross terminal assets before unfunded obligations."
    )
    final_liabilities: float | None = Field(
        None, description="Unfunded obligations accumulated over the horizon."
    )
    residual_cash_balance: float | None = Field(
        None,
        description="Income left after modeled costs, held as non-yielding cash.",
    )
    is_feasible: bool | None = Field(
        None,
        description="Whether configured income funds every modeled recurring outflow.",
    )
    first_unfunded_month: int | None = None
    total_unfunded_amount: float | None = None
    comparison_warnings: list[str] = Field(default_factory=list)
    monthly_data: list[MonthlyRecord]
    # New fields for clearer cost semantics. total_outflows = sum of all cash out (gross).
    # net_cost = total_outflows - final_equity (net of assets). Kept optional for backward compatibility.
    total_outflows: float | None = Field(
        None,
        description="Gross outflows (down payment + payments + rent + costs + investments)",
    )
    net_cost: float | None = Field(
        None,
        description="Net cost after subtracting remaining equity/assets (alias of total_cost if provided)",
    )
    opportunity_cost: float | None = Field(
        None,
        description="Investment gains from initial capital kept invested (buy scenario only)",
    )
    purchase_breakdown: PurchaseBreakdown | None = Field(
        None,
        description="Composition of purchase (cash vs FGTS) and financed amount",
    )
    fgts_summary: FGTSUsageSummary | None = Field(
        None,
        description="Summary of FGTS usage across the scenario",
    )


class ComparisonMetrics(BaseModel):
    """Enhanced comparison metrics for better visualization."""

    total_cost_difference: float = Field(
        ..., description="Difference from best scenario"
    )
    total_cost_percentage_difference: float | None = Field(
        None,
        description=(
            "Percentage difference from best scenario. Can be null when the best scenario cost is ~0, "
            "to avoid meaningless huge percentages."
        ),
    )
    break_even_month: int | None = Field(
        None, description="Month when this scenario becomes profitable"
    )
    roi_percentage: float | None = Field(
        None,
        description=(
            "Money/time-weighted return. Null until dated external cash flows are "
            "modeled; salary and residual cash must not be reported as ROI."
        ),
    )
    roi_including_withdrawals_percentage: float | None = Field(
        None,
        description=(
            "ROI that adds back withdrawals used to pay rent/costs (when rent is paid from the investment). "
            "This is useful to compare 'wealth + consumed withdrawals' vs total_outflows."
        ),
    )
    average_monthly_cost: float = Field(..., description="Average monthly cost")
    total_interest_or_rent_paid: float = Field(
        ..., description="Total interest paid (loan) or rent paid"
    )
    wealth_accumulation: float = Field(
        ..., description="Total wealth accumulated (equity + investments)"
    )
    # Optional sustainability-related aggregate metrics (may be absent for buy scenario)
    total_rent_withdrawn_from_investment: float | None = Field(
        None, description="Sum of rent+costs amount withdrawn from investment principal"
    )
    months_with_burn: int | None = Field(
        None,
        description="Number of months where withdrawals exceeded investment returns",
    )
    average_sustainable_withdrawal_ratio: float | None = Field(
        None,
        description="Average of (investment_return_net / withdrawal) in months with withdrawal >0 (values >1 mean fully covered by returns)",
    )


class EnhancedComparisonScenario(BaseModel):
    name: str
    scenario_type: ScenarioType
    total_cost: float
    final_equity: float
    # New: explicit wealth/consumption semantics (backward-compatible)
    initial_wealth: float | None = Field(
        None,
        description=(
            "Estimated wealth available at month 1 (cash + FGTS initial balance when provided). "
            "This is a reporting field and does not change simulation behavior."
        ),
    )
    final_wealth: float | None = Field(
        None,
        description="Alias for final_equity for clarity in wealth reporting.",
    )
    net_worth_change: float | None = Field(
        None,
        description="final_wealth - initial_wealth (positive means wealth increased).",
    )
    total_consumption: float | None = Field(
        None,
        description=(
            "Approximation of 'non-asset' spending (e.g., rent, interest, HOA/IPTU, transaction costs). "
            "Excludes principal transfers into assets."
        ),
    )
    final_assets: float | None = None
    final_liabilities: float | None = None
    residual_cash_balance: float | None = None
    is_feasible: bool | None = None
    first_unfunded_month: int | None = None
    total_unfunded_amount: float | None = None
    comparison_warnings: list[str] = Field(default_factory=list)
    total_outflows: float | None = Field(
        None,
        description="Gross outflows (down payment + payments + rent + costs + investments)",
    )
    net_cost: float | None = Field(
        None,
        description="Net cost after subtracting remaining equity/assets",
    )
    opportunity_cost: float | None = Field(
        None,
        description="Investment gains from initial capital kept invested (buy scenario only)",
    )
    monthly_data: list[MonthlyRecord]
    metrics: ComparisonMetrics
    purchase_breakdown: PurchaseBreakdown | None = None
    fgts_summary: FGTSUsageSummary | None = None


class ComparisonResult(BaseModel):
    best_scenario: str | None = Field(
        None,
        description=(
            "Scenario with the highest net_worth_change (equivalently: highest final_wealth, "
            "since all scenarios share the same initial_wealth baseline). Null when the "
            "request is exploratory, incomparable, or has no feasible scenario."
        ),
    )
    scenarios: list[ComparisonScenario]
    best_scenario_type: ScenarioType | None = None
    comparison_status: ComparisonStatus = "exploratory"
    calculation_version: str = "2.0"
    warnings: list[str] = Field(default_factory=list)


class EnhancedComparisonResult(BaseModel):
    best_scenario: str | None = Field(
        None,
        description=(
            "Scenario with the highest net_worth_change (equivalently: highest final_wealth, "
            "since all scenarios share the same initial_wealth baseline). Null when no "
            "authoritative ranking can be produced."
        ),
    )
    scenarios: list[EnhancedComparisonScenario]
    comparative_summary: dict[str, dict[str, object]] = Field(
        ..., description="Month-by-month comparison between scenarios"
    )
    best_scenario_type: ScenarioType | None = None
    comparison_status: ComparisonStatus = "exploratory"
    calculation_version: str = "2.0"
    warnings: list[str] = Field(default_factory=list)


class ScenarioMetricsSummary(BaseModel):
    name: str
    scenario_type: ScenarioType
    net_cost: float
    final_equity: float
    final_wealth: float | None = None
    net_worth_change: float | None = None
    is_feasible: bool | None = None
    total_unfunded_amount: float | None = None
    total_outflows: float | None = None
    roi_percentage: float | None = None
    roi_including_withdrawals_percentage: float | None = None
    total_rent_withdrawn_from_investment: float | None = None
    months_with_burn: int | None = None
    average_sustainable_withdrawal_ratio: float | None = None


class ScenariosMetricsResult(BaseModel):
    best_scenario: str | None = None
    best_scenario_type: ScenarioType | None = None
    comparison_status: ComparisonStatus = "exploratory"
    warnings: list[str] = Field(default_factory=list)
    metrics: list[ScenarioMetricsSummary]


class StressTestInput(StrictInputModel):
    """Inputs for the Stress Test tool.

    This is intentionally independent from the housing scenarios: it models a
    household monthly cashflow and how long an emergency fund can sustain a
    deficit under an income shock.
    """

    monthly_income: float = Field(
        ...,
        ge=0.0,
        le=MAX_FINANCIAL_AMOUNT,
        description="Base monthly net income (R$)",
    )
    monthly_expenses: float = Field(
        ...,
        ge=0.0,
        le=MAX_FINANCIAL_AMOUNT,
        description="Base monthly expenses (R$) at month 1",
    )
    initial_emergency_fund: float = Field(
        ...,
        ge=0.0,
        le=MAX_FINANCIAL_AMOUNT,
        description="Emergency fund balance at month 1 (R$)",
    )

    horizon_months: int = Field(
        60, ge=1, le=600, description="Simulation horizon in months"
    )

    income_drop_percentage: float = Field(
        30.0,
        ge=0.0,
        le=100.0,
        description="Income drop during the shock (percentage, e.g. 30 for 30%)",
    )
    shock_duration_months: int = Field(
        6,
        ge=0,
        le=600,
        description="Shock duration in months (0 disables the shock)",
    )
    shock_start_month: int = Field(
        1,
        ge=1,
        le=600,
        description="Month when the shock starts (1-based)",
    )

    annual_inflation_rate: float | None = Field(
        None,
        ge=-100.0,
        le=1000.0,
        description="Annual inflation rate applied to expenses (percentage)",
    )
    annual_emergency_fund_yield_rate: float | None = Field(
        None,
        gt=-100.0,
        le=1000.0,
        description="Annual yield rate applied to the emergency fund balance (percentage)",
    )

    @model_validator(mode="after")
    def validate_shock_window(self) -> "StressTestInput":
        if self.shock_start_month > self.horizon_months:
            raise ValueError("shock_start_month must be <= horizon_months")
        if self.shock_duration_months > 0:
            shock_end = self.shock_start_month + self.shock_duration_months - 1
            if shock_end > self.horizon_months:
                raise ValueError(
                    "shock_start_month + shock_duration_months - 1 must be <= horizon_months"
                )
        return self


class StressTestMonth(BaseModel):
    month: int
    in_shock: bool = False
    baseline_income: float = 0.0
    income_reduction: float = 0.0
    income: float
    expenses: float
    net_cash_flow: float
    emergency_fund_balance: float
    depleted: bool
    uncovered_deficit: float = Field(
        0.0,
        ge=0.0,
        description="Deficit not covered after the fund reached zero (R$)",
    )


class StressTestResult(BaseModel):
    months_survived: int = Field(
        ...,
        ge=0,
        description="Number of months until depletion (0 if depleted at month 1)",
    )
    depleted_at_month: int | None = Field(
        None, description="Month when the emergency fund hits zero (inclusive)"
    )
    final_emergency_fund_balance: float
    min_emergency_fund_balance: float
    total_uncovered_deficit: float
    monthly_data: list[StressTestMonth]


class EmergencyFundPlanInput(StrictInputModel):
    """Inputs for the Emergency Fund planner.

    Goal is expressed as a multiple of monthly expenses (e.g. 6 months).
    """

    monthly_expenses: float = Field(
        ...,
        ge=0.0,
        le=MAX_FINANCIAL_AMOUNT,
        description="Base monthly expenses at month 1 (R$)",
    )
    initial_emergency_fund: float = Field(
        ...,
        ge=0.0,
        le=MAX_FINANCIAL_AMOUNT,
        description="Initial emergency fund balance at month 1 (R$)",
    )
    target_months_of_expenses: int = Field(
        6, ge=1, le=60, description="Target reserve as N months of expenses"
    )

    monthly_contribution: float = Field(
        0.0,
        ge=0.0,
        le=MAX_FINANCIAL_AMOUNT,
        description="Monthly contribution to the fund (R$)",
    )
    horizon_months: int = Field(60, ge=1, le=600, description="Planning horizon")

    annual_inflation_rate: float | None = Field(
        None,
        ge=-100.0,
        le=1000.0,
        description="Annual inflation rate applied to expenses/target (percentage)",
    )
    annual_emergency_fund_yield_rate: float | None = Field(
        None,
        gt=-100.0,
        le=1000.0,
        description="Annual yield rate applied to the fund balance (percentage)",
    )


class EmergencyFundPlanMonth(BaseModel):
    month: int
    expenses: float
    target_amount: float
    contribution: float
    investment_return: float
    emergency_fund_balance: float
    progress_percent: float
    achieved: bool


class EmergencyFundPlanResult(BaseModel):
    currently_achieved: bool = False
    achieved_at_month: int | None = None
    months_to_goal: int | None = None
    final_emergency_fund_balance: float
    target_amount_end: float
    monthly_data: list[EmergencyFundPlanMonth]


class VehicleFinancingConfig(StrictInputModel):
    enabled: bool = Field(True, description="Include financing option")
    down_payment: float = Field(
        0.0, ge=0.0, le=MAX_FINANCIAL_AMOUNT, description="Down payment (R$)"
    )
    term_months: int = Field(48, ge=1, le=120, description="Loan term in months")
    annual_interest_rate: float | None = Field(
        None, ge=0.0, le=1000.0, description="Annual interest rate (percentage)"
    )
    monthly_interest_rate: float | None = Field(
        None,
        ge=0.0,
        le=MAX_MONTHLY_INTEREST_RATE,
        description="Monthly interest rate (percentage)",
    )
    loan_type: Literal["PRICE", "SAC"] = Field(
        "PRICE", description="Amortization system for the loan"
    )

    @model_validator(mode="after")
    def validate_interest_rate(self) -> "VehicleFinancingConfig":
        if self.enabled and (self.annual_interest_rate is None) == (
            self.monthly_interest_rate is None
        ):
            raise ValueError(
                "Provide exactly one of annual_interest_rate or monthly_interest_rate"
            )
        return self


class VehicleConsortiumConfig(StrictInputModel):
    enabled: bool = Field(True, description="Include consortium option")
    term_months: int = Field(60, ge=1, le=120, description="Consortium term in months")
    admin_fee_percentage: float = Field(
        18.0,
        ge=0.0,
        le=200.0,
        description="Total administration fee over the full term (percentage)",
    )
    contemplation_month: int = Field(
        24,
        ge=1,
        le=120,
        description="Month when the participant is contemplated and gets the vehicle",
    )

    @model_validator(mode="after")
    def validate_contemplation(self) -> "VehicleConsortiumConfig":
        if self.contemplation_month > self.term_months:
            raise ValueError("contemplation_month must be <= term_months")
        return self


class VehicleSubscriptionConfig(StrictInputModel):
    enabled: bool = Field(True, description="Include subscription option")
    monthly_fee: float = Field(
        ...,
        ge=0.0,
        le=MAX_FINANCIAL_AMOUNT,
        description="Monthly subscription fee (R$)",
    )


class VehicleComparisonInput(StrictInputModel):
    vehicle_price: float = Field(
        ..., gt=0.0, le=MAX_FINANCIAL_AMOUNT, description="Vehicle price (R$)"
    )
    horizon_months: int = Field(60, ge=1, le=240, description="Comparison horizon")

    annual_depreciation_rate: float | None = Field(
        12.0,
        ge=0.0,
        le=100.0,
        description="Annual depreciation rate for the vehicle (percentage)",
    )
    annual_inflation_rate: float | None = Field(
        None,
        ge=-100.0,
        le=1000.0,
        description="Annual inflation applied to recurring costs (percentage)",
    )

    monthly_insurance: float = Field(
        0.0,
        ge=0.0,
        le=MAX_FINANCIAL_AMOUNT,
        description="Monthly insurance (R$)",
    )
    monthly_maintenance: float = Field(
        0.0,
        ge=0.0,
        le=MAX_FINANCIAL_AMOUNT,
        description="Monthly maintenance (R$)",
    )
    monthly_fuel: float = Field(
        0.0,
        ge=0.0,
        le=MAX_FINANCIAL_AMOUNT,
        description="Monthly fuel (R$)",
    )

    annual_ipva_percentage: float = Field(
        0.0, ge=0.0, le=50.0, description="Annual IPVA as percentage of vehicle value"
    )

    include_cash: bool = Field(True, description="Include cash purchase option")
    financing: VehicleFinancingConfig | None = None
    consortium: VehicleConsortiumConfig | None = None
    subscription: VehicleSubscriptionConfig | None = None

    @model_validator(mode="after")
    def validate_options(self) -> "VehicleComparisonInput":
        if (
            self.financing
            and self.financing.enabled
            and self.financing.down_payment > self.vehicle_price
        ):
            raise ValueError("financing.down_payment must be <= vehicle_price")
        enabled = self.include_cash or any(
            option is not None and option.enabled
            for option in (self.financing, self.consortium, self.subscription)
        )
        if not enabled:
            raise ValueError("At least one vehicle option must be enabled")
        return self


class VehicleComparisonMonth(BaseModel):
    month: int
    cash_flow: float
    cumulative_outflow: float
    asset_value: float
    outstanding_liability: float = 0.0
    net_position: float


class VehicleComparisonScenario(BaseModel):
    name: str
    total_outflows: float
    final_asset_value: float
    final_outstanding_liability: float = 0.0
    net_cost: float
    monthly_data: list[VehicleComparisonMonth]


class VehicleComparisonResult(BaseModel):
    scenarios: list[VehicleComparisonScenario]


# ---------------------------------------------------------------------------
# FIRE (Financial Independence, Retire Early) Planner
# ---------------------------------------------------------------------------


class FIREPlanInput(StrictInputModel):
    """Inputs for the FIRE (Financial Independence, Retire Early) calculator.

    Calculates how long until you reach financial independence based on
    the 4% rule (or custom withdrawal rate).
    """

    monthly_expenses: float = Field(
        ...,
        ge=0.0,
        le=MAX_FINANCIAL_AMOUNT,
        description="Current monthly expenses (R$)",
    )
    current_portfolio: float = Field(
        ...,
        ge=0.0,
        le=MAX_FINANCIAL_AMOUNT,
        description="Current invested portfolio value (R$)",
    )
    monthly_contribution: float = Field(
        0.0,
        ge=0.0,
        le=MAX_FINANCIAL_AMOUNT,
        description="Monthly investment contribution (R$)",
    )
    horizon_months: int = Field(
        360,
        ge=1,
        le=600,
        description="Maximum planning horizon in months (default 30 years)",
    )

    annual_return_rate: float = Field(
        8.0,
        ge=-50.0,
        le=100.0,
        description="Expected annual real return rate (after inflation) (percentage)",
    )
    annual_inflation_rate: float | None = Field(
        None,
        ge=-100.0,
        le=1000.0,
        description=(
            "Accepted for backwards compatibility. FIRE is projected in today's "
            "money and annual_return_rate is already real, so this value does not "
            "alter the calculation."
        ),
    )
    safe_withdrawal_rate: float = Field(
        4.0,
        gt=0.0,
        le=20.0,
        description="Safe withdrawal rate (percentage). Traditional FIRE uses 4%",
    )

    # Optional: model different FIRE variants
    fire_mode: Literal["traditional", "coast", "barista"] = Field(
        "traditional",
        description="FIRE mode: traditional (full FI), coast (stop contributing), barista (part-time income)",
    )
    coast_fire_age: int | None = Field(
        None,
        ge=18,
        le=100,
        description="Age to stop contributing in Coast FIRE mode",
    )
    current_age: int | None = Field(
        None,
        ge=18,
        le=100,
        description="Current age (used for Coast FIRE calculations)",
    )
    target_retirement_age: int | None = Field(
        None,
        ge=18,
        le=100,
        description="Target retirement age (optional, for reference)",
    )
    barista_monthly_income: float | None = Field(
        None,
        ge=0.0,
        le=MAX_FINANCIAL_AMOUNT,
        description="Part-time income in Barista FIRE mode (R$)",
    )

    @model_validator(mode="after")
    def validate_fire_mode(self) -> "FIREPlanInput":
        if self.fire_mode == "coast":
            if self.current_age is None:
                raise ValueError("current_age is required for Coast FIRE")
            target_age = self.target_retirement_age or 65
            if target_age <= self.current_age:
                raise ValueError("target_retirement_age must be > current_age")
            if self.coast_fire_age is not None and not (
                self.current_age <= self.coast_fire_age <= target_age
            ):
                raise ValueError(
                    "coast_fire_age must be between current_age and target_retirement_age"
                )
        if self.fire_mode == "barista" and self.barista_monthly_income is None:
            raise ValueError("barista_monthly_income is required for Barista FIRE")
        return self


class FIREPlanMonth(BaseModel):
    """Monthly snapshot of FIRE progression."""

    month: int
    age: float | None = None  # Current age if provided
    portfolio_balance: float
    monthly_expenses: float
    contribution: float
    investment_return: float
    fire_number: float  # Target portfolio needed for FI
    coast_fire_number: float | None = None
    progress_percent: float  # How close to FI (0-100+)
    monthly_passive_income: float  # Income if you retired now
    years_of_expenses_covered: float  # Portfolio / annual expenses
    fi_achieved: bool


class FIREPlanResult(BaseModel):
    """Result of FIRE calculation."""

    fi_achieved: bool
    fi_month: int | None = None  # Month when FI is achieved
    fi_age: float | None = None  # Age at FI (if current_age provided)
    years_to_fi: float | None = None  # Years until FI
    months_to_fi: int | None = None  # Months until FI

    fire_number: float  # Target portfolio for FI
    final_portfolio: float
    final_monthly_passive_income: float
    total_contributions: float
    total_investment_returns: float

    # Coast FIRE specific
    coast_fire_number: float | None = None  # Portfolio needed to coast
    coast_fire_achieved: bool | None = None

    monthly_data: list[FIREPlanMonth]


# ---------------------------------------------------------------------------
# Batch Comparison (Multiple Presets)
# ---------------------------------------------------------------------------


class BatchComparisonItem(StrictInputModel):
    """Single item in a batch comparison request."""

    preset_id: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="Unique identifier for the preset",
    )
    preset_name: str = Field(
        ...,
        min_length=1,
        max_length=120,
        description="Human-readable name for the preset",
    )
    input: ComparisonInput = Field(..., description="The comparison input parameters")


class BatchComparisonInput(StrictInputModel):
    """Input for batch comparison of multiple presets."""

    items: list[BatchComparisonItem] = Field(
        ...,
        min_length=2,
        max_length=10,
        description="List of presets to compare (2-10 items)",
    )

    @model_validator(mode="after")
    def validate_unique_ids(self) -> "BatchComparisonInput":
        ids = [item.preset_id for item in self.items]
        if len(ids) != len(set(ids)):
            raise ValueError("preset_id values must be unique")
        return self


class BatchComparisonResultItem(BaseModel):
    """Result for a single preset in batch comparison."""

    preset_id: str
    preset_name: str
    result: EnhancedComparisonResult


class BatchComparisonRanking(BaseModel):
    """Ranking entry for cross-preset comparison."""

    preset_id: str
    preset_name: str
    scenario_name: str
    scenario_type: ScenarioType
    final_wealth: float
    net_worth_change: float
    total_cost: float
    roi_percentage: float | None = None


class BatchComparisonResult(BaseModel):
    """Result of batch comparison across multiple presets."""

    results: list[BatchComparisonResultItem] = Field(
        ..., description="Individual results for each preset"
    )
    global_best: BatchComparisonRanking | None = Field(
        None,
        description="Best authoritative scenario, or null when no preset is rankable",
    )
    ranking: list[BatchComparisonRanking] = Field(
        ..., description="Ranked list of all scenarios across all presets"
    )
    comparison_status: Literal["ranked", "partial", "no_authoritative_result"] = (
        "no_authoritative_result"
    )
    warnings: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Sensitivity Analysis
# ---------------------------------------------------------------------------


class SensitivityParameterType(str, Enum):
    """Parameters available for sensitivity analysis."""

    ANNUAL_INTEREST_RATE = "annual_interest_rate"
    INVESTMENT_RETURN_RATE = "investment_return_rate"
    DOWN_PAYMENT = "down_payment"
    PROPERTY_VALUE = "property_value"
    RENT_VALUE = "rent_value"
    INFLATION_RATE = "inflation_rate"
    PROPERTY_APPRECIATION_RATE = "property_appreciation_rate"
    LOAN_TERM_YEARS = "loan_term_years"


class SensitivityRange(StrictInputModel):
    """Range configuration for sensitivity analysis."""

    min_value: float = Field(
        ...,
        ge=-MAX_FINANCIAL_AMOUNT,
        le=MAX_FINANCIAL_AMOUNT,
        description="Minimum value for the parameter",
    )
    max_value: float = Field(
        ...,
        ge=-MAX_FINANCIAL_AMOUNT,
        le=MAX_FINANCIAL_AMOUNT,
        description="Maximum value for the parameter",
    )
    steps: int = Field(
        default=7, ge=3, le=15, description="Number of steps in the range"
    )

    @model_validator(mode="after")
    def validate_order(self) -> "SensitivityRange":
        if self.min_value >= self.max_value:
            raise ValueError("min_value must be < max_value")
        return self


class SensitivityAnalysisInput(StrictInputModel):
    """Input for sensitivity analysis."""

    base_input: ComparisonInput = Field(..., description="Base configuration to vary")
    parameter: SensitivityParameterType = Field(..., description="Parameter to analyze")
    range: SensitivityRange = Field(..., description="Range of values to test")


class SensitivityScenarioResult(BaseModel):
    """Result for a single scenario at a given parameter value."""

    name: str
    scenario_type: ScenarioType
    final_wealth: float
    total_cost: float
    roi_percentage: float | None = None
    net_worth_change: float
    is_feasible: bool | None = None


class SensitivityDataPoint(BaseModel):
    """Single data point in sensitivity analysis."""

    parameter_value: float
    best_scenario: str | None = None
    best_scenario_type: ScenarioType | None = None
    comparison_status: ComparisonStatus = "exploratory"
    warnings: list[str] = Field(default_factory=list)
    scenarios: dict[str, SensitivityScenarioResult]


class SensitivityBreakeven(BaseModel):
    """Point where best scenario changes."""

    parameter_value: float
    from_scenario: str
    to_scenario: str


class SensitivityAnalysisResult(BaseModel):
    """Result of sensitivity analysis."""

    parameter: str = Field(..., description="Parameter that was varied")
    parameter_label: str = Field(..., description="Human-readable parameter name")
    base_value: float = Field(..., description="Original value of the parameter")
    data_points: list[SensitivityDataPoint] = Field(
        ..., description="Results at each parameter value"
    )
    breakeven_points: list[SensitivityBreakeven] = Field(
        default_factory=list, description="Points where best scenario changes"
    )
    best_overall: SensitivityDataPoint | None = Field(
        None, description="Best comparable data point, or null when none is rankable"
    )
    comparison_status: Literal["ranked", "partial", "no_authoritative_result"] = (
        "no_authoritative_result"
    )
    warnings: list[str] = Field(default_factory=list)
