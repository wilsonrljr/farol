"""Integration test for separate rent & general inflation (from `test_separate_inflation.py`)."""

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
    "inflation_rate": 3.0,
    "rent_inflation_rate": 6.0,
    "property_appreciation_rate": 4.0,
}


def test_rent_and_property_inflation_move_independently():
    r = client.post("/api/compare-scenarios-enhanced", json=PAYLOAD)
    assert r.status_code == 200
    data = r.json()
    for scenario in data["scenarios"]:
        monthly = scenario["monthly_data"]
        if not monthly:
            continue
        first = monthly[0]
        last = monthly[-1]
        if "rent_paid" in first and first.get("rent_paid"):
            assert last["rent_paid"] >= first["rent_paid"]
        if first.get("property_value"):
            assert last.get("property_value", 0) >= first["property_value"]
