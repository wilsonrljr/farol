"""Structural typing protocols used by core calculation modules.

These protocols reduce coupling between the calculation layer (core/) and the
API layer (Pydantic models in models.py), while keeping runtime behavior the same.
"""

from __future__ import annotations

from typing import Protocol


class HousingMonthlyCostsLike(Protocol):
    hoa: float
    property_tax: float
    other: float


class AdditionalCostsLike(Protocol):
    itbi_percentage: float
    deed_percentage: float
    owner_monthly_costs: HousingMonthlyCostsLike
    renter_monthly_costs: HousingMonthlyCostsLike


class AmortizationLike(Protocol):
    month: int | None
    value: float
    end_month: int | None
    interval_months: int | None
    occurrences: int | None
    value_type: str | None
    inflation_adjust: bool | None
    funding_source: str | None


class ContributionLike(Protocol):
    month: int | None
    value: float
    end_month: int | None
    interval_months: int | None
    occurrences: int | None
    value_type: str | None
    inflation_adjust: bool | None
    applies_to: list[str] | None


class FGTSLike(Protocol):
    initial_balance: float
    monthly_contribution: float
    annual_yield_rate: float
    use_at_purchase: bool
    max_withdrawal_at_purchase: float | None
    financed_amortization: object | None


class InvestmentReturnLike(Protocol):
    start_month: int
    end_month: int | None
    annual_rate: float


class InvestmentTaxLike(Protocol):
    enabled: bool
    mode: str
    effective_tax_rate: float


class FinancedPurchaseAllocationLike(Protocol):
    amortization_percentage: float
    amortization_effect: str


class MonthlyPlanLike(Protocol):
    net_income: float
    non_housing_expenses: float
    adjust_for_inflation: bool
    wealth_allocation_percentage: float
    financed_purchase: FinancedPurchaseAllocationLike


class ExtraIncomeEventLike(Protocol):
    kind: str
    label: str | None
    amount: float
    month: int
    interval_months: int | None
    end_month: int | None
    inflation_adjust: bool
