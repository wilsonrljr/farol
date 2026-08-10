"""Deterministic adversarial checks for the public financial engines.

These tests intentionally exercise many valid combinations instead of pinning
only one happy-path example.  The seed is fixed so a failure is reproducible.
"""

from __future__ import annotations

import math
import random
from typing import TYPE_CHECKING, Any

import pytest

from backend.app.api.routers.simulations import (
    run_basic_comparison,
    run_enhanced_comparison,
)
from backend.app.core.emergency_fund import plan_emergency_fund
from backend.app.core.fire import plan_fire
from backend.app.core.inflation import apply_inflation
from backend.app.core.stress_test import run_stress_test
from backend.app.core.vehicles import compare_vehicle_options
from backend.app.loans import PriceLoanSimulator, SACLoanSimulator
from backend.app.models import (
    AdditionalCostsInput,
    AmortizationInput,
    ComparisonInput,
    ContributionInput,
    EmergencyFundPlanInput,
    FGTSInput,
    FIREPlanInput,
    InvestmentReturnInput,
    InvestmentTaxInput,
    StressTestInput,
    VehicleComparisonInput,
    VehicleConsortiumConfig,
    VehicleFinancingConfig,
    VehicleSubscriptionConfig,
)

if TYPE_CHECKING:
    from collections.abc import Iterator

RANDOM_SEED = 20_260_810


def _numbers(value: Any) -> Iterator[float]:
    """Yield every non-boolean numeric leaf from nested models/containers."""

    if hasattr(value, "model_dump"):
        yield from _numbers(value.model_dump())
    elif isinstance(value, dict):
        for child in value.values():
            yield from _numbers(child)
    elif isinstance(value, (list, tuple)):
        for child in value:
            yield from _numbers(child)
    elif isinstance(value, (int, float)) and not isinstance(value, bool):
        yield float(value)


def _assert_finite(value: Any) -> None:
    assert all(math.isfinite(number) for number in _numbers(value))


def _random_comparison_input(rng: random.Random) -> ComparisonInput:
    property_value = rng.uniform(30_000, 1_500_000)
    down_payment = rng.uniform(0, property_value)
    costs = AdditionalCostsInput(
        itbi_percentage=rng.uniform(0, 5),
        deed_percentage=rng.uniform(0, 3),
        monthly_hoa=rng.uniform(0, 2_500),
        monthly_property_tax=rng.uniform(0, 1_500),
    )
    upfront = property_value * (costs.itbi_percentage + costs.deed_percentage) / 100
    total_savings = down_payment + upfront + rng.uniform(0, property_value * 0.4)
    term_years = rng.randint(1, 5)

    contributions: list[ContributionInput] | None = None
    if rng.random() < 0.7:
        contributions = [
            ContributionInput(
                month=rng.randint(1, term_years * 12),
                value=rng.uniform(0, 5_000),
                interval_months=rng.choice([None, 3, 6, 12]),
                value_type="fixed",
                applies_to=["buy", "rent_invest", "invest_buy"],
            )
        ]

    amortizations: list[AmortizationInput] | None = None
    if rng.random() < 0.7:
        amortization_type = rng.choice(["fixed", "percentage"])
        amortizations = [
            AmortizationInput(
                month=rng.randint(1, term_years * 12),
                value=(
                    rng.uniform(0, 100)
                    if amortization_type == "percentage"
                    else rng.uniform(0, 20_000)
                ),
                value_type=amortization_type,
                funding_source=rng.choice(["cash", "fgts"]),
            )
        ]

    inflation = rng.uniform(0, 20)
    return ComparisonInput(
        property_value=property_value,
        down_payment=down_payment,
        total_savings=total_savings,
        loan_term_years=term_years,
        monthly_interest_rate=rng.uniform(0, 3),
        loan_type=rng.choice(["SAC", "PRICE"]),
        rent_value=rng.uniform(0, property_value * 0.015),
        investment_returns=[
            InvestmentReturnInput(
                start_month=1,
                annual_rate=rng.uniform(-30, 80),
            )
        ],
        amortizations=amortizations,
        contributions=contributions,
        continue_contributions_after_purchase=rng.choice([True, False]),
        additional_costs=costs,
        inflation_rate=inflation,
        rent_inflation_rate=rng.uniform(0, 25),
        property_appreciation_rate=rng.uniform(0, 25),
        monthly_net_income=rng.uniform(0, 40_000),
        monthly_net_income_adjust_inflation=rng.choice([True, False]),
        investment_tax=InvestmentTaxInput(
            enabled=rng.choice([True, False]),
            mode=rng.choice(["monthly", "on_withdrawal"]),
            effective_tax_rate=rng.uniform(0, 30),
        ),
        fgts=FGTSInput(
            initial_balance=rng.uniform(0, 100_000),
            monthly_contribution=rng.uniform(0, 1_500),
            annual_yield_rate=rng.uniform(0, 12),
            use_at_purchase=rng.choice([True, False]),
            max_withdrawal_at_purchase=(
                None if rng.random() < 0.5 else rng.uniform(0, 100_000)
            ),
        ),
    )


