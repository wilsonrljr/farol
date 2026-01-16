"""Tests for rent shortfall semantics with income-based model.

The simulator exposes:
- rent_due: what should be paid for rent in the month
- rent_paid: what was paid from income
- rent_shortfall: uncovered portion when income < rent

And, importantly, total_monthly_cost should always include rent_due so scenarios
aren't artificially improved when rent can't be fully covered.
"""

from backend.app.scenarios.invest_then_buy import InvestThenBuyScenarioSimulator
from backend.app.scenarios.rent_and_invest import RentAndInvestScenarioSimulator
from backend.app.models import InvestmentReturnInput


def test_rent_and_invest_shortfall_with_no_income():
    """When no income is provided, rent is assumed paid externally."""
    result = RentAndInvestScenarioSimulator(
        property_value=300_000,
        down_payment=0.0,
        term_months=1,
        rent_value=1_000.0,
        investment_returns=[InvestmentReturnInput(start_month=1, annual_rate=0.0)],
        monthly_net_income=None,  # No income, legacy mode
    ).simulate()

    m1 = result.monthly_data[0]
    assert m1.rent_due == 1_000.0
    # In legacy mode, rent is assumed paid externally
    assert m1.total_monthly_cost >= m1.rent_due


def test_rent_and_invest_with_income_covering_rent():
    """When income covers rent, there should be no shortfall."""
    result = RentAndInvestScenarioSimulator(
        property_value=300_000,
        down_payment=0.0,
        term_months=1,
        rent_value=1_000.0,
        investment_returns=[InvestmentReturnInput(start_month=1, annual_rate=0.0)],
        monthly_net_income=5000.0,  # Income covers rent
    ).simulate()

    m1 = result.monthly_data[0]
    assert m1.rent_due == 1_000.0
    # With sufficient income, rent shortfall should be 0
    assert m1.housing_shortfall == 0.0


def test_rent_and_invest_shortfall_with_insufficient_income():
    """When income is less than rent, there should be shortfall."""
    result = RentAndInvestScenarioSimulator(
        property_value=300_000,
        down_payment=0.0,
        term_months=1,
        rent_value=1_000.0,
        investment_returns=[InvestmentReturnInput(start_month=1, annual_rate=0.0)],
        monthly_net_income=500.0,  # Income less than rent
    ).simulate()

    m1 = result.monthly_data[0]
    assert m1.rent_due == 1_000.0
    # Shortfall should be rent - income = 500
    assert m1.housing_shortfall == 500.0


def test_invest_then_buy_with_income():
    """Test invest-then-buy with income-based model."""
    result = InvestThenBuyScenarioSimulator(
        property_value=300_000,
        down_payment=0.0,
        term_months=1,
        rent_value=1_000.0,
        investment_returns=[InvestmentReturnInput(start_month=1, annual_rate=0.0)],
        monthly_net_income=5000.0,
    ).simulate()

    m1 = result.monthly_data[0]
    assert m1.rent_due == 1_000.0
