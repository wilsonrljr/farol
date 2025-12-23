"""Tests for correct outflow accounting in invest_then_buy scenario.

These tests verify that total_monthly_cost correctly includes all cash outflows,
especially in the purchase month and post-purchase months.
"""

import pytest

from backend.app.scenarios.invest_then_buy import InvestThenBuyScenarioSimulator
from backend.app.models import InvestmentReturnInput


class TestInvestBuyOutflowAccounting:
    """Tests for outflow accounting in invest_then_buy scenario."""

    def test_post_purchase_months_have_total_monthly_cost(self):
        """Verify that post-purchase months have total_monthly_cost set (not None)."""
        # Setup: large initial balance to purchase immediately
        # Use initial_investment to provide extra funds beyond down_payment
        simulator = InvestThenBuyScenarioSimulator(
            property_value=500_000,
            down_payment=100_000,
            initial_investment=500_000,  # Extra funds to enable immediate purchase
            term_months=24,
            rent_value=2_000,
            investment_returns=[InvestmentReturnInput(start_month=1, annual_rate=10.0)],
            fixed_monthly_investment=1_000,
        )

        result = simulator.simulate_domain()

        # Purchase should happen in month 1
        assert result.monthly_data[0].status == "Imóvel comprado"

        # All post-purchase months should have total_monthly_cost set
        for record in result.monthly_data[1:]:
            assert (
                record.total_monthly_cost is not None
            ), f"Month {record.month} should have total_monthly_cost set"
            # Post-purchase costs should include fixed_monthly_investment (1000)
            # plus any monthly additional costs (HOA/IPTU)
            assert record.total_monthly_cost >= 1_000, (
                f"Month {record.month} total_monthly_cost should include "
                f"fixed_monthly_investment of 1000"
            )

    def test_purchase_month_includes_fixed_investment_in_outflow(self):
        """Verify that the purchase month includes fixed_monthly_investment in outflows."""
        # Setup: large initial balance to purchase immediately
        simulator = InvestThenBuyScenarioSimulator(
            property_value=500_000,
            down_payment=100_000,
            initial_investment=500_000,  # Extra funds to enable immediate purchase
            term_months=12,
            rent_value=2_000,
            investment_returns=[InvestmentReturnInput(start_month=1, annual_rate=10.0)],
            fixed_monthly_investment=5_000,
            fixed_investment_start_month=1,
        )

        result = simulator.simulate_domain()

        # Purchase should happen in month 1
        purchase_record = result.monthly_data[0]
        assert purchase_record.status == "Imóvel comprado"

        # total_monthly_cost should include the fixed_monthly_investment (5000)
        # even though purchase happened in the same month
        assert purchase_record.total_monthly_cost is not None
        assert purchase_record.total_monthly_cost >= 5_000, (
            f"Purchase month total_monthly_cost ({purchase_record.total_monthly_cost}) "
            f"should include fixed_monthly_investment of 5000"
        )

    def test_total_outflows_matches_sum_of_monthly_costs(self):
        """Verify that total_outflows equals sum of all total_monthly_cost values."""
        simulator = InvestThenBuyScenarioSimulator(
            property_value=500_000,
            down_payment=100_000,
            initial_investment=500_000,
            term_months=12,
            rent_value=2_000,
            investment_returns=[InvestmentReturnInput(start_month=1, annual_rate=10.0)],
            fixed_monthly_investment=1_000,
        )

        result = simulator.simulate_domain()

        # Sum all total_monthly_cost values
        sum_monthly_costs = sum(
            d.total_monthly_cost or 0.0 for d in result.monthly_data
        )

        assert result.total_outflows == pytest.approx(sum_monthly_costs, rel=1e-6), (
            f"total_outflows ({result.total_outflows}) should equal "
            f"sum of total_monthly_cost ({sum_monthly_costs})"
        )

    def test_fixed_investment_not_started_yet(self):
        """Verify that fixed_monthly_investment is not counted before start_month."""
        simulator = InvestThenBuyScenarioSimulator(
            property_value=500_000,
            down_payment=100_000,
            initial_investment=500_000,
            term_months=12,
            rent_value=2_000,
            investment_returns=[InvestmentReturnInput(start_month=1, annual_rate=10.0)],
            fixed_monthly_investment=5_000,
            fixed_investment_start_month=6,  # Start only from month 6
        )

        result = simulator.simulate_domain()

        # Purchase happens in month 1, but fixed investment starts at month 6
        purchase_record = result.monthly_data[0]
        assert purchase_record.status == "Imóvel comprado"

        # Month 1 should NOT include the fixed_monthly_investment
        # (only initial deposit and possibly ownership costs)
        # Since fixed_investment_start_month=6, month 1 should not have 5000 from investment
        # The total_monthly_cost should be less than 5000 + down_payment
        # This test ensures we don't incorrectly add fixed investment before start_month

        # Months 1-5: no fixed investment
        for record in result.monthly_data[:5]:
            if record.additional_investment is not None:
                # fixed_monthly_investment shouldn't appear before month 6
                assert record.additional_investment < 5_000 or record.month >= 6

        # Months 6+: should include fixed investment
        for record in result.monthly_data[5:]:
            assert (
                record.additional_investment == 5_000
            ), f"Month {record.month} should have additional_investment of 5000"
