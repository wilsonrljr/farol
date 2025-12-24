"""Regression test: rent-and-invest should track property appreciation.

This value is used for comparisons/UI (e.g., showing how the target property price evolves).
"""

from backend.app.scenarios.rent_and_invest import RentAndInvestScenarioSimulator
from backend.app.models import InvestmentReturnInput


def test_rent_and_invest_property_value_appreciates_when_configured():
    result = RentAndInvestScenarioSimulator(
        property_value=300_000,
        down_payment=60_000,
        term_months=24,
        rent_value=1_500,
        investment_returns=[InvestmentReturnInput(start_month=1, annual_rate=0.0)],
        inflation_rate=0.0,
        property_appreciation_rate=6.0,
    ).simulate()

    first = result.monthly_data[0].property_value
    last = result.monthly_data[-1].property_value

    assert first is not None and last is not None
    assert last > first
