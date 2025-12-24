from __future__ import annotations

from backend.app.models import AmortizationInput, FGTSInput, InvestmentReturnInput
from backend.app.scenarios.comparison import compare_scenarios


def _get_scenario(result, name: str):
    return next(s for s in result.scenarios if s.name == name)


def test_invest_loan_difference_baseline_respects_fgts_amortizations_and_isolated_manager():
    """Regression: baseline loan used by invest_loan_difference must mirror buy scenario rules.

    Expectations:
    - If a loan amortization is marked funding_source='fgts', the baseline financing
      (used to compute the loan-vs-rent difference) must include that extra amortization.
      In PRICE, an extra amortization increases that month's installment by the same amount.
    - The baseline must use an isolated FGTS manager, so it cannot mutate the scenario's
      FGTS balance timeline.
    """

    fgts = FGTSInput(
        initial_balance=50_000.0,
        monthly_contribution=0.0,
        annual_yield_rate=0.0,
        use_at_purchase=False,  # avoid purchase withdrawal/cooldown interference
        max_withdrawal_at_purchase=None,
    )

    base_kwargs = dict(
        property_value=300_000.0,
        down_payment=0.0,
        loan_term_years=1,
        monthly_interest_rate=1.0,
        loan_type="PRICE",
        rent_value=0.0,  # makes the loan-vs-rent difference easier to reason about
        investment_returns=[
            InvestmentReturnInput(start_month=1, end_month=None, annual_rate=0.0)
        ],
        amortizations=None,
        contributions=None,
        additional_costs=None,
        inflation_rate=None,
        rent_inflation_rate=None,
        property_appreciation_rate=None,
        invest_loan_difference=True,
        fixed_monthly_investment=None,
        fixed_investment_start_month=1,
        rent_reduces_investment=False,
        monthly_external_savings=None,
        invest_external_surplus=False,
        investment_tax=None,
        fgts=fgts,
        total_savings=None,
    )

    # Baseline without amortizations
    res0 = compare_scenarios(**base_kwargs)
    invest0 = _get_scenario(res0, "Investir e comprar à vista")
    m0 = invest0.monthly_data[0]
    assert m0.additional_investment is not None

    # Baseline with FGTS amortization on month 1
    amort_fgts = AmortizationInput(
        month=1,
        value=1_000.0,
        value_type="fixed",
        funding_source="fgts",
    )

    res1 = compare_scenarios(**{**base_kwargs, "amortizations": [amort_fgts]})
    invest1 = _get_scenario(res1, "Investir e comprar à vista")
    m1 = invest1.monthly_data[0]

    assert m1.additional_investment is not None

    # In PRICE, extra amortization increases installment by the same amount that month,
    # therefore the invested difference should increase by ~1000.
    diff = float(m1.additional_investment) - float(m0.additional_investment)
    assert abs(diff - 1_000.0) < 1e-6

    # Ensure the scenario's FGTS balance wasn't mutated by the baseline.
    # Scenario accumulates FGTS at the start of the month; with zero contrib/yield,
    # it must remain equal to the initial balance.
    assert m1.fgts_balance == 50_000.0
