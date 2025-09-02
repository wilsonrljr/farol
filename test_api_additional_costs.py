#!/usr/bin/env python3
"""
Test script to call the API endpoint directly and verify additional costs are working.
"""

import requests
import json

# API endpoint
url = "http://localhost:8000/api/compare-scenarios-enhanced"

# Test data with additional costs
test_data = {
    "property_value": 500000,
    "down_payment": 100000,
    "loan_term_years": 30,
    "annual_interest_rate": 10.0,
    "loan_type": "PRICE",
    "rent_value": 2000,
    "investment_returns": [{"start_month": 1, "end_month": None, "annual_rate": 8.0}],
    "additional_costs": {
        "itbi_percentage": 2.0,
        "deed_percentage": 1.0,
        "monthly_hoa": 300.0,
        "monthly_property_tax": 200.0,
    },
}

print("=== Testing API Call with Additional Costs ===")
print(f"Property Value: R$ {test_data['property_value']:,.2f}")
print(f"Down Payment: R$ {test_data['down_payment']:,.2f}")
print(f"ITBI: {test_data['additional_costs']['itbi_percentage']}%")
print(f"Deed: {test_data['additional_costs']['deed_percentage']}%")
print(f"Monthly HOA: R$ {test_data['additional_costs']['monthly_hoa']}")
print(
    f"Monthly Property Tax: R$ {test_data['additional_costs']['monthly_property_tax']}"
)
print()

try:
    # Make the API call
    response = requests.post(url, json=test_data, timeout=30)

    if response.status_code == 200:
        result = response.json()

        print("=== API Response ===")
        print(f"Best Scenario: {result['best_scenario']}")
        print()

        # Check the buy scenario for additional costs
        buy_scenario = None
        for scenario in result["scenarios"]:
            if "comprar" in scenario["name"].lower():
                buy_scenario = scenario
                break

        if buy_scenario:
            print("=== Buy Scenario Analysis ===")
            print(f"Scenario Name: {buy_scenario['name']}")
            print(f"Total Cost: R$ {buy_scenario['total_cost']:,.2f}")
            print(f"Final Equity: R$ {buy_scenario['final_equity']:,.2f}")
            print()

            # Check first month data for additional costs
            if buy_scenario["monthly_data"]:
                first_month = buy_scenario["monthly_data"][0]
                print("=== First Month Data ===")
                for key, value in first_month.items():
                    if isinstance(value, (int, float)):
                        print(f"{key}: R$ {value:,.2f}")
                    else:
                        print(f"{key}: {value}")

                # Check if additional costs are included
                if "monthly_additional_costs" in first_month:
                    print(
                        f"\n✅ Monthly additional costs are included: R$ {first_month['monthly_additional_costs']:,.2f}"
                    )
                else:
                    print(
                        f"\n❌ Monthly additional costs are NOT included in monthly data"
                    )

                if "total_monthly_cost" in first_month:
                    print(
                        f"✅ Total monthly cost is included: R$ {first_month['total_monthly_cost']:,.2f}"
                    )
                else:
                    print(f"❌ Total monthly cost is NOT included in monthly data")

    else:
        print(f"❌ API Error: {response.status_code}")
        print(response.text)

except Exception as e:
    print(f"❌ Error calling API: {e}")

print("\n" + "=" * 50)
print("Now testing with NO additional costs:")

# Test without additional costs
test_data_no_costs = test_data.copy()
test_data_no_costs["additional_costs"] = None

try:
    response = requests.post(url, json=test_data_no_costs, timeout=30)

    if response.status_code == 200:
        result = response.json()

        buy_scenario = None
        for scenario in result["scenarios"]:
            if "comprar" in scenario["name"].lower():
                buy_scenario = scenario
                break

        if buy_scenario:
            print(
                f"Total Cost (no additional costs): R$ {buy_scenario['total_cost']:,.2f}"
            )
            if buy_scenario["monthly_data"]:
                first_month = buy_scenario["monthly_data"][0]
                if "monthly_additional_costs" in first_month:
                    print(
                        f"Monthly additional costs: R$ {first_month['monthly_additional_costs']:,.2f}"
                    )
                else:
                    print("No monthly additional costs field")

except Exception as e:
    print(f"❌ Error calling API: {e}")
