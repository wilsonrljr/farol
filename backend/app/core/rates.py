"""Interest rate conversion utilities.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

from collections.abc import Sequence

from .protocols import InvestmentReturnLike

# Constants for rate conversions
MONTHS_PER_YEAR = 12
PERCENTAGE_BASE = 100
RATE_TOLERANCE = 0.05


def convert_interest_rate(
    annual_rate: float | None = None,
    monthly_rate: float | None = None,
) -> tuple[float, float]:
    """Convert between annual and monthly interest rates.

    Args:
        annual_rate: Annual interest rate in percentage (e.g., 12.0 for 12%).
        monthly_rate: Monthly interest rate in percentage.

    Returns:
        Tuple of (annual_rate, monthly_rate) both in percentage.

    Raises:
        ValueError: If neither or both inconsistent rates are provided.
    """
    if annual_rate is not None and monthly_rate is None:
        monthly_rate = _annual_to_monthly(annual_rate)
        return annual_rate, monthly_rate

    if monthly_rate is not None and annual_rate is None:
        annual_rate = _monthly_to_annual(monthly_rate)
        return annual_rate, monthly_rate

    if annual_rate is None and monthly_rate is None:
        raise ValueError("Either annual_rate or monthly_rate must be provided")

    # Both provided: validate consistency within small tolerance
    if annual_rate is None or monthly_rate is None:
        raise ValueError("Both rates cannot be None when both are provided")

    _validate_rate_consistency(annual_rate, monthly_rate)
    return annual_rate, monthly_rate


def _annual_to_monthly(annual_rate: float) -> float:
    """Convert annual rate to monthly rate."""
    return (
        (1 + annual_rate / PERCENTAGE_BASE) ** (1 / MONTHS_PER_YEAR) - 1
    ) * PERCENTAGE_BASE


def _monthly_to_annual(monthly_rate: float) -> float:
    """Convert monthly rate to annual rate."""
    return (
        (1 + monthly_rate / PERCENTAGE_BASE) ** MONTHS_PER_YEAR - 1
    ) * PERCENTAGE_BASE


def _validate_rate_consistency(annual_rate: float, monthly_rate: float) -> None:
    """Validate that provided annual and monthly rates are consistent."""
    derived_annual = _monthly_to_annual(monthly_rate)
    if abs(derived_annual - annual_rate) > RATE_TOLERANCE:
        msg = (
            f"Provided annual ({annual_rate:.4f}%) and monthly ({monthly_rate:.4f}%) "
            f"rates are inconsistent (expected ~{derived_annual:.4f}%)."
        )
        raise ValueError(msg)


def get_monthly_investment_rate(
    investment_returns: Sequence[InvestmentReturnLike],
    month: int,
) -> float:
    """Get the monthly investment rate for a specific month.

    Args:
        investment_returns: List of investment return configurations.
        month: The month number to get the rate for.

    Returns:
        Monthly investment rate as a decimal (not percentage).
    """
    applicable = [
        ret
        for ret in investment_returns
        if ret.start_month <= month
        and (ret.end_month is None or month <= ret.end_month)
    ]

    if not applicable:
        return 0.0

    if len(applicable) > 1:
        ordered = sorted(applicable, key=lambda r: r.start_month)
        msg = (
            "Overlapping investment return ranges for the same month are not allowed. "
            f"Month={month}, matching ranges="
            + ", ".join(
                f"[{r.start_month}-{r.end_month or '∞'}]: {r.annual_rate}%"
                for r in ordered
            )
        )
        raise ValueError(msg)

    _, monthly_rate = convert_interest_rate(annual_rate=applicable[0].annual_rate)
    return monthly_rate / PERCENTAGE_BASE
