"""PRICE (French) loan simulator.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

from dataclasses import dataclass, field

from .base import LoanSimulator


@dataclass
class PriceLoanSimulator(LoanSimulator):
    """PRICE (French) loan simulator with constant installments.

    In PRICE system, the installment is constant throughout the loan term,
    with amortization increasing and interest decreasing over time.
    """

    _fixed_installment: float = field(init=False)

    def __post_init__(self) -> None:
        """Initialize computed fields."""
        super().__post_init__()
        self._fixed_installment = self._calculate_pmt()

    def _calculate_pmt(self) -> float:
        """Calculate fixed installment using PMT formula."""
        rate = self.monthly_rate_decimal

        if rate > 0:
            return (
                self.loan_value
                * (rate * (1 + rate) ** self.term_months)
                / ((1 + rate) ** self.term_months - 1)
            )

        return self.loan_value / self.term_months

    def _calculate_regular_amortization(self, month: int) -> float:  # noqa: ARG002
        """Calculate regular amortization for a month.

        In PRICE system, amortization = fixed_installment - current_interest.

        Args:
            month: The month number (unused directly).

        Returns:
            The calculated amortization amount.
        """
        current_interest = self._outstanding_balance * self.monthly_rate_decimal
        return self._fixed_installment - current_interest
