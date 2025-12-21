"""SAC (Sistema de Amortização Constante) loan simulator.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

from dataclasses import dataclass, field

from .base import LoanSimulator


@dataclass
class SACLoanSimulator(LoanSimulator):
    """SAC loan simulator with constant amortization.

    In SAC system, the amortization is constant throughout the loan term,
    while interest decreases as the outstanding balance reduces.
    """

    _fixed_amortization: float = field(init=False)

    def __post_init__(self) -> None:
        """Initialize computed fields."""
        super().__post_init__()
        self._fixed_amortization = self.loan_value / self.term_months

    def _calculate_regular_amortization(self, month: int) -> float:  # noqa: ARG002
        """Calculate regular amortization (constant in SAC).

        Args:
            month: The month number (unused in SAC).

        Returns:
            The fixed amortization amount.
        """
        return self._fixed_amortization
