"""Emergency fund planner.

This module provides a deterministic month-by-month plan for reaching an
emergency fund target expressed as N months of expenses.
"""

from __future__ import annotations

from ..models import (
    EmergencyFundPlanInput,
    EmergencyFundPlanMonth,
    EmergencyFundPlanResult,
)
from .inflation import apply_inflation
from .rates import convert_interest_rate


def plan_emergency_fund(input_data: EmergencyFundPlanInput) -> EmergencyFundPlanResult:
    _, monthly_yield_pct = convert_interest_rate(
        annual_rate=input_data.annual_emergency_fund_yield_rate or 0.0
    )
    monthly_yield_multiplier = 1.0 + (monthly_yield_pct / 100.0)

    fund_balance = float(input_data.initial_emergency_fund)
    initial_target = float(input_data.monthly_expenses) * float(
        input_data.target_months_of_expenses
    )
    currently_achieved = fund_balance >= initial_target
    # achieved_at_month remains a 1-based monthly-series coordinate for API
    # compatibility; currently_achieved and months_to_goal expose month-zero semantics.
    achieved_at: int | None = 1 if currently_achieved else None

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

        # Contribute only what is needed to reach or maintain this month's target.
        # This avoids accumulating an unrelated investment portfolio after the
        # emergency reserve is complete, while allowing contributions to resume
        # when inflation or a negative yield lifts the target above the balance.
        shortfall = max(0.0, target - fund_balance)
        contribution = min(float(input_data.monthly_contribution), shortfall)
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
    # Monthly rows are end-of-month snapshots: reaching the target on row 6
    # takes six months from today, not five. Only a target already satisfied at
    # month zero has zero remaining months; ``achieved_at_month`` keeps its
    # historical 1-based series coordinate for API compatibility.
    months_to_goal = 0 if currently_achieved else achieved_at

    return EmergencyFundPlanResult(
        currently_achieved=currently_achieved,
        achieved_at_month=achieved_at,
        months_to_goal=months_to_goal,
        final_emergency_fund_balance=float(fund_balance),
        target_amount_end=float(target_end),
        monthly_data=months,
    )
