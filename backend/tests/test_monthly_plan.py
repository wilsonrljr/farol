from __future__ import annotations

import pytest

from backend.app.api.routers.simulations import run_enhanced_comparison
from backend.app.core.monthly_budget import allocate_monthly_budget
from backend.app.models import ComparisonInput, MonthlyPlanInput


def _input(**updates: object) -> ComparisonInput:
    payload: dict[str, object] = {
        "property_value": 500_000,
        "down_payment": 100_000,
        "total_savings": 150_000,
        "loan_term_years": 30,
        "comparison_horizon_years": 10,
        "annual_interest_rate": 10,
        "monthly_interest_rate": None,
        "loan_type": "PRICE",
        "rent_value": 2_500,
        "rent_percentage": None,
        "investment_returns": [{"start_month": 1, "end_month": None, "annual_rate": 8}],
        "additional_costs": {
            "itbi_percentage": 2,
            "deed_percentage": 1,
            "owner_monthly_costs": {"hoa": 600, "property_tax": 250},
            "renter_monthly_costs": {"hoa": 600, "property_tax": 0},
        },
        "inflation_rate": 4,
        "rent_inflation_rate": 5,
        "property_appreciation_rate": 4,
        "monthly_plan": {
            "net_income": 10_000,
            "non_housing_expenses": 3_000,
            "adjust_for_inflation": True,
            "wealth_allocation_percentage": 80,
            "financed_purchase": {
                "amortization_percentage": 40,
                "amortization_effect": "reduce_term",
            },
        },
    }
    payload.update(updates)
    return ComparisonInput.model_validate(payload)


def test_budget_allocation_never_funds_assets_from_a_deficit() -> None:
    plan = MonthlyPlanInput(
        net_income=5_000,
        non_housing_expenses=4_000,
        wealth_allocation_percentage=100,
    )

    allocation = allocate_monthly_budget(
        plan,
        month=1,
        housing_due=2_000,
        inflation_rate=4,
    )

    assert allocation.budget_deficit == pytest.approx(1_000)
    assert allocation.disposable_surplus == 0
    assert allocation.wealth_allocation == 0
    assert allocation.investment_allocation == 0
    assert allocation.outside_plan_amount == 0


def test_same_percentage_turns_lower_housing_cost_into_more_investment() -> None:
    result = run_enhanced_comparison(_input())
    by_type = {scenario.scenario_type: scenario for scenario in result.scenarios}

    buy = by_type["buy"].monthly_data[0]
    rent = by_type["rent_invest"].monthly_data[0]

    assert rent.housing_due < buy.housing_due
    assert rent.wealth_allocation > buy.wealth_allocation
    assert rent.investment_allocation > buy.investment_allocation
    assert rent.outside_plan_amount > buy.outside_plan_amount


def test_financed_split_reconciles_and_unallocated_surplus_is_not_cash() -> None:
    result = run_enhanced_comparison(_input())
    buy = next(s for s in result.scenarios if s.scenario_type == "buy")
    first = buy.monthly_data[0]

    assert first.wealth_allocation == pytest.approx(
        (first.investment_allocation or 0) + (first.extra_amortization_allocation or 0)
    )
    assert first.extra_amortization_allocation == pytest.approx(
        (first.wealth_allocation or 0) * 0.4
    )
    assert buy.residual_cash_balance == 0
    assert buy.total_outside_plan is not None
    assert buy.total_outside_plan > 0


def test_reduce_payment_recalculates_future_price_installments() -> None:
    reduce_term = run_enhanced_comparison(_input())
    reduce_payment = run_enhanced_comparison(
        _input(
            monthly_plan={
                "net_income": 10_000,
                "non_housing_expenses": 3_000,
                "adjust_for_inflation": True,
                "wealth_allocation_percentage": 80,
                "financed_purchase": {
                    "amortization_percentage": 40,
                    "amortization_effect": "reduce_payment",
                },
            }
        )
    )

    term_buy = next(s for s in reduce_term.scenarios if s.scenario_type == "buy")
    payment_buy = next(s for s in reduce_payment.scenarios if s.scenario_type == "buy")
    assert (
        payment_buy.monthly_data[1].installment_base
        < term_buy.monthly_data[1].installment_base
    )


def test_extra_income_is_common_and_follows_the_same_policy() -> None:
    result = run_enhanced_comparison(
        _input(
            comparison_horizon_years=1,
            extra_income_events=[
                {
                    "kind": "thirteenth_salary",
                    "amount": 10_000,
                    "month": 12,
                    "inflation_adjust": False,
                }
            ],
        )
    )

    for scenario in result.scenarios:
        month_12 = scenario.monthly_data[11]
        assert month_12.extra_income == 10_000
        assert month_12.wealth_allocation is not None
        assert month_12.wealth_allocation > 8_000


def test_future_extra_income_is_adjusted_from_today_not_its_first_occurrence() -> None:
    result = run_enhanced_comparison(
        _input(
            comparison_horizon_years=2,
            inflation_rate=12.0,
            extra_income_events=[
                {
                    "kind": "bonus",
                    "amount": 10_000.0,
                    "month": 13,
                    "inflation_adjust": True,
                }
            ],
        )
    )

    for scenario in result.scenarios:
        assert scenario.monthly_data[12].extra_income == pytest.approx(11_200.0)


def test_old_monthly_contract_is_rejected() -> None:
    payload = _input().model_dump()
    payload["monthly_net_income"] = 10_000
    with pytest.raises(ValueError, match="Extra inputs are not permitted"):
        ComparisonInput.model_validate(payload)


def test_invest_then_buy_does_not_fund_transition_with_provisional_surplus() -> None:
    result = run_enhanced_comparison(
        _input(
            property_value=100_000.0,
            down_payment=0.0,
            total_savings=95_000.0,
            rent_value=5_000.0,
            monthly_plan={
                "net_income": 20_000.0,
                "non_housing_expenses": 0.0,
                "adjust_for_inflation": False,
                "wealth_allocation_percentage": 100.0,
                "financed_purchase": {
                    "amortization_percentage": 0.0,
                    "amortization_effect": "reduce_term",
                },
            },
            additional_costs={
                "itbi_percentage": 0.0,
                "deed_percentage": 0.0,
                "owner_monthly_costs": {"hoa": 10_000.0, "property_tax": 0.0},
                "renter_monthly_costs": {"hoa": 0.0, "property_tax": 0.0},
            },
        )
    )
    scenario = next(
        item for item in result.scenarios if item.scenario_type == "invest_buy"
    )
    first, transition = scenario.monthly_data[:2]

    assert first.status == "Aguardando compra"
    assert first.investment_allocation == pytest.approx(15_000.0)
    assert transition.status == "Imóvel comprado"
    assert transition.housing_due == pytest.approx(15_000.0)
    assert transition.investment_allocation == pytest.approx(5_000.0)
    assert transition.month == 2
