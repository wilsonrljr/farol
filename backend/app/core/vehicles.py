"""Vehicle purchase comparison utilities.

This module compares simplified vehicle acquisition modalities over a fixed
horizon:
- Cash purchase
- Financing (SAC or PRICE)
- Consortium (with a configured contemplation month)
- Subscription

It returns month-by-month outflows and an estimated vehicle resale value using
an annual depreciation rate.
"""

from __future__ import annotations

from .inflation import apply_inflation
from .rates import convert_interest_rate
from ..loans import PriceLoanSimulator, SACLoanSimulator
from ..models import (
    VehicleComparisonInput,
    VehicleComparisonMonth,
    VehicleComparisonResult,
    VehicleComparisonScenario,
)


def _monthly_depreciation_factor(annual_depreciation_rate: float | None) -> float:
    if annual_depreciation_rate is None or annual_depreciation_rate == 0:
        return 1.0
    # Convert annual total depreciation into a monthly multiplicative factor.
    annual_factor = max(0.0, 1.0 - (annual_depreciation_rate / 100.0))
    return annual_factor ** (1.0 / 12.0)


def _ipva_due(month: int) -> bool:
    # Simplified: IPVA once per year on month 1, 13, 25, ... if owning.
    return (month - 1) % 12 == 0


def _ownership_costs(input_data: VehicleComparisonInput, month: int) -> float:
    insurance = apply_inflation(
        input_data.monthly_insurance,
        month=month,
        base_month=1,
        annual_inflation_rate=input_data.annual_inflation_rate,
    )
    maintenance = apply_inflation(
        input_data.monthly_maintenance,
        month=month,
        base_month=1,
        annual_inflation_rate=input_data.annual_inflation_rate,
    )
    fuel = apply_inflation(
        input_data.monthly_fuel,
        month=month,
        base_month=1,
        annual_inflation_rate=input_data.annual_inflation_rate,
    )
    return float(insurance + maintenance + fuel)


def _build_scenario(
    name: str,
    month_cashflows: list[float],
    month_asset_values: list[float],
) -> VehicleComparisonScenario:
    cumulative = 0.0
    months: list[VehicleComparisonMonth] = []
    for i, (cf, av) in enumerate(
        zip(month_cashflows, month_asset_values, strict=False), start=1
    ):
        cumulative += cf
        months.append(
            VehicleComparisonMonth(
                month=i,
                cash_flow=float(cf),
                cumulative_outflow=float(cumulative),
                asset_value=float(av),
                net_position=float(av - cumulative),
            )
        )

    total_outflows = float(sum(month_cashflows))
    final_asset_value = float(month_asset_values[-1]) if month_asset_values else 0.0
    return VehicleComparisonScenario(
        name=name,
        total_outflows=total_outflows,
        final_asset_value=final_asset_value,
        net_cost=float(total_outflows - final_asset_value),
        monthly_data=months,
    )


def compare_vehicle_options(
    input_data: VehicleComparisonInput,
) -> VehicleComparisonResult:
    scenarios: list[VehicleComparisonScenario] = []
    horizon = input_data.horizon_months
    dep_factor = _monthly_depreciation_factor(input_data.annual_depreciation_rate)

    # Base "owned" asset value timeline if bought at month 1.
    owned_asset: list[float] = []
    v = float(input_data.vehicle_price)
    for month in range(1, horizon + 1):
        # End-of-month value after depreciation.
        owned_asset.append(float(v))
        v *= dep_factor

    # --- Cash purchase ---
    if input_data.include_cash:
        cashflows: list[float] = []
        assets: list[float] = []
        for month in range(1, horizon + 1):
            cf = 0.0
            if month == 1:
                cf += float(input_data.vehicle_price)
            cf += _ownership_costs(input_data, month)

            # IPVA applies if owning.
            if input_data.annual_ipva_percentage and _ipva_due(month):
                cf += owned_asset[month - 1] * (
                    input_data.annual_ipva_percentage / 100.0
                )

            cashflows.append(float(cf))
            assets.append(float(owned_asset[month - 1]))

        scenarios.append(_build_scenario("À vista", cashflows, assets))

    # --- Financing ---
    if input_data.financing is not None and input_data.financing.enabled:
        fin = input_data.financing
        loan_value = max(0.0, float(input_data.vehicle_price) - float(fin.down_payment))

        _, monthly_rate = convert_interest_rate(
            annual_rate=fin.annual_interest_rate,
            monthly_rate=fin.monthly_interest_rate,
        )

        if fin.loan_type == "SAC":
            sim = SACLoanSimulator(
                loan_value=loan_value,
                term_months=fin.term_months,
                monthly_interest_rate=monthly_rate,
                amortizations=None,
                annual_inflation_rate=None,
            ).simulate()
        else:
            sim = PriceLoanSimulator(
                loan_value=loan_value,
                term_months=fin.term_months,
                monthly_interest_rate=monthly_rate,
                amortizations=None,
                annual_inflation_rate=None,
            ).simulate()

        installment_by_month = {
            inst.month: inst.installment for inst in sim.installments
        }

        cashflows = []
        assets = []
        for month in range(1, horizon + 1):
            cf = 0.0
            if month == 1:
                cf += float(fin.down_payment)

            if month in installment_by_month:
                cf += float(installment_by_month[month])

            # Costs only after purchase (assume purchase at month 1).
            cf += _ownership_costs(input_data, month)
            if input_data.annual_ipva_percentage and _ipva_due(month):
                cf += owned_asset[month - 1] * (
                    input_data.annual_ipva_percentage / 100.0
                )

            cashflows.append(float(cf))
            assets.append(float(owned_asset[month - 1]))

        scenarios.append(_build_scenario("Financiamento", cashflows, assets))

    # --- Consortium ---
    if input_data.consortium is not None and input_data.consortium.enabled:
        cons = input_data.consortium
        # Total paid over the term includes admin fee.
        total = float(input_data.vehicle_price) * (
            1.0 + (cons.admin_fee_percentage / 100.0)
        )
        monthly_payment = total / float(cons.term_months)

        cashflows = []
        assets = []

        # Asset value only exists after contemplation month.
        asset_after: list[float] = []
        v0 = float(input_data.vehicle_price)
        for month in range(1, horizon + 1):
            if month < cons.contemplation_month:
                asset_after.append(0.0)
            else:
                # month==contemplation: start at price and depreciate afterwards.
                months_owned = month - cons.contemplation_month
                asset_after.append(float(v0 * (dep_factor**months_owned)))

        for month in range(1, horizon + 1):
            cf = 0.0
            # Pay consortium installments during its term (or until horizon).
            if month <= cons.term_months:
                cf += monthly_payment

            if month >= cons.contemplation_month:
                cf += _ownership_costs(input_data, month)
                if input_data.annual_ipva_percentage and _ipva_due(month):
                    cf += asset_after[month - 1] * (
                        input_data.annual_ipva_percentage / 100.0
                    )

            cashflows.append(float(cf))
            assets.append(float(asset_after[month - 1]))

        scenarios.append(_build_scenario("Consórcio", cashflows, assets))

    # --- Subscription ---
    if input_data.subscription is not None and input_data.subscription.enabled:
        sub = input_data.subscription
        cashflows = []
        assets = []
        for month in range(1, horizon + 1):
            fee = apply_inflation(
                float(sub.monthly_fee),
                month=month,
                base_month=1,
                annual_inflation_rate=input_data.annual_inflation_rate,
            )
            cashflows.append(float(fee))
            assets.append(0.0)
        scenarios.append(_build_scenario("Assinatura", cashflows, assets))

    return VehicleComparisonResult(scenarios=scenarios)
