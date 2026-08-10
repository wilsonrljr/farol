"""Conditional comparison contract for financed and outright purchases."""

from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def _payload(**overrides):
    payload = {
        "property_value": 100_000.0,
        "down_payment": 100_000.0,
        "total_savings": 100_000.0,
        "comparison_horizon_years": 1,
        "rent_value": 1_000.0,
        "investment_returns": [{"start_month": 1, "annual_rate": 0.0}],
        "additional_costs": {
            "itbi_percentage": 0.0,
            "deed_percentage": 0.0,
            "owner_monthly_costs": {},
            "renter_monthly_costs": {},
        },
    }
    payload.update(overrides)
    return payload


def _buy_scenario(data):
    return next(
        scenario for scenario in data["scenarios"] if scenario["scenario_type"] == "buy"
    )


def test_all_cash_comparison_omits_every_financing_field():
    response = client.post("/api/compare-scenarios", json=_payload())

    assert response.status_code == 200, response.text
    buy = _buy_scenario(response.json())
    assert buy["name"] == "Comprar à vista"
    assert buy["purchase_breakdown"]["financed_amount"] == 0.0
    assert len(buy["monthly_data"]) == 12


def test_fgts_can_remove_initial_principal_without_requiring_a_rate():
    response = client.post(
        "/api/compare-scenarios",
        json=_payload(
            down_payment=60_000.0,
            total_savings=60_000.0,
            fgts={"initial_balance": 40_000.0, "use_at_purchase": True},
        ),
    )

    assert response.status_code == 200, response.text
    buy = _buy_scenario(response.json())
    assert buy["name"] == "Comprar à vista"
    assert buy["purchase_breakdown"]["fgts_at_purchase"] == 40_000.0
    assert buy["purchase_breakdown"]["financed_amount"] == 0.0


def test_all_cash_rejects_two_interest_rate_representations():
    response = client.post(
        "/api/compare-scenarios",
        json=_payload(annual_interest_rate=10.0, monthly_interest_rate=0.8),
    )

    assert response.status_code == 422
    assert "at most one" in response.text


def test_financed_purchase_requires_exactly_one_rate():
    response = client.post(
        "/api/compare-scenarios",
        json=_payload(
            down_payment=20_000.0,
            total_savings=20_000.0,
            loan_term_years=20,
            loan_type="SAC",
        ),
    )

    assert response.status_code == 422
    assert "exactly one" in response.text


def test_financed_purchase_does_not_infer_term_or_loan_type():
    response = client.post(
        "/api/compare-scenarios",
        json=_payload(
            down_payment=20_000.0,
            total_savings=20_000.0,
            annual_interest_rate=10.0,
        ),
    )

    assert response.status_code == 422
    assert "loan_term_years and loan_type are required" in response.text


def test_openapi_exposes_optional_financing_and_explicit_other_cost_contract():
    schemas = client.get("/openapi.json").json()["components"]["schemas"]

    comparison = schemas["ComparisonInput"]
    required = set(comparison.get("required", []))
    assert "loan_term_years" not in required
    assert "loan_type" not in required
    assert "annual_interest_rate" not in required
    assert "monthly_interest_rate" not in required
    assert (
        "Required when financing is needed"
        in comparison["properties"]["loan_term_years"]["description"]
    )

    housing_costs = schemas["HousingMonthlyCostsInput"]["properties"]
    assert housing_costs["other"]["default"] == 0.0
    assert "monthly_other_costs" in schemas["MonthlyRecord"]["properties"]
