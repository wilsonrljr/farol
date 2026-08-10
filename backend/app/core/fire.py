"""FIRE (Financial Independence, Retire Early) planner.

This module calculates the path to financial independence using the
safe withdrawal rate methodology (traditionally 4% rule from the Trinity Study).

FIRE Number = Annual Expenses / Safe Withdrawal Rate
            = Annual Expenses x 25 (for 4% SWR)

Supports multiple FIRE variants:
- Traditional FIRE: Full financial independence
- Coast FIRE: Stop contributions once portfolio will grow to FIRE number by retirement
- Barista FIRE: Partial income covers some expenses, reducing required portfolio
"""

from __future__ import annotations

from ..models import (
    FIREPlanInput,
    FIREPlanMonth,
    FIREPlanResult,
)
from .rates import convert_interest_rate


def plan_fire(input_data: FIREPlanInput) -> FIREPlanResult:
    """Calculate the path to financial independence.

    All values are projected in today's money. ``annual_return_rate`` is part of
    the public contract as a *real* return, so inflating the FIRE target as well
    would count inflation twice. ``annual_inflation_rate`` remains accepted for
    backwards compatibility, but it does not change this real-value projection.

    Monthly snapshots represent the end of each projected month. The current
    state is month zero and is reflected in the summary fields (for example, an
    already-independent portfolio has ``fi_month == months_to_fi == 0``).
    """
    _, monthly_return_pct = convert_interest_rate(
        annual_rate=input_data.annual_return_rate
    )
    monthly_return_multiplier = 1.0 + (monthly_return_pct / 100.0)

    portfolio = float(input_data.current_portfolio)
    swr = input_data.safe_withdrawal_rate / 100.0

    base_monthly_expenses = float(input_data.monthly_expenses)
    required_monthly_expenses = base_monthly_expenses
    if (
        input_data.fire_mode == "barista"
        and input_data.barista_monthly_income is not None
    ):
        required_monthly_expenses = max(
            0.0,
            base_monthly_expenses - float(input_data.barista_monthly_income),
        )

    annual_expenses = base_monthly_expenses * 12
    fire_number = required_monthly_expenses * 12 / swr

    # Month zero is the current state. Keep it out of monthly_data so the
    # response shape and requested horizon remain backwards-compatible.
    fi_month: int | None = 0 if portfolio >= fire_number else None
    months: list[FIREPlanMonth] = []
    total_contributions = 0.0
    total_investment_returns = 0.0

    # Calculate Coast FIRE number if applicable
    coast_fire_number: float | None = None
    coast_fire_achieved: bool | None = None
    stop_contributions_month: int | None = None

    months_until_retirement: int | None = None
    months_until_coast: int | None = None

    if input_data.fire_mode == "coast" and input_data.current_age is not None:
        target_age = input_data.target_retirement_age or 65
        coast_age = input_data.coast_fire_age or target_age
        months_until_retirement = max(0, (target_age - input_data.current_age) * 12)
        months_until_coast = max(0, (coast_age - input_data.current_age) * 12)

        # Coast FIRE: portfolio that will grow to FIRE number by retirement
        # without additional contributions
        # FV = PV x (1 + r)^n => PV = FV / (1 + r)^n
        # Discount the real FIRE target back to today. The threshold used while
        # simulating is recalculated below as retirement approaches; comparing a
        # future portfolio with this frozen month-zero threshold would stop
        # contributions too early.
        growth_factor = monthly_return_multiplier**months_until_retirement
        coast_fire_number = (
            fire_number / growth_factor if growth_factor > 0 else fire_number
        )
        coast_fire_achieved = portfolio >= coast_fire_number
        stop_contributions_month = months_until_coast

    for month in range(1, input_data.horizon_months + 1):
        current_expenses = base_monthly_expenses
        dynamic_coast_number: float | None = None

        # Apply investment returns
        investment_return = 0.0
        if portfolio > 0 and monthly_return_multiplier != 1.0:
            new_portfolio = portfolio * monthly_return_multiplier
            investment_return = new_portfolio - portfolio
            portfolio = new_portfolio
            total_investment_returns += investment_return

        # Determine contribution based on FIRE mode
        contribution = float(input_data.monthly_contribution)

        if input_data.fire_mode == "coast":
            if months_until_retirement is not None:
                remaining_months = max(0, months_until_retirement - month)
                remaining_growth = monthly_return_multiplier**remaining_months
                dynamic_coast_number = (
                    fire_number / remaining_growth
                    if remaining_growth > 0
                    else fire_number
                )

            # Stop when the portfolio can coast from this month to retirement.
            # A configured coast age remains a hard stop for compatibility, but
            # it does not falsely mark Coast FIRE as achieved.
            if dynamic_coast_number is not None and portfolio >= dynamic_coast_number:
                contribution = 0.0
                coast_fire_achieved = True
            if (
                stop_contributions_month is not None
                and month > stop_contributions_month
            ):
                contribution = 0.0

        # Add contribution
        portfolio += contribution
        total_contributions += contribution

        if input_data.fire_mode == "coast" and months_until_retirement is not None:
            remaining_months = max(0, months_until_retirement - month)
            remaining_growth = monthly_return_multiplier**remaining_months
            dynamic_coast_number = (
                fire_number / remaining_growth if remaining_growth > 0 else fire_number
            )
            if portfolio >= dynamic_coast_number:
                coast_fire_achieved = True

        # Calculate metrics
        progress = (portfolio / fire_number * 100) if fire_number > 0 else 100.0
        monthly_passive_income = (portfolio * swr) / 12
        years_covered = (
            portfolio / annual_expenses if annual_expenses > 0 else float("inf")
        )

        fi_achieved = portfolio >= fire_number

        if fi_achieved and fi_month is None:
            fi_month = month

        # Calculate age if provided
        age: float | None = None
        if input_data.current_age is not None:
            age = input_data.current_age + month / 12

        months.append(
            FIREPlanMonth(
                month=month,
                age=age,
                portfolio_balance=float(portfolio),
                monthly_expenses=float(current_expenses),
                contribution=float(contribution),
                investment_return=float(investment_return),
                fire_number=float(fire_number),
                coast_fire_number=(
                    float(dynamic_coast_number)
                    if dynamic_coast_number is not None
                    else None
                ),
                progress_percent=float(min(progress, 999.9)),  # Cap at 999.9%
                monthly_passive_income=float(monthly_passive_income),
                years_of_expenses_covered=float(min(years_covered, 999.9)),
                fi_achieved=bool(fi_achieved),
            )
        )

    # Final calculations
    final_fire_number = months[-1].fire_number if months else fire_number
    final_passive_income = (portfolio * swr) / 12

    fi_age: float | None = None
    years_to_fi: float | None = None
    months_to_fi: int | None = None

    if fi_month is not None:
        months_to_fi = fi_month
        years_to_fi = months_to_fi / 12
        if input_data.current_age is not None:
            fi_age = input_data.current_age + years_to_fi

    return FIREPlanResult(
        fi_achieved=fi_month is not None,
        fi_month=fi_month,
        fi_age=round(fi_age, 1) if fi_age is not None else None,
        years_to_fi=round(years_to_fi, 1) if years_to_fi is not None else None,
        months_to_fi=months_to_fi,
        fire_number=float(final_fire_number),
        final_portfolio=float(portfolio),
        final_monthly_passive_income=float(final_passive_income),
        total_contributions=float(total_contributions),
        total_investment_returns=float(total_investment_returns),
        coast_fire_number=(
            float(coast_fire_number) if coast_fire_number is not None else None
        ),
        coast_fire_achieved=coast_fire_achieved,
        monthly_data=months,
    )
