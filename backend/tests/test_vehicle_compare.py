import pytest

from backend.app.core.vehicles import compare_vehicle_options
from backend.app.models import (
    VehicleComparisonInput,
    VehicleConsortiumConfig,
    VehicleFinancingConfig,
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


def test_vehicle_financing_net_cost_includes_remaining_debt() -> None:
    result = compare_vehicle_options(
        VehicleComparisonInput(
            vehicle_price=100_000.0,
            horizon_months=12,
            annual_depreciation_rate=0.0,
            annual_inflation_rate=0.0,
            monthly_insurance=0.0,
            monthly_maintenance=0.0,
            monthly_fuel=0.0,
            annual_ipva_percentage=0.0,
            include_cash=False,
            financing=VehicleFinancingConfig(
                enabled=True,
                down_payment=0.0,
                term_months=24,
                annual_interest_rate=0.0,
                loan_type="PRICE",
            ),
            consortium=VehicleConsortiumConfig(enabled=False),
            subscription=VehicleSubscriptionConfig(enabled=False, monthly_fee=0.0),
        )
    )

    financing = next(s for s in result.scenarios if s.name == "Financiamento")
    assert financing.total_outflows == pytest.approx(50_000.0)
    assert financing.final_asset_value == 100_000.0
    # R$ 50k paid + R$ 50k still owed - R$ 100k asset = zero net cost.
    assert financing.net_cost == pytest.approx(0.0, abs=1e-8)
    assert financing.monthly_data[-1].net_position == pytest.approx(0.0, abs=1e-8)


def test_vehicle_consortium_net_cost_includes_remaining_obligation() -> None:
    result = compare_vehicle_options(
        VehicleComparisonInput(
            vehicle_price=60_000.0,
            horizon_months=6,
            annual_depreciation_rate=0.0,
            annual_inflation_rate=0.0,
            monthly_insurance=0.0,
            monthly_maintenance=0.0,
            monthly_fuel=0.0,
            annual_ipva_percentage=0.0,
            include_cash=False,
            financing=VehicleFinancingConfig(enabled=False),
            consortium=VehicleConsortiumConfig(
                enabled=True,
                term_months=12,
                admin_fee_percentage=0.0,
                contemplation_month=1,
            ),
            subscription=VehicleSubscriptionConfig(enabled=False, monthly_fee=0.0),
        )
    )

    consortium = next(s for s in result.scenarios if s.name == "Consórcio")
    assert consortium.total_outflows == 30_000.0
    assert consortium.final_asset_value == 60_000.0
    assert consortium.net_cost == 0.0
    assert consortium.monthly_data[-1].net_position == 0.0


def test_vehicle_subscription_adds_fuel_but_not_ownership_costs() -> None:
    result = compare_vehicle_options(
        VehicleComparisonInput(
            vehicle_price=50_000.0,
            horizon_months=3,
            annual_inflation_rate=0.0,
            monthly_insurance=200.0,
            monthly_maintenance=300.0,
            monthly_fuel=400.0,
            annual_ipva_percentage=5.0,
            include_cash=False,
            financing=VehicleFinancingConfig(enabled=False),
            consortium=VehicleConsortiumConfig(enabled=False),
            subscription=VehicleSubscriptionConfig(enabled=True, monthly_fee=1000.0),
        )
    )

    subscription = next(s for s in result.scenarios if s.name == "Assinatura")
    assert subscription.total_outflows == 3 * (1000.0 + 400.0)
    assert subscription.net_cost == subscription.total_outflows
