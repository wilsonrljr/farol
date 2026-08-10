import { describe, expect, it } from 'vitest';
import type { ComparisonInput } from '../api/types';
import {
  isComparisonPresetInput,
  prepareComparisonInput,
  validateComparisonInput,
} from './ComparisonForm';

function validInput(overrides: Partial<ComparisonInput> = {}): ComparisonInput {
  return {
    property_value: 500_000,
    down_payment: 100_000,
    total_savings: null,
    loan_term_years: 30,
    annual_interest_rate: 10,
    monthly_interest_rate: null,
    loan_type: 'PRICE',
    rent_value: 2_000,
    rent_percentage: null,
    investment_returns: [{ start_month: 1, end_month: null, annual_rate: 8 }],
    additional_costs: {
      itbi_percentage: 2,
      deed_percentage: 1,
      monthly_hoa: 0,
      monthly_property_tax: 0,
    },
    ...overrides,
  };
}

describe('prepareComparisonInput', () => {
  it('preserva zeros explícitos e dá precedência aos campos alternativos preenchidos', () => {
    const result = prepareComparisonInput(
      validInput({
        annual_interest_rate: 10,
        monthly_interest_rate: 0,
        rent_value: 2_000,
        rent_percentage: 0,
      })
    );

    expect(result.monthly_interest_rate).toBe(0);
    expect(result.annual_interest_rate).toBeNull();
    expect(result.rent_percentage).toBe(0);
    expect(result.rent_value).toBeNull();
  });

  it('não transforma renda zero em ausência nem altera o objeto original', () => {
    const input = validInput({
      monthly_net_income: 0,
      monthly_net_income_adjust_inflation: true,
    });

    const result = prepareComparisonInput(input);

    expect(result.monthly_net_income).toBe(0);
    expect(result.monthly_net_income_adjust_inflation).toBe(true);
    expect(input.monthly_net_income).toBe(0);
    expect(result).not.toBe(input);
  });

  it('remove funding_source legado de aportes antes de chamar a API', () => {
    const contributions = [
      { month: 1, value: 100, funding_source: 'cash' },
    ] as unknown as NonNullable<ComparisonInput['contributions']>;

    const result = prepareComparisonInput(validInput({ contributions }));

    expect(result.contributions?.[0]).not.toHaveProperty('funding_source');
  });
});

describe('validateComparisonInput', () => {
  it('aceita juros e aluguel iguais a zero quando são a única alternativa informada', () => {
    const errors = validateComparisonInput(
      validInput({
        annual_interest_rate: null,
        monthly_interest_rate: 0,
        rent_value: null,
        rent_percentage: 0,
      })
    );

    expect(errors.monthly_interest_rate).toBeUndefined();
    expect(errors.annual_interest_rate).toBeUndefined();
    expect(errors.rent_percentage).toBeUndefined();
    expect(errors.rent_value).toBeUndefined();
  });

  it('valida relações entre entrada, patrimônio e custos antes do submit', () => {
    const errors = validateComparisonInput(
      validInput({ down_payment: 600_000, total_savings: 0 })
    );

    expect(errors.down_payment).toContain('não pode superar');
    expect(errors.total_savings).toContain('pelo menos');
  });

  it('rejeita recorrências ambíguas, fora do horizonte e percentuais acima de 100%', () => {
    const errors = validateComparisonInput(
      validInput({
        loan_term_years: 1,
        amortizations: [
          {
            month: 13,
            value: 120,
            value_type: 'percentage',
            funding_source: 'cash',
            end_month: 10,
            occurrences: 2,
          },
        ],
      })
    );

    expect(errors['amortizations.0.month']).toContain('entre 1 e 12');
    expect(errors['amortizations.0.value']).toContain('entre 0% e 100%');
    expect(errors['amortizations.0.interval_months']).toContain('intervalo');
    expect(errors['amortizations.0.occurrences']).toContain('não ambos');
  });

  it('aceita recorrência sem mês explícito e assume início no mês 1', () => {
    const errors = validateComparisonInput(
      validInput({
        contributions: [
          {
            value: 100,
            interval_months: 1,
            end_month: 12,
          },
        ],
      })
    );

    expect(errors['contributions.0.month']).toBeUndefined();
    expect(errors['contributions.0.end_month']).toBeUndefined();
  });

  it('continua exigindo mês quando não há configuração de recorrência', () => {
    const errors = validateComparisonInput(
      validInput({ contributions: [{ value: 100 }] })
    );

    expect(errors['contributions.0.month']).toContain('mês ou um intervalo');
  });

  it('limita ocorrências, carga expandida e valores financeiros extremos', () => {
    const excessiveOccurrences = validateComparisonInput(
      validInput({
        contributions: [
          { month: 1, interval_months: 1, occurrences: 601, value: 100 },
        ],
      })
    );
    const repeated = {
      month: 1,
      interval_months: 1,
      occurrences: 600,
      value: 100,
    };
    const excessiveAggregate = validateComparisonInput(
      validInput({
        loan_term_years: 50,
        contributions: Array.from({ length: 17 }, () => ({ ...repeated })),
      })
    );
    const extremeAmount = validateComparisonInput(
      validInput({ property_value: 1e308 })
    );

    expect(excessiveOccurrences['contributions.0.occurrences']).toContain('600');
    expect(excessiveAggregate.contributions).toContain('10.000');
    expect(extremeAmount.property_value).toContain('quadrilhão');
  });

  it('limita a soma de aportes percentuais por cenário e mês', () => {
    const errors = validateComparisonInput(
      validInput({
        contributions: [
          { month: 1, value: 60, value_type: 'percentage' },
          { month: 1, value: 60, value_type: 'percentage' },
        ],
      })
    );

    expect(errors['contributions.1.value']).toContain('100%');
  });

  it('rejeita recorrência fracionária e enums inválidos sem tentar expandir uma série enorme', () => {
    const errors = validateComparisonInput(
      validInput({
        contributions: [{
          month: 1,
          interval_months: 0.000001,
          value: 10,
          value_type: 'unknown',
          applies_to: ['buy', 'buy'],
        } as unknown as NonNullable<ComparisonInput['contributions']>[number]],
      })
    );

    expect(errors['contributions.0.interval_months']).toContain('inteiro');
    expect(errors['contributions.0.value_type']).toContain('fixo ou percentual');
    expect(errors['contributions.0.applies_to']).toContain('sem duplicidades');
  });
});

describe('isComparisonPresetInput', () => {
  it('não aceita strings numéricas em campos que o formulário trata como números', () => {
    expect(
      isComparisonPresetInput({
        ...validInput(),
        property_value: '500000',
      })
    ).toBe(false);
  });
});
