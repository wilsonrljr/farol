"""FGTS (Fundo de Garantia do Tempo de Serviço) management utilities.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Literal

from .protocols import FGTSLike

MONTHS_PER_YEAR = 12
PERCENTAGE_BASE = 100
FGTS_COOLDOWN_MONTHS = 24


class FGTSWithdrawalReason(str, Enum):
    """Reasons for FGTS withdrawals."""

    PURCHASE = "purchase"
    AMORTIZATION = "amortization"


@dataclass
class FGTSWithdrawalResult:
    """Outcome of a FGTS withdrawal attempt."""

    success: bool
    amount: float
    requested_amount: float | None = None
    reason: FGTSWithdrawalReason | None = None
    month: int | None = None
    error: Literal[
        "insufficient_balance",
        "cooldown_active",
        None,
    ] = None
    cooldown_ends_at: int | None = None
    balance_after: float = 0.0


@dataclass
class FGTSManager:
    """Manages FGTS balance calculations and withdrawals.

    Uses composition to encapsulate FGTS-related business logic.
    """

    initial_balance: float = 0.0
    monthly_contribution: float = 0.0
    annual_yield_rate: float = 0.0
    use_at_purchase: bool = True
    max_withdrawal_at_purchase: float | None = None

    _balance: float = field(init=False)
    _monthly_rate: float = field(init=False)
    _last_withdrawal_month: int | None = field(init=False, default=None)
    _withdrawal_history: list[FGTSWithdrawalResult] = field(
        init=False, default_factory=list
    )

    def __post_init__(self) -> None:
        """Initialize computed fields."""
        self._balance = self.initial_balance
        self._monthly_rate = self._compute_monthly_rate()
        self._withdrawal_history = []
        self._last_withdrawal_month = None

    @classmethod
    def from_input(cls, fgts_input: FGTSLike | None) -> "FGTSManager | None":
        """Create manager from API input model.

        Returns None if no FGTS input provided.
        """
        if fgts_input is None:
            return None

        return cls(
            initial_balance=fgts_input.initial_balance,
            monthly_contribution=fgts_input.monthly_contribution,
            annual_yield_rate=fgts_input.annual_yield_rate,
            use_at_purchase=fgts_input.use_at_purchase,
            max_withdrawal_at_purchase=fgts_input.max_withdrawal_at_purchase,
        )

    @property
    def balance(self) -> float:
        """Current FGTS balance."""
        return self._balance

    def _compute_monthly_rate(self) -> float:
        """Compute monthly yield rate from annual rate."""
        if self.annual_yield_rate <= 0:
            return 0.0
        return (1 + self.annual_yield_rate / PERCENTAGE_BASE) ** (
            1 / MONTHS_PER_YEAR
        ) - 1

    def accumulate_monthly(self) -> float:
        """Accumulate monthly contribution and yield.

        Returns:
            The new balance after accumulation.
        """
        self._balance = (self._balance + self.monthly_contribution) * (
            1 + self._monthly_rate
        )
        return self._balance

    def withdraw(
        self,
        *,
        month: int,
        amount: float,
        reason: FGTSWithdrawalReason,
    ) -> FGTSWithdrawalResult:
        """Unified withdrawal with cooldown and balance validation."""

        # Cooldown applies to amortization attempts after any withdrawal.
        if reason == FGTSWithdrawalReason.AMORTIZATION:
            cooldown_result = self._check_cooldown(month, amount)
            if cooldown_result is not None:
                self._withdrawal_history.append(cooldown_result)
                return cooldown_result

        if amount <= 0:
            result = FGTSWithdrawalResult(
                success=False,
                amount=0.0,
                requested_amount=amount,
                reason=reason,
                month=month,
                balance_after=self._balance,
            )
            self._withdrawal_history.append(result)
            return result

        available = max(0.0, self._balance)
        if available <= 0:
            result = FGTSWithdrawalResult(
                success=False,
                amount=0.0,
                requested_amount=amount,
                reason=reason,
                month=month,
                error="insufficient_balance",
                balance_after=self._balance,
            )
            self._withdrawal_history.append(result)
            return result

        allowed = min(amount, available)

        # Purchase-specific cap
        if reason == FGTSWithdrawalReason.PURCHASE and (
            self.max_withdrawal_at_purchase is not None
        ):
            allowed = min(allowed, self.max_withdrawal_at_purchase)

        self._balance -= allowed
        self._last_withdrawal_month = month

        result = FGTSWithdrawalResult(
            success=True,
            amount=allowed,
            requested_amount=amount,
            reason=reason,
            month=month,
            balance_after=self._balance,
        )
        self._withdrawal_history.append(result)
        return result

    def withdraw_for_purchase(
        self,
        max_needed: float,
    ) -> float:
        """Withdraw FGTS for property purchase.

        Args:
            max_needed: Maximum amount needed from FGTS.

        Returns:
            Amount actually withdrawn.
        """
        if not self.use_at_purchase:
            return 0.0

        result = self.withdraw(
            month=0,
            amount=max(0.0, max_needed),
            reason=FGTSWithdrawalReason.PURCHASE,
        )
        return result.amount

    def _check_cooldown(
        self, month: int, requested_amount: float
    ) -> FGTSWithdrawalResult | None:
        """Enforce 24-month cooldown between amortization withdrawals."""

        if self._last_withdrawal_month is None:
            return None

        months_since_last = month - self._last_withdrawal_month
        if months_since_last >= FGTS_COOLDOWN_MONTHS:
            return None

        cooldown_ends_at = self._last_withdrawal_month + FGTS_COOLDOWN_MONTHS
        return FGTSWithdrawalResult(
            success=False,
            amount=0.0,
            requested_amount=requested_amount,
            reason=FGTSWithdrawalReason.AMORTIZATION,
            month=month,
            error="cooldown_active",
            cooldown_ends_at=cooldown_ends_at,
            balance_after=self._balance,
        )

    def reset_balance(self, new_balance: float) -> None:
        """Reset balance to a specific value."""
        self._balance = new_balance

    @property
    def withdrawal_history(self) -> list[FGTSWithdrawalResult]:
        """Return a copy of withdrawal history."""

        return list(self._withdrawal_history)


def compute_fgts_monthly_rate(fgts: FGTSLike | None) -> float:
    """Compute monthly FGTS yield rate.

    Legacy function for backward compatibility.
    """
    if fgts and fgts.annual_yield_rate:
        return (1 + (fgts.annual_yield_rate or 0.0) / PERCENTAGE_BASE) ** (
            1 / MONTHS_PER_YEAR
        ) - 1
    return 0.0


def accumulate_fgts_balance(
    fgts_balance: float,
    *,
    fgts: FGTSLike | None,
    fgts_monthly_rate: float,
) -> float:
    """Accumulate FGTS balance for one month.

    Legacy function for backward compatibility.
    """
    if not fgts:
        return fgts_balance
    return (fgts_balance + (fgts.monthly_contribution or 0.0)) * (1 + fgts_monthly_rate)
