"""Core financial calculations for Farol.

Copyright (C) 2025  Wilson Rocha Lacerda Junior

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
"""

import math
from collections import defaultdict
from dataclasses import dataclass, field

from .models import (
    AdditionalCostsInput,
    AmortizationInput,
    ComparisonMetrics,
    ComparisonResult,
    ComparisonScenario,
    EnhancedComparisonResult,
    EnhancedComparisonScenario,
    FGTSInput,
    InvestmentReturnInput,
    InvestmentTaxInput,
    LoanInstallment,
    LoanSimulationResult,
    MonthlyRecord,
)


def convert_interest_rate(
    annual_rate: float | None = None, monthly_rate: float | None = None
) -> tuple[float, float]:
    """Convert between annual and monthly interest rates."""
    if annual_rate is not None and monthly_rate is None:
        monthly_rate = ((1 + annual_rate / 100) ** (1 / 12) - 1) * 100
        return annual_rate, monthly_rate
    if monthly_rate is not None and annual_rate is None:
        annual_rate = ((1 + monthly_rate / 100) ** 12 - 1) * 100
        return annual_rate, monthly_rate
    if annual_rate is None and monthly_rate is None:
        raise ValueError("Either annual_rate or monthly_rate must be provided")

    # Both provided: validate consistency within small tolerance
    if annual_rate is None or monthly_rate is None:
        raise ValueError("Both rates cannot be None when both are provided")
    derived_annual = ((1 + monthly_rate / 100) ** 12 - 1) * 100
    # Allow minor rounding tolerance
    if abs(derived_annual - annual_rate) > 0.05:
        raise ValueError(
            f"Provided annual ({annual_rate:.4f}%) and monthly ({monthly_rate:.4f}%) rates are inconsistent (expected ~{derived_annual:.4f}%)."
        )
    return annual_rate, monthly_rate


def preprocess_amortizations(
    amortizations: list[AmortizationInput] | None,
    term_months: int,
    annual_inflation_rate: float | None = None,
) -> tuple[dict[int, float], dict[int, list[float]]]:
    """Expand and separate fixed and percentage amortizations.

    Returns:
        fixed_by_month: month -> total fixed extra amortization
        percent_by_month: month -> list of percentage values to apply on outstanding balance
    """
    if not amortizations:
        return {}, {}

    fixed_by_month: dict[int, float] = defaultdict(float)
    percent_by_month: dict[int, list[float]] = defaultdict(list)

    for a in amortizations:
        # Determine recurrence months
        if a.interval_months and a.interval_months > 0:
            start = a.month or 1
            if a.occurrences:
                months = [start + i * a.interval_months for i in range(a.occurrences)]
            else:
                end = a.end_month or term_months
                months = list(
                    range(start, min(end, term_months) + 1, a.interval_months)
                )
        else:
            # Single event
            if a.month is None:
                continue
            months = [a.month]

        base_month = months[0] if months else 1
        for m in months:
            if m < 1 or m > term_months:
                continue
            if a.value_type == "percentage":
                percent_by_month[m].append(a.value)
            else:
                val = a.value
                if a.inflation_adjust:
                    # Apply inflation relative to first occurrence (base_month)
                    val = apply_inflation(val, m, base_month, annual_inflation_rate)
                fixed_by_month[m] += val

    return dict(fixed_by_month), dict(percent_by_month)


def simulate_sac_loan(
    loan_value: float,
    term_months: int,
    monthly_interest_rate: float,
    amortizations: list[AmortizationInput] | None = None,
    annual_inflation_rate: float | None = None,
) -> LoanSimulationResult:
    """Simulate a loan using the SAC (Sistema de Amortização Constante) method."""
    # Convert interest rate to decimal
    monthly_rate_decimal = monthly_interest_rate / 100

    # Initialize variables
    installments: list[LoanInstallment] = []
    outstanding_balance = loan_value
    fixed_amortization = loan_value / term_months
    total_paid = 0.0
    total_interest_paid = 0.0
    total_extra_amortization_applied = 0.0

    # Preprocess amortizations (supports recurrence & percentage)
    fixed_extra_by_month, percent_extra_by_month = preprocess_amortizations(
        amortizations, term_months, annual_inflation_rate
    )

    # Calculate each installment
    for month in range(1, term_months + 1):
        # Sum fixed extra amortization for this month
        extra_amortization = fixed_extra_by_month.get(month, 0.0)
        # Apply percentage based amortizations dynamically
        if month in percent_extra_by_month and outstanding_balance > 0:
            for pct in percent_extra_by_month[month]:
                extra_amortization += outstanding_balance * (pct / 100.0)

        # Calculate interest for this month
        interest = outstanding_balance * monthly_rate_decimal

        # Regular amortization + extra amortization
        amortization = fixed_amortization + extra_amortization

        # Ensure we don't amortize more than the outstanding balance
        if amortization > outstanding_balance:
            amortization = outstanding_balance
            extra_amortization = amortization - fixed_amortization

        # Calculate installment
        installment = interest + amortization

        # Update outstanding balance
        outstanding_balance -= amortization

        # Track extra amortization actually applied
        if extra_amortization > 0:
            total_extra_amortization_applied += extra_amortization

        # Update totals
        total_paid += installment
        total_interest_paid += interest

        # Create installment object
        installment_obj = LoanInstallment(
            month=month,
            installment=installment,
            amortization=amortization,
            interest=interest,
            outstanding_balance=outstanding_balance,
            extra_amortization=extra_amortization,
        )

        installments.append(installment_obj)

        # If loan is fully paid, break
        if outstanding_balance <= 0:
            break

    actual_term = installments[-1].month if installments else term_months
    months_saved = term_months - actual_term if actual_term < term_months else 0
    return LoanSimulationResult(
        loan_value=loan_value,
        total_paid=total_paid,
        total_interest_paid=total_interest_paid,
        installments=installments,
        original_term_months=term_months,
        actual_term_months=actual_term,
        months_saved=months_saved if months_saved > 0 else None,
        total_extra_amortization=(
            total_extra_amortization_applied
            if total_extra_amortization_applied > 0
            else None
        ),
    )


