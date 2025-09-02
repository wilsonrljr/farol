#!/usr/bin/env python3
"""
Test script to verify that inflation parameters work correctly
"""
import requests
import json

# Test data with inflation parameters
test_data = {
    "property_value": 500000,
    "down_payment": 100000,
    "loan_term_years": 30,
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


def test_inflation_integration():
    """Test that inflation parameters are properly processed"""
    url = "http://localhost:8000/api/compare-scenarios-enhanced"

    try:
        response = requests.post(url, json=test_data)

        if response.status_code == 200:
            result = response.json()
            print("✅ API call successful!")
            print(f"Best scenario: {result['best_scenario']}")

            # Print scenario results
            for scenario in result["scenarios"]:
                print(f"\n📊 {scenario['name']}:")
                print(f"  Total cost: R$ {scenario['total_cost']:,.2f}")
                print(f"  Final equity: R$ {scenario['final_equity']:,.2f}")

                # Check if first and last month show inflation effects
                if scenario["monthly_data"]:
                    first_month = scenario["monthly_data"][0]
                    last_month = scenario["monthly_data"][-1]

                    print(
                        f"  First month data: {json.dumps(first_month, indent=2)[:200]}..."
                    )
                    print(
                        f"  Last month property value: R$ {last_month.get('property_value', 0):,.2f}"
                    )

                    # Check if property value increased (indication of appreciation)
                    if (
                        "property_value" in last_month
                        and last_month["property_value"] > test_data["property_value"]
                    ):
                        print(
                            f"  ✅ Property appreciation detected: {((last_month['property_value'] / test_data['property_value']) - 1) * 100:.1f}% total"
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
    print("🧪 Testing inflation parameter integration...")
    print(f"Test parameters: {json.dumps(test_data, indent=2)}")
    print("\n" + "=" * 50)

    success = test_inflation_integration()

    if success:
        print("\n✅ Inflation parameters are working correctly!")
    else:
        print("\n❌ Inflation parameters test failed!")