@pytest.mark.parametrize("case", range(30))
def test_randomized_comparisons_preserve_accounting_and_surface_parity(
    case: int,
) -> None:
    rng = random.Random(RANDOM_SEED + case)  # noqa: S311 - reproducible test data
    input_data = _random_comparison_input(rng)

    basic = run_basic_comparison(input_data)
    repeated = run_basic_comparison(input_data)
    enhanced = run_enhanced_comparison(input_data)

    assert basic.model_dump() == repeated.model_dump()
    assert basic.best_scenario == enhanced.best_scenario
    assert basic.best_scenario_type == enhanced.best_scenario_type
    assert basic.comparison_status == enhanced.comparison_status
    assert basic.warnings == enhanced.warnings
    assert len(basic.scenarios) == len(enhanced.scenarios) == 3
    _assert_finite(basic)
    _assert_finite(enhanced)

    enhanced_by_type = {
        scenario.scenario_type: scenario for scenario in enhanced.scenarios
    }
    horizon = input_data.loan_term_years * 12

    for scenario in basic.scenarios:
        enhanced_scenario = enhanced_by_type[scenario.scenario_type]
        enhanced_core = enhanced_scenario.model_dump(exclude={"metrics"})
        assert scenario.model_dump() == enhanced_core
        assert [row.month for row in scenario.monthly_data] == list(
            range(1, horizon + 1)
        )

        assert scenario.final_assets == pytest.approx(
            scenario.final_equity + (scenario.residual_cash_balance or 0.0)
        )
        assert scenario.final_wealth == pytest.approx(
            scenario.final_assets - (scenario.final_liabilities or 0.0)
        )
        assert scenario.net_worth_change == pytest.approx(
            scenario.final_wealth - scenario.initial_wealth
        )

        residual = 0.0
        cumulative_unfunded = 0.0
        cumulative_rent_paid = 0.0
        for row in scenario.monthly_data:
            income = float(input_data.monthly_net_income or 0.0)
            if input_data.monthly_net_income_adjust_inflation:
                income = apply_inflation(
                    income,
                    row.month,
                    1,
                    input_data.inflation_rate,
                )
            available = residual + income
            required = row.required_cash_outflow or 0.0
            funded = row.funded_from_resources or 0.0
            unfunded = row.unfunded_amount or 0.0
            assert required >= 0
            assert funded >= 0
            assert unfunded >= 0
            assert funded + unfunded == pytest.approx(required)
            residual = max(0.0, available - required)
            cumulative_unfunded += unfunded
            assert row.residual_cash_balance == pytest.approx(residual)
            assert row.cumulative_unfunded_amount == pytest.approx(cumulative_unfunded)

            if row.rent_due is not None:
                cumulative_rent_paid += row.rent_paid or 0.0
                assert row.cumulative_rent_paid == pytest.approx(cumulative_rent_paid)
            elif cumulative_rent_paid > 0:
                assert row.cumulative_rent_paid == pytest.approx(cumulative_rent_paid)

            if scenario.scenario_type == "buy":
                applied_sources = sum(
                    (
                        row.extra_amortization_cash or 0.0,
                        row.extra_amortization_fgts or 0.0,
                        row.extra_amortization_bonus or 0.0,
                        row.extra_amortization_13_salario or 0.0,
                    )
                )
                assert applied_sources == pytest.approx(row.extra_amortization or 0.0)
                assert row.installment == pytest.approx(
                    (row.installment_base or 0.0) + applied_sources
                )
                assert row.principal_payment == pytest.approx(
                    (row.principal_base or 0.0) + applied_sources
                )

        assert scenario.residual_cash_balance == pytest.approx(residual)
        assert scenario.total_unfunded_amount == pytest.approx(cumulative_unfunded)
        assert scenario.final_liabilities == pytest.approx(cumulative_unfunded)
        assert scenario.is_feasible is (cumulative_unfunded <= 0.01)

        final_summary = enhanced.comparative_summary[f"month_{horizon}"]
        summary_key = {
            "buy": "buy_total_wealth",
            "rent_invest": "rent_total_wealth",
            "invest_buy": "invest_total_wealth",
        }[scenario.scenario_type]
        assert final_summary[summary_key] == pytest.approx(scenario.final_wealth)