def simulate_price_loan(
    loan_value: float,
    term_months: int,
    monthly_interest_rate: float,
    amortizations: list[AmortizationInput] | None = None,
    annual_inflation_rate: float | None = None,
) -> LoanSimulationResult:
    """Simulate a loan using the PRICE (French) method."""
    # Convert interest rate to decimal
    monthly_rate_decimal = monthly_interest_rate / 100

    # Calculate fixed installment (PMT formula)
    if monthly_rate_decimal > 0:
        fixed_installment = (
            loan_value
            * (monthly_rate_decimal * (1 + monthly_rate_decimal) ** term_months)
            / ((1 + monthly_rate_decimal) ** term_months - 1)
        )
    else:
        fixed_installment = loan_value / term_months

    # Initialize variables
    installments: list[LoanInstallment] = []
    outstanding_balance = loan_value
    total_paid = 0.0
    total_interest_paid = 0.0
    total_extra_amortization_applied = 0.0

    # Preprocess amortizations (supports recurrence & percentage)
    fixed_extra_by_month, percent_extra_by_month = preprocess_amortizations(
        amortizations, term_months, annual_inflation_rate
    )

    # Calculate each installment
    for month in range(1, term_months + 1):
        # Sum fixed extra amortization
        extra_amortization = fixed_extra_by_month.get(month, 0.0)
        # Add percentage extras
        if month in percent_extra_by_month and outstanding_balance > 0:
            for pct in percent_extra_by_month[month]:
                extra_amortization += outstanding_balance * (pct / 100.0)

        # Calculate interest for this month
        interest = outstanding_balance * monthly_rate_decimal

        # Calculate amortization (installment - interest)
        regular_amortization = fixed_installment - interest
        amortization = regular_amortization + extra_amortization

        # Ensure we don't amortize more than the outstanding balance
        if amortization > outstanding_balance:
            amortization = outstanding_balance
            extra_amortization = amortization - regular_amortization

        # Calculate installment
        installment = interest + amortization

        # Update outstanding balance
        outstanding_balance -= amortization

        if extra_amortization > 0:
            total_extra_amortization_applied += extra_amortization

        # Update totals
        total_paid += installment
        total_interest_paid += interest

        # Create installment object
        installment_obj = LoanInstallment(
            month=month,
            installment=installment,
            amortization=amortization,
            interest=interest,
            outstanding_balance=outstanding_balance,
            extra_amortization=extra_amortization,
        )

        installments.append(installment_obj)

        # If loan is fully paid, break
        if outstanding_balance <= 0:
            break

    actual_term = installments[-1].month if installments else term_months
    months_saved = term_months - actual_term if actual_term < term_months else 0
    return LoanSimulationResult(
        loan_value=loan_value,
        total_paid=total_paid,
        total_interest_paid=total_interest_paid,
        installments=installments,
        original_term_months=term_months,
        actual_term_months=actual_term,
        months_saved=months_saved if months_saved > 0 else None,
        total_extra_amortization=(
            total_extra_amortization_applied
            if total_extra_amortization_applied > 0
            else None
        ),
    )


def get_monthly_investment_rate(
    investment_returns: list[InvestmentReturnInput], month: int
) -> float:
    """Get the monthly investment rate for a specific month."""
    for ret in investment_returns:
        if ret.start_month <= month and (
            ret.end_month is None or month <= ret.end_month
        ):
            # Convert annual rate to monthly
            _, monthly_rate = convert_interest_rate(annual_rate=ret.annual_rate)
            return monthly_rate / 100

    # Default return if no matching period found
    return 0.0


def calculate_additional_costs(
    property_value: float, additional_costs: AdditionalCostsInput | None = None
) -> dict[str, float]:
    """Calculate additional costs associated with property purchase."""
    if additional_costs is None:
        return {
            "itbi": 0.0,
            "deed": 0.0,
            "total_upfront": 0.0,
            "monthly_hoa": 0.0,
            "monthly_property_tax": 0.0,
            "total_monthly": 0.0,
        }

    # Calculate upfront costs
    itbi = property_value * (additional_costs.itbi_percentage / 100)
    deed = property_value * (additional_costs.deed_percentage / 100)
    total_upfront = itbi + deed

    # Calculate monthly costs
    monthly_hoa = additional_costs.monthly_hoa or 0.0
    monthly_property_tax = additional_costs.monthly_property_tax or 0.0
    total_monthly = monthly_hoa + monthly_property_tax

    return {
        "itbi": itbi,
        "deed": deed,
        "total_upfront": total_upfront,
        "monthly_hoa": monthly_hoa,
        "monthly_property_tax": monthly_property_tax,
        "total_monthly": total_monthly,
    }


def apply_inflation(
    value: float,
    month: int,
    base_month: int = 1,
    annual_inflation_rate: float | None = None,
) -> float:
    """Apply inflation to a value based on the number of months passed."""
    if annual_inflation_rate is None or annual_inflation_rate == 0:
        return value

    months_passed = month - base_month

    # Convert annual inflation rate to monthly
    monthly_inflation_rate = (1 + annual_inflation_rate / 100) ** (1 / 12) - 1

    # Apply compound inflation
    return value * ((1 + monthly_inflation_rate) ** months_passed)


def apply_property_appreciation(
    property_value: float,
    month: int,
    base_month: int = 1,
    property_appreciation_rate: float | None = None,
    fallback_inflation_rate: float | None = None,
) -> float:
    """Apply property appreciation to a property value based on the number of months passed."""
    # Use property appreciation rate if provided, otherwise fall back to inflation rate
    appreciation_rate = property_appreciation_rate or fallback_inflation_rate

    if appreciation_rate is None or appreciation_rate == 0:
        return property_value

    months_passed = month - base_month

    # Convert annual appreciation rate to monthly
    monthly_appreciation_rate = (1 + appreciation_rate / 100) ** (1 / 12) - 1

    # Apply compound appreciation
    return property_value * ((1 + monthly_appreciation_rate) ** months_passed)


def _compute_fgts_monthly_rate(fgts: FGTSInput | None) -> float:
    if fgts and fgts.annual_yield_rate:
        return (1 + (fgts.annual_yield_rate or 0.0) / 100) ** (1 / 12) - 1
    return 0.0


def _accumulate_fgts_balance(
    fgts_balance: float, *, fgts: FGTSInput | None, fgts_monthly_rate: float
) -> float:
    if not fgts:
        return fgts_balance
    return (fgts_balance + (fgts.monthly_contribution or 0.0)) * (1 + fgts_monthly_rate)


def _inflated_monthly_additional_costs(
    costs: dict[str, float], *, month: int, inflation_rate: float | None
) -> tuple[float, float, float]:
    monthly_hoa = apply_inflation(costs["monthly_hoa"], month, 1, inflation_rate)
    monthly_property_tax = apply_inflation(
        costs["monthly_property_tax"], month, 1, inflation_rate
    )
    monthly_additional = monthly_hoa + monthly_property_tax
    return monthly_hoa, monthly_property_tax, monthly_additional


def _current_rent_value(
    rent_value: float,
    *,
    month: int,
    inflation_rate: float | None,
    rent_inflation_rate: float | None,
) -> float:
    effective_rent_inflation = (
        rent_inflation_rate if rent_inflation_rate is not None else inflation_rate
    )
    return apply_inflation(rent_value, month, 1, effective_rent_inflation)


