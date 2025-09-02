#!/usr/bin/env python3
"""
Test script to verify that property appreciation is applied correctly per scenario
"""
import requests
import json

# Test data with inflation parameters
test_data = {
    "property_value": 500000,
    "down_payment": 100000,
    "loan_term_years": 10,  # Shorter term for easier testing
    "annual_interest_rate": 10,
    "loan_type": "PRICE",
    "rent_value": 2000,
    "investment_returns": [{"start_month": 1, "end_month": None, "annual_rate": 8}],
    "amortizations": [],
    "inflation_rate": 4.0,  # 4% inflation
    "property_appreciation_rate": 6.0,  # 6% property appreciation
    "invest_loan_difference": False,
    "fixed_monthly_investment": None,
    "fixed_investment_start_month": 1,
}


def test_scenario_specific_appreciation():
    """Test that property appreciation is applied correctly per scenario"""
    url = "http://localhost:8000/api/compare-scenarios-enhanced"

    try:
        response = requests.post(url, json=test_data)

        if response.status_code == 200:
            result = response.json()
            print("✅ API call successful!")
            print(
                f"Test parameters: Property value: R$ {test_data['property_value']:,}"
            )
            print(
                f"Property appreciation: {test_data['property_appreciation_rate']}% annually"
            )
            print(f"Inflation: {test_data['inflation_rate']}% annually")
            print()

            for scenario in result["scenarios"]:
                print(f"📊 {scenario['name']}:")

                if scenario["monthly_data"]:
                    first_month = scenario["monthly_data"][0]
                    last_month = scenario["monthly_data"][-1]

                    first_property_value = first_month.get("property_value", 0)
                    last_property_value = last_month.get("property_value", 0)

                    print(f"  Month 1 property value: R$ {first_property_value:,.2f}")
                    print(f"  Last month property value: R$ {last_property_value:,.2f}")

                    if first_property_value > 0 and last_property_value > 0:
                        appreciation_percent = (
                            (last_property_value / first_property_value) - 1
                        ) * 100
                        print(
                            f"  Property appreciation during simulation: {appreciation_percent:.1f}%"
                        )

                    # Check scenario-specific logic
                    if scenario["name"] == "Comprar com financiamento":
                        if last_property_value > first_property_value:
                            print(
                                "  ✅ Property appreciated (affects final equity only)"
                            )
                        else:
                            print("  ⚠️  No property appreciation detected")

                    elif scenario["name"] == "Alugar e investir":
                        if last_property_value == first_property_value:
                            print(
                                "  ✅ CORRECT: Property value unchanged (doesn't affect renter)"
                            )
                        else:
                            print(
                                "  ❌ ERROR: Property value should not change for rent scenario"
                            )

                    elif scenario["name"] == "Investir e comprar à vista":
                        if last_property_value > first_property_value:
                            print("  ✅ Property appreciated (affects purchase target)")

                            # Check if purchase was successful
                            purchase_successful = any(
                                data.get("status") == "Imóvel comprado"
                                for data in scenario["monthly_data"]
                            )
                            print(f"  Purchase successful: {purchase_successful}")
                        else:
                            print("  ⚠️  No property appreciation detected")

                print(f"  Final equity: R$ {scenario['final_equity']:,.2f}")
                print()

            return True
        else:
            print(f"❌ API call failed with status {response.status_code}")
            print(f"Error: {response.text}")
            return False

    except requests.exceptions.ConnectionError:
        print(
            "❌ Could not connect to backend server. Make sure it's running on http://localhost:8000"
        )
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


if __name__ == "__main__":
    print("🧪 Testing scenario-specific property appreciation logic...")
    print("=" * 60)

    success = test_scenario_specific_appreciation()

    if success:
        print("\n✅ Scenario-specific property appreciation test completed!")
    else:
        print("\n❌ Test failed!")
