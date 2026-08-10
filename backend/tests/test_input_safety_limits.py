from __future__ import annotations

from types import SimpleNamespace

from fastapi.testclient import TestClient

from backend.app.core.amortization import relevant_schedule_months
from backend.app.main import app

client = TestClient(app, raise_server_exceptions=False)


def _comparison_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "property_value": 500_000.0,
        "down_payment": 100_000.0,
        "loan_term_years": 50,
        "annual_interest_rate": 10.0,
        "loan_type": "PRICE",
        "rent_value": 2_000.0,
        "investment_returns": [{"start_month": 1, "annual_rate": 8.0}],
        "additional_costs": {
            "itbi_percentage": 2.0,
            "deed_percentage": 1.0,
            "monthly_hoa": 0.0,
            "monthly_property_tax": 0.0,
        },
        "inflation_rate": 4.0,
        "rent_inflation_rate": 4.0,
        "property_appreciation_rate": 4.0,
    }
    payload.update(overrides)
    return payload


def test_core_clamps_huge_occurrence_count_before_materializing_months() -> None:
    schedule = SimpleNamespace(
        month=1,
        interval_months=1,
        occurrences=10**12,
        end_month=None,
    )

    months = relevant_schedule_months(schedule, 600)

    assert isinstance(months, range)
    assert len(months) == 600
    assert months[-1] == 600


def test_api_rejects_occurrences_above_the_contract_limit() -> None:
    response = client.post(
        "/api/compare-scenarios-enhanced",
        json=_comparison_payload(
            contributions=[
                {
                    "month": 1,
                    "interval_months": 1,
                    "occurrences": 10**12,
                    "value": 100.0,
                }
            ]
        ),
    )

    assert response.status_code == 422
    assert "occurrences" in response.text


def test_api_rejects_too_many_extra_income_events() -> None:
    event = {
        "kind": "bonus",
        "month": 1,
        "amount": 100.0,
    }
    response = client.post(
        "/api/compare-scenarios-enhanced",
        json=_comparison_payload(
            extra_income_events=[event.copy() for _ in range(101)]
        ),
    )

    assert response.status_code == 422
    assert "too_long" in response.text


def test_api_rejects_extra_income_beyond_the_horizon() -> None:
    response = client.post(
        "/api/compare-scenarios-enhanced",
        json=_comparison_payload(
            comparison_horizon_years=1,
            extra_income_events=[
                {"kind": "bonus", "month": 13, "amount": 100.0},
            ],
        ),
    )

    assert response.status_code == 422
    assert "after comparison horizon" in response.text


def test_extreme_finite_numbers_are_rejected_without_serializer_details() -> None:
    response = client.post(
        "/api/fire",
        json={
            "monthly_expenses": 1e308,
            "current_portfolio": 1e308,
            "monthly_contribution": 1e308,
            "horizon_months": 600,
            "annual_return_rate": 100.0,
            "safe_withdrawal_rate": 4.0,
            "fire_mode": "traditional",
        },
    )

    assert response.status_code == 422
    assert "Out of range float values" not in response.text