def _apply_investment_return_with_tax(
    investment_balance: float,
    *,
    investment_returns: list[InvestmentReturnInput],
    month: int,
    investment_tax: InvestmentTaxInput | None,
) -> tuple[float, float, float, float]:
    monthly_rate = get_monthly_investment_rate(investment_returns, month)
    investment_return_gross = investment_balance * monthly_rate
    investment_tax_paid = 0.0
    if investment_tax and investment_tax.enabled and investment_return_gross > 0:
        investment_tax_paid = investment_return_gross * (
            investment_tax.effective_tax_rate / 100.0
        )
    investment_return_net = investment_return_gross - investment_tax_paid
    investment_balance += investment_return_net
    return (
        investment_balance,
        investment_return_gross,
        investment_tax_paid,
        investment_return_net,
    )


def _apply_external_savings_to_cost(
    investment_balance: float,
    *,
    remaining_cost: float,
    monthly_external_savings: float | None,
    invest_external_surplus: bool,
) -> tuple[float, float, float, float]:
    external_cover = 0.0
    external_surplus_invested = 0.0
    if monthly_external_savings and monthly_external_savings > 0:
        external_cover = min(remaining_cost, monthly_external_savings)
        remaining_cost -= external_cover
        surplus = monthly_external_savings - external_cover
        if surplus > 0 and invest_external_surplus:
            investment_balance += surplus
            external_surplus_invested = surplus
    return investment_balance, remaining_cost, external_cover, external_surplus_invested


def simulate_buy_scenario(
    property_value: float,
    down_payment: float,
    loan_term_years: int,
    monthly_interest_rate: float,
    loan_type: str,
    amortizations: list[AmortizationInput] | None = None,
    _investment_returns: (
        list[InvestmentReturnInput] | None
    ) = None,  # Not used in buy scenario
    additional_costs: AdditionalCostsInput | None = None,
    inflation_rate: float | None = None,
    _property_appreciation_rate: float | None = None,  # Not used in buy scenario
    _investment_tax: InvestmentTaxInput | None = None,  # Not used in buy scenario
    fgts: FGTSInput | None = None,
) -> ComparisonScenario:
    """Simulate buying a property with a loan."""
    # _investment_returns parameter is kept for API consistency but not used in buy scenario
    # Calculate additional costs
    costs = calculate_additional_costs(property_value, additional_costs)

    # Additional costs are always paid in cash (upfront) in this scenario.
    total_upfront_costs = costs["total_upfront"]

    fgts_balance = fgts.initial_balance if fgts else 0.0
    fgts_used_at_purchase = 0.0
    if fgts and fgts.use_at_purchase and fgts_balance > 0:
        max_needed = max(0.0, property_value - down_payment)
        allowed = min(fgts_balance, max_needed)
        if fgts.max_withdrawal_at_purchase is not None:
            allowed = min(allowed, fgts.max_withdrawal_at_purchase)
        fgts_used_at_purchase = allowed
        fgts_balance -= fgts_used_at_purchase

    loan_value = property_value - down_payment - fgts_used_at_purchase
    if loan_value < 0:
        loan_value = 0.0
    term_months = loan_term_years * 12

    fgts_monthly_rate = _compute_fgts_monthly_rate(fgts)

    # Simulate loan
    if loan_type == "SAC":
        loan_result = simulate_sac_loan(
            loan_value,
            term_months,
            monthly_interest_rate,
            amortizations,
            inflation_rate,
        )
    else:  # PRICE
        loan_result = simulate_price_loan(
            loan_value,
            term_months,
            monthly_interest_rate,
            amortizations,
            inflation_rate,
        )

    # Calculate monthly data
    monthly_data: list[MonthlyRecord] = []
    total_monthly_additional_costs = 0.0

    for inst in loan_result.installments:
        month = inst.month

        # After purchase, FGTS may continue to accumulate (MVP: track as separate wealth).
        fgts_balance = _accumulate_fgts_balance(
            fgts_balance, fgts=fgts, fgts_monthly_rate=fgts_monthly_rate
        )

        monthly_hoa, monthly_property_tax, monthly_additional = (
            _inflated_monthly_additional_costs(
                costs, month=month, inflation_rate=inflation_rate
            )
        )

        # Track total additional monthly costs
        total_monthly_additional_costs += monthly_additional

        # In "Buy with Financing" scenario, property value is fixed.
        # Appreciation is not applied.
        current_property_value = property_value

        monthly_data.append(
            MonthlyRecord(
                month=month,
                cash_flow=-(inst.installment + monthly_additional),
                equity=current_property_value - inst.outstanding_balance,
                installment=inst.installment,
                principal_payment=inst.amortization,
                interest_payment=inst.interest,
                outstanding_balance=inst.outstanding_balance,
                monthly_hoa=monthly_hoa,
                monthly_property_tax=monthly_property_tax,
                monthly_additional_costs=monthly_additional,
                property_value=current_property_value,
                total_monthly_cost=inst.installment + monthly_additional,
                cumulative_payments=sum(
                    i.installment for i in loan_result.installments[:month]
                )
                + sum(
                    apply_inflation(costs["monthly_hoa"], m, 1, inflation_rate)
                    + apply_inflation(
                        costs["monthly_property_tax"], m, 1, inflation_rate
                    )
                    for m in range(1, month + 1)
                )
                + total_upfront_costs,
                cumulative_interest=sum(
                    i.interest for i in loan_result.installments[:month]
                ),
                equity_percentage=(
                    (current_property_value - inst.outstanding_balance)
                    / current_property_value
                    if current_property_value > 0
                    else 0
                )
                * 100,
                scenario_type="buy",
                upfront_additional_costs=total_upfront_costs if month == 1 else 0.0,
                fgts_balance=fgts_balance if fgts else None,
                fgts_used=fgts_used_at_purchase if (fgts and month == 1) else 0.0,
            )
        )

    # Final equity includes the property plus any remaining FGTS balance tracked.
    final_equity = property_value + (fgts_balance if fgts else 0.0)

    total_outflows = (
        loan_result.total_paid
        + down_payment
        + total_upfront_costs
        + total_monthly_additional_costs
    )
    net_cost = total_outflows - final_equity

    return ComparisonScenario(
        name="Comprar com financiamento",
        total_cost=net_cost,  # Preserve original field meaning as net cost
        final_equity=final_equity,
        monthly_data=monthly_data,
        total_outflows=total_outflows,
        net_cost=net_cost,
    )


