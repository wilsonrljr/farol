"""Shared request normalization/validation helpers.

Centralizes cross-field input logic so routers stay thin and consistent.

We intentionally raise ValueError for business-rule validation; the API layer
maps ValueError -> HTTP 400 with a simple {detail: "..."} payload.
This keeps frontend error handling ergonomic.
"""

from __future__ import annotations

from ..finance import convert_interest_rate


def resolve_monthly_interest_rate(
    *,
    annual_interest_rate: float | None,
    monthly_interest_rate: float | None,
) -> float:
    """Resolve monthly interest rate in percentage.

    Accepts either annual or monthly (or both). At least one must be provided.
    """
    if annual_interest_rate is None and monthly_interest_rate is None:
        raise ValueError(
            "Either annual_interest_rate or monthly_interest_rate must be provided"
        )

    _, monthly_rate = convert_interest_rate(annual_interest_rate, monthly_interest_rate)
    if monthly_rate is None:
        # Defensive: convert_interest_rate should always return a monthly rate
        raise ValueError("Unable to resolve monthly interest rate")

    return float(monthly_rate)


def resolve_rent_value(
    *,
    property_value: float,
    rent_value: float | None,
    rent_percentage: float | None,
) -> float:
    """Resolve rent_value from either explicit value or percentage.

    If both are provided, rent_value takes precedence.
    """
    if rent_value is not None:
        return float(rent_value)

    if rent_percentage is not None:
        return float(property_value) * (float(rent_percentage) / 100.0) / 12.0

    raise ValueError("Either rent_value or rent_percentage must be provided")
