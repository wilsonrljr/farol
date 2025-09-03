"""Integration tests for API behaviour regarding additional costs.

Replaces root script `test_api_additional_costs.py` using TestClient instead of real HTTP calls.
"""
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

BASE_PAYLOAD = {
    "property_value": 500_000,
    "down_payment": 100_000,
    "loan_term_years": 30,
    "annual_interest_rate": 10.0,
    "loan_type": "PRICE",
    "rent_value": 2000,
    "investment_returns": [{"start_month": 1, "end_month": None, "annual_rate": 8.0}],
}


def _get_buy_scenario(resp_json):
    for scenario in resp_json["scenarios"]:
        if "comprar" in scenario["name"].lower():
            return scenario
    raise AssertionError("Buy scenario not found in response")


def test_buy_scenario_contains_additional_costs_fields_when_provided():
    payload = dict(BASE_PAYLOAD)
    payload["additional_costs"] = {
        "itbi_percentage": 2.0,
        "deed_percentage": 1.0,
        "monthly_hoa": 300.0,
        "monthly_property_tax": 200.0,
    }
    r = client.post("/api/compare-scenarios-enhanced", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    buy = _get_buy_scenario(data)
    first = buy["monthly_data"][0]
    assert "monthly_additional_costs" in first
    assert first["monthly_additional_costs"] == 500.0  # 300 + 200
    assert "total_monthly_cost" in first


def test_buy_scenario_omits_additional_costs_fields_when_none():
    payload = dict(BASE_PAYLOAD)
    payload["additional_costs"] = None
    r = client.post("/api/compare-scenarios-enhanced", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    buy = _get_buy_scenario(data)
    first = buy["monthly_data"][0]
    # Field may exist but should be zero, or absent; accept either pattern.
    if "monthly_additional_costs" in first:
        assert first["monthly_additional_costs"] == 0
