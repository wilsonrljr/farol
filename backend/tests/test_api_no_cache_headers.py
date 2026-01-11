from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


def test_compare_scenarios_enhanced_sets_no_cache_headers():
    payload = {
        "property_value": 500_000,
        "down_payment": 100_000,
        "loan_term_years": 30,
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
        "inflation_rate": 4.0,
        "rent_inflation_rate": 5.0,
        "property_appreciation_rate": 4.0,
    }

    r = client.post("/api/compare-scenarios-enhanced", json=payload)
    assert r.status_code == 200, r.text

    cc = r.headers.get("cache-control", "")
    pragma = r.headers.get("pragma", "")
    expires = r.headers.get("expires", "")

    assert "no-store" in cc
    assert "no-cache" in cc
    assert pragma.lower() == "no-cache"
    assert expires == "0"
