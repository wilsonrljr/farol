from backend.app.scenarios.comparison import enhanced_compare_scenarios
from backend.app.models import InvestmentReturnInput


def test_roi_basic():
    """Test that ROI is calculated correctly with income-based model."""
    result = enhanced_compare_scenarios(
        property_value=300000.0,
        down_payment=60000.0,
        loan_term_years=2,
        monthly_interest_rate=0.8,
        loan_type="PRICE",
        rent_value=2500.0,
        investment_returns=[
            InvestmentReturnInput(start_month=1, end_month=None, annual_rate=6.0)
        ],
        amortizations=None,
        additional_costs=None,
        inflation_rate=None,
        rent_inflation_rate=None,
        property_appreciation_rate=None,
        monthly_net_income=8000.0,  # Income-based model
    )

    rent_scenario = next(s for s in result.scenarios if s.name == "Alugar e investir")
    metrics = rent_scenario.metrics

    # Should have ROI calculated
    assert metrics.roi_percentage is not None


def test_roi_no_income():
    """Test ROI when no income is provided (legacy mode)."""
    result = enhanced_compare_scenarios(
        property_value=300000.0,
        down_payment=60000.0,
        loan_term_years=2,
        monthly_interest_rate=0.8,
        loan_type="PRICE",
        rent_value=800.0,
        investment_returns=[
            InvestmentReturnInput(start_month=1, end_month=None, annual_rate=10.0)
        ],
        amortizations=None,
        additional_costs=None,
        inflation_rate=None,
        rent_inflation_rate=None,
        property_appreciation_rate=None,
        monthly_net_income=None,
    )

    rent_scenario = next(s for s in result.scenarios if s.name == "Alugar e investir")
    metrics = rent_scenario.metrics
    # ROI should still be calculated
    assert metrics.roi_percentage is not None
