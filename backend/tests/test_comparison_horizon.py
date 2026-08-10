from __future__ import annotations

from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from backend.app.api.routers.simulations import run_basic_comparison
from backend.app.main import app
from backend.app.models import ComparisonInput

client = TestClient(app)


def _payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "property_value": 120_000.0,
        "down_payment": 12_000.0,
        "total_savings": 12_000.0,
        "loan_term_years": 2,
        "annual_interest_rate": 0.0,
        "loan_type": "SAC",
        "rent_value": 1_000.0,
        "investment_returns": [{"start_month": 1, "annual_rate": 0.0}],
        "additional_costs": {
            "itbi_percentage": 0.0,
            "deed_percentage": 0.0,
            "owner_monthly_costs": {"hoa": 0.0, "property_tax": 0.0},
            "renter_monthly_costs": {"hoa": 0.0, "property_tax": 0.0},
        },
        "inflation_rate": 0.0,
        "rent_inflation_rate": 0.0,
        "property_appreciation_rate": 0.0,
        "monthly_plan": {
            "net_income": 20_000.0,
            "non_housing_expenses": 0.0,
            "adjust_for_inflation": False,
            "wealth_allocation_percentage": 0.0,
            "financed_purchase": {
                "amortization_percentage": 0.0,
                "amortization_effect": "reduce_term",
            },
        },
    }
    payload.update(overrides)
    return payload


def _run(payload: dict[str, object]):  # type: ignore[no-untyped-def]
    return run_basic_comparison(ComparisonInput.model_validate(payload))


def _scenario(result, scenario_type: str):  # type: ignore[no-untyped-def]
    return next(
        scenario
        for scenario in result.scenarios
        if scenario.scenario_type == scenario_type
    )


def test_horizon_shorter_than_loan_keeps_debt_in_cutoff_equity() -> None:
    result = _run(_payload(comparison_horizon_years=1))

    assert {len(scenario.monthly_data) for scenario in result.scenarios} == {12}

    buy = _scenario(result, "buy")
    cutoff = buy.monthly_data[-1]

    # SAC at zero interest amortizes R$ 108k / 24 = R$ 4.5k per month.
    assert cutoff.month == 12
    assert cutoff.outstanding_balance == pytest.approx(54_000.0)
    assert cutoff.property_value == pytest.approx(120_000.0)
    assert cutoff.equity == pytest.approx(66_000.0)
    assert buy.final_equity == pytest.approx(66_000.0)


def test_horizon_longer_than_loan_keeps_all_scenarios_aligned_after_payoff() -> None:
    result = _run(
        _payload(
            loan_term_years=1,
            comparison_horizon_years=3,
            additional_costs={
                "itbi_percentage": 0.0,
                "deed_percentage": 0.0,
                "owner_monthly_costs": {"hoa": 100.0, "property_tax": 0.0},
                "renter_monthly_costs": {"hoa": 0.0, "property_tax": 0.0},
            },
        )
    )

    assert {len(scenario.monthly_data) for scenario in result.scenarios} == {36}

    buy = _scenario(result, "buy")
    payoff = buy.monthly_data[11]
    first_post_payoff = buy.monthly_data[12]
    cutoff = buy.monthly_data[-1]

    assert payoff.outstanding_balance == pytest.approx(0.0)
    assert first_post_payoff.installment == pytest.approx(0.0)
    assert first_post_payoff.outstanding_balance == pytest.approx(0.0)
    assert first_post_payoff.housing_due == pytest.approx(100.0)
    assert cutoff.housing_due == pytest.approx(100.0)
    assert buy.final_equity == pytest.approx(120_000.0)
    assert buy.total_outflows == pytest.approx(120_000.0 + 36 * 100.0)


def test_monthly_investment_follows_horizon_instead_of_financing_term() -> None:
    result = _run(
        _payload(
            loan_term_years=1,
            comparison_horizon_years=2,
            monthly_plan={
                "net_income": 1_000.0,
                "non_housing_expenses": 0.0,
                "adjust_for_inflation": False,
                "wealth_allocation_percentage": 100.0,
                "financed_purchase": {
                    "amortization_percentage": 0.0,
                    "amortization_effect": "reduce_term",
                },
            },
        )
    )

    buy = _scenario(result, "buy")
    rent = _scenario(result, "rent_invest")
    assert buy.monthly_data[17].investment_allocation == pytest.approx(1_000.0)
    assert rent.monthly_data[17].investment_allocation == pytest.approx(0.0)
    assert buy.monthly_data[17].outstanding_balance == pytest.approx(0.0)
    assert buy.monthly_data[-1].investment_balance == pytest.approx(12_000.0)


