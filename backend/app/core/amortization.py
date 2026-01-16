"""Amortization preprocessing utilities.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

from collections import defaultdict
from collections.abc import Sequence

from .inflation import apply_inflation
from .protocols import AmortizationLike, ContributionLike

AmortizationOrContributionLike = AmortizationLike | ContributionLike


def preprocess_amortizations(
    amortizations: Sequence[AmortizationOrContributionLike] | None,
    term_months: int,
    annual_inflation_rate: float | None = None,
) -> tuple[dict[int, float], dict[int, list[float]]]:
    """Expand and separate fixed and percentage amortizations.

    Args:
        amortizations: List of amortization configurations.
        term_months: Total loan term in months.
        annual_inflation_rate: Annual inflation rate for adjustments.

    Returns:
        Tuple of:
        - fixed_by_month: month -> total fixed extra amortization
        - percent_by_month: month -> list of percentage values to apply
    """
    if not amortizations:
        return {}, {}

    fixed_by_month: dict[int, float] = defaultdict(float)
    percent_by_month: dict[int, list[float]] = defaultdict(list)

    for amort in amortizations:
        months = _get_amortization_months(amort, term_months)
        if not months:
            continue

        base_month = months[0]
        _distribute_amortization(
            amort,
            months,
            base_month,
            term_months,
            annual_inflation_rate,
            fixed_by_month,
            percent_by_month,
        )

    return dict(fixed_by_month), dict(percent_by_month)


def _get_amortization_months(
    amort: AmortizationOrContributionLike,
    term_months: int,
) -> list[int]:
    """Determine which months an amortization applies to.

    Args:
        amort: Amortization configuration.
        term_months: Total loan term in months.

    Returns:
        List of month numbers.
    """
    if amort.interval_months and amort.interval_months > 0:
        return _get_recurring_months(amort, term_months)

    # Single event
    if amort.month is None:
        return []
    return [amort.month]


def _get_recurring_months(
    amort: AmortizationOrContributionLike,
    term_months: int,
) -> list[int]:
    """Get months for recurring amortization.

    Args:
        amort: Amortization configuration with interval.
        term_months: Total loan term in months.

    Returns:
        List of month numbers for recurring amortization.
    """
    start = amort.month or 1
    interval = amort.interval_months or 1

    if amort.occurrences:
        return [start + i * interval for i in range(amort.occurrences)]

    end = amort.end_month or term_months
    return list(range(start, min(end, term_months) + 1, interval))


def _distribute_amortization(
    amort: AmortizationOrContributionLike,
    months: list[int],
    base_month: int,
    term_months: int,
    annual_inflation_rate: float | None,
    fixed_by_month: dict[int, float],
    percent_by_month: dict[int, list[float]],
) -> None:
    """Distribute amortization values across months.

    Args:
        amort: Amortization configuration.
        months: List of months to apply to.
        base_month: Reference month for inflation.
        term_months: Total loan term in months.
        annual_inflation_rate: Annual inflation rate.
        fixed_by_month: Dictionary to update with fixed values.
        percent_by_month: Dictionary to update with percentage values.
    """
    for month in months:
        if month < 1 or month > term_months:
            continue

        if amort.value_type == "percentage":
            percent_by_month[month].append(amort.value)
        else:
            value = amort.value
            if amort.inflation_adjust:
                value = apply_inflation(value, month, base_month, annual_inflation_rate)
            fixed_by_month[month] += value


def expand_amortization_to_months(
    amortizations: Sequence[AmortizationOrContributionLike] | None,
    term_months: int,
    annual_inflation_rate: float | None = None,
) -> dict[int, float]:
    """Expand amortizations to a per-month value mapping.

    Similar to preprocess_amortizations but returns a simple month->value dict
    that sums all fixed amortization values for each month. Percentages are ignored.

    Args:
        amortizations: List of amortization configurations.
        term_months: Total loan term in months.
        annual_inflation_rate: Annual inflation rate for adjustments.

    Returns:
        Dictionary mapping month number to total fixed amortization value.
    """
    if not amortizations:
        return {}

    fixed_by_month: dict[int, float] = defaultdict(float)

    for amort in amortizations:
        months = _get_amortization_months(amort, term_months)
        if not months:
            continue

        base_month = months[0]
        for month in months:
            if month < 1 or month > term_months:
                continue

            if amort.value_type == "percentage":
                # Skip percentages for this helper - only fixed values
                continue

            value = amort.value
            if amort.inflation_adjust:
                value = apply_inflation(value, month, base_month, annual_inflation_rate)
            fixed_by_month[month] += value

    return dict(fixed_by_month)
