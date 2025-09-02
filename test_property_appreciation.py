#!/usr/bin/env python3
"""
Test script to verify that property appreciation in invest_then_buy scenario
is based on inflation and not investment returns.
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from backend.app.finance import simulate_invest_then_buy_scenario
from backend.app.models import InvestmentReturnInput


def test_property_appreciation():
    """Test that property value increases with inflation, not investment returns."""

    # Test parameters
    property_value = 300000  # Reduced property value
    down_payment = 250000  # Very high down payment to ensure purchase
    term_months = 60  # 5 years
    rent_value = 1500
    inflation_rate = 4.0  # 4% annual inflation

    # High investment returns (different from inflation)
    investment_returns = [
        InvestmentReturnInput(
            start_month=1, end_month=None, annual_rate=12.0
        )  # 12% annual return
    ]

    result = simulate_invest_then_buy_scenario(
        property_value=property_value,
        down_payment=down_payment,
        term_months=term_months,
        investment_returns=investment_returns,
        rent_value=rent_value,
        inflation_rate=inflation_rate,
    )

    print(f"Initial property value: R$ {property_value:,.2f}")
    print(f"Inflation rate: {inflation_rate}% annually")
    print("Investment return rate: 12% annually")
    print()

    # Find when property was purchased
    purchase_month = None
    for data in result.monthly_data:
        if data.get("status") == "Imóvel comprado":
            purchase_month = data["month"]
            break

    if purchase_month:
        print(f"Property purchased in month: {purchase_month}")
        print()

        # Check property values in months after purchase
        purchase_data = result.monthly_data[purchase_month - 1]  # -1 for 0-based index
        print(
            f"Property value at purchase (month {purchase_month}): R$ {purchase_data['property_value']:,.2f}"
        )

        # Calculate expected property value with inflation
        months_passed = purchase_month - 1
        monthly_inflation_rate = (1 + inflation_rate / 100) ** (1 / 12) - 1
        expected_value_at_purchase = property_value * (
            (1 + monthly_inflation_rate) ** months_passed
        )
        print(f"Expected value with inflation: R$ {expected_value_at_purchase:,.2f}")
        print(
            f"Difference: R$ {abs(purchase_data['property_value'] - expected_value_at_purchase):,.2f}"
        )
        print()

        # Check a few months after purchase
        if purchase_month + 12 < len(result.monthly_data):
            month_after = purchase_month + 12
            data_after = result.monthly_data[month_after - 1]

            print(
                f"Property value 12 months after purchase (month {month_after}): R$ {data_after['property_value']:,.2f}"
            )

            # Calculate expected value
            months_from_start = month_after - 1
            expected_value_after = property_value * (
                (1 + monthly_inflation_rate) ** months_from_start
            )
            print(f"Expected value with inflation: R$ {expected_value_after:,.2f}")
            print(
                f"Difference: R$ {abs(data_after['property_value'] - expected_value_after):,.2f}"
            )

            # Calculate what it would be with investment returns (wrong calculation)
            monthly_investment_rate = (1 + 0.12) ** (1 / 12) - 1
            wrong_value = property_value * (
                (1 + monthly_investment_rate) ** months_from_start
            )
            print(
                f"What it would be with 12% investment returns (WRONG): R$ {wrong_value:,.2f}"
            )
            print()

            # Verify the property value is following inflation, not investment returns
            inflation_diff = abs(data_after["property_value"] - expected_value_after)
            investment_diff = abs(data_after["property_value"] - wrong_value)

            if inflation_diff < investment_diff:
                print("✅ CORRECT: Property value is following inflation rate")
            else:
                print(
                    "❌ ERROR: Property value appears to be following investment returns"
                )

        print(f"\nFinal equity: R$ {result.final_equity:,.2f}")
        print(f"Total cost: R$ {result.total_cost:,.2f}")
    else:
        print("Property was never purchased during the simulation period")


if __name__ == "__main__":
    test_property_appreciation()
