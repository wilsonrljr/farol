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

from pydantic import BaseModel, Field, model_validator
from typing import List, Optional, Literal


class AmortizationInput(BaseModel):
    # Original fields (backward compatibility): single event when only month + value provided
    month: Optional[int] = Field(
        None, description="Month when the amortization occurs (for single events)"
    )
    value: float = Field(
        ..., description="Amortization value or percentage depending on value_type"
    )
    # Extended recurrence / behavior fields
    end_month: Optional[int] = Field(
        None, description="Last month (inclusive) for recurring amortizations"
    )
    interval_months: Optional[int] = Field(
        None, description="Interval in months for recurrence (e.g. 12 for annual)"
    )
    occurrences: Optional[int] = Field(
        None, description="Number of occurrences (alternative to end_month)"
    )
    value_type: Optional[Literal["fixed", "percentage"]] = Field(
        "fixed",
        description="Whether value is fixed currency or percentage of outstanding balance",
    )
    inflation_adjust: Optional[bool] = Field(
        False,
        description="If true, fixed values are inflation-adjusted from the first occurrence month",
    )

    @model_validator(mode="after")
    def validate_recurrence(self):  # type: ignore
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
        return self


class InvestmentReturnInput(BaseModel):
    start_month: int = Field(..., description="Starting month for this return rate")
    end_month: Optional[int] = Field(
        None, description="Ending month for this return rate (None means until the end)"
    )
    annual_rate: float = Field(..., description="Annual return rate (in percentage)")

    @model_validator(mode="after")
    def validate_months(self):  # type: ignore
        if self.start_month < 1:
            raise ValueError("start_month must be >= 1")
        if self.end_month is not None and self.end_month < 1:
            raise ValueError("end_month must be >= 1")
        if self.end_month is not None and self.end_month < self.start_month:
            raise ValueError("end_month must be >= start_month")
        return self