def test_future_fgts_amortization_does_not_leak_before_cutoff() -> None:
    common = _payload(
        comparison_horizon_years=1,
        fgts={
            "initial_balance": 10_000.0,
            "monthly_contribution": 100.0,
            "annual_yield_rate": 0.0,
            "use_at_purchase": False,
        },
    )
    without_future_event = _run(common)

    with_future_event_payload = deepcopy(common)
    with_future_event_payload["fgts"] = {
        **with_future_event_payload["fgts"],
        "financed_amortization": {
            "enabled": True,
            "first_month": 18,
            "interval_months": 24,
            "amount_mode": "fixed",
            "amount": 5_000.0,
        },
    }
    with_future_event = _run(with_future_event_payload)

    baseline_buy = _scenario(without_future_event, "buy")
    cutoff_buy = _scenario(with_future_event, "buy")

    assert cutoff_buy.monthly_data == baseline_buy.monthly_data
    assert cutoff_buy.final_equity == pytest.approx(baseline_buy.final_equity)
    assert cutoff_buy.final_equity == pytest.approx(77_200.0)

    summary = cutoff_buy.fgts_summary
    assert summary is not None
    assert summary.total_contributions == pytest.approx(1_200.0)
    assert summary.total_withdrawn == pytest.approx(0.0)
    assert summary.withdrawal_history == []
    assert summary.final_balance == pytest.approx(11_200.0)
    assert cutoff_buy.monthly_data[-1].fgts_balance == pytest.approx(11_200.0)

    # The same event is real (not ignored globally): it appears when the
    # observation horizon reaches month 18.
    full_result = _run(
        {
            **with_future_event_payload,
            "comparison_horizon_years": 2,
        }
    )
    full_summary = _scenario(full_result, "buy").fgts_summary
    assert full_summary is not None
    assert [record.month for record in full_summary.withdrawal_history] == [18]
    assert full_summary.withdrawn_for_amortizations == pytest.approx(5_000.0)


def test_omitted_horizon_is_backward_compatible_with_loan_term() -> None:
    legacy_payload = _payload()
    explicit_payload = {**legacy_payload, "comparison_horizon_years": 2}

    legacy_input = ComparisonInput.model_validate(legacy_payload)
    assert legacy_input.comparison_horizon_years is None

    legacy_response = client.post("/api/compare-scenarios", json=legacy_payload)
    explicit_response = client.post("/api/compare-scenarios", json=explicit_payload)

    assert legacy_response.status_code == 200, legacy_response.text
    assert explicit_response.status_code == 200, explicit_response.text
    assert legacy_response.json() == explicit_response.json()
    assert {
        len(scenario["monthly_data"])
        for scenario in legacy_response.json()["scenarios"]
    } == {24}


def test_batch_uses_effective_horizon_in_resource_baseline() -> None:
    common: dict[str, object] = {}
    same_horizon_response = client.post(
        "/api/compare-scenarios-batch",
        json={
            "items": [
                {
                    "preset_id": "explicit",
                    "preset_name": "Explicit horizon",
                    "input": _payload(
                        **common,
                        loan_term_years=1,
                        comparison_horizon_years=2,
                    ),
                },
                {
                    "preset_id": "legacy",
                    "preset_name": "Legacy effective horizon",
                    "input": _payload(**common, loan_term_years=2),
                },
            ]
        },
    )

    assert same_horizon_response.status_code == 200, same_horizon_response.text
    same_horizon = same_horizon_response.json()
    assert same_horizon["comparison_status"] == "ranked"
    assert len(same_horizon["ranking"]) == 6
    assert same_horizon["global_best"] is not None

    different_horizon_response = client.post(
        "/api/compare-scenarios-batch",
        json={
            "items": [
                {
                    "preset_id": "one-year",
                    "preset_name": "One year",
                    "input": _payload(**common, loan_term_years=1),
                },
                {
                    "preset_id": "two-years",
                    "preset_name": "Two years",
                    "input": _payload(
                        **common,
                        loan_term_years=1,
                        comparison_horizon_years=2,
                    ),
                },
            ]
        },
    )

    assert different_horizon_response.status_code == 200, (
        different_horizon_response.text
    )
    different_horizon = different_horizon_response.json()
    assert different_horizon["comparison_status"] == "no_authoritative_result"
    assert different_horizon["ranking"] == []
    assert different_horizon.get("global_best") is None
    assert any("horizons" in warning for warning in different_horizon["warnings"])


def test_loan_term_sensitivity_is_rankable_only_with_a_fixed_horizon() -> None:
    fixed_horizon_response = client.post(
        "/api/sensitivity-analysis",
        json={
            "base_input": _payload(
                loan_term_years=2,
                comparison_horizon_years=2,
            ),
            "parameter": "loan_term_years",
            "range": {"min_value": 1.0, "max_value": 3.0, "steps": 3},
        },
    )

    assert fixed_horizon_response.status_code == 200, fixed_horizon_response.text
    fixed_horizon = fixed_horizon_response.json()
    assert fixed_horizon["comparison_status"] == "ranked"
    assert fixed_horizon["best_overall"] is not None
    assert not any(
        "changes the simulation horizon" in warning
        for warning in fixed_horizon["warnings"]
    )
    derived_horizon_response = client.post(
        "/api/sensitivity-analysis",
        json={
            "base_input": _payload(loan_term_years=2),
            "parameter": "loan_term_years",
            "range": {"min_value": 1.0, "max_value": 3.0, "steps": 3},
        },
    )

    assert derived_horizon_response.status_code == 200, derived_horizon_response.text
    derived_horizon = derived_horizon_response.json()
    assert derived_horizon["comparison_status"] == "no_authoritative_result"
    assert derived_horizon.get("best_overall") is None
    assert derived_horizon["breakeven_points"] == []
    assert any(
        "changes the simulation horizon" in warning
        for warning in derived_horizon["warnings"]
    )
