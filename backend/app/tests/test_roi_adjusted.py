from app.scenarios.comparison import enhanced_compare_scenarios
from app.models import InvestmentReturnInput


def test_roi_adjusted_present_when_withdrawals():
    """When there are rent withdrawals, roi_including_withdrawals_percentage should be > roi_percentage."""
    result = enhanced_compare_scenarios(
        property_value=300000.0,
        down_payment=60000.0,
        loan_term_years=2,
        monthly_interest_rate=0.8,
        loan_type="PRICE",
        rent_value=2500.0,  # ensure rent drawdowns significant vs returns
        investment_returns=[
            InvestmentReturnInput(start_month=1, end_month=None, annual_rate=6.0)
        ],
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
    assert metrics.total_rent_withdrawn_from_investment
    assert metrics.total_rent_withdrawn_from_investment > 0
    # Adjusted ROI should be higher than gross ROI due to adding back withdrawals
    assert metrics.roi_including_withdrawals_percentage is not None
    assert metrics.roi_including_withdrawals_percentage > metrics.roi_percentage


def test_roi_adjusted_absent_without_withdrawals():
    """When no withdrawals occur, roi_including_withdrawals_percentage should be None."""
    result = enhanced_compare_scenarios(
        property_value=300000.0,
        down_payment=60000.0,
        loan_term_years=2,
        monthly_interest_rate=0.8,
        loan_type="PRICE",
        rent_value=800.0,  # small rent, returns should cover or no withdrawals if rent_reduces_investment False
        investment_returns=[
            InvestmentReturnInput(start_month=1, end_month=None, annual_rate=10.0)
        ],
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
    assert metrics.roi_including_withdrawals_percentage is None
