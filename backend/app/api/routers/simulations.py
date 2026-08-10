"""Simulation endpoints.

Routes here are intentionally thin: parsing + calling the facade in backend.app.finance.
"""

import math
from typing import Any, cast

from fastapi import APIRouter
from pydantic import ValidationError

from ...core.rates import convert_interest_rate
from ...finance import (
    simulate_price_loan,
    simulate_sac_loan,
)
from ...models import (
    BatchComparisonInput,
    BatchComparisonRanking,
    BatchComparisonResult,
    BatchComparisonResultItem,
    ComparisonInput,
    ComparisonResult,
    EnhancedComparisonResult,
    LoanSimulationInput,
    LoanSimulationResult,
    ScenarioMetricsSummary,
    ScenariosMetricsResult,
    SensitivityAnalysisInput,
    SensitivityAnalysisResult,
    SensitivityBreakeven,
    SensitivityDataPoint,
    SensitivityScenarioResult,
)
from ...scenarios.comparison import compare_scenarios, enhanced_compare_scenarios
from ..errors import PublicInputError
from ..input_normalization import resolve_monthly_interest_rate, resolve_rent_value

router = APIRouter(tags=["simulations"])


def _batch_resource_baseline(input_data: ComparisonInput) -> tuple[object, ...]:
    """Return the exogenous resource/horizon baseline used for global ranking.

    Local comparisons may be valid independently, but terminal wealth from two
    presets cannot be ordered when one starts richer, receives more income/FGTS,
    or runs for a different horizon.
    """

    fgts = input_data.fgts
    plan = input_data.monthly_plan
    inflation_changes_resources = bool(plan is not None and plan.adjust_for_inflation)
    inflation_changes_resources = inflation_changes_resources or any(
        event.inflation_adjust for event in (input_data.extra_income_events or [])
    )
    return (
        input_data.comparison_horizon_years or input_data.loan_term_years,
        input_data.total_savings,
        plan.net_income if plan is not None else None,
        plan.non_housing_expenses if plan is not None else None,
        plan.adjust_for_inflation if plan is not None else None,
        plan.wealth_allocation_percentage if plan is not None else None,
        input_data.inflation_rate if inflation_changes_resources else None,
        tuple(
            sorted(
                (
                    float(event.amount),
                    int(event.month),
                    int(event.interval_months or 0),
                    int(event.end_month or 0),
                    bool(event.inflation_adjust),
                )
                for event in (input_data.extra_income_events or [])
            )
        ),
        fgts.initial_balance if fgts is not None else 0.0,
        fgts.monthly_contribution if fgts is not None else 0.0,
        fgts.annual_yield_rate if fgts is not None else 0.0,
    )


def build_comparison_kwargs(input_data: ComparisonInput) -> dict[str, Any]:
    """Build the canonical domain arguments for every comparison surface.

    API responses, batch/sensitivity and exports must all pass through this
    function. Keeping normalization and optional flags here prevents a router
    from silently falling back to a domain default.
    """
    # Interest and amortization method have no economic meaning when the cash
    # down payment plus eligible month-1 FGTS covers the full property price.
    # Keep a neutral internal value so outright-purchase requests do not need to
    # invent a financing rate merely to satisfy the domain constructor.
    if input_data.initial_financed_principal <= 0:
        monthly_rate = 0.0
    else:
        monthly_rate = resolve_monthly_interest_rate(
            annual_interest_rate=input_data.annual_interest_rate,
            monthly_interest_rate=input_data.monthly_interest_rate,
        )
    # The domain simulator still has a single concrete constructor for financed
    # and outright purchases. These neutral fallbacks are internal only and are
    # never used economically when initial_financed_principal is zero.
    loan_term_years = input_data.loan_term_years or input_data.comparison_horizon_years
    if loan_term_years is None:  # Defensive; ComparisonInput rejects this shape.
        raise PublicInputError("Comparison horizon is required")
    loan_type = input_data.loan_type or "SAC"
    rent_value = resolve_rent_value(
        property_value=input_data.property_value,
        rent_value=input_data.rent_value,
        rent_percentage=input_data.rent_percentage,
    )
    return {
        "property_value": input_data.property_value,
        "down_payment": input_data.down_payment,
        "loan_term_years": loan_term_years,
        "comparison_horizon_years": input_data.comparison_horizon_years,
        "monthly_interest_rate": monthly_rate,
        "loan_type": loan_type,
        "rent_value": rent_value,
        "investment_returns": input_data.investment_returns,
        "amortizations": None,
        "contributions": None,
        "additional_costs": input_data.additional_costs,
        "inflation_rate": input_data.inflation_rate,
        "rent_inflation_rate": input_data.rent_inflation_rate,
        "property_appreciation_rate": input_data.property_appreciation_rate,
        "monthly_net_income": None,
        "monthly_net_income_adjust_inflation": False,
        "monthly_plan": cast("Any", input_data.monthly_plan),
        "extra_income_events": cast("Any", input_data.extra_income_events),
        "investment_tax": cast("Any", input_data.investment_tax),
        "fgts": input_data.fgts,
        "total_savings": input_data.total_savings,
        "continue_contributions_after_purchase": True,
    }


