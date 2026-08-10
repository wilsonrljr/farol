import { describe, expect, it } from 'vitest';
import type { ComparisonInput } from '../../api/types';
import {
  isComparisonPresetInput,
  normalizeComparisonInput,
  prepareComparisonInput,
  validateComparisonInput,
} from './comparisonInput';

const valid: ComparisonInput = {
  property_value: 500_000,
  down_payment: 100_000,
  total_savings: 150_000,
  loan_term_years: 30,
  comparison_horizon_years: 10,
  annual_interest_rate: 10,
  monthly_interest_rate: null,
  loan_type: 'PRICE',
  rent_value: 2_500,
  rent_percentage: null,
  investment_returns: [{ start_month: 1, end_month: null, annual_rate: 8 }],
  monthly_plan: {
    net_income: 10_000,
    non_housing_expenses: 3_000,
    adjust_for_inflation: true,
    wealth_allocation_percentage: 80,
    financed_purchase: {
      amortization_percentage: 40,
      amortization_effect: 'reduce_term',
    },
  },
  extra_income_events: [],
  additional_costs: {
    itbi_percentage: 2,
    deed_percentage: 1,
    owner_monthly_costs: { hoa: 600, property_tax: 250 },
    renter_monthly_costs: { hoa: 600, property_tax: 0 },
  },
  inflation_rate: 4,
  rent_inflation_rate: 5,
  property_appreciation_rate: 4,
};

