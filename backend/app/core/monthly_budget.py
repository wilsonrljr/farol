"""Canonical monthly-budget allocation shared by comparison scenarios."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from .inflation import apply_inflation

if TYPE_CHECKING:
    from collections.abc import Sequence

    from .protocols import ExtraIncomeEventLike, MonthlyPlanLike


@dataclass(frozen=True)
class MonthlyBudgetAllocation:
    effective_net_income: float
    effective_non_housing_expenses: float
    extra_income: float
    housing_due: float
    housing_paid: float
    housing_shortfall: float
    disposable_surplus: float
    wealth_allocation: float
    investment_allocation: float
    extra_amortization_allocation: float
    outside_plan_amount: float
    budget_deficit: float


def _event_occurs(event: ExtraIncomeEventLike, month: int) -> bool:
    if month < event.month:
        return False
    if event.end_month is not None and month > event.end_month:
        return False
    if event.interval_months is None:
        return month == event.month
    return (month - event.month) % event.interval_months == 0


def resolve_extra_income(
    events: Sequence[ExtraIncomeEventLike] | None,
    *,
    month: int,
    inflation_rate: float | None,
) -> float:
    total = 0.0
    for event in events or []:
        if not _event_occurs(event, month):
            continue
        amount = float(event.amount)
        if event.inflation_adjust and inflation_rate is not None:
            # Event values are entered in today's money, just like salary and
            # non-housing expenses. The first future occurrence must therefore
            # already reflect the elapsed inflation since month 1.
            amount = apply_inflation(amount, month, 1, inflation_rate)
        total += amount
    return total


def allocate_monthly_budget(
    plan: MonthlyPlanLike,
    *,
    month: int,
    housing_due: float,
    inflation_rate: float | None,
    extra_income_events: Sequence[ExtraIncomeEventLike] | None = None,
    financed: bool = False,
    outstanding_balance: float | None = None,
) -> MonthlyBudgetAllocation:
    """Allocate one month's income without creating funded assets from deficits.

    The same wealth-building percentage is applied after mandatory non-housing
    and housing costs in every scenario. Money outside the plan is consumption,
    not cash accumulation.
    """

    net_income = float(plan.net_income)
    non_housing = float(plan.non_housing_expenses)
    if plan.adjust_for_inflation and inflation_rate is not None:
        net_income = apply_inflation(net_income, month, 1, inflation_rate)
        non_housing = apply_inflation(non_housing, month, 1, inflation_rate)

    extra_income = resolve_extra_income(
        extra_income_events,
        month=month,
        inflation_rate=inflation_rate,
    )
    available_income = max(0.0, net_income + extra_income)
    mandatory_costs = max(0.0, non_housing) + max(0.0, housing_due)
    surplus = max(0.0, available_income - mandatory_costs)
    deficit = max(0.0, mandatory_costs - available_income)
    income_after_non_housing = max(0.0, available_income - max(0.0, non_housing))
    housing_paid = min(max(0.0, housing_due), income_after_non_housing)
    wealth = surplus * (float(plan.wealth_allocation_percentage) / 100.0)
    outside = max(0.0, surplus - wealth)

    amortization = 0.0
    if financed and wealth > 0:
        requested = wealth * (
            float(plan.financed_purchase.amortization_percentage) / 100.0
        )
        if outstanding_balance is not None:
            requested = min(requested, max(0.0, float(outstanding_balance)))
        amortization = requested

    investment = max(0.0, wealth - amortization)
    return MonthlyBudgetAllocation(
        effective_net_income=net_income,
        effective_non_housing_expenses=non_housing,
        extra_income=extra_income,
        housing_due=max(0.0, housing_due),
        housing_paid=housing_paid,
        housing_shortfall=max(0.0, housing_due - housing_paid),
        disposable_surplus=surplus,
        wealth_allocation=wealth,
        investment_allocation=investment,
        extra_amortization_allocation=amortization,
        outside_plan_amount=outside,
        budget_deficit=deficit,
    )
