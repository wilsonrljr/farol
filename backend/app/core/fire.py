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
from .inflation import apply_inflation
from .rates import convert_interest_rate


def plan_fire(input_data: FIREPlanInput) -> FIREPlanResult:
    """Calculate the path to financial independence.

    Uses compound growth model with optional inflation adjustment for expenses.
    """
    _, monthly_return_pct = convert_interest_rate(
        annual_rate=input_data.annual_return_rate
    )
    monthly_return_multiplier = 1.0 + (monthly_return_pct / 100.0)

    portfolio = float(input_data.current_portfolio)
    swr = input_data.safe_withdrawal_rate / 100.0

    fi_month: int | None = None
    months: list[FIREPlanMonth] = []
    total_contributions = 0.0
    total_investment_returns = 0.0

    # Calculate Coast FIRE number if applicable
    coast_fire_number: float | None = None
    coast_fire_achieved: bool | None = None
    stop_contributions_month: int | None = None

    if input_data.fire_mode == "coast" and input_data.current_age is not None:
        target_age = input_data.target_retirement_age or 65
        coast_age = input_data.coast_fire_age or target_age
        months_until_retirement = (target_age - input_data.current_age) * 12
        months_until_coast = (coast_age - input_data.current_age) * 12

        # Coast FIRE: portfolio that will grow to FIRE number by retirement
        # without additional contributions
        # FV = PV x (1 + r)^n => PV = FV / (1 + r)^n
        base_expenses = float(input_data.monthly_expenses) * 12
        target_fire_number = base_expenses / swr

        # Apply inflation to get FIRE number at retirement
        if input_data.annual_inflation_rate:
            years_to_retirement = months_until_retirement / 12
            inflation_factor = (
                1 + input_data.annual_inflation_rate / 100
            ) ** years_to_retirement
            target_fire_number *= inflation_factor

        # Discount back to today
        growth_factor = monthly_return_multiplier**months_until_retirement
        coast_fire_number = (
            target_fire_number / growth_factor
            if growth_factor > 0
            else target_fire_number
        )
        stop_contributions_month = max(1, months_until_coast)

    for month in range(1, input_data.horizon_months + 1):
        # Calculate current monthly expenses (inflation-adjusted)
        current_expenses = apply_inflation(
            input_data.monthly_expenses,
            month=month,
            base_month=1,
            annual_inflation_rate=input_data.annual_inflation_rate,
        )
        annual_expenses = float(current_expenses) * 12

        # FIRE number: portfolio needed to cover expenses indefinitely
        fire_number = annual_expenses / swr

        # For Barista FIRE, reduce required portfolio by part-time income coverage
        if (
            input_data.fire_mode == "barista"
            and input_data.barista_monthly_income is not None
        ):
            barista_annual = float(input_data.barista_monthly_income) * 12
            # Apply inflation to barista income too (assume it keeps up)
            barista_annual = (
                float(
                    apply_inflation(
                        input_data.barista_monthly_income,
                        month=month,
                        base_month=1,
                        annual_inflation_rate=input_data.annual_inflation_rate,
                    )
                )
                * 12
            )
            net_annual_expenses = max(0, annual_expenses - barista_annual)
            fire_number = net_annual_expenses / swr

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
            # Stop contributions once Coast FIRE is achieved
            if coast_fire_number is not None and portfolio >= coast_fire_number:
                contribution = 0.0
                if coast_fire_achieved is None or not coast_fire_achieved:
                    coast_fire_achieved = True
            # Or stop at specified coast age
            if stop_contributions_month and month >= stop_contributions_month:
                contribution = 0.0

        # Add contribution
        portfolio += contribution
        total_contributions += contribution

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
            age = input_data.current_age + (month - 1) / 12

        months.append(
            FIREPlanMonth(
                month=month,
                age=age,
                portfolio_balance=float(portfolio),
                monthly_expenses=float(current_expenses),
                contribution=float(contribution),
                investment_return=float(investment_return),
                fire_number=float(fire_number),
                progress_percent=float(min(progress, 999.9)),  # Cap at 999.9%
                monthly_passive_income=float(monthly_passive_income),
                years_of_expenses_covered=float(min(years_covered, 999.9)),
                fi_achieved=bool(fi_achieved),
            )
        )

    # Final calculations
    final_expenses = (
        months[-1].monthly_expenses if months else input_data.monthly_expenses
    )
    final_fire_number = (
        months[-1].fire_number if months else (final_expenses * 12 / swr)
    )
    final_passive_income = (portfolio * swr) / 12

    fi_age: float | None = None
    years_to_fi: float | None = None
    months_to_fi: int | None = None

    if fi_month is not None:
        months_to_fi = fi_month - 1  # Months from now
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
        coast_fire_number=float(coast_fire_number) if coast_fire_number else None,
        coast_fire_achieved=coast_fire_achieved,
        monthly_data=months,
    )
