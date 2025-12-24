from backend.app.core.emergency_fund import plan_emergency_fund
from backend.app.models import EmergencyFundPlanInput


def test_emergency_fund_reaches_goal_with_contributions() -> None:
    # Target: 6 * 1000 = 6000. Start 0, contribute 1000/month => achieve at month 6.
    result = plan_emergency_fund(
        EmergencyFundPlanInput(
            monthly_expenses=1000.0,
            initial_emergency_fund=0.0,
            target_months_of_expenses=6,
            monthly_contribution=1000.0,
            horizon_months=12,
            annual_inflation_rate=0.0,
            annual_emergency_fund_yield_rate=0.0,
        )
    )

    assert result.achieved_at_month == 6
    assert result.months_to_goal == 5
    assert result.monthly_data[5].achieved is True
    assert result.monthly_data[5].emergency_fund_balance == 6000.0


def test_emergency_fund_target_increases_with_inflation() -> None:
    result = plan_emergency_fund(
        EmergencyFundPlanInput(
            monthly_expenses=1000.0,
            initial_emergency_fund=0.0,
            target_months_of_expenses=6,
            monthly_contribution=0.0,
            horizon_months=2,
            annual_inflation_rate=12.0,
            annual_emergency_fund_yield_rate=0.0,
        )
    )

    assert result.monthly_data[1].target_amount > result.monthly_data[0].target_amount