def run_basic_comparison(input_data: ComparisonInput) -> ComparisonResult:
    return compare_scenarios(**build_comparison_kwargs(input_data))


def run_enhanced_comparison(input_data: ComparisonInput) -> EnhancedComparisonResult:
    return enhanced_compare_scenarios(**build_comparison_kwargs(input_data))


@router.post(
    "/api/simulate-loan",
    response_model=LoanSimulationResult,
    response_model_exclude_none=True,
)
def simulate_loan(input_data: LoanSimulationInput) -> LoanSimulationResult:
    """Simulate a loan with either SAC or PRICE method."""
    loan_value = input_data.property_value - input_data.down_payment

    monthly_rate = resolve_monthly_interest_rate(
        annual_interest_rate=input_data.annual_interest_rate,
        monthly_interest_rate=input_data.monthly_interest_rate,
    )

    term_months = input_data.loan_term_years * 12
    amortizations = cast("Any", input_data.amortizations)

    if input_data.loan_type == "SAC":
        return simulate_sac_loan(
            loan_value,
            term_months,
            monthly_rate,
            amortizations,
            input_data.inflation_rate,
        )

    return simulate_price_loan(
        loan_value,
        term_months,
        monthly_rate,
        amortizations,
        input_data.inflation_rate,
    )


@router.post(
    "/api/compare-scenarios",
    response_model=ComparisonResult,
    response_model_exclude_none=True,
)
def compare_housing_scenarios(input_data: ComparisonInput) -> ComparisonResult:
    """Compare buy vs rent+invest vs invest-then-buy."""
    return run_basic_comparison(input_data)


@router.post(
    "/api/scenario-metrics",
    response_model=ScenariosMetricsResult,
    response_model_exclude_none=True,
)
def scenario_metrics(input_data: ComparisonInput) -> ScenariosMetricsResult:
    """Lightweight metrics summary without detailed monthly_data."""
    enhanced = run_enhanced_comparison(input_data)

    summaries: list[ScenarioMetricsSummary] = []
    for sc in enhanced.scenarios:
        m = sc.metrics
        summaries.append(
            ScenarioMetricsSummary(
                name=sc.name,
                scenario_type=sc.scenario_type,
                net_cost=sc.net_cost if sc.net_cost is not None else sc.total_cost,
                final_equity=sc.final_equity,
                final_wealth=sc.final_wealth,
                net_worth_change=sc.net_worth_change,
                is_feasible=sc.is_feasible,
                total_unfunded_amount=sc.total_unfunded_amount,
                total_outflows=sc.total_outflows,
                roi_percentage=m.roi_percentage,
                roi_including_withdrawals_percentage=m.roi_including_withdrawals_percentage,
                total_rent_withdrawn_from_investment=m.total_rent_withdrawn_from_investment,
                months_with_burn=m.months_with_burn,
                average_sustainable_withdrawal_ratio=m.average_sustainable_withdrawal_ratio,
            )
        )

    return ScenariosMetricsResult(
        best_scenario=enhanced.best_scenario,
        best_scenario_type=enhanced.best_scenario_type,
        comparison_status=enhanced.comparison_status,
        warnings=enhanced.warnings,
        metrics=summaries,
    )


