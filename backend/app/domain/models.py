"""Domain models for simulations.

These dataclasses intentionally mirror the API response shapes, but remain free
of Pydantic/FastAPI concerns so the calculation engine can be reused in other
contexts (CLI, batch jobs, notebooks).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass
class MonthlyRecord:
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
    rent_paid: float | None = None
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

    # Scheduled contributions
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

    # Investment tax (approximation)
    investment_return_gross: float | None = None
    investment_tax_paid: float | None = None
    investment_return_net: float | None = None

    # FGTS
    fgts_balance: float | None = None
    fgts_used: float | None = None

    # Upfront costs
    upfront_additional_costs: float | None = None


@dataclass
class ComparisonScenario:
    name: str
    scenario_type: Literal["buy", "rent_invest", "invest_buy"] | None
    total_cost: float
    final_equity: float
    monthly_data: list[MonthlyRecord]
    total_outflows: float | None = None
    net_cost: float | None = None
    opportunity_cost: float | None = None


@dataclass
class ComparisonMetrics:
    total_cost_difference: float
    total_cost_percentage_difference: float
    break_even_month: int | None
    roi_percentage: float
    roi_adjusted_percentage: float | None
    average_monthly_cost: float
    total_interest_or_rent_paid: float
    wealth_accumulation: float
    total_rent_withdrawn_from_investment: float | None = None
    months_with_burn: int | None = None
    average_sustainable_withdrawal_ratio: float | None = None


@dataclass
class EnhancedComparisonScenario:
    name: str
    total_cost: float
    final_equity: float
    monthly_data: list[MonthlyRecord]
    metrics: ComparisonMetrics
    total_outflows: float | None = None
    net_cost: float | None = None


@dataclass
class ComparisonResult:
    best_scenario: str
    scenarios: list[ComparisonScenario]


@dataclass
class EnhancedComparisonResult:
    best_scenario: str
    scenarios: list[EnhancedComparisonScenario]
    comparative_summary: dict[str, dict[str, object]]
