from pydantic import BaseModel, Field, model_validator
from typing import List, Optional, Literal
from datetime import date


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
        "fixed", description="Whether value is fixed currency or percentage of outstanding balance"
    )
    inflation_adjust: Optional[bool] = Field(
        False,
        description="If true, fixed values are inflation-adjusted from the first occurrence month",
    )

    @model_validator(mode="after")
    def validate_recurrence(self):  # type: ignore
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
    monthly_data: List[dict]
    # New fields for clearer cost semantics. total_outflows = sum of all cash out (gross).
    # net_cost = total_outflows - final_equity (net of assets). Kept optional for backward compatibility.
    total_outflows: Optional[float] = Field(
        None, description="Gross outflows (down payment + payments + rent + costs + investments)"
    )
    net_cost: Optional[float] = Field(
        None, description="Net cost after subtracting remaining equity/assets (alias of total_cost if provided)"
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
    average_monthly_cost: float = Field(..., description="Average monthly cost")
    total_interest_or_rent_paid: float = Field(
        ..., description="Total interest paid (loan) or rent paid"
    )
    wealth_accumulation: float = Field(
        ..., description="Total wealth accumulated (equity + investments)"
    )


class EnhancedComparisonScenario(BaseModel):
    name: str
    total_cost: float
    final_equity: float
    monthly_data: List[dict]
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
