import unittest

from app.finance import compare_scenarios
from app.models import InvestmentReturnInput


class TestProgressMilestones(unittest.TestCase):
    def test_invest_buy_progress_fields(self):
        result = compare_scenarios(
            property_value=300000,
            down_payment=50000,
            loan_term_years=5,  # shorter for test speed
            monthly_interest_rate=0.8,
            loan_type="PRICE",
            rent_value=1500,
            investment_returns=[
                InvestmentReturnInput(start_month=1, end_month=None, annual_rate=8.0)
            ],
            invest_loan_difference=True,
            fixed_monthly_investment=1000,
        )
        invest_buy = next(s for s in result.scenarios if "à vista" in s.name)
        # Ensure at least one milestone row
        milestone_rows = [m for m in invest_buy.monthly_data if m.is_milestone]
        self.assertTrue(len(milestone_rows) > 0)
        # Progress fields present
        sample = invest_buy.monthly_data[0]
        self.assertIsNotNone(sample.progress_percent)
        self.assertIsNotNone(sample.shortfall)
        # scenario_type marker present somewhere
        self.assertTrue(
            any(m.scenario_type == "invest_buy" for m in invest_buy.monthly_data)
        )

        # Phase field correctness: all rows before purchase_month are pre_purchase, after are post_purchase
        purchase_month = sample.purchase_month
        if purchase_month:
            pre = [d for d in invest_buy.monthly_data if d.month < purchase_month]
            post = [d for d in invest_buy.monthly_data if d.month >= purchase_month]
            self.assertTrue(pre, "Should have pre-purchase rows")
            self.assertTrue(post, "Should have post-purchase rows")
            self.assertTrue(
                all(d.phase == "pre_purchase" for d in pre),
                "All pre rows must have phase pre_purchase",
            )
            self.assertTrue(
                all(d.phase in ("post_purchase", "pre_purchase") for d in post),
                "Post rows should have phase post_purchase or carry purchase row",
            )
            self.assertTrue(
                any(d.phase == "post_purchase" for d in post),
                "At least one post_purchase phase row expected",
            )
        else:
            # If not purchased, all should be pre_purchase
            self.assertTrue(
                all(d.phase == "pre_purchase" for d in invest_buy.monthly_data),
                "All rows should be pre_purchase when not yet bought",
            )


if __name__ == "__main__":
    unittest.main()
