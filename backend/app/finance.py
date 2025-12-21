"""Core financial calculations for Farol.

This module serves as a facade, providing a unified API for all financial
calculations. It imports from specialized modules in the core/, loans/,
and scenarios/ packages.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
"""

# Re-export core utilities for backward compatibility
from .core.amortization import preprocess_amortizations
from .core.costs import (
    AdditionalCostsCalculator,
    calculate_additional_costs,
)
from .core.fgts import (
    FGTSManager,
)
from .core.inflation import apply_inflation, apply_property_appreciation
from .core.investment import (
    InvestmentCalculator,
)
from .core.rates import convert_interest_rate, get_monthly_investment_rate

# Re-export loan simulators
from .loans import LoanSimulator, PriceLoanSimulator, SACLoanSimulator

# Re-export models that may be needed
from .models import (
    AdditionalCostsInput,
    AmortizationInput,
    ComparisonMetrics,
    ComparisonResult,
    ComparisonScenario,
    EnhancedComparisonResult,
    EnhancedComparisonScenario,
    FGTSInput,
    InvestmentReturnInput,
    InvestmentTaxInput,
    LoanInstallment,
    LoanSimulationResult,
    MonthlyRecord,
)

# Re-export scenario simulators and functions
from .scenarios import (
    BuyScenarioSimulator,
    InvestThenBuyScenarioSimulator,
    RentAndInvestScenarioSimulator,
    ScenarioSimulator,
    compare_scenarios,
    enhanced_compare_scenarios,
    simulate_buy_scenario,
    simulate_invest_then_buy_scenario,
    simulate_rent_and_invest_scenario,
)


def simulate_sac_loan(
    loan_value: float,
    term_months: int,
    monthly_interest_rate: float,
    amortizations: list[AmortizationInput] | None = None,
    annual_inflation_rate: float | None = None,
) -> LoanSimulationResult:
    """Simulate a loan using the SAC (Sistema de Amortização Constante) method.

    Args:
        loan_value: The total loan value.
        term_months: Loan term in months.
        monthly_interest_rate: Monthly interest rate in percentage.
        amortizations: Optional extra amortizations.
        annual_inflation_rate: Annual inflation rate for adjustments.

    Returns:
        LoanSimulationResult with all installments and totals.
    """
    simulator = SACLoanSimulator(
        loan_value=loan_value,
        term_months=term_months,
        monthly_interest_rate=monthly_interest_rate,
        amortizations=amortizations,
        annual_inflation_rate=annual_inflation_rate,
    )
    return simulator.simulate()


def simulate_price_loan(
    loan_value: float,
    term_months: int,
    monthly_interest_rate: float,
    amortizations: list[AmortizationInput] | None = None,
    annual_inflation_rate: float | None = None,
) -> LoanSimulationResult:
    """Simulate a loan using the PRICE (French) method.

    Args:
        loan_value: The total loan value.
        term_months: Loan term in months.
        monthly_interest_rate: Monthly interest rate in percentage.
        amortizations: Optional extra amortizations.
        annual_inflation_rate: Annual inflation rate for adjustments.

    Returns:
        LoanSimulationResult with all installments and totals.
    """
    simulator = PriceLoanSimulator(
        loan_value=loan_value,
        term_months=term_months,
        monthly_interest_rate=monthly_interest_rate,
        amortizations=amortizations,
        annual_inflation_rate=annual_inflation_rate,
    )
    return simulator.simulate()


# Legacy private function aliases for internal compatibility
def _inflated_monthly_additional_costs(
    costs: dict[str, float],
    *,
    month: int,
    inflation_rate: float | None,
) -> tuple[float, float, float]:
    """Get inflation-adjusted monthly additional costs.

    Legacy function for backward compatibility.
    """
    monthly_hoa = apply_inflation(costs["monthly_hoa"], month, 1, inflation_rate)
    monthly_property_tax = apply_inflation(
        costs["monthly_property_tax"], month, 1, inflation_rate
    )
    monthly_additional = monthly_hoa + monthly_property_tax
    return monthly_hoa, monthly_property_tax, monthly_additional


def _current_rent_value(
    rent_value: float,
    *,
    month: int,
    inflation_rate: float | None,
    rent_inflation_rate: float | None,
) -> float:
    """Get inflation-adjusted rent value.

    Legacy function for backward compatibility.
    """
    effective_rent_inflation = (
        rent_inflation_rate if rent_inflation_rate is not None else inflation_rate
    )
    return apply_inflation(rent_value, month, 1, effective_rent_inflation)


def _apply_external_savings_to_cost(
    investment_balance: float,
    *,
    remaining_cost: float,
    monthly_external_savings: float | None,
    invest_external_surplus: bool,
) -> tuple[float, float, float, float]:
    """Apply external savings to cover costs.

    Legacy function for backward compatibility.
    """
    external_cover = 0.0
    external_surplus_invested = 0.0

    if monthly_external_savings and monthly_external_savings > 0:
        external_cover = min(remaining_cost, monthly_external_savings)
        remaining_cost -= external_cover
        surplus = monthly_external_savings - external_cover

        if surplus > 0 and invest_external_surplus:
            investment_balance += surplus
            external_surplus_invested = surplus

    return investment_balance, remaining_cost, external_cover, external_surplus_invested


# For backward compatibility with the original InvestThenBuySimulator class
# that was a dataclass in the original code
InvestThenBuySimulator = InvestThenBuyScenarioSimulator


__all__ = [
    # Core utilities
    "AdditionalCostsCalculator",
    # Models
    "AdditionalCostsInput",
    "AmortizationInput",
    # Scenario simulators
    "BuyScenarioSimulator",
    "ComparisonMetrics",
    "ComparisonResult",
    "ComparisonScenario",
    "EnhancedComparisonResult",
    "EnhancedComparisonScenario",
    "FGTSInput",
    "FGTSManager",
    "InvestThenBuyScenarioSimulator",
    "InvestThenBuySimulator",
    "InvestmentCalculator",
    "InvestmentReturnInput",
    "InvestmentTaxInput",
    "LoanInstallment",
    "LoanSimulationResult",
    # Loan simulators
    "LoanSimulator",
    "MonthlyRecord",
    "PriceLoanSimulator",
    "RentAndInvestScenarioSimulator",
    "SACLoanSimulator",
    "ScenarioSimulator",
    "apply_inflation",
    "apply_property_appreciation",
    "calculate_additional_costs",
    "compare_scenarios",
    "convert_interest_rate",
    "enhanced_compare_scenarios",
    "get_monthly_investment_rate",
    "preprocess_amortizations",
    "simulate_buy_scenario",
    "simulate_invest_then_buy_scenario",
    "simulate_price_loan",
    "simulate_rent_and_invest_scenario",
    "simulate_sac_loan",
]
