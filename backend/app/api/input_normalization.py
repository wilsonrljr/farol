"""Shared request normalization/validation helpers.

Centralizes cross-field input logic so routers stay thin and consistent.

We intentionally raise PublicInputError for business-rule validation; unexpected
ValueError instances remain private server errors.
"""

from __future__ import annotations

from ..core.rates import convert_interest_rate
from .errors import PublicInputError


def resolve_monthly_interest_rate(
    *,
    annual_interest_rate: float | None,
    monthly_interest_rate: float | None,
) -> float:
    """Resolve monthly interest rate in percentage.

    Exactly one representation must be provided so contradictory rates cannot
    be silently accepted.
    """
    provided = sum(
        value is not None for value in (annual_interest_rate, monthly_interest_rate)
    )
    if provided != 1:
        raise PublicInputError(
            "Provide exactly one of annual_interest_rate or monthly_interest_rate"
        )

    try:
        _, monthly_rate = convert_interest_rate(
            annual_interest_rate, monthly_interest_rate
        )
    except ValueError as exc:
        raise PublicInputError("Invalid interest rate configuration") from exc
    if monthly_rate is None:
        # Defensive: convert_interest_rate should always return a monthly rate
        raise PublicInputError("Unable to resolve monthly interest rate")

    return float(monthly_rate)


def resolve_rent_value(
    *,
    property_value: float,
    rent_value: float | None,
    rent_percentage: float | None,
) -> float:
    """Resolve rent_value from either explicit value or percentage.

    ``rent_percentage`` is a monthly percentage, matching the form label and
    Brazilian rental-market convention used throughout the product.
    """
    provided = sum(value is not None for value in (rent_value, rent_percentage))
    if provided != 1:
        raise PublicInputError("Provide exactly one of rent_value or rent_percentage")

    if rent_value is not None:
        return float(rent_value)

    if rent_percentage is not None:
        return float(property_value) * (float(rent_percentage) / 100.0)

    raise PublicInputError("Provide exactly one of rent_value or rent_percentage")
