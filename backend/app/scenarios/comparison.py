"""Scenario comparison utilities.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

from typing import TypedDict
from collections.abc import Sequence

from ..core.protocols import (
    AdditionalCostsLike,
    AmortizationLike,
    ContributionLike,
    FGTSLike,
    InvestmentReturnLike,
    InvestmentTaxLike,
)
from ..domain import models as domain
from ..domain.models import ComparisonScenario as DomainComparisonScenario
from ..domain.mappers import comparison_result_to_api, enhanced_comparison_result_to_api
from ..models import ComparisonResult, EnhancedComparisonResult
from .buy import BuyScenarioSimulator
from .invest_then_buy import InvestThenBuyScenarioSimulator
from .rent_and_invest import RentAndInvestScenarioSimulator

from ..core.costs import AdditionalCostsCalculator


def compare_scenarios(
    property_value: float,
    down_payment: float,
    loan_term_years: int,
    monthly_interest_rate: float,
    loan_type: str,
    rent_value: float,
    investment_returns: Sequence[InvestmentReturnLike],
    amortizations: Sequence[AmortizationLike] | None = None,
    contributions: Sequence[ContributionLike] | None = None,
    additional_costs: AdditionalCostsLike | None = None,
    inflation_rate: float | None = None,
    rent_inflation_rate: float | None = None,
    property_appreciation_rate: float | None = None,
    invest_loan_difference: bool = False,
    fixed_monthly_investment: float | None = None,
    fixed_investment_start_month: int = 1,
    rent_reduces_investment: bool = False,
    monthly_external_savings: float | None = None,
    invest_external_surplus: bool = False,
    investment_tax: InvestmentTaxLike | None = None,
    fgts: FGTSLike | None = None,
    total_savings: float | None = None,
) -> ComparisonResult:
    """Compare different scenarios for housing decisions."""
    result = _compare_scenarios_domain(
        property_value=property_value,
        down_payment=down_payment,
        loan_term_years=loan_term_years,
        monthly_interest_rate=monthly_interest_rate,
        loan_type=loan_type,
        rent_value=rent_value,
        investment_returns=investment_returns,
        amortizations=amortizations,
        contributions=contributions,
        additional_costs=additional_costs,
        inflation_rate=inflation_rate,
        rent_inflation_rate=rent_inflation_rate,
        property_appreciation_rate=property_appreciation_rate,
        invest_loan_difference=invest_loan_difference,
        fixed_monthly_investment=fixed_monthly_investment,
        fixed_investment_start_month=fixed_investment_start_month,
        rent_reduces_investment=rent_reduces_investment,
        monthly_external_savings=monthly_external_savings,
        invest_external_surplus=invest_external_surplus,
        investment_tax=investment_tax,
        fgts=fgts,
        total_savings=total_savings,
    )
    return comparison_result_to_api(result)


def _compare_scenarios_domain(
    *,
    property_value: float,
    down_payment: float,
    loan_term_years: int,
    monthly_interest_rate: float,
    loan_type: str,
    rent_value: float,
    investment_returns: Sequence[InvestmentReturnLike],
    amortizations: Sequence[AmortizationLike] | None = None,
    contributions: Sequence[ContributionLike] | None = None,
    additional_costs: AdditionalCostsLike | None = None,
    inflation_rate: float | None = None,
    rent_inflation_rate: float | None = None,
    property_appreciation_rate: float | None = None,
    invest_loan_difference: bool = False,
    fixed_monthly_investment: float | None = None,
    fixed_investment_start_month: int = 1,
    rent_reduces_investment: bool = False,
    monthly_external_savings: float | None = None,
    invest_external_surplus: bool = False,
    investment_tax: InvestmentTaxLike | None = None,
    fgts: FGTSLike | None = None,
    total_savings: float | None = None,
) -> domain.ComparisonResult:
    term_months = loan_term_years * 12

    # Reporting-only: baseline initial wealth estimate (does not change simulation).
    # - cash: total_savings if provided, otherwise down_payment (legacy mode)
    # - fgts: initial FGTS balance if provided
    cash_initial = float(total_savings) if total_savings is not None else float(down_payment)
    fgts_initial = float(getattr(fgts, "initial_balance", 0.0) or 0.0) if fgts is not None else 0.0
    initial_wealth = cash_initial + fgts_initial

    buy_initial, rent_initial, invest_buy_initial = _resolve_initial_investments(
        property_value=property_value,
        down_payment=down_payment,
        additional_costs=additional_costs,
        total_savings=total_savings,
    )

    buy = BuyScenarioSimulator(
        property_value=property_value,
        down_payment=down_payment,
        loan_term_years=loan_term_years,
        monthly_interest_rate=monthly_interest_rate,
        loan_type=loan_type,
        amortizations=list(amortizations) if amortizations else None,
        property_appreciation_rate=property_appreciation_rate,
        additional_costs=additional_costs,
        inflation_rate=inflation_rate,
        fgts=fgts,
        initial_investment=buy_initial,
        investment_returns=list(investment_returns) if investment_returns else None,
        investment_tax=investment_tax,
    ).simulate_domain()

    rent = RentAndInvestScenarioSimulator(
        property_value=property_value,
        down_payment=down_payment,
        term_months=term_months,
        rent_value=rent_value,
        investment_returns=investment_returns,
        additional_costs=additional_costs,
        inflation_rate=inflation_rate,
        rent_inflation_rate=rent_inflation_rate,
        property_appreciation_rate=property_appreciation_rate,
        rent_reduces_investment=rent_reduces_investment,
        monthly_external_savings=monthly_external_savings,
        invest_external_surplus=invest_external_surplus,
        investment_tax=investment_tax,
        fgts=fgts,
        initial_investment=rent_initial,
    ).simulate_domain()

    invest_buy = InvestThenBuyScenarioSimulator(
        property_value=property_value,
        down_payment=down_payment,
        term_months=term_months,
        rent_value=rent_value,
        investment_returns=investment_returns,
        additional_costs=additional_costs,
        inflation_rate=inflation_rate,
        rent_inflation_rate=rent_inflation_rate,
        property_appreciation_rate=property_appreciation_rate,
        invest_loan_difference=invest_loan_difference,
        fixed_monthly_investment=fixed_monthly_investment,
        fixed_investment_start_month=fixed_investment_start_month,
        loan_type=loan_type,
        monthly_interest_rate=monthly_interest_rate,
        loan_amortizations=amortizations,
        contributions=contributions,
        rent_reduces_investment=rent_reduces_investment,
        monthly_external_savings=monthly_external_savings,
        invest_external_surplus=invest_external_surplus,
        investment_tax=investment_tax,
        fgts=fgts,
        initial_investment=invest_buy_initial,
    ).simulate_domain()

    scenarios = [buy, rent, invest_buy]

    # Attach wealth reporting fields to all scenarios (keeps per-scenario values comparable).
    for sc in scenarios:
        sc.initial_wealth = initial_wealth
        sc.final_wealth = sc.final_equity
        sc.net_worth_change = sc.final_equity - initial_wealth

    # Business rule (canonical): best scenario is the one that maximizes final wealth.
    # We expose this as `best_scenario` to avoid mixing two competing meanings of “best”.
    #
    # Important: `total_cost` / `net_cost` are NOT the same as “wealth change”. They include
    # principal transfers and other flows that can make a scenario look “more expensive” even
    # when it ends with higher final wealth.
    best_scenario = max(
        scenarios,
        key=lambda x: (
            float(getattr(x, "net_worth_change", 0.0) or 0.0),
            float(getattr(x, "final_equity", 0.0) or 0.0),
        ),
    ).name

    return domain.ComparisonResult(
        best_scenario=best_scenario,
        scenarios=scenarios,
    )


def enhanced_compare_scenarios(
    property_value: float,
    down_payment: float,
    loan_term_years: int,
    monthly_interest_rate: float,
    loan_type: str,
    rent_value: float,
    investment_returns: Sequence[InvestmentReturnLike],
    amortizations: Sequence[AmortizationLike] | None = None,
    contributions: Sequence[ContributionLike] | None = None,
    additional_costs: AdditionalCostsLike | None = None,
    inflation_rate: float | None = None,
    rent_inflation_rate: float | None = None,
    property_appreciation_rate: float | None = None,
    invest_loan_difference: bool = False,
    fixed_monthly_investment: float | None = None,
    fixed_investment_start_month: int = 1,
    rent_reduces_investment: bool = False,
    monthly_external_savings: float | None = None,
    invest_external_surplus: bool = False,
    investment_tax: InvestmentTaxLike | None = None,
    fgts: FGTSLike | None = None,
    total_savings: float | None = None,
) -> EnhancedComparisonResult:
    """Enhanced comparison with detailed metrics and month-by-month differences."""
    result = _enhanced_compare_scenarios_domain(
        property_value=property_value,
        down_payment=down_payment,
        loan_term_years=loan_term_years,
        monthly_interest_rate=monthly_interest_rate,
        loan_type=loan_type,
        rent_value=rent_value,
        investment_returns=investment_returns,
        amortizations=amortizations,
        contributions=contributions,
        additional_costs=additional_costs,
        inflation_rate=inflation_rate,
        rent_inflation_rate=rent_inflation_rate,
        property_appreciation_rate=property_appreciation_rate,
        invest_loan_difference=invest_loan_difference,
        fixed_monthly_investment=fixed_monthly_investment,
        fixed_investment_start_month=fixed_investment_start_month,
        rent_reduces_investment=rent_reduces_investment,
        monthly_external_savings=monthly_external_savings,
        invest_external_surplus=invest_external_surplus,
        investment_tax=investment_tax,
        fgts=fgts,
        total_savings=total_savings,
    )
    return enhanced_comparison_result_to_api(result)


def _enhanced_compare_scenarios_domain(
    *,
    property_value: float,
    down_payment: float,
    loan_term_years: int,
    monthly_interest_rate: float,
    loan_type: str,
    rent_value: float,
    investment_returns: Sequence[InvestmentReturnLike],
    amortizations: Sequence[AmortizationLike] | None = None,
    contributions: Sequence[ContributionLike] | None = None,
    additional_costs: AdditionalCostsLike | None = None,
    inflation_rate: float | None = None,
    rent_inflation_rate: float | None = None,
    property_appreciation_rate: float | None = None,
    invest_loan_difference: bool = False,
    fixed_monthly_investment: float | None = None,
    fixed_investment_start_month: int = 1,
    rent_reduces_investment: bool = False,
    monthly_external_savings: float | None = None,
    invest_external_surplus: bool = False,
    investment_tax: InvestmentTaxLike | None = None,
    fgts: FGTSLike | None = None,
    total_savings: float | None = None,
) -> domain.EnhancedComparisonResult:
    basic = _compare_scenarios_domain(
        property_value=property_value,
        down_payment=down_payment,
        loan_term_years=loan_term_years,
        monthly_interest_rate=monthly_interest_rate,
        loan_type=loan_type,
        rent_value=rent_value,
        investment_returns=investment_returns,
        amortizations=amortizations,
        contributions=contributions,
        additional_costs=additional_costs,
        inflation_rate=inflation_rate,
        rent_inflation_rate=rent_inflation_rate,
        property_appreciation_rate=property_appreciation_rate,
        invest_loan_difference=invest_loan_difference,
        fixed_monthly_investment=fixed_monthly_investment,
        fixed_investment_start_month=fixed_investment_start_month,
        rent_reduces_investment=rent_reduces_investment,
        monthly_external_savings=monthly_external_savings,
        invest_external_surplus=invest_external_surplus,
        investment_tax=investment_tax,
        fgts=fgts,
        total_savings=total_savings,
    )

    best_cost = min(s.total_cost for s in basic.scenarios)
    metrics_calculator = _DomainMetricsCalculator(
        down_payment=down_payment,
        fgts=fgts,
        best_cost=best_cost,
    )

    enhanced_scenarios = [
        domain.EnhancedComparisonScenario(
            name=sc.name,
            total_cost=sc.total_cost,
            final_equity=sc.final_equity,
            initial_wealth=sc.initial_wealth,
            final_wealth=sc.final_wealth,
            net_worth_change=sc.net_worth_change,
            total_consumption=sc.total_consumption,
            total_outflows=sc.total_outflows,
            net_cost=sc.net_cost,
            monthly_data=sc.monthly_data,
            metrics=metrics_calculator.calculate(sc),
            purchase_breakdown=sc.purchase_breakdown,
            fgts_summary=sc.fgts_summary,
        )
        for sc in basic.scenarios
    ]

    buy_scenario = basic.scenarios[0]
    rent_scenario = basic.scenarios[1]
    invest_buy_scenario = basic.scenarios[2]
    comparative_summary = _build_comparative_summary(
        buy_scenario, rent_scenario, invest_buy_scenario
    )

    return domain.EnhancedComparisonResult(
        best_scenario=basic.best_scenario,
        scenarios=enhanced_scenarios,
        comparative_summary=comparative_summary,
    )


def _resolve_initial_investments(
    *,
    property_value: float,
    down_payment: float,
    additional_costs: AdditionalCostsLike | None,
    total_savings: float | None,
) -> tuple[float, float, float]:
    """Resolve per-scenario initial investment capital.

        Why this exists:
        - For the buy scenario, upfront transaction costs (ITBI/escritura) are paid at month 1,
            so only the remaining cash is invested as an opportunity-cost tracker.
        - For rent/invest and invest-then-buy, there is no purchase at month 1, so the full
            total_savings (if provided) should remain modeled (typically invested), otherwise
            part of the user's cash would disappear from the simulation.

        If total_savings is not provided, we assume no extra liquid cash beyond the
        down_payment is being tracked/invested (initial_investment = 0).
    """

    if total_savings is None:
        return 0.0, 0.0, 0.0

    costs = AdditionalCostsCalculator.from_input(additional_costs).calculate(
        property_value
    )
    upfront = float(costs["total_upfront"])

    buy_initial = float(total_savings) - float(down_payment) - upfront
    # Other scenarios invest/track the full cash available at month 1.
    rent_initial = float(total_savings) - float(down_payment)
    invest_buy_initial = float(total_savings) - float(down_payment)

    return max(0.0, buy_initial), max(0.0, rent_initial), max(0.0, invest_buy_initial)


class _SustainabilityMetrics(TypedDict):
    total_withdrawn: float
    avg_ratio: float | None
    months_with_burn: int | None


class _DomainMetricsCalculator:
    """Calculator for comparison metrics (domain layer)."""

    def __init__(
        self,
        *,
        down_payment: float,
        fgts: FGTSLike | None,
        best_cost: float,
    ) -> None:
        self.down_payment = down_payment
        self.fgts = fgts
        self.best_cost = best_cost

    def calculate(
        self, scenario: domain.ComparisonScenario
    ) -> domain.ComparisonMetrics:
        """Calculate metrics for a scenario."""
        total_cost_diff = scenario.total_cost - self.best_cost
        denom = abs(self.best_cost)
        total_cost_pct_diff = None if denom < 1e-6 else (total_cost_diff / denom * 100)

        monthly_costs = [_get_monthly_cost(d) for d in scenario.monthly_data]
        avg_monthly_cost = (
            (sum(monthly_costs) / len(monthly_costs)) if monthly_costs else 0.0
        )

        total_outflows = float(scenario.total_outflows or 0.0)
        roi_pct = self._calculate_roi_from_outflows(
            final_value=scenario.final_equity,
            total_outflows=total_outflows,
        )

        total_interest_rent = self._calculate_total_interest_or_rent(scenario)
        break_even_month = self._calculate_break_even_month(
            scenario,
        )
        sustainability = self._calculate_sustainability_metrics(scenario)

        total_withdrawn = sustainability["total_withdrawn"]
        avg_ratio = sustainability["avg_ratio"]
        months_with_burn = sustainability["months_with_burn"]

        roi_adjusted = self._calculate_adjusted_roi(
            scenario.final_equity,
            total_outflows,
            total_withdrawn,
        )

        return domain.ComparisonMetrics(
            total_cost_difference=total_cost_diff,
            total_cost_percentage_difference=total_cost_pct_diff,
            break_even_month=break_even_month,
            roi_percentage=roi_pct,
            roi_including_withdrawals_percentage=roi_adjusted,
            average_monthly_cost=avg_monthly_cost,
            total_interest_or_rent_paid=total_interest_rent,
            wealth_accumulation=scenario.final_equity,
            total_rent_withdrawn_from_investment=(
                total_withdrawn if total_withdrawn > 0 else None
            ),
            months_with_burn=(
                months_with_burn if (months_with_burn or 0) > 0 else None
            ),
            average_sustainable_withdrawal_ratio=avg_ratio,
        )

    def _calculate_roi_from_outflows(
        self,
        *,
        final_value: float,
        total_outflows: float,
    ) -> float:
        """Calculate ROI percentage based on total outflows.

        With the updated cost semantics, total_outflows already includes any initial
        capital allocations (down payment, initial investments, upfront costs) as part
        of month 1 outflows.
        """
        if total_outflows <= 0:
            return 0.0
        return (final_value - total_outflows) / total_outflows * 100

    def _calculate_total_interest_or_rent(
        self, scenario: domain.ComparisonScenario
    ) -> float:
        """Calculate total interest or rent paid."""
        if scenario.scenario_type == "buy":
            return sum((d.interest_payment or 0.0) for d in scenario.monthly_data)
        return sum((d.rent_paid or 0.0) for d in scenario.monthly_data)

    def _calculate_break_even_month(
        self,
        scenario: domain.ComparisonScenario,
    ) -> int | None:
        """Calculate break-even month.

        Defined as the first month where accumulated wealth is at least the
        accumulated outflows (initial + monthly costs).

        This is designed to be robust even when MonthlyRecord.cash_flow is stored
        as negative outflows.
        """
        if not scenario.monthly_data:
            return None

        cumulative_outflows = 0.0

        for d in scenario.monthly_data:
            cumulative_outflows += _get_monthly_cost(d)
            if _get_total_wealth(d) >= cumulative_outflows:
                return d.month

        return None

    def _calculate_sustainability_metrics(
        self, scenario: domain.ComparisonScenario
    ) -> _SustainabilityMetrics:
        """Calculate sustainability metrics."""
        withdrawals = [
            (d.rent_withdrawal_from_investment or 0.0) for d in scenario.monthly_data
        ]
        raw_ratios = [d.sustainable_withdrawal_ratio for d in scenario.monthly_data]
        ratios = [float(r) for r in raw_ratios if isinstance(r, (int, float))]
        burns = [d.burn_month for d in scenario.monthly_data if d.burn_month]

        total_withdrawn = sum(w for w in withdrawals if w)
        avg_ratio = sum(ratios) / len(ratios) if ratios else None
        months_with_burn = len(burns) if burns else None

        return {
            "total_withdrawn": total_withdrawn,
            "avg_ratio": avg_ratio,
            "months_with_burn": months_with_burn,
        }

    def _calculate_adjusted_roi(
        self,
        final_value: float,
        total_outflows: float,
        total_withdrawn: float,
    ) -> float | None:
        """Calculate adjusted ROI including withdrawals."""
        if total_withdrawn <= 0 or total_outflows <= 0:
            return None
        adjusted_final = final_value + total_withdrawn
        return (adjusted_final - total_outflows) / total_outflows * 100


def _build_comparative_summary(
    buy_scenario: DomainComparisonScenario,
    rent_scenario: DomainComparisonScenario,
    invest_buy_scenario: DomainComparisonScenario,
) -> dict[str, dict[str, object]]:
    """Build month-by-month comparative summary."""
    buy_by_month = {d.month: d for d in buy_scenario.monthly_data}
    rent_by_month = {d.month: d for d in rent_scenario.monthly_data}
    invest_by_month = {d.month: d for d in invest_buy_scenario.monthly_data}

    max_months = max(
        len(buy_scenario.monthly_data),
        len(rent_scenario.monthly_data),
        len(invest_buy_scenario.monthly_data),
    )

    comparative_summary: dict[str, dict[str, object]] = {}

    for month in range(1, max_months + 1):
        buy_data = buy_by_month.get(month)
        rent_data = rent_by_month.get(month)
        invest_data = invest_by_month.get(month)

        buy_cost = _get_monthly_cost(buy_data)
        rent_cost = _get_monthly_cost(rent_data)
        invest_cost = _get_monthly_cost(invest_data)

        month_comparison: dict[str, object] = {
            "month": month,
            "buy_vs_rent_difference": buy_cost - rent_cost,
            "buy_vs_rent_percentage": (
                ((buy_cost - rent_cost) / rent_cost * 100) if rent_cost > 0 else None
            ),
            "buy_monthly_cash_flow": buy_cost,
            "rent_monthly_cash_flow": rent_cost,
            "invest_monthly_cash_flow": invest_cost,
            "buy_equity": _get_value(buy_data, "equity"),
            "rent_investment_balance": _get_value(rent_data, "investment_balance"),
            "invest_equity": _get_value(invest_data, "equity"),
            "invest_investment_balance": _get_value(invest_data, "investment_balance"),
            "property_value_buy": _get_value(buy_data, "property_value"),
            "property_value_rent": _get_value(rent_data, "property_value"),
            "property_value_invest": _get_value(invest_data, "property_value"),
            "buy_total_wealth": _get_total_wealth(buy_data),
            "rent_total_wealth": _get_total_wealth(rent_data),
            "invest_total_wealth": _get_total_wealth(invest_data),
        }
        comparative_summary[f"month_{month}"] = month_comparison

    return comparative_summary


def _get_monthly_cost(row: object | None) -> float:
    """Get a positive monthly cost value for comparisons.

    Prefer total_monthly_cost (already positive). Fall back to -cash_flow.
    """
    if row is None:
        return 0.0

    total = getattr(row, "total_monthly_cost", None)
    if isinstance(total, (int, float)):
        return float(total)

    cash_flow = getattr(row, "cash_flow", None)
    if isinstance(cash_flow, (int, float)):
        return float(-cash_flow)

    return 0.0


def _get_value(
    row: object | None,
    attr: str,
    default: float = 0.0,
) -> float:
    """Get a value from a monthly record."""
    if row is None:
        return default
    val = getattr(row, attr, None)
    return float(val) if isinstance(val, (int, float)) else default


def _get_total_wealth(row: object | None) -> float:
    """Compute total wealth for a month (best-effort).

    Wealth is treated as equity + investment balance + FGTS balance (if present).
    """
    if row is None:
        return 0.0

    equity = _get_value(row, "equity")
    investment_balance = _get_value(row, "investment_balance")
    fgts_balance = _get_value(row, "fgts_balance")
    return equity + investment_balance + fgts_balance
