"""Investment calculation utilities.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

from collections.abc import Sequence
from dataclasses import dataclass

from .protocols import InvestmentReturnLike, InvestmentTaxLike
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
class InvestmentWithdrawalResult:
    """Result for a withdrawal operation."""

    gross_withdrawal: float
    net_cash: float
    realized_gain: float
    tax_paid: float


@dataclass
class InvestmentAccount:
    """Investment account with principal tracking and optional taxation.

    This supports a more realistic tax approximation by taxing realized gains when
    withdrawing (selling) rather than taxing every month's return.
    """

    investment_returns: Sequence[InvestmentReturnLike]
    investment_tax: InvestmentTaxLike | None = None
    balance: float = 0.0
    principal: float = 0.0

    def deposit(self, amount: float) -> None:
        if amount <= 0:
            return
        self.balance += amount
        self.principal += amount

    @property
    def unrealized_gain(self) -> float:
        return self.balance - self.principal

    def liquidation_net_value(self) -> float:
        """Estimate net cash obtainable if liquidating the whole account now."""
        if self.balance <= 0:
            return 0.0
        if not self.investment_tax or not self.investment_tax.enabled:
            return self.balance
        mode = getattr(self.investment_tax, "mode", "on_withdrawal")
        if mode != "on_withdrawal":
            return self.balance

        gain = self.unrealized_gain
        if gain <= 0:
            return self.balance

        tax_rate = self.investment_tax.effective_tax_rate / PERCENTAGE_BASE
        return self.balance - (gain * tax_rate)

    def apply_monthly_return(self, month: int) -> InvestmentResult:
        """Apply monthly return; taxes monthly returns only in mode='monthly'."""
        monthly_rate = get_monthly_investment_rate(self.investment_returns, month)
        gross_return = self.balance * monthly_rate

        tax_paid = 0.0
        net_return = gross_return

        if self.investment_tax and self.investment_tax.enabled:
            mode = getattr(self.investment_tax, "mode", "on_withdrawal")
            if mode == "monthly" and gross_return > 0:
                tax_paid = gross_return * (
                    self.investment_tax.effective_tax_rate / PERCENTAGE_BASE
                )
                net_return = gross_return - tax_paid

        self.balance += net_return
        return InvestmentResult(
            new_balance=self.balance,
            gross_return=gross_return,
            tax_paid=tax_paid,
            net_return=net_return,
        )

    def withdraw_net(self, net_cash_needed: float) -> InvestmentWithdrawalResult:
        """Withdraw enough to provide net_cash_needed, considering taxes.

        If taxation is enabled and mode='on_withdrawal', tax is applied on the
        realized gain portion of the withdrawal (proportional cost basis).
        Tax is assumed to be paid immediately from the withdrawal proceeds.
        """
        if net_cash_needed <= 0 or self.balance <= 0:
            return InvestmentWithdrawalResult(
                gross_withdrawal=0.0,
                net_cash=0.0,
                realized_gain=0.0,
                tax_paid=0.0,
            )

        mode = (
            getattr(self.investment_tax, "mode", "on_withdrawal")
            if (self.investment_tax and self.investment_tax.enabled)
            else "none"
        )
        tax_rate = (
            (self.investment_tax.effective_tax_rate / PERCENTAGE_BASE)
            if (self.investment_tax and self.investment_tax.enabled)
            else 0.0
        )

        gain = self.unrealized_gain
        if mode != "on_withdrawal" or tax_rate <= 0 or gain <= 0:
            gross = min(net_cash_needed, self.balance)
            # Proportional principal reduction (no tax).
            principal_fraction = (
                (self.principal / self.balance) if self.balance > 0 else 0.0
            )
            # When the account has losses (principal > balance), principal_fraction > 1.
            # Reducing principal by more than the withdrawn cash would distort cost basis
            # and could later create artificial gains/taxes.
            principal_reduction = gross * min(1.0, principal_fraction)
            self.balance -= gross
            self.principal = max(0.0, self.principal - principal_reduction)
            return InvestmentWithdrawalResult(
                gross_withdrawal=gross,
                net_cash=gross,
                realized_gain=0.0,
                tax_paid=0.0,
            )

        # Proportional gain fraction in the current balance.
        gain_fraction = (gain / self.balance) if self.balance > 0 else 0.0
        effective_factor = 1.0 - (gain_fraction * tax_rate)

        if effective_factor <= 0:
            # Pathological: tax consumes all proceeds; just withdraw what's possible.
            gross = self.balance
        else:
            gross = net_cash_needed / effective_factor
            gross = min(gross, self.balance)

        realized_gain = gross * gain_fraction
        tax_paid = realized_gain * tax_rate
        net_cash = gross - tax_paid

        # Reduce balance by the gross withdrawal.
        self.balance -= gross

        # Reduce principal by the non-gain portion withdrawn.
        principal_reduction = gross - realized_gain
        self.principal = max(0.0, self.principal - principal_reduction)

        return InvestmentWithdrawalResult(
            gross_withdrawal=gross,
            net_cash=net_cash,
            realized_gain=realized_gain,
            tax_paid=tax_paid,
        )