describe('comparisonInput v3', () => {
  it('preserves the explicit monthly plan', () => {
    expect(prepareComparisonInput(valid).monthly_plan).toEqual(valid.monthly_plan);
  });

  it('rejects a missing monthly plan for a saved scenario', () => {
    expect(isComparisonPresetInput({ ...valid, monthly_plan: null })).toBe(false);
  });

  it('rejects a v4 preset without an explicit non-empty return premise', () => {
    expect(isComparisonPresetInput({ ...valid, investment_returns: [] })).toBe(false);
    const { investment_returns: _returns, ...withoutReturns } = valid;
    expect(isComparisonPresetInput(withoutReturns)).toBe(false);
    expect(isComparisonPresetInput({
      ...valid,
      investment_returns: [{ start_month: 2, end_month: null, annual_rate: 8 }],
    })).toBe(false);
  });

  it('rejects a malformed costs object without throwing during import validation', () => {
    const missingCosts = { ...valid } as Record<string, unknown>;
    delete missingCosts.additional_costs;

    expect(() => isComparisonPresetInput(missingCosts)).not.toThrow();
    expect(isComparisonPresetInput(missingCosts)).toBe(false);
    expect(
      isComparisonPresetInput({ ...valid, additional_costs: null })
    ).toBe(false);
  });

  it('fills only optional monthly-plan policy defaults', () => {
    const normalized = normalizeComparisonInput({
      ...valid,
      monthly_plan: {
        net_income: 10_000,
        non_housing_expenses: 3_000,
      } as ComparisonInput['monthly_plan'],
    });

    expect(normalized.monthly_plan).toMatchObject({
      adjust_for_inflation: true,
      wealth_allocation_percentage: 100,
      financed_purchase: {
        amortization_percentage: 0,
        amortization_effect: 'reduce_term',
      },
    });
  });

  it('does not reinterpret explicit nulls as omitted StrictInputModel defaults', () => {
    expect(isComparisonPresetInput({
      ...valid,
      monthly_plan: {
        ...valid.monthly_plan!,
        wealth_allocation_percentage: null,
      },
    })).toBe(false);
    expect(isComparisonPresetInput({
      ...valid,
      fgts: { annual_yield_rate: null },
    })).toBe(false);
  });

  it('accepts an outright purchase without financing fields but rejects an incomplete financed purchase', () => {
    const outright: ComparisonInput = {
      ...valid,
      down_payment: valid.property_value,
      total_savings: 515_000,
      loan_term_years: null,
      loan_type: null,
      annual_interest_rate: null,
      monthly_interest_rate: null,
    };
    expect(validateComparisonInput(outright)).toEqual({});
    expect(isComparisonPresetInput(outright)).toBe(true);

    const financed = {
      ...valid,
      annual_interest_rate: null,
      monthly_interest_rate: null,
    };
    expect(validateComparisonInput(financed).annual_interest_rate).toBeTruthy();
  });

  it('preserves nullable economic assumptions and validates other housing costs', () => {
    const nullable = {
      ...valid,
      inflation_rate: null,
      rent_inflation_rate: null,
      property_appreciation_rate: null,
    };
    expect(validateComparisonInput(nullable).inflation_rate).toBeUndefined();
    expect(prepareComparisonInput(nullable).rent_inflation_rate).toBeNull();

    const errors = validateComparisonInput({
      ...valid,
      additional_costs: {
        ...valid.additional_costs,
        owner_monthly_costs: { hoa: 0, property_tax: 0, other: -1 },
      },
    });
    expect(errors['additional_costs.owner_monthly_costs.other']).toBeTruthy();
  });

  it('rejects legacy flat housing costs instead of silently migrating them', () => {
    expect(() => normalizeComparisonInput({
      ...valid,
      additional_costs: { itbi_percentage: 2, deed_percentage: 1, monthly_hoa: 100 },
    })).toThrow(/formato antigo/);
  });

  it('validates both parts of the monthly budget explicitly', () => {
    const errors = validateComparisonInput({
      ...valid,
      monthly_plan: { ...valid.monthly_plan!, net_income: -1, non_housing_expenses: -1 },
    });
    expect(errors['monthly_plan.net_income']).toBeTruthy();
    expect(errors['monthly_plan.non_housing_expenses']).toBeTruthy();
  });

  it('validates allocation percentages and amortization effect', () => {
    const errors = validateComparisonInput({
      ...valid,
      monthly_plan: {
        ...valid.monthly_plan!,
        wealth_allocation_percentage: 101,
        financed_purchase: {
          amortization_percentage: -1,
          amortization_effect: 'invalid' as 'reduce_term',
        },
      },
    });
    expect(errors['monthly_plan.wealth_allocation_percentage']).toBeTruthy();
    expect(errors['monthly_plan.financed_purchase.amortization_percentage']).toBeTruthy();
    expect(errors['monthly_plan.financed_purchase.amortization_effect']).toBeTruthy();
  });

  it('validates extra-income events against the comparison horizon', () => {
    const errors = validateComparisonInput({
      ...valid,
      comparison_horizon_years: 1,
      extra_income_events: [{ kind: 'bonus', amount: 1_000, month: 13, inflation_adjust: false }],
    });
    expect(errors['extra_income_events.0.month']).toContain('12');
  });

  it('validates recurrence completeness, integer months and the event kind', () => {
    const errors = validateComparisonInput({
      ...valid,
      comparison_horizon_years: 1,
      extra_income_events: [
        {
          kind: 'invalid' as 'bonus',
          amount: 0,
          month: 1.5,
          interval_months: null,
          end_month: 13,
          inflation_adjust: false,
        },
      ],
    });

    expect(errors['extra_income_events.0.kind']).toBeTruthy();
    expect(errors['extra_income_events.0.amount']).toContain('maior que zero');
    expect(errors['extra_income_events.0.month']).toContain('inteiro');
    expect(errors['extra_income_events.0.end_month']).toContain('12');
    expect(errors['extra_income_events.0.interval_months']).toContain('recorrência');
  });

  it('validates optional FGTS and tax fields before they reach the backend', () => {
    const errors = validateComparisonInput({
      ...valid,
      investment_tax: {
        enabled: true,
        mode: 'invalid' as 'monthly',
        effective_tax_rate: 101,
      },
      fgts: {
        initial_balance: -1,
        monthly_contribution: 0,
        annual_yield_rate: 101,
        use_at_purchase: true,
        max_withdrawal_at_purchase: null,
        financed_amortization: null,
      },
    });

    expect(errors['investment_tax.mode']).toBeTruthy();
    expect(errors['investment_tax.effective_tax_rate']).toBeTruthy();
    expect(errors['fgts.initial_balance']).toBeTruthy();
    expect(errors['fgts.annual_yield_rate']).toBeTruthy();
  });

  it('rejects string booleans that StrictInputModel would reject', () => {
    const candidate = {
      ...valid,
      monthly_plan: {
        ...valid.monthly_plan!,
        adjust_for_inflation: 'true',
      },
      investment_tax: { enabled: 'false' },
      fgts: {
        use_at_purchase: 'true',
        financed_amortization: { enabled: 'false' },
      },
      extra_income_events: [
        { kind: 'bonus', amount: 1_000, month: 1, inflation_adjust: 'false' },
      ],
    } as unknown as ComparisonInput;

    const errors = validateComparisonInput(normalizeComparisonInput(candidate));
    expect(errors['monthly_plan.adjust_for_inflation']).toBeTruthy();
    expect(errors['investment_tax.enabled']).toBeTruthy();
    expect(errors['fgts.use_at_purchase']).toBeTruthy();
    expect(errors['fgts.financed_amortization.enabled']).toBeTruthy();
    expect(errors['extra_income_events.0.inflation_adjust']).toBeTruthy();
    expect(isComparisonPresetInput(candidate)).toBe(false);
  });

  it('rejects unknown keys recursively and strips them during normalization', () => {
    const eventWithExtraKey = {
      kind: 'bonus' as const,
      amount: 1_000,
      month: 1,
      inflation_adjust: false,
      unexpected: 'survives-until-422',
    };
    const candidate = {
      ...valid,
      extra_income_events: [eventWithExtraKey],
    } as unknown as ComparisonInput;

    expect(isComparisonPresetInput(candidate)).toBe(false);
    const normalizedEvent = normalizeComparisonInput(candidate)
      .extra_income_events?.[0] as unknown as Record<string, unknown>;
    expect(normalizedEvent).not.toHaveProperty('unexpected');
    expect(isComparisonPresetInput({ ...valid, unexpected: true })).toBe(false);
    expect(
      isComparisonPresetInput({
        ...valid,
        additional_costs: {
          ...valid.additional_costs,
          owner_monthly_costs: { hoa: 0, property_tax: 0, unexpected: true },
        },
      })
    ).toBe(false);
  });

  it('rejects lists larger than the public API limit', () => {
    const errors = validateComparisonInput({
      ...valid,
      extra_income_events: Array.from({ length: 101 }, (_, index) => ({
        kind: 'bonus' as const,
        amount: 1,
        month: (index % 12) + 1,
        inflation_adjust: false,
      })),
    });
    expect(errors.extra_income_events).toContain('100');
  });
});
