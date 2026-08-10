"""Tests for bonus and 13_salario amortization funding sources.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

These tests verify that:
1. Bonus and 13_salario amortizations are correctly tracked separately
2. They are included in total amortization but tracked in separate fields
3. The values appear correctly in MonthlyRecord outputs
"""

import pytest

from backend.app.scenarios.buy import BuyScenarioSimulator


class MockAmortization:
    """Mock amortization for testing."""

    def __init__(
        self,
        month: int,
        value: float,
        funding_source: str = "cash",
        value_type: str = "fixed",
        inflation_adjust: bool = False,
        interval_months: int | None = None,
        occurrences: int | None = None,
        end_month: int | None = None,
    ):
        self.month = month
        self.value = value
        self.funding_source = funding_source
        self.value_type = value_type
        self.inflation_adjust = inflation_adjust
        self.interval_months = interval_months
        self.occurrences = occurrences
        self.end_month = end_month


class TestBonusAnd13SalarioAmortizations:
    """Test suite for bonus and 13_salario funding sources."""

    def test_bonus_amortization_tracked_separately(self):
        """Bonus amortizations should appear in extra_amortization_bonus field."""
        simulator = BuyScenarioSimulator(
            property_value=500_000,
            down_payment=100_000,
            loan_term_years=10,
            monthly_interest_rate=0.8,
            loan_type="SAC",
            amortizations=[
                MockAmortization(month=6, value=5000, funding_source="bonus"),
            ],
        )

        result = simulator.simulate_domain()

        # Find month 6
        month_6 = next((m for m in result.monthly_data if m.month == 6), None)
        assert month_6 is not None

        # Bonus should be tracked separately
        assert month_6.extra_amortization_bonus == 5000
        # 13_salario should be None or 0
        assert month_6.extra_amortization_13_salario in (None, 0)

    def test_13_salario_amortization_tracked_separately(self):
        """13_salario amortizations should appear in extra_amortization_13_salario field."""
        simulator = BuyScenarioSimulator(
            property_value=500_000,
            down_payment=100_000,
            loan_term_years=10,
            monthly_interest_rate=0.8,
            loan_type="SAC",
            amortizations=[
                MockAmortization(month=12, value=10000, funding_source="13_salario"),
            ],
        )

        result = simulator.simulate_domain()

        # Find month 12
        month_12 = next((m for m in result.monthly_data if m.month == 12), None)
        assert month_12 is not None

        # 13_salario should be tracked separately
        assert month_12.extra_amortization_13_salario == 10000
        # Bonus should be None or 0
        assert month_12.extra_amortization_bonus in (None, 0)

    def test_recurring_bonus_amortization(self):
        """Recurring bonus amortizations should appear in correct months."""
        simulator = BuyScenarioSimulator(
            property_value=500_000,
            down_payment=100_000,
            loan_term_years=3,
            monthly_interest_rate=0.8,
            loan_type="SAC",
            amortizations=[
                # Bonus every 6 months starting at month 6
                MockAmortization(
                    month=6,
                    value=5000,
                    funding_source="bonus",
                    interval_months=6,
                    occurrences=3,
                ),
            ],
        )

        result = simulator.simulate_domain()

        # Check months 6, 12, and 18
        for target_month in [6, 12, 18]:
            month_data = next(
                (m for m in result.monthly_data if m.month == target_month), None
            )
            assert month_data is not None, f"Month {target_month} not found"
            assert month_data.extra_amortization_bonus == 5000, (
                f"Expected 5000 bonus at month {target_month}"
            )

    def test_mixed_funding_sources(self):
        """Multiple funding sources should be tracked independently."""
        simulator = BuyScenarioSimulator(
            property_value=500_000,
            down_payment=100_000,
            loan_term_years=2,
            monthly_interest_rate=0.8,
            loan_type="SAC",
            amortizations=[
                MockAmortization(month=6, value=5000, funding_source="cash"),
                MockAmortization(month=6, value=3000, funding_source="bonus"),
                MockAmortization(month=12, value=10000, funding_source="13_salario"),
            ],
        )

        result = simulator.simulate_domain()

        # Check month 6
        month_6 = next((m for m in result.monthly_data if m.month == 6), None)
        assert month_6 is not None
        assert month_6.extra_amortization_cash >= 5000  # At least the cash amount
        assert month_6.extra_amortization_bonus == 3000

        # Check month 12
        month_12 = next((m for m in result.monthly_data if m.month == 12), None)
        assert month_12 is not None
        assert month_12.extra_amortization_13_salario == 10000

    def test_bonus_13_salario_affect_loan_simulation(self):
        """Bonus and 13_salario should reduce the loan balance like cash."""
        # Simulator without amortizations
        simulator_no_amort = BuyScenarioSimulator(
            property_value=500_000,
            down_payment=100_000,
            loan_term_years=5,
            monthly_interest_rate=0.8,
            loan_type="SAC",
        )
        result_no_amort = simulator_no_amort.simulate_domain()

        # Simulator with bonus amortization
        simulator_with_bonus = BuyScenarioSimulator(
            property_value=500_000,
            down_payment=100_000,
            loan_term_years=5,
            monthly_interest_rate=0.8,
            loan_type="SAC",
            amortizations=[
                MockAmortization(month=6, value=50000, funding_source="bonus"),
            ],
        )
        result_with_bonus = simulator_with_bonus.simulate_domain()

        # After the bonus amortization, the outstanding balance should be lower
        month_7_no_amort = next(
            (m for m in result_no_amort.monthly_data if m.month == 7), None
        )
        month_7_with_bonus = next(
            (m for m in result_with_bonus.monthly_data if m.month == 7), None
        )

        assert month_7_no_amort is not None
        assert month_7_with_bonus is not None
        assert (
            month_7_with_bonus.outstanding_balance
            < month_7_no_amort.outstanding_balance
        )

    def test_capped_bonus_reports_only_the_amount_actually_applied(self):
        """A bonus request larger than the debt must not erase the base payment."""

        result = BuyScenarioSimulator(
            property_value=1_200,
            down_payment=0,
            loan_term_years=1,
            monthly_interest_rate=0,
            loan_type="SAC",
            amortizations=[
                MockAmortization(month=1, value=10_000, funding_source="bonus"),
            ],
        ).simulate_domain()

        month_1 = result.monthly_data[0]
        assert month_1.installment == pytest.approx(1_200)
        assert month_1.extra_amortization == pytest.approx(1_100)
        assert month_1.extra_amortization_bonus == pytest.approx(1_100)
        assert month_1.installment_base == pytest.approx(100)
        assert month_1.principal_base == pytest.approx(100)
        assert month_1.housing_due == pytest.approx(100)

    def test_capped_percentage_sources_are_allocated_without_double_counting(self):
        """Percentage schedules retain their sources when their sum is capped."""

        result = BuyScenarioSimulator(
            property_value=1_200,
            down_payment=0,
            loan_term_years=1,
            monthly_interest_rate=0,
            loan_type="SAC",
            amortizations=[
                MockAmortization(
                    month=1,
                    value=50,
                    value_type="percentage",
                    funding_source="bonus",
                ),
                MockAmortization(
                    month=1,
                    value=50,
                    value_type="percentage",
                    funding_source="13_salario",
                ),
            ],
        ).simulate_domain()

        month_1 = result.monthly_data[0]
        assert month_1.extra_amortization == pytest.approx(1_100)
        assert month_1.extra_amortization_bonus == pytest.approx(550)
        assert month_1.extra_amortization_13_salario == pytest.approx(550)
        assert month_1.extra_amortization_cash == pytest.approx(0)
        assert month_1.installment_base == pytest.approx(100)
        assert (
            (month_1.extra_amortization_cash or 0)
            + (month_1.extra_amortization_bonus or 0)
            + (month_1.extra_amortization_13_salario or 0)
        ) == pytest.approx(month_1.extra_amortization)
