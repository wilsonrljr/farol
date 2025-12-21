"""Base scenario simulator with common functionality.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Protocol

from ..core.costs import AdditionalCostsCalculator, CostsBreakdown
from ..core.fgts import FGTSManager
from ..core.inflation import apply_inflation
from ..core.protocols import (
    AdditionalCostsLike,
    FGTSLike,
)
from ..domain.models import MonthlyRecord
from ..models import ComparisonScenario


class _HasRentFields(Protocol):
    rent_value: float
    rent_inflation_rate: float | None
    inflation_rate: float | None


class _HasInvestmentBalance(Protocol):
    _investment_balance: float


@dataclass
class ScenarioSimulator(ABC):
    """Abstract base class for scenario simulators.

    Uses Template Method pattern for scenario simulation.

    Note: All required fields must be declared before optional ones
    to work correctly with dataclass inheritance.
    """

    # Required fields (must come first for dataclass inheritance)
    property_value: float = field(default=0.0)
    down_payment: float = field(default=0.0)
    term_months: int = field(default=0)

    # Optional fields
    additional_costs: AdditionalCostsLike | None = field(default=None)
    inflation_rate: float | None = field(default=None)
    fgts: FGTSLike | None = field(default=None)

    # Computed fields
    _costs_calculator: AdditionalCostsCalculator = field(init=False)
    _costs: CostsBreakdown = field(init=False)
    _fgts_manager: FGTSManager | None = field(init=False)
    _monthly_data: list[MonthlyRecord] = field(init=False, default_factory=list)

    def __post_init__(self) -> None:
        """Initialize computed fields."""
        if self.property_value <= 0:
            raise ValueError("property_value must be > 0")
        if self.down_payment < 0:
            raise ValueError("down_payment must be >= 0")
        if self.down_payment > self.property_value:
            raise ValueError("down_payment must be <= property_value")
        if self.term_months < 0:
            raise ValueError("term_months must be >= 0")

        self._costs_calculator = AdditionalCostsCalculator.from_input(
            self.additional_costs
        )
        self._costs = self._costs_calculator.calculate(self.property_value)
        self._fgts_manager = FGTSManager.from_input(self.fgts)
        self._monthly_data = []

    @property
    def scenario_name(self) -> str:
        """Name of the scenario in Portuguese."""
        return "Cenário Base"

    @property
    def fgts_balance(self) -> float:
        """Current FGTS balance."""
        if self._fgts_manager is None:
            return 0.0
        return self._fgts_manager.balance

    def accumulate_fgts(self) -> float:
        """Accumulate FGTS for one month."""
        if self._fgts_manager is None:
            return 0.0
        return self._fgts_manager.accumulate_monthly()

    def get_inflated_monthly_costs(self, month: int) -> tuple[float, float, float]:
        """Get inflation-adjusted monthly costs."""
        return self._costs_calculator.get_inflated_monthly_costs(
            month, self.inflation_rate
        )

    @abstractmethod
    def simulate(self) -> ComparisonScenario:
        """Run the scenario simulation."""


class RentalScenarioMixin:
    """Mixin for scenarios that involve renting.

    Important: this mixin intentionally does NOT declare dataclass fields.
    The concrete scenario dataclasses (e.g. RentAndInvestScenarioSimulator)
    own the fields like rent_value/rent_inflation_rate, and the base
    ScenarioSimulator owns inflation_rate.

    Keeping this as a plain class avoids subtle multiple-inheritance issues
    with duplicated dataclass fields.
    """

    # Type-only attributes expected from concrete scenario simulators.
    # They are intentionally not declared as dataclass fields here.
    rent_value: float
    rent_inflation_rate: float | None
    inflation_rate: float | None
    _investment_balance: float

    def get_current_rent(self: _HasRentFields, month: int) -> float:
        """Get inflation-adjusted rent for a month."""
        effective_rate = (
            self.rent_inflation_rate
            if self.rent_inflation_rate is not None
            else self.inflation_rate
        )
        return apply_inflation(self.rent_value, month, 1, effective_rate)

    def _apply_rent_cashflows(
        self: _HasInvestmentBalance,
        *,
        total_monthly_cost: float,
        rent_reduces_investment: bool,
        monthly_external_savings: float | None,
        invest_external_surplus: bool,
    ) -> dict[str, float]:
        """Process rent-related cashflows and update investment balance.

        Expects subclasses to define and manage self._investment_balance.
        """
        rent_withdrawal = 0.0
        external_cover = 0.0
        external_surplus_invested = 0.0

        investment_balance = float(getattr(self, "_investment_balance", 0.0))
        remaining_before_return = investment_balance

        if rent_reduces_investment:
            cost_remaining = total_monthly_cost

            if monthly_external_savings and monthly_external_savings > 0:
                external_cover = min(cost_remaining, monthly_external_savings)
                cost_remaining -= external_cover
                surplus = monthly_external_savings - external_cover

                if surplus > 0 and invest_external_surplus:
                    investment_balance += surplus
                    external_surplus_invested = surplus

            rent_withdrawal = min(cost_remaining, investment_balance)
            investment_balance -= rent_withdrawal
            remaining_before_return = investment_balance
        elif invest_external_surplus and monthly_external_savings:
            investment_balance += monthly_external_savings
            external_surplus_invested = monthly_external_savings
            remaining_before_return = investment_balance

        setattr(self, "_investment_balance", investment_balance)

        return {
            "rent_withdrawal": rent_withdrawal,
            "external_cover": external_cover,
            "external_surplus_invested": external_surplus_invested,
            "remaining_before_return": remaining_before_return,
        }


class InvestmentScenarioMixin:
    """Mixin for scenarios that involve investing.

    Provides common investment calculation functionality.
    """

    def initialize_investment(self, initial_balance: float) -> None:
        """Initialize investment balance."""
        self._investment_balance = initial_balance

    @property
    def investment_balance(self) -> float:
        """Current investment balance."""
        return self._investment_balance
