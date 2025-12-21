"""Scenario-specific appreciation assertions (from `test_scenario_specific_appreciation.py`)."""

from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)

PAYLOAD = {
    "property_value": 500_000,
    "down_payment": 100_000,
    "loan_term_years": 10,
    "annual_interest_rate": 10.0,
    "loan_type": "PRICE",
    "rent_value": 2000,
    "investment_returns": [{"start_month": 1, "end_month": None, "annual_rate": 8.0}],
    "inflation_rate": 4.0,
    "property_appreciation_rate": 6.0,
}


def test_appreciation_behaviour_per_scenario():
    r = client.post("/api/compare-scenarios-enhanced", json=PAYLOAD)
    assert r.status_code == 200
    data = r.json()
    names = {s["name"] for s in data["scenarios"]}
    assert {
        "Comprar com financiamento",
        "Alugar e investir",
        "Investir e comprar à vista",
    }.issubset(names)
    for scenario in data["scenarios"]:
        monthly = scenario["monthly_data"]
        if not monthly:
            continue
        first_val = monthly[0].get("property_value", 0)
        last_val = monthly[-1].get("property_value", 0)
        if scenario["name"] == "Comprar com financiamento":
            if first_val and last_val:
                assert last_val >= first_val
        elif scenario["name"] == "Alugar e investir":
            # Rent scenario tracks the target property value trajectory for comparison.
            if first_val and last_val:
                assert last_val >= first_val
        elif scenario["name"] == "Investir e comprar à vista":
            if first_val and last_val:
                assert last_val >= first_val
