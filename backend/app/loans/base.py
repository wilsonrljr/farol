"""Base loan simulator with common functionality.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from ..core.amortization import preprocess_amortizations
from ..core.protocols import AmortizationLike
from ..models import LoanInstallment, LoanSimulationResult

PERCENTAGE_BASE = 100


@dataclass
class LoanSimulator(ABC):
    """Abstract base class for loan simulators.

    Uses Template Method pattern for loan simulation with
    Strategy pattern for amortization calculation.
    """

    loan_value: float
    term_months: int
    monthly_interest_rate: float
    amortizations: list[AmortizationLike] | None = None
    annual_inflation_rate: float | None = None

    # Internal state
    _installments: list[LoanInstallment] = field(init=False, default_factory=list)
    _outstanding_balance: float = field(init=False)
    _total_paid: float = field(init=False, default=0.0)
    _total_interest_paid: float = field(init=False, default=0.0)
    _total_extra_amortization: float = field(init=False, default=0.0)
    _fixed_extra_by_month: dict[int, float] = field(init=False, default_factory=dict)
    _percent_extra_by_month: dict[int, list[float]] = field(
        init=False, default_factory=dict
    )

    def __post_init__(self) -> None:
        """Initialize computed fields."""
        if self.term_months <= 0:
            raise ValueError("term_months must be > 0")
        if self.loan_value < 0:
            raise ValueError("loan_value must be >= 0")
        if self.monthly_interest_rate < 0:
            raise ValueError("monthly_interest_rate must be >= 0")
        self._outstanding_balance = self.loan_value
        self._preprocess_amortizations()

    def _preprocess_amortizations(self) -> None:
        """Preprocess amortization schedule."""
        fixed, percent = preprocess_amortizations(
            self.amortizations,
            self.term_months,
            self.annual_inflation_rate,
        )
        self._fixed_extra_by_month = fixed
        self._percent_extra_by_month = percent

    @property
    def monthly_rate_decimal(self) -> float:
        """Monthly interest rate as decimal."""
        return self.monthly_interest_rate / PERCENTAGE_BASE

    def simulate(self) -> LoanSimulationResult:
        """Run the loan simulation.

        Template method that defines the simulation algorithm.
        """
        for month in range(1, self.term_months + 1):
            installment = self._calculate_month(month)
            self._installments.append(installment)

            if self._outstanding_balance <= 0:
                break

        return self._build_result()

    def _calculate_month(self, month: int) -> LoanInstallment:
        """Calculate a single month's installment."""
        extra_amortization = self._calculate_extra_amortization(month)
        interest = self._outstanding_balance * self.monthly_rate_decimal

        regular_amortization = self._calculate_regular_amortization(month)
        total_amortization = regular_amortization + extra_amortization

        # Ensure we don't amortize more than outstanding balance
        if total_amortization > self._outstanding_balance:
            total_amortization = self._outstanding_balance
            extra_amortization = total_amortization - regular_amortization

        installment_value = interest + total_amortization
        self._outstanding_balance -= total_amortization

        # Update totals
        if extra_amortization > 0:
            self._total_extra_amortization += extra_amortization
        self._total_paid += installment_value
        self._total_interest_paid += interest

        return LoanInstallment(
            month=month,
            installment=installment_value,
            amortization=total_amortization,
            interest=interest,
            outstanding_balance=self._outstanding_balance,
            extra_amortization=extra_amortization,
        )

    def _calculate_extra_amortization(self, month: int) -> float:
        """Calculate extra amortization for a month."""
        extra = self._fixed_extra_by_month.get(month, 0.0)

        if month in self._percent_extra_by_month and self._outstanding_balance > 0:
            for pct in self._percent_extra_by_month[month]:
                extra += self._outstanding_balance * (pct / PERCENTAGE_BASE)

        return extra

    @abstractmethod
    def _calculate_regular_amortization(self, month: int) -> float:
        """Calculate regular amortization for a month.

        This is the Strategy method that subclasses must implement.
        """

    def _build_result(self) -> LoanSimulationResult:
        """Build the final simulation result."""
        actual_term = (
            self._installments[-1].month if self._installments else self.term_months
        )
        months_saved = (
            self.term_months - actual_term if actual_term < self.term_months else 0
        )

        return LoanSimulationResult(
            loan_value=self.loan_value,
            total_paid=self._total_paid,
            total_interest_paid=self._total_interest_paid,
            installments=self._installments,
            original_term_months=self.term_months,
            actual_term_months=actual_term,
            months_saved=months_saved if months_saved > 0 else None,
            total_extra_amortization=(
                self._total_extra_amortization
                if self._total_extra_amortization > 0
                else None
            ),
        )
