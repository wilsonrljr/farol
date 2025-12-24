from backend.app.core.vehicles import compare_vehicle_options
from backend.app.models import (
    VehicleComparisonInput,
    VehicleFinancingConfig,
    VehicleConsortiumConfig,
    VehicleSubscriptionConfig,
)


def test_vehicle_cash_zero_depreciation_no_costs_net_cost_zero() -> None:
    result = compare_vehicle_options(
        VehicleComparisonInput(
            vehicle_price=50_000.0,
            horizon_months=12,
            annual_depreciation_rate=0.0,
            annual_inflation_rate=0.0,
            monthly_insurance=0.0,
            monthly_maintenance=0.0,
            monthly_fuel=0.0,
            annual_ipva_percentage=0.0,
            include_cash=True,
            financing=VehicleFinancingConfig(enabled=False),
            consortium=VehicleConsortiumConfig(enabled=False),
            subscription=VehicleSubscriptionConfig(enabled=False, monthly_fee=0.0),
        )
    )

    cash = next(s for s in result.scenarios if s.name == "À vista")
    assert cash.final_asset_value == 50_000.0
    assert cash.total_outflows == 50_000.0
    assert cash.net_cost == 0.0


def test_vehicle_subscription_costs_are_fee_times_horizon() -> None:
    result = compare_vehicle_options(
        VehicleComparisonInput(
            vehicle_price=50_000.0,
            horizon_months=10,
            annual_depreciation_rate=10.0,
            annual_inflation_rate=0.0,
            include_cash=False,
            financing=VehicleFinancingConfig(enabled=False),
            consortium=VehicleConsortiumConfig(enabled=False),
            subscription=VehicleSubscriptionConfig(enabled=True, monthly_fee=1500.0),
        )
    )

    sub = next(s for s in result.scenarios if s.name == "Assinatura")
    assert sub.final_asset_value == 0.0
    assert sub.total_outflows == 15000.0
    assert sub.net_cost == 15000.0
