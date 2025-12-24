"""Unit test focusing on invest-then-buy scenario property appreciation logic.
Derived from prior verbose script `test_property_appreciation.py`.
"""

from backend.app.scenarios.invest_then_buy import InvestThenBuyScenarioSimulator
from backend.app.models import InvestmentReturnInput


def test_invest_then_buy_property_follows_inflation():
    property_value = 300_000
    down_payment = 250_000  # ensures early purchase
    term_months = 60
    rent_value = 1_500
    inflation_rate = 4.0
    investment_returns = [InvestmentReturnInput(start_month=1, annual_rate=12.0)]

    result = InvestThenBuyScenarioSimulator(
        property_value=property_value,
        down_payment=down_payment,
        term_months=term_months,
        investment_returns=investment_returns,
        rent_value=rent_value,
        inflation_rate=inflation_rate,
    ).simulate()

    purchase_month = None
    for m in result.monthly_data:
        if m.status == "Imóvel comprado":
            purchase_month = m.month
            break
    assert purchase_month is not None

    # Property value at purchase should match inflation-based progression (tolerance applied)
    months_passed = purchase_month - 1
    monthly_infl = (1 + inflation_rate / 100) ** (1 / 12) - 1
    expected_purchase_value = property_value * (1 + monthly_infl) ** months_passed
    actual_purchase_value = result.monthly_data[purchase_month - 1].property_value
    assert actual_purchase_value is not None
    # Allow minor floating differences
    assert (
        abs(actual_purchase_value - expected_purchase_value) / expected_purchase_value
        < 0.005
    )
