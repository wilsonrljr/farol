import sys
import os
import unittest

# Add the parent directory to the path so we can import the app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.finance import (
    convert_interest_rate,
    simulate_sac_loan,
    simulate_price_loan,
    get_monthly_investment_rate,
    simulate_buy_scenario,
    simulate_rent_and_invest_scenario,
    simulate_invest_then_buy_scenario,
    compare_scenarios
)
from app.models import AmortizationInput, InvestmentReturnInput


class TestFinanceCalculations(unittest.TestCase):
    def test_convert_interest_rate(self):
        # Test annual to monthly conversion
        annual_rate, monthly_rate = convert_interest_rate(annual_rate=12.0)
        self.assertAlmostEqual(monthly_rate, 0.9489, places=4)
        
        # Test monthly to annual conversion
        annual_rate, monthly_rate = convert_interest_rate(monthly_rate=1.0)
        self.assertAlmostEqual(annual_rate, 12.6825, places=4)
        
        # Test error when no rate is provided
        with self.assertRaises(ValueError):
            convert_interest_rate()
    
    def test_simulate_sac_loan(self):
        # Test SAC loan simulation
        loan_value = 300000
        term_months = 360
        monthly_interest_rate = 1.0
        
        result = simulate_sac_loan(loan_value, term_months, monthly_interest_rate)
        
        # Check basic properties
        self.assertEqual(result.loan_value, loan_value)
        self.assertEqual(len(result.installments), term_months)
        
        # Check first installment
        first = result.installments[0]
        self.assertEqual(first.month, 1)
        self.assertAlmostEqual(first.amortization, loan_value / term_months)
        self.assertAlmostEqual(first.interest, loan_value * 0.01)
        self.assertAlmostEqual(first.installment, first.amortization + first.interest)
        
        # Check last installment
        last = result.installments[-1]
        self.assertEqual(last.month, term_months)
        self.assertAlmostEqual(last.outstanding_balance, 0, places=2)
    
    def test_simulate_price_loan(self):
        # Test PRICE loan simulation
        loan_value = 300000
        term_months = 360
        monthly_interest_rate = 1.0
        
        result = simulate_price_loan(loan_value, term_months, monthly_interest_rate)
        
        # Check basic properties
        self.assertEqual(result.loan_value, loan_value)
        self.assertEqual(len(result.installments), term_months)
        
        # Check installment consistency (should be constant)
        first_installment = result.installments[0].installment
        for inst in result.installments[1:10]:  # Check first 10 installments
            self.assertAlmostEqual(inst.installment, first_installment, places=2)
        
        # Check last installment
        last = result.installments[-1]
        self.assertEqual(last.month, term_months)
        self.assertAlmostEqual(last.outstanding_balance, 0, places=2)
    
    def test_simulate_with_amortizations(self):
        # Test loan simulation with extra amortizations
        loan_value = 300000
        term_months = 360
        monthly_interest_rate = 1.0
        amortizations = [
            AmortizationInput(month=12, value=50000),
            AmortizationInput(month=24, value=50000)
        ]
        
        # Test SAC with amortizations
        sac_result = simulate_sac_loan(loan_value, term_months, monthly_interest_rate, amortizations)
        
        # The loan should be paid off earlier
        self.assertLess(len(sac_result.installments), term_months)
        
        # Test PRICE with amortizations
        price_result = simulate_price_loan(loan_value, term_months, monthly_interest_rate, amortizations)
        
        # The loan should be paid off earlier
        self.assertLess(len(price_result.installments), term_months)

    def test_recurring_amortizations_percentage_and_fixed(self):
        loan_value = 200000
        term_months = 240
        monthly_interest_rate = 1.0
        amortizations = [
            # Annual fixed 10000 for 5 years
            AmortizationInput(month=12, value=10000, interval_months=12, occurrences=5, value_type="fixed"),
            # Every 6 months 2% of outstanding for first 3 years
            AmortizationInput(month=6, value=2.0, interval_months=6, end_month=36, value_type="percentage"),
        ]
        sac_result = simulate_sac_loan(loan_value, term_months, monthly_interest_rate, amortizations)
        # Should reduce term significantly (arbitrary expectation: < original term)
        self.assertLess(len(sac_result.installments), term_months)
        # Validate percentage amortization applied (some installments will have extra_amortization > fixed schedule)
        extras = [i.extra_amortization for i in sac_result.installments if i.month % 6 == 0 and i.month <= 36]
        self.assertTrue(any(e > 0 for e in extras))

    def test_multiple_amortizations_same_month(self):
        loan_value = 100000
        term_months = 120
        monthly_interest_rate = 1.0
        # Two events same month should sum
        amortizations = [
            AmortizationInput(month=12, value=5000),
            AmortizationInput(month=12, value=3000),
        ]
        price_result = simulate_price_loan(loan_value, term_months, monthly_interest_rate, amortizations)
        # Find month 12 installment extra amortization ~ 8000 (allow tiny rounding)
        inst12 = next(i for i in price_result.installments if i.month == 12)
        self.assertAlmostEqual(inst12.extra_amortization, 8000, delta=1)
    
    def test_get_monthly_investment_rate(self):
        # Test getting monthly investment rate
        investment_returns = [
            InvestmentReturnInput(start_month=1, end_month=12, annual_rate=10.0),
            InvestmentReturnInput(start_month=13, end_month=None, annual_rate=8.0)
        ]
        
        # Test first period
        rate = get_monthly_investment_rate(investment_returns, 6)
        self.assertAlmostEqual(rate, 0.007974, places=6)  # ~0.8% monthly
        
        # Test second period
        rate = get_monthly_investment_rate(investment_returns, 24)
        self.assertAlmostEqual(rate, 0.006434, places=6)  # ~0.64% monthly
        
        # Test period not found
        rate = get_monthly_investment_rate([], 1)
        self.assertEqual(rate, 0.0)
    
    def test_compare_scenarios(self):
        # Test scenario comparison
        property_value = 500000
        down_payment = 100000
        loan_term_years = 30
        monthly_interest_rate = 0.8
        loan_type = "PRICE"
        rent_value = 2000
        investment_returns = [
            InvestmentReturnInput(start_month=1, end_month=None, annual_rate=8.0)
        ]
        
        result = compare_scenarios(
            property_value,
            down_payment,
            loan_term_years,
            monthly_interest_rate,
            loan_type,
            rent_value,
            investment_returns
        )
        
        # Check that we have 3 scenarios
        self.assertEqual(len(result.scenarios), 3)
        
        # Check scenario names
        scenario_names = [s.name for s in result.scenarios]
        self.assertIn("Comprar com financiamento", scenario_names)
        self.assertIn("Alugar e investir", scenario_names)
        self.assertIn("Investir e comprar à vista", scenario_names)
        
        # Check that best_scenario is one of the scenario names
        self.assertIn(result.best_scenario, scenario_names)


if __name__ == '__main__':
    unittest.main()
