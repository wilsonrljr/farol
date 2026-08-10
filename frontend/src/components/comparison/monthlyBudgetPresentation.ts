import type {
  ExtraIncomeEventInput,
  MonthlyPlanInput,
  MonthlyRecord,
} from '../../api/types';

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export interface MonthlyBudgetSnapshot {
  availableIncome: number;
  mandatoryCosts: number;
  surplus: number;
  deficit: number;
  wealthAllocation: number;
  investmentAllocation: number;
  amortizationAllocation: number;
  outsidePlan: number;
}

/** Mirrors the backend allocation equation for previews before simulation. */
export function calculateMonthlyBudgetSnapshot(
  plan: MonthlyPlanInput,
  housingDue: number,
  options: {
    extraIncome?: number;
    financed?: boolean;
    maxAmortization?: number;
  } = {}
): MonthlyBudgetSnapshot {
  const availableIncome = Math.max(
    0,
    plan.net_income + (options.extraIncome ?? 0)
  );
  const mandatoryCosts =
    Math.max(0, plan.non_housing_expenses) + Math.max(0, housingDue);
  const surplus = Math.max(0, availableIncome - mandatoryCosts);
  const deficit = Math.max(0, mandatoryCosts - availableIncome);
  const wealthAllocation =
    surplus * (plan.wealth_allocation_percentage / 100);
  const requestedAmortization = options.financed
    ? wealthAllocation *
      (plan.financed_purchase.amortization_percentage / 100)
    : 0;
  const maxAmortization = finite(options.maxAmortization)
    ? Math.max(0, options.maxAmortization)
    : wealthAllocation;
  const amortizationAllocation = Math.max(
    0,
    Math.min(wealthAllocation, requestedAmortization, maxAmortization)
  );

  return {
    availableIncome,
    mandatoryCosts,
    surplus,
    deficit,
    wealthAllocation,
    investmentAllocation: Math.max(
      0,
      wealthAllocation - amortizationAllocation
    ),
    amortizationAllocation,
    outsidePlan: Math.max(0, surplus - wealthAllocation),
  };
}

export function extraIncomeInFirstMonth(
  events: readonly ExtraIncomeEventInput[] | null | undefined
): number {
  return (events ?? []).reduce(
    (total, event) =>
      event.month === 1 && finite(event.amount)
        ? total + Math.max(0, event.amount)
        : total,
    0
  );
}

export interface EffectiveMonthlyBudget {
  effectiveIncome: number | null;
  surplus: number | null;
}

/**
 * Reads the backend-calculated budget whenever available. The effective income
 * includes extraordinary income because disposable surplus does too.
 */
export function effectiveMonthlyBudget(
  record: Partial<MonthlyRecord> | null | undefined,
  housingDue: number,
  fallbackNetIncome: number | null
): EffectiveMonthlyBudget {
  const baseIncome = finite(record?.effective_net_income)
    ? record.effective_net_income
    : finite(record?.effective_income)
      ? record.effective_income
      : fallbackNetIncome;
  const effectiveIncome =
    baseIncome == null
      ? null
      : baseIncome + (finite(record?.extra_income) ? record.extra_income : 0);

  if (effectiveIncome == null) {
    return { effectiveIncome: null, surplus: null };
  }
  if (finite(record?.disposable_surplus) || finite(record?.budget_deficit)) {
    return {
      effectiveIncome,
      surplus:
        (finite(record?.disposable_surplus) ? record.disposable_surplus : 0) -
        (finite(record?.budget_deficit) ? record.budget_deficit : 0),
    };
  }

  return {
    effectiveIncome,
    surplus:
      effectiveIncome -
      (finite(record?.effective_non_housing_expenses)
        ? record.effective_non_housing_expenses
        : 0) -
      housingDue,
  };
}
