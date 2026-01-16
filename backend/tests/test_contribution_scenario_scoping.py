import pytest

from app.models import ContributionInput, InvestmentReturnInput
from app.scenarios.comparison import compare_scenarios


def _base_args():
    return dict(
        property_value=500_000,
        down_payment=100_000,
        loan_term_years=30,
        monthly_interest_rate=0.8,  # percent/month (approx)
        loan_type="PRICE",
        rent_value=2_000,
        investment_returns=[
            InvestmentReturnInput(start_month=1, end_month=None, annual_rate=8.0)
        ],
        amortizations=None,
        additional_costs=None,
        inflation_rate=0.0,
        rent_inflation_rate=0.0,
        property_appreciation_rate=0.0,
        monthly_net_income=None,
        monthly_net_income_adjust_inflation=False,
        investment_tax=None,
        fgts=None,
        total_savings=None,
        continue_contributions_after_purchase=True,
    )


def test_contribution_applies_only_to_selected_scenario():
    result = compare_scenarios(
        **_base_args(),
        contributions=[
            ContributionInput(
                month=1, value=5000, value_type="fixed", applies_to=["rent_invest"]
            )
        ],
    )

    buy, rent, invest_buy = result.scenarios

    # month 1 record
    buy_m1 = buy.monthly_data[0]
    rent_m1 = rent.monthly_data[0]
    invest_buy_m1 = invest_buy.monthly_data[0]

    assert (rent_m1.extra_contribution_total or 0) == pytest.approx(5000.0)
    assert (buy_m1.extra_contribution_total or 0) == pytest.approx(0.0)
    assert (invest_buy_m1.extra_contribution_total or 0) == pytest.approx(0.0)


def test_contribution_can_apply_to_multiple_scenarios():
    result = compare_scenarios(
        **_base_args(),
        contributions=[
            ContributionInput(
                month=1,
                value=2500,
                value_type="fixed",
                applies_to=["rent_invest", "invest_buy"],
            )
        ],
    )

    buy, rent, invest_buy = result.scenarios
    rent_m1 = rent.monthly_data[0]
    invest_buy_m1 = invest_buy.monthly_data[0]
    buy_m1 = buy.monthly_data[0]

    assert (rent_m1.extra_contribution_total or 0) == pytest.approx(2500.0)
    assert (invest_buy_m1.extra_contribution_total or 0) == pytest.approx(2500.0)
    assert (buy_m1.extra_contribution_total or 0) == pytest.approx(0.0)


def test_contribution_without_applies_to_is_backward_compatible():
    """If applies_to is omitted, it should apply to all scenarios (legacy behavior)."""
    result = compare_scenarios(
        **_base_args(),
        contributions=[ContributionInput(month=1, value=1000, value_type="fixed")],
    )

    for scenario in result.scenarios:
        m1 = scenario.monthly_data[0]
        assert (m1.extra_contribution_total or 0) == pytest.approx(1000.0)


def test_contribution_empty_applies_to_rejected():
    with pytest.raises(ValueError, match=r"applies_to must have at least one scenario"):
        ContributionInput(month=1, value=1000, value_type="fixed", applies_to=[])
