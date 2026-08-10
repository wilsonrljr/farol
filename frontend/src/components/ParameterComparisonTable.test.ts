import { describe, expect, it } from 'vitest';
import type { ComparisonInput } from '../api/types';
import { canAnalyzeSensitivity, getDefaultRange } from './ParameterComparisonTable';

function input(overrides: Partial<ComparisonInput> = {}): ComparisonInput {
  return {
    property_value: 500_000,
    down_payment: 100_000,
    total_savings: 150_000,
    loan_term_years: 30,
    annual_interest_rate: 10,
    monthly_interest_rate: null,
    loan_type: 'PRICE',
    rent_value: 2_000,
    rent_percentage: null,
    investment_returns: [{ start_month: 1, end_month: null, annual_rate: 8 }],
    additional_costs: { itbi_percentage: 2, deed_percentage: 1 },
    ...overrides,
  };
}

describe('parameter sensitivity guards', () => {
  it('não cria faixas de entrada que excedem patrimônio menos custos iniciais', () => {
    const base = input();
    const range = getDefaultRange('down_payment', base.down_payment, base);

    expect(range.max).toBeLessThanOrEqual(135_000);
    expect(range.min).toBeLessThan(range.max);
  });

  it('mantém valor do imóvel dentro da restrição de patrimônio total', () => {
    const base = input({ total_savings: 115_000 });
    const range = getDefaultRange('property_value', base.property_value, base);

    expect(range.max).toBeLessThanOrEqual(500_000);
    expect(range.min).toBeGreaterThanOrEqual(base.down_payment);
  });

  it('aceita juros mensais pela taxa anual efetiva e bloqueia curva de retorno ambígua', () => {
    const monthlyRate = input({ annual_interest_rate: null, monthly_interest_rate: 1 });
    const multipleReturns = input({
      investment_returns: [
        { start_month: 1, end_month: 12, annual_rate: 8 },
        { start_month: 13, end_month: null, annual_rate: 6 },
      ],
    });

    expect(canAnalyzeSensitivity('annual_interest_rate', monthlyRate)).toBe(true);
    expect(canAnalyzeSensitivity('investment_returns_rate', multipleReturns)).toBe(false);
  });
});