def simulate_rent_and_invest_scenario(
    property_value: float,
    down_payment: float,
    term_months: int,
    rent_value: float,
    investment_returns: list[InvestmentReturnInput],
    additional_costs: AdditionalCostsInput | None = None,
    inflation_rate: float | None = None,
    rent_inflation_rate: float | None = None,
    property_appreciation_rate: float | None = None,
    rent_reduces_investment: bool = False,
    monthly_external_savings: float | None = None,
    invest_external_surplus: bool = False,
    investment_tax: InvestmentTaxInput | None = None,
    fgts: FGTSInput | None = None,
) -> ComparisonScenario:
    """Simulate renting and investing the down payment."""
    # Initialize variables
    monthly_data: list[MonthlyRecord] = []
    investment_balance = down_payment
    fgts_balance = fgts.initial_balance if fgts else 0.0
    fgts_monthly_rate = _compute_fgts_monthly_rate(fgts)
    total_rent_paid = 0.0

    # Get base monthly additional costs
    costs = calculate_additional_costs(property_value, additional_costs)

    # Calculate monthly data
    for month in range(1, term_months + 1):
        fgts_balance = _accumulate_fgts_balance(
            fgts_balance, fgts=fgts, fgts_monthly_rate=fgts_monthly_rate
        )
        current_rent = _current_rent_value(
            rent_value,
            month=month,
            inflation_rate=inflation_rate,
            rent_inflation_rate=rent_inflation_rate,
        )

        current_monthly_hoa, current_monthly_property_tax, current_additional_costs = (
            _inflated_monthly_additional_costs(
                costs, month=month, inflation_rate=inflation_rate
            )
        )

        # Total monthly cost is rent + additional costs
        total_monthly_cost = current_rent + current_additional_costs
        total_rent_paid += total_monthly_cost

        rent_withdrawal = 0.0
        remaining_before_return = investment_balance
        investment_return = 0.0
        external_cover = 0.0
        external_surplus_invested = 0.0
        investment_return_gross = 0.0
        investment_tax_paid = 0.0
        investment_return_net = 0.0

        if rent_reduces_investment:
            cost_remaining = total_monthly_cost
            (
                investment_balance,
                cost_remaining,
                external_cover,
                external_surplus_invested,
            ) = _apply_external_savings_to_cost(
                investment_balance,
                remaining_cost=cost_remaining,
                monthly_external_savings=monthly_external_savings,
                invest_external_surplus=invest_external_surplus,
            )
            rent_withdrawal = min(cost_remaining, investment_balance)
            investment_balance -= rent_withdrawal
            remaining_before_return = investment_balance
            (
                investment_balance,
                investment_return_gross,
                investment_tax_paid,
                investment_return_net,
            ) = _apply_investment_return_with_tax(
                investment_balance,
                investment_returns=investment_returns,
                month=month,
                investment_tax=investment_tax,
            )
            investment_return = investment_return_net
        else:
            # Optionally invest external savings fully (modeling deposit of external income)
            if invest_external_surplus and monthly_external_savings:
                investment_balance += monthly_external_savings
                external_surplus_invested = monthly_external_savings
            (
                investment_balance,
                investment_return_gross,
                investment_tax_paid,
                investment_return_net,
            ) = _apply_investment_return_with_tax(
                investment_balance,
                investment_returns=investment_returns,
                month=month,
                investment_tax=investment_tax,
            )
            investment_return = investment_return_net
            remaining_before_return = investment_balance

        withdrawal_for_ratio = rent_withdrawal if rent_reduces_investment else 0.0
        sustainable_withdrawal_ratio = (
            (investment_return / withdrawal_for_ratio)
            if withdrawal_for_ratio > 0
            else None
        )
        burn_month = (
            withdrawal_for_ratio > 0 and investment_return < withdrawal_for_ratio
        )

        # For rent scenario, property value tracking is just for reference.
        # Keep the original value to avoid implying ownership/appreciation benefits.
        # (We still touch the appreciation param for consistency/validation.)
        if property_appreciation_rate is not None:
            _ = property_appreciation_rate
        current_property_value = property_value

        monthly_data.append(
            MonthlyRecord(
                month=month,
                cash_flow=-total_monthly_cost,
                investment_balance=investment_balance,
                investment_return=investment_return,
                rent_paid=current_rent,
                monthly_hoa=current_monthly_hoa,
                monthly_property_tax=current_monthly_property_tax,
                monthly_additional_costs=current_additional_costs,
                property_value=current_property_value,
                total_monthly_cost=total_monthly_cost,
                cumulative_rent_paid=total_rent_paid,
                cumulative_investment_gains=investment_balance - down_payment,
                investment_roi_percentage=(
                    ((investment_balance - down_payment) / down_payment * 100)
                    if down_payment
                    else 0.0
                ),
                scenario_type="rent_invest",
                equity=0.0,
                liquid_wealth=investment_balance,
                rent_withdrawal_from_investment=(
                    rent_withdrawal if rent_reduces_investment else 0.0
                ),
                remaining_investment_before_return=(
                    remaining_before_return
                    if rent_reduces_investment
                    else investment_balance
                ),
                external_cover=external_cover,
                external_surplus_invested=external_surplus_invested,
                sustainable_withdrawal_ratio=sustainable_withdrawal_ratio,
                burn_month=burn_month,
                investment_return_gross=investment_return_gross,
                investment_tax_paid=investment_tax_paid,
                investment_return_net=investment_return_net,
                fgts_balance=fgts_balance if fgts else None,
            )
        )

    # Gross outflows: rent payments
    total_outflows = total_rent_paid
    final_equity = investment_balance + (fgts_balance if fgts else 0.0)
    net_cost = total_outflows - final_equity  # rent minus final wealth

    return ComparisonScenario(
        name="Alugar e investir",
        total_cost=net_cost,
        final_equity=final_equity,
        monthly_data=monthly_data,
        total_outflows=total_outflows,
        net_cost=net_cost,
    )


