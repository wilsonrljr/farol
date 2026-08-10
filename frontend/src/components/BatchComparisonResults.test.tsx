import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import type {
  BatchComparisonResult,
  ComparisonInput,
  EnhancedComparisonScenario,
} from '../api/types';
import BatchComparisonResults, { escapeCsvCell } from './BatchComparisonResults';

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

function scenario(name: string, wealth: number): EnhancedComparisonScenario {
  return {
    name,
    scenario_type: 'buy',
    total_cost: 100,
    final_equity: wealth,
    final_wealth: wealth,
    monthly_data: [{ month: 1, cash_flow: 0, equity: wealth }],
    metrics: {
      total_cost_difference: 0,
      average_monthly_cost: 100,
      total_interest_or_rent_paid: 0,
      wealth_accumulation: wealth,
      roi_percentage: 1,
    },
  };
}

function presetInput(propertyValue: number): ComparisonInput {
  return {
    property_value: propertyValue,
    down_payment: 100_000,
    total_savings: 150_000,
    loan_term_years: 30,
    comparison_horizon_years: 10,
    annual_interest_rate: 10,
    monthly_interest_rate: null,
    loan_type: 'PRICE',
    rent_value: 2_000,
    rent_percentage: null,
    investment_returns: [{ start_month: 1, end_month: null, annual_rate: 8 }],
    additional_costs: { itbi_percentage: 2, deed_percentage: 1 },
  };
}

describe('escapeCsvCell CSV safety', () => {
  it('escapa fórmulas, delimitadores e aspas em nomes controlados pelo usuário', () => {
    expect(escapeCsvCell('=HYPERLINK("https://example.test")')).toBe(
      '"\'=HYPERLINK(""https://example.test"")"'
    );
    expect(escapeCsvCell('  =1+1')).toBe('"\'  =1+1"');
    expect(escapeCsvCell('Cenário; principal')).toBe('"Cenário; principal"');
  });

  it('preserva métricas negativas como células numéricas', () => {
    expect(escapeCsvCell(-123.45)).toBe('-123.45');
    expect(escapeCsvCell(42)).toBe('42');
  });

  it('mantém ROI ausente como célula vazia, sem convertê-lo em zero', () => {
    expect(escapeCsvCell(null)).toBe('""');
    expect(escapeCsvCell(undefined)).toBe('""');
    expect(escapeCsvCell(Number.NaN)).toBe('""');
  });
});

describe('BatchComparisonResults comparison contract', () => {
  it('does not aggregate or cross-plot locally valid presets when the batch is not comparable', () => {
    const result: BatchComparisonResult = {
      comparison_status: 'no_authoritative_result',
      // The explicit status is authoritative even if a stale/legacy response
      // accidentally carries ranking fields.
      global_best: {
        preset_id: 'b',
        preset_name: 'Horizonte longo',
        scenario_name: 'Comprar B',
        scenario_type: 'buy',
        final_wealth: 200_000,
        net_worth_change: 0,
        total_cost: 100,
        roi_percentage: 1,
      },
      ranking: [{
        preset_id: 'b',
        preset_name: 'Horizonte longo',
        scenario_name: 'Comprar B',
        scenario_type: 'buy',
        final_wealth: 200_000,
        net_worth_change: 0,
        total_cost: 100,
        roi_percentage: 1,
      }],
      results: [
        {
          preset_id: 'a',
          preset_name: 'Horizonte curto',
          result: {
            comparison_status: 'comparable',
            best_scenario_type: 'buy',
            scenarios: [scenario('Comprar A', 100_000)],
            comparative_summary: {},
          },
        },
        {
          preset_id: 'b',
          preset_name: 'Horizonte longo',
          result: {
            comparison_status: 'comparable',
            best_scenario_type: 'buy',
            scenarios: [scenario('Comprar B', 200_000)],
            comparative_summary: {},
          },
        },
      ],
    };

    render(
      <MantineProvider>
        <BatchComparisonResults
          result={result}
          presetInputs={[presetInput(500_000), presetInput(600_000)]}
        />
      </MantineProvider>
    );

    expect(screen.queryByRole('heading', { name: 'Evolução do patrimônio' })).not.toBeInTheDocument();
    expect(screen.queryByText('Melhor')).not.toBeInTheDocument();
    expect(screen.queryByText('Menor')).not.toBeInTheDocument();
    expect(screen.queryByText('Média')).not.toBeInTheDocument();
    expect(screen.getByText(/agregados patrimoniais entre presets foram ocultados/)).toBeInTheDocument();
    expect(screen.queryByText('Maior patrimônio final comparável')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar ranking CSV' })).toBeDisabled();

    fireEvent.click(screen.getByRole('tab', { name: 'Leitura dos resultados' }));
    expect(screen.getByText('Sem ranking comparável', { selector: 'h3' })).toBeInTheDocument();
    expect(screen.queryByText('Maior patrimônio comparável')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Parâmetros' }));
    expect(screen.queryByText('Diferença Máxima de Patrimônio')).not.toBeInTheDocument();
  });
});
