"""Buy with financing scenario simulator.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

from dataclasses import dataclass, field

from ..core.inflation import apply_inflation
from ..loans import PriceLoanSimulator, SACLoanSimulator
from ..models import (
    AdditionalCostsInput,
    AmortizationInput,
    ComparisonScenario,
    FGTSInput,
    LoanSimulationResult,
    MonthlyRecord,
)
from .base import ScenarioSimulator


@dataclass
class BuyScenarioSimulator(ScenarioSimulator):
    """Simulator for buying a property with financing.

    Calculates costs and equity evolution when purchasing
    with a mortgage loan (SAC or PRICE).
    """

    loan_term_years: int = field(default=0)
    monthly_interest_rate: float = field(default=0.0)
    loan_type: str = field(default="SAC")
    amortizations: list[AmortizationInput] | None = field(default=None)

    # Internal state
    _loan_result: LoanSimulationResult | None = field(init=False, default=None)
    _fgts_used_at_purchase: float = field(init=False, default=0.0)
    _loan_value: float = field(init=False, default=0.0)
    _total_upfront_costs: float = field(init=False, default=0.0)
    _total_monthly_additional_costs: float = field(init=False, default=0.0)

    @property
    def scenario_name(self) -> str:
        """Name of the scenario in Portuguese."""
        return "Comprar com financiamento"

    @property
    def term_months(self) -> int:
        """Total term in months."""
        return self.loan_term_years * 12

    @term_months.setter
    def term_months(self, value: int) -> None:
        """Set term_months (required for dataclass)."""
        self.loan_term_years = value // 12

    def simulate(self) -> ComparisonScenario:
        """Run the buy scenario simulation."""
        self._prepare_simulation()
        self._simulate_loan()
        self._generate_monthly_data()
        return self._build_result()

    def _prepare_simulation(self) -> None:
        """Prepare simulation parameters."""
        self._total_upfront_costs = self._costs["total_upfront"]
        self._calculate_fgts_usage()
        self._calculate_loan_value()

    def _calculate_fgts_usage(self) -> None:
        """Calculate FGTS usage for purchase."""
        if self._fgts_manager is None:
            self._fgts_used_at_purchase = 0.0
            return

        max_needed = max(0.0, self.property_value - self.down_payment)
        self._fgts_used_at_purchase = self._fgts_manager.withdraw_for_purchase(
            max_needed
        )

    def _calculate_loan_value(self) -> None:
        """Calculate loan value after down payment and FGTS."""
        self._loan_value = (
            self.property_value - self.down_payment - self._fgts_used_at_purchase
        )
        if self._loan_value < 0:
            self._loan_value = 0.0

    def _simulate_loan(self) -> None:
        """Simulate the loan using appropriate method."""
        term_months = self.loan_term_years * 12

        if self.loan_type == "SAC":
            simulator = SACLoanSimulator(
                loan_value=self._loan_value,
                term_months=term_months,
                monthly_interest_rate=self.monthly_interest_rate,
                amortizations=self.amortizations,
                annual_inflation_rate=self.inflation_rate,
            )
        else:
            simulator = PriceLoanSimulator(
                loan_value=self._loan_value,
                term_months=term_months,
                monthly_interest_rate=self.monthly_interest_rate,
                amortizations=self.amortizations,
                annual_inflation_rate=self.inflation_rate,
            )

        self._loan_result = simulator.simulate()

    def _generate_monthly_data(self) -> None:
        """Generate monthly data records."""
        if self._loan_result is None:
            return

        self._monthly_data = []
        self._total_monthly_additional_costs = 0.0

        for inst in self._loan_result.installments:
            month = inst.month
            self.accumulate_fgts()

            monthly_hoa, monthly_property_tax, monthly_additional = (
                self.get_inflated_monthly_costs(month)
            )
            self._total_monthly_additional_costs += monthly_additional

            record = self._create_monthly_record(
                inst,
                month,
                monthly_hoa,
                monthly_property_tax,
                monthly_additional,
            )
            self._monthly_data.append(record)

    def _create_monthly_record(
        self,
        inst: object,  # LoanInstallment
        month: int,
        monthly_hoa: float,
        monthly_property_tax: float,
        monthly_additional: float,
    ) -> MonthlyRecord:
        """Create a monthly record from loan installment."""
        cumulative_payments = self._calculate_cumulative_payments(month)
        cumulative_interest = self._calculate_cumulative_interest(month)

        return MonthlyRecord(
            month=month,
            cash_flow=-(inst.installment + monthly_additional),  # type: ignore[attr-defined]
            equity=self.property_value - inst.outstanding_balance,  # type: ignore[attr-defined]
            installment=inst.installment,  # type: ignore[attr-defined]
            principal_payment=inst.amortization,  # type: ignore[attr-defined]
            interest_payment=inst.interest,  # type: ignore[attr-defined]
            outstanding_balance=inst.outstanding_balance,  # type: ignore[attr-defined]
            monthly_hoa=monthly_hoa,
            monthly_property_tax=monthly_property_tax,
            monthly_additional_costs=monthly_additional,
            property_value=self.property_value,
            total_monthly_cost=inst.installment + monthly_additional,  # type: ignore[attr-defined]
            cumulative_payments=cumulative_payments,
            cumulative_interest=cumulative_interest,
            equity_percentage=(
                (self.property_value - inst.outstanding_balance)
                / self.property_value
                * 100  # type: ignore[attr-defined]
                if self.property_value > 0
                else 0
            ),
            scenario_type="buy",
            upfront_additional_costs=self._total_upfront_costs if month == 1 else 0.0,
            fgts_balance=self.fgts_balance if self.fgts else None,
            fgts_used=(
                self._fgts_used_at_purchase if (self.fgts and month == 1) else 0.0
            ),
        )

    def _calculate_cumulative_payments(self, month: int) -> float:
        """Calculate cumulative payments up to a month."""
        if self._loan_result is None:
            return 0.0

        loan_payments = sum(
            i.installment for i in self._loan_result.installments[:month]
        )
        additional_costs = sum(
            apply_inflation(self._costs["monthly_hoa"], m, 1, self.inflation_rate)
            + apply_inflation(
                self._costs["monthly_property_tax"], m, 1, self.inflation_rate
            )
            for m in range(1, month + 1)
        )
        return loan_payments + additional_costs + self._total_upfront_costs

    def _calculate_cumulative_interest(self, month: int) -> float:
        """Calculate cumulative interest up to a month."""
        if self._loan_result is None:
            return 0.0
        return sum(i.interest for i in self._loan_result.installments[:month])

    def _build_result(self) -> ComparisonScenario:
        """Build the final comparison scenario result."""
        if self._loan_result is None:
            raise ValueError("Loan simulation not completed")

        final_equity = self.property_value + self.fgts_balance
        total_outflows = (
            self._loan_result.total_paid
            + self.down_payment
            + self._total_upfront_costs
            + self._total_monthly_additional_costs
        )
        net_cost = total_outflows - final_equity

        return ComparisonScenario(
            name=self.scenario_name,
            total_cost=net_cost,
            final_equity=final_equity,
            monthly_data=self._monthly_data,
            total_outflows=total_outflows,
            net_cost=net_cost,
        )


def simulate_buy_scenario(
    property_value: float,
    down_payment: float,
    loan_term_years: int,
    monthly_interest_rate: float,
    loan_type: str,
    amortizations: list[AmortizationInput] | None = None,
    _investment_returns: object = None,  # Not used, kept for API compatibility
    additional_costs: AdditionalCostsInput | None = None,
    inflation_rate: float | None = None,
    _property_appreciation_rate: float | None = None,  # Not used
    _investment_tax: object = None,  # Not used
    fgts: FGTSInput | None = None,
) -> ComparisonScenario:
    """Simulate buying a property with a loan.

    Legacy function for backward compatibility.
    """
    simulator = BuyScenarioSimulator(
        property_value=property_value,
        down_payment=down_payment,
        loan_term_years=loan_term_years,
        monthly_interest_rate=monthly_interest_rate,
        loan_type=loan_type,
        amortizations=amortizations,
        additional_costs=additional_costs,
        inflation_rate=inflation_rate,
        fgts=fgts,
    )
    return simulator.simulate()
