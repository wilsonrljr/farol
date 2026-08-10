from __future__ import annotations

import math
import random

import pytest
from fastapi.testclient import TestClient

from backend.app.api.routers.simulations import run_enhanced_comparison
from backend.app.core.monthly_budget import allocate_monthly_budget
from backend.app.loans import PriceLoanSimulator, SACLoanSimulator
from backend.app.main import app
from backend.app.models import (
    ComparisonInput,
    ExtraIncomeEventInput,
    MonthlyPlanInput,
)

client = TestClient(app)


def _payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "property_value": 100_000.0,
        "down_payment": 0.0,
        "total_savings": 100_000.0,
        "loan_term_years": 2,
        "comparison_horizon_years": 2,
        "annual_interest_rate": 0.0,
        "loan_type": "SAC",
        "rent_value": 500.0,
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
            "net_income": 10_000.0,
            "non_housing_expenses": 2_000.0,
            "adjust_for_inflation": False,
            "wealth_allocation_percentage": 80.0,
            "financed_purchase": {
                "amortization_percentage": 50.0,
                "amortization_effect": "reduce_term",
            },
        },
    }
    payload.update(overrides)
    return payload


def test_deterministic_budget_fuzz_preserves_conservation() -> None:
    rng = random.Random(20_260_810)  # noqa: S311 - deterministic test fuzzing

    for _ in range(500):
        plan = MonthlyPlanInput(
            net_income=rng.uniform(0.0, 100_000.0),
            non_housing_expenses=rng.uniform(0.0, 100_000.0),
            adjust_for_inflation=rng.choice([True, False]),
            wealth_allocation_percentage=rng.uniform(0.0, 100.0),
            financed_purchase={
                "amortization_percentage": rng.uniform(0.0, 100.0),
                "amortization_effect": rng.choice(["reduce_term", "reduce_payment"]),
            },
        )
        month = rng.randint(1, 600)
        events = [
            ExtraIncomeEventInput(
                kind="bonus",
                amount=rng.uniform(0.0, 100_000.0),
                month=month,
                inflation_adjust=rng.choice([True, False]),
            )
        ]
        allocation = allocate_monthly_budget(
            plan,
            month=month,
            housing_due=rng.uniform(0.0, 100_000.0),
            inflation_rate=rng.uniform(0.0, 30.0),
            extra_income_events=events,
            financed=True,
            outstanding_balance=rng.uniform(0.0, 1_000_000.0),
        )

        available = allocation.effective_net_income + allocation.extra_income
        required = (
            allocation.effective_non_housing_expenses
            + allocation.housing_due
            + allocation.wealth_allocation
            + allocation.outside_plan_amount
        )
        assert available + allocation.budget_deficit == pytest.approx(required)
        assert allocation.disposable_surplus == pytest.approx(
            allocation.wealth_allocation + allocation.outside_plan_amount
        )
        assert allocation.wealth_allocation == pytest.approx(
            allocation.investment_allocation + allocation.extra_amortization_allocation
        )
        assert allocation.housing_paid + allocation.housing_shortfall == pytest.approx(
            allocation.housing_due
        )
        assert all(
            math.isfinite(value) and value >= 0.0
            for value in allocation.__dict__.values()
        )


