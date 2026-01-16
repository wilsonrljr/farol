"""Simulation endpoints.

Routes here are intentionally thin: parsing + calling the facade in backend.app.finance.
"""

from typing import Any, cast

from fastapi import APIRouter

from ..input_normalization import resolve_monthly_interest_rate, resolve_rent_value
from ...finance import (
    simulate_price_loan,
    simulate_sac_loan,
)
from ...scenarios.comparison import compare_scenarios, enhanced_compare_scenarios
from ...models import (
    BatchComparisonInput,
    BatchComparisonResult,
    ComparisonInput,
    ComparisonResult,
    EnhancedComparisonResult,
    LoanSimulationInput,
    LoanSimulationResult,
    ScenarioMetricsSummary,
    ScenariosMetricsResult,
    SensitivityAnalysisInput,
    SensitivityAnalysisResult,
    SensitivityDataPoint,
    SensitivityScenarioResult,
    SensitivityBreakeven,
)

router = APIRouter(tags=["simulations"])


@router.post("/api/simulate-loan", response_model=LoanSimulationResult)
def simulate_loan(input_data: LoanSimulationInput) -> LoanSimulationResult:
    """Simulate a loan with either SAC or PRICE method."""
    loan_value = input_data.property_value - input_data.down_payment

    monthly_rate = resolve_monthly_interest_rate(
        annual_interest_rate=input_data.annual_interest_rate,
        monthly_interest_rate=input_data.monthly_interest_rate,
    )

    term_months = input_data.loan_term_years * 12
    amortizations = cast(Any, input_data.amortizations)

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


@router.post("/api/compare-scenarios", response_model=ComparisonResult)
def compare_housing_scenarios(input_data: ComparisonInput) -> ComparisonResult:
    """Compare buy vs rent+invest vs invest-then-buy."""
    monthly_rate = resolve_monthly_interest_rate(
        annual_interest_rate=input_data.annual_interest_rate,
        monthly_interest_rate=input_data.monthly_interest_rate,
    )

    rent_value = resolve_rent_value(
        property_value=input_data.property_value,
        rent_value=input_data.rent_value,
        rent_percentage=input_data.rent_percentage,
    )

    amortizations = cast(Any, input_data.amortizations)
    contributions = cast(Any, input_data.contributions)
    investment_tax = cast(Any, input_data.investment_tax)
    return compare_scenarios(
        property_value=input_data.property_value,
        down_payment=input_data.down_payment,
        loan_term_years=input_data.loan_term_years,
        monthly_interest_rate=monthly_rate,
        loan_type=input_data.loan_type,
        rent_value=rent_value,
        investment_returns=input_data.investment_returns,
        amortizations=amortizations,
        contributions=contributions,
        additional_costs=input_data.additional_costs,
        inflation_rate=input_data.inflation_rate,
        rent_inflation_rate=input_data.rent_inflation_rate,
        property_appreciation_rate=input_data.property_appreciation_rate,
        monthly_net_income=input_data.monthly_net_income,
        monthly_net_income_adjust_inflation=input_data.monthly_net_income_adjust_inflation,
        investment_tax=investment_tax,
        fgts=input_data.fgts,
        total_savings=input_data.total_savings,
        continue_contributions_after_purchase=input_data.continue_contributions_after_purchase,
    )


@router.post("/api/scenario-metrics", response_model=ScenariosMetricsResult)
def scenario_metrics(input_data: ComparisonInput) -> ScenariosMetricsResult:
    """Lightweight metrics summary without detailed monthly_data."""
    monthly_rate = resolve_monthly_interest_rate(
        annual_interest_rate=input_data.annual_interest_rate,
        monthly_interest_rate=input_data.monthly_interest_rate,
    )

    rent_value = resolve_rent_value(
        property_value=input_data.property_value,
        rent_value=input_data.rent_value,
        rent_percentage=input_data.rent_percentage,
    )

    amortizations = cast(Any, input_data.amortizations)
    contributions = cast(Any, input_data.contributions)
    investment_tax = cast(Any, input_data.investment_tax)
    enhanced = enhanced_compare_scenarios(
        property_value=input_data.property_value,
        down_payment=input_data.down_payment,
        loan_term_years=input_data.loan_term_years,
        monthly_interest_rate=monthly_rate,
        loan_type=input_data.loan_type,
        rent_value=rent_value,
        investment_returns=input_data.investment_returns,
        amortizations=amortizations,
        contributions=contributions,
        additional_costs=input_data.additional_costs,
        inflation_rate=input_data.inflation_rate,
        rent_inflation_rate=input_data.rent_inflation_rate,
        property_appreciation_rate=input_data.property_appreciation_rate,
        monthly_net_income=input_data.monthly_net_income,
        monthly_net_income_adjust_inflation=input_data.monthly_net_income_adjust_inflation,
        investment_tax=investment_tax,
        fgts=input_data.fgts,
        total_savings=input_data.total_savings,
        continue_contributions_after_purchase=input_data.continue_contributions_after_purchase,
    )

    summaries: list[ScenarioMetricsSummary] = []
    for sc in enhanced.scenarios:
        m = sc.metrics
        summaries.append(
            ScenarioMetricsSummary(
                name=sc.name,
                net_cost=sc.total_cost,
                final_equity=sc.final_equity,
                total_outflows=(
                    sc.total_outflows if hasattr(sc, "total_outflows") else None
                ),
                roi_percentage=m.roi_percentage,
                roi_including_withdrawals_percentage=m.roi_including_withdrawals_percentage,
                total_rent_withdrawn_from_investment=m.total_rent_withdrawn_from_investment,
                months_with_burn=m.months_with_burn,
                average_sustainable_withdrawal_ratio=m.average_sustainable_withdrawal_ratio,
            )
        )

    return ScenariosMetricsResult(
        best_scenario=enhanced.best_scenario, metrics=summaries
    )