@pytest.mark.parametrize("loan_type", ["SAC", "PRICE"])
def test_randomized_loan_schedules_preserve_principal_identity(loan_type: str) -> None:
    rng = random.Random(  # noqa: S311 - reproducible test data
        RANDOM_SEED + (1 if loan_type == "SAC" else 2)
    )

    for _ in range(100):
        loan_value = rng.uniform(0, 2_000_000)
        term = rng.randint(1, 120)
        monthly_rate = rng.uniform(0, 5)
        amortizations = [
            AmortizationInput(
                month=rng.randint(1, term),
                value=rng.uniform(0, 100),
                value_type="percentage",
            ),
            AmortizationInput(
                month=rng.randint(1, term),
                value=rng.uniform(0, loan_value),
                value_type="fixed",
            ),
        ]
        simulator_type = SACLoanSimulator if loan_type == "SAC" else PriceLoanSimulator
        result = simulator_type(
            loan_value=loan_value,
            term_months=term,
            monthly_interest_rate=monthly_rate,
            amortizations=amortizations,
        ).simulate()
        _assert_finite(result)

        starting_balance = loan_value
        for expected_month, installment in enumerate(result.installments, start=1):
            assert installment.month == expected_month
            assert installment.interest == pytest.approx(
                starting_balance * monthly_rate / 100
            )
            assert 0 <= installment.amortization <= starting_balance + 1e-7
            assert installment.installment == pytest.approx(
                installment.interest + installment.amortization
            )
            assert installment.outstanding_balance == pytest.approx(
                starting_balance - installment.amortization
            )
            assert installment.extra_amortization == pytest.approx(
                installment.extra_amortization_cash
                + installment.extra_amortization_fgts
            )
            starting_balance = installment.outstanding_balance

        assert result.total_paid == pytest.approx(
            sum(item.installment for item in result.installments)
        )
        assert result.total_interest_paid == pytest.approx(
            sum(item.interest for item in result.installments)
        )
        assert starting_balance == pytest.approx(0.0, abs=1e-6)


@pytest.mark.parametrize("simulator_type", [SACLoanSimulator, PriceLoanSimulator])
def test_fully_cash_funded_purchase_has_no_fictitious_loan_month(
    simulator_type: type[SACLoanSimulator] | type[PriceLoanSimulator],
) -> None:
    result = simulator_type(
        loan_value=0.0,
        term_months=12,
        monthly_interest_rate=1.0,
    ).simulate()

    assert result.installments == []
    assert result.actual_term_months == 0
    assert result.months_saved is None
    assert result.total_paid == 0.0
    assert result.total_interest_paid == 0.0


