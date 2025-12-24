"""Regression: buy scenario must respect property_appreciation_rate.

Before the refactor fix, the buy scenario ignored property_appreciation_rate and
fell back to inflation_rate, which makes comparisons inconsistent.

This test ensures that when inflation is 0% but appreciation is > 0%, the buy
scenario's property_value grows over time.
"""

from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


def test_buy_scenario_uses_property_appreciation_rate_not_inflation_fallback():
    payload = {
        "property_value": 500_000,
        "down_payment": 100_000,
        "loan_term_years": 5,
        "annual_interest_rate": 10.0,
        "loan_type": "PRICE",
        "rent_value": 2000,
        "investment_returns": [
            {"start_month": 1, "end_month": None, "annual_rate": 8.0}
        ],
        "additional_costs": {
            "itbi_percentage": 2.0,
            "deed_percentage": 1.0,
            "monthly_hoa": 0.0,
            "monthly_property_tax": 0.0,
        },
        "inflation_rate": 0.0,
        "property_appreciation_rate": 6.0,
    }

    r = client.post("/api/compare-scenarios-enhanced", json=payload)
    assert r.status_code == 200
    data = r.json()

    by_name = {s["name"]: s for s in data["scenarios"]}
    buy = by_name["Comprar com financiamento"]

    monthly = buy["monthly_data"]
    assert monthly

    first_val = monthly[0].get("property_value")
    last_val = monthly[-1].get("property_value")

    assert first_val is not None
    assert last_val is not None
    assert last_val > first_val
