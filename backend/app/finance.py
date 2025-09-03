from typing import List, Dict, Optional, Tuple
from collections import defaultdict
import math
from .models import (
    AmortizationInput,
    InvestmentReturnInput,
    LoanInstallment,
    LoanSimulationResult,
    ComparisonScenario,
    ComparisonResult,
    AdditionalCostsInput,
    ComparisonMetrics,
    EnhancedComparisonScenario,
    EnhancedComparisonResult,
)


def convert_interest_rate(
    annual_rate: Optional[float] = None, monthly_rate: Optional[float] = None
) -> Tuple[float, float]:
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
    amortizations: Optional[List[AmortizationInput]],
    term_months: int,
    annual_inflation_rate: Optional[float] = None,
) -> Tuple[Dict[int, float], Dict[int, List[float]]]:
    """Expand and separate fixed and percentage amortizations.

    Returns:
        fixed_by_month: month -> total fixed extra amortization
        percent_by_month: month -> list of percentage values to apply on outstanding balance
    """
    if not amortizations:
        return {}, {}

    fixed_by_month: Dict[int, float] = defaultdict(float)
    percent_by_month: Dict[int, List[float]] = defaultdict(list)

    for a in amortizations:
        # Determine recurrence months
        if a.interval_months and a.interval_months > 0:
            start = a.month or 1
            if a.occurrences:
                months = [start + i * a.interval_months for i in range(a.occurrences)]
            else:
                end = a.end_month or term_months
                months = list(range(start, min(end, term_months) + 1, a.interval_months))
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
    amortizations: Optional[List[AmortizationInput]] = None,
    annual_inflation_rate: Optional[float] = None,
) -> LoanSimulationResult:
    """Simulate a loan using the SAC (Sistema de Amortização Constante) method."""
    # Convert interest rate to decimal
    monthly_rate_decimal = monthly_interest_rate / 100

    # Initialize variables
    installments: List[LoanInstallment] = []
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
        total_extra_amortization=total_extra_amortization_applied if total_extra_amortization_applied > 0 else None,
    )


def simulate_price_loan(
    loan_value: float,
    term_months: int,
    monthly_interest_rate: float,
    amortizations: Optional[List[AmortizationInput]] = None,
    annual_inflation_rate: Optional[float] = None,
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
    installments: List[LoanInstallment] = []
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
        total_extra_amortization=total_extra_amortization_applied if total_extra_amortization_applied > 0 else None,
    )


def get_monthly_investment_rate(
    investment_returns: List[InvestmentReturnInput], month: int
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
    property_value: float, additional_costs: Optional[AdditionalCostsInput] = None
) -> Dict[str, float]:
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
    annual_inflation_rate: Optional[float] = None,
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
    property_appreciation_rate: Optional[float] = None,
    fallback_inflation_rate: Optional[float] = None,
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


