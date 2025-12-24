from backend.app.core.inflation import apply_inflation
from backend.app.core.stress_test import run_stress_test
from backend.app.models import StressTestInput


def test_stress_test_depletion_month_and_uncovered_deficit() -> None:
    result = run_stress_test(
        StressTestInput(
            monthly_income=0.0,
            monthly_expenses=1000.0,
            initial_emergency_fund=2500.0,
            horizon_months=6,
            shock_duration_months=0,
        )
    )

    assert result.depleted_at_month == 3
    assert result.months_survived == 2
    # Month 3 uncovered: 500; months 4-6 uncovered: 1000 each => total 3500.
    assert result.total_uncovered_deficit == 3500.0

    m3 = result.monthly_data[2]
    assert m3.month == 3
    assert m3.depleted is True
    assert m3.uncovered_deficit == 500.0
    assert m3.emergency_fund_balance == 0.0


def test_stress_test_no_depletion_when_cashflow_positive() -> None:
    result = run_stress_test(
        StressTestInput(
            monthly_income=5000.0,
            monthly_expenses=3000.0,
            initial_emergency_fund=1000.0,
            horizon_months=24,
            shock_duration_months=0,
        )
    )

    assert result.depleted_at_month is None
    assert result.total_uncovered_deficit == 0.0
    assert result.months_survived == 24
    assert result.final_emergency_fund_balance > 1000.0


def test_stress_test_applies_inflation_to_expenses() -> None:
    annual_inflation_rate = 12.0
    base_expenses = 1000.0

    result = run_stress_test(
        StressTestInput(
            monthly_income=0.0,
            monthly_expenses=base_expenses,
            initial_emergency_fund=10_000.0,
            horizon_months=2,
            annual_inflation_rate=annual_inflation_rate,
            shock_duration_months=0,
        )
    )

    assert result.monthly_data[0].expenses == base_expenses
    expected_month2 = apply_inflation(
        base_expenses,
        month=2,
        base_month=1,
        annual_inflation_rate=annual_inflation_rate,
    )
    assert result.monthly_data[1].expenses == expected_month2
    assert result.monthly_data[1].expenses > result.monthly_data[0].expenses
