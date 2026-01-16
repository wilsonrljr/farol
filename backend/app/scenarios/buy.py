"""Buy with financing scenario simulator.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
"""

from collections.abc import Sequence
from dataclasses import dataclass, field

from ..core.amortization import expand_amortization_to_months, preprocess_amortizations
from ..core.inflation import apply_property_appreciation
from ..core.investment import InvestmentAccount
from ..core.protocols import (
    AmortizationLike,
    ContributionLike,
    InvestmentReturnLike,
    InvestmentTaxLike,
)
from ..domain.mappers import comparison_scenario_to_api
from ..domain.models import (
    ComparisonScenario as DomainComparisonScenario,
    FGTSUsageSummary,
    FGTSWithdrawalRecord,
    MonthlyRecord as DomainMonthlyRecord,
    PurchaseBreakdown,
)
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

    # Initial investment for opportunity cost tracking
    initial_investment: float = field(default=0.0)
    investment_returns: Sequence[InvestmentReturnLike] | None = field(default=None)
    investment_tax: InvestmentTaxLike | None = field(default=None)

    # Scheduled investment contributions (aportes) - for consistency with other scenarios
    contributions: Sequence[ContributionLike] | None = field(default=None)

    # Monthly net income (optional): housing costs are paid from this income;
    # any surplus is invested. This keeps the buy scenario consistent with
    # rent/invest behavior, especially after early payoff.
    monthly_net_income: float | None = field(default=None)
    monthly_net_income_adjust_inflation: bool = field(default=False)

    # Internal state
    _loan_result: LoanSimulationResult | None = field(init=False, default=None)
    _fgts_used_at_purchase: float = field(init=False, default=0.0)
    _purchase_breakdown: PurchaseBreakdown | None = field(init=False, default=None)
    _fgts_summary: FGTSUsageSummary | None = field(init=False, default=None)
    _loan_simulator: LoanSimulator | None = field(init=False, default=None)
    _cash_amortizations: Sequence[AmortizationLike] | None = field(
        init=False, default=None
    )
    _fgts_amortizations: Sequence[AmortizationLike] | None = field(
        init=False, default=None
    )
    _bonus_amortizations: Sequence[AmortizationLike] | None = field(
        init=False, default=None
    )
    _13_salario_amortizations: Sequence[AmortizationLike] | None = field(
        init=False, default=None
    )
    _bonus_by_month: dict[int, float] = field(init=False, default_factory=dict)
    _13_salario_by_month: dict[int, float] = field(init=False, default_factory=dict)
    _loan_value: float = field(init=False, default=0.0)
    _total_upfront_costs: float = field(init=False, default=0.0)
    _total_monthly_additional_costs: float = field(init=False, default=0.0)
    _investment_account: InvestmentAccount | None = field(init=False, default=None)
    _fixed_contrib_by_month: dict[int, float] = field(init=False, default_factory=dict)
    _percent_contrib_by_month: dict[int, list[float]] = field(
        init=False, default_factory=dict
    )
    _total_contributions: float = field(init=False, default=0.0)

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

        # Preprocess scheduled contributions
        self._preprocess_contributions()

        # Check if we need investment tracking (for opportunity cost or contributions)
        has_contributions = bool(self.contributions)
        has_income_surplus = bool(
            self.monthly_net_income and self.monthly_net_income > 0
        )
        needs_investment_tracking = (
            self.initial_investment > 0 or has_contributions or has_income_surplus
        )

        # Initialize investment tracking for opportunity cost and/or contributions.
        # We use the same InvestmentAccount engine used by the other scenarios.
        if needs_investment_tracking:
            self._investment_account = InvestmentAccount(
                investment_returns=list(self.investment_returns or []),
                investment_tax=self.investment_tax,
                balance=self.initial_investment,
                principal=self.initial_investment,
            )
        else:
            self._investment_account = None

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
        """Apply scheduled contributions (aportes programados).

        Returns:
            Tuple of (fixed_contribution, percentage_contribution, total_contribution)
        """
        if self._investment_account is None:
            return 0.0, 0.0, 0.0

        contrib_fixed = 0.0
        contrib_pct = 0.0

        # Apply scheduled contributions (from contributions array)
        if month in self._fixed_contrib_by_month:
            val = self._fixed_contrib_by_month[month]
            contrib_fixed += val
            self._investment_account.deposit(val)

        if month in self._percent_contrib_by_month:
            pct_total = sum(self._percent_contrib_by_month[month])
            if pct_total > 0 and self._investment_account.balance > 0:
                pct_amount = self._investment_account.balance * (pct_total / 100.0)
                contrib_pct += pct_amount
                self._investment_account.deposit(pct_amount)

        contrib_total = contrib_fixed + contrib_pct
        if contrib_total > 0:
            self._total_contributions += contrib_total

        return contrib_fixed, contrib_pct, contrib_total

    def _process_monthly_cashflows(
        self, housing_due: float, month: int
    ) -> dict[str, float]:
        """Process monthly cashflows based on income (if provided).

        When monthly_net_income is provided:
        - Housing costs are paid from income
        - Surplus is tracked but NOT automatically invested (user controls via contributions)
        - Shortfall is tracked as housing_shortfall

        When monthly_net_income is not provided:
        - Housing is assumed paid externally (legacy behavior)

        IMPORTANT: The surplus (sobra) is NOT automatically invested.
        The user must explicitly configure contributions (aportes) to invest.
        The surplus is provided as 'income_surplus_available' for validation purposes.
        """
        income_cover = 0.0
        income_surplus_available = 0.0
        actual_housing_paid = housing_due

        effective_income = self.get_effective_monthly_net_income(
            month,
            self.monthly_net_income,
            self.monthly_net_income_adjust_inflation,
        )

        if effective_income is not None and effective_income > 0:
            income_cover = min(housing_due, effective_income)
            income_surplus_available = max(0.0, effective_income - income_cover)
            actual_housing_paid = income_cover

        housing_shortfall = max(0.0, housing_due - actual_housing_paid)

        return {
            "income_cover": income_cover,
            "income_surplus_available": income_surplus_available,
            "income_surplus_invested": 0.0,  # No longer auto-invested
            "actual_housing_paid": actual_housing_paid,
            "housing_shortfall": housing_shortfall,
        }

    def simulate(self) -> ComparisonScenario:
        """Run the buy scenario simulation (API model)."""
        return comparison_scenario_to_api(self.simulate_domain())

    def simulate_domain(self) -> DomainComparisonScenario:
        """Run the buy scenario simulation (domain model)."""
        self._prepare_simulation()
        self._simulate_loan()
        self._generate_monthly_data()
        self._build_fgts_summary()
        return self._build_domain_result()

    def _prepare_simulation(self) -> None:
        """Prepare simulation parameters."""
        self._split_amortizations()
        self._total_upfront_costs = self._costs["total_upfront"]
        self._calculate_fgts_usage()
        self._calculate_loan_value()

    def _calculate_fgts_usage(self) -> None:
        """Calculate FGTS usage for purchase."""
        if self._fgts_manager is None:
            self._fgts_used_at_purchase = 0.0
            return

        max_needed = max(0.0, self.property_value - self.down_payment)
        # Purchase happens at the start of the simulation (month 1), so use that
        # month to correctly seed the amortization cooldown window.
        self._fgts_used_at_purchase = self._fgts_manager.withdraw_for_purchase(
            max_needed, month=1
        )

    def _calculate_loan_value(self) -> None:
        """Calculate loan value after down payment and FGTS."""
        self._loan_value = (
            self.property_value - self.down_payment - self._fgts_used_at_purchase
        )
        if self._loan_value < 0:
            self._loan_value = 0.0

        self._purchase_breakdown = PurchaseBreakdown(
            property_value=self.property_value,
            cash_down_payment=self.down_payment,
            fgts_at_purchase=self._fgts_used_at_purchase,
            total_down_payment=self.down_payment + self._fgts_used_at_purchase,
            financed_amount=self._loan_value,
            upfront_costs=self._total_upfront_costs,
            total_cash_needed=self.down_payment + self._total_upfront_costs,
        )

    def _split_amortizations(self) -> None:
        """Separate amortizations by funding source (cash, FGTS, bonus, 13_salario).

        All non-FGTS sources are treated as cash for loan purposes, but we track
        bonus and 13_salario separately for affordability analysis.
        """

        cash: list[AmortizationLike] = []
        fgts: list[AmortizationLike] = []
        bonus: list[AmortizationLike] = []
        decimo_terceiro: list[AmortizationLike] = []

        for amort in self.amortizations or []:
            source = getattr(amort, "funding_source", None) or "cash"
            if source == "fgts":
                fgts.append(amort)
            elif source == "bonus":
                bonus.append(amort)
                cash.append(amort)  # Also include in cash for loan simulation
            elif source == "13_salario":
                decimo_terceiro.append(amort)
                cash.append(amort)  # Also include in cash for loan simulation
            else:
                cash.append(amort)

        self._cash_amortizations = cash or None
        self._fgts_amortizations = fgts or None
        self._bonus_amortizations = bonus or None
        self._13_salario_amortizations = decimo_terceiro or None

        # Expand bonus and 13_salario to per-month values for tracking
        self._bonus_by_month = expand_amortization_to_months(
            bonus, self.term_months, self.inflation_rate
        )
        self._13_salario_by_month = expand_amortization_to_months(
            decimo_terceiro, self.term_months, self.inflation_rate
        )

    def _simulate_loan(self) -> None:
        """Simulate the loan using appropriate method."""
        simulator: LoanSimulator
        if self.loan_type == "SAC":
            simulator = SACLoanSimulator(
                loan_value=self._loan_value,
                term_months=self.term_months,
                monthly_interest_rate=self.monthly_interest_rate,
                amortizations=self._cash_amortizations,
                fgts_amortizations=self._fgts_amortizations,
                fgts_manager=self._fgts_manager,
                annual_inflation_rate=self.inflation_rate,
            )
        else:
            simulator = PriceLoanSimulator(
                loan_value=self._loan_value,
                term_months=self.term_months,
                monthly_interest_rate=self.monthly_interest_rate,
                amortizations=self._cash_amortizations,
                fgts_amortizations=self._fgts_amortizations,
                fgts_manager=self._fgts_manager,
                annual_inflation_rate=self.inflation_rate,
            )

        self._loan_simulator = simulator
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
        fgts_balance_timeline = (
            dict(getattr(self._loan_simulator, "_fgts_balance_timeline", []))
            if self._loan_simulator
            else {}
        )

        for month in range(1, self.term_months + 1):
            inst = installments[month - 1] if month <= actual_term_months else None

            fgts_balance_current = None
            if self._fgts_manager:
                if month <= actual_term_months:
                    fgts_balance_current = fgts_balance_timeline.get(
                        month, self._fgts_manager.balance
                    )
                else:
                    fgts_balance_current = self.accumulate_fgts()

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

            # Running totals (new semantics): include all cash allocations/outflows.
            # Month 1 includes down payment + upfront costs.
            if month == 1:
                cumulative_payments += (
                    self.down_payment
                    + self._total_upfront_costs
                    + self._fgts_used_at_purchase
                )
                if self.initial_investment > 0:
                    cumulative_payments += self.initial_investment

            installment_value = inst.installment if inst is not None else 0.0
            amortization_value = inst.amortization if inst is not None else 0.0
            interest_value = inst.interest if inst is not None else 0.0
            extra_amortization_value = (
                inst.extra_amortization if inst is not None else 0.0
            )
            extra_amortization_cash_raw = (
                getattr(inst, "extra_amortization_cash", 0.0)
                if inst is not None
                else 0.0
            )
            extra_amortization_fgts = (
                getattr(inst, "extra_amortization_fgts", 0.0)
                if inst is not None
                else 0.0
            )
            outstanding_balance = inst.outstanding_balance if inst is not None else 0.0

            # Get bonus and 13_salario values for this month (for affordability tracking)
            # These are tracked separately for UI display but are INCLUDED in extra_amortization_cash_raw
            # from the loan simulator (because they were added to the cash amortizations list).
            # To avoid double-counting, we subtract them from the raw cash value.
            extra_amortization_bonus = self._bonus_by_month.get(month, 0.0)
            extra_amortization_13_salario = self._13_salario_by_month.get(month, 0.0)

            # Pure cash extra amortization (excluding bonus and 13_salario which are shown separately)
            extra_amortization_cash = max(
                0.0,
                extra_amortization_cash_raw
                - extra_amortization_bonus
                - extra_amortization_13_salario,
            )

            extra_total = (
                extra_amortization_cash
                + extra_amortization_fgts
                + extra_amortization_bonus
                + extra_amortization_13_salario
            )
            installment_base = max(0.0, installment_value - extra_total)
            housing_due = (
                installment_base + monthly_additional + extra_amortization_cash
            )

            cumulative_payments += installment_value + monthly_additional
            cumulative_interest += interest_value

            # Apply scheduled contributions and fixed monthly investment
            contrib_fixed, contrib_pct, contrib_total = self._apply_contributions(month)
            if contrib_total > 0:
                cumulative_payments += contrib_total

            cashflow_result = self._process_monthly_cashflows(housing_due, month)

            # NOTE: income_surplus is no longer automatically invested.
            # Investments come only from explicit contributions (aportes).
            # The surplus is tracked for budget validation purposes.
            income_surplus_available = cashflow_result.get(
                "income_surplus_available", 0.0
            )

            # Apply investment returns for opportunity cost tracking
            if self._investment_account is not None:
                self._investment_account.apply_monthly_return(month)

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
                extra_amortization_value,
                extra_amortization_cash,
                extra_amortization_fgts,
                extra_amortization_bonus,
                extra_amortization_13_salario,
                outstanding_balance,
                fgts_balance_current,
                contrib_fixed,
                contrib_pct,
                contrib_total,
                housing_due,
                cashflow_result["actual_housing_paid"],
                cashflow_result["housing_shortfall"],
                cashflow_result["income_cover"],
                income_surplus_available,
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
        extra_amortization_value: float,
        extra_amortization_cash: float,
        extra_amortization_fgts: float,
        extra_amortization_bonus: float,
        extra_amortization_13_salario: float,
        outstanding_balance: float,
        fgts_balance_current: float | None,
        contrib_fixed: float = 0.0,
        contrib_pct: float = 0.0,
        contrib_total: float = 0.0,
        housing_due: float = 0.0,
        housing_paid: float = 0.0,
        housing_shortfall: float = 0.0,
        external_cover: float = 0.0,
        income_surplus_available: float = 0.0,
    ) -> DomainMonthlyRecord:
        """Create a monthly record from loan installment.

        Note: income_surplus_available is the amount available from income after
        paying housing costs. It is NOT automatically invested - the user must
        configure contributions (aportes) to invest. This value is for tracking
        budget feasibility.
        """
        equity = property_value - outstanding_balance
        upfront_and_initial = 0.0
        initial_allocation = 0.0
        if month == 1:
            upfront_and_initial = (
                self.down_payment
                + self._total_upfront_costs
                + self._fgts_used_at_purchase
            )
            initial_allocation = self.down_payment
            if self.initial_investment > 0:
                upfront_and_initial += self.initial_investment
                initial_allocation += self.initial_investment

        # Total monthly cost: only explicit outflows count
        # Contributions are the user-defined investment amount
        # income_surplus is no longer auto-invested
        total_monthly_cost = (
            installment_value + monthly_additional + upfront_and_initial + contrib_total
        )

        extra_total = (
            extra_amortization_cash
            + extra_amortization_fgts
            + extra_amortization_bonus
            + extra_amortization_13_salario
        )
        installment_base = max(0.0, installment_value - extra_total)
        principal_base = max(0.0, amortization_value - extra_total)

        # Include investment balance if tracking (either for opportunity cost or contributions)
        investment_balance = (
            self._investment_account.balance
            if self._investment_account is not None
            else None
        )

        # Prefer per-mês FGTS balance when disponível; mantém None quando não há FGTS.
        fgts_balance_value = (
            fgts_balance_current
            if self.fgts and fgts_balance_current is not None
            else (self.fgts_balance if self.fgts else None)
        )

        return DomainMonthlyRecord(
            month=month,
            cash_flow=-total_monthly_cost,
            equity=equity,
            investment_balance=investment_balance,
            installment=installment_value,
            installment_base=installment_base,
            principal_payment=amortization_value,
            principal_base=principal_base,
            interest_payment=interest_value,
            extra_amortization=extra_amortization_value,
            extra_amortization_cash=extra_amortization_cash,
            extra_amortization_fgts=extra_amortization_fgts,
            extra_amortization_bonus=extra_amortization_bonus or None,
            extra_amortization_13_salario=extra_amortization_13_salario or None,
            outstanding_balance=outstanding_balance,
            initial_allocation=initial_allocation,
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
            fgts_balance=fgts_balance_value,
            fgts_used=(
                self._fgts_used_at_purchase if (self.fgts and month == 1) else 0.0
            ),
            housing_due=housing_due,
            housing_paid=housing_paid,
            housing_shortfall=housing_shortfall,
            external_cover=external_cover if external_cover > 0 else None,
            # income_surplus_available is tracked for budget validation, not invested
            income_surplus_available=(
                income_surplus_available if income_surplus_available > 0 else None
            ),
            # Contributions (for consistency with other scenarios)
            extra_contribution_fixed=contrib_fixed if contrib_fixed > 0 else None,
            extra_contribution_percentage=contrib_pct if contrib_pct > 0 else None,
            extra_contribution_total=contrib_total if contrib_total > 0 else None,
            # additional_investment is now only from explicit contributions
            additional_investment=(contrib_total if contrib_total > 0 else None),
        )

    def _build_fgts_summary(self) -> None:
        """Compose FGTS usage summary for the scenario output."""

        if self._fgts_manager is None:
            self._fgts_summary = None
            return

        history = self._fgts_manager.withdrawal_history

        withdrawal_records: list[FGTSWithdrawalRecord] = [
            FGTSWithdrawalRecord(
                month=rec.month or 0,
                amount=rec.amount,
                requested_amount=rec.requested_amount,
                reason="purchase" if rec.reason == "purchase" else "amortization",
                success=rec.success,
                error=rec.error,
                cooldown_ends_at=rec.cooldown_ends_at,
                balance_after=rec.balance_after,
            )
            for rec in history
        ]

        total_withdrawn = sum(r.amount for r in withdrawal_records if r.success)
        withdrawn_at_purchase = sum(
            r.amount for r in withdrawal_records if r.success and r.reason == "purchase"
        )
        withdrawn_for_amortizations = sum(
            r.amount
            for r in withdrawal_records
            if r.success and r.reason == "amortization"
        )
        blocked = [r for r in withdrawal_records if not r.success]
        blocked_total_value = sum(r.requested_amount or 0.0 for r in blocked)

        monthly_contribution = getattr(self.fgts, "monthly_contribution", 0.0)
        total_contributions = monthly_contribution * self.term_months

        self._fgts_summary = FGTSUsageSummary(
            initial_balance=getattr(self.fgts, "initial_balance", 0.0),
            total_contributions=total_contributions,
            total_withdrawn=total_withdrawn,
            withdrawn_at_purchase=withdrawn_at_purchase,
            withdrawn_for_amortizations=withdrawn_for_amortizations,
            blocked_count=len(blocked),
            blocked_total_value=blocked_total_value,
            final_balance=self.fgts_balance,
            withdrawal_history=withdrawal_records,
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

        # Final equity should reflect the remaining loan balance (if any).
        final_outstanding_balance = (
            self._loan_result.installments[-1].outstanding_balance
            if self._loan_result.installments
            else 0.0
        )
        final_equity = (
            final_property_value - final_outstanding_balance
        ) + self.fgts_balance
        total_outflows = sum((d.total_monthly_cost or 0.0) for d in self._monthly_data)
        net_cost = total_outflows - final_equity

        # Consumption approximation: interest + ownership monthly costs + transaction costs.
        # Principal payments (amortization) and equity building are not consumption.
        total_consumption = 0.0
        for d in self._monthly_data:
            total_consumption += d.interest_payment or 0.0
            total_consumption += d.monthly_additional_costs or 0.0
            total_consumption += d.upfront_additional_costs or 0.0

        # Calculate opportunity cost (what initial investment would have grown to)
        # and include investment balance in final equity for fair comparison
        opportunity_cost: float | None = None
        if self._investment_account is not None:
            if self.initial_investment > 0:
                opportunity_cost = (
                    self._investment_account.balance - self.initial_investment
                )
            # Include investment balance in final equity for fair comparison
            # This applies both for initial investment tracking AND for contributions
            final_equity += self._investment_account.balance

        return DomainComparisonScenario(
            name=self.scenario_name,
            scenario_type="buy",
            total_cost=net_cost,
            final_equity=final_equity,
            total_consumption=total_consumption,
            monthly_data=self._monthly_data,
            total_outflows=total_outflows,
            net_cost=net_cost,
            opportunity_cost=opportunity_cost,
            purchase_breakdown=self._purchase_breakdown,
            fgts_summary=self._fgts_summary,
        )
