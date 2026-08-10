"""Regression test: principal tracking on withdrawals under losses.

If balance < principal (unrealized loss), a withdrawal redeems the same fraction
of balance and cost basis. The corresponding fraction of the loss is realized.
"""

from backend.app.core.investment import InvestmentAccount
from backend.app.models import InvestmentReturnInput, InvestmentTaxInput


def test_withdrawal_under_loss_reduces_cost_basis_proportionally():
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
    assert w.realized_gain == -2.5

    assert account.balance == 70.0
    # 10 / 80 = 12.5% of the account, therefore 12.5% of the R$ 100 basis.
    assert account.principal == 87.5
    assert account.unrealized_gain == -17.5


def test_full_withdrawal_under_loss_clears_remaining_cost_basis():
    account = InvestmentAccount(
        investment_returns=[InvestmentReturnInput(start_month=1, annual_rate=0.0)],
        investment_tax=InvestmentTaxInput(
            enabled=True,
            mode="on_withdrawal",
            effective_tax_rate=15.0,
        ),
        balance=80.0,
        principal=100.0,
    )

    withdrawal = account.withdraw_net(80.0)

    assert withdrawal.net_cash == 80.0
    assert withdrawal.realized_gain == -20.0
    assert withdrawal.tax_paid == 0.0
    assert account.balance == 0.0
    assert account.principal == 0.0


def test_positive_realized_gain_is_reported_when_tax_is_disabled():
    account = InvestmentAccount(
        investment_returns=[InvestmentReturnInput(start_month=1, annual_rate=0.0)],
        balance=120.0,
        principal=100.0,
    )

    withdrawal = account.withdraw_net(60.0)

    assert withdrawal.net_cash == 60.0
    assert withdrawal.tax_paid == 0.0
    assert withdrawal.realized_gain == 10.0
    assert account.balance == 60.0
    assert account.principal == 50.0
