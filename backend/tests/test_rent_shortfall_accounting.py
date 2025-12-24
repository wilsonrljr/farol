"""Tests for rent shortfall semantics.

The simulator exposes:
- rent_due: what should be paid for rent in the month
- rent_paid: what was paid from modeled sources
- rent_shortfall: uncovered portion (requires unmodeled cash/credit)

And, importantly, total_monthly_cost should always include rent_due so scenarios
aren't artificially improved when rent can't be fully covered.
"""

from backend.app.scenarios.invest_then_buy import InvestThenBuyScenarioSimulator
from backend.app.scenarios.rent_and_invest import RentAndInvestScenarioSimulator
from backend.app.models import InvestmentReturnInput


def test_rent_and_invest_shortfall_is_exposed_and_cost_counts_rent_due():
    result = RentAndInvestScenarioSimulator(
        property_value=300_000,
        down_payment=0.0,
        term_months=1,
        rent_value=1_000.0,
        investment_returns=[InvestmentReturnInput(start_month=1, annual_rate=0.0)],
        rent_reduces_investment=True,
        monthly_external_savings=0.0,
    ).simulate()

    m1 = result.monthly_data[0]
    assert m1.rent_due == 1_000.0
    assert m1.rent_paid == 0.0
    assert m1.rent_shortfall == 1_000.0

    assert m1.total_monthly_cost == 1_000.0
    assert m1.cash_flow == -1_000.0

    total_outflows = sum((m.total_monthly_cost or 0.0) for m in result.monthly_data)
    assert total_outflows == 1_000.0


def test_invest_then_buy_shortfall_is_exposed_and_cost_counts_rent_due_pre_purchase():
    result = InvestThenBuyScenarioSimulator(
        property_value=300_000,
        down_payment=0.0,
        term_months=1,
        rent_value=1_000.0,
        investment_returns=[InvestmentReturnInput(start_month=1, annual_rate=0.0)],
        rent_reduces_investment=True,
        monthly_external_savings=0.0,
        invest_loan_difference=False,
    ).simulate()

    m1 = result.monthly_data[0]
    assert m1.rent_due == 1_000.0
    assert m1.rent_paid == 0.0
    assert m1.rent_shortfall == 1_000.0

    assert m1.total_monthly_cost == 1_000.0
    assert m1.cash_flow == -1_000.0

    total_outflows = sum((m.total_monthly_cost or 0.0) for m in result.monthly_data)
    assert total_outflows == 1_000.0