def simulate_buy_scenario(
    property_value: float,
    down_payment: float,
    loan_term_years: int,
    monthly_interest_rate: float,
    loan_type: str,
    amortizations: Optional[List[AmortizationInput]] = None,
    _investment_returns: Optional[
        List[InvestmentReturnInput]
    ] = None,  # Not used in buy scenario
    additional_costs: Optional[AdditionalCostsInput] = None,
    inflation_rate: Optional[float] = None,
    _property_appreciation_rate: Optional[float] = None,  # Not used in buy scenario
) -> ComparisonScenario:
    """Simulate buying a property with a loan."""
    # _investment_returns parameter is kept for API consistency but not used in buy scenario
    # Calculate additional costs
    costs = calculate_additional_costs(property_value, additional_costs)

    # Adjust loan value to include upfront additional costs
    total_upfront_costs = costs["total_upfront"]
    loan_value = property_value - down_payment + total_upfront_costs
    term_months = loan_term_years * 12

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
    monthly_data = []
    total_monthly_additional_costs = 0.0

    for inst in loan_result.installments:
        month = inst.month

        # Apply inflation to monthly additional costs if applicable
        monthly_hoa = apply_inflation(costs["monthly_hoa"], month, 1, inflation_rate)
        monthly_property_tax = apply_inflation(
            costs["monthly_property_tax"], month, 1, inflation_rate
        )
        monthly_additional = monthly_hoa + monthly_property_tax

        # Track total additional monthly costs
        total_monthly_additional_costs += monthly_additional

        # In "Buy with Financing" scenario, property value is fixed.
        # Appreciation is not applied.
        current_property_value = property_value

        monthly_data.append(
            {
                "month": month,
                "cash_flow": -(inst.installment + monthly_additional),
                "equity": current_property_value - inst.outstanding_balance,
                "installment": inst.installment,
                "principal_payment": inst.amortization,
                "interest_payment": inst.interest,
                "outstanding_balance": inst.outstanding_balance,
                "monthly_hoa": monthly_hoa,
                "monthly_property_tax": monthly_property_tax,
                "monthly_additional_costs": monthly_additional,
                "property_value": current_property_value,
                "total_monthly_cost": inst.installment + monthly_additional,
                "cumulative_payments": sum(
                    i.installment for i in loan_result.installments[:month]
                )
                + sum(
                    apply_inflation(costs["monthly_hoa"], m, 1, inflation_rate)
                    + apply_inflation(
                        costs["monthly_property_tax"], m, 1, inflation_rate
                    )
                    for m in range(1, month + 1)
                ),
                "cumulative_interest": sum(
                    i.interest for i in loan_result.installments[:month]
                ),
                "equity_percentage": (
                    (current_property_value - inst.outstanding_balance)
                    / current_property_value
                    if current_property_value > 0
                    else 0
                )
                * 100,
                "scenario_type": "buy",
            }
        )

    # Calculate final equity (property value is fixed in this scenario)
    final_equity = property_value

    # Total cost calculation: loan payments + down payment + upfront costs + monthly additional costs
    # The final property value is the equity (what you own), not a cost
    total_cost = (
        loan_result.total_paid  # Loan payments
        + down_payment  # Down payment
        + total_upfront_costs  # Upfront costs (ITBI, deed)
        + total_monthly_additional_costs  # Monthly costs (HOA, property tax)
    )

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
    investment_returns: List[InvestmentReturnInput],
    additional_costs: Optional[AdditionalCostsInput] = None,
    inflation_rate: Optional[float] = None,
    rent_inflation_rate: Optional[float] = None,
    property_appreciation_rate: Optional[float] = None,
    rent_reduces_investment: bool = False,
    monthly_external_savings: Optional[float] = None,
    invest_external_surplus: bool = False,
) -> ComparisonScenario:
    """Simulate renting and investing the down payment."""
    # Initialize variables
    monthly_data = []
    investment_balance = down_payment
    total_rent_paid = 0.0

    # Get base monthly additional costs
    costs = calculate_additional_costs(property_value, additional_costs)

    # Calculate monthly data
    for month in range(1, term_months + 1):
    # Apply rent inflation if applicable (use rent_inflation_rate if provided, otherwise fall back to inflation_rate)
        effective_rent_inflation = (
            rent_inflation_rate if rent_inflation_rate is not None else inflation_rate
        )
        current_rent = apply_inflation(rent_value, month, 1, effective_rent_inflation)

        # Apply inflation to additional costs
        current_monthly_hoa = apply_inflation(
            costs["monthly_hoa"], month, 1, inflation_rate
        )
        current_monthly_property_tax = apply_inflation(
            costs["monthly_property_tax"], month, 1, inflation_rate
        )
        current_additional_costs = current_monthly_hoa + current_monthly_property_tax

        # Total monthly cost is rent + additional costs
        total_monthly_cost = current_rent + current_additional_costs
        total_rent_paid += total_monthly_cost

        rent_withdrawal = 0.0
        remaining_before_return = investment_balance
        investment_return = 0.0
        external_cover = 0.0
        external_surplus_invested = 0.0
        if rent_reduces_investment:
            cost_remaining = total_monthly_cost
            if monthly_external_savings and monthly_external_savings > 0:
                external_cover = min(cost_remaining, monthly_external_savings)
                cost_remaining -= external_cover
                # Optional surplus invest
                surplus = monthly_external_savings - external_cover
                if surplus > 0 and invest_external_surplus:
                    investment_balance += surplus
                    external_surplus_invested = surplus
            # Withdraw remaining cost from investment
            rent_withdrawal = min(cost_remaining, investment_balance)
            investment_balance -= rent_withdrawal
            remaining_before_return = investment_balance
            monthly_rate = get_monthly_investment_rate(investment_returns, month)
            investment_return = investment_balance * monthly_rate
            investment_balance += investment_return
        else:
            # Optionally invest external savings fully (modeling deposit of external income)
            if invest_external_surplus and monthly_external_savings:
                investment_balance += monthly_external_savings
                external_surplus_invested = monthly_external_savings
            monthly_rate = get_monthly_investment_rate(investment_returns, month)
            investment_return = investment_balance * monthly_rate
            investment_balance += investment_return
            remaining_before_return = investment_balance

        withdrawal_for_ratio = rent_withdrawal if rent_reduces_investment else 0.0
        sustainable_withdrawal_ratio = (
            (investment_return / withdrawal_for_ratio) if withdrawal_for_ratio > 0 else None
        )
        burn_month = withdrawal_for_ratio > 0 and investment_return < withdrawal_for_ratio

        # For rent scenario, property value tracking is just for reference
        # since the person doesn't own the property and won't benefit from appreciation
        current_property_value = property_value  # Keep original value for reference

        monthly_data.append(
            {
                "month": month,
                "cash_flow": -total_monthly_cost,
                "investment_balance": investment_balance,
                "investment_return": investment_return,
                "rent_paid": current_rent,
                "monthly_hoa": current_monthly_hoa,
                "monthly_property_tax": current_monthly_property_tax,
                "monthly_additional_costs": current_additional_costs,
                "property_value": current_property_value,
                "total_monthly_cost": total_monthly_cost,
                "cumulative_rent_paid": total_rent_paid,
                "cumulative_investment_gains": investment_balance - down_payment,
                "investment_roi_percentage": (
                    (investment_balance - down_payment) / down_payment
                )
                * 100,
                "scenario_type": "rent_invest",
                "equity": 0,  # No property equity in rent scenario
                "liquid_wealth": investment_balance,  # All wealth is liquid
                "rent_withdrawal_from_investment": rent_withdrawal if rent_reduces_investment else 0.0,
                "remaining_investment_before_return": remaining_before_return if rent_reduces_investment else investment_balance,
                "external_cover": external_cover,
                "external_surplus_invested": external_surplus_invested,
                "sustainable_withdrawal_ratio": sustainable_withdrawal_ratio,
                "burn_month": burn_month,
            }
        )

    # Gross outflows: rent payments
    total_outflows = total_rent_paid
    net_cost = total_outflows - investment_balance  # rent minus final wealth

    return ComparisonScenario(
        name="Alugar e investir",
        total_cost=net_cost,
        final_equity=investment_balance,
        monthly_data=monthly_data,
        total_outflows=total_outflows,
        net_cost=net_cost,
    )


