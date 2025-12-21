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
    FGTSLike,
    InvestmentReturnLike,
    InvestmentTaxLike,
)
from ..models import (
    ComparisonMetrics,
    ComparisonResult,
    ComparisonScenario,
    EnhancedComparisonResult,
    EnhancedComparisonScenario,
    MonthlyRecord,
)
from .buy import simulate_buy_scenario
from .invest_then_buy import simulate_invest_then_buy_scenario
from .rent_and_invest import simulate_rent_and_invest_scenario


def compare_scenarios(
    property_value: float,
    down_payment: float,
    loan_term_years: int,
    monthly_interest_rate: float,
    loan_type: str,
    rent_value: float,
    investment_returns: Sequence[InvestmentReturnLike],
    amortizations: Sequence[AmortizationLike] | None = None,
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
) -> ComparisonResult:
    """Compare different scenarios for housing decisions."""
    term_months = loan_term_years * 12

    buy_scenario = simulate_buy_scenario(
        property_value,
        down_payment,
        loan_term_years,
        monthly_interest_rate,
        loan_type,
        list(amortizations) if amortizations else None,
        investment_returns,
        additional_costs,
        inflation_rate,
        property_appreciation_rate,
        investment_tax,
        fgts,
    )

    rent_scenario = simulate_rent_and_invest_scenario(
        property_value,
        down_payment,
        term_months,
        rent_value,
        investment_returns,
        additional_costs,
        inflation_rate,
        rent_inflation_rate,
        property_appreciation_rate,
        rent_reduces_investment,
        monthly_external_savings,
        invest_external_surplus,
        investment_tax,
        fgts,
    )

    invest_buy_scenario = simulate_invest_then_buy_scenario(
        property_value,
        down_payment,
        term_months,
        investment_returns,
        rent_value,
        additional_costs,
        inflation_rate,
        rent_inflation_rate,
        property_appreciation_rate,
        invest_loan_difference,
        fixed_monthly_investment,
        fixed_investment_start_month,
        loan_type,
        monthly_interest_rate,
        amortizations,
        rent_reduces_investment,
        monthly_external_savings,
        invest_external_surplus,
        investment_tax,
        fgts,
    )

    scenarios = [buy_scenario, rent_scenario, invest_buy_scenario]
    best_scenario = min(scenarios, key=lambda x: x.total_cost).name

    return ComparisonResult(best_scenario=best_scenario, scenarios=scenarios)


def enhanced_compare_scenarios(
    property_value: float,
    down_payment: float,
    loan_term_years: int,
    monthly_interest_rate: float,
    loan_type: str,
    rent_value: float,
    investment_returns: Sequence[InvestmentReturnLike],
    amortizations: Sequence[AmortizationLike] | None = None,
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
) -> EnhancedComparisonResult:
    """Enhanced comparison with detailed metrics and month-by-month differences."""
    basic_comparison = compare_scenarios(
        property_value=property_value,
        down_payment=down_payment,
        loan_term_years=loan_term_years,
        monthly_interest_rate=monthly_interest_rate,
        loan_type=loan_type,
        rent_value=rent_value,
        investment_returns=investment_returns,
        amortizations=amortizations,
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
    )

    buy_scenario = basic_comparison.scenarios[0]
    rent_scenario = basic_comparison.scenarios[1]
    invest_buy_scenario = basic_comparison.scenarios[2]

    best_cost = min(s.total_cost for s in basic_comparison.scenarios)

    metrics_calculator = _MetricsCalculator(
        down_payment=down_payment,
        fgts=fgts,
        best_cost=best_cost,
    )

    enhanced_scenarios = [
        EnhancedComparisonScenario(
            name=scenario.name,
            total_cost=scenario.total_cost,
            final_equity=scenario.final_equity,
            total_outflows=scenario.total_outflows,
            net_cost=scenario.net_cost,
            monthly_data=scenario.monthly_data,
            metrics=metrics_calculator.calculate(scenario),
        )
        for scenario in basic_comparison.scenarios
    ]

    comparative_summary = _build_comparative_summary(
        buy_scenario, rent_scenario, invest_buy_scenario
    )

    return EnhancedComparisonResult(
        best_scenario=basic_comparison.best_scenario,
        scenarios=enhanced_scenarios,
        comparative_summary=comparative_summary,
    )


class _SustainabilityMetrics(TypedDict):
    total_withdrawn: float
    avg_ratio: float | None
    months_with_burn: int | None


