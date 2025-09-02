from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os

from .models import (
    LoanSimulationInput,
    ComparisonInput,
    LoanSimulationResult,
    ComparisonResult,
    EnhancedComparisonResult,
)
from .finance import (
    convert_interest_rate,
    simulate_sac_loan,
    simulate_price_loan,
    compare_scenarios,
    enhanced_compare_scenarios,
)

APP_NAME = os.getenv("APP_NAME", "Farol")
API_TITLE = os.getenv("API_TITLE", f"{APP_NAME} API")
API_DESCRIPTION = os.getenv(
    "API_DESCRIPTION",
    "Plataforma Farol: simulação e planejamento financeiro (imóveis hoje; outros objetivos no futuro).",
)

app = FastAPI(
    title=API_TITLE,
    description=API_DESCRIPTION,
    version="0.1.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": f"{API_TITLE}", "name": APP_NAME}


@app.post("/api/simulate-loan", response_model=LoanSimulationResult)
async def simulate_loan(input_data: LoanSimulationInput):
    """
    Simulate a loan with either SAC or PRICE method.
    Supports additional costs (ITBI, deed, HOA, property tax) and inflation.
    """
    try:
        # Calculate loan value (base value, additional costs will be handled in simulation functions)
        loan_value = input_data.property_value - input_data.down_payment

        # Convert interest rates if needed
        annual_rate = input_data.annual_interest_rate
        monthly_rate = input_data.monthly_interest_rate

        if annual_rate is None and monthly_rate is None:
            raise HTTPException(
                status_code=400,
                detail="Either annual_interest_rate or monthly_interest_rate must be provided",
            )

        annual_rate, monthly_rate = convert_interest_rate(annual_rate, monthly_rate)

        # Calculate term in months
        term_months = input_data.loan_term_years * 12

        # Simulate loan
        if input_data.loan_type == "SAC":
            result = simulate_sac_loan(
                loan_value, term_months, monthly_rate, input_data.amortizations
            )
        else:  # PRICE
            result = simulate_price_loan(
                loan_value, term_months, monthly_rate, input_data.amortizations
            )

        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/compare-scenarios", response_model=ComparisonResult)
async def compare_housing_scenarios(input_data: ComparisonInput):
    """
    Compare different housing scenarios: buying with a loan, renting and investing, or investing then buying.
    Supports additional costs (ITBI, deed, HOA, property tax) and inflation.
    """
    try:
        # Convert interest rates if needed
        annual_rate = input_data.annual_interest_rate
        monthly_rate = input_data.monthly_interest_rate

        if annual_rate is None and monthly_rate is None:
            raise HTTPException(
                status_code=400,
                detail="Either annual_interest_rate or monthly_interest_rate must be provided",
            )

        annual_rate, monthly_rate = convert_interest_rate(annual_rate, monthly_rate)

        # Calculate rent value if provided as percentage
        rent_value = input_data.rent_value
        if rent_value is None and input_data.rent_percentage is not None:
            rent_value = (
                input_data.property_value * (input_data.rent_percentage / 100) / 12
            )

        if rent_value is None:
            raise HTTPException(
                status_code=400,
                detail="Either rent_value or rent_percentage must be provided",
            )

        # Compare scenarios
        result = compare_scenarios(
            property_value=input_data.property_value,
            down_payment=input_data.down_payment,
            loan_term_years=input_data.loan_term_years,
            monthly_interest_rate=monthly_rate,
            loan_type=input_data.loan_type,
            rent_value=rent_value,
            investment_returns=input_data.investment_returns,
            amortizations=input_data.amortizations,
            additional_costs=input_data.additional_costs,
            inflation_rate=input_data.inflation_rate,
            rent_inflation_rate=input_data.rent_inflation_rate,
            property_appreciation_rate=input_data.property_appreciation_rate,
            invest_loan_difference=input_data.invest_loan_difference,
            fixed_monthly_investment=input_data.fixed_monthly_investment,
            fixed_investment_start_month=input_data.fixed_investment_start_month or 1,
        )

        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@app.post("/api/compare-scenarios-enhanced", response_model=EnhancedComparisonResult)
async def compare_housing_scenarios_enhanced(input_data: ComparisonInput):
    """
    Enhanced comparison of housing scenarios with detailed metrics and month-by-month analysis.
    Includes explicit differences between scenarios, ROI calculations, and comprehensive wealth tracking.
    """
    try:
        # Convert interest rates if needed
        annual_rate = input_data.annual_interest_rate
        monthly_rate = input_data.monthly_interest_rate

        if annual_rate is None and monthly_rate is None:
            raise HTTPException(
                status_code=400,
                detail="Either annual_interest_rate or monthly_interest_rate must be provided",
            )

        annual_rate, monthly_rate = convert_interest_rate(annual_rate, monthly_rate)

        # Calculate rent value if provided as percentage
        rent_value = input_data.rent_value
        if rent_value is None and input_data.rent_percentage is not None:
            rent_value = (
                input_data.property_value * (input_data.rent_percentage / 100) / 12
            )

        if rent_value is None:
            raise HTTPException(
                status_code=400,
                detail="Either rent_value or rent_percentage must be provided",
            )

        # Enhanced comparison with detailed metrics
        result = enhanced_compare_scenarios(
            property_value=input_data.property_value,
            down_payment=input_data.down_payment,
            loan_term_years=input_data.loan_term_years,
            monthly_interest_rate=monthly_rate,
            loan_type=input_data.loan_type,
            rent_value=rent_value,
            investment_returns=input_data.investment_returns,
            amortizations=input_data.amortizations,
            additional_costs=input_data.additional_costs,
            inflation_rate=input_data.inflation_rate,
            rent_inflation_rate=input_data.rent_inflation_rate,
            property_appreciation_rate=input_data.property_appreciation_rate,
            invest_loan_difference=input_data.invest_loan_difference,
            fixed_monthly_investment=input_data.fixed_monthly_investment,
            fixed_investment_start_month=input_data.fixed_investment_start_month or 1,
        )

        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