def simulate_invest_then_buy_scenario(
    property_value: float,
    down_payment: float,
    term_months: int,
    investment_returns: List[InvestmentReturnInput],
    rent_value: float,
    additional_costs: Optional[AdditionalCostsInput] = None,
    inflation_rate: Optional[float] = None,
    rent_inflation_rate: Optional[float] = None,
    property_appreciation_rate: Optional[float] = None,
    invest_loan_difference: bool = False,
    fixed_monthly_investment: Optional[float] = None,
    fixed_investment_start_month: int = 1,
    loan_type: str = "SAC",
    monthly_interest_rate: float = 1.0,
    amortizations: Optional[List[AmortizationInput]] = None,
    rent_reduces_investment: bool = False,
    monthly_external_savings: Optional[float] = None,
    invest_external_surplus: bool = False,
) -> ComparisonScenario:
    """Simulate investing until having enough to buy the property outright."""
    # Initialize variables
    monthly_data: List[dict] = []
    investment_balance = down_payment
    total_rent_paid = 0.0
    purchase_month: Optional[int] = None
    milestone_thresholds = {25, 50, 75, 90, 100}
    last_progress_bucket = 0

    # Calculate loan simulation for comparison if invest_loan_difference is True
    loan_installments = []
    if invest_loan_difference:
        # Calculate additional costs for loan scenario
        costs = calculate_additional_costs(property_value, additional_costs)
        loan_value = property_value - down_payment + costs["total_upfront"]

        # Simulate loan to get installment amounts
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

        loan_installments = loan_result.installments

    # Preprocess amortizations as scheduled additional contributions (aportes)
    fixed_contrib_by_month: Dict[int, float] = {}
    percent_contrib_by_month: Dict[int, List[float]] = {}
    if amortizations:
        fixed_contrib_by_month, percent_contrib_by_month = preprocess_amortizations(
            amortizations=amortizations,
            term_months=term_months,
            annual_inflation_rate=inflation_rate,
        )

    total_scheduled_contributions = 0.0  # track for total_outflows

    # Calculate monthly data
    for month in range(1, term_months + 1):
        # Current target purchase cost (property + upfront) with appreciation
        current_property_value = apply_property_appreciation(
            property_value, month, 1, property_appreciation_rate, inflation_rate
        )
        costs = calculate_additional_costs(current_property_value, additional_costs)
        total_purchase_cost = current_property_value + costs["total_upfront"]

        # If already purchased, handle post-purchase scenario
        if purchase_month is not None:
            monthly_hoa = apply_inflation(
                costs["monthly_hoa"], month, 1, inflation_rate
            )
            monthly_property_tax = apply_inflation(
                costs["monthly_property_tax"], month, 1, inflation_rate
            )
            monthly_additional = monthly_hoa + monthly_property_tax

            # Calculate investment after purchase
            monthly_rate = get_monthly_investment_rate(investment_returns, month)
            investment_return = investment_balance * monthly_rate
            investment_balance += investment_return

            # Add fixed monthly investment if applicable
            additional_investment = 0.0
            if fixed_monthly_investment and month >= fixed_investment_start_month:
                additional_investment += fixed_monthly_investment
                investment_balance += additional_investment

            # Calculate cash flow (negative = outgoing, positive = saved)
            cash_flow = -monthly_additional - additional_investment

            monthly_data.append(
                {
                    "month": month,
                    "cash_flow": cash_flow,
                    "investment_balance": investment_balance,
                    "equity": current_property_value,
                    "status": "Imóvel comprado",
                    "monthly_additional_costs": monthly_additional,
                    "property_value": current_property_value,
                    "investment_return": investment_return,
                    "additional_investment": additional_investment,
                    "scenario_type": "invest_buy",
                    "progress_percent": 100.0,
                    "shortfall": 0.0,
                    "is_milestone": True,
                    "phase": "post_purchase",
                }
            )
            continue

        # Before purchase: apply scheduled contributions BEFORE return so they also earn this month's yield
        extra_contribution_fixed = 0.0
        extra_contribution_pct = 0.0
        if month in fixed_contrib_by_month:
            val = fixed_contrib_by_month[month]
            extra_contribution_fixed += val
            investment_balance += val
        if month in percent_contrib_by_month:
            pct_total = sum(percent_contrib_by_month[month])
            if pct_total > 0 and investment_balance > 0:
                pct_amount = investment_balance * (pct_total / 100.0)
                extra_contribution_pct += pct_amount
                investment_balance += pct_amount
        extra_contribution_total = extra_contribution_fixed + extra_contribution_pct
        if extra_contribution_total > 0:
            total_scheduled_contributions += extra_contribution_total

    # Apply rent inflation if applicable (use rent_inflation_rate if provided, otherwise fall back to inflation_rate)
        effective_rent_inflation = (
            rent_inflation_rate if rent_inflation_rate is not None else inflation_rate
        )
        current_rent = apply_inflation(rent_value, month, 1, effective_rent_inflation)

        # Add monthly additional costs to rent (HOA and property tax that tenant pays)
        monthly_hoa = apply_inflation(costs["monthly_hoa"], month, 1, inflation_rate)
        monthly_property_tax = apply_inflation(
            costs["monthly_property_tax"], month, 1, inflation_rate
        )
        total_rent_cost = current_rent + monthly_hoa + monthly_property_tax
        total_rent_paid += total_rent_cost

        rent_withdrawal = 0.0
        remaining_before_return = investment_balance
        external_cover = 0.0
        external_surplus_invested = 0.0
        if rent_reduces_investment:
            remaining_cost = total_rent_cost
            if monthly_external_savings and monthly_external_savings > 0:
                external_cover = min(remaining_cost, monthly_external_savings)
                remaining_cost -= external_cover
                surplus = monthly_external_savings - external_cover
                if surplus > 0 and invest_external_surplus:
                    investment_balance += surplus
                    external_surplus_invested = surplus
            rent_withdrawal = min(remaining_cost, investment_balance)
            investment_balance -= rent_withdrawal
            remaining_before_return = investment_balance
        else:
            if invest_external_surplus and monthly_external_savings:
                investment_balance += monthly_external_savings
                external_surplus_invested = monthly_external_savings

        # Apply investment growth AFTER contributions (and potential rent withdrawal)
        monthly_rate = get_monthly_investment_rate(investment_returns, month)
        investment_return = investment_balance * monthly_rate
        investment_balance += investment_return

        withdrawal_for_ratio = rent_withdrawal if rent_reduces_investment else 0.0
        sustainable_withdrawal_ratio = (
            (investment_return / withdrawal_for_ratio) if withdrawal_for_ratio > 0 else None
        )
        burn_month = withdrawal_for_ratio > 0 and investment_return < withdrawal_for_ratio

        # Calculate additional investments
        additional_investment = 0.0

        # Add loan difference investment if enabled
        if invest_loan_difference and month <= len(loan_installments):
            loan_installment = loan_installments[month - 1]
            # Add HOA and property tax to loan scenario for fair comparison
            loan_monthly_hoa = apply_inflation(
                costs["monthly_hoa"], month, 1, inflation_rate
            )
            loan_monthly_property_tax = apply_inflation(
                costs["monthly_property_tax"], month, 1, inflation_rate
            )
            total_loan_payment = (
                loan_installment.installment
                + loan_monthly_hoa
                + loan_monthly_property_tax
            )

            if total_loan_payment > total_rent_cost:
                loan_difference = total_loan_payment - total_rent_cost
                additional_investment += loan_difference
                investment_balance += loan_difference

        # Add fixed monthly investment if applicable (treated as part of "additional_investment" not scheduled amortization)
        if fixed_monthly_investment and month >= fixed_investment_start_month:
            additional_investment += fixed_monthly_investment
            investment_balance += fixed_monthly_investment

        # Progress metrics
        progress_percent = (
            (investment_balance / total_purchase_cost) * 100 if total_purchase_cost > 0 else 0
        )
        shortfall = max(0.0, total_purchase_cost - investment_balance)
        progress_bucket = 0
        for t in sorted(milestone_thresholds):
            if progress_percent >= t:
                progress_bucket = t
        crossed_bucket = progress_bucket > last_progress_bucket
        if crossed_bucket:
            last_progress_bucket = progress_bucket
        is_milestone = (
            month <= 12 or month % 12 == 0 or crossed_bucket
        )

        # Check if purchase occurs this month
        if investment_balance >= total_purchase_cost:
            investment_balance -= total_purchase_cost
            purchase_month = month
            status = "Imóvel comprado"
            equity = current_property_value
            progress_percent = 100.0
            shortfall = 0.0
        else:
            status = "Aguardando compra"
            equity = 0

        # Cash flow: negative outflow of rent + all additional investments (including loan diff if any)
        cash_flow = -(total_rent_cost + additional_investment)

        monthly_data.append(
            {
                "month": month,
                "cash_flow": cash_flow,
                "investment_balance": investment_balance,
                "investment_return": investment_return,
                "rent_paid": current_rent,
                "monthly_hoa": monthly_hoa,
                "monthly_property_tax": monthly_property_tax,
                "monthly_additional_costs": monthly_hoa + monthly_property_tax,
                "total_monthly_cost": total_rent_cost,
                "status": status,
                "equity": equity,
                "property_value": current_property_value,
                "additional_investment": additional_investment,
                "extra_contribution_fixed": extra_contribution_fixed,
                "extra_contribution_percentage": extra_contribution_pct,
                "extra_contribution_total": extra_contribution_total,
                "target_purchase_cost": total_purchase_cost,
                "progress_percent": progress_percent,
                "shortfall": shortfall,
                "is_milestone": is_milestone or status == "Imóvel comprado",
                "scenario_type": "invest_buy",
                "phase": "post_purchase" if status == "Imóvel comprado" else "pre_purchase",
                "rent_withdrawal_from_investment": rent_withdrawal if rent_reduces_investment else 0.0,
                "remaining_investment_before_return": remaining_before_return if rent_reduces_investment else investment_balance,
                "external_cover": external_cover,
                "external_surplus_invested": external_surplus_invested,
                "sustainable_withdrawal_ratio": sustainable_withdrawal_ratio,
                "burn_month": burn_month,
            }
        )

    # Calculate final equity and property value with appreciation
    final_month = term_months
    final_property_value = apply_property_appreciation(
        property_value, final_month, 1, property_appreciation_rate, inflation_rate
    )
    final_equity = (
        final_property_value + investment_balance
        if purchase_month
        else investment_balance
    )

    # Calculate total additional monthly costs after purchase
    total_monthly_additional_costs = 0.0
    total_additional_investments = 0.0

    if purchase_month:
        for month in range(purchase_month + 1, term_months + 1):
            current_property_value = apply_property_appreciation(
                property_value, month, 1, property_appreciation_rate, inflation_rate
            )
            costs = calculate_additional_costs(current_property_value, additional_costs)
            monthly_hoa = apply_inflation(
                costs["monthly_hoa"], month, 1, inflation_rate
            )
            monthly_property_tax = apply_inflation(
                costs["monthly_property_tax"], month, 1, inflation_rate
            )
            total_monthly_additional_costs += monthly_hoa + monthly_property_tax

            # Add fixed investments after purchase
            if fixed_monthly_investment and month >= fixed_investment_start_month:
                total_additional_investments += fixed_monthly_investment

    # Accumulate additional investments made during investment phase directly
    for data in monthly_data:
        # All rows prior to purchase contribute their recorded additional_investment
        if data.get("additional_investment"):
            val = data.get("additional_investment", 0.0)
            if isinstance(val, (int, float)):
                total_additional_investments += val

    # Calculate total cost
    if purchase_month:
        purchase_property_value = apply_property_appreciation(
            property_value,
            purchase_month,
            1,
            property_appreciation_rate,
            inflation_rate,
        )
        purchase_upfront = calculate_additional_costs(
            purchase_property_value, additional_costs
        )["total_upfront"]
        purchase_cost = purchase_property_value + purchase_upfront

        total_outflows = (
            total_rent_paid
            + purchase_cost
            + total_monthly_additional_costs
            + total_additional_investments
            + total_scheduled_contributions
        )
    else:
        total_outflows = total_rent_paid + total_additional_investments + total_scheduled_contributions

    net_cost = total_outflows - final_equity

    # Scenario-level purchase or projection metadata inserted into first row for convenience
    if monthly_data:
        if purchase_month is not None:
            purchase_price = next(
                (d.get("property_value") for d in monthly_data if d.get("month") == purchase_month),
                property_value,
            )
            monthly_data[0].update(
                {
                    "purchase_month": purchase_month,
                    "purchase_price": purchase_price,
                }
            )
        else:
            # Projection: average growth of last milestone window
            milestone_rows = [d for d in monthly_data if d.get("is_milestone")]
            window = (milestone_rows or monthly_data)[-6:]
            avg_growth = 0.0
            if len(window) >= 2:
                deltas = [window[i]["investment_balance"] - window[i - 1]["investment_balance"] for i in range(1, len(window))]
                avg_growth = sum(deltas) / len(deltas)
            latest = monthly_data[-1]
            target_cost_latest = latest.get("target_purchase_cost", property_value)
            balance_latest = latest.get("investment_balance", 0.0)
            est_months_remaining = None
            if avg_growth > 0 and balance_latest < target_cost_latest:
                est_months_remaining = max(0, math.ceil((target_cost_latest - balance_latest) / avg_growth))
            monthly_data[0].update(
                {
                    "projected_purchase_month": (latest["month"] + est_months_remaining) if est_months_remaining is not None else None,
                    "estimated_months_remaining": est_months_remaining,
                }
            )

    # Ensure chronological ordering (defensive in case of future insertions)
    monthly_data.sort(key=lambda d: d.get("month", 0))

    return ComparisonScenario(
        name="Investir e comprar à vista",
        total_cost=net_cost,
        final_equity=final_equity,
        monthly_data=monthly_data,
        total_outflows=total_outflows,
        net_cost=net_cost,
    )


