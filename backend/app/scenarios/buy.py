"""Buy with financing scenario simulator.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

from collections.abc import Sequence
from dataclasses import dataclass, field

from ..core.inflation import apply_property_appreciation
from ..core.protocols import AdditionalCostsLike, AmortizationLike, FGTSLike
from ..domain.mappers import comparison_scenario_to_api
from ..domain.models import ComparisonScenario as DomainComparisonScenario
from ..domain.models import MonthlyRecord as DomainMonthlyRecord
from ..loans import LoanSimulator, PriceLoanSimulator, SACLoanSimulator
from ..models import (
    ComparisonScenario,
    LoanSimulationResult,
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
    amortizations: Sequence[AmortizationLike] | None = field(default=None)
    property_appreciation_rate: float | None = field(default=None)

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

    def __post_init__(self) -> None:
        super().__post_init__()
        # Keep the base field `term_months` as the single source of truth.
        self.term_months = self.loan_term_years * 12
        if self.term_months <= 0:
            raise ValueError("loan_term_years must be > 0")

    def simulate(self) -> ComparisonScenario:
        """Run the buy scenario simulation (API model)."""
        return comparison_scenario_to_api(self.simulate_domain())

    def simulate_domain(self) -> DomainComparisonScenario:
        """Run the buy scenario simulation (domain model)."""
        self._prepare_simulation()
        self._simulate_loan()
        self._generate_monthly_data()
        return self._build_domain_result()

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
        simulator: LoanSimulator
        if self.loan_type == "SAC":
            simulator = SACLoanSimulator(
                loan_value=self._loan_value,
                term_months=self.term_months,
                monthly_interest_rate=self.monthly_interest_rate,
                amortizations=self.amortizations,
                annual_inflation_rate=self.inflation_rate,
            )
        else:
            simulator = PriceLoanSimulator(
                loan_value=self._loan_value,
                term_months=self.term_months,
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

        cumulative_payments = 0.0
        cumulative_interest = 0.0

        installments = self._loan_result.installments
        actual_term_months = len(installments)

        for month in range(1, self.term_months + 1):
            inst = installments[month - 1] if month <= actual_term_months else None

            self.accumulate_fgts()

            property_value = apply_property_appreciation(
                self.property_value,
                month,
                1,
                self.property_appreciation_rate,
                self.inflation_rate,
            )

            monthly_hoa, monthly_property_tax, monthly_additional = (
                self.get_inflated_monthly_costs(month)
            )
            self._total_monthly_additional_costs += monthly_additional

            # Running totals (kept consistent with the legacy implementation):
            # - Includes loan installments + monthly additional costs
            # - Includes upfront additional costs once (month 1)
            if month == 1:
                cumulative_payments += self._total_upfront_costs

            installment_value = inst.installment if inst is not None else 0.0
            amortization_value = inst.amortization if inst is not None else 0.0
            interest_value = inst.interest if inst is not None else 0.0
            outstanding_balance = inst.outstanding_balance if inst is not None else 0.0

            cumulative_payments += installment_value + monthly_additional
            cumulative_interest += interest_value

            record = self._create_monthly_record(
                month,
                property_value,
                monthly_hoa,
                monthly_property_tax,
                monthly_additional,
                cumulative_payments,
                cumulative_interest,
                installment_value,
                amortization_value,
                interest_value,
                outstanding_balance,
            )
            self._monthly_data.append(record)

    def _create_monthly_record(
        self,
        month: int,
        property_value: float,
        monthly_hoa: float,
        monthly_property_tax: float,
        monthly_additional: float,
        cumulative_payments: float,
        cumulative_interest: float,
        installment_value: float,
        amortization_value: float,
        interest_value: float,
        outstanding_balance: float,
    ) -> DomainMonthlyRecord:
        """Create a monthly record from loan installment."""
        equity = property_value - outstanding_balance
        total_monthly_cost = installment_value + monthly_additional

        return DomainMonthlyRecord(
            month=month,
            cash_flow=-total_monthly_cost,
            equity=equity,
            installment=installment_value,
            principal_payment=amortization_value,
            interest_payment=interest_value,
            outstanding_balance=outstanding_balance,
            monthly_hoa=monthly_hoa,
            monthly_property_tax=monthly_property_tax,
            monthly_additional_costs=monthly_additional,
            property_value=property_value,
            total_monthly_cost=total_monthly_cost,
            cumulative_payments=cumulative_payments,
            cumulative_interest=cumulative_interest,
            equity_percentage=(
                (equity / property_value * 100) if property_value > 0 else 0
            ),
            scenario_type="buy",
            upfront_additional_costs=self._total_upfront_costs if month == 1 else 0.0,
            fgts_balance=self.fgts_balance if self.fgts else None,
            fgts_used=(
                self._fgts_used_at_purchase if (self.fgts and month == 1) else 0.0
            ),
        )

    def _build_domain_result(self) -> DomainComparisonScenario:
        """Build the final comparison scenario result (domain)."""
        if self._loan_result is None:
            raise ValueError("Loan simulation not completed")

        final_property_value = apply_property_appreciation(
            self.property_value,
            self.term_months,
            1,
            self.property_appreciation_rate,
            self.inflation_rate,
        )
        final_equity = final_property_value + self.fgts_balance
        total_outflows = (
            self._loan_result.total_paid
            + self.down_payment
            + self._total_upfront_costs
            + self._total_monthly_additional_costs
        )
        net_cost = total_outflows - final_equity

        return DomainComparisonScenario(
            name=self.scenario_name,
            scenario_type="buy",
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
    amortizations: Sequence[AmortizationLike] | None = None,
    _investment_returns: object = None,  # Not used, kept for API compatibility
    additional_costs: AdditionalCostsLike | None = None,
    inflation_rate: float | None = None,
    property_appreciation_rate: float | None = None,
    _investment_tax: object = None,  # Not used
    fgts: FGTSLike | None = None,
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
        property_appreciation_rate=property_appreciation_rate,
        additional_costs=additional_costs,
        inflation_rate=inflation_rate,
        fgts=fgts,
    )
    return simulator.simulate()