@router.post("/api/compare-scenarios-enhanced", response_model=EnhancedComparisonResult)
def compare_housing_scenarios_enhanced(
    input_data: ComparisonInput,
) -> EnhancedComparisonResult:
    """Compare scenarios + compute extra metrics."""
    monthly_rate = resolve_monthly_interest_rate(
        annual_interest_rate=input_data.annual_interest_rate,
        monthly_interest_rate=input_data.monthly_interest_rate,
    )

    rent_value = resolve_rent_value(
        property_value=input_data.property_value,
        rent_value=input_data.rent_value,
        rent_percentage=input_data.rent_percentage,
    )

    amortizations = cast(Any, input_data.amortizations)
    contributions = cast(Any, input_data.contributions)
    investment_tax = cast(Any, input_data.investment_tax)
    return enhanced_compare_scenarios(
        property_value=input_data.property_value,
        down_payment=input_data.down_payment,
        loan_term_years=input_data.loan_term_years,
        monthly_interest_rate=monthly_rate,
        loan_type=input_data.loan_type,
        rent_value=rent_value,
        investment_returns=input_data.investment_returns,
        amortizations=amortizations,
        contributions=contributions,
        additional_costs=input_data.additional_costs,
        inflation_rate=input_data.inflation_rate,
        rent_inflation_rate=input_data.rent_inflation_rate,
        property_appreciation_rate=input_data.property_appreciation_rate,
        monthly_net_income=input_data.monthly_net_income,
        monthly_net_income_adjust_inflation=input_data.monthly_net_income_adjust_inflation,
        investment_tax=investment_tax,
        fgts=input_data.fgts,
        total_savings=input_data.total_savings,
        continue_contributions_after_purchase=input_data.continue_contributions_after_purchase,
    )


def _run_enhanced_comparison(input_data: ComparisonInput) -> EnhancedComparisonResult:
    """Internal helper to run enhanced comparison for a single input."""
    monthly_rate = resolve_monthly_interest_rate(
        annual_interest_rate=input_data.annual_interest_rate,
        monthly_interest_rate=input_data.monthly_interest_rate,
    )

    rent_value = resolve_rent_value(
        property_value=input_data.property_value,
        rent_value=input_data.rent_value,
        rent_percentage=input_data.rent_percentage,
    )

    amortizations = cast(Any, input_data.amortizations)
    contributions = cast(Any, input_data.contributions)
    investment_tax = cast(Any, input_data.investment_tax)
    return enhanced_compare_scenarios(
        property_value=input_data.property_value,
        down_payment=input_data.down_payment,
        loan_term_years=input_data.loan_term_years,
        monthly_interest_rate=monthly_rate,
        loan_type=input_data.loan_type,
        rent_value=rent_value,
        investment_returns=input_data.investment_returns,
        amortizations=amortizations,
        contributions=contributions,
        additional_costs=input_data.additional_costs,
        inflation_rate=input_data.inflation_rate,
        rent_inflation_rate=input_data.rent_inflation_rate,
        property_appreciation_rate=input_data.property_appreciation_rate,
        monthly_net_income=input_data.monthly_net_income,
        monthly_net_income_adjust_inflation=input_data.monthly_net_income_adjust_inflation,
        investment_tax=investment_tax,
        fgts=input_data.fgts,
        total_savings=input_data.total_savings,
        continue_contributions_after_purchase=input_data.continue_contributions_after_purchase,
    )


