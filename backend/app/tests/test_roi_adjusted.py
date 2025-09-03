import sys, os
import math

# Add backend root to path (mirroring other tests style)
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from app.finance import enhanced_compare_scenarios  # type: ignore
from app.models import InvestmentReturnInput  # type: ignore


def test_roi_adjusted_present_when_withdrawals():
    """When there are rent withdrawals, roi_adjusted_percentage should be > roi_percentage."""
    result = enhanced_compare_scenarios(
        property_value=300000.0,
        down_payment=60000.0,
        loan_term_years=2,
        monthly_interest_rate=0.8,
        loan_type="PRICE",
        rent_value=2500.0,  # ensure rent drawdowns significant vs returns
        investment_returns=[InvestmentReturnInput(start_month=1, end_month=None, annual_rate=6.0)],
        amortizations=None,
        additional_costs=None,
        inflation_rate=None,
        rent_inflation_rate=None,
        property_appreciation_rate=None,
        invest_loan_difference=False,
        fixed_monthly_investment=None,
        fixed_investment_start_month=1,
        rent_reduces_investment=True,  # activates withdrawals
        monthly_external_savings=0.0,
        invest_external_surplus=False,
    )

    rent_scenario = next(s for s in result.scenarios if s.name == "Alugar e investir")
    metrics = rent_scenario.metrics

    # Should have withdrawals
    assert metrics.total_rent_withdrawn_from_investment and metrics.total_rent_withdrawn_from_investment > 0
    # Adjusted ROI should be higher than gross ROI due to adding back withdrawals
    assert metrics.roi_adjusted_percentage is not None
    assert metrics.roi_adjusted_percentage > metrics.roi_percentage


def test_roi_adjusted_absent_without_withdrawals():
    """When no withdrawals occur, roi_adjusted_percentage should be None or equal to roi (but we expect None)."""
    result = enhanced_compare_scenarios(
        property_value=300000.0,
        down_payment=60000.0,
        loan_term_years=2,
        monthly_interest_rate=0.8,
        loan_type="PRICE",
        rent_value=800.0,  # small rent, returns should cover or no withdrawals if rent_reduces_investment False
        investment_returns=[InvestmentReturnInput(start_month=1, end_month=None, annual_rate=10.0)],
        amortizations=None,
        additional_costs=None,
        inflation_rate=None,
        rent_inflation_rate=None,
        property_appreciation_rate=None,
        invest_loan_difference=False,
        fixed_monthly_investment=None,
        fixed_investment_start_month=1,
        rent_reduces_investment=False,  # no withdrawals by design
        monthly_external_savings=0.0,
        invest_external_surplus=False,
    )

    rent_scenario = next(s for s in result.scenarios if s.name == "Alugar e investir")
    metrics = rent_scenario.metrics
    assert metrics.total_rent_withdrawn_from_investment is None
    assert metrics.roi_adjusted_percentage is None
