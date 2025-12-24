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

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from .core.costs import AdditionalCostsCalculator


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


class AmortizationInput(BaseModel):
    # Original fields (backward compatibility): single event when only month + value provided
    month: int | None = Field(
        None, description="Month when the amortization occurs (for single events)"
    )
    value: float = Field(
        ..., description="Amortization value or percentage depending on value_type"
    )
    # Extended recurrence / behavior fields
    end_month: int | None = Field(
        None, description="Last month (inclusive) for recurring amortizations"
    )
    interval_months: int | None = Field(
        None, description="Interval in months for recurrence (e.g. 12 for annual)"
    )
    occurrences: int | None = Field(
        None, description="Number of occurrences (alternative to end_month)"
    )
    value_type: Literal["fixed", "percentage"] | None = Field(
        "fixed",
        description="Whether value is fixed currency or percentage of outstanding balance",
    )
    inflation_adjust: bool | None = Field(
        False,
        description="If true, fixed values are inflation-adjusted from the first occurrence month",
    )
    funding_source: Literal["cash", "fgts"] | None = Field(
        "cash",
        description="Source of funds for extra amortization: cash (default) or FGTS",
    )

    @model_validator(mode="after")
    def validate_recurrence(self) -> "AmortizationInput":
        # Backward compatibility: treat null value_type as fixed.
        if self.value_type is None:
            self.value_type = "fixed"

        if self.month is not None and self.month < 1:
            raise ValueError("month must be >= 1")
        if self.end_month is not None and self.end_month < 1:
            raise ValueError("end_month must be >= 1")
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


class ContributionInput(BaseModel):
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
        ..., description="Contribution value or percentage depending on value_type"
    )
    end_month: int | None = Field(
        None, description="Last month (inclusive) for recurring contributions"
    )
    interval_months: int | None = Field(
        None, description="Interval in months for recurrence (e.g. 12 for annual)"
    )
    occurrences: int | None = Field(
        None, description="Number of occurrences (alternative to end_month)"
    )
    value_type: Literal["fixed", "percentage"] | None = Field(
        "fixed",
        description="Whether value is fixed currency or percentage of investment balance",
    )
    inflation_adjust: bool | None = Field(
        False,
        description="If true, fixed values are inflation-adjusted from the first occurrence month",
    )

    @model_validator(mode="after")
    def validate_recurrence(self) -> "ContributionInput":
        if self.value_type is None:
            self.value_type = "fixed"

        if self.month is not None and self.month < 1:
            raise ValueError("month must be >= 1")
        if self.end_month is not None and self.end_month < 1:
            raise ValueError("end_month must be >= 1")
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

        return self


class InvestmentReturnInput(BaseModel):
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
        return self


class InvestmentTaxInput(BaseModel):
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


