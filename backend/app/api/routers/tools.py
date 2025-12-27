"""Tool endpoints.

These endpoints expose standalone utilities that are intentionally independent
from the housing scenarios (e.g., stress tests, emergency fund planners).
"""

from fastapi import APIRouter

from ...core.emergency_fund import plan_emergency_fund
from ...core.fire import plan_fire
from ...core.stress_test import run_stress_test
from ...core.vehicles import compare_vehicle_options
from ...models import StressTestInput, StressTestResult
from ...models import (
    EmergencyFundPlanInput,
    EmergencyFundPlanResult,
    FIREPlanInput,
    FIREPlanResult,
    VehicleComparisonInput,
    VehicleComparisonResult,
)

router = APIRouter(tags=["tools"])


@router.post("/api/stress-test", response_model=StressTestResult)
def stress_test(input_data: StressTestInput) -> StressTestResult:
    return run_stress_test(input_data)


@router.post("/api/emergency-fund", response_model=EmergencyFundPlanResult)
def emergency_fund_plan(input_data: EmergencyFundPlanInput) -> EmergencyFundPlanResult:
    return plan_emergency_fund(input_data)


@router.post("/api/fire", response_model=FIREPlanResult)
def fire_plan(input_data: FIREPlanInput) -> FIREPlanResult:
    """Calculate path to Financial Independence (FIRE)."""
    return plan_fire(input_data)


@router.post("/api/vehicle-compare", response_model=VehicleComparisonResult)
def vehicle_compare(input_data: VehicleComparisonInput) -> VehicleComparisonResult:
    return compare_vehicle_options(input_data)
