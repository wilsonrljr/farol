"""Investment calculation utilities.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

from dataclasses import dataclass

from ..models import InvestmentReturnInput, InvestmentTaxInput
from .rates import get_monthly_investment_rate

PERCENTAGE_BASE = 100


@dataclass
class InvestmentResult:
    """Result of investment return calculation."""

    new_balance: float
    gross_return: float
    tax_paid: float
    net_return: float


@dataclass
class InvestmentCalculator:
    """Calculator for investment returns with optional taxation.

    Uses composition to encapsulate investment calculation logic.
    """

    investment_returns: list[InvestmentReturnInput]
    investment_tax: InvestmentTaxInput | None = None

    def calculate_monthly_return(
        self,
        balance: float,
        month: int,
    ) -> InvestmentResult:
        """Calculate investment return for a given month.

        Args:
            balance: Current investment balance.
            month: The month number.

        Returns:
            InvestmentResult with new balance and return details.
        """
        monthly_rate = get_monthly_investment_rate(self.investment_returns, month)
        gross_return = balance * monthly_rate

        tax_paid = self._calculate_tax(gross_return)
        net_return = gross_return - tax_paid
        new_balance = balance + net_return

        return InvestmentResult(
            new_balance=new_balance,
            gross_return=gross_return,
            tax_paid=tax_paid,
            net_return=net_return,
        )

    def _calculate_tax(self, gross_return: float) -> float:
        """Calculate tax on investment return."""
        if not self.investment_tax or not self.investment_tax.enabled:
            return 0.0

        if gross_return <= 0:
            return 0.0

        return gross_return * (self.investment_tax.effective_tax_rate / PERCENTAGE_BASE)


def apply_investment_return_with_tax(
    investment_balance: float,
    *,
    investment_returns: list[InvestmentReturnInput],
    month: int,
    investment_tax: InvestmentTaxInput | None,
) -> tuple[float, float, float, float]:
    """Apply investment return with optional taxation.

    Legacy function for backward compatibility.

    Returns:
        Tuple of (new_balance, gross_return, tax_paid, net_return).
    """
    calculator = InvestmentCalculator(
        investment_returns=investment_returns,
        investment_tax=investment_tax,
    )
    result = calculator.calculate_monthly_return(investment_balance, month)

    return (
        result.new_balance,
        result.gross_return,
        result.tax_paid,
        result.net_return,
    )
