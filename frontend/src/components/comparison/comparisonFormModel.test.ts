import { describe, expect, it } from 'vitest';
import {
  COMPARISON_EXAMPLE,
  comparisonDerivedValues,
  comparisonFormToInput,
  comparisonInputToForm,
  initialFinancingPayment,
  initialFgtsAtPurchase,
  comparisonReadiness,
  convertAmountMode,
  convertInterestMode,
  createEmptyComparisonForm,
  validateComparisonForm,
} from './comparisonFormModel';

describe('comparison form monthly plan', () => {
  it('starts with visible neutral allocation defaults', () => {
    const form = createEmptyComparisonForm();
    expect(form.monthly_plan.wealth_allocation_percentage).toBe(100);
    expect(form.monthly_plan.financed_purchase.amortization_percentage).toBe(0);
    expect(form.monthly_plan.financed_purchase.amortization_effect).toBe('reduce_term');
  });

  it('round-trips the new contract without legacy fields', () => {
    const input = comparisonFormToInput(comparisonInputToForm(COMPARISON_EXAMPLE));
    expect(input.monthly_plan).toEqual(COMPARISON_EXAMPLE.monthly_plan);
    expect(input.extra_income_events).toEqual([]);
    expect('monthly_net_income' in input).toBe(false);
    expect('contributions' in input).toBe(false);
  });

  it('requires salary and an explicit aggregate for other expenses', () => {
    const errors = validateComparisonForm(createEmptyComparisonForm());
    expect(errors['monthly_plan.net_income']).toBeTruthy();
    expect(errors['monthly_plan.non_housing_expenses']).toBeTruthy();
  });

  it('accepts explicit zero non-housing expenses', () => {
    const form = comparisonInputToForm(COMPARISON_EXAMPLE);
    form.monthly_plan.non_housing_expenses = 0;
    expect(validateComparisonForm(form)['monthly_plan.non_housing_expenses']).toBeUndefined();
  });

  it('keeps comparison horizon independent from financing term', () => {
    const form = comparisonInputToForm(COMPARISON_EXAMPLE);
    form.loan_term_years = 30;
    form.comparison_horizon_years = 8;
    const input = comparisonFormToInput(form);
    expect(input.loan_term_years).toBe(30);
    expect(input.comparison_horizon_years).toBe(8);
  });

  it('preserves semantic conversions instead of reinterpreting numbers', () => {
    expect(convertAmountMode(100_000, 'amount', 'percentage', 500_000)).toBe(20);
    expect(convertAmountMode(20, 'percentage', 'amount', 500_000)).toBe(100_000);
    const monthly = convertInterestMode(12, 'annual', 'monthly');
    expect(typeof monthly).toBe('number');
    expect(monthly).toBeLessThan(1);
    expect(convertInterestMode(monthly, 'monthly', 'annual')).toBeCloseTo(12, 8);
    expect(convertAmountMode(0, 'amount', 'percentage', 500_000)).toBe(0);
  });

  it('marks a complete example as comparable', () => {
    const readiness = comparisonReadiness(comparisonInputToForm(COMPARISON_EXAMPLE));
    expect(readiness.status).toBe('comparable');
  });

  it('derives the correct initial rent and purchase resources', () => {
    const derived = comparisonDerivedValues(comparisonInputToForm(COMPARISON_EXAMPLE));
    expect(derived.rentAmount).toBe(2_500);
    expect(derived.minimumResources).toBe(115_000);
    expect(derived.remainingResources).toBe(35_000);
  });

  it('includes FGTS used at purchase in the first-payment preview', () => {
    const input = {
      ...COMPARISON_EXAMPLE,
      fgts: {
        initial_balance: 60_000,
        monthly_contribution: 0,
        annual_yield_rate: 3,
        use_at_purchase: true,
        max_withdrawal_at_purchase: 40_000,
        financed_amortization: null,
      },
    };
    const withoutFgts = initialFinancingPayment({ ...input, fgts: null });

    expect(initialFgtsAtPurchase(input)).toBe(40_000);
    expect(initialFinancingPayment(input)).toBeLessThan(withoutFgts);
    expect(comparisonDerivedValues(comparisonInputToForm(input)).financedAmount).toBe(
      360_000
    );
  });

  it('does not promise an FGTS amortization before the post-purchase cooldown', () => {
    const form = comparisonInputToForm({
      ...COMPARISON_EXAMPLE,
      fgts: {
        initial_balance: 40_000,
        use_at_purchase: true,
        financed_amortization: {
          enabled: true,
          first_month: 24,
          interval_months: 24,
          amount_mode: 'available_balance',
          amount: null,
        },
      },
    });
    form.ui.modules.fgts = true;

    expect(
      comparisonFormToInput(form).fgts?.financed_amortization?.first_month
    ).toBe(25);
  });

  it('normalizes cleared optional nested numbers to null before the API', () => {
    const form = comparisonInputToForm(COMPARISON_EXAMPLE);
    form.ui.modules.fgts = true;
    form.ui.modules.extraIncome = true;
    form.fgts.max_withdrawal_at_purchase = '' as unknown as number;
    form.extra_income_events = [
      {
        kind: 'bonus',
        amount: 1_000,
        month: 2,
        interval_months: '' as unknown as number,
        end_month: '' as unknown as number,
        inflation_adjust: false,
      },
    ];

    const input = comparisonFormToInput(form);
    expect(input.fgts?.max_withdrawal_at_purchase).toBeNull();
    expect(input.extra_income_events?.[0].interval_months).toBeNull();
    expect(input.extra_income_events?.[0].end_month).toBeNull();
  });

  it('keeps the backend FGTS yield default instead of introducing a 3% premise', () => {
    const form = comparisonInputToForm({ ...COMPARISON_EXAMPLE, fgts: {} });
    expect(form.fgts.annual_yield_rate).toBe(0);
    form.ui.modules.fgts = true;
    expect(comparisonFormToInput(form).fgts?.annual_yield_rate).toBe(0);
  });

  it('drops the hidden purchase-withdrawal limit when FGTS use at purchase is off', () => {
    const form = comparisonInputToForm(COMPARISON_EXAMPLE);
    form.ui.modules.fgts = true;
    form.fgts.use_at_purchase = false;
    form.fgts.max_withdrawal_at_purchase = -1;

    expect(comparisonFormToInput(form).fgts?.max_withdrawal_at_purchase).toBeNull();
    expect(validateComparisonForm(form)['fgts.max_withdrawal_at_purchase']).toBeUndefined();
  });

  it('drops a hidden fixed FGTS amount after switching to available balance', () => {
    const form = comparisonInputToForm(COMPARISON_EXAMPLE);
    form.ui.modules.fgts = true;
    form.fgts.financed_amortization = {
      enabled: true,
      first_month: 24,
      interval_months: 24,
      amount_mode: 'available_balance',
      amount: -1,
    };

    expect(
      comparisonFormToInput(form).fgts?.financed_amortization?.amount
    ).toBeNull();
    expect(
      validateComparisonForm(form)['fgts.financed_amortization.amount']
    ).toBeUndefined();
  });

  it('returns focusable monthly field errors instead of an aggregate path', () => {
    const errors = validateComparisonForm(createEmptyComparisonForm());
    expect(errors.monthly_plan).toBeUndefined();
    expect(Object.keys(errors)).toContain('monthly_plan.net_income');
  });

  it('does not silently reinterpret cleared visible fields as zero or defaults', () => {
    const form = comparisonInputToForm(COMPARISON_EXAMPLE);
    form.monthly_plan.wealth_allocation_percentage = '';
    form.monthly_plan.financed_purchase.amortization_percentage = '';
    form.additional_costs.itbi_percentage = '' as unknown as number;
    form.comparison_horizon_years = '';
    form.ui.base_investment_return = '';

    const errors = validateComparisonForm(form);
    expect(errors['monthly_plan.wealth_allocation_percentage']).toBeTruthy();
    expect(
      errors['monthly_plan.financed_purchase.amortization_percentage']
    ).toBeTruthy();
    expect(errors['additional_costs.itbi_percentage']).toBeTruthy();
    expect(errors.comparison_horizon_years).toBeTruthy();
    expect(errors['ui.base_investment_return']).toBeTruthy();
  });

  it('round-trips null economic assumptions without inventing rates', () => {
    const input = {
      ...COMPARISON_EXAMPLE,
      inflation_rate: null,
      rent_inflation_rate: null,
      property_appreciation_rate: null,
    };
    const form = comparisonInputToForm(input);

    expect(form.inflation_rate).toBe('');
    expect(validateComparisonForm(form).inflation_rate).toBeUndefined();
    expect(comparisonFormToInput(form)).toMatchObject({
      inflation_rate: null,
      rent_inflation_rate: null,
      property_appreciation_rate: null,
    });
  });

  it('materializes optional monthly-plan defaults for editing', () => {
    const form = comparisonInputToForm({
      ...COMPARISON_EXAMPLE,
      monthly_plan: {
        net_income: 10_000,
        non_housing_expenses: 3_000,
      } as typeof COMPARISON_EXAMPLE.monthly_plan,
    });

    expect(form.monthly_plan.adjust_for_inflation).toBe(true);
    expect(form.monthly_plan.wealth_allocation_percentage).toBe(100);
    expect(form.monthly_plan.financed_purchase).toEqual({
      amortization_percentage: 0,
      amortization_effect: 'reduce_term',
    });
  });

  it('emits a financing-free payload and invests all eligible allocation for an outright purchase', () => {
    const form = comparisonInputToForm(COMPARISON_EXAMPLE);
    form.ui.down_payment_input = form.property_value;
    form.ui.interest_input = '';
    form.monthly_plan.financed_purchase.amortization_percentage = '';

    expect(validateComparisonForm(form)['ui.interest_input']).toBeUndefined();
    expect(
      validateComparisonForm(form)[
        'monthly_plan.financed_purchase.amortization_percentage'
      ]
    ).toBeUndefined();
    const input = comparisonFormToInput(form);
    expect(input.loan_term_years).toBeNull();
    expect(input.loan_type).toBeNull();
    expect(input.annual_interest_rate).toBeNull();
    expect(input.monthly_interest_rate).toBeNull();
    expect(input.monthly_plan?.financed_purchase.amortization_percentage).toBe(0);
  });

  it('keeps housing costs out of the payload while the module is disabled and preserves other when enabled', () => {
    const form = comparisonInputToForm(COMPARISON_EXAMPLE);
    form.additional_costs.owner_monthly_costs = {
      hoa: 600,
      property_tax: 250,
      other: 175,
    };
    form.additional_costs.renter_monthly_costs = {
      hoa: 500,
      property_tax: 0,
      other: 80,
    };
    form.ui.modules.housingCosts = false;
    expect(comparisonFormToInput(form).additional_costs.owner_monthly_costs).toEqual({
      hoa: 0,
      property_tax: 0,
      other: 0,
    });

    form.ui.modules.housingCosts = true;
    expect(comparisonFormToInput(form).additional_costs).toMatchObject({
      owner_monthly_costs: { other: 175 },
      renter_monthly_costs: { other: 80 },
    });
  });
});
