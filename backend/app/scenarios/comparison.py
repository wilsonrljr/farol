"""Scenario comparison utilities.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

from collections.abc import Sequence
from typing import TypedDict

from ..core.costs import AdditionalCostsCalculator
from ..core.inflation import apply_inflation
from ..core.protocols import (
    AdditionalCostsLike,
    AmortizationLike,
    ContributionLike,
    FGTSLike,
    InvestmentReturnLike,
    InvestmentTaxLike,
)
from ..domain import models as domain
from ..domain.mappers import comparison_result_to_api, enhanced_comparison_result_to_api
from ..domain.models import ComparisonScenario as DomainComparisonScenario
from ..models import ComparisonResult, EnhancedComparisonResult
from .buy import BuyScenarioSimulator
from .invest_then_buy import InvestThenBuyScenarioSimulator
from .rent_and_invest import RentAndInvestScenarioSimulator

_LEDGER_EPSILON = 0.01
_ALL_SCENARIO_TYPES = {"buy", "rent_invest", "invest_buy"}


def _filter_contributions_for_scenario(
    contributions: Sequence[ContributionLike] | None,
    scenario_type: str,
) -> list[ContributionLike] | None:
    """Return only contributions applicable to a scenario.

    Backward compatibility:
    - If a contribution has no `applies_to` attribute or it is None, it applies to all.
    - If `applies_to` is provided, it must include the current scenario_type.
    """

    if not contributions:
        return None

    filtered: list[ContributionLike] = []
    for c in contributions:
        applies_to = getattr(c, "applies_to", None)
        if applies_to is None:
            filtered.append(c)
            continue

        # Defensive: tolerate bad/empty values from non-API callers.
        if not isinstance(applies_to, list):
            filtered.append(c)
            continue

        if scenario_type in applies_to:
            filtered.append(c)

    return filtered or None


def _find_incomparability_reasons(
    *,
    contributions: Sequence[ContributionLike] | None,
    amortizations: Sequence[AmortizationLike] | None,
) -> list[str]:
    """Return resource assumptions that are not shared by every scenario.

    Cash amortizations are covered by the canonical monthly ledger: alternative
    scenarios retain the same unused income as cash. Bonus and 13th-salary
    events, however, currently exist only inside the buy simulator and therefore
    cannot support a fair cross-scenario ranking.
    """

    reasons: list[str] = []
    for contribution in contributions or []:
        applies_to = getattr(contribution, "applies_to", None)
        if applies_to is not None and set(applies_to) != _ALL_SCENARIO_TYPES:
            reasons.append(
                "Há aportes exclusivos de alguns cenários; o fluxo de recursos não é comum a todas as alternativas."
            )
            break

    for amortization in amortizations or []:
        source = getattr(amortization, "funding_source", "cash") or "cash"
        if source in {"bonus", "13_salario"}:
            reasons.append(
                "Bônus ou 13º salário foram alocados apenas à compra; falta modelar o mesmo recurso nas alternativas."
            )
            break

    return reasons


def _assess_resource_ledger(
    scenario: domain.ComparisonScenario,
    *,
    monthly_net_income: float | None,
    monthly_net_income_adjust_inflation: bool,
    inflation_rate: float | None,
    initial_wealth: float,
) -> None:
    """Attach an auditable recurring-resource ledger to one scenario.

    The simulators keep their detailed asset mechanics. This reconciliation
    layer prevents an unfunded installment or contribution from becoming
    terminal wealth: modeled income is consumed first, prior residual income can
    cover later months, and any remaining deficit becomes an explicit liability.
    """

    scenario.initial_wealth = initial_wealth
    scenario.final_assets = float(scenario.final_equity)

    if monthly_net_income is None:
        scenario.final_liabilities = None
        scenario.residual_cash_balance = None
        scenario.is_feasible = None
        scenario.first_unfunded_month = None
        scenario.total_unfunded_amount = None
        scenario.final_wealth = float(scenario.final_equity)
        scenario.net_worth_change = scenario.final_wealth - initial_wealth
        return

    residual_cash = 0.0
    cumulative_unfunded = 0.0
    cumulative_rent_paid = 0.0
    first_unfunded_month: int | None = None

    for row in sorted(scenario.monthly_data, key=lambda item: item.month):
        effective_income = float(monthly_net_income)
        if monthly_net_income_adjust_inflation and inflation_rate is not None:
            effective_income = apply_inflation(
                float(monthly_net_income), row.month, 1, inflation_rate
            )

        if row.housing_due is not None:
            housing_due = max(0.0, float(row.housing_due))
        else:
            housing_due = max(0.0, float(row.rent_due or 0.0)) + max(
                0.0, float(row.monthly_additional_costs or 0.0)
            )
        contribution = max(0.0, float(row.extra_contribution_total or 0.0))
        cash_purchase = max(0.0, float(row.cash_reserve_used_for_purchase or 0.0))
        required = housing_due + contribution + cash_purchase

        available = residual_cash + effective_income
        funded = min(required, available)
        unfunded = max(0.0, required - available)
        residual_cash = max(0.0, available - required)
        cumulative_unfunded += unfunded

        if unfunded > _LEDGER_EPSILON and first_unfunded_month is None:
            first_unfunded_month = row.month

        # Housing has priority over optional investment contributions.
        housing_paid = min(housing_due, available)
        row.effective_income = effective_income
        row.required_cash_outflow = required
        row.funded_from_resources = funded
        row.residual_cash_balance = residual_cash
        row.unfunded_amount = unfunded
        row.cumulative_unfunded_amount = cumulative_unfunded
        row.housing_paid = housing_paid
        row.housing_shortfall = max(0.0, housing_due - housing_paid)
        if row.rent_due is not None:
            row.rent_paid = min(float(row.rent_due), housing_paid)
            row.rent_shortfall = max(0.0, float(row.rent_due) - row.rent_paid)
            cumulative_rent_paid += row.rent_paid
            row.cumulative_rent_paid = cumulative_rent_paid
        elif cumulative_rent_paid > 0:
            # Preserve the running total after an invest-then-buy scenario
            # transitions from renting to ownership.
            row.cumulative_rent_paid = cumulative_rent_paid
        row.income_surplus_available = max(0.0, effective_income - housing_due)

    scenario.residual_cash_balance = residual_cash
    scenario.total_unfunded_amount = cumulative_unfunded
    scenario.final_liabilities = cumulative_unfunded
    scenario.final_assets = float(scenario.final_equity) + residual_cash
    scenario.final_wealth = scenario.final_assets - cumulative_unfunded
    scenario.net_worth_change = scenario.final_wealth - initial_wealth
    scenario.first_unfunded_month = first_unfunded_month
    scenario.is_feasible = cumulative_unfunded <= _LEDGER_EPSILON
    if not scenario.is_feasible:
        scenario.comparison_warnings.append(
            "O fluxo configurado não financia todos os custos e aportes; o déficit foi registrado como passivo."
        )


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
    monthly_net_income: float | None = None,
    monthly_net_income_adjust_inflation: bool = False,
    investment_tax: InvestmentTaxLike | None = None,
    fgts: FGTSLike | None = None,
    total_savings: float | None = None,
    continue_contributions_after_purchase: bool = True,
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
        monthly_net_income=monthly_net_income,
        monthly_net_income_adjust_inflation=monthly_net_income_adjust_inflation,
        investment_tax=investment_tax,
        fgts=fgts,
        total_savings=total_savings,
        continue_contributions_after_purchase=continue_contributions_after_purchase,
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
    monthly_net_income: float | None = None,
    monthly_net_income_adjust_inflation: bool = False,
    investment_tax: InvestmentTaxLike | None = None,
    fgts: FGTSLike | None = None,
    total_savings: float | None = None,
    continue_contributions_after_purchase: bool = True,
) -> domain.ComparisonResult:
    term_months = loan_term_years * 12

    # Reporting-only: baseline initial wealth estimate (does not change simulation).
    # - cash: total_savings if provided, otherwise down_payment (legacy mode)
    # - fgts: initial FGTS balance if provided
    cash_initial = (
        float(total_savings) if total_savings is not None else float(down_payment)
    )
    fgts_initial = (
        float(getattr(fgts, "initial_balance", 0.0) or 0.0) if fgts is not None else 0.0
    )
    initial_wealth = cash_initial + fgts_initial

    buy_initial, rent_initial, invest_buy_initial = _resolve_initial_investments(
        property_value=property_value,
        down_payment=down_payment,
        additional_costs=additional_costs,
        total_savings=total_savings,
    )

    buy_contribs = _filter_contributions_for_scenario(contributions, "buy")
    rent_contribs = _filter_contributions_for_scenario(contributions, "rent_invest")
    invest_buy_contribs = _filter_contributions_for_scenario(
        contributions, "invest_buy"
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
        contributions=buy_contribs,
        monthly_net_income=monthly_net_income,
        monthly_net_income_adjust_inflation=monthly_net_income_adjust_inflation,
    ).simulate_domain()

    rent = RentAndInvestScenarioSimulator(
        property_value=property_value,
        down_payment=down_payment,
        term_months=term_months,
        rent_value=rent_value,
        investment_returns=investment_returns,
        additional_costs=additional_costs,
        monthly_net_income_adjust_inflation=monthly_net_income_adjust_inflation,
        inflation_rate=inflation_rate,
        rent_inflation_rate=rent_inflation_rate,
        property_appreciation_rate=property_appreciation_rate,
        monthly_net_income=monthly_net_income,
        investment_tax=investment_tax,
        fgts=fgts,
        initial_investment=rent_initial,
        contributions=rent_contribs,
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
        loan_type=loan_type,
        monthly_interest_rate=monthly_interest_rate,
        contributions=invest_buy_contribs,
        continue_contributions_after_purchase=continue_contributions_after_purchase,
        monthly_net_income=monthly_net_income,
        monthly_net_income_adjust_inflation=monthly_net_income_adjust_inflation,
        investment_tax=investment_tax,
        fgts=fgts,
        initial_investment=invest_buy_initial,
    ).simulate_domain()

    scenarios = [buy, rent, invest_buy]

    # Reconcile every scenario against the same pool of recurring resources.
    for sc in scenarios:
        _assess_resource_ledger(
            sc,
            monthly_net_income=monthly_net_income,
            monthly_net_income_adjust_inflation=monthly_net_income_adjust_inflation,
            inflation_rate=inflation_rate,
            initial_wealth=initial_wealth,
        )

    incomparability_reasons = _find_incomparability_reasons(
        contributions=contributions,
        amortizations=amortizations,
    )
    warnings = list(incomparability_reasons)
    missing_resource_contract = total_savings is None or monthly_net_income is None
    if total_savings is None:
        warnings.append(
            "Informe a reserva total disponível para comparar o patrimônio inicial de forma auditável."
        )
    if monthly_net_income is None:
        warnings.append(
            "Informe a renda líquida mensal para validar viabilidade e eliminar recursos externos implícitos."
        )

    feasible = [scenario for scenario in scenarios if scenario.is_feasible is True]

    if monthly_net_income is not None and not feasible:
        comparison_status: domain.ComparisonStatus = "no_feasible_scenario"
        warnings.append(
            "Nenhum cenário cabe nos recursos mensais informados; não há vencedor válido."
        )
    elif incomparability_reasons:
        comparison_status = "incomparable"
    elif missing_resource_contract:
        comparison_status = "exploratory"
    else:
        comparison_status = "comparable"

    best: domain.ComparisonScenario | None = None
    if comparison_status == "comparable":
        best = max(
            feasible,
            key=lambda scenario: (
                float(scenario.net_worth_change or 0.0),
                float(scenario.final_wealth or 0.0),
            ),
        )

    return domain.ComparisonResult(
        best_scenario=best.name if best else None,
        best_scenario_type=best.scenario_type if best else None,
        comparison_status=comparison_status,
        scenarios=scenarios,
        warnings=warnings,
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
    monthly_net_income: float | None = None,
    monthly_net_income_adjust_inflation: bool = False,
    investment_tax: InvestmentTaxLike | None = None,
    fgts: FGTSLike | None = None,
    total_savings: float | None = None,
    continue_contributions_after_purchase: bool = True,
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
        monthly_net_income=monthly_net_income,
        monthly_net_income_adjust_inflation=monthly_net_income_adjust_inflation,
        investment_tax=investment_tax,
        fgts=fgts,
        total_savings=total_savings,
        continue_contributions_after_purchase=continue_contributions_after_purchase,
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
    monthly_net_income: float | None = None,
    monthly_net_income_adjust_inflation: bool = False,
    investment_tax: InvestmentTaxLike | None = None,
    fgts: FGTSLike | None = None,
    total_savings: float | None = None,
    continue_contributions_after_purchase: bool = True,
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
        monthly_net_income=monthly_net_income,
        monthly_net_income_adjust_inflation=monthly_net_income_adjust_inflation,
        investment_tax=investment_tax,
        fgts=fgts,
        total_savings=total_savings,
        continue_contributions_after_purchase=continue_contributions_after_purchase,
    )

    feasible_costs = [
        scenario.total_cost
        for scenario in basic.scenarios
        if scenario.is_feasible is not False
    ]
    best_cost = min(feasible_costs or [s.total_cost for s in basic.scenarios])
    metrics_calculator = _DomainMetricsCalculator(
        down_payment=down_payment,
        fgts=fgts,
        best_cost=best_cost,
    )

    enhanced_scenarios = [
        domain.EnhancedComparisonScenario(
            name=sc.name,
            scenario_type=sc.scenario_type,
            total_cost=sc.total_cost,
            final_equity=sc.final_equity,
            initial_wealth=sc.initial_wealth,
            final_wealth=sc.final_wealth,
            net_worth_change=sc.net_worth_change,
            total_consumption=sc.total_consumption,
            final_assets=sc.final_assets,
            final_liabilities=sc.final_liabilities,
            residual_cash_balance=sc.residual_cash_balance,
            is_feasible=sc.is_feasible,
            first_unfunded_month=sc.first_unfunded_month,
            total_unfunded_amount=sc.total_unfunded_amount,
            comparison_warnings=sc.comparison_warnings,
            total_outflows=sc.total_outflows,
            net_cost=sc.net_cost,
            opportunity_cost=sc.opportunity_cost,
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
        best_scenario_type=basic.best_scenario_type,
        comparison_status=basic.comparison_status,
        calculation_version=basic.calculation_version,
        warnings=basic.warnings,
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

        total_interest_rent = self._calculate_total_interest_or_rent(scenario)
        # A scenario cannot break even "against itself". Pairwise crossover is
        # available in the comparative monthly wealth series instead.
        break_even_month = None
        sustainability = self._calculate_sustainability_metrics(scenario)

        total_withdrawn = sustainability["total_withdrawn"]
        avg_ratio = sustainability["avg_ratio"]
        months_with_burn = sustainability["months_with_burn"]

        return domain.ComparisonMetrics(
            total_cost_difference=total_cost_diff,
            total_cost_percentage_difference=total_cost_pct_diff,
            break_even_month=break_even_month,
            roi_percentage=None,
            roi_including_withdrawals_percentage=None,
            average_monthly_cost=avg_monthly_cost,
            total_interest_or_rent_paid=total_interest_rent,
            wealth_accumulation=float(scenario.final_wealth or 0.0),
            total_rent_withdrawn_from_investment=(
                total_withdrawn if total_withdrawn > 0 else None
            ),
            months_with_burn=(
                months_with_burn if (months_with_burn or 0) > 0 else None
            ),
            average_sustainable_withdrawal_ratio=avg_ratio,
        )

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

    Wealth is equity + investments + FGTS + residual cash - unfunded obligations.
    """
    if row is None:
        return 0.0

    equity = _get_value(row, "equity")
    investment_balance = _get_value(row, "investment_balance")
    fgts_balance = _get_value(row, "fgts_balance")
    residual_cash = _get_value(row, "residual_cash_balance")
    unfunded = _get_value(row, "cumulative_unfunded_amount")
    return equity + investment_balance + fgts_balance + residual_cash - unfunded
