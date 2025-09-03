import pytest

from app.finance import compare_scenarios, convert_interest_rate
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
        investment_returns=[InvestmentReturnInput(start_month=1, end_month=None, annual_rate=8.0)],
    )
    for scenario in result.scenarios:
        assert scenario.total_outflows is not None
        assert scenario.net_cost is not None
        # total_cost should equal net_cost for backward compatibility
        assert scenario.total_cost == scenario.net_cost