def compare_scenarios(
    property_value: float,
    down_payment: float,
    loan_term_years: int,
    monthly_interest_rate: float,
    loan_type: str,
    rent_value: float,
    investment_returns: List[InvestmentReturnInput],
    amortizations: Optional[List[AmortizationInput]] = None,
    additional_costs: Optional[AdditionalCostsInput] = None,
    inflation_rate: Optional[float] = None,
    rent_inflation_rate: Optional[float] = None,
    property_appreciation_rate: Optional[float] = None,
    invest_loan_difference: bool = False,
    fixed_monthly_investment: Optional[float] = None,
    fixed_investment_start_month: int = 1,
    rent_reduces_investment: bool = False,
    monthly_external_savings: Optional[float] = None,
    invest_external_surplus: bool = False,
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
    investment_returns: List[InvestmentReturnInput],
    amortizations: Optional[List[AmortizationInput]] = None,
    additional_costs: Optional[AdditionalCostsInput] = None,
    inflation_rate: Optional[float] = None,
    rent_inflation_rate: Optional[float] = None,
    property_appreciation_rate: Optional[float] = None,
    invest_loan_difference: bool = False,
    fixed_monthly_investment: Optional[float] = None,
    fixed_investment_start_month: int = 1,
    rent_reduces_investment: bool = False,
    monthly_external_savings: Optional[float] = None,
    invest_external_surplus: bool = False,
) -> EnhancedComparisonResult:
    """Enhanced comparison with detailed metrics and month-by-month differences."""

    # Get basic scenarios
    basic_comparison = compare_scenarios(
        property_value,
        down_payment,
        loan_term_years,
        monthly_interest_rate,
        loan_type,
        rent_value,
        investment_returns,
        amortizations,
        additional_costs,
        inflation_rate,
        rent_inflation_rate,
        property_appreciation_rate,
        invest_loan_difference,
        fixed_monthly_investment,
        fixed_investment_start_month,
    rent_reduces_investment,
    monthly_external_savings,
    invest_external_surplus,
    )

    buy_scenario = basic_comparison.scenarios[0]
    rent_scenario = basic_comparison.scenarios[1]
    invest_buy_scenario = basic_comparison.scenarios[2]

    # Calculate enhanced metrics for each scenario
    best_cost = min(s.total_cost for s in basic_comparison.scenarios)

    def calculate_metrics(scenario: ComparisonScenario) -> ComparisonMetrics:
        total_cost_diff = scenario.total_cost - best_cost
        total_cost_pct_diff = (total_cost_diff / best_cost * 100) if best_cost else 0

        monthly_costs_signed = [data.get("cash_flow", 0) for data in scenario.monthly_data]
        avg_monthly_cost = sum(monthly_costs_signed) / len(monthly_costs_signed) if monthly_costs_signed else 0

        # ROI denominator: down payment + upfront costs (if any) for purchase; else down payment (capital deployed)
        initial_investment = down_payment
        if scenario.name == "Comprar com financiamento" and scenario.monthly_data:
            upfront = scenario.monthly_data[0].get("upfront_additional_costs") or 0
            initial_investment += upfront
        final_value = scenario.final_equity
        roi_pct = ((final_value - initial_investment) / initial_investment * 100) if initial_investment else 0

        if scenario.name == "Comprar com financiamento":
            total_interest_rent = sum(d.get("interest_payment", 0) for d in scenario.monthly_data)
        else:
            total_interest_rent = sum(d.get("rent_paid", 0) for d in scenario.monthly_data)

        wealth = scenario.final_equity  # final_equity already encapsulates investments where relevant

        # Break-even month (first month where cumulative cost difference vs best <= 0)
        break_even_month = None
        if scenario.total_cost != best_cost:
            # Build cumulative net cost trajectory (approximate using cumulative cash flows)
            cumulative = 0.0
            for data in scenario.monthly_data:
                cumulative += data.get("cash_flow", 0)
                if cumulative >= 0:  # cash_flow negative -> cost, reaching >=0 indicates parity
                    break_even_month = data.get("month")
                    break

        # Sustainability aggregates (only meaningful for scenarios with withdrawal fields)
        withdrawals = [
            d.get("rent_withdrawal_from_investment", 0) for d in scenario.monthly_data
        ]
        raw_ratios = [
            d.get("sustainable_withdrawal_ratio") for d in scenario.monthly_data
        ]
        ratios = [float(r) for r in raw_ratios if isinstance(r, (int, float))]
        burns = [
            d.get("burn_month") for d in scenario.monthly_data if d.get("burn_month")
        ]
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
        month_comparison = {"month": month}

        # Get data for each scenario for this month
        buy_data = next(
            (d for d in buy_scenario.monthly_data if d["month"] == month), {}
        )
        rent_data = next(
            (d for d in rent_scenario.monthly_data if d["month"] == month), {}
        )
        invest_data = next(
            (d for d in invest_buy_scenario.monthly_data if d["month"] == month), {}
        )

        # Calculate explicit differences (inside loop so each month processed)
        buy_cost = buy_data.get("cash_flow", 0)
        rent_cost = rent_data.get("cash_flow", 0)
        invest_cost = invest_data.get("cash_flow", 0)

        month_comparison.update(
            {
                "buy_vs_rent_difference": buy_cost - rent_cost,
                "buy_vs_rent_percentage": (
                    ((buy_cost - rent_cost) / rent_cost * 100) if rent_cost > 0 else 0
                ),
                "buy_monthly_cash_flow": buy_cost,
                "rent_monthly_cash_flow": rent_cost,
                "invest_monthly_cash_flow": invest_cost,
                "buy_equity": buy_data.get("equity", 0),
                "rent_investment_balance": rent_data.get("investment_balance", 0),
                "invest_equity": invest_data.get("equity", 0),
                "invest_investment_balance": invest_data.get("investment_balance", 0),
                "property_value_buy": buy_data.get("property_value", 0),
                "property_value_rent": rent_data.get("property_value", 0),
                "property_value_invest": invest_data.get("property_value", 0),
                "buy_total_wealth": buy_data.get("equity", 0),
                "rent_total_wealth": rent_data.get("investment_balance", 0),
                "invest_total_wealth": invest_data.get("equity", 0)
                + invest_data.get("investment_balance", 0),
            }
        )
        comparative_summary[f"month_{month}"] = month_comparison

    return EnhancedComparisonResult(
        best_scenario=basic_comparison.best_scenario,
        scenarios=enhanced_scenarios,
        comparative_summary=comparative_summary,
    )
