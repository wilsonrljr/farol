"""Financial calculations entrypoints.

This module intentionally exposes only the small surface area used by the
FastAPI routers (loan simulation). Scenario simulation and comparison live in
backend.app.scenarios.

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

from collections.abc import Sequence

from .core.protocols import AmortizationLike
from .loans import PriceLoanSimulator, SACLoanSimulator
from .models import AmortizationInput, LoanSimulationResult


def simulate_sac_loan(
    loan_value: float,
    term_months: int,
    monthly_interest_rate: float,
    amortizations: Sequence[AmortizationLike] | None = None,
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
    amortizations: Sequence[AmortizationLike] | None = None,
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


__all__ = [
    "AmortizationInput",
    "LoanSimulationResult",
    "simulate_price_loan",
    "simulate_sac_loan",
]
