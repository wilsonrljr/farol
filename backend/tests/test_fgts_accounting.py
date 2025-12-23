import pytest

from backend.app.finance import (
    simulate_buy_scenario,
    simulate_invest_then_buy_scenario,
)
from backend.app.models import AdditionalCostsInput, FGTSInput, InvestmentReturnInput


def test_buy_fgts_withdrawal_counts_as_outflow():
    """FGTS usado na compra deve aparecer em total_outflows."""

    result = simulate_buy_scenario(
        property_value=100_000,
        down_payment=10_000,
        loan_term_years=1,
        monthly_interest_rate=0.0,
        loan_type="SAC",
        amortizations=None,
        additional_costs=AdditionalCostsInput(
            itbi_percentage=0.0,
            deed_percentage=0.0,
            monthly_hoa=0.0,
            monthly_property_tax=0.0,
        ),
        inflation_rate=0.0,
        property_appreciation_rate=0.0,
        fgts=FGTSInput(
            initial_balance=20_000.0,
            monthly_contribution=0.0,
            annual_yield_rate=0.0,
            use_at_purchase=True,
            max_withdrawal_at_purchase=None,
        ),
    )

    fgts_used = result.purchase_breakdown.fgts_at_purchase
    sum_installments = sum(m.installment or 0.0 for m in result.monthly_data)
    expected_outflow = (
        result.purchase_breakdown.cash_down_payment + fgts_used + sum_installments
    )

    assert fgts_used > 0
    assert result.total_outflows is not None
    assert result.total_outflows == pytest.approx(expected_outflow, rel=0, abs=1e-6)


def test_invest_then_buy_respects_fgts_withdrawal_cap():
    """Compra à vista não deve ocorrer se o FGTS sacável + caixa for insuficiente."""

    result = simulate_invest_then_buy_scenario(
        property_value=100_000,
        down_payment=85_000,  # saldo em caixa/investimento
        term_months=6,
        rent_value=0.0,
        investment_returns=[InvestmentReturnInput(start_month=1, annual_rate=0.0)],
        additional_costs=AdditionalCostsInput(
            itbi_percentage=0.0,
            deed_percentage=0.0,
            monthly_hoa=0.0,
            monthly_property_tax=0.0,
        ),
        inflation_rate=0.0,
        fgts=FGTSInput(
            initial_balance=100_000.0,
            monthly_contribution=0.0,
            annual_yield_rate=0.0,
            use_at_purchase=True,
            max_withdrawal_at_purchase=10_000.0,
        ),
    )

    # Só 85k em caixa + 10k de FGTS liberado < 100k do imóvel => compra não deve ocorrer.
    assert all(m.status != "Imóvel comprado" for m in result.monthly_data)
    assert result.monthly_data[0].purchase_month is None
