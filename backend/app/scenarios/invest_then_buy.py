"""Invest then buy scenario simulator.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

import math
from dataclasses import dataclass, field

from ..core.amortization import preprocess_amortizations
from ..core.costs import calculate_additional_costs
from ..core.inflation import apply_inflation, apply_property_appreciation
from ..core.investment import InvestmentCalculator
from ..loans import PriceLoanSimulator, SACLoanSimulator
from ..models import (
    AdditionalCostsInput,
    AmortizationInput,
    ComparisonScenario,
    FGTSInput,
    InvestmentReturnInput,
    InvestmentTaxInput,
    LoanInstallment,
    MonthlyRecord,
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
    investment_returns: list[InvestmentReturnInput] = field(default_factory=list)
    rent_inflation_rate: float | None = field(default=None)
    property_appreciation_rate: float | None = field(default=None)
    invest_loan_difference: bool = field(default=False)
    fixed_monthly_investment: float | None = field(default=None)
    fixed_investment_start_month: int = field(default=1)
    loan_type: str = field(default="SAC")
    monthly_interest_rate: float = field(default=1.0)
    amortizations: list[AmortizationInput] | None = field(default=None)
    rent_reduces_investment: bool = field(default=False)
    monthly_external_savings: float | None = field(default=None)
    invest_external_surplus: bool = field(default=False)
    investment_tax: InvestmentTaxInput | None = field(default=None)

    # Internal state
    _investment_balance: float = field(init=False)
    _investment_calculator: InvestmentCalculator = field(init=False)
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
        self._investment_balance = self.down_payment
        self._investment_calculator = InvestmentCalculator(
            investment_returns=self.investment_returns,
            investment_tax=self.investment_tax,
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
        loan_value = self.property_value - self.down_payment

        if self.loan_type == "SAC":
            simulator = SACLoanSimulator(
                loan_value=loan_value,
                term_months=self.term_months,
                monthly_interest_rate=self.monthly_interest_rate,
                amortizations=self.amortizations,
                annual_inflation_rate=self.inflation_rate,
            )
        else:
            simulator = PriceLoanSimulator(
                loan_value=loan_value,
                term_months=self.term_months,
                monthly_interest_rate=self.monthly_interest_rate,
                amortizations=self.amortizations,
                annual_inflation_rate=self.inflation_rate,
            )

        result = simulator.simulate()
        self._loan_installments = result.installments

    def _preprocess_contributions(self) -> None:
        """Preprocess scheduled contributions from amortizations."""
        if not self.amortizations:
            self._fixed_contrib_by_month = {}
            self._percent_contrib_by_month = {}
            return

        fixed, percent = preprocess_amortizations(
            self.amortizations,
            self.term_months,
            self.inflation_rate,
        )
        self._fixed_contrib_by_month = fixed
        self._percent_contrib_by_month = percent

    def simulate(self) -> ComparisonScenario:
        """Run the invest then buy simulation."""
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
        return self._build_result()

    def _compute_purchase_cost(
        self,
        month: int,
    ) -> tuple[float, dict[str, float], float]:
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
        costs: dict[str, float],
        total_purchase_cost: float,
    ) -> None:
        """Handle simulation for months before purchase."""
        # Apply scheduled contributions
        contrib_fixed, contrib_pct, contrib_total = self._apply_scheduled_contributions(
            month
        )

        # Calculate rent and costs
        rent_result = self._compute_rent_costs(month, costs)
        current_rent = rent_result["current_rent"]
        total_rent_cost = rent_result["total_rent_cost"]

        # Apply rent cashflows
        cashflow_result = self._apply_rent_cashflows(total_rent_cost)

        # Apply investment returns
        investment_result = self._investment_calculator.calculate_monthly_return(
            self._investment_balance, month
        )
        self._investment_balance = investment_result.new_balance

        # Apply loan difference investment
        additional_investment = self._maybe_invest_loan_difference(
            month, total_rent_cost, costs
        )
        additional_investment = self._apply_fixed_monthly_investment(
            month, additional_investment
        )

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
        )
        self._monthly_data.append(record)

    def _apply_scheduled_contributions(self, month: int) -> tuple[float, float, float]:
        """Apply scheduled contributions from amortizations."""
        contrib_fixed = 0.0
        contrib_pct = 0.0

        if month in self._fixed_contrib_by_month:
            val = self._fixed_contrib_by_month[month]
            contrib_fixed += val
            self._investment_balance += val

        if month in self._percent_contrib_by_month:
            pct_total = sum(self._percent_contrib_by_month[month])
            if pct_total > 0 and self._investment_balance > 0:
                pct_amount = self._investment_balance * (pct_total / 100.0)
                contrib_pct += pct_amount
                self._investment_balance += pct_amount

        contrib_total = contrib_fixed + contrib_pct
        if contrib_total > 0:
            self._total_scheduled_contributions += contrib_total

        return contrib_fixed, contrib_pct, contrib_total

    def _compute_rent_costs(
        self,
        month: int,
        costs: dict[str, float],
    ) -> dict[str, float]:
        """Compute rent and additional costs for a month."""
        current_rent = self.get_current_rent(month)
        monthly_hoa = apply_inflation(
            costs["monthly_hoa"], month, 1, self.inflation_rate
        )
        monthly_property_tax = apply_inflation(
            costs["monthly_property_tax"], month, 1, self.inflation_rate
        )
        monthly_additional = monthly_hoa + monthly_property_tax
        total_rent_cost = current_rent + monthly_hoa + monthly_property_tax
        self._total_rent_paid += total_rent_cost

        return {
            "current_rent": current_rent,
            "monthly_hoa": monthly_hoa,
            "monthly_property_tax": monthly_property_tax,
            "monthly_additional": monthly_additional,
            "total_rent_cost": total_rent_cost,
        }

    def _apply_rent_cashflows(self, total_rent_cost: float) -> dict[str, float]:
        """Apply rent cashflows and external savings."""
        rent_withdrawal = 0.0
        external_cover = 0.0
        external_surplus_invested = 0.0
        remaining_before_return = self._investment_balance

        if self.rent_reduces_investment:
            remaining_cost = total_rent_cost

            # Apply external savings first
            if self.monthly_external_savings and self.monthly_external_savings > 0:
                external_cover = min(remaining_cost, self.monthly_external_savings)
                remaining_cost -= external_cover
                surplus = self.monthly_external_savings - external_cover

                if surplus > 0 and self.invest_external_surplus:
                    self._investment_balance += surplus
                    external_surplus_invested = surplus

            # Withdraw from investment
            rent_withdrawal = min(remaining_cost, self._investment_balance)
            self._investment_balance -= rent_withdrawal
            remaining_before_return = self._investment_balance
        elif self.invest_external_surplus and self.monthly_external_savings:
            self._investment_balance += self.monthly_external_savings
            external_surplus_invested = self.monthly_external_savings

        return {
            "rent_withdrawal": rent_withdrawal,
            "external_cover": external_cover,
            "external_surplus_invested": external_surplus_invested,
            "remaining_before_return": remaining_before_return,
        }

    def _maybe_invest_loan_difference(
        self,
        month: int,
        total_rent_cost: float,
        costs: dict[str, float],
    ) -> float:
        """Invest the difference between loan payment and rent."""
        if not self.invest_loan_difference or month > len(self._loan_installments):
            return 0.0

        additional_investment = 0.0

        if month == 1 and self._upfront_baseline > 0:
            additional_investment += self._upfront_baseline
            self._investment_balance += self._upfront_baseline

        loan_installment = self._loan_installments[month - 1]
        loan_monthly_hoa = apply_inflation(
            costs["monthly_hoa"], month, 1, self.inflation_rate
        )
        loan_monthly_property_tax = apply_inflation(
            costs["monthly_property_tax"], month, 1, self.inflation_rate
        )
        total_loan_payment = (
            loan_installment.installment + loan_monthly_hoa + loan_monthly_property_tax
        )

        if total_loan_payment > total_rent_cost:
            loan_difference = total_loan_payment - total_rent_cost
            additional_investment += loan_difference
            self._investment_balance += loan_difference

        return additional_investment

    def _apply_fixed_monthly_investment(
        self,
        month: int,
        additional_investment: float,
    ) -> float:
        """Apply fixed monthly investment if configured."""
        if self.fixed_monthly_investment and month >= self.fixed_investment_start_month:
            additional_investment += self.fixed_monthly_investment
            self._investment_balance += self.fixed_monthly_investment
        return additional_investment

    def _update_progress(
        self,
        month: int,
        total_purchase_cost: float,
    ) -> tuple[float, float, bool]:
        """Update progress tracking."""
        progress_percent = (
            (self._investment_balance / total_purchase_cost) * 100
            if total_purchase_cost > 0
            else 0.0
        )
        shortfall = max(0.0, total_purchase_cost - self._investment_balance)

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
        investment_result: object,
        additional_investment: float,
        progress_percent: float,
        shortfall: float,
        is_milestone: bool,
        contrib_fixed: float,
        contrib_pct: float,
        contrib_total: float,
    ) -> MonthlyRecord:
        """Check for purchase and create monthly record."""
        fgts_used_this_month = 0.0
        status = "Aguardando compra"
        equity = 0.0

        total_available = self._investment_balance
        if self._fgts_manager and self._fgts_manager.use_at_purchase:
            total_available += self.fgts_balance

        if total_available >= total_purchase_cost:
            # Purchase!
            if self._fgts_manager:
                needed_from_fgts = max(
                    0.0, total_purchase_cost - self._investment_balance
                )
                fgts_used_this_month = self._fgts_manager.withdraw_for_purchase(
                    needed_from_fgts
                )

            self._investment_balance -= total_purchase_cost - fgts_used_this_month
            self._purchase_month = month
            status = "Imóvel comprado"
            equity = current_property_value
            progress_percent = 100.0
            shortfall = 0.0
            is_milestone = True

        cash_flow = -(rent_result["total_rent_cost"] + additional_investment)
        if additional_investment > 0:
            self._total_additional_investments += additional_investment

        withdrawal = (
            cashflow_result["rent_withdrawal"] if self.rent_reduces_investment else 0.0
        )
        investment_return = investment_result.net_return  # type: ignore[attr-defined]

        sustainable_withdrawal_ratio = (
            (investment_return / withdrawal) if withdrawal > 0 else None
        )
        burn_month = withdrawal > 0 and investment_return < withdrawal

        return MonthlyRecord(
            month=month,
            cash_flow=cash_flow,
            investment_balance=self._investment_balance,
            investment_return=investment_return,
            rent_paid=current_rent,
            monthly_hoa=rent_result["monthly_hoa"],
            monthly_property_tax=rent_result["monthly_property_tax"],
            monthly_additional_costs=rent_result["monthly_additional"],
            total_monthly_cost=rent_result["total_rent_cost"],
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
            investment_return_gross=investment_result.gross_return,  # type: ignore[attr-defined]
            investment_tax_paid=investment_result.tax_paid,  # type: ignore[attr-defined]
            investment_return_net=investment_result.net_return,  # type: ignore[attr-defined]
            fgts_balance=self.fgts_balance if self.fgts else None,
            fgts_used=fgts_used_this_month if self.fgts else 0.0,
        )

    def _handle_post_purchase_month(
        self,
        month: int,
        current_property_value: float,
        costs: dict[str, float],
    ) -> None:
        """Handle simulation for months after purchase."""
        monthly_hoa = apply_inflation(
            costs["monthly_hoa"], month, 1, self.inflation_rate
        )
        monthly_property_tax = apply_inflation(
            costs["monthly_property_tax"], month, 1, self.inflation_rate
        )
        monthly_additional = monthly_hoa + monthly_property_tax

        # Apply investment returns
        investment_result = self._investment_calculator.calculate_monthly_return(
            self._investment_balance, month
        )
        self._investment_balance = investment_result.new_balance

        # Apply fixed investment
        additional_investment = 0.0
        if self.fixed_monthly_investment and month >= self.fixed_investment_start_month:
            additional_investment = self.fixed_monthly_investment
            self._investment_balance += additional_investment
            self._total_additional_investments += additional_investment

        cash_flow = -(monthly_additional + additional_investment)
        self._total_monthly_additional_costs += monthly_additional

        record = MonthlyRecord(
            month=month,
            cash_flow=cash_flow,
            investment_balance=self._investment_balance,
            equity=current_property_value,
            status="Imóvel comprado",
            monthly_additional_costs=monthly_additional,
            property_value=current_property_value,
            investment_return=investment_result.net_return,
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

    def _build_result(self) -> ComparisonScenario:
        """Build the final comparison scenario result."""
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
            + self._investment_balance
            + self.fgts_balance
        )

        if self._purchase_month:
            purchase_property_value = apply_property_appreciation(
                self.property_value,
                self._purchase_month,
                1,
                self.property_appreciation_rate,
                self.inflation_rate,
            )
            purchase_upfront = calculate_additional_costs(
                purchase_property_value, self.additional_costs
            )["total_upfront"]
            purchase_cost = purchase_property_value + purchase_upfront

            total_outflows = (
                self._total_rent_paid
                + purchase_cost
                + self._total_monthly_additional_costs
                + self._total_additional_investments
                + self._total_scheduled_contributions
            )
        else:
            total_outflows = (
                self._total_rent_paid
                + self._total_additional_investments
                + self._total_scheduled_contributions
            )

        net_cost = total_outflows - final_equity

        # Ensure chronological ordering
        self._monthly_data.sort(key=lambda d: d.month)

        return ComparisonScenario(
            name=self.scenario_name,
            total_cost=net_cost,
            final_equity=final_equity,
            monthly_data=self._monthly_data,
            total_outflows=total_outflows,
            net_cost=net_cost,
        )


def simulate_invest_then_buy_scenario(
    property_value: float,
    down_payment: float,
    term_months: int,
    investment_returns: list[InvestmentReturnInput],
    rent_value: float,
    additional_costs: AdditionalCostsInput | None = None,
    inflation_rate: float | None = None,
    rent_inflation_rate: float | None = None,
    property_appreciation_rate: float | None = None,
    invest_loan_difference: bool = False,
    fixed_monthly_investment: float | None = None,
    fixed_investment_start_month: int = 1,
    loan_type: str = "SAC",
    monthly_interest_rate: float = 1.0,
    amortizations: list[AmortizationInput] | None = None,
    rent_reduces_investment: bool = False,
    monthly_external_savings: float | None = None,
    invest_external_surplus: bool = False,
    investment_tax: InvestmentTaxInput | None = None,
    fgts: FGTSInput | None = None,
) -> ComparisonScenario:
    """Simulate investing until having enough to buy outright.

    Legacy function for backward compatibility.
    """
    simulator = InvestThenBuyScenarioSimulator(
        property_value=property_value,
        down_payment=down_payment,
        term_months=term_months,
        rent_value=rent_value,
        investment_returns=investment_returns,
        additional_costs=additional_costs,
        inflation_rate=inflation_rate,
        rent_inflation_rate=rent_inflation_rate,
        property_appreciation_rate=property_appreciation_rate,
        invest_loan_difference=invest_loan_difference,
        fixed_monthly_investment=fixed_monthly_investment,
        fixed_investment_start_month=fixed_investment_start_month,
        loan_type=loan_type,
        monthly_interest_rate=monthly_interest_rate,
        amortizations=amortizations,
        rent_reduces_investment=rent_reduces_investment,
        monthly_external_savings=monthly_external_savings,
        invest_external_surplus=invest_external_surplus,
        investment_tax=investment_tax,
        fgts=fgts,
    )
    return simulator.simulate()