def test_randomized_stress_emergency_fire_and_vehicle_results_are_reconciled() -> None:
    rng = random.Random(RANDOM_SEED + 3)  # noqa: S311 - reproducible test data

    for _ in range(50):
        horizon = rng.randint(1, 72)
        shock_start = rng.randint(1, horizon)
        shock_duration = rng.randint(0, horizon - shock_start + 1)
        stress_input = StressTestInput(
            monthly_income=rng.uniform(0, 50_000),
            monthly_expenses=rng.uniform(0, 50_000),
            initial_emergency_fund=rng.uniform(0, 250_000),
            horizon_months=horizon,
            income_drop_percentage=rng.uniform(0, 100),
            shock_start_month=shock_start,
            shock_duration_months=shock_duration,
            annual_inflation_rate=rng.uniform(-20, 30),
            annual_emergency_fund_yield_rate=rng.uniform(-20, 30),
        )
        stress = run_stress_test(stress_input)
        _assert_finite(stress)
        assert len(stress.monthly_data) == horizon
        assert stress.total_uncovered_deficit == pytest.approx(
            sum(row.uncovered_deficit for row in stress.monthly_data)
        )
        assert stress.final_emergency_fund_balance == pytest.approx(
            stress.monthly_data[-1].emergency_fund_balance
        )
        assert stress.min_emergency_fund_balance == pytest.approx(
            min(
                stress_input.initial_emergency_fund,
                *(row.emergency_fund_balance for row in stress.monthly_data),
            )
        )

        emergency_input = EmergencyFundPlanInput(
            monthly_expenses=rng.uniform(0, 30_000),
            initial_emergency_fund=rng.uniform(0, 200_000),
            target_months_of_expenses=rng.randint(1, 24),
            monthly_contribution=rng.uniform(0, 20_000),
            horizon_months=horizon,
            annual_inflation_rate=rng.uniform(-20, 30),
            annual_emergency_fund_yield_rate=rng.uniform(-20, 30),
        )
        emergency = plan_emergency_fund(emergency_input)
        _assert_finite(emergency)
        assert len(emergency.monthly_data) == horizon
        assert emergency.final_emergency_fund_balance == pytest.approx(
            emergency.monthly_data[-1].emergency_fund_balance
        )
        assert emergency.target_amount_end == pytest.approx(
            emergency.monthly_data[-1].target_amount
        )
        assert all(
            0 <= row.contribution <= emergency_input.monthly_contribution
            for row in emergency.monthly_data
        )

        fire_mode = rng.choice(["traditional", "barista", "coast"])
        fire_kwargs: dict[str, Any] = {}
        if fire_mode == "barista":
            fire_kwargs["barista_monthly_income"] = rng.uniform(0, 20_000)
        if fire_mode == "coast":
            current_age = rng.randint(18, 70)
            target_age = rng.randint(current_age + 1, 100)
            fire_kwargs.update(
                current_age=current_age,
                target_retirement_age=target_age,
                coast_fire_age=rng.randint(current_age, target_age),
            )
        fire_input = FIREPlanInput(
            monthly_expenses=rng.uniform(0, 30_000),
            current_portfolio=rng.uniform(0, 2_000_000),
            monthly_contribution=rng.uniform(0, 30_000),
            horizon_months=horizon,
            annual_return_rate=rng.uniform(-40, 40),
            safe_withdrawal_rate=rng.uniform(1, 15),
            fire_mode=fire_mode,
            **fire_kwargs,
        )
        fire = plan_fire(fire_input)
        _assert_finite(fire)
        assert len(fire.monthly_data) == horizon
        assert fire.final_portfolio == pytest.approx(
            fire.monthly_data[-1].portfolio_balance
        )
        assert fire.total_contributions == pytest.approx(
            sum(row.contribution for row in fire.monthly_data)
        )
        assert fire.total_investment_returns == pytest.approx(
            sum(row.investment_return for row in fire.monthly_data)
        )

        vehicle_input = VehicleComparisonInput(
            vehicle_price=rng.uniform(10_000, 500_000),
            horizon_months=horizon,
            annual_depreciation_rate=rng.uniform(0, 100),
            annual_inflation_rate=rng.uniform(-20, 30),
            monthly_insurance=rng.uniform(0, 2_000),
            monthly_maintenance=rng.uniform(0, 2_000),
            monthly_fuel=rng.uniform(0, 3_000),
            annual_ipva_percentage=rng.uniform(0, 10),
            include_cash=True,
            financing=VehicleFinancingConfig(
                enabled=True,
                down_payment=0,
                term_months=rng.randint(1, 120),
                monthly_interest_rate=rng.uniform(0, 5),
                loan_type=rng.choice(["SAC", "PRICE"]),
            ),
            consortium=VehicleConsortiumConfig(
                enabled=True,
                term_months=120,
                contemplation_month=rng.randint(1, 120),
                admin_fee_percentage=rng.uniform(0, 100),
            ),
            subscription=VehicleSubscriptionConfig(
                enabled=True,
                monthly_fee=rng.uniform(0, 15_000),
            ),
        )
        vehicles = compare_vehicle_options(vehicle_input)
        _assert_finite(vehicles)
        assert len(vehicles.scenarios) == 4
        for scenario in vehicles.scenarios:
            assert len(scenario.monthly_data) == horizon
            assert scenario.total_outflows == pytest.approx(
                sum(row.cash_flow for row in scenario.monthly_data)
            )
            assert scenario.final_asset_value == pytest.approx(
                scenario.monthly_data[-1].asset_value
            )
            assert scenario.final_outstanding_liability == pytest.approx(
                scenario.monthly_data[-1].outstanding_liability
            )
            assert scenario.net_cost == pytest.approx(
                scenario.total_outflows
                + scenario.final_outstanding_liability
                - scenario.final_asset_value
            )
            assert scenario.monthly_data[-1].net_position == pytest.approx(
                -scenario.net_cost
            )
