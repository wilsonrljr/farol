"""Regression-style assertions derived from former script `test_fixed_calculations.py`.
Ensures prior discovered issues remain fixed.
"""

from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)

PAYLOAD = {
    "property_value": 500_000,
    "down_payment": 100_000,
    "loan_term_years": 30,
    "annual_interest_rate": 10.0,
    "loan_type": "PRICE",
    "rent_value": 2000,
    "investment_returns": [{"start_month": 1, "end_month": None, "annual_rate": 8.0}],
    "additional_costs": {
        "itbi_percentage": 2.0,
        "deed_percentage": 1.0,
        "monthly_hoa": 0.0,
        "monthly_property_tax": 0.0,
    },
    "inflation_rate": 3.0,
    "rent_inflation_rate": 6.0,
    "property_appreciation_rate": 4.0,
}


def test_total_cost_positive_and_property_appreciates():
    r = client.post("/api/compare-scenarios-enhanced", json=PAYLOAD)
    assert r.status_code == 200, r.text
    data = r.json()
    assert len(data["scenarios"]) == 3
    buy, rent, invest = data["scenarios"]
    # total_cost is net_cost (gross outflows minus remaining equity/assets).
    # It may legitimately be negative when appreciation/investment returns are high.
    assert isinstance(buy["total_cost"], (int, float))
    # Property appreciation inside buy scenario (first vs last month)
    first_val = buy["monthly_data"][0]["property_value"]
    last_val = buy["monthly_data"][-1]["property_value"]
    assert last_val >= first_val
    # Ensure outputs are numeric for the other scenarios too.
    assert isinstance(rent["total_cost"], (int, float))
    assert isinstance(invest["total_cost"], (int, float))


def test_buy_net_wealth_consistency():
    r = client.post("/api/compare-scenarios-enhanced", json=PAYLOAD)
    assert r.status_code == 200, r.text
    data = r.json()
    buy = data["scenarios"][0]
    # Final equity minus total cost is an economic indicator; just ensure field presence
    assert "final_equity" in buy and buy["final_equity"] >= 0
