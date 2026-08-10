"""PRICE (French) loan simulator.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

import math
from dataclasses import dataclass, field

from .base import LoanSimulator


@dataclass
class PriceLoanSimulator(LoanSimulator):
    """PRICE (French) loan simulator with constant installments.

    In PRICE system, the installment is constant throughout the loan term,
    with amortization increasing and interest decreasing over time.
    """

    _fixed_installment: float = field(init=False)
    _term_preserving_schedule: bool = field(init=False, default=True)

    def __post_init__(self) -> None:
        """Initialize computed fields."""
        super().__post_init__()
        self._fixed_installment = self._calculate_pmt(
            principal=self.loan_value,
            months=self.term_months,
        )

    def _calculate_pmt(self, *, principal: float, months: int) -> float:
        """Calculate fixed installment using PMT formula."""
        if principal <= 0 or months <= 0:
            return 0.0
        rate = self.monthly_rate_decimal

        if rate > 0:
            # Algebraically equivalent to the usual PMT formula. ``log1p`` and
            # ``expm1`` preserve both tiny rates (where 1 + rate rounds to 1)
            # and long/high-rate contracts without subtracting large powers.
            denominator = -math.expm1(-months * math.log1p(rate))
            return principal * rate / denominator

        return principal / months

    def _recalculate_after_extra(self, month: int) -> None:
        remaining_months = max(0, self.term_months - month)
        self._fixed_installment = self._calculate_pmt(
            principal=self._outstanding_balance,
            months=remaining_months,
        )

    def _on_extra_amortization(self, month: int) -> None:
        del month
        if self.amortization_effect == "reduce_term":
            self._term_preserving_schedule = False

    def _calculate_regular_amortization(self, month: int) -> float:
        """Calculate regular amortization for a month.

        In PRICE system, amortization = fixed_installment - current_interest.

        Args:
            month: The month number (unused directly).

        Returns:
            The calculated amortization amount.
        """
        rate = self.monthly_rate_decimal
        current_interest = self._outstanding_balance * rate
        direct_amortization = self._fixed_installment - current_interest
        if rate <= 0:
            return direct_amortization

        # On an untouched or reduce-payment schedule, the principal component
        # has this closed form. It remains a lower bound after a reduce-term
        # extra payment.
        remaining_months = self.term_months - month + 1
        scheduled_amortization = self._fixed_installment * math.exp(
            -remaining_months * math.log1p(rate)
        )
        if self._term_preserving_schedule:
            return scheduled_amortization

        # After a reduce-term payment, ``PMT - interest`` captures the extra
        # principal paid by the unchanged installment. The closed form guards
        # only against cancellation when both floats round to the same value.
        return max(direct_amortization, scheduled_amortization)
