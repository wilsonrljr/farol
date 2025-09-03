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

    response = requests.post(url, json=test_data)
    assert response.status_code == 200, f"API error {response.status_code}: {response.text}"

    result = response.json()
    assert "scenarios" in result and result["scenarios"], "No scenarios returned"

    names = {s["name"] for s in result["scenarios"]}
    expected_names = {
        "Comprar com financiamento",
        "Alugar e investir",
        "Investir e comprar à vista",
    }
    assert expected_names.issubset(names)

    for scenario in result["scenarios"]:
        monthly = scenario["monthly_data"]
        if not monthly:
            continue
        first_month = monthly[0]
        last_month = monthly[-1]
        first_val = first_month.get("property_value", 0)
        last_val = last_month.get("property_value", 0)

        if scenario["name"] == "Comprar com financiamento":
            if first_val and last_val:
                assert last_val >= first_val, "Property should appreciate in buy scenario"
        elif scenario["name"] == "Alugar e investir":
            # Property value may be tracked but shouldn't change equity; allow equal or unchanged
            if first_val and last_val:
                assert last_val == first_val, "Rent scenario property value should remain constant"
        elif scenario["name"] == "Investir e comprar à vista":
            if first_val and last_val:
                assert last_val >= first_val, "Invest then buy scenario property target should appreciate"


if __name__ == "__main__":
    print("🧪 Testing scenario-specific property appreciation logic...")
    print("=" * 60)

    success = test_scenario_specific_appreciation()

    if success:
        print("\n✅ Scenario-specific property appreciation test completed!")
    else:
        print("\n❌ Test failed!")
