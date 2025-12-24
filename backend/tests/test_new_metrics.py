import pytest

from app.core.rates import convert_interest_rate
from app.scenarios.comparison import compare_scenarios
from app.models import InvestmentReturnInput


def test_inconsistent_interest_rate_validation():
    # annual 12% should correspond to ~0.9489% monthly; provide inconsistent monthly
    with pytest.raises(ValueError):
        convert_interest_rate(annual_rate=12.0, monthly_rate=2.0)


def test_compare_scenarios_new_fields():
    result = compare_scenarios(
        property_value=300000,
        down_payment=60000,
        loan_term_years=30,
        monthly_interest_rate=0.8,
        loan_type="PRICE",
        rent_value=1500,
        investment_returns=[
            InvestmentReturnInput(start_month=1, end_month=None, annual_rate=8.0)
        ],
    )
    for scenario in result.scenarios:
        assert scenario.total_outflows is not None
        assert scenario.net_cost is not None
        # total_cost should equal net_cost for backward compatibility
        assert scenario.total_cost == scenario.net_cost

        # New wealth semantics should be present and consistent.
        assert scenario.initial_wealth is not None
        assert scenario.final_wealth is not None
        assert scenario.net_worth_change is not None
        assert scenario.final_wealth == pytest.approx(scenario.final_equity)
        assert scenario.net_worth_change == pytest.approx(
            scenario.final_wealth - scenario.initial_wealth
        )

    # best_scenario is defined as the max net_worth_change scenario.
    best = max(result.scenarios, key=lambda s: s.net_worth_change or -1e18)
    assert result.best_scenario == best.name
