"""Invest then buy scenario simulator.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

import math
from collections.abc import Sequence
from dataclasses import dataclass, field

from ..core.amortization import preprocess_amortizations
from ..core.costs import CostsBreakdown, calculate_additional_costs
from ..core.inflation import apply_property_appreciation
from ..core.investment import InvestmentAccount, InvestmentResult
from ..core.protocols import (
    ContributionLike,
    InvestmentReturnLike,
    InvestmentTaxLike,
)
from ..domain.mappers import comparison_scenario_to_api
from ..domain.models import ComparisonScenario as DomainComparisonScenario
from ..domain.models import MonthlyRecord as DomainMonthlyRecord
from ..models import (
    ComparisonScenario,
)
from .base import RentalScenarioMixin, ScenarioSimulator

MILESTONE_THRESHOLDS = frozenset({25, 50, 75, 90, 100})


@dataclass
class InvestThenBuyScenarioSimulator(ScenarioSimulator, RentalScenarioMixin):
    """Simulator for investing until buying outright.

    Calculates wealth accumulation while renting, tracking progress
    toward purchasing the property without financing.

    When monthly_net_income is provided:
    - Housing costs (rent + additional costs) are paid from income
    - Any surplus is automatically invested
    - Any shortfall is tracked as housing_shortfall
    """

    rent_value: float = field(default=0.0)
    investment_returns: Sequence[InvestmentReturnLike] = field(default_factory=list)
    rent_inflation_rate: float | None = field(default=None)
    property_appreciation_rate: float | None = field(default=None)
    loan_type: str = field(default="SAC")
    monthly_interest_rate: float = field(default=1.0)

    # Scheduled investment contributions (aportes).
    contributions: Sequence[ContributionLike] | None = field(default=None)
    # If true, scheduled contributions continue after property purchase.
    continue_contributions_after_purchase: bool = field(default=True)
    investment_tax: InvestmentTaxLike | None = field(default=None)

    # Monthly net income - when provided, enables income-based simulation
    monthly_net_income: float | None = field(default=None)
    monthly_net_income_adjust_inflation: bool = field(default=False)

    # Initial investment capital (total_savings - down_payment)
    initial_investment: float = field(default=0.0)

    # Internal state
    _account: InvestmentAccount = field(init=False)
    _fixed_contrib_by_month: dict[int, float] = field(init=False, default_factory=dict)
    _percent_contrib_by_month: dict[int, list[float]] = field(
        init=False, default_factory=dict
    )
    _total_rent_paid: float = field(init=False, default=0.0)
    _total_scheduled_contributions: float = field(init=False, default=0.0)
    _total_additional_investments: float = field(init=False, default=0.0)
    _total_monthly_additional_costs: float = field(init=False, default=0.0)
    _purchase_month: int | None = field(init=False, default=None)
    _last_progress_bucket: int = field(init=False, default=0)

    @property
    def scenario_name(self) -> str:
        """Name of the scenario in Portuguese."""
        return "Investir e comprar à vista"

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

    def simulate(self) -> ComparisonScenario:
        """Run the invest then buy simulation (API model)."""
        return comparison_scenario_to_api(self.simulate_domain())

    def simulate_domain(self) -> DomainComparisonScenario:
        """Run the invest then buy simulation (domain model)."""
        self._monthly_data = []

        for month in range(1, self.term_months + 1):
            self.accumulate_fgts()
            current_property_value, costs, total_purchase_cost = (
                self._compute_purchase_cost(month)
            )

            if self._purchase_month is not None:
                self._handle_post_purchase_month(month, current_property_value, costs)
            else:
                self._handle_pre_purchase_month(
                    month, current_property_value, costs, total_purchase_cost
                )

        self._annotate_metadata()
        return self._build_domain_result()

    def _compute_purchase_cost(
        self,
        month: int,
    ) -> tuple[float, CostsBreakdown, float]:
        """Compute purchase cost for a given month."""
        current_property_value = apply_property_appreciation(
            self.property_value,
            month,
            1,
            self.property_appreciation_rate,
            self.inflation_rate,
        )
        costs = calculate_additional_costs(
            current_property_value, self.additional_costs
        )
        total_purchase_cost = current_property_value + costs["total_upfront"]
        return current_property_value, costs, total_purchase_cost

    def _handle_pre_purchase_month(
        self,
        month: int,
        current_property_value: float,
        costs: CostsBreakdown,
        total_purchase_cost: float,
    ) -> None:
        """Handle simulation for months before purchase."""
        # 1) Compute rent for the month.
        rent_result = self._compute_rent_costs(month, costs)
        current_rent = rent_result["current_rent"]
        total_rent_cost = rent_result["total_rent_cost"]

        # 2) Apply rent cashflows (income covers housing, surplus tracked but not auto-invested).
        cashflow_result = self._process_rent_cashflows(total_rent_cost, month)
        housing_due = total_rent_cost
        housing_paid = cashflow_result["actual_housing_paid"]
        housing_shortfall = cashflow_result["housing_shortfall"]
        rent_paid = min(current_rent, housing_paid)
        rent_shortfall = max(0.0, current_rent - rent_paid)

        self._total_rent_paid += rent_paid

        # 3) Apply scheduled contributions BEFORE returns.
        contrib_fixed, contrib_pct, contrib_total = self._apply_scheduled_contributions(
            month
        )

        # NOTE: income surplus is no longer auto-invested. Only explicit contributions count.
        # additional_investment is now just the explicit contributions
        additional_investment = contrib_total

        # 4) Apply investment returns at end of month.
        investment_result: InvestmentResult = self._account.apply_monthly_return(month)

        # Update progress
        progress_percent, shortfall, is_milestone = self._update_progress(
            month, total_purchase_cost
        )

        # Check if we can purchase
        record = self._maybe_purchase_and_create_record(
            month=month,
            current_property_value=current_property_value,
            total_purchase_cost=total_purchase_cost,
            current_rent=current_rent,
            rent_result=rent_result,
            cashflow_result=cashflow_result,
            investment_result=investment_result,
            additional_investment=additional_investment,
            progress_percent=progress_percent,
            shortfall=shortfall,
            is_milestone=is_milestone,
            contrib_fixed=contrib_fixed,
            contrib_pct=contrib_pct,
            contrib_total=contrib_total,
            actual_rent_paid=rent_paid,
            rent_shortfall=rent_shortfall,
            housing_due=housing_due,
            housing_paid=housing_paid,
            housing_shortfall=housing_shortfall,
        )
        self._monthly_data.append(record)

    def _apply_scheduled_contributions(self, month: int) -> tuple[float, float, float]:
        """Apply scheduled contributions (aportes)."""
        contrib_fixed = 0.0
        contrib_pct = 0.0

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
            self._total_scheduled_contributions += contrib_total

        return contrib_fixed, contrib_pct, contrib_total

    def _compute_rent_costs(
        self,
        month: int,
        _costs: CostsBreakdown,
    ) -> dict[str, float]:
        """Compute rent and additional costs for a month."""
        current_rent = self.get_current_rent(month)
        monthly_hoa, monthly_property_tax, monthly_additional = (
            self.get_inflated_monthly_costs(month)
        )
        total_rent_cost = current_rent + monthly_additional

        return {
            "current_rent": current_rent,
            "monthly_hoa": monthly_hoa,
            "monthly_property_tax": monthly_property_tax,
            "monthly_additional": monthly_additional,
            "total_rent_cost": total_rent_cost,
        }

    def _process_rent_cashflows(
        self,
        housing_due: float,
        month: int,
    ) -> dict[str, float]:
        """Process monthly cashflows based on income model.

        When monthly_net_income is provided:
        - Housing costs are paid from income first
        - Surplus is tracked but NOT automatically invested (user controls via contributions)
        - Shortfall is tracked (housing not fully paid)

        When monthly_net_income is not provided:
        - Housing is assumed paid externally (not from modeled sources)

        IMPORTANT: The surplus (sobra) is NOT automatically invested.
        The user must explicitly configure contributions (aportes) to invest.
        The surplus is provided as 'income_surplus_available' for validation purposes.
        """
        income_cover = 0.0
        income_surplus_available = 0.0
        rent_withdrawal = 0.0
        withdrawal_gross = 0.0
        withdrawal_tax_paid = 0.0
        withdrawal_realized_gain = 0.0

        remaining_before_return = self._account.balance

        effective_income = self.get_effective_monthly_net_income(
            month,
            self.monthly_net_income,
            self.monthly_net_income_adjust_inflation,
        )

        if effective_income is not None and effective_income > 0:
            # Income-based model: pay housing from income
            # Surplus is calculated but NOT automatically invested
            income_cover = min(housing_due, effective_income)
            surplus = effective_income - income_cover

            if surplus > 0:
                # Track the available surplus for budget validation
                # The user's contributions will be deducted from this
                income_surplus_available = surplus

            remaining_before_return = self._account.balance
            actual_housing_paid = income_cover
        else:
            # Legacy model: housing assumed paid externally
            actual_housing_paid = housing_due

        housing_shortfall = max(0.0, housing_due - actual_housing_paid)

        return {
            "rent_withdrawal": rent_withdrawal,
            "income_cover": income_cover,
            "income_surplus_available": income_surplus_available,
            "income_surplus_invested": 0.0,  # No longer auto-invested
            "remaining_before_return": remaining_before_return,
            "investment_withdrawal_gross": withdrawal_gross,
            "investment_withdrawal_net": rent_withdrawal,
            "investment_withdrawal_realized_gain": withdrawal_realized_gain,
            "investment_withdrawal_tax_paid": withdrawal_tax_paid,
            "actual_housing_paid": actual_housing_paid,
            "housing_shortfall": housing_shortfall,
            # Legacy compatibility keys
            "external_cover": income_cover,
            "external_surplus_invested": income_surplus_available,
        }

    def _update_progress(
        self,
        month: int,
        total_purchase_cost: float,
    ) -> tuple[float, float, bool]:
        """Update progress tracking."""
        total_available = self._account.liquidation_net_value()
        if self._fgts_manager and self._fgts_manager.use_at_purchase:
            total_available += self.fgts_balance

        progress_percent = (
            (total_available / total_purchase_cost) * 100
            if total_purchase_cost > 0
            else 0.0
        )
        shortfall = max(0.0, total_purchase_cost - total_available)

        # Check for milestone crossing
        progress_bucket = 0
        for threshold in sorted(MILESTONE_THRESHOLDS):
            if progress_percent >= threshold:
                progress_bucket = threshold

        crossed_bucket = progress_bucket > self._last_progress_bucket
        if crossed_bucket:
            self._last_progress_bucket = progress_bucket

        is_milestone = month <= 12 or month % 12 == 0 or crossed_bucket
        return progress_percent, shortfall, is_milestone

    def _maybe_purchase_and_create_record(
        self,
        *,
        month: int,
        current_property_value: float,
        total_purchase_cost: float,
        current_rent: float,
        rent_result: dict[str, float],
        cashflow_result: dict[str, float],
        investment_result: InvestmentResult,
        additional_investment: float,
        progress_percent: float,
        shortfall: float,
        is_milestone: bool,
        contrib_fixed: float,
        contrib_pct: float,
        contrib_total: float,
        actual_rent_paid: float,
        rent_shortfall: float,
        housing_due: float,
        housing_paid: float,
        housing_shortfall: float,
    ) -> DomainMonthlyRecord:
        """Check for purchase and create monthly record."""
        fgts_used_this_month = 0.0
        status = "Aguardando compra"
        equity = 0.0
        monthly_hoa = rent_result["monthly_hoa"]
        monthly_property_tax = rent_result["monthly_property_tax"]
        monthly_additional = rent_result["monthly_additional"]

        investment_available = self._account.liquidation_net_value()
        withdrawable_fgts = 0.0
        if self._fgts_manager and self._fgts_manager.use_at_purchase:
            withdrawable_fgts = min(self.fgts_balance, current_property_value)
            max_withdrawal = getattr(
                self._fgts_manager, "max_withdrawal_at_purchase", None
            )
            if max_withdrawal is not None:
                withdrawable_fgts = min(withdrawable_fgts, float(max_withdrawal))

        fgts_available = withdrawable_fgts

        # Business rule: FGTS can help with the property price, but not with
        # transaction costs like ITBI/escritura. Those must be covered by cash
        # (investment liquidation here).
        purchase_upfront = max(0.0, total_purchase_cost - current_property_value)
        shortfall_for_fgts = max(0.0, total_purchase_cost - investment_available)

        can_cover_total = (investment_available + fgts_available) >= total_purchase_cost
        can_cover_upfront = investment_available >= purchase_upfront

        if can_cover_total and can_cover_upfront:
            # Purchase!
            remaining_needed = total_purchase_cost
            if self._fgts_manager and self._fgts_manager.use_at_purchase:
                fgts_request_cap = min(fgts_available, current_property_value)
                fgts_needed = min(shortfall_for_fgts, fgts_request_cap)
                if fgts_needed > 0:
                    fgts_used_this_month = self._fgts_manager.withdraw_for_purchase(
                        fgts_needed, month=month
                    )
                    remaining_needed -= fgts_used_this_month

            purchase_withdrawal = self._account.withdraw_net(remaining_needed)
            self._purchase_month = month
            status = "Imóvel comprado"
            equity = current_property_value
            progress_percent = 100.0
            shortfall = 0.0
            is_milestone = True

            # Merge withdrawal details (rent + purchase) for reporting.
            cashflow_result["investment_withdrawal_gross"] = (
                cashflow_result.get("investment_withdrawal_gross", 0.0)
                + purchase_withdrawal.gross_withdrawal
            )
            cashflow_result["investment_withdrawal_net"] = (
                cashflow_result.get("investment_withdrawal_net", 0.0)
                + purchase_withdrawal.net_cash
            )
            cashflow_result["investment_withdrawal_realized_gain"] = (
                cashflow_result.get("investment_withdrawal_realized_gain", 0.0)
                + purchase_withdrawal.realized_gain
            )
            cashflow_result["investment_withdrawal_tax_paid"] = (
                cashflow_result.get("investment_withdrawal_tax_paid", 0.0)
                + purchase_withdrawal.tax_paid
            )

            # Regra de negócio (conservadora): no mês da compra ainda pode existir
            # sobreposição de despesas (ex.: aluguel do mês já contratado/pago e,
            # ao mesmo tempo, início de custos como condomínio/IPTU).
            # Modelar essa sobreposição evita subestimar o custo real do mês da compra.
            monthly_hoa, monthly_property_tax, monthly_additional = (
                self.get_inflated_monthly_costs(month)
            )
            self._total_monthly_additional_costs += monthly_additional

        # New semantics: cash_flow/total_monthly_cost represent all monthly outflows and cash allocations.
        initial_deposit = (
            (self.down_payment + self.initial_investment) if month == 1 else 0.0
        )

        # NOTE: income surplus is no longer auto-invested. Only explicit contributions count.
        # additional_investment is now already just contrib_total from the caller.
        additional_investment_effective = additional_investment

        # If the purchase happens now, the initial capital already covers the price and
        # upfront costs. Avoid double-counting by zeroing extra deposits.
        if status == "Imóvel comprado":
            additional_investment_effective = 0.0

        contributions_outflow = (
            initial_deposit + contrib_total + additional_investment_effective
        )
        # Avoid double-counting contrib_total (it's already in additional_investment_effective)
        if additional_investment_effective == contrib_total:
            contributions_outflow = initial_deposit + contrib_total

        # Rent is always due pre-purchase (purchase month can overlap). Costs (HOA/IPTU)
        # are tracked separately via monthly_additional_costs.
        rent_due = current_rent
        total_monthly_cost = rent_due + monthly_additional + contributions_outflow
        cash_flow = -total_monthly_cost
        if additional_investment_effective > 0:
            self._total_additional_investments += additional_investment_effective

        withdrawal = cashflow_result.get("rent_withdrawal", 0.0)
        sustainable_withdrawal_ratio = (
            (investment_result.net_return / withdrawal) if withdrawal > 0 else None
        )
        burn_month = withdrawal > 0 and investment_result.net_return < withdrawal

        # Get income_surplus_available for budget validation
        income_surplus_available = cashflow_result.get("income_surplus_available", 0.0)

        return DomainMonthlyRecord(
            month=month,
            cash_flow=cash_flow,
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
            total_monthly_cost=total_monthly_cost,
            status=status,
            equity=equity,
            property_value=current_property_value,
            additional_investment=additional_investment,
            extra_contribution_fixed=contrib_fixed,
            extra_contribution_percentage=contrib_pct,
            extra_contribution_total=contrib_total,
            target_purchase_cost=total_purchase_cost,
            progress_percent=progress_percent,
            shortfall=shortfall,
            is_milestone=is_milestone,
            scenario_type="invest_buy",
            phase="post_purchase" if status == "Imóvel comprado" else "pre_purchase",
            rent_withdrawal_from_investment=withdrawal,
            remaining_investment_before_return=cashflow_result[
                "remaining_before_return"
            ],
            external_cover=cashflow_result["external_cover"],
            # Track income surplus available for budget validation
            income_surplus_available=(
                income_surplus_available if income_surplus_available > 0 else None
            ),
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
            fgts_used=fgts_used_this_month if self.fgts else 0.0,
            upfront_additional_costs=(
                purchase_upfront if status == "Imóvel comprado" else 0.0
            ),
        )

    def _handle_post_purchase_month(
        self,
        month: int,
        current_property_value: float,
        _costs: CostsBreakdown,
    ) -> None:
        """Handle simulation for months after purchase."""
        _, _, monthly_additional = self.get_inflated_monthly_costs(month)

        # Apply scheduled contributions if configured to continue after purchase
        contrib_fixed = 0.0
        contrib_pct = 0.0
        contrib_total = 0.0
        if self.continue_contributions_after_purchase:
            contrib_fixed, contrib_pct, contrib_total = (
                self._apply_scheduled_contributions(month)
            )

        # Apply investment returns
        investment_result: InvestmentResult = self._account.apply_monthly_return(month)

        total_contributions = contrib_total
        total_monthly_cost = monthly_additional + total_contributions
        cash_flow = -total_monthly_cost
        self._total_monthly_additional_costs += monthly_additional

        record = DomainMonthlyRecord(
            month=month,
            cash_flow=cash_flow,
            investment_balance=self._account.balance,
            equity=current_property_value,
            status="Imóvel comprado",
            monthly_additional_costs=monthly_additional,
            total_monthly_cost=total_monthly_cost,
            property_value=current_property_value,
            investment_return_gross=investment_result.gross_return,
            investment_tax_paid=investment_result.tax_paid,
            investment_return_net=investment_result.net_return,
            additional_investment=None,
            extra_contribution_fixed=contrib_fixed if contrib_fixed > 0 else None,
            extra_contribution_percentage=contrib_pct if contrib_pct > 0 else None,
            extra_contribution_total=contrib_total if contrib_total > 0 else None,
            scenario_type="invest_buy",
            progress_percent=100.0,
            shortfall=0.0,
            is_milestone=True,
            phase="post_purchase",
            fgts_balance=self.fgts_balance if self.fgts else None,
            fgts_used=0.0,
        )
        self._monthly_data.append(record)

    def _annotate_metadata(self) -> None:
        """Annotate metadata on first monthly record."""
        if not self._monthly_data:
            return

        if self._purchase_month is not None:
            purchase_price = next(
                (
                    d.property_value
                    for d in self._monthly_data
                    if d.month == self._purchase_month and d.property_value is not None
                ),
                self.property_value,
            )
            self._monthly_data[0].purchase_month = self._purchase_month
            self._monthly_data[0].purchase_price = float(purchase_price)
            return

        # Calculate projected purchase month
        milestone_rows = [d for d in self._monthly_data if d.is_milestone]
        window = (milestone_rows or self._monthly_data)[-6:]
        avg_growth = 0.0

        if len(window) >= 2:
            deltas = [
                (window[i].investment_balance or 0.0)
                - (window[i - 1].investment_balance or 0.0)
                for i in range(1, len(window))
            ]
            avg_growth = sum(deltas) / len(deltas) if deltas else 0.0

        latest = self._monthly_data[-1]
        target_cost = latest.target_purchase_cost or self.property_value
        balance = latest.investment_balance or 0.0

        est_months_remaining = None
        if avg_growth > 0 and balance < target_cost:
            est_months_remaining = max(
                0, math.ceil((target_cost - balance) / avg_growth)
            )

        self._monthly_data[0].projected_purchase_month = (
            (latest.month + est_months_remaining)
            if est_months_remaining is not None
            else None
        )
        self._monthly_data[0].estimated_months_remaining = est_months_remaining

    def _build_domain_result(self) -> DomainComparisonScenario:
        """Build the final comparison scenario result (domain)."""
        final_month = self.term_months
        final_property_value = apply_property_appreciation(
            self.property_value,
            final_month,
            1,
            self.property_appreciation_rate,
            self.inflation_rate,
        )

        final_equity = (
            (final_property_value if self._purchase_month else 0.0)
            + self._account.balance
            + self.fgts_balance
        )

        total_outflows = sum((d.total_monthly_cost or 0.0) for d in self._monthly_data)

        net_cost = total_outflows - final_equity

        # Consumption approximation: rent due + ownership monthly costs + transaction costs.
        total_consumption = 0.0
        for d in self._monthly_data:
            total_consumption += d.rent_due or 0.0
            total_consumption += d.monthly_additional_costs or 0.0
            total_consumption += d.upfront_additional_costs or 0.0

        # Ensure chronological ordering
        self._monthly_data.sort(key=lambda d: d.month)

        return DomainComparisonScenario(
            name=self.scenario_name,
            scenario_type="invest_buy",
            total_cost=net_cost,
            final_equity=final_equity,
            total_consumption=total_consumption,
            monthly_data=self._monthly_data,
            total_outflows=total_outflows,
            net_cost=net_cost,
        )
