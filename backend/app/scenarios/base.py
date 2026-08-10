"""Base scenario simulator with common functionality.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

from abc import ABC, abstractmethod
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Literal, Protocol

from ..core.costs import AdditionalCostsCalculator, CostsBreakdown
from ..core.fgts import FGTSManager
from ..core.inflation import apply_inflation
from ..core.monthly_budget import MonthlyBudgetAllocation, allocate_monthly_budget
from ..core.protocols import (
    AdditionalCostsLike,
    ExtraIncomeEventLike,
    FGTSLike,
    MonthlyPlanLike,
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
    monthly_plan: MonthlyPlanLike | None = field(default=None)
    extra_income_events: Sequence[ExtraIncomeEventLike] | None = field(default=None)

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

    def get_inflated_monthly_costs(
        self, month: int, occupancy: Literal["owner", "renter"] = "owner"
    ) -> tuple[float, float, float, float]:
        """Get inflation-adjusted monthly costs."""
        return self._costs_calculator.get_inflated_monthly_costs(
            month, self.inflation_rate, occupancy
        )

    def get_effective_monthly_net_income(
        self,
        month: int,
        base_income: float | None,
        adjust_inflation: bool,
    ) -> float | None:
        """Resolve monthly net income, optionally adjusted by inflation."""
        if base_income is None:
            return None
        if not adjust_inflation:
            return base_income
        if self.inflation_rate is None:
            return base_income
        return apply_inflation(base_income, month, 1, self.inflation_rate)

    def allocate_budget(
        self,
        *,
        month: int,
        housing_due: float,
        financed: bool = False,
        outstanding_balance: float | None = None,
    ) -> MonthlyBudgetAllocation | None:
        if self.monthly_plan is None:
            return None
        return allocate_monthly_budget(
            self.monthly_plan,
            month=month,
            housing_due=housing_due,
            inflation_rate=self.inflation_rate,
            extra_income_events=self.extra_income_events,
            financed=financed,
            outstanding_balance=outstanding_balance,
        )

    @staticmethod
    def attach_budget(
        record: MonthlyRecord,
        allocation: MonthlyBudgetAllocation | None,
    ) -> MonthlyRecord:
        if allocation is None:
            return record
        record.effective_income = allocation.effective_net_income
        record.effective_net_income = allocation.effective_net_income
        record.effective_non_housing_expenses = (
            allocation.effective_non_housing_expenses
        )
        record.extra_income = allocation.extra_income
        record.income_surplus_available = allocation.disposable_surplus
        record.disposable_surplus = allocation.disposable_surplus
        record.wealth_allocation = allocation.wealth_allocation
        record.investment_allocation = allocation.investment_allocation
        record.extra_amortization_allocation = allocation.extra_amortization_allocation
        record.outside_plan_amount = allocation.outside_plan_amount
        record.budget_deficit = allocation.budget_deficit
        record.housing_paid = allocation.housing_paid
        record.housing_shortfall = allocation.housing_shortfall
        return record

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