def test_deterministic_cross_scenario_fuzz_preserves_public_ledgers() -> None:
    rng = random.Random(81_081)  # noqa: S311 - deterministic test fuzzing

    for _ in range(60):
        property_value = rng.uniform(50_000.0, 1_000_000.0)
        down_payment = rng.uniform(0.0, property_value)
        itbi = rng.uniform(0.0, 5.0)
        deed = rng.uniform(0.0, 3.0)
        total_savings = (
            down_payment
            + property_value * (itbi + deed) / 100.0
            + rng.uniform(0.0, property_value * 0.4)
        )
        horizon_years = rng.randint(1, 4)
        input_data = ComparisonInput.model_validate(
            _payload(
                property_value=property_value,
                down_payment=down_payment,
                total_savings=total_savings,
                loan_term_years=rng.randint(1, 6),
                comparison_horizon_years=horizon_years,
                annual_interest_rate=rng.uniform(0.0, 30.0),
                loan_type=rng.choice(["SAC", "PRICE"]),
                rent_value=rng.uniform(0.0, 8_000.0),
                investment_returns=[
                    {
                        "start_month": 1,
                        "annual_rate": rng.uniform(-30.0, 50.0),
                    }
                ],
                additional_costs={
                    "itbi_percentage": itbi,
                    "deed_percentage": deed,
                    "owner_monthly_costs": {
                        "hoa": rng.uniform(0.0, 3_000.0),
                        "property_tax": rng.uniform(0.0, 1_500.0),
                    },
                    "renter_monthly_costs": {
                        "hoa": rng.uniform(0.0, 2_500.0),
                        "property_tax": rng.uniform(0.0, 1_000.0),
                    },
                },
                inflation_rate=rng.uniform(0.0, 20.0),
                rent_inflation_rate=rng.uniform(0.0, 25.0),
                property_appreciation_rate=rng.uniform(0.0, 20.0),
                monthly_plan={
                    "net_income": rng.uniform(0.0, 60_000.0),
                    "non_housing_expenses": rng.uniform(0.0, 45_000.0),
                    "adjust_for_inflation": rng.choice([True, False]),
                    "wealth_allocation_percentage": rng.uniform(0.0, 100.0),
                    "financed_purchase": {
                        "amortization_percentage": rng.uniform(0.0, 100.0),
                        "amortization_effect": rng.choice(
                            ["reduce_term", "reduce_payment"]
                        ),
                    },
                },
            )
        )
        result = run_enhanced_comparison(input_data)

        for scenario in result.scenarios:
            assert len(scenario.monthly_data) == horizon_years * 12
            for month in scenario.monthly_data:
                available = (month.effective_net_income or 0.0) + (
                    month.extra_income or 0.0
                )
                required = (
                    (month.effective_non_housing_expenses or 0.0)
                    + (month.housing_due or 0.0)
                    + (month.wealth_allocation or 0.0)
                    + (month.outside_plan_amount or 0.0)
                )
                assert available + (month.budget_deficit or 0.0) == pytest.approx(
                    required
                )
                assert month.wealth_allocation == pytest.approx(
                    (month.investment_allocation or 0.0)
                    + (month.extra_amortization_allocation or 0.0)
                )
                assert month.investment_return_gross is not None
                assert month.investment_return_net is not None

            assert scenario.total_investment_from_income == pytest.approx(
                sum(
                    month.investment_allocation or 0.0
                    for month in scenario.monthly_data
                )
            )
            assert scenario.total_extra_amortization_from_income == pytest.approx(
                sum(
                    month.extra_amortization_allocation or 0.0
                    for month in scenario.monthly_data
                )
            )
            assert scenario.total_outside_plan == pytest.approx(
                sum(month.outside_plan_amount or 0.0 for month in scenario.monthly_data)
            )
            assert scenario.total_budget_deficit == pytest.approx(
                sum(month.budget_deficit or 0.0 for month in scenario.monthly_data)
            )
            assert scenario.total_cost == pytest.approx(
                (scenario.total_outflows or 0.0) - scenario.final_equity
            )
            last = scenario.monthly_data[-1]
            assert scenario.final_equity == pytest.approx(
                (last.equity or 0.0)
                + (last.investment_balance or 0.0)
                + (last.fgts_balance or 0.0)
            )


@pytest.mark.parametrize("simulator_type", [PriceLoanSimulator, SACLoanSimulator])
@pytest.mark.parametrize("effect", ["reduce_term", "reduce_payment"])
@pytest.mark.parametrize("monthly_rate", [0.0, 1e-300, 100.0])
def test_all_loan_modes_reconcile_and_pay_off_at_extreme_valid_rate(
    simulator_type: type[PriceLoanSimulator] | type[SACLoanSimulator],
    effect: str,
    monthly_rate: float,
) -> None:
    def extra_provider(month: int, _base: float, balance: float) -> float:
        return min(10_000.0, balance) if month == 13 else 0.0

    result = simulator_type(
        loan_value=100_000.0,
        term_months=600,
        monthly_interest_rate=monthly_rate,
        dynamic_extra_provider=extra_provider,
        amortization_effect=effect,
    ).simulate()

    assert result.installments[-1].outstanding_balance == 0.0
    assert all(row.outstanding_balance >= 0.0 for row in result.installments)
    assert result.total_paid == pytest.approx(
        sum(row.installment for row in result.installments)
    )
    assert result.total_interest_paid == pytest.approx(
        sum(row.interest for row in result.installments)
    )


