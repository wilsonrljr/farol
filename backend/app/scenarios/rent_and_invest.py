"""Rent and invest scenario simulator.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

from collections.abc import Sequence
from dataclasses import dataclass, field

from ..core.amortization import preprocess_amortizations
from ..core.inflation import apply_property_appreciation
from ..core.investment import InvestmentAccount, InvestmentResult
from ..core.protocols import ContributionLike, InvestmentReturnLike, InvestmentTaxLike
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

    When monthly_net_income is provided:
    - Housing costs (rent + additional costs) are paid from income
    - Any surplus is automatically invested
    - Any shortfall is tracked as housing_shortfall
    """

    rent_value: float = field(default=0.0)
    investment_returns: Sequence[InvestmentReturnLike] = field(default_factory=list)
    rent_inflation_rate: float | None = field(default=None)
    property_appreciation_rate: float | None = field(default=None)
    investment_tax: InvestmentTaxLike | None = field(default=None)

    # Monthly net income - when provided, enables income-based simulation
    monthly_net_income: float | None = field(default=None)

    # Scheduled investment contributions (aportes programados)
    contributions: Sequence[ContributionLike] | None = field(default=None)

    # Initial investment capital (total_savings - down_payment)
    initial_investment: float = field(default=0.0)

    # Internal state
    _account: InvestmentAccount = field(init=False)
    _total_rent_paid: float = field(init=False, default=0.0)
    _total_contributions: float = field(init=False, default=0.0)
    _fixed_contrib_by_month: dict[int, float] = field(init=False, default_factory=dict)
    _percent_contrib_by_month: dict[int, list[float]] = field(
        init=False, default_factory=dict
    )

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
        self._total_contributions = 0.0
        self._preprocess_contributions()

    def _preprocess_contributions(self) -> None:
        """Preprocess scheduled contributions (aportes)."""
        if not self.contributions:
            self._fixed_contrib_by_month = {}
            self._percent_contrib_by_month = {}
            return

        fixed, percent = preprocess_amortizations(
            self.contributions,
            self.term_months,
            self.inflation_rate,
        )
        self._fixed_contrib_by_month = fixed
        self._percent_contrib_by_month = percent

    def _apply_contributions(self, month: int) -> tuple[float, float, float]:
        """Apply scheduled contributions (aportes programados)."""
        contrib_fixed = 0.0
        contrib_pct = 0.0

        # Apply scheduled contributions (from contributions array)
        if month in self._fixed_contrib_by_month:
            val = self._fixed_contrib_by_month[month]
            contrib_fixed += val
            self._account.deposit(val)

        if month in self._percent_contrib_by_month:
            pct_total = sum(self._percent_contrib_by_month[month])
            if pct_total > 0 and self._account.balance > 0:
                pct_amount = self._account.balance * (pct_total / 100.0)
                contrib_pct += pct_amount
                self._account.deposit(pct_amount)

        contrib_total = contrib_fixed + contrib_pct
        if contrib_total > 0:
            self._total_contributions += contrib_total

        return contrib_fixed, contrib_pct, contrib_total

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

        # Process cashflows (income covers housing, surplus invested)
        cashflow_result = self._process_monthly_cashflows(housing_due)
        housing_paid = cashflow_result["actual_housing_paid"]
        housing_shortfall = cashflow_result["housing_shortfall"]
        rent_paid = min(current_rent, housing_paid)
        self._total_rent_paid += rent_paid

        # Apply scheduled contributions BEFORE returns
        contrib_fixed, contrib_pct, contrib_total = self._apply_contributions(month)

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
            housing_shortfall=housing_shortfall,
            cashflow_result=cashflow_result,
            investment_result=investment_result,
            property_value=current_property_value,
            contrib_fixed=contrib_fixed,
            contrib_pct=contrib_pct,
            contrib_total=contrib_total,
        )

    def _process_monthly_cashflows(
        self,
        housing_due: float,
    ) -> dict[str, float]:
        """Process monthly cashflows based on income or withdrawal model.

        When monthly_net_income is provided:
        - Housing costs are paid from income first
        - Surplus income is invested
        - Shortfall is tracked (housing not fully paid)

        When monthly_net_income is not provided:
        - Housing is assumed paid externally (not from modeled sources)
        - No withdrawals from investment needed
        """
        income_cover = 0.0
        income_surplus_invested = 0.0
        rent_withdrawal = 0.0
        withdrawal_gross = 0.0
        withdrawal_tax_paid = 0.0
        withdrawal_realized_gain = 0.0

        remaining_before_return = self._account.balance

        if self.monthly_net_income is not None and self.monthly_net_income > 0:
            # Income-based model: pay housing from income, invest surplus
            income_cover = min(housing_due, self.monthly_net_income)
            surplus = self.monthly_net_income - income_cover

            if surplus > 0:
                self._account.deposit(surplus)
                income_surplus_invested = surplus

            remaining_before_return = self._account.balance
            actual_housing_paid = income_cover
        else:
            # Legacy model: housing assumed paid externally
            actual_housing_paid = housing_due

        housing_shortfall = max(0.0, housing_due - actual_housing_paid)

        return {
            "rent_withdrawal": rent_withdrawal,
            "income_cover": income_cover,
            "income_surplus_invested": income_surplus_invested,
            "remaining_before_return": remaining_before_return,
            "investment_withdrawal_gross": withdrawal_gross,
            "investment_withdrawal_net": rent_withdrawal,
            "investment_withdrawal_realized_gain": withdrawal_realized_gain,
            "investment_withdrawal_tax_paid": withdrawal_tax_paid,
            "actual_housing_paid": actual_housing_paid,
            "housing_shortfall": housing_shortfall,
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
        contrib_fixed: float = 0.0,
        contrib_pct: float = 0.0,
        contrib_total: float = 0.0,
    ) -> DomainMonthlyRecord:
        """Create a monthly record."""
        withdrawal = cashflow_result.get("rent_withdrawal", 0.0)
        income_surplus_invested = cashflow_result.get("income_surplus_invested", 0.0)

        sustainable_withdrawal_ratio = (
            (investment_result.net_return / withdrawal) if withdrawal > 0 else None
        )
        burn_month = withdrawal > 0 and investment_result.net_return < withdrawal

        # New semantics: total_monthly_cost reflects all outflows/cash allocations in the month.
        # Month 1 includes the initial capital invested (down payment + initial_investment).
        initial_deposit = (
            (self.down_payment + self.initial_investment) if month == 1 else 0.0
        )

        # Total contribution includes: scheduled contributions + income surplus invested
        total_invested_this_month = contrib_total + income_surplus_invested
        rent_due = current_rent
        total_monthly_cost = housing_due + initial_deposit + total_invested_this_month

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
            rent_withdrawal_from_investment=withdrawal if withdrawal > 0 else None,
            remaining_investment_before_return=cashflow_result[
                "remaining_before_return"
            ],
            external_cover=cashflow_result.get("income_cover"),
            external_surplus_invested=(
                income_surplus_invested if income_surplus_invested > 0 else None
            ),
            sustainable_withdrawal_ratio=sustainable_withdrawal_ratio,
            burn_month=burn_month,
            extra_contribution_fixed=contrib_fixed if contrib_fixed > 0 else None,
            extra_contribution_percentage=contrib_pct if contrib_pct > 0 else None,
            extra_contribution_total=contrib_total if contrib_total > 0 else None,
            additional_investment=(
                total_invested_this_month if total_invested_this_month > 0 else None
            ),
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
