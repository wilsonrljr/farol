import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { ComparisonInput, EnhancedComparisonResult } from '../api/types';
import EnhancedComparisonResults from './EnhancedComparisonResults';

vi.mock('@mantine/charts', () => ({
  AreaChart: () => <div data-testid="area-chart" />,
  LineChart: () => <div data-testid="line-chart" />,
}));

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: ResizeObserverMock,
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({
      matches: false,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    }),
  });
});

const cashInput: ComparisonInput = {
  property_value: 500_000,
  down_payment: 500_000,
  total_savings: 515_000,
  comparison_horizon_years: 10,
  // Legacy technical values must not make an outright purchase look financed.
  loan_term_years: 30,
  loan_type: 'PRICE',
  annual_interest_rate: 10,
  monthly_interest_rate: null,
  rent_value: 2_000,
  rent_percentage: null,
  investment_returns: [{ start_month: 1, end_month: null, annual_rate: 8 }],
  additional_costs: { itbi_percentage: 2, deed_percentage: 1 },
  monthly_plan: {
    net_income: 10_000,
    non_housing_expenses: 4_000,
    adjust_for_inflation: true,
    wealth_allocation_percentage: 80,
    financed_purchase: {
      amortization_percentage: 50,
      amortization_effect: 'reduce_term',
    },
  },
};

const cashResult: EnhancedComparisonResult = {
  comparison_status: 'comparable',
  best_scenario_type: 'buy',
  comparative_summary: {},
  scenarios: [
    {
      name: 'Comprar',
      scenario_type: 'buy',
      total_cost: 500_000,
      final_equity: 500_000,
      final_wealth: 500_000,
      total_extra_amortization_from_income: 0,
      monthly_data: [{ month: 1, cash_flow: 0, equity: 500_000 }],
      purchase_breakdown: {
        property_value: 500_000,
        cash_down_payment: 500_000,
        fgts_at_purchase: 0,
        total_down_payment: 500_000,
        financed_amount: 0,
        upfront_costs: 15_000,
        total_cash_needed: 515_000,
      },
      metrics: {
        total_cost_difference: 0,
        average_monthly_cost: 0,
        total_interest_or_rent_paid: 0,
        wealth_accumulation: 0,
        roi_percentage: 0,
      },
    },
    {
      name: 'Alugar e investir',
      scenario_type: 'rent_invest',
      total_cost: 24_000,
      final_equity: 480_000,
      final_wealth: 480_000,
      monthly_data: [{
        month: 1,
        cash_flow: 0,
        rent_due: 2_000,
        investment_balance: 480_000,
        burn_month: true,
      }],
      metrics: {
        total_cost_difference: 0,
        average_monthly_cost: 2_000,
        total_interest_or_rent_paid: 24_000,
        wealth_accumulation: 0,
        roi_percentage: 0,
        months_with_burn: 1,
      },
    },
  ],
};

describe('EnhancedComparisonResults purchase semantics', () => {
  it('does not present financing or amortization policies for an outright purchase', () => {
    render(
      <MantineProvider>
        <EnhancedComparisonResults result={cashResult} inputPayload={cashInput} />
      </MantineProvider>
    );

    expect(screen.getByText('Compra à vista')).toBeInTheDocument();
    expect(screen.queryByText(/Financiamento:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Amortização:/)).not.toBeInTheDocument();
    expect(screen.queryByText('Amortizado')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Comprar' }));
    expect(
      screen.getByRole('table', { name: /Fluxo mensal da compra à vista/ })
    ).toBeInTheDocument();
    expect(screen.queryByText(/Quitado no mês/)).not.toBeInTheDocument();
    expect(screen.queryByText('Mês de quitação')).not.toBeInTheDocument();
    expect(screen.queryByText(/burn/i)).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Ajuda: Tabela do financiamento')
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Saldo devedor' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Juros' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Alugar e investir' }));
    expect(screen.getByText('Meses usando patrimônio')).toBeInTheDocument();
    expect(
      screen.getByText('Uso do patrimônio (saque maior que o rendimento)')
    ).toBeInTheDocument();
    expect(screen.queryByText(/burn/i)).not.toBeInTheDocument();
  });
});