def test_start_purchase_is_not_exposed_to_same_month_negative_return() -> None:
    result = run_enhanced_comparison(
        ComparisonInput.model_validate(
            _payload(
                investment_returns=[{"start_month": 1, "annual_rate": -50.0}],
                monthly_plan={
                    "net_income": 0.0,
                    "non_housing_expenses": 0.0,
                    "adjust_for_inflation": False,
                    "wealth_allocation_percentage": 0.0,
                    "financed_purchase": {
                        "amortization_percentage": 0.0,
                        "amortization_effect": "reduce_term",
                    },
                },
            )
        )
    )
    scenario = next(
        item for item in result.scenarios if item.scenario_type == "invest_buy"
    )

    assert scenario.monthly_data[0].status == "Imóvel comprado"
    assert scenario.monthly_data[0].investment_balance == pytest.approx(0.0)


def test_current_month_fgts_deposit_cannot_fund_start_purchase() -> None:
    result = run_enhanced_comparison(
        ComparisonInput.model_validate(
            _payload(
                total_savings=95_000.0,
                monthly_plan={
                    "net_income": 0.0,
                    "non_housing_expenses": 0.0,
                    "adjust_for_inflation": False,
                    "wealth_allocation_percentage": 0.0,
                    "financed_purchase": {
                        "amortization_percentage": 0.0,
                        "amortization_effect": "reduce_term",
                    },
                },
                fgts={
                    "initial_balance": 0.0,
                    "monthly_contribution": 5_000.0,
                    "annual_yield_rate": 0.0,
                    "use_at_purchase": True,
                },
            )
        )
    )
    scenario = next(
        item for item in result.scenarios if item.scenario_type == "invest_buy"
    )

    assert scenario.monthly_data[0].status == "Aguardando compra"
    assert scenario.monthly_data[0].fgts_balance == pytest.approx(5_000.0)
    assert scenario.monthly_data[1].status == "Imóvel comprado"
    assert scenario.monthly_data[1].fgts_used == pytest.approx(5_000.0)


def test_biennial_fgts_policy_uses_first_month_after_purchase_cooldown() -> None:
    result = run_enhanced_comparison(
        ComparisonInput.model_validate(
            _payload(
                total_savings=0.0,
                loan_term_years=5,
                comparison_horizon_years=5,
                rent_value=0.0,
                monthly_plan={
                    "net_income": 10_000.0,
                    "non_housing_expenses": 0.0,
                    "adjust_for_inflation": False,
                    "wealth_allocation_percentage": 0.0,
                    "financed_purchase": {
                        "amortization_percentage": 0.0,
                        "amortization_effect": "reduce_term",
                    },
                },
                fgts={
                    "initial_balance": 50_000.0,
                    "monthly_contribution": 1_000.0,
                    "annual_yield_rate": 0.0,
                    "use_at_purchase": True,
                    "financed_amortization": {
                        "enabled": True,
                        "first_month": 24,
                        "interval_months": 24,
                        "amount_mode": "available_balance",
                    },
                },
            )
        )
    )
    scenario = next(item for item in result.scenarios if item.scenario_type == "buy")
    assert scenario.fgts_summary is not None

    history = scenario.fgts_summary.withdrawal_history
    assert [record.month for record in history] == [1, 25]
    assert all(record.success for record in history)


