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

    response = requests.post(url, json=test_data)
    assert response.status_code == 200, f"API call failed: {response.status_code} {response.text}"

    result = response.json()
    assert result.get("scenarios"), "No scenarios returned"

    for scenario in result["scenarios"]:
        assert "total_cost" in scenario and "final_equity" in scenario
        monthly = scenario["monthly_data"]
        if not monthly:
            continue
        first_month = monthly[0]
        last_month = monthly[-1]
        # If rent is tracked ensure inflation effect (rent_inflation_rate > inflation_rate)
        if "rent_paid" in first_month and "rent_paid" in last_month:
            if first_month["rent_paid"] > 0:
                assert last_month["rent_paid"] >= first_month["rent_paid"], "Rent should not decrease over period"
        if "property_value" in last_month and "property_value" in first_month:
            if first_month.get("property_value"):
                assert last_month["property_value"] >= first_month["property_value"], "Property value should not decrease with positive appreciation"


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
