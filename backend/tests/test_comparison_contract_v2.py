from __future__ import annotations

import pytest
from pydantic import ValidationError

from backend.app.api.input_normalization import (
    resolve_monthly_interest_rate,
    resolve_rent_value,
)
from backend.app.models import (
    AdditionalCostsInput,
    AmortizationInput,
    ComparisonInput,
    ContributionInput,
    FGTSInput,
    InvestmentReturnInput,
    VehicleComparisonInput,
    VehicleFinancingConfig,
)
from backend.app.scenarios.comparison import compare_scenarios


def _returns() -> list[InvestmentReturnInput]:
    return [InvestmentReturnInput(start_month=1, annual_rate=0.0)]


def _compare(**overrides: object):
    values: dict[str, object] = {
        "property_value": 120_000.0,
        "down_payment": 0.0,
        "loan_term_years": 1,
        "monthly_interest_rate": 0.0,
        "loan_type": "SAC",
        "rent_value": 1_000.0,
        "investment_returns": _returns(),
        "monthly_net_income": 20_000.0,
        "total_savings": 0.0,
    }
    values.update(overrides)
    return compare_scenarios(**values)  # type: ignore[arg-type]


def test_rent_percentage_is_monthly_and_representations_are_exclusive() -> None:
    assert resolve_rent_value(
        property_value=500_000.0,
        rent_value=None,
        rent_percentage=0.4,
    ) == pytest.approx(2_000.0)

    with pytest.raises(ValueError, match="exactly one"):
        resolve_rent_value(
            property_value=500_000.0,
            rent_value=2_000.0,
            rent_percentage=0.4,
        )

    with pytest.raises(ValueError, match="exactly one"):
        resolve_monthly_interest_rate(
            annual_interest_rate=12.0,
            monthly_interest_rate=1.0,
        )


def test_unfunded_installments_do_not_turn_into_phantom_wealth() -> None:
    result = _compare(monthly_net_income=1.0)
    buy = next(s for s in result.scenarios if s.scenario_type == "buy")

    assert result.comparison_status == "no_feasible_scenario"
    assert result.best_scenario is None
    assert buy.final_equity == pytest.approx(120_000.0)
    assert buy.total_unfunded_amount == pytest.approx(119_988.0)
    assert buy.final_wealth == pytest.approx(12.0)
    assert buy.is_feasible is False
    assert buy.first_unfunded_month == 1


def test_common_resource_ledger_keeps_residual_cash_and_ranks_feasible_only() -> None:
    result = _compare()

    assert result.comparison_status == "comparable"
    assert result.best_scenario_type == "buy"
    assert result.best_scenario == "Comprar com financiamento"
    assert all(s.is_feasible is True for s in result.scenarios)

    buy = next(s for s in result.scenarios if s.scenario_type == "buy")
    assert buy.residual_cash_balance == pytest.approx(120_000.0)
    assert buy.final_assets == pytest.approx(240_000.0)
    assert buy.final_liabilities == pytest.approx(0.0)


def test_scenario_scoped_resources_disable_authoritative_ranking() -> None:
    contribution = ContributionInput(
        month=1,
        value=1_000.0,
        applies_to=["rent_invest"],
    )
    result = _compare(contributions=[contribution])

    assert result.comparison_status == "incomparable"
    assert result.best_scenario is None
    assert any("aportes exclusivos" in warning for warning in result.warnings)


def test_missing_resource_contract_is_explicitly_exploratory() -> None:
    result = _compare(monthly_net_income=None, total_savings=None)

    assert result.comparison_status == "exploratory"
    assert result.best_scenario is None
    assert all(s.is_feasible is None for s in result.scenarios)


def test_incomparable_result_reports_all_missing_resource_contracts() -> None:
    result = _compare(
        monthly_net_income=None,
        total_savings=None,
        contributions=[
            ContributionInput(
                month=1,
                value=1_000.0,
                applies_to=["rent_invest"],
            )
        ],
    )

    assert result.comparison_status == "incomparable"
    assert any("aportes exclusivos" in warning for warning in result.warnings)
    assert any("reserva total" in warning for warning in result.warnings)
    assert any("renda líquida mensal" in warning for warning in result.warnings)


