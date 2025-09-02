# AI Agent Instructions for Finance Simulator Project

This is a financial simulator application that compares different housing scenarios in Brazil, including buying with financing, renting and investing, or investing to buy outright.

## Project Structure

- `backend/app/`: FastAPI backend
  - `models.py`: Pydantic models defining the API data structures
  - `finance.py`: Core financial calculations and simulation logic
  - `main.py`: FastAPI routes and API endpoints


## Key Concepts

### Financial Simulation Types

The project supports three main simulation scenarios:
1. **Buy with Financing** (`simulate_buy_scenario`): SAC or PRICE loan systems
2. **Rent and Invest** (`simulate_rent_and_invest_scenario`): Invest down payment while renting
3. **Invest then Buy** (`simulate_invest_then_buy_scenario`): Save until buying outright

### Investment Returns

- Investment returns are specified through `InvestmentReturnInput` objects
- Returns can vary over time using `start_month`/`end_month`
- All rates are annual but converted to monthly internally

### Additional Costs

Property transactions include:
- Upfront: ITBI tax, deed costs
- Monthly: HOA fees, property tax
- All costs support inflation adjustment

## Common Patterns

### Rate Conversions
```python
# Always use convert_interest_rate() for rate conversions
annual_rate, monthly_rate = convert_interest_rate(annual_rate=10.0)
```

### Inflation Handling
```python
# Use apply_inflation() for time-adjusted values
current_value = apply_inflation(base_value, month, base_month, inflation_rate)
```

### Monthly Data Structure
All simulation scenarios return monthly data with consistent fields:
- cash_flow: Monthly payments/income
- investment_balance: Current investment total
- equity: Property equity (if applicable)
- property_value: Current property value

## Development Workflows

1. Backend:
   - Uses Python 3.13+
   - Run 'uvicorn backend.app.main:app --reload' from root directory
   - API available at `http://localhost:8000`

## Testing

Add test cases to `backend/tests/` following the pattern in `test_finance.py`. Focus on edge cases in financial calculations.

## Common Pitfalls

- Remember to handle inflation for all time-based values
- Investment returns compound monthly but are specified annually
- Loan simulations should stop when fully paid (balance <= 0)
- Validate that monthly_interest_rate XOR annual_interest_rate is provided

## Frontend

Frontend should be created in `frontend/` using React, Vite and Mantine UI framework. It will interact with the backend API to fetch simulation results and display them.

- Landing page moderna e informativa, com cards e outros componentes de UI que façam sentido.
- Deve haver uma página "Sobre", explicando como usar e para serve a aplicação.
