import { describe, expect, it } from 'vitest';
import type { MonthlyPlanInput } from '../../api/types';
import {
  calculateMonthlyBudgetSnapshot,
  effectiveMonthlyBudget,
  extraIncomeInFirstMonth,
} from './monthlyBudgetPresentation';

const plan: MonthlyPlanInput = {
  net_income: 10_000,
  non_housing_expenses: 3_000,
  adjust_for_inflation: true,
  wealth_allocation_percentage: 80,
  financed_purchase: {
    amortization_percentage: 25,
    amortization_effect: 'reduce_term',
  },
};

describe('monthly budget presentation', () => {
  it('mirrors the canonical split for a financed purchase', () => {
    expect(
      calculateMonthlyBudgetSnapshot(plan, 4_000, {
        financed: true,
        extraIncome: 1_000,
      })
    ).toEqual({
      availableIncome: 11_000,
      mandatoryCosts: 7_000,
      surplus: 4_000,
      deficit: 0,
      wealthAllocation: 3_200,
      investmentAllocation: 2_400,
      amortizationAllocation: 800,
      outsidePlan: 800,
    });
  });

  it('never builds wealth from a mandatory deficit', () => {
    expect(calculateMonthlyBudgetSnapshot(plan, 9_000, { financed: true })).toMatchObject({
      surplus: 0,
      deficit: 2_000,
      wealthAllocation: 0,
      investmentAllocation: 0,
      amortizationAllocation: 0,
      outsidePlan: 0,
    });
  });

  it('moves an amortization request above the loan balance back to investment', () => {
    const highAllocationPlan = {
      ...plan,
      wealth_allocation_percentage: 100,
      financed_purchase: {
        ...plan.financed_purchase,
        amortization_percentage: 100,
      },
    };
    expect(
      calculateMonthlyBudgetSnapshot(highAllocationPlan, 1_000, {
        financed: true,
        maxAmortization: 500,
      })
    ).toMatchObject({
      wealthAllocation: 6_000,
      amortizationAllocation: 500,
      investmentAllocation: 5_500,
    });
  });

  it('uses backend surplus and includes extraordinary income in the displayed income', () => {
    expect(
      effectiveMonthlyBudget(
        {
          effective_net_income: 10_000,
          extra_income: 2_000,
          disposable_surplus: 3_500,
          budget_deficit: 0,
          effective_non_housing_expenses: 3_000,
        },
        5_500,
        9_000
      )
    ).toEqual({ effectiveIncome: 12_000, surplus: 3_500 });
  });

  it('reports deficits as a negative monthly surplus', () => {
    expect(
      effectiveMonthlyBudget(
        { effective_income: 1_000, disposable_surplus: 0, budget_deficit: 250 },
        800,
        null
      )
    ).toEqual({ effectiveIncome: 1_000, surplus: -250 });
  });

  it('counts only income events that occur in month one', () => {
    expect(
      extraIncomeInFirstMonth([
        { kind: 'bonus', amount: 500, month: 1, inflation_adjust: false },
        { kind: 'bonus', amount: 900, month: 2, inflation_adjust: false },
      ])
    ).toBe(500);
  });
});
