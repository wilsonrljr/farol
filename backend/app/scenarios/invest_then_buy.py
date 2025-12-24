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
from ..core.fgts import FGTSManager
from ..core.inflation import apply_property_appreciation
from ..core.investment import InvestmentAccount, InvestmentResult
from ..core.protocols import (
    AmortizationLike,
    ContributionLike,
    InvestmentReturnLike,
    InvestmentTaxLike,
)
from ..domain.mappers import comparison_scenario_to_api
from ..domain.models import ComparisonScenario as DomainComparisonScenario
from ..domain.models import MonthlyRecord as DomainMonthlyRecord
from ..loans import LoanSimulator, PriceLoanSimulator, SACLoanSimulator
from ..models import (
    ComparisonScenario,
    LoanInstallment,
)
from .base import RentalScenarioMixin, ScenarioSimulator

MILESTONE_THRESHOLDS = frozenset({25, 50, 75, 90, 100})


@dataclass
class InvestThenBuyScenarioSimulator(ScenarioSimulator, RentalScenarioMixin):
    """Simulator for investing until buying outright.

    Calculates wealth accumulation while renting, tracking progress
    toward purchasing the property without financing.
    """

    rent_value: float = field(default=0.0)
    investment_returns: Sequence[InvestmentReturnLike] = field(default_factory=list)
    rent_inflation_rate: float | None = field(default=None)
    property_appreciation_rate: float | None = field(default=None)
    invest_loan_difference: bool = field(default=False)
    fixed_monthly_investment: float | None = field(default=None)
    fixed_investment_start_month: int = field(default=1)
    loan_type: str = field(default="SAC")
    monthly_interest_rate: float = field(default=1.0)
    # Extra loan prepayments used only for the baseline loan comparison (invest_loan_difference).
    loan_amortizations: Sequence[AmortizationLike] | None = field(default=None)

    # Scheduled investment contributions (aportes).
    contributions: Sequence[ContributionLike] | None = field(default=None)
    rent_reduces_investment: bool = field(default=False)
    monthly_external_savings: float | None = field(default=None)
    invest_external_surplus: bool = field(default=False)
    investment_tax: InvestmentTaxLike | None = field(default=None)

    # Initial investment capital (total_savings - down_payment)
    initial_investment: float = field(default=0.0)

    # Internal state
    _account: InvestmentAccount = field(init=False)
    _loan_installments: list[LoanInstallment] = field(init=False, default_factory=list)
    _upfront_baseline: float = field(init=False, default=0.0)
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
        self._prepare_loan_baseline()
        self._preprocess_contributions()

    def _prepare_loan_baseline(self) -> None:
        """Prepare loan baseline for comparison."""
        if not self.invest_loan_difference:
            self._loan_installments = []
            self._upfront_baseline = 0.0
            return

        costs = calculate_additional_costs(self.property_value, self.additional_costs)
        self._upfront_baseline = costs["total_upfront"]

        # Baseline should mirror a "buy now" financing decision as closely as possible.
        # Important: baseline must NOT mutate the scenario's FGTS manager/balance, so we
        # create an isolated manager instance here.
        baseline_fgts_manager = FGTSManager.from_input(self.fgts)

        fgts_used_at_purchase = 0.0
        if baseline_fgts_manager and baseline_fgts_manager.use_at_purchase:
            max_needed = max(0.0, self.property_value - self.down_payment)
            # Purchase is assumed at month 1 (same semantics as BuyScenarioSimulator).
            fgts_used_at_purchase = baseline_fgts_manager.withdraw_for_purchase(
                max_needed,
                month=1,
            )

        loan_value = self.property_value - self.down_payment - fgts_used_at_purchase
        if loan_value < 0:
            loan_value = 0.0

        # Split amortizations by funding source so FGTS amortizations obey cooldown/saldo
        # rules in the baseline as they do in the real buy scenario.
        cash_amortizations: list[AmortizationLike] = []
        fgts_amortizations: list[AmortizationLike] = []
        for amort in self.loan_amortizations or []:
            source = getattr(amort, "funding_source", None) or "cash"
            if source == "fgts":
                fgts_amortizations.append(amort)
            else:
                cash_amortizations.append(amort)

        simulator: LoanSimulator
        if self.loan_type == "SAC":
            simulator = SACLoanSimulator(
                loan_value=loan_value,
                term_months=self.term_months,
                monthly_interest_rate=self.monthly_interest_rate,
                amortizations=cash_amortizations or None,
                fgts_amortizations=fgts_amortizations or None,
                fgts_manager=baseline_fgts_manager,
                annual_inflation_rate=self.inflation_rate,
            )
        else:
            simulator = PriceLoanSimulator(
                loan_value=loan_value,
                term_months=self.term_months,
                monthly_interest_rate=self.monthly_interest_rate,
                amortizations=cash_amortizations or None,
                fgts_amortizations=fgts_amortizations or None,
                fgts_manager=baseline_fgts_manager,
                annual_inflation_rate=self.inflation_rate,
            )

        result = simulator.simulate()
        self._loan_installments = result.installments

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

        # 2) Apply rent cashflows (may invest external surplus / withdraw from investment).
        cashflow_result = self._process_rent_cashflows(total_rent_cost)
        self._total_rent_paid += cashflow_result["actual_rent_paid"]

        # 3) Apply scheduled contributions and other planned investments BEFORE returns.
        contrib_fixed, contrib_pct, contrib_total = self._apply_scheduled_contributions(
            month
        )

        additional_investment = self._maybe_invest_loan_difference(
            month, total_rent_cost, costs
        )
        additional_investment = self._apply_fixed_monthly_investment(
            month, additional_investment
        )

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
            actual_rent_paid=cashflow_result["actual_rent_paid"],
            rent_shortfall=cashflow_result["rent_shortfall"],
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
        # Pre-purchase we are renting only; ownership costs (HOA/IPTU) are not paid yet.
        monthly_hoa, monthly_property_tax, monthly_additional = 0.0, 0.0, 0.0
        total_rent_cost = current_rent

        return {
            "current_rent": current_rent,
            "monthly_hoa": monthly_hoa,
            "monthly_property_tax": monthly_property_tax,
            "monthly_additional": monthly_additional,
            "total_rent_cost": total_rent_cost,
        }

    def _maybe_invest_loan_difference(
        self,
        month: int,
        total_rent_cost: float,
        _costs: CostsBreakdown,
    ) -> float:
        """Invest the difference between loan payment and rent."""
        if not self.invest_loan_difference or month > len(self._loan_installments):
            return 0.0

        additional_investment = 0.0

        if month == 1 and self._upfront_baseline > 0:
            additional_investment += self._upfront_baseline
            self._account.deposit(self._upfront_baseline)

        loan_installment = self._loan_installments[month - 1]
        _, _, loan_monthly_additional = self.get_inflated_monthly_costs(month)
        total_loan_payment = loan_installment.installment + loan_monthly_additional

        if total_loan_payment > total_rent_cost:
            loan_difference = total_loan_payment - total_rent_cost
            additional_investment += loan_difference
            self._account.deposit(loan_difference)

        return additional_investment

    def _apply_fixed_monthly_investment(
        self,
        month: int,
        additional_investment: float,
    ) -> float:
        """Apply fixed monthly investment if configured."""
        if self.fixed_monthly_investment and month >= self.fixed_investment_start_month:
            additional_investment += self.fixed_monthly_investment
            self._account.deposit(self.fixed_monthly_investment)
        return additional_investment

    def _process_rent_cashflows(self, rent_due: float) -> dict[str, float]:
        """Process rent-related cashflows using InvestmentAccount.

        Mirrors the old behavior but supports tax-on-withdrawal when configured.
        """
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
        invested_from_external = cashflow_result.get("external_surplus_invested", 0.0)

        # Count every deposit made this month as outflow; do not net out the baseline.
        # Deposits made because of invest_loan_difference are real cash allocations
        # and should appear in total_monthly_cost for correct ROI/cost accounting.
        additional_investment_effective = additional_investment

        # If the purchase happens now, the initial capital already covers the price and
        # upfront costs. Avoid double-counting by zeroing extra deposits tied to the
        # loan-difference strategy.
        if status == "Imóvel comprado":
            additional_investment_effective = 0.0

        contributions_outflow = (
            initial_deposit
            + invested_from_external
            + contrib_total
            + additional_investment_effective
        )

        # Robustness rule: rent is always due. If it couldn't be fully paid from modeled
        # sources, the shortfall must still be counted as an outflow.
        rent_due = current_rent
        total_monthly_cost = rent_due + monthly_additional + contributions_outflow
        cash_flow = -total_monthly_cost
        if additional_investment_effective > 0:
            self._total_additional_investments += additional_investment_effective

        withdrawal = (
            cashflow_result["rent_withdrawal"] if self.rent_reduces_investment else 0.0
        )
        sustainable_withdrawal_ratio = (
            (investment_result.net_return / withdrawal) if withdrawal > 0 else None
        )
        burn_month = withdrawal > 0 and investment_result.net_return < withdrawal

        return DomainMonthlyRecord(
            month=month,
            cash_flow=cash_flow,
            investment_balance=self._account.balance,
            rent_due=rent_due,
            rent_paid=actual_rent_paid,
            rent_shortfall=rent_shortfall,
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
            fgts_used=fgts_used_this_month if self.fgts else 0.0,
            upfront_additional_costs=(purchase_upfront if status == "Imóvel comprado" else 0.0),
        )

    def _handle_post_purchase_month(
        self,
        month: int,
        current_property_value: float,
        _costs: CostsBreakdown,
    ) -> None:
        """Handle simulation for months after purchase."""
        _, _, monthly_additional = self.get_inflated_monthly_costs(month)

        # Apply fixed investment BEFORE returns (consistent timeline).
        additional_investment = 0.0
        if self.fixed_monthly_investment and month >= self.fixed_investment_start_month:
            additional_investment = self.fixed_monthly_investment
            self._account.deposit(additional_investment)
            self._total_additional_investments += additional_investment

        # Apply investment returns
        investment_result: InvestmentResult = self._account.apply_monthly_return(month)

        total_monthly_cost = monthly_additional + additional_investment
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
            additional_investment=additional_investment,
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
            total_consumption += (d.rent_due or 0.0)
            total_consumption += (d.monthly_additional_costs or 0.0)
            total_consumption += (d.upfront_additional_costs or 0.0)

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
