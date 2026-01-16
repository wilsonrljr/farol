"""Tests for the annual inflation adjustment logic.

Inflation adjustments in real life happen annually, not monthly.
For example:
- Rent increases once per year
- Salary adjustments happen once per year
- HOA fees are adjusted annually

This is different from property appreciation, which compounds continuously.
"""

import pytest

from backend.app.core.inflation import apply_inflation, apply_property_appreciation


class TestApplyInflationAnnual:
    """Tests for the apply_inflation function with annual adjustments."""

    def test_no_inflation_within_first_year(self):
        """Value should stay constant for the first 12 months."""
        base_value = 1000.0
        annual_rate = 10.0  # 10% per year

        # Months 1-12 should all return the base value
        for month in range(1, 13):
            result = apply_inflation(base_value, month, 1, annual_rate)
            assert result == base_value, f"Month {month} should equal base value"

    def test_inflation_applied_at_month_13(self):
        """Value should increase at the start of the second year."""
        base_value = 1000.0
        annual_rate = 10.0

        # Month 13 is the first month of year 2
        result = apply_inflation(base_value, 13, 1, annual_rate)
        expected = 1000.0 * 1.10  # 10% increase
        assert result == pytest.approx(expected)

    def test_inflation_constant_throughout_second_year(self):
        """Value should stay constant within the second year (months 13-24)."""
        base_value = 1000.0
        annual_rate = 10.0
        expected = 1000.0 * 1.10

        for month in range(13, 25):
            result = apply_inflation(base_value, month, 1, annual_rate)
            assert result == pytest.approx(
                expected
            ), f"Month {month} should be {expected}"

    def test_inflation_compounds_annually(self):
        """Inflation should compound year over year."""
        base_value = 1000.0
        annual_rate = 10.0

        # Year 1 (months 1-12): 1000.00
        # Year 2 (months 13-24): 1100.00
        # Year 3 (months 25-36): 1210.00

        assert apply_inflation(base_value, 1, 1, annual_rate) == 1000.0
        assert apply_inflation(base_value, 12, 1, annual_rate) == 1000.0
        assert apply_inflation(base_value, 13, 1, annual_rate) == pytest.approx(1100.0)
        assert apply_inflation(base_value, 24, 1, annual_rate) == pytest.approx(1100.0)
        assert apply_inflation(base_value, 25, 1, annual_rate) == pytest.approx(1210.0)
        assert apply_inflation(base_value, 36, 1, annual_rate) == pytest.approx(1210.0)

    def test_inflation_with_custom_base_month(self):
        """Inflation calculation should respect custom base month."""
        base_value = 1000.0
        annual_rate = 10.0

        # Starting from month 6, inflation kicks in at month 18 (12 months later)
        assert apply_inflation(base_value, 6, 6, annual_rate) == 1000.0  # Same month
        assert apply_inflation(base_value, 17, 6, annual_rate) == 1000.0  # Still year 1
        assert apply_inflation(base_value, 18, 6, annual_rate) == pytest.approx(
            1100.0
        )  # Year 2

    def test_no_inflation_when_rate_is_zero(self):
        """Zero inflation rate should return unchanged value."""
        base_value = 1000.0
        assert apply_inflation(base_value, 100, 1, 0.0) == base_value

    def test_no_inflation_when_rate_is_none(self):
        """None inflation rate should return unchanged value."""
        base_value = 1000.0
        assert apply_inflation(base_value, 100, 1, None) == base_value

    def test_negative_months_passed_returns_base_value(self):
        """If month < base_month, return unchanged value."""
        base_value = 1000.0
        assert apply_inflation(base_value, 5, 10, 10.0) == base_value


class TestApplyPropertyAppreciation:
    """Tests for property appreciation (which should compound monthly)."""

    def test_property_appreciation_compounds_monthly(self):
        """Property appreciation should compound every month, unlike inflation."""
        base_value = 500_000.0
        annual_rate = 12.0  # ~1% monthly

        # Month 1: base value
        assert apply_property_appreciation(base_value, 1, 1, annual_rate) == base_value

        # Month 2: should be higher than month 1 (monthly compounding)
        month2 = apply_property_appreciation(base_value, 2, 1, annual_rate)
        assert month2 > base_value

        # Month 12: should have 11 months of compounding
        month12 = apply_property_appreciation(base_value, 12, 1, annual_rate)
        assert month12 > month2

        # Month 13: continues compounding monthly
        month13 = apply_property_appreciation(base_value, 13, 1, annual_rate)
        assert month13 > month12

    def test_appreciation_over_one_year_equals_annual_rate(self):
        """After 12 months, property should appreciate by approximately the annual rate."""
        base_value = 500_000.0
        annual_rate = 12.0

        # After 12 months (end of year 1)
        month12 = apply_property_appreciation(base_value, 12, 1, annual_rate)
        # Should be approximately 12% higher (accounting for compounding)
        expected = base_value * (1 + 0.12)
        assert month12 == pytest.approx(expected, rel=0.01)


class TestInflationVsAppreciation:
    """Compare inflation (annual step) vs appreciation (monthly compound)."""

    def test_inflation_and_appreciation_differ_mid_year(self):
        """Within the first year, inflation is flat but appreciation grows."""
        base_value = 1000.0
        rate = 12.0

        # At month 6:
        # - Inflation should still be at base value
        # - Property appreciation should have grown

        inflation_m6 = apply_inflation(base_value, 6, 1, rate)
        appreciation_m6 = apply_property_appreciation(base_value, 6, 1, rate)

        assert inflation_m6 == base_value  # No change within first year
        assert appreciation_m6 > base_value  # Continuous growth


class TestRealWorldScenarios:
    """Tests that validate real-world behavior."""

    def test_rent_stays_constant_for_12_months(self):
        """Rent contract typically adjusts once per year."""
        monthly_rent = 2000.0
        annual_adjustment = 5.0  # 5% annual adjustment (like IGPM or IPCA)

        # Simulate 24 months of rent
        rents = [
            apply_inflation(monthly_rent, m, 1, annual_adjustment) for m in range(1, 25)
        ]

        # First 12 months: constant at 2000
        assert all(r == monthly_rent for r in rents[:12])

        # Months 13-24: constant at 2100
        assert all(r == pytest.approx(monthly_rent * 1.05) for r in rents[12:])

    def test_salary_adjusted_annually(self):
        """Income adjustments typically happen once per year."""
        base_salary = 5000.0
        annual_raise = 8.0

        # Year 1: 5000
        # Year 2: 5400
        # Year 3: 5832

        for month in range(1, 13):
            assert apply_inflation(base_salary, month, 1, annual_raise) == base_salary

        for month in range(13, 25):
            assert apply_inflation(
                base_salary, month, 1, annual_raise
            ) == pytest.approx(5400.0)

        for month in range(25, 37):
            assert apply_inflation(
                base_salary, month, 1, annual_raise
            ) == pytest.approx(5832.0)

    def test_hoa_fees_adjusted_annually(self):
        """HOA fees (condomínio) typically adjust once per year."""
        base_hoa = 800.0
        annual_increase = 6.0

        # First year constant
        assert apply_inflation(base_hoa, 1, 1, annual_increase) == base_hoa
        assert apply_inflation(base_hoa, 12, 1, annual_increase) == base_hoa

        # Second year increases
        assert apply_inflation(base_hoa, 13, 1, annual_increase) == pytest.approx(848.0)
