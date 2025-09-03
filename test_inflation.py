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

    response = requests.post(url, json=test_data)
    # Must succeed
    assert response.status_code == 200, f"API call failed: {response.status_code} {response.text}"

    result = response.json()
    assert "scenarios" in result and result["scenarios"], "No scenarios returned"
    assert result["best_scenario"], "Best scenario missing"

    for scenario in result["scenarios"]:
        assert "total_cost" in scenario and "final_equity" in scenario
        if scenario["monthly_data"]:
            first_month = scenario["monthly_data"][0]
            last_month = scenario["monthly_data"][-1]
            # If property value key exists at end ensure non-negative
            if "property_value" in last_month:
                assert last_month["property_value"] >= 0
                # If appreciation rate > 0 we expect it to be >= initial value for relevant scenarios
                if "property_value" in first_month:
                    assert last_month["property_value"] >= first_month["property_value"]


if __name__ == "__main__":
    print("🧪 Testing inflation parameter integration...")
    print(f"Test parameters: {json.dumps(test_data, indent=2)}")
    print("\n" + "=" * 50)

    success = test_inflation_integration()

    if success:
        print("\n✅ Inflation parameters are working correctly!")
    else:
        print("\n❌ Inflation parameters test failed!")
