"""Emergency fund planner.

This module provides a deterministic month-by-month plan for reaching an
emergency fund target expressed as N months of expenses.
"""

from __future__ import annotations

from .inflation import apply_inflation
from .rates import convert_interest_rate
from ..models import (
    EmergencyFundPlanInput,
    EmergencyFundPlanMonth,
    EmergencyFundPlanResult,
)


def plan_emergency_fund(input_data: EmergencyFundPlanInput) -> EmergencyFundPlanResult:
    _, monthly_yield_pct = convert_interest_rate(
        annual_rate=input_data.annual_emergency_fund_yield_rate or 0.0
    )
    monthly_yield_multiplier = 1.0 + (monthly_yield_pct / 100.0)

    fund_balance = float(input_data.initial_emergency_fund)
    achieved_at: int | None = None

    months: list[EmergencyFundPlanMonth] = []

    for month in range(1, input_data.horizon_months + 1):
        # Inflate expenses/target over time.
        expenses = apply_inflation(
            input_data.monthly_expenses,
            month=month,
            base_month=1,
            annual_inflation_rate=input_data.annual_inflation_rate,
        )
        target = float(expenses) * float(input_data.target_months_of_expenses)

        # Apply yield first.
        investment_return = 0.0
        if fund_balance > 0 and monthly_yield_multiplier != 1.0:
            new_balance = fund_balance * monthly_yield_multiplier
            investment_return = new_balance - fund_balance
            fund_balance = new_balance

        # Add contribution.
        contribution = float(input_data.monthly_contribution)
        fund_balance += contribution

        progress = 0.0 if target <= 0 else min(100.0, (fund_balance / target) * 100.0)
        achieved = fund_balance >= target if target > 0 else True

        if achieved and achieved_at is None:
            achieved_at = month

        months.append(
            EmergencyFundPlanMonth(
                month=month,
                expenses=float(expenses),
                target_amount=float(target),
                contribution=float(contribution),
                investment_return=float(investment_return),
                emergency_fund_balance=float(fund_balance),
                progress_percent=float(progress),
                achieved=bool(achieved),
            )
        )

    target_end = months[-1].target_amount if months else 0.0
    months_to_goal = (achieved_at - 1) if achieved_at is not None else None

    return EmergencyFundPlanResult(
        achieved_at_month=achieved_at,
        months_to_goal=months_to_goal,
        final_emergency_fund_balance=float(fund_balance),
        target_amount_end=float(target_end),
        monthly_data=months,
    )
