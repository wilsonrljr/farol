"""Stress test utilities.

This module provides a simple, deterministic cashflow stress test that estimates
how long an emergency fund can sustain a household under an income shock.

It is intentionally independent from the housing scenarios.
"""

from __future__ import annotations

from ..models import StressTestInput, StressTestMonth, StressTestResult
from .inflation import apply_inflation
from .rates import convert_interest_rate


def run_stress_test(input_data: StressTestInput) -> StressTestResult:
    """Run a month-by-month stress test.

    Rules:
    - Expenses can be inflated from month 1 using annual_inflation_rate.
    - Emergency fund can yield monthly returns based on annual_emergency_fund_yield_rate.
    - Monthly net cashflow is added to/subtracted from the emergency fund.
    - Once the fund hits zero, deficits become uncovered_deficit.

    Returns:
        StressTestResult with monthly series and summary fields.
    """

    _, monthly_yield_pct = convert_interest_rate(
        annual_rate=input_data.annual_emergency_fund_yield_rate or 0.0
    )
    monthly_yield_multiplier = 1.0 + (monthly_yield_pct / 100.0)

    fund_balance = float(input_data.initial_emergency_fund)
    min_balance = fund_balance
    depleted_at: int | None = None
    total_uncovered_deficit = 0.0

    months: list[StressTestMonth] = []

    shock_start = input_data.shock_start_month
    shock_end = (
        shock_start + input_data.shock_duration_months - 1
        if input_data.shock_duration_months > 0
        else 0
    )

    for month in range(1, input_data.horizon_months + 1):
        # Apply yield before cashflow (closer to real-world end-of-month accounting).
        if fund_balance > 0 and monthly_yield_multiplier != 1.0:
            fund_balance *= monthly_yield_multiplier

        in_shock = shock_start <= month <= shock_end
        income = input_data.monthly_income
        if in_shock and input_data.income_drop_percentage > 0:
            income *= 1.0 - (input_data.income_drop_percentage / 100.0)

        expenses = apply_inflation(
            input_data.monthly_expenses,
            month=month,
            base_month=1,
            annual_inflation_rate=input_data.annual_inflation_rate,
        )

        net = income - expenses
        uncovered = 0.0

        if net >= 0:
            fund_balance += net
        else:
            need = -net
            if fund_balance >= need:
                fund_balance -= need
            else:
                uncovered = need - fund_balance
                total_uncovered_deficit += uncovered
                fund_balance = 0.0

        depleted = fund_balance <= 0.0
        if depleted and depleted_at is None:
            depleted_at = month

        min_balance = min(min_balance, fund_balance)

        months.append(
            StressTestMonth(
                month=month,
                income=float(income),
                expenses=float(expenses),
                net_cash_flow=float(net),
                emergency_fund_balance=float(fund_balance),
                depleted=depleted,
                uncovered_deficit=float(uncovered),
            )
        )

    if depleted_at is None:
        months_survived = input_data.horizon_months
    else:
        # Count months up to and including depletion month, but keep 0 if depleted at month 1.
        months_survived = max(0, depleted_at - 1)

    return StressTestResult(
        months_survived=months_survived,
        depleted_at_month=depleted_at,
        final_emergency_fund_balance=float(fund_balance),
        min_emergency_fund_balance=float(min_balance),
        total_uncovered_deficit=float(total_uncovered_deficit),
        monthly_data=months,
    )