class _MetricsCalculator:
    """Calculator for comparison metrics."""

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

    def calculate(self, scenario: ComparisonScenario) -> ComparisonMetrics:
        """Calculate metrics for a scenario."""
        total_cost_diff = scenario.total_cost - self.best_cost
        total_cost_pct_diff = (
            (total_cost_diff / self.best_cost * 100) if self.best_cost else 0
        )

        monthly_costs = [data.cash_flow for data in scenario.monthly_data]
        avg_monthly_cost = (
            sum(monthly_costs) / len(monthly_costs) if monthly_costs else 0
        )

        initial_investment = self._calculate_initial_investment(scenario)
        roi_pct = self._calculate_roi(scenario.final_equity, initial_investment)

        total_interest_rent = self._calculate_total_interest_or_rent(scenario)
        break_even_month = self._calculate_break_even_month(scenario)
        sustainability = self._calculate_sustainability_metrics(scenario)

        total_withdrawn = sustainability["total_withdrawn"]
        avg_ratio = sustainability["avg_ratio"]
        months_with_burn = sustainability["months_with_burn"]

        roi_adjusted = self._calculate_adjusted_roi(
            scenario.final_equity,
            initial_investment,
            total_withdrawn,
        )

        return ComparisonMetrics(
            total_cost_difference=total_cost_diff,
            total_cost_percentage_difference=total_cost_pct_diff,
            break_even_month=break_even_month,
            roi_percentage=roi_pct,
            roi_adjusted_percentage=roi_adjusted,
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

    def _calculate_initial_investment(self, scenario: ComparisonScenario) -> float:
        """Calculate initial investment for ROI calculation."""
        initial = self.down_payment + (self.fgts.initial_balance if self.fgts else 0.0)
        if scenario.scenario_type == "buy" and scenario.monthly_data:
            upfront = scenario.monthly_data[0].upfront_additional_costs or 0
            initial += upfront
        return initial

    def _calculate_roi(self, final_value: float, initial_investment: float) -> float:
        """Calculate ROI percentage."""
        if not initial_investment:
            return 0.0
        return (final_value - initial_investment) / initial_investment * 100

    def _calculate_total_interest_or_rent(self, scenario: ComparisonScenario) -> float:
        """Calculate total interest or rent paid."""
        if scenario.scenario_type == "buy":
            return sum((d.interest_payment or 0.0) for d in scenario.monthly_data)
        return sum((d.rent_paid or 0.0) for d in scenario.monthly_data)

    def _calculate_break_even_month(self, scenario: ComparisonScenario) -> int | None:
        """Calculate break-even month."""
        if scenario.total_cost == self.best_cost:
            return None

        cumulative = 0.0
        for data in scenario.monthly_data:
            cumulative += data.cash_flow
            if cumulative >= 0:
                return data.month
        return None

    def _calculate_sustainability_metrics(
        self, scenario: ComparisonScenario
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
        initial_investment: float,
        total_withdrawn: float,
    ) -> float | None:
        """Calculate adjusted ROI including withdrawals."""
        if total_withdrawn <= 0 or not initial_investment:
            return None
        adjusted_final = final_value + total_withdrawn
        return (adjusted_final - initial_investment) / initial_investment * 100


def _build_comparative_summary(
    buy_scenario: ComparisonScenario,
    rent_scenario: ComparisonScenario,
    invest_buy_scenario: ComparisonScenario,
) -> dict[str, dict[str, object]]:
    """Build month-by-month comparative summary."""
    max_months = max(
        len(buy_scenario.monthly_data),
        len(rent_scenario.monthly_data),
        len(invest_buy_scenario.monthly_data),
    )

    comparative_summary: dict[str, dict[str, object]] = {}

    for month in range(1, max_months + 1):
        buy_data = _find_month_data(buy_scenario.monthly_data, month)
        rent_data = _find_month_data(rent_scenario.monthly_data, month)
        invest_data = _find_month_data(invest_buy_scenario.monthly_data, month)

        buy_cost = _get_value(buy_data, "cash_flow")
        rent_cost = _get_value(rent_data, "cash_flow")
        invest_cost = _get_value(invest_data, "cash_flow")

        month_comparison: dict[str, object] = {
            "month": month,
            "buy_vs_rent_difference": buy_cost - rent_cost,
            "buy_vs_rent_percentage": (
                ((buy_cost - rent_cost) / rent_cost * 100) if rent_cost > 0 else 0
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
            "buy_total_wealth": _get_value(buy_data, "equity"),
            "rent_total_wealth": _get_value(rent_data, "investment_balance"),
            "invest_total_wealth": _get_value(invest_data, "equity")
            + _get_value(invest_data, "investment_balance"),
        }
        comparative_summary[f"month_{month}"] = month_comparison

    return comparative_summary


def _find_month_data(
    monthly_data: list[MonthlyRecord],
    month: int,
) -> MonthlyRecord | None:
    """Find monthly data for a specific month."""
    return next((d for d in monthly_data if d.month == month), None)


def _get_value(
    row: MonthlyRecord | None,
    attr: str,
    default: float = 0.0,
) -> float:
    """Get a value from a monthly record."""
    if row is None:
        return default
    val = getattr(row, attr, None)
    return float(val) if isinstance(val, (int, float)) else default
