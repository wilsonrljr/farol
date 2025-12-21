"""Rent and invest scenario simulator.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

from dataclasses import dataclass, field
from collections.abc import Sequence

from ..core.investment import InvestmentCalculator, InvestmentResult
from ..core.protocols import (
    AdditionalCostsLike,
    FGTSLike,
    InvestmentReturnLike,
    InvestmentTaxLike,
)
from ..models import (
    ComparisonScenario,
    MonthlyRecord,
)
from .base import RentalScenarioMixin, ScenarioSimulator


@dataclass
class RentAndInvestScenarioSimulator(ScenarioSimulator, RentalScenarioMixin):
    """Simulator for renting and investing the down payment.

    Calculates wealth accumulation when renting instead of buying,
    investing the down payment and potentially rental savings.
    """

    rent_value: float = field(default=0.0)
    investment_returns: Sequence[InvestmentReturnLike] = field(default_factory=list)
    rent_inflation_rate: float | None = field(default=None)
    property_appreciation_rate: float | None = field(default=None)
    rent_reduces_investment: bool = field(default=False)
    monthly_external_savings: float | None = field(default=None)
    invest_external_surplus: bool = field(default=False)
    investment_tax: InvestmentTaxLike | None = field(default=None)

    # Internal state
    _investment_balance: float = field(init=False)
    _total_rent_paid: float = field(init=False, default=0.0)
    _investment_calculator: InvestmentCalculator = field(init=False)

    @property
    def scenario_name(self) -> str:
        """Name of the scenario in Portuguese."""
        return "Alugar e investir"

    def __post_init__(self) -> None:
        """Initialize computed fields."""
        super().__post_init__()
        self._investment_balance = self.down_payment
        self._total_rent_paid = 0.0
        self._investment_calculator = InvestmentCalculator(
            investment_returns=self.investment_returns,
            investment_tax=self.investment_tax,
        )

    def simulate(self) -> ComparisonScenario:
        """Run the rent and invest simulation."""
        self._monthly_data = []

        for month in range(1, self.term_months + 1):
            self.accumulate_fgts()
            record = self._simulate_month(month)
            self._monthly_data.append(record)

        return self._build_result()

    def _simulate_month(self, month: int) -> MonthlyRecord:
        """Simulate a single month."""
        current_rent = self.get_current_rent(month)
        monthly_hoa, monthly_property_tax, monthly_additional = (
            self.get_inflated_monthly_costs(month)
        )
        total_monthly_cost = current_rent + monthly_additional
        self._total_rent_paid += total_monthly_cost

        # Process cashflows
        cashflow_result = self._process_monthly_cashflows(total_monthly_cost)

        # Apply investment returns
        investment_result = self._investment_calculator.calculate_monthly_return(
            self._investment_balance, month
        )
        self._investment_balance = investment_result.new_balance

        return self._create_monthly_record(
            month=month,
            current_rent=current_rent,
            monthly_hoa=monthly_hoa,
            monthly_property_tax=monthly_property_tax,
            monthly_additional=monthly_additional,
            total_monthly_cost=total_monthly_cost,
            cashflow_result=cashflow_result,
            investment_result=investment_result,
        )

    def _process_monthly_cashflows(
        self,
        total_monthly_cost: float,
    ) -> dict[str, float]:
        """Process monthly cashflows including external savings and rent withdrawal."""
        return self._apply_rent_cashflows(
            total_monthly_cost=total_monthly_cost,
            rent_reduces_investment=self.rent_reduces_investment,
            monthly_external_savings=self.monthly_external_savings,
            invest_external_surplus=self.invest_external_surplus,
        )

    def _create_monthly_record(
        self,
        *,
        month: int,
        current_rent: float,
        monthly_hoa: float,
        monthly_property_tax: float,
        monthly_additional: float,
        total_monthly_cost: float,
        cashflow_result: dict[str, float],
        investment_result: InvestmentResult,
    ) -> MonthlyRecord:
        """Create a monthly record."""
        withdrawal = (
            cashflow_result["rent_withdrawal"] if self.rent_reduces_investment else 0.0
        )
        investment_return = investment_result.net_return

        sustainable_withdrawal_ratio = (
            (investment_return / withdrawal) if withdrawal > 0 else None
        )
        burn_month = withdrawal > 0 and investment_return < withdrawal

        return MonthlyRecord(
            month=month,
            cash_flow=-total_monthly_cost,
            investment_balance=self._investment_balance,
            investment_return=investment_return,
            rent_paid=current_rent,
            monthly_hoa=monthly_hoa,
            monthly_property_tax=monthly_property_tax,
            monthly_additional_costs=monthly_additional,
            property_value=self.property_value,
            total_monthly_cost=total_monthly_cost,
            cumulative_rent_paid=self._total_rent_paid,
            cumulative_investment_gains=self._investment_balance - self.down_payment,
            investment_roi_percentage=(
                (
                    (self._investment_balance - self.down_payment)
                    / self.down_payment
                    * 100
                )
                if self.down_payment
                else 0.0
            ),
            scenario_type="rent_invest",
            equity=0.0,
            liquid_wealth=self._investment_balance,
            rent_withdrawal_from_investment=withdrawal,
            remaining_investment_before_return=cashflow_result[
                "remaining_before_return"
            ],
            external_cover=cashflow_result["external_cover"],
            external_surplus_invested=cashflow_result["external_surplus_invested"],
            sustainable_withdrawal_ratio=sustainable_withdrawal_ratio,
            burn_month=burn_month,
            investment_return_gross=investment_result.gross_return,
            investment_tax_paid=investment_result.tax_paid,
            investment_return_net=investment_result.net_return,
            fgts_balance=self.fgts_balance if self.fgts else None,
        )

    def _build_result(self) -> ComparisonScenario:
        """Build the final comparison scenario result."""
        final_equity = self._investment_balance + self.fgts_balance
        initial_capital = self.down_payment + (
            self.fgts.initial_balance if self.fgts else 0.0
        )
        total_outflows = self._total_rent_paid + initial_capital
        net_cost = total_outflows - final_equity

        return ComparisonScenario(
            name=self.scenario_name,
            scenario_type="rent_invest",
            total_cost=net_cost,
            final_equity=final_equity,
            monthly_data=self._monthly_data,
            total_outflows=total_outflows,
            net_cost=net_cost,
        )


def simulate_rent_and_invest_scenario(
    property_value: float,
    down_payment: float,
    term_months: int,
    rent_value: float,
    investment_returns: Sequence[InvestmentReturnLike],
    additional_costs: AdditionalCostsLike | None = None,
    inflation_rate: float | None = None,
    rent_inflation_rate: float | None = None,
    property_appreciation_rate: float | None = None,
    rent_reduces_investment: bool = False,
    monthly_external_savings: float | None = None,
    invest_external_surplus: bool = False,
    investment_tax: InvestmentTaxLike | None = None,
    fgts: FGTSLike | None = None,
) -> ComparisonScenario:
    """Simulate renting and investing the down payment.

    Legacy function for backward compatibility.
    """
    simulator = RentAndInvestScenarioSimulator(
        property_value=property_value,
        down_payment=down_payment,
        term_months=term_months,
        rent_value=rent_value,
        investment_returns=investment_returns,
        additional_costs=additional_costs,
        inflation_rate=inflation_rate,
        rent_inflation_rate=rent_inflation_rate,
        property_appreciation_rate=property_appreciation_rate,
        rent_reduces_investment=rent_reduces_investment,
        monthly_external_savings=monthly_external_savings,
        invest_external_surplus=invest_external_surplus,
        investment_tax=investment_tax,
        fgts=fgts,
    )
    return simulator.simulate()
