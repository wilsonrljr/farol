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

    if input_data.loan_type == "SAC":
        return simulate_sac_loan(
            loan_value,
            term_months,
            monthly_rate,
            input_data.amortizations,
            input_data.inflation_rate,
        )

    return simulate_price_loan(
        loan_value,
        term_months,
        monthly_rate,
        input_data.amortizations,
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
        invest_loan_difference=input_data.invest_loan_difference,
        fixed_monthly_investment=input_data.fixed_monthly_investment,
        fixed_investment_start_month=input_data.fixed_investment_start_month or 1,
        rent_reduces_investment=input_data.rent_reduces_investment,
        monthly_external_savings=input_data.monthly_external_savings,
        invest_external_surplus=input_data.invest_external_surplus,
        investment_tax=investment_tax,
        fgts=input_data.fgts,
        total_savings=input_data.total_savings,
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
        invest_loan_difference=input_data.invest_loan_difference,
        fixed_monthly_investment=input_data.fixed_monthly_investment,
        fixed_investment_start_month=input_data.fixed_investment_start_month or 1,
        rent_reduces_investment=input_data.rent_reduces_investment,
        monthly_external_savings=input_data.monthly_external_savings,
        invest_external_surplus=input_data.invest_external_surplus,
        investment_tax=investment_tax,
        fgts=input_data.fgts,
        total_savings=input_data.total_savings,
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
        invest_loan_difference=input_data.invest_loan_difference,
        fixed_monthly_investment=input_data.fixed_monthly_investment,
        fixed_investment_start_month=input_data.fixed_investment_start_month or 1,
        rent_reduces_investment=input_data.rent_reduces_investment,
        monthly_external_savings=input_data.monthly_external_savings,
        invest_external_surplus=input_data.invest_external_surplus,
        investment_tax=investment_tax,
        fgts=input_data.fgts,
        total_savings=input_data.total_savings,
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
        invest_loan_difference=input_data.invest_loan_difference,
        fixed_monthly_investment=input_data.fixed_monthly_investment,
        fixed_investment_start_month=input_data.fixed_investment_start_month or 1,
        rent_reduces_investment=input_data.rent_reduces_investment,
        monthly_external_savings=input_data.monthly_external_savings,
        invest_external_surplus=input_data.invest_external_surplus,
        investment_tax=investment_tax,
        fgts=input_data.fgts,
        total_savings=input_data.total_savings,
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