@dataclass
class InvestThenBuySimulator:
    property_value: float
    down_payment: float
    term_months: int
    investment_returns: list[InvestmentReturnInput]
    rent_value: float
    additional_costs: AdditionalCostsInput | None
    inflation_rate: float | None
    rent_inflation_rate: float | None
    property_appreciation_rate: float | None
    invest_loan_difference: bool
    fixed_monthly_investment: float | None
    fixed_investment_start_month: int
    loan_type: str
    monthly_interest_rate: float
    amortizations: list[AmortizationInput] | None
    rent_reduces_investment: bool
    monthly_external_savings: float | None
    invest_external_surplus: bool
    investment_tax: InvestmentTaxInput | None
    fgts: FGTSInput | None

    investment_balance: float = field(init=False)
    fgts_balance: float = field(init=False)
    fgts_monthly_rate: float = field(init=False)
    loan_installments: list[LoanInstallment] = field(init=False, default_factory=list)
    upfront_baseline: float = field(init=False, default=0.0)
    fixed_contrib_by_month: dict[int, float] = field(init=False, default_factory=dict)
    percent_contrib_by_month: dict[int, list[float]] = field(
        init=False, default_factory=dict
    )
    total_rent_paid: float = field(init=False, default=0.0)
    total_scheduled_contributions: float = field(init=False, default=0.0)
    total_additional_investments: float = field(init=False, default=0.0)
    total_monthly_additional_costs: float = field(init=False, default=0.0)
    purchase_month: int | None = field(init=False, default=None)
    monthly_data: list[MonthlyRecord] = field(init=False, default_factory=list)
    milestone_thresholds: set[int] = field(
        init=False, default_factory=lambda: {25, 50, 75, 90, 100}
    )
    last_progress_bucket: int = field(init=False, default=0)

    def __post_init__(self) -> None:
        self.investment_balance = self.down_payment
        self.fgts_balance = self.fgts.initial_balance if self.fgts else 0.0
        self.fgts_monthly_rate = _compute_fgts_monthly_rate(self.fgts)
        (
            self.loan_installments,
            self.upfront_baseline,
        ) = self._prepare_loan_baseline()
        (
            self.fixed_contrib_by_month,
            self.percent_contrib_by_month,
        ) = self._preprocess_contributions()

    def simulate(self) -> ComparisonScenario:
        for month in range(1, self.term_months + 1):
            self.fgts_balance = _accumulate_fgts_balance(
                self.fgts_balance,
                fgts=self.fgts,
                fgts_monthly_rate=self.fgts_monthly_rate,
            )
            (
                current_property_value,
                costs,
                total_purchase_cost,
            ) = self._compute_purchase_cost(month)

            if self.purchase_month is not None:
                self._handle_post_purchase_month(month, current_property_value, costs)
                continue

            self._handle_pre_purchase_month(
                month, current_property_value, costs, total_purchase_cost
            )

        self._annotate_metadata()
        final_equity, total_outflows, net_cost = self._calculate_totals()

        # Ensure chronological ordering (defensive in case of future insertions)
        self.monthly_data.sort(key=lambda d: d.month)

        return ComparisonScenario(
            name="Investir e comprar à vista",
            total_cost=net_cost,
            final_equity=final_equity,
            monthly_data=self.monthly_data,
            total_outflows=total_outflows,
            net_cost=net_cost,
        )

    def _prepare_loan_baseline(
        self,
    ) -> tuple[list[LoanInstallment], float]:
        if not self.invest_loan_difference:
            return [], 0.0

        costs = calculate_additional_costs(self.property_value, self.additional_costs)
        upfront_costs_for_baseline = costs["total_upfront"]
        loan_value = self.property_value - self.down_payment

        if self.loan_type == "SAC":
            loan_result = simulate_sac_loan(
                loan_value,
                self.term_months,
                self.monthly_interest_rate,
                self.amortizations,
                self.inflation_rate,
            )
        else:
            loan_result = simulate_price_loan(
                loan_value,
                self.term_months,
                self.monthly_interest_rate,
                self.amortizations,
                self.inflation_rate,
            )

        return loan_result.installments, upfront_costs_for_baseline

    def _preprocess_contributions(
        self,
    ) -> tuple[dict[int, float], dict[int, list[float]]]:
        if not self.amortizations:
            return {}, {}
        return preprocess_amortizations(
            amortizations=self.amortizations,
            term_months=self.term_months,
            annual_inflation_rate=self.inflation_rate,
        )

    def _compute_purchase_cost(
        self, month: int
    ) -> tuple[float, dict[str, float], float]:
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

    def _apply_scheduled_contributions(self, month: int) -> tuple[float, float, float]:
        extra_contribution_fixed = 0.0
        extra_contribution_pct = 0.0

        if month in self.fixed_contrib_by_month:
            val = self.fixed_contrib_by_month[month]
            extra_contribution_fixed += val
            self.investment_balance += val

        if month in self.percent_contrib_by_month:
            pct_total = sum(self.percent_contrib_by_month[month])
            if pct_total > 0 and self.investment_balance > 0:
                pct_amount = self.investment_balance * (pct_total / 100.0)
                extra_contribution_pct += pct_amount
                self.investment_balance += pct_amount

        extra_contribution_total = extra_contribution_fixed + extra_contribution_pct
        if extra_contribution_total > 0:
            self.total_scheduled_contributions += extra_contribution_total

        return (
            extra_contribution_fixed,
            extra_contribution_pct,
            extra_contribution_total,
        )

    def _compute_rent_costs(
        self, month: int, costs: dict[str, float]
    ) -> tuple[float, float, float, float, float]:
        current_rent = _current_rent_value(
            self.rent_value,
            month=month,
            inflation_rate=self.inflation_rate,
            rent_inflation_rate=self.rent_inflation_rate,
        )
        monthly_hoa, monthly_property_tax, monthly_additional = (
            _inflated_monthly_additional_costs(
                costs, month=month, inflation_rate=self.inflation_rate
            )
        )
        total_rent_cost = current_rent + monthly_hoa + monthly_property_tax
        self.total_rent_paid += total_rent_cost
        return (
            current_rent,
            monthly_hoa,
            monthly_property_tax,
            monthly_additional,
            total_rent_cost,
        )

    def _apply_rent_cashflows(
        self, total_rent_cost: float
    ) -> tuple[float, float, float, float]:
        rent_withdrawal = 0.0
        external_cover = 0.0
        external_surplus_invested = 0.0
        remaining_before_return = self.investment_balance

        if self.rent_reduces_investment:
            remaining_cost = total_rent_cost
            (
                self.investment_balance,
                remaining_cost,
                external_cover,
                external_surplus_invested,
            ) = _apply_external_savings_to_cost(
                self.investment_balance,
                remaining_cost=remaining_cost,
                monthly_external_savings=self.monthly_external_savings,
                invest_external_surplus=self.invest_external_surplus,
            )
            rent_withdrawal = min(remaining_cost, self.investment_balance)
            self.investment_balance -= rent_withdrawal
            remaining_before_return = self.investment_balance
        elif self.invest_external_surplus and self.monthly_external_savings:
            self.investment_balance += self.monthly_external_savings
            external_surplus_invested = self.monthly_external_savings

        return (
            rent_withdrawal,
            external_cover,
            external_surplus_invested,
            remaining_before_return,
        )

    def _apply_investment_growth(self, month: int) -> tuple[float, float, float]:
        (
            self.investment_balance,
            investment_return_gross,
            investment_tax_paid,
            investment_return_net,
        ) = _apply_investment_return_with_tax(
            self.investment_balance,
            investment_returns=self.investment_returns,
            month=month,
            investment_tax=self.investment_tax,
        )
        return investment_return_gross, investment_tax_paid, investment_return_net

    @staticmethod
    def _sustainable_withdrawal_metrics(
        rent_withdrawal: float, investment_return: float
    ) -> tuple[float | None, bool]:
        if rent_withdrawal <= 0:
            return None, False
        ratio = investment_return / rent_withdrawal
        return ratio, investment_return < rent_withdrawal

    def _maybe_invest_loan_difference(
        self, month: int, total_rent_cost: float, costs: dict[str, float]
    ) -> float:
        if not self.invest_loan_difference or month > len(self.loan_installments):
            return 0.0

        additional_investment = 0.0
        if month == 1 and self.upfront_baseline > 0:
            additional_investment += self.upfront_baseline
            self.investment_balance += self.upfront_baseline

        loan_installment = self.loan_installments[month - 1]
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
            self.investment_balance += loan_difference

        return additional_investment

    def _apply_fixed_monthly_investment(
        self, month: int, additional_investment: float
    ) -> float:
        if self.fixed_monthly_investment and month >= self.fixed_investment_start_month:
            additional_investment += self.fixed_monthly_investment
            self.investment_balance += self.fixed_monthly_investment
        return additional_investment

    def _update_progress(
        self, month: int, total_purchase_cost: float
    ) -> tuple[float, float, bool]:
        progress_percent = (
            (self.investment_balance / total_purchase_cost) * 100
            if total_purchase_cost > 0
            else 0.0
        )
        shortfall = max(0.0, total_purchase_cost - self.investment_balance)

        progress_bucket = 0
        for threshold in sorted(self.milestone_thresholds):
            if progress_percent >= threshold:
                progress_bucket = threshold

        crossed_bucket = progress_bucket > self.last_progress_bucket
        if crossed_bucket:
            self.last_progress_bucket = progress_bucket

        is_milestone = month <= 12 or month % 12 == 0 or crossed_bucket
        return progress_percent, shortfall, is_milestone

    def _use_fgts_for_purchase(self, total_purchase_cost: float) -> float:
        if not self.fgts or not self.fgts.use_at_purchase or self.fgts_balance <= 0:
            return 0.0

        needed_from_fgts = max(0.0, total_purchase_cost - self.investment_balance)
        allowed = min(self.fgts_balance, needed_from_fgts)
        if self.fgts.max_withdrawal_at_purchase is not None:
            allowed = min(allowed, self.fgts.max_withdrawal_at_purchase)
        self.fgts_balance -= allowed
        return allowed

    def _handle_pre_purchase_month(
        self,
        month: int,
        current_property_value: float,
        costs: dict[str, float],
        total_purchase_cost: float,
    ) -> None:
        (
            extra_contribution_fixed,
            extra_contribution_pct,
            extra_contribution_total,
        ) = self._apply_scheduled_contributions(month)

        (
            current_rent,
            monthly_hoa,
            monthly_property_tax,
            _monthly_additional,
            total_rent_cost,
        ) = self._compute_rent_costs(month, costs)

        (
            rent_withdrawal,
            external_cover,
            external_surplus_invested,
            remaining_before_return,
        ) = self._apply_rent_cashflows(total_rent_cost)

        (
            investment_return_gross,
            investment_tax_paid,
            investment_return_net,
        ) = self._apply_investment_growth(month)

        investment_return = investment_return_net
        sustainable_withdrawal_ratio, burn_month = self._sustainable_withdrawal_metrics(
            rent_withdrawal if self.rent_reduces_investment else 0.0,
            investment_return,
        )

        additional_investment = self._maybe_invest_loan_difference(
            month, total_rent_cost, costs
        )
        additional_investment = self._apply_fixed_monthly_investment(
            month, additional_investment
        )

        progress_percent, shortfall, is_milestone = self._update_progress(
            month, total_purchase_cost
        )

        fgts_used_this_month = 0.0
        status = "Aguardando compra"
        equity = 0.0

        total_available_for_purchase = self.investment_balance
        if self.fgts and self.fgts.use_at_purchase:
            total_available_for_purchase += self.fgts_balance

        if total_available_for_purchase >= total_purchase_cost:
            fgts_used_this_month = self._use_fgts_for_purchase(total_purchase_cost)
            self.investment_balance -= total_purchase_cost - fgts_used_this_month
            self.purchase_month = month
            status = "Imóvel comprado"
            equity = current_property_value
            progress_percent = 100.0
            shortfall = 0.0
            is_milestone = True

        cash_flow = -(total_rent_cost + additional_investment)
        if additional_investment > 0:
            self.total_additional_investments += additional_investment

        self.monthly_data.append(
            MonthlyRecord(
                month=month,
                cash_flow=cash_flow,
                investment_balance=self.investment_balance,
                investment_return=investment_return,
                rent_paid=current_rent,
                monthly_hoa=monthly_hoa,
                monthly_property_tax=monthly_property_tax,
                monthly_additional_costs=monthly_hoa + monthly_property_tax,
                total_monthly_cost=total_rent_cost,
                status=status,
                equity=equity,
                property_value=current_property_value,
                additional_investment=additional_investment,
                extra_contribution_fixed=extra_contribution_fixed,
                extra_contribution_percentage=extra_contribution_pct,
                extra_contribution_total=extra_contribution_total,
                target_purchase_cost=total_purchase_cost,
                progress_percent=progress_percent,
                shortfall=shortfall,
                is_milestone=is_milestone,
                scenario_type="invest_buy",
                phase=(
                    "post_purchase" if status == "Imóvel comprado" else "pre_purchase"
                ),
                rent_withdrawal_from_investment=(
                    rent_withdrawal if self.rent_reduces_investment else 0.0
                ),
                remaining_investment_before_return=(
                    remaining_before_return
                    if self.rent_reduces_investment
                    else self.investment_balance
                ),
                external_cover=external_cover,
                external_surplus_invested=external_surplus_invested,
                sustainable_withdrawal_ratio=sustainable_withdrawal_ratio,
                burn_month=burn_month,
                investment_return_gross=investment_return_gross,
                investment_tax_paid=investment_tax_paid,
                investment_return_net=investment_return_net,
                fgts_balance=self.fgts_balance if self.fgts else None,
                fgts_used=fgts_used_this_month if self.fgts else 0.0,
            )
        )

    def _handle_post_purchase_month(
        self, month: int, current_property_value: float, costs: dict[str, float]
    ) -> None:
        (
            monthly_hoa,
            monthly_property_tax,
            monthly_additional,
        ) = _inflated_monthly_additional_costs(
            costs, month=month, inflation_rate=self.inflation_rate
        )

        (
            investment_return_gross,
            investment_tax_paid,
            investment_return_net,
        ) = self._apply_investment_growth(month)

        additional_investment = 0.0
        if self.fixed_monthly_investment and month >= self.fixed_investment_start_month:
            additional_investment = self.fixed_monthly_investment
            self.investment_balance += additional_investment
            self.total_additional_investments += additional_investment

        cash_flow = -(monthly_additional + additional_investment)
        self.total_monthly_additional_costs += monthly_additional

        self.monthly_data.append(
            MonthlyRecord(
                month=month,
                cash_flow=cash_flow,
                investment_balance=self.investment_balance,
                equity=current_property_value,
                status="Imóvel comprado",
                monthly_additional_costs=monthly_additional,
                property_value=current_property_value,
                investment_return=investment_return_net,
                investment_return_gross=investment_return_gross,
                investment_tax_paid=investment_tax_paid,
                investment_return_net=investment_return_net,
                additional_investment=additional_investment,
                scenario_type="invest_buy",
                progress_percent=100.0,
                shortfall=0.0,
                is_milestone=True,
                phase="post_purchase",
                fgts_balance=self.fgts_balance if self.fgts else None,
                fgts_used=0.0,
            )
        )

    def _annotate_metadata(self) -> None:
        if not self.monthly_data:
            return

        if self.purchase_month is not None:
            purchase_price = next(
                (
                    d.property_value
                    for d in self.monthly_data
                    if d.month == self.purchase_month and d.property_value is not None
                ),
                self.property_value,
            )
            self.monthly_data[0].purchase_month = self.purchase_month
            self.monthly_data[0].purchase_price = float(purchase_price)
            return

        milestone_rows = [d for d in self.monthly_data if d.is_milestone]
        window = (milestone_rows or self.monthly_data)[-6:]
        avg_growth = 0.0
        if len(window) >= 2:
            deltas = [
                (window[i].investment_balance or 0.0)
                - (window[i - 1].investment_balance or 0.0)
                for i in range(1, len(window))
            ]
            avg_growth = sum(deltas) / len(deltas) if deltas else 0.0

        latest = self.monthly_data[-1]
        target_cost_latest = latest.target_purchase_cost or self.property_value
        balance_latest = latest.investment_balance or 0.0
        est_months_remaining = None
        if avg_growth > 0 and balance_latest < target_cost_latest:
            est_months_remaining = max(
                0, math.ceil((target_cost_latest - balance_latest) / avg_growth)
            )

        self.monthly_data[0].projected_purchase_month = (
            (latest.month + est_months_remaining)
            if est_months_remaining is not None
            else None
        )
        self.monthly_data[0].estimated_months_remaining = est_months_remaining

    def _calculate_totals(self) -> tuple[float, float, float]:
        final_month = self.term_months
        final_property_value = apply_property_appreciation(
            self.property_value,
            final_month,
            1,
            self.property_appreciation_rate,
            self.inflation_rate,
        )
        final_equity = (
            (final_property_value if self.purchase_month else 0.0)
            + self.investment_balance
            + (self.fgts_balance if self.fgts else 0.0)
        )

        if self.purchase_month:
            purchase_property_value = apply_property_appreciation(
                self.property_value,
                self.purchase_month,
                1,
                self.property_appreciation_rate,
                self.inflation_rate,
            )
            purchase_upfront = calculate_additional_costs(
                purchase_property_value, self.additional_costs
            )["total_upfront"]
            purchase_cost = purchase_property_value + purchase_upfront

            total_outflows = (
                self.total_rent_paid
                + purchase_cost
                + self.total_monthly_additional_costs
                + self.total_additional_investments
                + self.total_scheduled_contributions
            )
        else:
            total_outflows = (
                self.total_rent_paid
                + self.total_additional_investments
                + self.total_scheduled_contributions
            )

        net_cost = total_outflows - final_equity
        return final_equity, total_outflows, net_cost


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
    """Simulate investing until having enough to buy the property outright."""

    simulator = InvestThenBuySimulator(
        property_value=property_value,
        down_payment=down_payment,
        term_months=term_months,
        investment_returns=investment_returns,
        rent_value=rent_value,
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


def compare_scenarios(
    property_value: float,
    down_payment: float,
    loan_term_years: int,
    monthly_interest_rate: float,
    loan_type: str,
    rent_value: float,
    investment_returns: list[InvestmentReturnInput],
    amortizations: list[AmortizationInput] | None = None,
    additional_costs: AdditionalCostsInput | None = None,
    inflation_rate: float | None = None,
    rent_inflation_rate: float | None = None,
    property_appreciation_rate: float | None = None,
    invest_loan_difference: bool = False,
    fixed_monthly_investment: float | None = None,
    fixed_investment_start_month: int = 1,
    rent_reduces_investment: bool = False,
    monthly_external_savings: float | None = None,
    invest_external_surplus: bool = False,
    investment_tax: InvestmentTaxInput | None = None,
    fgts: FGTSInput | None = None,
) -> ComparisonResult:
    """Compare different scenarios for housing decisions."""
    term_months = loan_term_years * 12

    # Simulate buying with loan
    buy_scenario = simulate_buy_scenario(
        property_value,
        down_payment,
        loan_term_years,
        monthly_interest_rate,
        loan_type,
        amortizations,
        investment_returns,
        additional_costs,
        inflation_rate,
        property_appreciation_rate,
        investment_tax,
        fgts,
    )

    # Simulate renting and investing
    rent_scenario = simulate_rent_and_invest_scenario(
        property_value,
        down_payment,
        term_months,
        rent_value,
        investment_returns,
        additional_costs,
        inflation_rate,
        rent_inflation_rate,
        property_appreciation_rate,
        rent_reduces_investment,
        monthly_external_savings,
        invest_external_surplus,
        investment_tax,
        fgts,
    )

    # Simulate investing then buying
    invest_buy_scenario = simulate_invest_then_buy_scenario(
        property_value,
        down_payment,
        term_months,
        investment_returns,
        rent_value,
        additional_costs,
        inflation_rate,
        rent_inflation_rate,
        property_appreciation_rate,
        invest_loan_difference,
        fixed_monthly_investment,
        fixed_investment_start_month,
        loan_type,
        monthly_interest_rate,
        amortizations,
        rent_reduces_investment,
        monthly_external_savings,
        invest_external_surplus,
        investment_tax,
        fgts,
    )

    # Determine best scenario based on total cost
    scenarios = [buy_scenario, rent_scenario, invest_buy_scenario]
    best_scenario = min(scenarios, key=lambda x: x.total_cost).name

    return ComparisonResult(best_scenario=best_scenario, scenarios=scenarios)


def enhanced_compare_scenarios(
    property_value: float,
    down_payment: float,
    loan_term_years: int,
    monthly_interest_rate: float,
    loan_type: str,
    rent_value: float,
    investment_returns: list[InvestmentReturnInput],
    amortizations: list[AmortizationInput] | None = None,
    additional_costs: AdditionalCostsInput | None = None,
    inflation_rate: float | None = None,
    rent_inflation_rate: float | None = None,
    property_appreciation_rate: float | None = None,
    invest_loan_difference: bool = False,
    fixed_monthly_investment: float | None = None,
    fixed_investment_start_month: int = 1,
    rent_reduces_investment: bool = False,
    monthly_external_savings: float | None = None,
    invest_external_surplus: bool = False,
    investment_tax: InvestmentTaxInput | None = None,
    fgts: FGTSInput | None = None,
) -> EnhancedComparisonResult:
    """Enhanced comparison with detailed metrics and month-by-month differences."""

    # Get basic scenarios
    basic_comparison = compare_scenarios(
        property_value=property_value,
        down_payment=down_payment,
        loan_term_years=loan_term_years,
        monthly_interest_rate=monthly_interest_rate,
        loan_type=loan_type,
        rent_value=rent_value,
        investment_returns=investment_returns,
        amortizations=amortizations,
        additional_costs=additional_costs,
        inflation_rate=inflation_rate,
        rent_inflation_rate=rent_inflation_rate,
        property_appreciation_rate=property_appreciation_rate,
        invest_loan_difference=invest_loan_difference,
        fixed_monthly_investment=fixed_monthly_investment,
        fixed_investment_start_month=fixed_investment_start_month,
        rent_reduces_investment=rent_reduces_investment,
        monthly_external_savings=monthly_external_savings,
        invest_external_surplus=invest_external_surplus,
        investment_tax=investment_tax,
        fgts=fgts,
    )

    buy_scenario = basic_comparison.scenarios[0]
    rent_scenario = basic_comparison.scenarios[1]
    invest_buy_scenario = basic_comparison.scenarios[2]

    # Calculate enhanced metrics for each scenario
    best_cost = min(s.total_cost for s in basic_comparison.scenarios)

    def calculate_metrics(scenario: ComparisonScenario) -> ComparisonMetrics:
        total_cost_diff = scenario.total_cost - best_cost
        total_cost_pct_diff = (total_cost_diff / best_cost * 100) if best_cost else 0

        monthly_costs_signed = [data.cash_flow for data in scenario.monthly_data]
        avg_monthly_cost = (
            sum(monthly_costs_signed) / len(monthly_costs_signed)
            if monthly_costs_signed
            else 0
        )

        # ROI denominator: capital owned/deployed at start.
        # FGTS is treated as user-owned capital (not an external subsidy).
        initial_investment = down_payment + (fgts.initial_balance if fgts else 0.0)
        if scenario.name == "Comprar com financiamento" and scenario.monthly_data:
            upfront = scenario.monthly_data[0].upfront_additional_costs or 0
            initial_investment += upfront
        final_value = scenario.final_equity
        roi_pct = (
            ((final_value - initial_investment) / initial_investment * 100)
            if initial_investment
            else 0
        )

        if scenario.name == "Comprar com financiamento":
            total_interest_rent = sum(
                (d.interest_payment or 0.0) for d in scenario.monthly_data
            )
        else:
            total_interest_rent = sum(
                (d.rent_paid or 0.0) for d in scenario.monthly_data
            )

        wealth = (
            scenario.final_equity
        )  # final_equity already encapsulates investments where relevant

        # Break-even month (first month where cumulative cost difference vs best <= 0)
        break_even_month = None
        if scenario.total_cost != best_cost:
            # Build cumulative net cost trajectory (approximate using cumulative cash flows)
            cumulative = 0.0
            for data in scenario.monthly_data:
                cumulative += data.cash_flow
                if (
                    cumulative >= 0
                ):  # cash_flow negative -> cost, reaching >=0 indicates parity
                    break_even_month = data.month
                    break

        # Sustainability aggregates (only meaningful for scenarios with withdrawal fields)
        withdrawals = [
            (d.rent_withdrawal_from_investment or 0.0) for d in scenario.monthly_data
        ]
        raw_ratios = [d.sustainable_withdrawal_ratio for d in scenario.monthly_data]
        ratios = [float(r) for r in raw_ratios if isinstance(r, (int, float))]
        burns = [d.burn_month for d in scenario.monthly_data if d.burn_month]
        total_withdrawn = sum(w for w in withdrawals if w)
        avg_ratio = sum(ratios) / len(ratios) if ratios else None
        months_with_burn = len(burns) if burns else None

        # Adjusted ROI: add back withdrawals (treated as distributions) when they exist
        roi_adjusted = None
        if total_withdrawn > 0 and initial_investment:
            adjusted_final = final_value + total_withdrawn
            roi_adjusted = (
                (adjusted_final - initial_investment) / initial_investment * 100
            )

        return ComparisonMetrics(
            total_cost_difference=total_cost_diff,
            total_cost_percentage_difference=total_cost_pct_diff,
            break_even_month=break_even_month,
            roi_percentage=roi_pct,
            roi_adjusted_percentage=roi_adjusted,
            average_monthly_cost=avg_monthly_cost,
            total_interest_or_rent_paid=total_interest_rent,
            wealth_accumulation=wealth,
            total_rent_withdrawn_from_investment=(
                total_withdrawn if total_withdrawn > 0 else None
            ),
            months_with_burn=months_with_burn if months_with_burn else None,
            average_sustainable_withdrawal_ratio=avg_ratio,
        )

    # Create enhanced scenarios
    enhanced_scenarios = [
        EnhancedComparisonScenario(
            name=scenario.name,
            total_cost=scenario.total_cost,
            final_equity=scenario.final_equity,
            monthly_data=scenario.monthly_data,
            metrics=calculate_metrics(scenario),
        )
        for scenario in basic_comparison.scenarios
    ]

    # Create month-by-month comparative summary
    comparative_summary = {}
    max_months = max(len(s.monthly_data) for s in basic_comparison.scenarios)

    for month in range(1, max_months + 1):
        month_comparison: dict[str, object] = {"month": month}

        def _v(row: MonthlyRecord | None, attr: str, default: float = 0.0) -> float:
            if row is None:
                return default
            val = getattr(row, attr, None)
            return float(val) if isinstance(val, (int, float)) else default

        # Get data for each scenario for this month
        buy_data = next(
            (d for d in buy_scenario.monthly_data if d.month == month), None
        )
        rent_data = next(
            (d for d in rent_scenario.monthly_data if d.month == month), None
        )
        invest_data = next(
            (d for d in invest_buy_scenario.monthly_data if d.month == month), None
        )

        # Calculate explicit differences (inside loop so each month processed)
        buy_cost = _v(buy_data, "cash_flow")
        rent_cost = _v(rent_data, "cash_flow")
        invest_cost = _v(invest_data, "cash_flow")

        month_comparison.update(
            {
                "buy_vs_rent_difference": buy_cost - rent_cost,
                "buy_vs_rent_percentage": (
                    ((buy_cost - rent_cost) / rent_cost * 100) if rent_cost > 0 else 0
                ),
                "buy_monthly_cash_flow": buy_cost,
                "rent_monthly_cash_flow": rent_cost,
                "invest_monthly_cash_flow": invest_cost,
                "buy_equity": _v(buy_data, "equity"),
                "rent_investment_balance": _v(rent_data, "investment_balance"),
                "invest_equity": _v(invest_data, "equity"),
                "invest_investment_balance": _v(invest_data, "investment_balance"),
                "property_value_buy": _v(buy_data, "property_value"),
                "property_value_rent": _v(rent_data, "property_value"),
                "property_value_invest": _v(invest_data, "property_value"),
                "buy_total_wealth": _v(buy_data, "equity"),
                "rent_total_wealth": _v(rent_data, "investment_balance"),
                "invest_total_wealth": _v(invest_data, "equity")
                + _v(invest_data, "investment_balance"),
            }
        )
        comparative_summary[f"month_{month}"] = month_comparison

    return EnhancedComparisonResult(
        best_scenario=basic_comparison.best_scenario,
        scenarios=enhanced_scenarios,
        comparative_summary=comparative_summary,
    )