@router.post(
    "/api/compare-scenarios-enhanced",
    response_model=EnhancedComparisonResult,
    response_model_exclude_none=True,
)
def compare_housing_scenarios_enhanced(
    input_data: ComparisonInput,
) -> EnhancedComparisonResult:
    """Compare scenarios + compute extra metrics."""
    return run_enhanced_comparison(input_data)


@router.post(
    "/api/compare-scenarios-batch",
    response_model=BatchComparisonResult,
    response_model_exclude_none=True,
)
def compare_housing_scenarios_batch(
    input_data: BatchComparisonInput,
) -> BatchComparisonResult:
    """Compare multiple preset scenarios and rank them globally.

    This endpoint processes 2-10 presets simultaneously and provides:
    - Individual enhanced results for each preset
    - A global ranking of all scenarios across all presets
    - The globally best scenario
    """
    results: list[BatchComparisonResultItem] = []
    all_rankings: list[BatchComparisonRanking] = []
    warnings: list[str] = []
    comparable_results = 0
    ranking_baselines: set[tuple[object, ...]] = set()

    for item in input_data.items:
        # Batch is intentionally atomic with the current response model: it has
        # no per-item error field, so silently dropping a failed preset would be
        # indistinguishable from success.
        enhanced_result = run_enhanced_comparison(item.input)
        results.append(
            BatchComparisonResultItem(
                preset_id=item.preset_id,
                preset_name=item.preset_name,
                result=enhanced_result,
            )
        )

        warnings.extend(
            f"{item.preset_name}: {warning}" for warning in enhanced_result.warnings
        )

        # Exploratory/incomparable results remain visible, but only an
        # authoritative comparison may participate in the global ranking.
        if (
            enhanced_result.comparison_status != "comparable"
            or enhanced_result.best_scenario is None
        ):
            warnings.append(
                f"{item.preset_name}: excluded from ranking "
                f"({enhanced_result.comparison_status})"
            )
            continue
        comparable_results += 1
        ranking_baselines.add(_batch_resource_baseline(item.input))

        for scenario in enhanced_result.scenarios:
            if getattr(scenario, "is_feasible", None) is False:
                continue
            final_wealth = (
                scenario.final_wealth
                if scenario.final_wealth is not None
                else scenario.final_equity
            )
            if final_wealth is None:
                continue
            all_rankings.append(
                BatchComparisonRanking(
                    preset_id=item.preset_id,
                    preset_name=item.preset_name,
                    scenario_name=scenario.name,
                    scenario_type=scenario.scenario_type,
                    final_wealth=final_wealth,
                    net_worth_change=(
                        scenario.net_worth_change
                        if scenario.net_worth_change is not None
                        else 0.0
                    ),
                    total_cost=scenario.total_cost,
                    roi_percentage=scenario.metrics.roi_percentage,
                )
            )

    baselines_are_comparable = len(ranking_baselines) <= 1
    if not baselines_are_comparable:
        # Do not call a result "global" when presets have different starting
        # resources or observation periods. Local results remain available.
        all_rankings = []
        warnings.append(
            "Global ranking omitted: presets use different initial resources, recurring resources, FGTS flows, or horizons."
        )

    # Sort rankings by final_wealth (descending)
    all_rankings.sort(key=lambda r: r.final_wealth, reverse=True)

    global_best = all_rankings[0] if all_rankings else None
    if not baselines_are_comparable:
        comparison_status = "no_authoritative_result"
    elif comparable_results == len(results) and global_best is not None:
        comparison_status = "ranked"
    elif comparable_results > 0:
        comparison_status = "partial"
    else:
        comparison_status = "no_authoritative_result"

    # Preserve order while removing repeated engine warnings.
    warnings = list(dict.fromkeys(warnings))

    return BatchComparisonResult(
        results=results,
        global_best=global_best,
        ranking=all_rankings,
        comparison_status=comparison_status,
        warnings=warnings,
    )


# Parameter labels for human-readable output
PARAMETER_LABELS = {
    "annual_interest_rate": "Taxa de Juros (a.a.)",
    "investment_return_rate": "Retorno do Investimento (a.a.)",
    "down_payment": "Entrada",
    "property_value": "Valor do Imóvel",
    "rent_value": "Aluguel Mensal",
    "inflation_rate": "Inflação (a.a.)",
    "property_appreciation_rate": "Valorização do Imóvel (a.a.)",
    "loan_term_years": "Prazo do Financiamento",
}


