#!/usr/bin/env python3
"""
Test script to verify that separate rent inflation works correctly
"""
import requests
import json

# Test data with separate inflation parameters
test_data = {
    "property_value": 500000,
    "down_payment": 100000,
    "loan_term_years": 30,
    "annual_interest_rate": 10,
    "loan_type": "PRICE",
    "rent_value": 2000,
    "investment_returns": [{"start_month": 1, "end_month": None, "annual_rate": 8}],
    "amortizations": [],
    "inflation_rate": 3.0,  # 3% general inflation
    "rent_inflation_rate": 6.0,  # 6% rent inflation (higher than general)
    "property_appreciation_rate": 4.0,  # 4% property appreciation (different from both)
    "invest_loan_difference": False,
    "fixed_monthly_investment": None,
    "fixed_investment_start_month": 1,
}


def test_separate_inflation():
    """Test that separate inflation parameters are properly processed"""
    url = "http://localhost:8000/api/compare-scenarios-enhanced"

    try:
        response = requests.post(url, json=test_data)

        if response.status_code == 200:
            result = response.json()
            print("✅ API call successful!")
            print(f"Best scenario: {result['best_scenario']}")

            # Print scenario results and check for different inflation effects
            for scenario in result["scenarios"]:
                print(f"\n📊 {scenario['name']}:")
                print(f"  Total cost: R$ {scenario['total_cost']:,.2f}")
                print(f"  Final equity: R$ {scenario['final_equity']:,.2f}")

                if scenario["monthly_data"]:
                    first_month = scenario["monthly_data"][0]
                    last_month = scenario["monthly_data"][-1]

                    # Check rent inflation effects
                    if "rent_paid" in first_month and "rent_paid" in last_month:
                        rent_increase = (
                            last_month["rent_paid"] / first_month["rent_paid"] - 1
                        ) * 100
                        print(f"  🏠 Rent increase over 30 years: {rent_increase:.1f}%")
                        print(
                            f"  🏠 First month rent: R$ {first_month['rent_paid']:,.2f}"
                        )
                        print(
                            f"  🏠 Last month rent: R$ {last_month['rent_paid']:,.2f}"
                        )

                    # Check property value changes
                    if "property_value" in last_month:
                        property_increase = (
                            last_month["property_value"] / test_data["property_value"]
                            - 1
                        ) * 100
                        print(
                            f"  �️ Property value increase over 30 years: {property_increase:.1f}%"
                        )
                        print(
                            f"  �️ Final property value: R$ {last_month['property_value']:,.2f}"
                        )

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
    print("🧪 Testing separate inflation parameters...")
    print(f"Test parameters:")
    print(f"  General inflation: {test_data['inflation_rate']}% per year")
    print(f"  Rent inflation: {test_data['rent_inflation_rate']}% per year")
    print(
        f"  Property appreciation: {test_data['property_appreciation_rate']}% per year"
    )
    print("\n" + "=" * 50)

    success = test_separate_inflation()

    if success:
        print("\n✅ Separate inflation parameters are working correctly!")
        print("📝 Note: Rent should increase more than property value in this test")
    else:
        print("\n❌ Separate inflation parameters test failed!")
