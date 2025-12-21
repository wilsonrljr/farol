"""Tests for total_savings and initial_investment feature.

This feature allows users to specify their total available savings,
where the difference between total_savings and down_payment becomes
initial_investment capital for rent/invest scenarios and opportunity
cost tracking in the buy scenario.
"""

import pytest

from backend.app.models import ComparisonInput, InvestmentReturnInput
from backend.app.scenarios.comparison import (
    compare_scenarios,
    enhanced_compare_scenarios,
)


def test_initial_investment_calculated_from_total_savings():
    """Test that initial_investment is correctly computed from total_savings."""
    inputs = ComparisonInput(
        property_value=500000,
        down_payment=100000,
        total_savings=150000,  # 50k extra for investment
        loan_term_years=30,
        annual_interest_rate=10.0,
        loan_type="SAC",
        rent_value=2000,
        investment_returns=[InvestmentReturnInput(start_month=1, annual_rate=8.0)],
    )

    assert inputs.initial_investment == 50000.0


def test_initial_investment_zero_when_total_savings_not_provided():
    """Test that initial_investment is 0 when total_savings is not provided."""
    inputs = ComparisonInput(
        property_value=500000,
        down_payment=100000,
        loan_term_years=30,
        annual_interest_rate=10.0,
        loan_type="SAC",
        rent_value=2000,
        investment_returns=[InvestmentReturnInput(start_month=1, annual_rate=8.0)],
    )

    assert inputs.initial_investment == 0.0


def test_total_savings_validation_must_be_gte_down_payment():
    """Test that total_savings must be >= down_payment."""
    with pytest.raises(ValueError, match="total_savings must be >= down_payment"):
        ComparisonInput(
            property_value=500000,
            down_payment=100000,
            total_savings=50000,  # Less than down_payment - should fail
            loan_term_years=30,
            annual_interest_rate=10.0,
            loan_type="SAC",
            rent_value=2000,
            investment_returns=[InvestmentReturnInput(start_month=1, annual_rate=8.0)],
        )


def test_rent_invest_scenario_uses_initial_investment():
    """Test that rent_invest scenario includes initial_investment in balance."""
    investment_returns = [InvestmentReturnInput(start_month=1, annual_rate=8.0)]
    result = compare_scenarios(
        property_value=500000,
        down_payment=100000,
        loan_term_years=10,
        monthly_interest_rate=0.8,
        loan_type="SAC",
        rent_value=2000,
        investment_returns=investment_returns,
        initial_investment=50000.0,
    )

    rent_scenario = next(s for s in result.scenarios if s.name == "Alugar e investir")

    # Initial investment balance should include both down_payment + initial_investment
    # First month's balance should be at least 150000 (before any returns or rent)
    first_month = rent_scenario.monthly_data[0]
    assert first_month.investment_balance is not None
    assert first_month.investment_balance > 150000  # 100k + 50k + returns


def test_buy_scenario_tracks_opportunity_cost():
    """Test that buy scenario tracks opportunity cost when initial_investment provided."""
    investment_returns = [InvestmentReturnInput(start_month=1, annual_rate=8.0)]
    result = enhanced_compare_scenarios(
        property_value=500000,
        down_payment=100000,
        loan_term_years=10,
        monthly_interest_rate=0.8,
        loan_type="SAC",
        rent_value=2000,
        investment_returns=investment_returns,
        initial_investment=50000.0,
    )

    buy_scenario = next(
        s for s in result.scenarios if s.name == "Comprar com financiamento"
    )

    # Buy scenario should now track investment balance (opportunity cost)
    # Monthly data should have investment_balance for each month
    last_month = buy_scenario.monthly_data[-1]
    assert last_month.investment_balance is not None
    assert last_month.investment_balance > 50000  # Should have grown from initial 50k


def test_comparison_with_no_initial_investment_backward_compatible():
    """Test that comparisons work without initial_investment (backward compat)."""
    investment_returns = [InvestmentReturnInput(start_month=1, annual_rate=8.0)]
    result = compare_scenarios(
        property_value=500000,
        down_payment=100000,
        loan_term_years=10,
        monthly_interest_rate=0.8,
        loan_type="SAC",
        rent_value=2000,
        investment_returns=investment_returns,
        # No initial_investment parameter
    )

    assert result.best_scenario is not None
    assert len(result.scenarios) == 3

    # Rent scenario should start with just down_payment
    rent_scenario = next(s for s in result.scenarios if s.name == "Alugar e investir")
    first_month = rent_scenario.monthly_data[0]
    # With 8% annual rate (~0.64% monthly), 100k should become ~100,640 after first month
    assert first_month.investment_balance is not None
    assert 100000 < first_month.investment_balance < 101000