def _get_parameter_value(input_data: ComparisonInput, parameter: str) -> float:
    """Get the effective base value in the sensitivity parameter's unit.

    Several public inputs have mutually exclusive representations or domain
    fallbacks. Returning the raw nullable field would place the "current value"
    marker at zero even though the simulation is using a non-zero value.
    """
    if parameter == "investment_return_rate":
        returns = input_data.investment_returns
        value = returns[0].annual_rate if returns else 8.0
    elif parameter == "annual_interest_rate":
        if input_data.annual_interest_rate is not None:
            value = input_data.annual_interest_rate
        elif input_data.monthly_interest_rate is not None:
            value, _ = convert_interest_rate(
                monthly_rate=input_data.monthly_interest_rate
            )
        else:
            value = 0.0
    elif parameter == "rent_value":
        value = resolve_rent_value(
            property_value=input_data.property_value,
            rent_value=input_data.rent_value,
            rent_percentage=input_data.rent_percentage,
        )
    elif parameter == "property_appreciation_rate":
        if input_data.property_appreciation_rate is not None:
            value = input_data.property_appreciation_rate
        else:
            value = input_data.inflation_rate or 0.0
    else:
        value = getattr(input_data, parameter, 0.0) or 0.0
    return float(value)


def _apply_parameter_value(
    input_data: ComparisonInput, parameter: str, value: float
) -> ComparisonInput:
    """Create a copy of input with modified parameter value."""
    data = input_data.model_dump()

    if parameter == "investment_return_rate":
        # Modify first investment return rate
        if data.get("investment_returns") and len(data["investment_returns"]) > 0:
            data["investment_returns"][0]["annual_rate"] = value
        else:
            data["investment_returns"] = [
                {"start_month": 1, "end_month": None, "annual_rate": value}
            ]
    elif parameter == "loan_term_years":
        data[parameter] = int(value)
    elif parameter == "annual_interest_rate":
        data[parameter] = value
        data["monthly_interest_rate"] = None
    elif parameter == "rent_value":
        data[parameter] = value
        data["rent_percentage"] = None
    else:
        data[parameter] = value

    try:
        return ComparisonInput.model_validate(data)
    except ValidationError as exc:
        first_error = exc.errors(include_url=False)[0]
        path = ".".join(str(part) for part in first_error.get("loc", ()))
        message = str(first_error.get("msg", "invalid value"))
        detail = f"{path}: {message}" if path else message
        raise PublicInputError(detail) from exc


def _sensitivity_values(
    parameter: str,
    min_value: float,
    max_value: float,
    steps: int,
) -> list[float]:
    if not math.isfinite(min_value) or not math.isfinite(max_value):
        raise PublicInputError("Sensitivity range values must be finite")
    if min_value > max_value:
        raise PublicInputError("Sensitivity min_value must be <= max_value")

    if parameter == "loan_term_years":
        if not min_value.is_integer() or not max_value.is_integer():
            raise PublicInputError(
                "loan_term_years sensitivity bounds must be integers"
            )
        raw = [
            min_value + (max_value - min_value) * index / (steps - 1)
            for index in range(steps)
        ]
        values = [float(round(value)) for value in raw]
        if len(set(values)) != steps:
            raise PublicInputError(
                "loan_term_years range is too narrow for the requested number of steps"
            )
        return values

    return [
        min_value + (max_value - min_value) * index / (steps - 1)
        for index in range(steps)
    ]


