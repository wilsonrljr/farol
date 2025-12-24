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
    "rent_reduces_investment": True,
    "monthly_external_savings": 0.0,
}


def test_metrics_summary_with_adjusted_roi():
    r = client.post("/api/scenario-metrics", json=BASE_PAYLOAD)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "metrics" in data
    rent_entry = next(m for m in data["metrics"] if m["name"] == "Alugar e investir")
    assert rent_entry["roi_percentage"] is not None
    assert rent_entry["roi_including_withdrawals_percentage"] is not None
    assert (
        rent_entry["roi_including_withdrawals_percentage"] > rent_entry["roi_percentage"]
    )


def test_metrics_summary_without_adjusted_roi():
    payload = dict(BASE_PAYLOAD)
    payload.update(
        rent_reduces_investment=False,
        rent_value=800.0,
        investment_returns=[{"start_month": 1, "annual_rate": 10.0}],
        monthly_external_savings=None,
    )
    r = client.post("/api/scenario-metrics", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    rent_entry = next(m for m in data["metrics"] if m["name"] == "Alugar e investir")
    # No withdrawals, so adjusted ROI should be null
    assert rent_entry.get("roi_including_withdrawals_percentage") is None
