from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)

BASE_PAYLOAD = {
    "property_value": 300000.0,
    "down_payment": 60000.0,
    "loan_term_years": 2,
    "annual_interest_rate": 9.6,
    "loan_type": "PRICE",
    "rent_value": 2500.0,
    "investment_returns": [{"start_month": 1, "annual_rate": 6.0}],
    "additional_costs": {
        "itbi_percentage": 0.0,
        "deed_percentage": 0.0,
        "monthly_hoa": 0.0,
        "monthly_property_tax": 0.0,
    },
    "monthly_net_income": 8000.0,  # Income-based model
}


def test_metrics_summary_basic():
    """Test that scenario metrics are returned correctly."""
    r = client.post("/api/scenario-metrics", json=BASE_PAYLOAD)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "metrics" in data
    assert "best_scenario" in data
    rent_entry = next(m for m in data["metrics"] if m["name"] == "Alugar e investir")
    assert rent_entry["roi_percentage"] is not None


def test_metrics_summary_no_income():
    """Test scenario metrics when no income is provided (legacy mode)."""
    payload = dict(BASE_PAYLOAD)
    payload["monthly_net_income"] = None
    r = client.post("/api/scenario-metrics", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    rent_entry = next(m for m in data["metrics"] if m["name"] == "Alugar e investir")
    # Should still have ROI calculated
    assert rent_entry["roi_percentage"] is not None
