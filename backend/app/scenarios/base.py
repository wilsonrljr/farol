"""Base scenario simulator with common functionality.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from ..core.costs import AdditionalCostsCalculator, CostsBreakdown
from ..core.fgts import FGTSManager
from ..core.inflation import apply_inflation
from ..models import (
    AdditionalCostsInput,
    ComparisonScenario,
    FGTSInput,
    InvestmentReturnInput,
    InvestmentTaxInput,
    MonthlyRecord,
)


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
    additional_costs: AdditionalCostsInput | None = field(default=None)
    inflation_rate: float | None = field(default=None)
    fgts: FGTSInput | None = field(default=None)

    # Computed fields
    _costs_calculator: AdditionalCostsCalculator = field(init=False)
    _costs: CostsBreakdown = field(init=False)
    _fgts_manager: FGTSManager | None = field(init=False)
    _monthly_data: list[MonthlyRecord] = field(init=False, default_factory=list)

    def __post_init__(self) -> None:
        """Initialize computed fields."""
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


@dataclass
class RentalScenarioMixin:
    """Mixin for scenarios that involve renting.

    Provides common rental calculation functionality.
    """

    rent_value: float = field(default=0.0)
    rent_inflation_rate: float | None = field(default=None)
    inflation_rate: float | None = field(default=None)

    def get_current_rent(self, month: int) -> float:
        """Get inflation-adjusted rent for a month."""
        effective_rate = (
            self.rent_inflation_rate
            if self.rent_inflation_rate is not None
            else self.inflation_rate
        )
        return apply_inflation(self.rent_value, month, 1, effective_rate)


@dataclass
class InvestmentScenarioMixin:
    """Mixin for scenarios that involve investing.

    Provides common investment calculation functionality.
    """

    investment_returns: list[InvestmentReturnInput] = field(default_factory=list)
    investment_tax: InvestmentTaxInput | None = field(default=None)

    _investment_balance: float = field(init=False, default=0.0)

    def initialize_investment(self, initial_balance: float) -> None:
        """Initialize investment balance."""
        self._investment_balance = initial_balance

    @property
    def investment_balance(self) -> float:
        """Current investment balance."""
        return self._investment_balance
