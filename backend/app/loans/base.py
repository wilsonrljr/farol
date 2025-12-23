"""Base loan simulator with common functionality.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

from abc import ABC, abstractmethod
from collections.abc import Sequence
from dataclasses import dataclass, field

from ..core.amortization import preprocess_amortizations
from ..core.fgts import FGTSManager, FGTSWithdrawalReason, FGTSWithdrawalResult
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
    amortizations: Sequence[AmortizationLike] | None = None
    annual_inflation_rate: float | None = None
    fgts_amortizations: Sequence[AmortizationLike] | None = None
    fgts_manager: FGTSManager | None = None

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
    _fgts_fixed_by_month: dict[int, float] = field(init=False, default_factory=dict)
    _fgts_percent_by_month: dict[int, list[float]] = field(
        init=False, default_factory=dict
    )
    _fgts_withdrawals: list[FGTSWithdrawalResult] = field(
        init=False, default_factory=list
    )
    _fgts_blocked: list[FGTSWithdrawalResult] = field(init=False, default_factory=list)
    _fgts_balance_timeline: list[tuple[int, float]] = field(
        init=False, default_factory=list
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
        self._preprocess_fgts_amortizations()

    def _preprocess_amortizations(self) -> None:
        """Preprocess amortization schedule (cash)."""
        fixed, percent = preprocess_amortizations(
            self.amortizations,
            self.term_months,
            self.annual_inflation_rate,
        )
        self._fixed_extra_by_month = fixed
        self._percent_extra_by_month = percent

    def _preprocess_fgts_amortizations(self) -> None:
        """Preprocess FGTS-backed amortizations separately."""

        fixed, percent = preprocess_amortizations(
            self.fgts_amortizations,
            self.term_months,
            self.annual_inflation_rate,
        )
        self._fgts_fixed_by_month = fixed
        self._fgts_percent_by_month = percent

    @property
    def monthly_rate_decimal(self) -> float:
        """Monthly interest rate as decimal."""
        return self.monthly_interest_rate / PERCENTAGE_BASE

    def simulate(self) -> LoanSimulationResult:
        """Run the loan simulation.

        Template method that defines the simulation algorithm.
        """
        for month in range(1, self.term_months + 1):
            if self.fgts_manager:
                # Accrue FGTS before using it for amortization in the same month.
                self.fgts_manager.accumulate_monthly()
            installment = self._calculate_month(month)
            self._installments.append(installment)

            if self.fgts_manager:
                # Capture end-of-month FGTS balance (post-withdrawal for this month).
                self._fgts_balance_timeline.append((month, self.fgts_manager.balance))

            if self._outstanding_balance <= 0:
                break

        return self._build_result()

    def _calculate_month(self, month: int) -> LoanInstallment:
        """Calculate a single month's installment (cash + optional FGTS)."""

        starting_balance = self._outstanding_balance
        interest = starting_balance * self.monthly_rate_decimal

        regular_amortization = self._calculate_regular_amortization(month)
        if regular_amortization < 0:
            regular_amortization = 0.0
        regular_amortization = min(regular_amortization, starting_balance)

        # Remaining balance after regular amortization
        remaining_for_extra = max(0.0, starting_balance - regular_amortization)

        # Cash-backed extra amortization
        cash_extra = self._calculate_cash_extra(month, starting_balance)
        cash_extra = min(max(0.0, cash_extra), remaining_for_extra)
        remaining_after_cash = max(0.0, remaining_for_extra - cash_extra)

        # FGTS-backed extra amortization (subject to cooldown/saldo)
        fgts_extra = 0.0
        if self.fgts_manager:
            requested_fgts = self._calculate_fgts_extra(month, starting_balance)
            if requested_fgts > 0 and remaining_after_cash > 0:
                allowed_request = min(requested_fgts, remaining_after_cash)
                result = self.fgts_manager.withdraw(
                    month=month,
                    amount=allowed_request,
                    reason=FGTSWithdrawalReason.AMORTIZATION,
                )
                self._fgts_withdrawals.append(result)
                if result.success:
                    fgts_extra = min(result.amount, remaining_after_cash)
                else:
                    self._fgts_blocked.append(result)

        total_extra_amortization = cash_extra + fgts_extra
        total_amortization = regular_amortization + total_extra_amortization

        installment_value = interest + total_amortization
        self._outstanding_balance -= total_amortization

        if total_extra_amortization > 0:
            self._total_extra_amortization += total_extra_amortization
        self._total_paid += installment_value
        self._total_interest_paid += interest

        return LoanInstallment(
            month=month,
            installment=installment_value,
            amortization=total_amortization,
            interest=interest,
            outstanding_balance=self._outstanding_balance,
            extra_amortization=total_extra_amortization,
        )

    def _calculate_cash_extra(self, month: int, starting_balance: float) -> float:
        """Calculate extra amortization funded by cash for a month."""

        extra = self._fixed_extra_by_month.get(month, 0.0)

        if month in self._percent_extra_by_month and starting_balance > 0:
            for pct in self._percent_extra_by_month[month]:
                extra += starting_balance * (pct / PERCENTAGE_BASE)

        return extra

    def _calculate_fgts_extra(self, month: int, starting_balance: float) -> float:
        """Calculate requested FGTS extra amortization for a month."""

        if not self._fgts_fixed_by_month and not self._fgts_percent_by_month:
            return 0.0

        extra = self._fgts_fixed_by_month.get(month, 0.0)

        if month in self._fgts_percent_by_month and starting_balance > 0:
            for pct in self._fgts_percent_by_month[month]:
                extra += starting_balance * (pct / PERCENTAGE_BASE)

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