class FGTSInput(BaseModel):
    initial_balance: float = Field(
        0.0, ge=0.0, description="Initial FGTS balance available (R$)."
    )
    monthly_contribution: float = Field(
        0.0, ge=0.0, description="Monthly FGTS contribution (R$)."
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
    principal_payment: float | None = None
    interest_payment: float | None = None
    outstanding_balance: float | None = None
    equity_percentage: float | None = None

    # Rent/invest-related
    rent_due: float | None = None
    rent_paid: float | None = None
    rent_shortfall: float | None = None
    investment_return: float | None = None
    liquid_wealth: float | None = None
    cumulative_rent_paid: float | None = None
    cumulative_investment_gains: float | None = None
    investment_roi_percentage: float | None = None

    # Costs
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
    external_surplus_invested: float | None = None
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


class AdditionalCostsInput(BaseModel):
    itbi_percentage: float = Field(
        2.0,
        ge=0.0,
        description="ITBI tax percentage",
    )
    deed_percentage: float = Field(
        1.0,
        ge=0.0,
        description="Deed cost percentage",
    )
    monthly_hoa: float | None = Field(
        None, ge=0.0, description="Monthly homeowners association fee"
    )
    monthly_property_tax: float | None = Field(
        None, ge=0.0, description="Monthly property tax (IPTU)"
    )


class LoanSimulationInput(BaseModel):
    property_value: float = Field(..., gt=0.0, description="Total property value")
    down_payment: float = Field(..., ge=0.0, description="Down payment value")
    loan_term_years: int = Field(..., gt=0, description="Loan term in years")
    annual_interest_rate: float | None = Field(
        None, ge=0.0, description="Annual interest rate (in percentage)"
    )
    monthly_interest_rate: float | None = Field(
        None, ge=0.0, description="Monthly interest rate (in percentage)"
    )
    loan_type: Literal["SAC", "PRICE"] = Field(
        ..., description="Loan type: SAC or PRICE"
    )
    amortizations: list[AmortizationInput] | None = Field(
        None, description="Extra amortizations"
    )
    additional_costs: AdditionalCostsInput | None = Field(
        None, description="Additional costs like ITBI, deed, HOA, property tax"
    )
    inflation_rate: float | None = Field(
        None,
        ge=0.0,
        description="Annual inflation rate for general costs (in percentage)",
    )
    rent_inflation_rate: float | None = Field(
        None,
        ge=0.0,
        description="Annual rent inflation rate (in percentage) - if not provided, uses inflation_rate",
    )
    property_appreciation_rate: float | None = Field(
        None,
        ge=0.0,
        description="Annual property appreciation rate (in percentage) - if not provided, uses inflation_rate",
    )

    @model_validator(mode="after")
    def validate_financing_fields(self) -> "LoanSimulationInput":
        if self.down_payment > self.property_value:
            raise ValueError("down_payment must be <= property_value")
        return self


class ComparisonInput(BaseModel):
    property_value: float = Field(..., gt=0.0, description="Total property value")
    down_payment: float = Field(..., ge=0.0, description="Down payment value")
    total_savings: float | None = Field(
        None,
        ge=0.0,
        description=(
            "Total liquid savings available at month 1 (cash). If provided, it must cover the cash down payment "
            "AND the upfront transaction costs (ITBI + deed) calculated from additional_costs. "
            "The remaining amount becomes initial_investment."
        ),
    )
    loan_term_years: int = Field(..., gt=0, description="Loan term in years")
    annual_interest_rate: float | None = Field(
        None, ge=0.0, description="Annual interest rate (in percentage)"
    )
    monthly_interest_rate: float | None = Field(
        None, ge=0.0, description="Monthly interest rate (in percentage)"
    )
    loan_type: Literal["SAC", "PRICE"] = Field(
        ..., description="Loan type: SAC or PRICE"
    )
    rent_value: float | None = Field(None, ge=0.0, description="Monthly rent value")
    rent_percentage: float | None = Field(
        None, ge=0.0, description="Rent as percentage of property value"
    )
    investment_returns: list[InvestmentReturnInput] = Field(
        ..., description="Investment return rates over time"
    )
    amortizations: list[AmortizationInput] | None = Field(
        None, description="Extra amortizations"
    )
    contributions: list[ContributionInput] | None = Field(
        None,
        description=(
            "Scheduled investment contributions (aportes) for the invest-then-buy scenario. "
            "Use this instead of amortizations; amortizations are reserved for extra loan prepayments."
        ),
    )
    additional_costs: AdditionalCostsInput | None = Field(
        None, description="Additional costs like ITBI, deed, HOA, property tax"
    )
    inflation_rate: float | None = Field(
        None,
        ge=0.0,
        description="Annual inflation rate for general costs (in percentage)",
    )
    rent_inflation_rate: float | None = Field(
        None,
        ge=0.0,
        description="Annual rent inflation rate (in percentage) - if not provided, uses inflation_rate",
    )
    property_appreciation_rate: float | None = Field(
        None,
        ge=0.0,
        description="Annual property appreciation rate (in percentage) - if not provided, uses inflation_rate",
    )
    # New fields for invest then buy scenario
    invest_loan_difference: bool = Field(
        False,
        description="Whether to invest the difference between loan payment and rent",
    )
    fixed_monthly_investment: float | None = Field(
        None, ge=0.0, description="Fixed amount to invest monthly"
    )
    fixed_investment_start_month: int | None = Field(
        1,
        description="Month to start fixed investment (1 for immediate, or after purchase month)",
    )
    rent_reduces_investment: bool = Field(
        False,
        description="If true, rent (and related costs) is paid from investment balance before returns; otherwise assumed paid from external income.",
    )
    monthly_external_savings: float | None = Field(
        None,
        ge=0.0,
        description="External monthly savings/income earmarked to cover rent/costs before touching investment (optional).",
    )
    invest_external_surplus: bool = Field(
        False,
        description="If true, any unused portion of monthly_external_savings (after rent/costs) is invested that month.",
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
        if (
            self.fixed_investment_start_month is not None
            and self.fixed_investment_start_month < 1
        ):
            raise ValueError("fixed_investment_start_month must be >= 1")
        if self.total_savings is not None:
            # total_savings represents the user's total liquid cash available at month 1.
            # It must cover the cash down payment and the upfront transaction costs.
            costs = AdditionalCostsCalculator.from_input(self.additional_costs).calculate(
                self.property_value
            )
            total_upfront = float(costs["total_upfront"])
            min_required = self.down_payment + total_upfront
            if self.total_savings < min_required:
                raise ValueError(
                    "total_savings must be >= down_payment + upfront_costs (ITBI + deed)"
                )

        _validate_investment_return_ranges(list(self.investment_returns or []))
        return self

    @property
    def initial_investment(self) -> float:
        """Calculated initial investment capital.

        When total_savings is provided, we treat it as the user's total liquid cash
        available at month 1. The cash down payment and upfront transaction costs
        are paid from this pool; whatever remains is invested (initial_investment).
        """
        if self.total_savings is not None:
            costs = AdditionalCostsCalculator.from_input(self.additional_costs).calculate(
                self.property_value
            )
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
    scenario_type: Literal["buy", "rent_invest", "invest_buy"] | None = Field(
        None,
        description="Stable identifier for the scenario (used for metrics and comparisons)",
    )
    total_cost: float
    final_equity: float
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
    roi_percentage: float = Field(..., description="Return on investment percentage")
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
        description="Average of (investment_return / withdrawal) in months with withdrawal >0 (values >1 mean fully covered by returns)",
    )


class EnhancedComparisonScenario(BaseModel):
    name: str
    total_cost: float
    final_equity: float
    total_outflows: float | None = Field(
        None,
        description="Gross outflows (down payment + payments + rent + costs + investments)",
    )
    net_cost: float | None = Field(
        None,
        description="Net cost after subtracting remaining equity/assets",
    )
    monthly_data: list[MonthlyRecord]
    metrics: ComparisonMetrics
    purchase_breakdown: PurchaseBreakdown | None = None
    fgts_summary: FGTSUsageSummary | None = None


class ComparisonResult(BaseModel):
    best_scenario: str
    scenarios: list[ComparisonScenario]


class EnhancedComparisonResult(BaseModel):
    best_scenario: str
    scenarios: list[EnhancedComparisonScenario]
    comparative_summary: dict[str, dict[str, object]] = Field(
        ..., description="Month-by-month comparison between scenarios"
    )


class ScenarioMetricsSummary(BaseModel):
    name: str
    net_cost: float
    final_equity: float
    total_outflows: float | None = None
    roi_percentage: float
    roi_including_withdrawals_percentage: float | None = None
    total_rent_withdrawn_from_investment: float | None = None
    months_with_burn: int | None = None
    average_sustainable_withdrawal_ratio: float | None = None


class ScenariosMetricsResult(BaseModel):
    best_scenario: str
    metrics: list[ScenarioMetricsSummary]
