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
    "additional_costs": {
        "itbi_percentage": 2.0,
        "deed_percentage": 1.0,
        "monthly_hoa": 0.0,
        "monthly_property_tax": 0.0,
    },
    "inflation_rate": 4.0,
    "property_appreciation_rate": 4.0,
}


def test_monthly_external_savings_requires_rent_reduces_investment():
    payload = {
        **BASE_PAYLOAD,
        "rent_reduces_investment": False,
        "monthly_external_savings": 1000.0,
    }

    r = client.post("/api/compare-scenarios-enhanced", json=payload)
    assert r.status_code == 422

    data = r.json()
    assert "detail" in data

    # Pydantic v2 returns a list of error objects; we assert the message is present.
    detail = data["detail"]
    assert isinstance(detail, list)
    assert any(
        "monthly_external_savings requires rent_reduces_investment=true" in str(item)
        for item in detail
    )


def test_monthly_external_savings_allowed_when_rent_reduces_investment_true():
    payload = {
        **BASE_PAYLOAD,
        "rent_reduces_investment": True,
        "monthly_external_savings": 1000.0,
        "invest_external_surplus": False,
    }

    r = client.post("/api/compare-scenarios-enhanced", json=payload)
    assert r.status_code == 200
