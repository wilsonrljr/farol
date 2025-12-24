"""Regression tests: total_savings must not disappear when additional_costs is provided.

Historically, ComparisonInput.initial_investment subtracted upfront costs (ITBI/escritura),
which is correct for the BUY scenario (paid at month 1) but incorrect for the renter
and invest-then-buy scenarios (no purchase at month 1). This test suite ensures that
cash is conserved in those scenarios and that upfront costs show up as net cost only
when an actual purchase happens.
"""

import pytest

from backend.app.models import AdditionalCostsInput, InvestmentReturnInput
from backend.app.scenarios.comparison import compare_scenarios


def test_total_savings_with_upfront_costs_is_fully_tracked_in_rent_and_invest_buy():
    # Property 100k, upfront costs 20% => 20k. total_savings 50k.
    # Rent/invest and invest-then-buy should still model the full 50k as invested capital.
    result = compare_scenarios(
        property_value=100_000,
        down_payment=20_000,
        total_savings=50_000,
        loan_term_years=1,
        monthly_interest_rate=0.0,
        loan_type="SAC",
        rent_value=0.0,
        investment_returns=[InvestmentReturnInput(start_month=1, annual_rate=0.0)],
        additional_costs=AdditionalCostsInput(
            itbi_percentage=10.0,
            deed_percentage=10.0,
            monthly_hoa=0.0,
            monthly_property_tax=0.0,
        ),
        inflation_rate=0.0,
    )

    rent = next(s for s in result.scenarios if s.scenario_type == "rent_invest")
    invest_buy = next(s for s in result.scenarios if s.scenario_type == "invest_buy")

    assert rent.total_outflows == pytest.approx(50_000.0)
    assert rent.final_equity == pytest.approx(50_000.0)
    assert rent.total_cost == pytest.approx(0.0)

    assert invest_buy.total_outflows == pytest.approx(50_000.0)
    assert invest_buy.final_equity == pytest.approx(50_000.0)
    assert invest_buy.total_cost == pytest.approx(0.0)


def test_invest_then_buy_purchase_month_net_cost_equals_upfront_when_buying_outright():
    # Purchase happens immediately: total_savings matches total_purchase_cost (price + upfront).
    # With zero returns and no rent, net cost should equal upfront costs only.
    result = compare_scenarios(
        property_value=100_000,
        down_payment=20_000,
        total_savings=120_000,
        loan_term_years=1,
        monthly_interest_rate=0.0,
        loan_type="SAC",
        rent_value=0.0,
        investment_returns=[InvestmentReturnInput(start_month=1, annual_rate=0.0)],
        additional_costs=AdditionalCostsInput(
            itbi_percentage=10.0,
            deed_percentage=10.0,
            monthly_hoa=0.0,
            monthly_property_tax=0.0,
        ),
        inflation_rate=0.0,
    )

    invest_buy = next(s for s in result.scenarios if s.scenario_type == "invest_buy")

    # Must have purchased in month 1.
    assert invest_buy.monthly_data[0].status == "Imóvel comprado"

    # total_outflows should be the initial deposit (full total_savings).
    assert invest_buy.total_outflows == pytest.approx(120_000.0)

    # Final equity is just the property value (no investment left, no FGTS).
    assert invest_buy.final_equity == pytest.approx(100_000.0)

    # Net cost must equal upfront costs (20k).
    assert invest_buy.total_cost == pytest.approx(20_000.0)
