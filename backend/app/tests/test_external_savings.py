import pytest
import sys, os

# Ensure project root backend path is available when running pytest from repo root
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from app.finance import compare_scenarios  # type: ignore
from app.models import InvestmentReturnInput  # type: ignore

def base_params():
    return dict(
        property_value=300000.0,
        down_payment=60000.0,
        loan_term_years=2,
        monthly_interest_rate=0.8,
        loan_type="PRICE",
        rent_value=1500.0,
        investment_returns=[InvestmentReturnInput(start_month=1, end_month=None, annual_rate=8.0)],
        amortizations=None,
        additional_costs=None,
        inflation_rate=None,
        rent_inflation_rate=None,
        property_appreciation_rate=None,
        invest_loan_difference=False,
        fixed_monthly_investment=None,
        fixed_investment_start_month=1,
        rent_reduces_investment=True,
    )


def get_scenario(result, name):
    return next(s for s in result.scenarios if s.name == name)


def test_full_external_cover_no_withdrawal():
    params = base_params()
    params.update(monthly_external_savings=2000.0, invest_external_surplus=False)
    result = compare_scenarios(**params)
    rent_scenario = get_scenario(result, "Alugar e investir")
    # No withdrawal expected because external covers rent fully
    assert all((m.get("rent_withdrawal_from_investment") or 0) == 0 for m in rent_scenario.monthly_data)
    # External surplus was NOT invested
    assert all((m.get("external_surplus_invested") or 0) == 0 for m in rent_scenario.monthly_data)


def test_partial_external_cover_with_withdrawal():
    params = base_params()
    params.update(monthly_external_savings=500.0, invest_external_surplus=False)
    result = compare_scenarios(**params)
    rent_scenario = get_scenario(result, "Alugar e investir")
    # Some months should have withdrawals > 0
    assert any((m.get("rent_withdrawal_from_investment") or 0) > 0 for m in rent_scenario.monthly_data)


def test_surplus_invested_when_flag_true():
    params = base_params()
    # Give large external savings with surplus investment enabled
    params.update(monthly_external_savings=2500.0, invest_external_surplus=True)
    result = compare_scenarios(**params)
    rent_scenario = get_scenario(result, "Alugar e investir")
    # Expect some surplus invested at least in month 1
    assert any((m.get("external_surplus_invested") or 0) > 0 for m in rent_scenario.monthly_data)
    # And zero withdrawals since fully covered
    assert all((m.get("rent_withdrawal_from_investment") or 0) == 0 for m in rent_scenario.monthly_data)