def test_post_purchase_owner_cost_breakdown_remains_visible() -> None:
    result = run_enhanced_comparison(
        ComparisonInput.model_validate(
            _payload(
                rent_value=0.0,
                additional_costs={
                    "itbi_percentage": 0.0,
                    "deed_percentage": 0.0,
                    "owner_monthly_costs": {"hoa": 150.0, "property_tax": 50.0},
                    "renter_monthly_costs": {"hoa": 0.0, "property_tax": 0.0},
                },
            )
        )
    )
    scenario = next(
        item for item in result.scenarios if item.scenario_type == "invest_buy"
    )

    second_month = scenario.monthly_data[1]
    assert second_month.status == "Imóvel comprado"
    assert second_month.monthly_hoa == pytest.approx(150.0)
    assert second_month.monthly_property_tax == pytest.approx(50.0)
    assert second_month.monthly_additional_costs == pytest.approx(200.0)


def test_repeated_subcent_deficits_report_the_first_material_month() -> None:
    result = run_enhanced_comparison(
        ComparisonInput.model_validate(
            _payload(
                down_payment=100_000.0,
                total_savings=100_000.0,
                rent_value=0.0,
                monthly_plan={
                    "net_income": 999.994,
                    "non_housing_expenses": 1_000.0,
                    "adjust_for_inflation": False,
                    "wealth_allocation_percentage": 0.0,
                    "financed_purchase": {
                        "amortization_percentage": 0.0,
                        "amortization_effect": "reduce_term",
                    },
                },
            )
        )
    )
    scenario = next(
        item for item in result.scenarios if item.scenario_type == "rent_invest"
    )

    assert scenario.is_feasible is False
    assert scenario.first_unfunded_month == 2
    assert scenario.total_unfunded_amount == pytest.approx(24 * 0.006)


def test_batch_omits_ranking_when_inflation_changes_adjusted_extra_income() -> None:
    common = _payload(
        extra_income_events=[
            {
                "kind": "bonus",
                "amount": 10_000.0,
                "month": 13,
                "inflation_adjust": True,
            }
        ]
    )
    response = client.post(
        "/api/compare-scenarios-batch",
        json={
            "items": [
                {
                    "preset_id": "zero",
                    "preset_name": "Inflação zero",
                    "input": {**common, "inflation_rate": 0.0},
                },
                {
                    "preset_id": "ten",
                    "preset_name": "Inflação dez",
                    "input": {**common, "inflation_rate": 10.0},
                },
            ]
        },
    )

    assert response.status_code == 200, response.text
    assert response.json()["comparison_status"] == "no_authoritative_result"
    assert response.json()["ranking"] == []


def test_batch_ignores_extra_income_metadata_and_order_in_resource_baseline() -> None:
    first_events = [
        {
            "kind": "bonus",
            "label": "PLR",
            "amount": 1_000.0,
            "month": 12,
            "inflation_adjust": False,
        },
        {
            "kind": "other",
            "label": "Projeto paralelo",
            "amount": 2_000.0,
            "month": 6,
            "interval_months": 6,
            "end_month": 24,
            "inflation_adjust": True,
        },
    ]
    economically_equivalent_events = [
        {
            **first_events[1],
            "kind": "thirteenth_salary",
            "label": "Outro nome",
        },
        {
            **first_events[0],
            "kind": "other",
            "label": None,
        },
    ]

    response = client.post(
        "/api/compare-scenarios-batch",
        json={
            "items": [
                {
                    "preset_id": "first",
                    "preset_name": "Primeiro",
                    "input": _payload(extra_income_events=first_events),
                },
                {
                    "preset_id": "second",
                    "preset_name": "Segundo",
                    "input": _payload(
                        extra_income_events=economically_equivalent_events
                    ),
                },
            ]
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["comparison_status"] == "ranked"
    assert len(data["ranking"]) == 6
    assert data["global_best"] is not None


def test_batch_preserves_extra_income_multiplicity_as_an_economic_difference() -> None:
    event = {
        "kind": "bonus",
        "label": "Bônus",
        "amount": 1_000.0,
        "month": 12,
        "inflation_adjust": False,
    }
    response = client.post(
        "/api/compare-scenarios-batch",
        json={
            "items": [
                {
                    "preset_id": "one",
                    "preset_name": "Um evento",
                    "input": _payload(extra_income_events=[event]),
                },
                {
                    "preset_id": "two",
                    "preset_name": "Dois eventos",
                    "input": _payload(extra_income_events=[event, event]),
                },
            ]
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["comparison_status"] == "no_authoritative_result"
    assert data["ranking"] == []
