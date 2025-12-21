"""Regression test: principal tracking on withdrawals under losses.

If balance < principal (unrealized loss), withdrawing cash should not reduce the
principal by more than the withdrawn amount; otherwise, the cost basis becomes
artificially low and can create fake gains/taxes later.
"""

from backend.app.core.investment import InvestmentAccount
from backend.app.models import InvestmentReturnInput, InvestmentTaxInput


def test_withdrawal_under_loss_does_not_reduce_principal_more_than_gross():
    account = InvestmentAccount(
        investment_returns=[InvestmentReturnInput(start_month=1, annual_rate=0.0)],
        investment_tax=InvestmentTaxInput(
            enabled=True,
            mode="on_withdrawal",
            effective_tax_rate=15.0,
        ),
        balance=80.0,
        principal=100.0,  # unrealized loss of -20
    )

    w = account.withdraw_net(10.0)

    assert w.net_cash == 10.0
    assert w.tax_paid == 0.0
    assert w.realized_gain == 0.0

    assert account.balance == 70.0
    # Principal should drop by at most the gross withdrawn (10.0)
    assert account.principal == 90.0
    assert account.unrealized_gain == -20.0
