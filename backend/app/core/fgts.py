"""FGTS (Fundo de Garantia do Tempo de Serviço) management utilities.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

from dataclasses import dataclass, field

from ..models import FGTSInput

MONTHS_PER_YEAR = 12
PERCENTAGE_BASE = 100


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

    def __post_init__(self) -> None:
        """Initialize computed fields."""
        self._balance = self.initial_balance
        self._monthly_rate = self._compute_monthly_rate()

    @classmethod
    def from_input(cls, fgts_input: FGTSInput | None) -> "FGTSManager | None":
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
        if not self.use_at_purchase or self._balance <= 0:
            return 0.0

        allowed = min(self._balance, max(0.0, max_needed))
        if self.max_withdrawal_at_purchase is not None:
            allowed = min(allowed, self.max_withdrawal_at_purchase)

        self._balance -= allowed
        return allowed

    def reset_balance(self, new_balance: float) -> None:
        """Reset balance to a specific value."""
        self._balance = new_balance


def compute_fgts_monthly_rate(fgts: FGTSInput | None) -> float:
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
    fgts: FGTSInput | None,
    fgts_monthly_rate: float,
) -> float:
    """Accumulate FGTS balance for one month.

    Legacy function for backward compatibility.
    """
    if not fgts:
        return fgts_balance
    return (fgts_balance + (fgts.monthly_contribution or 0.0)) * (1 + fgts_monthly_rate)
