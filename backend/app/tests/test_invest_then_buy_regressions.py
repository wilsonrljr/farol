from __future__ import annotations

import pytest

from backend.app.finance import InvestThenBuyScenarioSimulator
from backend.app.models import AdditionalCostsInput, FGTSInput, InvestmentReturnInput


def test_invest_loan_difference_upfront_not_double_counted():
    simulator = InvestThenBuyScenarioSimulator(
        property_value=50000.0,
        down_payment=10000.0,
        term_months=12,
        rent_value=0.0,
        investment_returns=[
            InvestmentReturnInput(start_month=1, end_month=None, annual_rate=0.0)
        ],
        additional_costs=AdditionalCostsInput(
            itbi_percentage=5.0,
            deed_percentage=5.0,
            monthly_hoa=0.0,
            monthly_property_tax=0.0,
        ),
        inflation_rate=None,
        rent_inflation_rate=None,
        property_appreciation_rate=None,
        invest_loan_difference=True,
        monthly_external_savings=None,
        invest_external_surplus=False,
        rent_reduces_investment=False,
        initial_investment=45000.0,
    )

    result = simulator.simulate_domain()

    first_month = result.monthly_data[0]
    assert first_month.status == "Imóvel comprado"
    assert first_month.total_monthly_cost == pytest.approx(55000.0)
    assert result.total_outflows == pytest.approx(55000.0)
    assert all(
        (m.total_monthly_cost or 0.0) == pytest.approx(0.0)
        for m in result.monthly_data[1:]
    )


def test_fgts_withdrawal_limited_to_shortfall():
    simulator = InvestThenBuyScenarioSimulator(
        property_value=200000.0,
        down_payment=150000.0,
        term_months=12,
        rent_value=0.0,
        investment_returns=[
            InvestmentReturnInput(start_month=1, end_month=None, annual_rate=0.0)
        ],
        additional_costs=AdditionalCostsInput(
            itbi_percentage=0.0,
            deed_percentage=0.0,
            monthly_hoa=0.0,
            monthly_property_tax=0.0,
        ),
        inflation_rate=None,
        rent_inflation_rate=None,
        property_appreciation_rate=None,
        invest_loan_difference=False,
        monthly_external_savings=None,
        invest_external_surplus=False,
        rent_reduces_investment=False,
        initial_investment=30000.0,
        fgts=FGTSInput(initial_balance=50000.0, use_at_purchase=True),
    )

    result = simulator.simulate_domain()
    first_month = result.monthly_data[0]

    assert first_month.status == "Imóvel comprado"
    assert first_month.fgts_used == pytest.approx(20000.0)
    assert first_month.fgts_balance == pytest.approx(30000.0)
    assert first_month.shortfall == pytest.approx(0.0)
