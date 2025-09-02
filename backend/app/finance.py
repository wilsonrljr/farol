from typing import List, Dict, Optional, Tuple
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

    # Both provided, validate they are not None and return as-is
    if annual_rate is None or monthly_rate is None:
        raise ValueError("Both rates cannot be None when both are provided")
    return annual_rate, monthly_rate


def simulate_sac_loan(
    loan_value: float,
    term_months: int,
    monthly_interest_rate: float,
    amortizations: Optional[List[AmortizationInput]] = None,
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

    # Create amortization dictionary for quick lookup
    extra_amortizations = {}
    if amortizations:
        for amort in amortizations:
            extra_amortizations[amort.month] = amort.value

    # Calculate each installment
    for month in range(1, term_months + 1):
        # Check for extra amortization
        extra_amortization = extra_amortizations.get(month, 0)

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

    return LoanSimulationResult(
        loan_value=loan_value,
        total_paid=total_paid,
        total_interest_paid=total_interest_paid,
        installments=installments,
    )


def simulate_price_loan(
    loan_value: float,
    term_months: int,
    monthly_interest_rate: float,
    amortizations: Optional[List[AmortizationInput]] = None,
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

    # Create amortization dictionary for quick lookup
    extra_amortizations = {}
    if amortizations:
        for amort in amortizations:
            extra_amortizations[amort.month] = amort.value

    # Calculate each installment
    for month in range(1, term_months + 1):
        # Check for extra amortization
        extra_amortization = extra_amortizations.get(month, 0)

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

    return LoanSimulationResult(
        loan_value=loan_value,
        total_paid=total_paid,
        total_interest_paid=total_interest_paid,
        installments=installments,
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
            loan_value, term_months, monthly_interest_rate, amortizations
        )
    else:  # PRICE
        loan_result = simulate_price_loan(
            loan_value, term_months, monthly_interest_rate, amortizations
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

    return ComparisonScenario(
        name="Comprar com financiamento",
        total_cost=total_cost,
        final_equity=final_equity,
        monthly_data=monthly_data,
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
        # Get investment rate for this month
        monthly_rate = get_monthly_investment_rate(investment_returns, month)

        # Calculate investment return
        investment_return = investment_balance * monthly_rate
        investment_balance += investment_return

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
            }
        )

    return ComparisonScenario(
        name="Alugar e investir",
        total_cost=total_rent_paid - (investment_balance - down_payment),
        final_equity=investment_balance,
        monthly_data=monthly_data,
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
) -> ComparisonScenario:
    """Simulate investing until having enough to buy the property outright."""
    # Initialize variables
    monthly_data = []
    investment_balance = down_payment
    total_rent_paid = 0.0
    purchase_month = None

    # Calculate loan simulation for comparison if invest_loan_difference is True
    loan_installments = []
    if invest_loan_difference:
        # Calculate additional costs for loan scenario
        costs = calculate_additional_costs(property_value, additional_costs)
        loan_value = property_value - down_payment + costs["total_upfront"]

        # Simulate loan to get installment amounts
        if loan_type == "SAC":
            loan_result = simulate_sac_loan(
                loan_value, term_months, monthly_interest_rate, amortizations
            )
        else:  # PRICE
            loan_result = simulate_price_loan(
                loan_value, term_months, monthly_interest_rate, amortizations
            )

        loan_installments = loan_result.installments

    # Calculate monthly data
    for month in range(1, term_months + 1):
        # Apply property appreciation to property value and additional costs
        current_property_value = apply_property_appreciation(
            property_value, month, 1, property_appreciation_rate, inflation_rate
        )

        # Calculate additional costs for this month
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
                }
            )
            continue

        # Before purchase: calculate investment growth
        monthly_rate = get_monthly_investment_rate(investment_returns, month)
        investment_return = investment_balance * monthly_rate
        investment_balance += investment_return

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

        # Add fixed monthly investment if applicable
        if fixed_monthly_investment and month >= fixed_investment_start_month:
            additional_investment += fixed_monthly_investment
            investment_balance += fixed_monthly_investment

        # Check if we can buy the property (including additional upfront costs)
        if investment_balance >= total_purchase_cost:
            investment_balance -= total_purchase_cost
            purchase_month = month
            status = "Imóvel comprado"
            equity = current_property_value

            # After purchase, update fixed investment start month if it was set to start after purchase
            if fixed_investment_start_month == "after_purchase":
                fixed_investment_start_month = month + 1
        else:
            status = "Investindo"
            equity = 0

        # Calculate cash flow (negative = outgoing, positive = saved compared to loan scenario)
        base_cash_flow = -total_rent_cost - additional_investment
        if invest_loan_difference and month <= len(loan_installments):
            # Show the savings compared to loan scenario
            loan_installment = loan_installments[month - 1]
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
            cash_flow = -(
                total_rent_cost + (fixed_monthly_investment or 0)
            )  # Only count rent and fixed investment as cost
        else:
            cash_flow = base_cash_flow

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

    # Add total additional investments made during investment phase
    for data in monthly_data:
        if data["status"] == "Investindo":
            additional_inv = data.get("additional_investment", 0.0)
            if isinstance(additional_inv, (int, float)):
                total_additional_investments += additional_inv

    # Calculate total cost
    if purchase_month:
        # If property was purchased, calculate total net cost:
        # Total spent: rent + property purchase + additional costs + extra investments
        # Total assets: property value + remaining investment balance
        purchase_cost = (
            apply_property_appreciation(
                property_value,
                purchase_month,
                1,
                property_appreciation_rate,
                inflation_rate,
            )
            + calculate_additional_costs(
                apply_property_appreciation(
                    property_value,
                    purchase_month,
                    1,
                    property_appreciation_rate,
                    inflation_rate,
                ),
                additional_costs,
            )["total_upfront"]
        )

        total_spent = (
            total_rent_paid  # Rent until purchase
            + purchase_cost  # Property + upfront costs at purchase
            + total_monthly_additional_costs  # Costs after purchase
            + total_additional_investments  # All extra investments
        )

        total_assets = final_property_value + investment_balance
        total_cost = total_spent - total_assets
    else:
        # If property was never purchased:
        # Net cost = rent paid + all investments made - current investment balance
        # This represents the opportunity cost of renting vs final wealth achieved
        total_cost = total_rent_paid + total_additional_investments - investment_balance

    return ComparisonScenario(
        name="Investir e comprar à vista",
        total_cost=total_cost,
        final_equity=final_equity,
        monthly_data=monthly_data,
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
    )

    buy_scenario = basic_comparison.scenarios[0]
    rent_scenario = basic_comparison.scenarios[1]
    invest_buy_scenario = basic_comparison.scenarios[2]

    # Calculate enhanced metrics for each scenario
    best_cost = min(s.total_cost for s in basic_comparison.scenarios)

    def calculate_metrics(scenario: ComparisonScenario) -> ComparisonMetrics:
        total_cost_diff = scenario.total_cost - best_cost
        total_cost_pct_diff = (
            (total_cost_diff / best_cost) * 100 if best_cost != 0 else 0
        )

        # Calculate average monthly cost
        monthly_costs = [
            abs(data.get("cash_flow", 0)) for data in scenario.monthly_data
        ]
        avg_monthly_cost = (
            sum(monthly_costs) / len(monthly_costs) if monthly_costs else 0
        )

        # Calculate ROI
        initial_investment = down_payment
        final_value = scenario.final_equity
        roi_pct = (
            ((final_value - initial_investment) / initial_investment) * 100
            if initial_investment != 0
            else 0
        )

        # Calculate total interest/rent paid
        if scenario.name == "Comprar com financiamento":
            total_interest_rent = sum(
                data.get("interest_payment", 0) for data in scenario.monthly_data
            )
        else:
            total_interest_rent = sum(
                data.get("rent_paid", 0) for data in scenario.monthly_data
            )

        # Wealth accumulation
        wealth = scenario.final_equity + sum(
            data.get("investment_balance", 0) for data in scenario.monthly_data[-1:]
        )

        return ComparisonMetrics(
            total_cost_difference=total_cost_diff,
            total_cost_percentage_difference=total_cost_pct_diff,
            break_even_month=None,  # Could be calculated with more complex logic
            roi_percentage=roi_pct,
            average_monthly_cost=avg_monthly_cost,
            total_interest_or_rent_paid=total_interest_rent,
            wealth_accumulation=wealth,
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

        # Calculate explicit differences
        buy_cost = abs(buy_data.get("cash_flow", 0))
        rent_cost = abs(rent_data.get("cash_flow", 0))

        month_comparison.update(
            {
                "buy_vs_rent_difference": buy_cost - rent_cost,
                "buy_vs_rent_percentage": (
                    ((buy_cost - rent_cost) / rent_cost * 100) if rent_cost > 0 else 0
                ),
                "buy_monthly_cost": buy_cost,
                "rent_monthly_cost": rent_cost,
                "invest_monthly_cost": abs(invest_data.get("cash_flow", 0)),
                "buy_equity": buy_data.get("equity", 0),
                "rent_investment_balance": rent_data.get("investment_balance", 0),
                "invest_equity": invest_data.get("equity", 0),
                "invest_investment_balance": invest_data.get("investment_balance", 0),
                "property_value": buy_data.get(
                    "property_value", rent_data.get("property_value", 0)
                ),
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