@router.post("/api/compare-scenarios-batch", response_model=BatchComparisonResult)
def compare_housing_scenarios_batch(
    input_data: BatchComparisonInput,
) -> BatchComparisonResult:
    """Compare multiple preset scenarios and rank them globally.

    This endpoint processes 2-10 presets simultaneously and provides:
    - Individual enhanced results for each preset
    - A global ranking of all scenarios across all presets
    - The globally best scenario
    """
    from ...models import (
        BatchComparisonResultItem,
        BatchComparisonRanking,
    )
    import logging

    results: list[BatchComparisonResultItem] = []
    all_rankings: list[BatchComparisonRanking] = []

    for item in input_data.items:
        try:
            enhanced_result = _run_enhanced_comparison(item.input)
            results.append(
                BatchComparisonResultItem(
                    preset_id=item.preset_id,
                    preset_name=item.preset_name,
                    result=enhanced_result,
                )
            )

            # Collect ranking data from each scenario
            for scenario in enhanced_result.scenarios:
                final_wealth = scenario.final_wealth or scenario.final_equity
                all_rankings.append(
                    BatchComparisonRanking(
                        preset_id=item.preset_id,
                        preset_name=item.preset_name,
                        scenario_name=scenario.name,
                        final_wealth=final_wealth,
                        net_worth_change=scenario.net_worth_change or 0.0,
                        total_cost=scenario.total_cost,
                        roi_percentage=scenario.metrics.roi_percentage,
                    )
                )
        except ValueError as e:
            # If a single preset fails, we still want to return results for others
            # but we should log the error
            logging.warning(
                "Failed to process preset '%s' (%s): %s",
                item.preset_name,
                item.preset_id,
                str(e),
            )
            continue

    # Sort rankings by final_wealth (descending)
    all_rankings.sort(key=lambda r: r.final_wealth, reverse=True)

    # Determine global best
    if all_rankings:
        best = all_rankings[0]
        global_best = {
            "preset_id": best.preset_id,
            "preset_name": best.preset_name,
            "scenario_name": best.scenario_name,
            "final_wealth": best.final_wealth,
        }
    else:
        global_best = {
            "preset_id": "",
            "preset_name": "",
            "scenario_name": "",
            "final_wealth": 0.0,
        }

    return BatchComparisonResult(
        results=results,
        global_best=global_best,
        ranking=all_rankings,
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
    """Get current value of a parameter from input."""
    if parameter == "investment_return_rate":
        returns = input_data.investment_returns
        if returns and len(returns) > 0:
            return returns[0].annual_rate
        return 8.0
    return getattr(input_data, parameter, 0.0) or 0.0


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
    else:
        data[parameter] = value

    return ComparisonInput.model_validate(data)


@router.post("/api/sensitivity-analysis", response_model=SensitivityAnalysisResult)
def run_sensitivity_analysis(
    input_data: SensitivityAnalysisInput,
) -> SensitivityAnalysisResult:
    """Run sensitivity analysis varying a single parameter.

    This endpoint takes a base configuration and varies one parameter
    across a specified range, returning the results for each value.
    """
    import logging
    import numpy as np

    parameter = input_data.parameter.value
    range_config = input_data.range
    base_input = input_data.base_input

    # Get base value
    base_value = _get_parameter_value(base_input, parameter)

    # Generate parameter values
    param_values = np.linspace(
        range_config.min_value, range_config.max_value, range_config.steps
    ).tolist()

    data_points: list[SensitivityDataPoint] = []
    prev_best: str | None = None
    breakeven_points: list[SensitivityBreakeven] = []

    for value in param_values:
        try:
            # Create modified input
            modified_input = _apply_parameter_value(base_input, parameter, value)

            # Run enhanced comparison
            result = _run_enhanced_comparison(modified_input)

            # Build scenario results
            scenarios: dict[str, SensitivityScenarioResult] = {}
            for scenario in result.scenarios:
                final_wealth = scenario.final_wealth or scenario.final_equity
                scenarios[scenario.name] = SensitivityScenarioResult(
                    name=scenario.name,
                    final_wealth=final_wealth,
                    total_cost=scenario.total_cost,
                    roi_percentage=scenario.metrics.roi_percentage,
                    net_worth_change=scenario.net_worth_change or 0.0,
                )

            data_point = SensitivityDataPoint(
                parameter_value=value,
                best_scenario=result.best_scenario,
                scenarios=scenarios,
            )
            data_points.append(data_point)

            # Track breakeven points
            if prev_best is not None and prev_best != result.best_scenario:
                breakeven_points.append(
                    SensitivityBreakeven(
                        parameter_value=value,
                        from_scenario=prev_best,
                        to_scenario=result.best_scenario,
                    )
                )
            prev_best = result.best_scenario

        except (ValueError, TypeError, KeyError) as e:
            logging.warning(
                "Failed to run sensitivity for %s=%s: %s", parameter, value, str(e)
            )
            continue

    if not data_points:
        raise ValueError("No valid data points could be computed")

    # Find best overall
    best_overall = max(
        data_points,
        key=lambda dp: max(s.final_wealth for s in dp.scenarios.values()),
    )

    return SensitivityAnalysisResult(
        parameter=parameter,
        parameter_label=PARAMETER_LABELS.get(parameter, parameter),
        base_value=base_value,
        data_points=data_points,
        breakeven_points=breakeven_points,
        best_overall=best_overall,
    )