def test_public_input_rejects_unknown_keys_and_ambiguous_units() -> None:
    payload = {
        "property_value": 500_000.0,
        "down_payment": 115_000.0,
        "total_savings": 130_000.0,
        "loan_term_years": 30,
        "annual_interest_rate": 12.0,
        "monthly_interest_rate": None,
        "loan_type": "PRICE",
        "rent_value": None,
        "rent_percentage": 0.4,
        "investment_returns": [{"start_month": 1, "annual_rate": 8.0}],
        "additional_costs": AdditionalCostsInput(),
        "unexpected_typo": 123,
    }

    with pytest.raises(ValidationError, match="unexpected_typo"):
        ComparisonInput.model_validate(payload)

    payload.pop("unexpected_typo")
    payload["monthly_interest_rate"] = 1.0
    with pytest.raises(ValidationError, match="exactly one"):
        ComparisonInput.model_validate(payload)


def test_single_scheduled_events_cannot_be_silently_ignored() -> None:
    with pytest.raises(ValidationError, match="month is required"):
        AmortizationInput(value=1_000.0)

    with pytest.raises(ValidationError, match="month is required"):
        ContributionInput(value=1_000.0)

    # An explicit recurrence may intentionally omit month and starts at month 1.
    recurring = ContributionInput(value=100.0, interval_months=1)
    assert recurring.month is None


def test_vehicle_inputs_reject_non_positive_price_and_negative_financing_rate() -> None:
    with pytest.raises(ValidationError, match="greater than 0"):
        VehicleComparisonInput(vehicle_price=0.0, include_cash=True)

    with pytest.raises(ValidationError, match="greater than or equal to 0"):
        VehicleFinancingConfig(enabled=True, annual_interest_rate=-1.0)


def test_zeroed_fgts_does_not_create_a_fictitious_blocked_purchase() -> None:
    result = _compare(
        fgts=FGTSInput(
            initial_balance=0.0,
            monthly_contribution=0.0,
            annual_yield_rate=0.0,
            use_at_purchase=True,
        )
    )
    buy = next(s for s in result.scenarios if s.scenario_type == "buy")

    assert buy.fgts_summary is not None
    assert buy.fgts_summary.blocked_count == 0
    assert buy.fgts_summary.blocked_total_value == 0.0
    assert buy.fgts_summary.withdrawal_history == []


def test_invest_then_buy_uses_non_yielding_income_cash_for_purchase() -> None:
    result = _compare(
        property_value=500_000.0,
        down_payment=100_000.0,
        total_savings=100_000.0,
        loan_term_years=30,
        rent_value=2_000.0,
        monthly_net_income=20_000.0,
    )
    invest_buy = next(s for s in result.scenarios if s.scenario_type == "invest_buy")

    purchase_month = invest_buy.monthly_data[0].purchase_month
    assert purchase_month is not None
    assert purchase_month < 30 * 12
    purchase_row = next(
        row for row in invest_buy.monthly_data if row.month == purchase_month
    )
    assert purchase_row.cash_reserve_used_for_purchase is not None
    assert purchase_row.cash_reserve_used_for_purchase > 0
    assert purchase_row.status == "Imóvel comprado"

    # The post-hoc common ledger consumes exactly the cash converted into the
    # property instead of also leaving it in the terminal cash balance.
    assert invest_buy.residual_cash_balance is not None
    assert invest_buy.residual_cash_balance < 20_000.0 * 30 * 12


def test_cumulative_rent_paid_uses_prior_residual_cash_consistently() -> None:
    result = _compare(
        property_value=10_000.0,
        loan_term_years=2,
        rent_value=500.0,
        rent_inflation_rate=900.0,
        monthly_net_income=1_000.0,
        total_savings=0.0,
    )
    rent = next(s for s in result.scenarios if s.scenario_type == "rent_invest")

    month_13 = rent.monthly_data[12]
    assert month_13.rent_due == pytest.approx(5_000.0)
    assert month_13.rent_paid == pytest.approx(5_000.0)
    assert month_13.rent_shortfall == pytest.approx(0.0)
    assert month_13.cumulative_rent_paid == pytest.approx(
        sum((row.rent_paid or 0.0) for row in rent.monthly_data[:13])
    )
