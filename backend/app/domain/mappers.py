"""Mapping utilities between domain models and API models."""

from __future__ import annotations

from dataclasses import asdict

from .. import models as api
from . import models as domain


def monthly_record_to_api(record: domain.MonthlyRecord) -> api.MonthlyRecord:
    return api.MonthlyRecord(**asdict(record))


def comparison_scenario_to_api(
    scenario: domain.ComparisonScenario,
) -> api.ComparisonScenario:
    payload = asdict(scenario)
    payload["monthly_data"] = [monthly_record_to_api(m) for m in scenario.monthly_data]
    return api.ComparisonScenario(**payload)


def comparison_metrics_to_api(
    metrics: domain.ComparisonMetrics,
) -> api.ComparisonMetrics:
    return api.ComparisonMetrics(**asdict(metrics))


def enhanced_comparison_scenario_to_api(
    scenario: domain.EnhancedComparisonScenario,
) -> api.EnhancedComparisonScenario:
    payload = asdict(scenario)
    payload["monthly_data"] = [monthly_record_to_api(m) for m in scenario.monthly_data]
    payload["metrics"] = comparison_metrics_to_api(scenario.metrics)
    return api.EnhancedComparisonScenario(**payload)


def comparison_result_to_api(result: domain.ComparisonResult) -> api.ComparisonResult:
    return api.ComparisonResult(
        best_scenario=result.best_scenario,
        scenarios=[comparison_scenario_to_api(s) for s in result.scenarios],
    )


def enhanced_comparison_result_to_api(
    result: domain.EnhancedComparisonResult,
) -> api.EnhancedComparisonResult:
    return api.EnhancedComparisonResult(
        best_scenario=result.best_scenario,
        scenarios=[enhanced_comparison_scenario_to_api(s) for s in result.scenarios],
        comparative_summary=result.comparative_summary,
    )
