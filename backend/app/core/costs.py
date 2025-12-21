"""Cost calculation utilities for property transactions.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

from dataclasses import dataclass
from typing import TypedDict

from .inflation import apply_inflation
from .protocols import AdditionalCostsLike

PERCENTAGE_BASE = 100


class CostsBreakdown(TypedDict):
    """Type definition for costs breakdown dictionary."""

    itbi: float
    deed: float
    total_upfront: float
    monthly_hoa: float
    monthly_property_tax: float
    total_monthly: float


@dataclass(frozen=True)
class AdditionalCostsCalculator:
    """Calculator for additional property purchase costs.

    Uses composition pattern to encapsulate cost calculation logic.
    """

    itbi_percentage: float = 0.0
    deed_percentage: float = 0.0
    monthly_hoa: float = 0.0
    monthly_property_tax: float = 0.0

    @classmethod
    def from_input(
        cls, costs_input: AdditionalCostsLike | None
    ) -> "AdditionalCostsCalculator":
        """Create calculator from API input model."""
        if costs_input is None:
            return cls()

        return cls(
            itbi_percentage=costs_input.itbi_percentage,
            deed_percentage=costs_input.deed_percentage,
            monthly_hoa=costs_input.monthly_hoa or 0.0,
            monthly_property_tax=costs_input.monthly_property_tax or 0.0,
        )

    def calculate(self, property_value: float) -> CostsBreakdown:
        """Calculate all costs for a given property value.

        Args:
            property_value: The property value to calculate costs for.

        Returns:
            Dictionary with all cost breakdowns.
        """
        itbi = property_value * (self.itbi_percentage / PERCENTAGE_BASE)
        deed = property_value * (self.deed_percentage / PERCENTAGE_BASE)

        return CostsBreakdown(
            itbi=itbi,
            deed=deed,
            total_upfront=itbi + deed,
            monthly_hoa=self.monthly_hoa,
            monthly_property_tax=self.monthly_property_tax,
            total_monthly=self.monthly_hoa + self.monthly_property_tax,
        )

    def get_inflated_monthly_costs(
        self,
        month: int,
        inflation_rate: float | None,
    ) -> tuple[float, float, float]:
        """Get inflation-adjusted monthly costs.

        Args:
            month: The month to calculate costs for.
            inflation_rate: Annual inflation rate in percentage.

        Returns:
            Tuple of (monthly_hoa, monthly_property_tax, total_monthly).
        """
        monthly_hoa = apply_inflation(self.monthly_hoa, month, 1, inflation_rate)
        monthly_property_tax = apply_inflation(
            self.monthly_property_tax, month, 1, inflation_rate
        )
        return monthly_hoa, monthly_property_tax, monthly_hoa + monthly_property_tax


def calculate_additional_costs(
    property_value: float,
    additional_costs: AdditionalCostsLike | None = None,
) -> CostsBreakdown:
    """Calculate additional costs associated with property purchase.

    This is a convenience function that wraps AdditionalCostsCalculator.

    Args:
        property_value: The property value.
        additional_costs: Optional costs configuration.

    Returns:
        Dictionary with all cost breakdowns.
    """
    calculator = AdditionalCostsCalculator.from_input(additional_costs)
    return calculator.calculate(property_value)