class InvestmentTaxInput(BaseModel):
    enabled: bool = Field(
        False,
        description="If true, applies an effective tax rate over monthly investment returns (approximation).",
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
    max_withdrawal_at_purchase: Optional[float] = Field(
        None,
        ge=0.0,
        description="Maximum FGTS withdrawal at purchase (R$). None means withdraw up to full balance.",
    )


class MonthlyRecord(BaseModel):
    month: int
    cash_flow: float

    scenario_type: Optional[str] = None
    status: Optional[str] = None
    phase: Optional[str] = None

    equity: Optional[float] = None
    investment_balance: Optional[float] = None
    property_value: Optional[float] = None

    # Loan-related
    installment: Optional[float] = None
    principal_payment: Optional[float] = None
    interest_payment: Optional[float] = None
    outstanding_balance: Optional[float] = None
    equity_percentage: Optional[float] = None

    # Rent/invest-related
    rent_paid: Optional[float] = None
    investment_return: Optional[float] = None
    liquid_wealth: Optional[float] = None
    cumulative_rent_paid: Optional[float] = None
    cumulative_investment_gains: Optional[float] = None
    investment_roi_percentage: Optional[float] = None

    # Costs
    monthly_hoa: Optional[float] = None
    monthly_property_tax: Optional[float] = None
    monthly_additional_costs: Optional[float] = None
    total_monthly_cost: Optional[float] = None
    cumulative_payments: Optional[float] = None
    cumulative_interest: Optional[float] = None

    # Invest-then-buy progress
    additional_investment: Optional[float] = None
    target_purchase_cost: Optional[float] = None
    progress_percent: Optional[float] = None
    shortfall: Optional[float] = None
    is_milestone: Optional[bool] = None
    purchase_month: Optional[int] = None
    purchase_price: Optional[float] = None
    projected_purchase_month: Optional[int] = None
    estimated_months_remaining: Optional[int] = None

    # Scheduled contributions (derived from amortizations)
    extra_contribution_fixed: Optional[float] = None
    extra_contribution_percentage: Optional[float] = None
    extra_contribution_total: Optional[float] = None

    # Sustainability & external cover
    rent_withdrawal_from_investment: Optional[float] = None
    remaining_investment_before_return: Optional[float] = None
    external_cover: Optional[float] = None
    external_surplus_invested: Optional[float] = None
    sustainable_withdrawal_ratio: Optional[float] = None
    burn_month: Optional[bool] = None

    # New: Investment tax (approximation)
    investment_return_gross: Optional[float] = None
    investment_tax_paid: Optional[float] = None
    investment_return_net: Optional[float] = None

    # New: FGTS
    fgts_balance: Optional[float] = None
    fgts_used: Optional[float] = None

    # New: Upfront costs always paid cash
    upfront_additional_costs: Optional[float] = None


class AdditionalCostsInput(BaseModel):
    itbi_percentage: float = Field(2.0, description="ITBI tax percentage")
    deed_percentage: float = Field(1.0, description="Deed cost percentage")
    monthly_hoa: Optional[float] = Field(
        None, description="Monthly homeowners association fee"
    )
    monthly_property_tax: Optional[float] = Field(
        None, description="Monthly property tax (IPTU)"
    )


class LoanSimulationInput(BaseModel):
    property_value: float = Field(..., description="Total property value")
    down_payment: float = Field(..., description="Down payment value")
    loan_term_years: int = Field(..., description="Loan term in years")
    annual_interest_rate: Optional[float] = Field(
        None, description="Annual interest rate (in percentage)"
    )
    monthly_interest_rate: Optional[float] = Field(
        None, description="Monthly interest rate (in percentage)"
    )
    loan_type: Literal["SAC", "PRICE"] = Field(
        ..., description="Loan type: SAC or PRICE"
    )
    amortizations: Optional[List[AmortizationInput]] = Field(
        None, description="Extra amortizations"
    )
    additional_costs: Optional[AdditionalCostsInput] = Field(
        None, description="Additional costs like ITBI, deed, HOA, property tax"
    )
    inflation_rate: Optional[float] = Field(
        None, description="Annual inflation rate for general costs (in percentage)"
    )
    rent_inflation_rate: Optional[float] = Field(
        None,
        description="Annual rent inflation rate (in percentage) - if not provided, uses inflation_rate",
    )
    property_appreciation_rate: Optional[float] = Field(
        None,
        description="Annual property appreciation rate (in percentage) - if not provided, uses inflation_rate",
    )


class ComparisonInput(BaseModel):
    property_value: float = Field(..., description="Total property value")
    down_payment: float = Field(..., description="Down payment value")
    loan_term_years: int = Field(..., description="Loan term in years")
    annual_interest_rate: Optional[float] = Field(
        None, description="Annual interest rate (in percentage)"
    )
    monthly_interest_rate: Optional[float] = Field(
        None, description="Monthly interest rate (in percentage)"
    )
    loan_type: Literal["SAC", "PRICE"] = Field(
        ..., description="Loan type: SAC or PRICE"
    )
    rent_value: Optional[float] = Field(None, description="Monthly rent value")
    rent_percentage: Optional[float] = Field(
        None, description="Rent as percentage of property value"
    )
    investment_returns: List[InvestmentReturnInput] = Field(
        ..., description="Investment return rates over time"
    )
    amortizations: Optional[List[AmortizationInput]] = Field(
        None, description="Extra amortizations"
    )
    additional_costs: Optional[AdditionalCostsInput] = Field(
        None, description="Additional costs like ITBI, deed, HOA, property tax"
    )
    inflation_rate: Optional[float] = Field(
        None, description="Annual inflation rate for general costs (in percentage)"
    )
    rent_inflation_rate: Optional[float] = Field(
        None,
        description="Annual rent inflation rate (in percentage) - if not provided, uses inflation_rate",
    )
    property_appreciation_rate: Optional[float] = Field(
        None,
        description="Annual property appreciation rate (in percentage) - if not provided, uses inflation_rate",
    )
    # New fields for invest then buy scenario
    invest_loan_difference: bool = Field(
        False,
        description="Whether to invest the difference between loan payment and rent",
    )
    fixed_monthly_investment: Optional[float] = Field(
        None, description="Fixed amount to invest monthly"
    )
    fixed_investment_start_month: Optional[int] = Field(
        1,
        description="Month to start fixed investment (1 for immediate, or after purchase month)",
    )
    rent_reduces_investment: bool = Field(
        False,
        description="If true, rent (and related costs) is paid from investment balance before returns; otherwise assumed paid from external income.",
    )
    monthly_external_savings: Optional[float] = Field(
        None,
        description="External monthly savings/income earmarked to cover rent/costs before touching investment (optional).",
    )
    invest_external_surplus: bool = Field(
        False,
        description="If true, any unused portion of monthly_external_savings (after rent/costs) is invested that month.",
    )

    investment_tax: Optional[InvestmentTaxInput] = Field(
        None,
        description="Optional effective taxation over monthly investment returns (approximation).",
    )
    fgts: Optional[FGTSInput] = Field(
        None,
        description="Optional FGTS balance and usage rules (MVP: use only at purchase).",
    )

    @model_validator(mode="after")
    def validate_month_fields(self):  # type: ignore
        if (
            self.fixed_investment_start_month is not None
            and self.fixed_investment_start_month < 1
        ):
            raise ValueError("fixed_investment_start_month must be >= 1")
        return self


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
    installments: List[LoanInstallment]
    # New optional metadata fields (populated when amortizações extras encurtam o prazo)
    original_term_months: Optional[int] = Field(
        None, description="Planned term in months before extra amortizations"
    )
    actual_term_months: Optional[int] = Field(
        None, description="Actual term in months until balance reached zero"
    )
    months_saved: Optional[int] = Field(
        None, description="original_term_months - actual_term_months when applicable"
    )
    total_extra_amortization: Optional[float] = Field(
        None, description="Sum of all extra amortizations applied"
    )


class ComparisonScenario(BaseModel):
    name: str
    total_cost: float
    final_equity: float
    monthly_data: List[MonthlyRecord]
    # New fields for clearer cost semantics. total_outflows = sum of all cash out (gross).
    # net_cost = total_outflows - final_equity (net of assets). Kept optional for backward compatibility.
    total_outflows: Optional[float] = Field(
        None,
        description="Gross outflows (down payment + payments + rent + costs + investments)",
    )
    net_cost: Optional[float] = Field(
        None,
        description="Net cost after subtracting remaining equity/assets (alias of total_cost if provided)",
    )


class ComparisonMetrics(BaseModel):
    """Enhanced comparison metrics for better visualization."""

    total_cost_difference: float = Field(
        ..., description="Difference from best scenario"
    )
    total_cost_percentage_difference: float = Field(
        ..., description="Percentage difference from best scenario"
    )
    break_even_month: Optional[int] = Field(
        None, description="Month when this scenario becomes profitable"
    )
    roi_percentage: float = Field(..., description="Return on investment percentage")
    roi_adjusted_percentage: Optional[float] = Field(
        None, description="Adjusted ROI adding back withdrawals used to pay rent/costs"
    )
    average_monthly_cost: float = Field(..., description="Average monthly cost")
    total_interest_or_rent_paid: float = Field(
        ..., description="Total interest paid (loan) or rent paid"
    )
    wealth_accumulation: float = Field(
        ..., description="Total wealth accumulated (equity + investments)"
    )
    # Optional sustainability-related aggregate metrics (may be absent for buy scenario)
    total_rent_withdrawn_from_investment: Optional[float] = Field(
        None, description="Sum of rent+costs amount withdrawn from investment principal"
    )
    months_with_burn: Optional[int] = Field(
        None,
        description="Number of months where withdrawals exceeded investment returns",
    )
    average_sustainable_withdrawal_ratio: Optional[float] = Field(
        None,
        description="Average of (investment_return / withdrawal) in months with withdrawal >0 (values >1 mean fully covered by returns)",
    )


class EnhancedComparisonScenario(BaseModel):
    name: str
    total_cost: float
    final_equity: float
    monthly_data: List[MonthlyRecord]
    metrics: ComparisonMetrics


class ComparisonResult(BaseModel):
    best_scenario: str
    scenarios: List[ComparisonScenario]


class EnhancedComparisonResult(BaseModel):
    best_scenario: str
    scenarios: List[EnhancedComparisonScenario]
    comparative_summary: dict = Field(
        ..., description="Month-by-month comparison between scenarios"
    )


class ScenarioMetricsSummary(BaseModel):
    name: str
    net_cost: float
    final_equity: float
    total_outflows: Optional[float] = None
    roi_percentage: float
    roi_adjusted_percentage: Optional[float] = None
    total_rent_withdrawn_from_investment: Optional[float] = None
    months_with_burn: Optional[int] = None
    average_sustainable_withdrawal_ratio: Optional[float] = None


class ScenariosMetricsResult(BaseModel):
    best_scenario: str
    metrics: List[ScenarioMetricsSummary]
