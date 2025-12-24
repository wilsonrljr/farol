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
from ..core.investment import InvestmentCalculator
from ..core.protocols import (
    AdditionalCostsLike,
    AmortizationLike,
    FGTSLike,
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

    # Internal state
    _loan_result: LoanSimulationResult | None = field(init=False, default=None)
    _fgts_used_at_purchase: float = field(init=False, default=0.0)
    _fgts_withdrawals: list[FGTSWithdrawalRecord] = field(
        init=False, default_factory=list
    )
    _fgts_blocked: list[FGTSWithdrawalRecord] = field(init=False, default_factory=list)
    _purchase_breakdown: PurchaseBreakdown | None = field(init=False, default=None)
    _fgts_summary: FGTSUsageSummary | None = field(init=False, default=None)
    _loan_simulator: LoanSimulator | None = field(init=False, default=None)
    _cash_amortizations: Sequence[AmortizationLike] | None = field(
        init=False, default=None
    )
    _fgts_amortizations: Sequence[AmortizationLike] | None = field(
        init=False, default=None
    )
    _loan_value: float = field(init=False, default=0.0)
    _total_upfront_costs: float = field(init=False, default=0.0)
    _total_monthly_additional_costs: float = field(init=False, default=0.0)
    _investment_balance: float = field(init=False, default=0.0)
    _investment_calculator: InvestmentCalculator | None = field(
        init=False, default=None
    )

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
        # Initialize investment tracking for opportunity cost
        self._investment_balance = self.initial_investment
        if self.investment_returns:
            self._investment_calculator = InvestmentCalculator(
                investment_returns=self.investment_returns,
                investment_tax=self.investment_tax,
            )
        else:
            self._investment_calculator = None

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
        """Separate amortizations by funding source (cash vs FGTS)."""

        cash: list[AmortizationLike] = []
        fgts: list[AmortizationLike] = []

        for amort in self.amortizations or []:
            source = getattr(amort, "funding_source", None) or "cash"
            if source == "fgts":
                fgts.append(amort)
            else:
                cash.append(amort)

        self._cash_amortizations = cash or None
        self._fgts_amortizations = fgts or None

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

        # Capture FGTS outcomes from the loan run
        self._fgts_withdrawals = [
            FGTSWithdrawalRecord(
                month=w.month or 0,
                amount=w.amount,
                requested_amount=w.requested_amount,
                reason="purchase" if w.reason == "purchase" else "amortization",
                success=w.success,
                error=w.error,
                cooldown_ends_at=w.cooldown_ends_at,
                balance_after=w.balance_after,
            )
            for w in getattr(simulator, "_fgts_withdrawals", [])
        ]
        self._fgts_blocked = [
            FGTSWithdrawalRecord(
                month=w.month or 0,
                amount=w.amount,
                requested_amount=w.requested_amount,
                reason="purchase" if w.reason == "purchase" else "amortization",
                success=w.success,
                error=w.error,
                cooldown_ends_at=w.cooldown_ends_at,
                balance_after=w.balance_after,
            )
            for w in getattr(simulator, "_fgts_blocked", [])
        ]

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
            outstanding_balance = inst.outstanding_balance if inst is not None else 0.0

            cumulative_payments += installment_value + monthly_additional
            cumulative_interest += interest_value

            # Apply investment returns for opportunity cost tracking
            if self._investment_calculator is not None:
                inv_result = self._investment_calculator.calculate_monthly_return(
                    self._investment_balance, month
                )
                self._investment_balance = inv_result.new_balance

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
                fgts_balance_current,
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
        fgts_balance_current: float | None,
    ) -> DomainMonthlyRecord:
        """Create a monthly record from loan installment."""
        equity = property_value - outstanding_balance
        upfront_and_initial = 0.0
        if month == 1:
            upfront_and_initial = (
                self.down_payment
                + self._total_upfront_costs
                + self._fgts_used_at_purchase
            )
            if self.initial_investment > 0:
                upfront_and_initial += self.initial_investment

        total_monthly_cost = (
            installment_value + monthly_additional + upfront_and_initial
        )

        # Include investment balance only if tracking opportunity cost
        investment_balance = (
            self._investment_balance if self.initial_investment > 0 else None
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
            fgts_balance=fgts_balance_value,
            fgts_used=(
                self._fgts_used_at_purchase if (self.fgts and month == 1) else 0.0
            ),
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

        # Calculate opportunity cost (what initial investment would have grown to)
        opportunity_cost: float | None = None
        if self.initial_investment > 0:
            opportunity_cost = self._investment_balance - self.initial_investment
            # Include investment balance in final equity for fair comparison
            final_equity += self._investment_balance

        return DomainComparisonScenario(
            name=self.scenario_name,
            scenario_type="buy",
            total_cost=net_cost,
            final_equity=final_equity,
            monthly_data=self._monthly_data,
            total_outflows=total_outflows,
            net_cost=net_cost,
            opportunity_cost=opportunity_cost,
            purchase_breakdown=self._purchase_breakdown,
            fgts_summary=self._fgts_summary,
        )

