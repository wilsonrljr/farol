"""Tests for the FIRE (Financial Independence) calculator."""

import os
import sys

import pytest

# Add the parent directory to the path so we can import the app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.fire import plan_fire
from app.models import FIREPlanInput


class TestFIREBasic:
    """Basic FIRE calculation tests."""

    def test_fire_number_calculation(self):
        """FIRE number should be annual expenses / SWR."""
        result = plan_fire(
            FIREPlanInput(
                monthly_expenses=5000,
                current_portfolio=0,
                monthly_contribution=0,
                horizon_months=12,
                annual_return_rate=0,
                safe_withdrawal_rate=4.0,
            )
        )
        # FIRE number = 5000 * 12 / 0.04 = 1,500,000
        assert result.fire_number == pytest.approx(1_500_000, rel=0.01)

    def test_fi_achieved_immediately(self):
        """FI should be achieved immediately if portfolio >= FIRE number."""
        result = plan_fire(
            FIREPlanInput(
                monthly_expenses=5000,
                current_portfolio=2_000_000,
                monthly_contribution=0,
                horizon_months=12,
                annual_return_rate=0,
                safe_withdrawal_rate=4.0,
            )
        )
        assert result.fi_achieved is True
        assert result.fi_month == 1
        assert result.months_to_fi == 0

    def test_fi_not_achieved(self):
        """FI not achieved when portfolio never reaches FIRE number."""
        result = plan_fire(
            FIREPlanInput(
                monthly_expenses=10000,
                current_portfolio=100_000,
                monthly_contribution=1000,
                horizon_months=24,  # 2 years
                annual_return_rate=0,
                safe_withdrawal_rate=4.0,
            )
        )
        # FIRE number = 10000 * 12 / 0.04 = 3,000,000
        # After 24 months: 100,000 + 24*1000 = 124,000 (nowhere near)
        assert result.fi_achieved is False
        assert result.fi_month is None

    def test_portfolio_growth_with_returns(self):
        """Portfolio should grow with investment returns."""
        result = plan_fire(
            FIREPlanInput(
                monthly_expenses=5000,
                current_portfolio=100_000,
                monthly_contribution=0,
                horizon_months=12,
                annual_return_rate=12.0,  # ~1% monthly
                safe_withdrawal_rate=4.0,
            )
        )
        # After 12 months with ~12% return
        assert result.final_portfolio > 100_000
        assert result.total_investment_returns > 0

    def test_contributions_accumulate(self):
        """Contributions should be tracked correctly."""
        result = plan_fire(
            FIREPlanInput(
                monthly_expenses=5000,
                current_portfolio=0,
                monthly_contribution=5000,
                horizon_months=12,
                annual_return_rate=0,
                safe_withdrawal_rate=4.0,
            )
        )
        assert result.total_contributions == 12 * 5000

    def test_passive_income_calculation(self):
        """Passive income should be portfolio * SWR / 12."""
        result = plan_fire(
            FIREPlanInput(
                monthly_expenses=5000,
                current_portfolio=1_200_000,
                monthly_contribution=0,
                horizon_months=1,
                annual_return_rate=0,
                safe_withdrawal_rate=4.0,
            )
        )
        # Passive income = 1,200,000 * 0.04 / 12 = 4,000
        expected_passive = 1_200_000 * 0.04 / 12
        assert result.monthly_data[0].monthly_passive_income == pytest.approx(
            expected_passive, rel=0.01
        )


class TestFIREWithInflation:
    """FIRE calculation tests with inflation."""

    def test_fire_number_increases_with_inflation(self):
        """FIRE number should increase over time with inflation."""
        result = plan_fire(
            FIREPlanInput(
                monthly_expenses=5000,
                current_portfolio=0,
                monthly_contribution=0,
                horizon_months=120,  # 10 years
                annual_return_rate=0,
                annual_inflation_rate=5.0,
                safe_withdrawal_rate=4.0,
            )
        )
        first_fire_number = result.monthly_data[0].fire_number
        last_fire_number = result.monthly_data[-1].fire_number
        assert last_fire_number > first_fire_number


class TestFIREModes:
    """Tests for different FIRE modes."""

    def test_barista_fire_reduces_fire_number(self):
        """Barista FIRE should reduce the required FIRE number."""
        traditional = plan_fire(
            FIREPlanInput(
                monthly_expenses=5000,
                current_portfolio=500_000,
                monthly_contribution=0,
                horizon_months=12,
                annual_return_rate=0,
                safe_withdrawal_rate=4.0,
                fire_mode="traditional",
            )
        )
        barista = plan_fire(
            FIREPlanInput(
                monthly_expenses=5000,
                current_portfolio=500_000,
                monthly_contribution=0,
                horizon_months=12,
                annual_return_rate=0,
                safe_withdrawal_rate=4.0,
                fire_mode="barista",
                barista_monthly_income=2000,  # covers 40% of expenses
            )
        )
        # Barista FIRE number should be lower since part-time income covers some expenses
        assert barista.fire_number < traditional.fire_number

    def test_coast_fire_stops_contributions(self):
        """Coast FIRE should stop contributions after reaching coast number."""
        result = plan_fire(
            FIREPlanInput(
                monthly_expenses=3000,
                current_portfolio=500_000,
                monthly_contribution=5000,
                horizon_months=360,
                annual_return_rate=8.0,
                safe_withdrawal_rate=4.0,
                fire_mode="coast",
                current_age=30,
                coast_fire_age=35,  # Stop contributing at 35
                target_retirement_age=65,
            )
        )
        # Should have coast_fire_number calculated
        assert result.coast_fire_number is not None
        # Contributions after coast age should be 0
        # Month 60 = 5 years = age 35
        month_60_data = result.monthly_data[59]  # 0-indexed
        # Check if coast was achieved
        if result.coast_fire_achieved:
            # Find a month after coast where contribution should be 0
            later_months = [m for m in result.monthly_data if m.month > 60]
            if later_months:
                assert later_months[0].contribution == 0


class TestFIREAge:
    """Tests for age-related calculations."""

    def test_age_progression(self):
        """Age should progress correctly through the simulation."""
        result = plan_fire(
            FIREPlanInput(
                monthly_expenses=5000,
                current_portfolio=100_000,
                monthly_contribution=5000,
                horizon_months=24,
                annual_return_rate=8.0,
                safe_withdrawal_rate=4.0,
                current_age=30,
            )
        )
        assert result.monthly_data[0].age == pytest.approx(30.0, rel=0.01)
        # After 12 months, age should be ~31
        assert result.monthly_data[11].age == pytest.approx(30.917, rel=0.01)
        # After 24 months, age should be ~32
        assert result.monthly_data[23].age == pytest.approx(31.917, rel=0.01)

    def test_fi_age_calculated(self):
        """FI age should be calculated when current_age is provided."""
        result = plan_fire(
            FIREPlanInput(
                monthly_expenses=3000,
                current_portfolio=800_000,
                monthly_contribution=10000,
                horizon_months=120,
                annual_return_rate=8.0,
                safe_withdrawal_rate=4.0,
                current_age=35,
            )
        )
        if result.fi_achieved:
            assert result.fi_age is not None
            assert result.fi_age > 35
