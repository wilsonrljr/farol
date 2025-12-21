"""Structural typing protocols used by core calculation modules.

These protocols reduce coupling between the calculation layer (core/) and the
API layer (Pydantic models in models.py), while keeping runtime behavior the same.
"""

from __future__ import annotations

from typing import Protocol


class AdditionalCostsLike(Protocol):
    itbi_percentage: float
    deed_percentage: float
    monthly_hoa: float | None
    monthly_property_tax: float | None


class AmortizationLike(Protocol):
    month: int | None
    value: float
    end_month: int | None
    interval_months: int | None
    occurrences: int | None
    value_type: str | None
    inflation_adjust: bool | None


class ContributionLike(Protocol):
    month: int | None
    value: float
    end_month: int | None
    interval_months: int | None
    occurrences: int | None
    value_type: str | None
    inflation_adjust: bool | None


class FGTSLike(Protocol):
    initial_balance: float
    monthly_contribution: float
    annual_yield_rate: float
    use_at_purchase: bool
    max_withdrawal_at_purchase: float | None


class InvestmentReturnLike(Protocol):
    start_month: int
    end_month: int | None
    annual_rate: float


class InvestmentTaxLike(Protocol):
    enabled: bool
    mode: str
    effective_tax_rate: float
