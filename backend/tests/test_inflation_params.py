"""Integration test validating inflation + appreciation handling (from prior `test_inflation.py`)."""

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
    "inflation_rate": 4.0,
    "property_appreciation_rate": 6.0,
}


def test_property_appreciation_non_decreasing():
    r = client.post("/api/compare-scenarios-enhanced", json=PAYLOAD)
    assert r.status_code == 200
    data = r.json()
    for scenario in data["scenarios"]:
        if scenario["monthly_data"]:
            first = scenario["monthly_data"][0]
            last = scenario["monthly_data"][-1]
            if "property_value" in last and "property_value" in first:
                if first.get("property_value"):
                    assert last["property_value"] >= first["property_value"]
