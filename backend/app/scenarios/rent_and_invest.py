"""Rent and invest scenario simulator.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

from collections.abc import Sequence
from dataclasses import dataclass, field

from ..core.inflation import apply_property_appreciation
from ..core.investment import InvestmentAccount, InvestmentResult
from ..core.protocols import InvestmentReturnLike, InvestmentTaxLike
from ..domain.mappers import comparison_scenario_to_api
from ..domain.models import ComparisonScenario as DomainComparisonScenario
from ..domain.models import MonthlyRecord as DomainMonthlyRecord
from ..models import (
    ComparisonScenario,
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

    # Initial investment capital (total_savings - down_payment)
    initial_investment: float = field(default=0.0)

    # Internal state
    _account: InvestmentAccount = field(init=False)
    _total_rent_paid: float = field(init=False, default=0.0)

    @property
    def scenario_name(self) -> str:
        """Name of the scenario in Portuguese."""
        return "Alugar e investir"

    def __post_init__(self) -> None:
        """Initialize computed fields."""
        super().__post_init__()
        if self.term_months <= 0:
            raise ValueError("term_months must be > 0")
        initial_balance = self.down_payment + self.initial_investment
        self._account = InvestmentAccount(
            investment_returns=self.investment_returns,
            investment_tax=self.investment_tax,
            balance=initial_balance,
            principal=initial_balance,
        )
        self._total_rent_paid = 0.0

    def simulate(self) -> ComparisonScenario:
        """Run the rent and invest simulation (API model)."""
        return comparison_scenario_to_api(self.simulate_domain())

    def simulate_domain(self) -> DomainComparisonScenario:
        """Run the rent and invest simulation (domain model)."""
        self._monthly_data = []

        for month in range(1, self.term_months + 1):
            self.accumulate_fgts()
            record = self._simulate_month(month)
            self._monthly_data.append(record)

        return self._build_domain_result()

    def _simulate_month(self, month: int) -> DomainMonthlyRecord:
        """Simulate a single month."""
        current_rent = self.get_current_rent(month)

        # Track the hypothetical property price trajectory for comparison.
        current_property_value = apply_property_appreciation(
            self.property_value,
            month,
            1,
            self.property_appreciation_rate,
            self.inflation_rate,
        )
        monthly_hoa, monthly_property_tax, monthly_additional = (
            self.get_inflated_monthly_costs(month)
        )

        housing_due = current_rent + monthly_additional

        # Process cashflows (external cover, optional investing surplus, optional withdrawal)
        cashflow_result = self._process_monthly_cashflows(housing_due)
        housing_paid = cashflow_result["actual_rent_paid"]
        rent_paid = min(current_rent, housing_paid)
        self._total_rent_paid += rent_paid

        # Apply investment returns
        investment_result = self._account.apply_monthly_return(month)

        return self._create_monthly_record(
            month=month,
            current_rent=current_rent,
            monthly_hoa=monthly_hoa,
            monthly_property_tax=monthly_property_tax,
            monthly_additional=monthly_additional,
            actual_rent_paid=rent_paid,
            rent_shortfall=max(0.0, current_rent - rent_paid),
            housing_due=housing_due,
            housing_paid=housing_paid,
            housing_shortfall=max(0.0, housing_due - housing_paid),
            cashflow_result=cashflow_result,
            investment_result=investment_result,
            property_value=current_property_value,
        )

    def _process_monthly_cashflows(
        self,
        rent_due: float,
    ) -> dict[str, float]:
        """Process monthly cashflows including external savings and rent withdrawal."""
        rent_withdrawal = 0.0
        external_cover = 0.0
        external_surplus_invested = 0.0
        withdrawal_gross = 0.0
        withdrawal_tax_paid = 0.0
        withdrawal_realized_gain = 0.0

        remaining_before_return = self._account.balance

        if self.rent_reduces_investment:
            cost_remaining = rent_due

            if self.monthly_external_savings and self.monthly_external_savings > 0:
                external_cover = min(cost_remaining, self.monthly_external_savings)
                cost_remaining -= external_cover

                surplus = self.monthly_external_savings - external_cover
                if surplus > 0 and self.invest_external_surplus:
                    self._account.deposit(surplus)
                    external_surplus_invested = surplus

            withdrawal = self._account.withdraw_net(cost_remaining)
            rent_withdrawal = withdrawal.net_cash
            withdrawal_gross = withdrawal.gross_withdrawal
            withdrawal_tax_paid = withdrawal.tax_paid
            withdrawal_realized_gain = withdrawal.realized_gain
            remaining_before_return = self._account.balance
        else:
            # When rent is not modeled as reducing investment, rent is assumed to be
            # paid externally and we intentionally do not treat monthly_external_savings
            # as an investment contribution to avoid ambiguous semantics.
            pass

        actual_rent_paid = (
            external_cover + rent_withdrawal
            if self.rent_reduces_investment
            else rent_due
        )
        rent_shortfall = max(0.0, rent_due - actual_rent_paid)

        return {
            "rent_withdrawal": rent_withdrawal,
            "external_cover": external_cover,
            "external_surplus_invested": external_surplus_invested,
            "remaining_before_return": remaining_before_return,
            "investment_withdrawal_gross": withdrawal_gross,
            "investment_withdrawal_net": rent_withdrawal,
            "investment_withdrawal_realized_gain": withdrawal_realized_gain,
            "investment_withdrawal_tax_paid": withdrawal_tax_paid,
            "actual_rent_paid": actual_rent_paid,
            "rent_shortfall": rent_shortfall,
        }

    def _create_monthly_record(
        self,
        *,
        month: int,
        current_rent: float,
        actual_rent_paid: float,
        monthly_hoa: float,
        monthly_property_tax: float,
        monthly_additional: float,
        rent_shortfall: float,
        housing_due: float,
        housing_paid: float,
        housing_shortfall: float,
        cashflow_result: dict[str, float],
        investment_result: InvestmentResult,
        property_value: float,
    ) -> DomainMonthlyRecord:
        """Create a monthly record."""
        withdrawal = (
            cashflow_result["rent_withdrawal"] if self.rent_reduces_investment else 0.0
        )
        sustainable_withdrawal_ratio = (
            (investment_result.net_return / withdrawal) if withdrawal > 0 else None
        )
        burn_month = withdrawal > 0 and investment_result.net_return < withdrawal

        # New semantics: total_monthly_cost reflects all outflows/cash allocations in the month.
        # Month 1 includes the initial capital invested (down payment + initial_investment).
        initial_deposit = (
            (self.down_payment + self.initial_investment) if month == 1 else 0.0
        )
        invested_from_external = cashflow_result.get("external_surplus_invested", 0.0)
        rent_due = current_rent
        total_monthly_cost = housing_due + initial_deposit + invested_from_external

        return DomainMonthlyRecord(
            month=month,
            cash_flow=-total_monthly_cost,
            investment_balance=self._account.balance,
            rent_due=rent_due,
            rent_paid=actual_rent_paid,
            rent_shortfall=rent_shortfall,
            housing_due=housing_due,
            housing_paid=housing_paid,
            housing_shortfall=housing_shortfall,
            initial_allocation=initial_deposit,
            monthly_hoa=monthly_hoa,
            monthly_property_tax=monthly_property_tax,
            monthly_additional_costs=monthly_additional,
            property_value=property_value,
            total_monthly_cost=total_monthly_cost,
            cumulative_rent_paid=self._total_rent_paid,
            cumulative_investment_gains=(
                self._account.balance - self._account.principal
            ),
            investment_roi_percentage=(
                (
                    (self._account.balance - self._account.principal)
                    / self._account.principal
                    * 100
                )
                if self._account.principal > 0
                else 0.0
            ),
            scenario_type="rent_invest",
            equity=0.0,
            liquid_wealth=self._account.balance,
            rent_withdrawal_from_investment=withdrawal,
            remaining_investment_before_return=cashflow_result[
                "remaining_before_return"
            ],
            external_cover=cashflow_result["external_cover"],
            external_surplus_invested=cashflow_result["external_surplus_invested"],
            sustainable_withdrawal_ratio=sustainable_withdrawal_ratio,
            burn_month=burn_month,
            investment_withdrawal_gross=cashflow_result.get(
                "investment_withdrawal_gross"
            )
            or None,
            investment_withdrawal_net=cashflow_result.get("investment_withdrawal_net")
            or None,
            investment_withdrawal_realized_gain=(
                cashflow_result.get("investment_withdrawal_realized_gain") or None
            ),
            investment_withdrawal_tax_paid=(
                cashflow_result.get("investment_withdrawal_tax_paid") or None
            ),
            investment_return_gross=investment_result.gross_return,
            investment_tax_paid=investment_result.tax_paid,
            investment_return_net=investment_result.net_return,
            fgts_balance=self.fgts_balance if self.fgts else None,
        )

    def _build_domain_result(self) -> DomainComparisonScenario:
        """Build the final comparison scenario result (domain)."""
        final_equity = self._account.balance + self.fgts_balance
        total_outflows = sum((d.total_monthly_cost or 0.0) for d in self._monthly_data)
        net_cost = total_outflows - final_equity

        # Consumption approximation: rent due + recurring housing costs.
        total_consumption = 0.0
        for d in self._monthly_data:
            total_consumption += d.rent_due or 0.0
            total_consumption += d.monthly_additional_costs or 0.0

        return DomainComparisonScenario(
            name=self.scenario_name,
            scenario_type="rent_invest",
            total_cost=net_cost,
            final_equity=final_equity,
            total_consumption=total_consumption,
            monthly_data=self._monthly_data,
            total_outflows=total_outflows,
            net_cost=net_cost,
        )
