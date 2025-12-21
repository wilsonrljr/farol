"""Regression test: FGTS cannot be used to pay transaction costs (ITBI/escritura).

The invest-then-buy scenario should only allow a purchase when the upfront costs
are covered by liquid cash (investment liquidation), even if FGTS balance is large.
"""

from backend.app.finance import simulate_invest_then_buy_scenario
from backend.app.models import AdditionalCostsInput, FGTSInput, InvestmentReturnInput


def test_invest_then_buy_requires_cash_for_upfront_costs_even_with_fgts():
    # Property price is 100k; upfront costs are 50% => 50k upfront.
    # Investment cash is only 20k, so purchase must NOT happen even if FGTS is huge.
    result = simulate_invest_then_buy_scenario(
        property_value=100_000,
        down_payment=20_000,
        term_months=6,
        rent_value=0.0,
        investment_returns=[InvestmentReturnInput(start_month=1, annual_rate=0.0)],
        additional_costs=AdditionalCostsInput(
            itbi_percentage=30.0,
            deed_percentage=20.0,
            monthly_hoa=0.0,
            monthly_property_tax=0.0,
        ),
        inflation_rate=0.0,
        fgts=FGTSInput(
            initial_balance=200_000.0,
            monthly_contribution=0.0,
            annual_yield_rate=0.0,
            use_at_purchase=True,
            max_withdrawal_at_purchase=None,
        ),
    )

    assert all(m.status != "Imóvel comprado" for m in result.monthly_data)
    assert result.monthly_data[0].purchase_month is None
