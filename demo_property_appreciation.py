#!/usr/bin/env python3
"""
Demonstration showing that property appreciation in invest_then_buy scenario
follows inflation, not investment returns.
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from backend.app.finance import simulate_invest_then_buy_scenario, apply_inflation
from backend.app.models import InvestmentReturnInput


def demonstrate_property_appreciation():
    """Demonstrate that property value follows inflation."""

    print("=" * 60)
    print("DEMONSTRATING PROPERTY APPRECIATION IN INVEST-THEN-BUY")
    print("=" * 60)
    print()

    # Test parameters
    property_value = 300000
    down_payment = 250000
    term_months = 60
    rent_value = 1500
    inflation_rate = 3.0  # 3% annual inflation

    # Very high investment returns (to show they DON'T affect property)
    investment_returns = [
        InvestmentReturnInput(
            start_month=1, end_month=None, annual_rate=15.0
        )  # 15% annual return
    ]

    result = simulate_invest_then_buy_scenario(
        property_value=property_value,
        down_payment=down_payment,
        term_months=term_months,
        investment_returns=investment_returns,
        rent_value=rent_value,
        inflation_rate=inflation_rate,
    )

    print("Scenario Parameters:")
    print(f"- Initial property value: R$ {property_value:,.2f}")
    print(f"- Down payment: R$ {down_payment:,.2f}")
    print(f"- Inflation rate: {inflation_rate}% annually")
    print("- Investment return rate: 15% annually")
    print()

    # Find purchase month
    purchase_month = None
    for data in result.monthly_data:
        if data.get("status") == "Imóvel comprado":
            purchase_month = data["month"]
            break

    if purchase_month:
        print(f"✅ Property purchased in month {purchase_month}")
        print()

        # Show property values at key points
        months_to_check = [purchase_month, purchase_month + 12, purchase_month + 24]

        print("Property Value Tracking:")
        print("-" * 40)

        for month in months_to_check:
            if month <= len(result.monthly_data):
                data = result.monthly_data[month - 1]

                # Calculate what property value SHOULD be with inflation
                expected_value = apply_inflation(
                    property_value, month, 1, inflation_rate
                )

                # Calculate what it would be if following investment returns (WRONG)
                monthly_investment_rate = (1 + 0.15) ** (1 / 12) - 1
                wrong_value = property_value * (
                    (1 + monthly_investment_rate) ** (month - 1)
                )

                print(f"Month {month}:")
                print(
                    f"  Actual property value:     R$ {data['property_value']:>12,.2f}"
                )
                print(f"  Expected (with inflation): R$ {expected_value:>12,.2f}")
                print(f"  If using 15% returns:     R$ {wrong_value:>12,.2f}")
                print(
                    f"  Investment balance:       R$ {data['investment_balance']:>12,.2f}"
                )
                print()

        print("Analysis:")
        final_data = result.monthly_data[-1]
        final_expected = apply_inflation(
            property_value, len(result.monthly_data), 1, inflation_rate
        )

        property_diff = abs(final_data["property_value"] - final_expected)

        if property_diff < 1.0:  # Less than R$ 1 difference
            print("✅ CORRECT: Property value is following inflation rate")
            print(
                f"   Final property value matches inflation calculation (diff: R$ {property_diff:.2f})"
            )
        else:
            print("❌ ERROR: Property value is NOT following inflation")

        print()
        print("Summary:")
        print(
            f"- Property value: R$ {final_data['property_value']:,.2f} (inflation-adjusted)"
        )
        print(
            f"- Investment balance: R$ {final_data['investment_balance']:,.2f} (investment returns)"
        )
        print(f"- Total equity: R$ {result.final_equity:,.2f}")
        print(f"- Total cost: R$ {result.total_cost:,.2f}")

    else:
        print("❌ Property was never purchased during simulation")

    print()
    print("=" * 60)


if __name__ == "__main__":
    demonstrate_property_appreciation()
