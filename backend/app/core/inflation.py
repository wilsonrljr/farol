"""Inflation and appreciation calculation utilities.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

MONTHS_PER_YEAR = 12
PERCENTAGE_BASE = 100


def apply_inflation(
    value: float,
    month: int,
    base_month: int = 1,
    annual_inflation_rate: float | None = None,
) -> float:
    """Apply inflation to a value based on complete years passed.

    In real life, values like rent, income, and expenses are adjusted for
    inflation once per year (annually), not every month. This function
    implements that behavior by only applying inflation adjustments at
    the start of each new year (every 12 months).

    Args:
        value: The base value to inflate.
        month: The target month.
        base_month: The reference month (default 1).
        annual_inflation_rate: Annual inflation rate in percentage.

    Returns:
        The inflation-adjusted value (changes only at year boundaries).

    Example:
        With 5% annual inflation starting at month 1:
        - Months 1-12: value unchanged (1000.00)
        - Months 13-24: value * 1.05 (1050.00)
        - Months 25-36: value * 1.05^2 (1102.50)
    """
    if annual_inflation_rate is None or annual_inflation_rate == 0:
        return value

    months_passed = month - base_month
    if months_passed < 0:
        return value

    # Calculate complete years passed (integer division)
    # Inflation is applied only once per year, at the start of each new year
    complete_years = months_passed // MONTHS_PER_YEAR

    if complete_years <= 0:
        return value

    annual_multiplier = 1 + (annual_inflation_rate / PERCENTAGE_BASE)
    return value * (annual_multiplier**complete_years)


def apply_property_appreciation(
    property_value: float,
    month: int,
    base_month: int = 1,
    property_appreciation_rate: float | None = None,
    fallback_inflation_rate: float | None = None,
) -> float:
    """Apply property appreciation to a property value.

    Args:
        property_value: The base property value.
        month: The target month.
        base_month: The reference month (default 1).
        property_appreciation_rate: Annual appreciation rate in percentage.
        fallback_inflation_rate: Fallback rate if appreciation rate not provided.

    Returns:
        The appreciation-adjusted property value.
    """
    # NOTE: must treat 0.0 as a valid explicit value (no appreciation).
    appreciation_rate = (
        property_appreciation_rate
        if property_appreciation_rate is not None
        else fallback_inflation_rate
    )

    if appreciation_rate is None or appreciation_rate == 0:
        return property_value

    months_passed = month - base_month
    monthly_appreciation_rate = _annual_rate_to_monthly_multiplier(appreciation_rate)

    return property_value * ((1 + monthly_appreciation_rate) ** months_passed)


def _annual_rate_to_monthly_multiplier(annual_rate: float) -> float:
    """Convert annual rate percentage to monthly multiplier."""
    return (1 + annual_rate / PERCENTAGE_BASE) ** (1 / MONTHS_PER_YEAR) - 1