@router.post(
    "/api/sensitivity-analysis",
    response_model=SensitivityAnalysisResult,
    response_model_exclude_none=True,
)
def run_sensitivity_analysis(
    input_data: SensitivityAnalysisInput,
) -> SensitivityAnalysisResult:
    """Run sensitivity analysis varying a single parameter.

    This endpoint takes a base configuration and varies one parameter
    across a specified range, returning the results for each value.
    """
    parameter = input_data.parameter.value
    range_config = input_data.range
    base_input = input_data.base_input

    if (
        parameter == "investment_return_rate"
        and len(base_input.investment_returns) != 1
    ):
        raise PublicInputError(
            "investment_return_rate sensitivity requires exactly one return range; select a period explicitly before varying a multi-period curve"
        )

    # Get base value
    base_value = _get_parameter_value(base_input, parameter)

    # Generate parameter values
    param_values = _sensitivity_values(
        parameter,
        range_config.min_value,
        range_config.max_value,
        range_config.steps,
    )

    data_points: list[SensitivityDataPoint] = []
    prev_best: str | None = None
    breakeven_points: list[SensitivityBreakeven] = []
    warnings: list[str] = []
    comparable_points = 0

    for value in param_values:
        modified_input = _apply_parameter_value(base_input, parameter, value)
        effective_value = (
            float(modified_input.loan_term_years)
            if parameter == "loan_term_years"
            else value
        )
        result = run_enhanced_comparison(modified_input)

        scenarios: dict[str, SensitivityScenarioResult] = {}
        for scenario in result.scenarios:
            final_wealth = (
                scenario.final_wealth
                if scenario.final_wealth is not None
                else scenario.final_equity
            )
            if final_wealth is None:
                continue
            scenarios[scenario.name] = SensitivityScenarioResult(
                name=scenario.name,
                scenario_type=scenario.scenario_type,
                final_wealth=final_wealth,
                total_cost=scenario.total_cost,
                roi_percentage=scenario.metrics.roi_percentage,
                net_worth_change=(
                    scenario.net_worth_change
                    if scenario.net_worth_change is not None
                    else 0.0
                ),
                is_feasible=scenario.is_feasible,
            )

        if not scenarios:
            raise PublicInputError(
                f"Sensitivity point {parameter}={effective_value:g} has no viable scenarios"
            )

        data_point = SensitivityDataPoint(
            parameter_value=effective_value,
            best_scenario=result.best_scenario,
            best_scenario_type=result.best_scenario_type,
            comparison_status=result.comparison_status,
            warnings=result.warnings,
            scenarios=scenarios,
        )
        data_points.append(data_point)

        warnings.extend(
            f"{parameter}={effective_value:g}: {warning}" for warning in result.warnings
        )

        if (
            result.comparison_status == "comparable"
            and result.best_scenario is not None
        ):
            comparable_points += 1
            if prev_best is not None and prev_best != result.best_scenario:
                breakeven_points.append(
                    SensitivityBreakeven(
                        parameter_value=effective_value,
                        from_scenario=prev_best,
                        to_scenario=result.best_scenario,
                    )
                )
            prev_best = result.best_scenario
        else:
            warnings.append(
                f"{parameter}={effective_value:g}: no authoritative winner "
                f"({result.comparison_status})"
            )
            prev_best = None

    if not data_points:
        raise PublicInputError("No valid data points could be computed")

    comparable_data_points = [
        point
        for point in data_points
        if point.comparison_status == "comparable"
        and point.best_scenario is not None
        and point.best_scenario in point.scenarios
    ]
    best_overall = (
        max(
            comparable_data_points,
            key=lambda point: point.scenarios[point.best_scenario].final_wealth,
        )
        if comparable_data_points
        else None
    )
    if parameter == "loan_term_years" and base_input.comparison_horizon_years is None:
        # Backward-compatible inputs still derive the comparison horizon from
        # the financing term. Final wealth at year 1 and year 30 is not a
        # common-time ranking, so preserve the local points but suppress
        # cross-point winner/break-even claims. With an explicit horizon, the
        # observation period stays fixed and the aggregate comparison is valid.
        best_overall = None
        breakeven_points = []
        comparison_status = "no_authoritative_result"
        warnings.append(
            "Aggregate ranking omitted: varying loan_term_years also changes the simulation horizon."
        )
    elif comparable_points == len(data_points) and best_overall is not None:
        comparison_status = "ranked"
    elif comparable_points > 0:
        comparison_status = "partial"
    else:
        comparison_status = "no_authoritative_result"
    warnings = list(dict.fromkeys(warnings))

    return SensitivityAnalysisResult(
        parameter=parameter,
        parameter_label=PARAMETER_LABELS.get(parameter, parameter),
        base_value=base_value,
        data_points=data_points,
        breakeven_points=breakeven_points,
        best_overall=best_overall,
        comparison_status=comparison_status,
        warnings=warnings,
    )
