from backend.app.finance import simulate_rent_and_invest_scenario
from backend.app.models import InvestmentReturnInput, AdditionalCostsInput


def test_rent_does_not_reduce_when_flag_false():
    scenario = simulate_rent_and_invest_scenario(
        property_value=300000,
        down_payment=50000,
        term_months=12,
        rent_value=2000,
        investment_returns=[InvestmentReturnInput(start_month=1, annual_rate=12.0)],
        additional_costs=AdditionalCostsInput(itbi_percentage=0, deed_percentage=0),
        inflation_rate=0,
        rent_inflation_rate=0,
        property_appreciation_rate=0,
        rent_reduces_investment=False,
    )
    # Investment should only grow (no withdrawals)
    balances = [m['investment_balance'] for m in scenario.monthly_data]
    assert all(balances[i] <= balances[i+1] for i in range(len(balances)-1))
    assert all(m.get('rent_withdrawal_from_investment', 0) == 0 for m in scenario.monthly_data)


def test_rent_reduces_when_flag_true():
    scenario = simulate_rent_and_invest_scenario(
        property_value=300000,
        down_payment=50000,
        term_months=12,
        rent_value=5000,  # higher rent to create noticeable drawdown
        investment_returns=[InvestmentReturnInput(start_month=1, annual_rate=2.0)],
        additional_costs=AdditionalCostsInput(itbi_percentage=0, deed_percentage=0),
        inflation_rate=0,
        rent_inflation_rate=0,
        property_appreciation_rate=0,
        rent_reduces_investment=True,
    )
    withdrawals = [m.get('rent_withdrawal_from_investment', 0) for m in scenario.monthly_data]
    assert any(w > 0 for w in withdrawals)
    # Balance after month 1 should be less than starting (minus withdrawal + small return)
    first = scenario.monthly_data[0]['investment_balance']
    last = scenario.monthly_data[-1]['investment_balance']
    assert last < 50000  # consumed part of principal
