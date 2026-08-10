import type {
  ComparisonInput,
  FGTSInput,
  InvestmentReturnInput,
  InvestmentTaxInput,
} from '../../api/types';
import {
  MAX_FINANCIAL_AMOUNT,
  MAX_MONTHLY_INTEREST_RATE,
} from '../../constants/limits';
import { money } from '../../utils/format';
import { clonePresetValue, type PresetInputValidator } from '../../utils/presets';

export function normalizeInvestmentReturnPeriods(
  value: readonly InvestmentReturnInput[]
): InvestmentReturnInput[] {
  const periods = value.map((item) => ({ ...item }));
  if (periods.length === 0) return periods;
  periods[0].start_month = 1;
  for (let index = 0; index < periods.length; index += 1) {
    const period = periods[index];
    period.start_month = Math.max(1, Math.trunc(Number(period.start_month) || 1));
    if (index === periods.length - 1) {
      period.end_month = null;
      continue;
    }
    const proposedEnd =
      period.end_month == null ? Number.NaN : Number(period.end_month);
    period.end_month = Number.isFinite(proposedEnd)
      ? Math.max(period.start_month, Math.trunc(proposedEnd))
      : period.start_month + 11;
    periods[index + 1].start_month = period.end_month + 1;
  }
  return periods;
}

const MAX_COMPARISON_LIST_ITEMS = 100;
const MAX_EXTRA_INCOME_LABEL_LENGTH = 80;

function provided(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[]
): boolean {
  const allowedKeys = new Set(allowed);
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function hasOnlyComparisonInputKeys(input: Record<string, unknown>): boolean {
  if (!hasOnlyKeys(input, [
    'property_value',
    'down_payment',
    'total_savings',
    'loan_term_years',
    'comparison_horizon_years',
    'annual_interest_rate',
    'monthly_interest_rate',
    'loan_type',
    'rent_value',
    'rent_percentage',
    'investment_returns',
    'monthly_plan',
    'extra_income_events',
    'additional_costs',
    'inflation_rate',
    'rent_inflation_rate',
    'property_appreciation_rate',
    'investment_tax',
    'fgts',
  ])) return false;

  if (
    !Array.isArray(input.investment_returns) ||
    !input.investment_returns.every(
      (item) => record(item) && hasOnlyKeys(item, ['start_month', 'end_month', 'annual_rate'])
    )
  ) return false;

  if (!record(input.additional_costs) || !hasOnlyKeys(input.additional_costs, [
    'itbi_percentage',
    'deed_percentage',
    'owner_monthly_costs',
    'renter_monthly_costs',
  ])) return false;
  for (const profile of [
    input.additional_costs.owner_monthly_costs,
    input.additional_costs.renter_monthly_costs,
  ]) {
    if (profile != null && (!record(profile) || !hasOnlyKeys(profile, ['hoa', 'property_tax', 'other']))) {
      return false;
    }
  }

  if (input.monthly_plan != null) {
    if (!record(input.monthly_plan) || !hasOnlyKeys(input.monthly_plan, [
      'net_income',
      'non_housing_expenses',
      'adjust_for_inflation',
      'wealth_allocation_percentage',
      'financed_purchase',
    ])) return false;
    const financedPurchase = input.monthly_plan.financed_purchase;
    if (
      financedPurchase != null &&
      (!record(financedPurchase) || !hasOnlyKeys(financedPurchase, [
        'amortization_percentage',
        'amortization_effect',
      ]))
    ) return false;
  }

  if (
    input.investment_tax != null &&
    (!record(input.investment_tax) || !hasOnlyKeys(input.investment_tax, [
      'enabled',
      'mode',
      'effective_tax_rate',
    ]))
  ) return false;

  if (input.fgts != null) {
    if (!record(input.fgts) || !hasOnlyKeys(input.fgts, [
      'initial_balance',
      'monthly_contribution',
      'annual_yield_rate',
      'use_at_purchase',
      'max_withdrawal_at_purchase',
      'financed_amortization',
    ])) return false;
    const policy = input.fgts.financed_amortization;
    if (
      policy != null &&
      (!record(policy) || !hasOnlyKeys(policy, [
        'enabled',
        'first_month',
        'interval_months',
        'amount_mode',
        'amount',
      ]))
    ) return false;
  }

  if (
    input.extra_income_events != null &&
    (!Array.isArray(input.extra_income_events) ||
      !input.extra_income_events.every(
        (event) => record(event) && hasOnlyKeys(event, [
          'kind',
          'label',
          'amount',
          'month',
          'interval_months',
          'end_month',
          'inflation_adjust',
        ])
      ))
  ) return false;

  return true;
}

function hasExplicitNull(
  value: Record<string, unknown>,
  ...keys: string[]
): boolean {
  return keys.some(
    (key) => Object.prototype.hasOwnProperty.call(value, key) && value[key] === null
  );
}

export const isComparisonPresetInput: PresetInputValidator<ComparisonInput> = (
  input: unknown
): input is ComparisonInput => {
  if (!record(input)) return false;
  if (!hasOnlyComparisonInputKeys(input)) return false;
  // A saved v4 scenario must carry its economic premise explicitly. The
  // normalizer has creation defaults, but using them during validation would
  // silently turn a corrupt/partial preset into an 8% scenario.
  if (
    !Array.isArray(input.investment_returns) ||
    input.investment_returns.length === 0
  ) {
    return false;
  }
  if (!record(input.additional_costs)) return false;
  const costs = input.additional_costs;
  const ownerCosts = record(costs.owner_monthly_costs)
    ? costs.owner_monthly_costs
    : null;
  const renterCosts = record(costs.renter_monthly_costs)
    ? costs.renter_monthly_costs
    : null;
  const plan = record(input.monthly_plan) ? input.monthly_plan : null;
  const financedPlan = record(plan?.financed_purchase)
    ? plan.financed_purchase
    : null;
  const tax = record(input.investment_tax) ? input.investment_tax : null;
  const fgts = record(input.fgts) ? input.fgts : null;
  const fgtsPolicy = record(fgts?.financed_amortization)
    ? fgts.financed_amortization
    : null;
  if (
    hasExplicitNull(costs, 'itbi_percentage', 'deed_percentage', 'owner_monthly_costs', 'renter_monthly_costs') ||
    (ownerCosts != null && hasExplicitNull(ownerCosts, 'hoa', 'property_tax', 'other')) ||
    (renterCosts != null && hasExplicitNull(renterCosts, 'hoa', 'property_tax', 'other')) ||
    (plan != null && hasExplicitNull(plan, 'adjust_for_inflation', 'wealth_allocation_percentage', 'financed_purchase')) ||
    (financedPlan != null && hasExplicitNull(financedPlan, 'amortization_percentage', 'amortization_effect')) ||
    (tax != null && hasExplicitNull(tax, 'enabled', 'mode', 'effective_tax_rate')) ||
    (fgts != null && hasExplicitNull(fgts, 'initial_balance', 'monthly_contribution', 'annual_yield_rate', 'use_at_purchase')) ||
    (fgtsPolicy != null && hasExplicitNull(fgtsPolicy, 'enabled', 'first_month', 'interval_months', 'amount_mode')) ||
    (Array.isArray(input.extra_income_events) &&
      input.extra_income_events.some(
        (event) => record(event) && hasExplicitNull(event, 'inflation_adjust')
      ))
  ) {
    return false;
  }
  if (
    !input.investment_returns.every(record) ||
    (input.additional_costs.owner_monthly_costs != null &&
      !record(input.additional_costs.owner_monthly_costs)) ||
    (input.additional_costs.renter_monthly_costs != null &&
      !record(input.additional_costs.renter_monthly_costs)) ||
    (input.monthly_plan != null && !record(input.monthly_plan)) ||
    (record(input.monthly_plan) &&
      input.monthly_plan.financed_purchase != null &&
      !record(input.monthly_plan.financed_purchase)) ||
    (input.investment_tax != null && !record(input.investment_tax)) ||
    (input.fgts != null && !record(input.fgts)) ||
    (record(input.fgts) &&
      input.fgts.financed_amortization != null &&
      !record(input.fgts.financed_amortization)) ||
    (input.extra_income_events != null &&
      (!Array.isArray(input.extra_income_events) ||
        !input.extra_income_events.every(record)))
  ) {
    return false;
  }
  try {
    const candidate = normalizeComparisonInput(input as unknown as ComparisonInput);
    return Object.keys(validateComparisonInput(candidate)).length === 0;
  } catch {
    return false;
  }
};

export function normalizeComparisonInput(input: ComparisonInput): ComparisonInput {
  const cloned = clonePresetValue(input);
  const costs = cloned.additional_costs ?? {};
  if (costs.monthly_hoa !== undefined || costs.monthly_property_tax !== undefined) {
    throw new Error('Este cenário usa um formato antigo de custos e precisa ser recriado.');
  }
  const ownerCosts = costs.owner_monthly_costs ?? {};
  const renterCosts = costs.renter_monthly_costs ?? {};
  const rawPlan = cloned.monthly_plan as
    | (Partial<NonNullable<ComparisonInput['monthly_plan']>> & {
        financed_purchase?: Partial<
          NonNullable<ComparisonInput['monthly_plan']>['financed_purchase']
        >;
      })
    | null
    | undefined;
  const normalizedPlan = rawPlan == null
    ? rawPlan
    : {
        ...rawPlan,
        adjust_for_inflation: rawPlan.adjust_for_inflation ?? true,
        wealth_allocation_percentage:
          rawPlan.wealth_allocation_percentage ?? 100,
        financed_purchase: {
          amortization_percentage:
            rawPlan.financed_purchase?.amortization_percentage ?? 0,
          amortization_effect:
            rawPlan.financed_purchase?.amortization_effect ?? 'reduce_term',
        },
      };
  const rawTax = cloned.investment_tax;
  const normalizedTax = rawTax == null
    ? rawTax
    : {
        ...rawTax,
        enabled: rawTax.enabled ?? false,
        mode: rawTax.mode ?? 'on_withdrawal',
        effective_tax_rate: rawTax.effective_tax_rate ?? 15,
      };
  const rawFgts = cloned.fgts;
  const rawFgtsPolicy = rawFgts?.financed_amortization;
  const normalizedFgts = rawFgts == null
    ? rawFgts
    : {
        ...rawFgts,
        initial_balance: rawFgts.initial_balance ?? 0,
        monthly_contribution: rawFgts.monthly_contribution ?? 0,
        annual_yield_rate: rawFgts.annual_yield_rate ?? 0,
        use_at_purchase: rawFgts.use_at_purchase ?? true,
        max_withdrawal_at_purchase:
          rawFgts.max_withdrawal_at_purchase ?? null,
        financed_amortization: rawFgtsPolicy == null
          ? rawFgtsPolicy
          : {
              ...rawFgtsPolicy,
              enabled: rawFgtsPolicy.enabled ?? false,
              first_month: rawFgtsPolicy.first_month ?? 24,
              interval_months: rawFgtsPolicy.interval_months ?? 24,
              amount_mode: rawFgtsPolicy.amount_mode ?? 'available_balance',
              amount: rawFgtsPolicy.amount ?? null,
            },
      };
  return {
    ...cloned,
    comparison_horizon_years:
      cloned.comparison_horizon_years ?? cloned.loan_term_years,
    additional_costs: {
      itbi_percentage: costs.itbi_percentage ?? 2,
      deed_percentage: costs.deed_percentage ?? 1,
      owner_monthly_costs: {
        hoa: ownerCosts.hoa ?? 0,
        property_tax: ownerCosts.property_tax ?? 0,
        other: ownerCosts.other ?? 0,
      },
      renter_monthly_costs: {
        hoa: renterCosts.hoa ?? 0,
        property_tax: renterCosts.property_tax ?? 0,
        other: renterCosts.other ?? 0,
      },
    },
    monthly_plan: normalizedPlan as ComparisonInput['monthly_plan'],
    investment_tax: normalizedTax,
    fgts: normalizedFgts,
    investment_returns: clonePresetValue(cloned.investment_returns ?? []),
    extra_income_events: clonePresetValue(cloned.extra_income_events ?? []).map(
      (event) => ({
        kind: event.kind,
        label: event.label,
        amount: event.amount,
        month: event.month,
        interval_months: event.interval_months,
        end_month: event.end_month,
        inflation_adjust: event.inflation_adjust ?? false,
      })
    ),
  };
}

function initialFinancedPrincipal(input: ComparisonInput): number {
  const purchaseNeed = Math.max(0, input.property_value - input.down_payment);
  const fgts = input.fgts;
  if (!fgts?.use_at_purchase) return purchaseNeed;
  const balance = Math.max(0, fgts.initial_balance ?? 0);
  const limit = fgts.max_withdrawal_at_purchase == null
    ? balance
    : Math.max(0, fgts.max_withdrawal_at_purchase);
  return Math.max(0, purchaseNeed - Math.min(purchaseNeed, balance, limit));
}

export function prepareComparisonInput(input: ComparisonInput): ComparisonInput {
  const cleaned = normalizeComparisonInput(input);
  const nullIfEmpty = (value: unknown) => (value === '' ? null : value);
  cleaned.annual_interest_rate = nullIfEmpty(cleaned.annual_interest_rate) as number | null;
  cleaned.monthly_interest_rate = nullIfEmpty(cleaned.monthly_interest_rate) as number | null;
  cleaned.rent_value = nullIfEmpty(cleaned.rent_value) as number | null;
  cleaned.rent_percentage = nullIfEmpty(cleaned.rent_percentage) as number | null;
  cleaned.inflation_rate = nullIfEmpty(cleaned.inflation_rate) as number | null;
  cleaned.rent_inflation_rate = nullIfEmpty(cleaned.rent_inflation_rate) as number | null;
  cleaned.property_appreciation_rate = nullIfEmpty(
    cleaned.property_appreciation_rate
  ) as number | null;
  if (provided(cleaned.monthly_interest_rate)) cleaned.annual_interest_rate = null;
  else if (provided(cleaned.annual_interest_rate)) cleaned.monthly_interest_rate = null;
  if (initialFinancedPrincipal(cleaned) <= 0) {
    cleaned.annual_interest_rate = null;
    cleaned.monthly_interest_rate = null;
  }
  if (provided(cleaned.rent_percentage)) cleaned.rent_value = null;
  else if (provided(cleaned.rent_value)) cleaned.rent_percentage = null;
  return clonePresetValue(cleaned);
}

export function validateComparisonInput(values: ComparisonInput): Record<string, string> {
  const errors: Record<string, string> = {};
  const range = (
    path: string,
    value: unknown,
    min: number,
    max: number,
    message: string,
    required = false
  ) => {
    if (!provided(value)) {
      if (required) errors[path] = message;
      return;
    }
    const parsed = finite(value);
    if (parsed == null || parsed < min || parsed > max) errors[path] = message;
  };

  range('property_value', values.property_value, 0.01, MAX_FINANCIAL_AMOUNT, 'Informe o preço do imóvel', true);
  range('down_payment', values.down_payment, 0, MAX_FINANCIAL_AMOUNT, 'Informe uma entrada válida', true);
  if (
    finite(values.down_payment) != null &&
    finite(values.property_value) != null &&
    values.down_payment > values.property_value
  ) {
    errors.down_payment = 'A entrada não pode superar o valor do imóvel';
  }
  range('total_savings', values.total_savings, 0, MAX_FINANCIAL_AMOUNT, 'Informe o dinheiro disponível');
  if (finite(values.total_savings) != null) {
    const upfront = values.property_value * (((values.additional_costs.itbi_percentage ?? 0) + (values.additional_costs.deed_percentage ?? 0)) / 100);
    const minimum = values.down_payment + upfront;
    if ((values.total_savings ?? 0) < minimum) {
      errors.total_savings = `Informe pelo menos ${money(minimum)} para cobrir entrada e custos`;
    }
  }

  const financed = initialFinancedPrincipal(values) > 0;
  if (
    (financed && values.loan_term_years == null) ||
    (values.loan_term_years != null &&
      (!Number.isInteger(values.loan_term_years) ||
        values.loan_term_years < 1 ||
        values.loan_term_years > 50))
  ) {
    errors.loan_term_years = 'O prazo deve ficar entre 1 e 50 anos';
  }
  if (
    values.comparison_horizon_years == null && values.loan_term_years == null
  ) {
    errors.comparison_horizon_years = 'Informe o horizonte da comparação';
  } else if (
    values.comparison_horizon_years != null &&
    (!Number.isInteger(values.comparison_horizon_years) ||
      values.comparison_horizon_years < 1 ||
      values.comparison_horizon_years > 50)
  ) {
    errors.comparison_horizon_years = 'O horizonte deve ficar entre 1 e 50 anos';
  }
  if (
    (financed && values.loan_type == null) ||
    (values.loan_type != null && !['SAC', 'PRICE'].includes(values.loan_type))
  ) {
    errors.loan_type = 'Escolha um sistema de financiamento';
  }

  const annual = provided(values.annual_interest_rate);
  const monthly = provided(values.monthly_interest_rate);
  if (financed && annual === monthly) {
    errors.annual_interest_rate = 'Informe uma única taxa de juros';
  } else if (!financed && annual && monthly) {
    errors.annual_interest_rate = 'Informe no máximo uma taxa de juros';
  }
  range('annual_interest_rate', values.annual_interest_rate, 0, 1000, 'A taxa anual deve ficar entre 0% e 1.000%');
  range('monthly_interest_rate', values.monthly_interest_rate, 0, MAX_MONTHLY_INTEREST_RATE, 'A taxa mensal deve ficar entre 0% e 100%');

  const rentAmount = provided(values.rent_value);
  const rentPercentage = provided(values.rent_percentage);
  if (rentAmount === rentPercentage) errors.rent_value = 'Informe uma única forma de aluguel';
  range('rent_value', values.rent_value, 0, MAX_FINANCIAL_AMOUNT, 'Informe um aluguel válido');
  range('rent_percentage', values.rent_percentage, 0, 100, 'O percentual deve ficar entre 0% e 100%');

  const plan = values.monthly_plan;
  if (!plan || !record(plan)) {
    errors.monthly_plan = 'Informe seu plano mensal';
  } else {
    range('monthly_plan.net_income', plan.net_income, 0, MAX_FINANCIAL_AMOUNT, 'Informe sua renda líquida', true);
    range('monthly_plan.non_housing_expenses', plan.non_housing_expenses, 0, MAX_FINANCIAL_AMOUNT, 'Informe seus gastos fora da moradia', true);
    range('monthly_plan.wealth_allocation_percentage', plan.wealth_allocation_percentage, 0, 100, 'Escolha entre 0% e 100%', true);
    range('monthly_plan.financed_purchase.amortization_percentage', plan.financed_purchase?.amortization_percentage, 0, 100, 'Escolha entre 0% e 100%', true);
    if (!['reduce_term', 'reduce_payment'].includes(plan.financed_purchase?.amortization_effect)) {
      errors['monthly_plan.financed_purchase.amortization_effect'] = 'Escolha como a amortização altera o contrato';
    }
    if (typeof plan.adjust_for_inflation !== 'boolean') {
      errors['monthly_plan.adjust_for_inflation'] = 'Escolha se renda e gastos acompanham a inflação';
    }
  }

  range('additional_costs.itbi_percentage', values.additional_costs.itbi_percentage, 0, 100, 'O ITBI deve ficar entre 0% e 100%');
  range('additional_costs.deed_percentage', values.additional_costs.deed_percentage, 0, 100, 'O registro deve ficar entre 0% e 100%');
  for (const [occupancy, costs] of [
    ['owner', values.additional_costs.owner_monthly_costs],
    ['renter', values.additional_costs.renter_monthly_costs],
  ] as const) {
    range(`additional_costs.${occupancy}_monthly_costs.hoa`, costs?.hoa, 0, MAX_FINANCIAL_AMOUNT, 'Informe um condomínio válido');
    range(`additional_costs.${occupancy}_monthly_costs.property_tax`, costs?.property_tax, 0, MAX_FINANCIAL_AMOUNT, 'Informe um IPTU válido');
    range(`additional_costs.${occupancy}_monthly_costs.other`, costs?.other, 0, MAX_FINANCIAL_AMOUNT, 'Informe outros custos de moradia válidos');
  }
  range('inflation_rate', values.inflation_rate, 0, 1000, 'A inflação deve ficar entre 0% e 1.000%');
  range('rent_inflation_rate', values.rent_inflation_rate, 0, 1000, 'O reajuste deve ficar entre 0% e 1.000%');
  range('property_appreciation_rate', values.property_appreciation_rate, 0, 1000, 'A valorização deve ficar entre 0% e 1.000%');

  if (!Array.isArray(values.investment_returns) || values.investment_returns.length === 0) {
    errors.investment_returns = 'Informe ao menos um período de retorno';
  } else if (values.investment_returns.length > MAX_COMPARISON_LIST_ITEMS) {
    errors.investment_returns = `Use no máximo ${MAX_COMPARISON_LIST_ITEMS} períodos de retorno`;
  } else {
    values.investment_returns.forEach((period, index) => {
      range(`investment_returns.${index}.annual_rate`, period.annual_rate, -99.999, 1000, 'O retorno deve ser maior que -100% e de até 1.000%', true);
      if (!Number.isInteger(period.start_month) || period.start_month < 1) {
        errors[`investment_returns.${index}.start_month`] = 'Informe um mês inicial inteiro';
      }
      if (index === 0 && period.start_month !== 1) {
        errors[`investment_returns.${index}.start_month`] = 'O primeiro período deve começar no mês 1';
      }
      if (index > 0) {
        const previousEnd = values.investment_returns[index - 1]?.end_month;
        if (previousEnd == null || period.start_month !== previousEnd + 1) {
          errors[`investment_returns.${index}.start_month`] =
            'O período deve começar no mês seguinte ao anterior';
        }
      }
      if (index < values.investment_returns.length - 1) {
        if (!Number.isInteger(period.end_month) || (period.end_month ?? 0) < period.start_month) {
          errors[`investment_returns.${index}.end_month`] =
            'Informe um mês final inteiro igual ou posterior ao início';
        }
      } else if (period.end_month != null) {
        errors[`investment_returns.${index}.end_month`] = 'O último período deve ficar aberto';
      }
    });
  }

  const horizon =
    (values.comparison_horizon_years ?? values.loan_term_years ?? 0) * 12;
  if (values.investment_tax != null) {
    if (!record(values.investment_tax)) {
      errors.investment_tax = 'Revise o imposto sobre investimentos';
    } else {
      const tax = values.investment_tax as InvestmentTaxInput;
      if (typeof tax.enabled !== 'boolean') {
        errors['investment_tax.enabled'] = 'Revise se a tributação está ativada';
      }
      if (!['monthly', 'on_withdrawal'].includes(tax.mode ?? '')) {
        errors['investment_tax.mode'] = 'Escolha quando o imposto é cobrado';
      }
      range(
        'investment_tax.effective_tax_rate',
        tax.effective_tax_rate,
        0,
        100,
        'A alíquota deve ficar entre 0% e 100%',
        true
      );
    }
  }

  if (values.fgts != null) {
    if (!record(values.fgts)) {
      errors.fgts = 'Revise os dados do FGTS';
    } else {
      const fgts = values.fgts as FGTSInput;
      if (typeof fgts.use_at_purchase !== 'boolean') {
        errors['fgts.use_at_purchase'] = 'Escolha se o FGTS será usado na compra';
      }
      range('fgts.initial_balance', fgts.initial_balance, 0, MAX_FINANCIAL_AMOUNT, 'Informe um saldo de FGTS válido', true);
      range('fgts.monthly_contribution', fgts.monthly_contribution, 0, MAX_FINANCIAL_AMOUNT, 'Informe um depósito mensal válido', true);
      range('fgts.annual_yield_rate', fgts.annual_yield_rate, 0, 100, 'O rendimento do FGTS deve ficar entre 0% e 100%', true);
      range('fgts.max_withdrawal_at_purchase', fgts.max_withdrawal_at_purchase, 0, MAX_FINANCIAL_AMOUNT, 'Informe um limite de saque válido');
      const policy = fgts.financed_amortization;
      if (policy != null) {
        if (typeof policy.enabled !== 'boolean') {
          errors['fgts.financed_amortization.enabled'] = 'Revise se a amortização com FGTS está ativada';
        }
        range('fgts.financed_amortization.first_month', policy.first_month, 1, 600, 'Informe um primeiro mês entre 1 e 600', true);
        range('fgts.financed_amortization.interval_months', policy.interval_months, 1, 600, 'Informe um intervalo entre 1 e 600 meses', true);
        if (!Number.isInteger(policy.first_month)) {
          errors['fgts.financed_amortization.first_month'] = 'Informe um primeiro mês inteiro';
        }
        if (!Number.isInteger(policy.interval_months)) {
          errors['fgts.financed_amortization.interval_months'] = 'Informe um intervalo inteiro';
        }
        if (!['available_balance', 'fixed'].includes(policy.amount_mode)) {
          errors['fgts.financed_amortization.amount_mode'] = 'Escolha como definir o valor da amortização';
        }
        range(
          'fgts.financed_amortization.amount',
          policy.amount,
          0,
          MAX_FINANCIAL_AMOUNT,
          'Informe um valor de amortização válido',
          policy.enabled && policy.amount_mode === 'fixed'
        );
      }
    }
  }

  const extraIncomeEvents = values.extra_income_events ?? [];
  if (!Array.isArray(extraIncomeEvents)) {
    errors.extra_income_events = 'Revise as rendas extras';
    return errors;
  }
  if (extraIncomeEvents.length > MAX_COMPARISON_LIST_ITEMS) {
    errors.extra_income_events = `Cadastre no máximo ${MAX_COMPARISON_LIST_ITEMS} rendas extras`;
  }
  extraIncomeEvents.forEach((event, index) => {
    const prefix = `extra_income_events.${index}`;
    if (!['thirteenth_salary', 'bonus', 'other'].includes(event.kind)) {
      errors[`${prefix}.kind`] = 'Escolha o tipo de renda extra';
    }
    if (typeof event.inflation_adjust !== 'boolean') {
      errors[`${prefix}.inflation_adjust`] = 'Escolha se o valor acompanha a inflação';
    }
    if (event.label != null && typeof event.label !== 'string') {
      errors[`${prefix}.label`] = 'Informe um nome em texto';
    } else if (event.label != null && event.label.length > MAX_EXTRA_INCOME_LABEL_LENGTH) {
      errors[`${prefix}.label`] = `Use no máximo ${MAX_EXTRA_INCOME_LABEL_LENGTH} caracteres`;
    }
    range(`${prefix}.amount`, event.amount, 0.01, MAX_FINANCIAL_AMOUNT, 'Informe um valor maior que zero', true);
    range(`${prefix}.month`, event.month, 1, horizon, `Informe um mês entre 1 e ${horizon}`, true);
    if (!Number.isInteger(event.month)) {
      errors[`${prefix}.month`] = 'Informe um primeiro mês inteiro';
    }
    if (event.interval_months != null) {
      range(`${prefix}.interval_months`, event.interval_months, 1, Math.min(horizon, 600), 'Informe uma recorrência válida');
      if (!Number.isInteger(event.interval_months)) {
        errors[`${prefix}.interval_months`] = 'Informe uma recorrência em meses inteiros';
      }
    }
    if (event.end_month != null) {
      range(`${prefix}.end_month`, event.end_month, 1, horizon, `Informe um término entre 1 e ${horizon}`);
      if (!Number.isInteger(event.end_month)) {
        errors[`${prefix}.end_month`] = 'Informe um mês de término inteiro';
      } else if (event.end_month < event.month) {
        errors[`${prefix}.end_month`] = 'O término deve ser igual ou posterior ao início';
      }
      if (event.interval_months == null) {
        errors[`${prefix}.interval_months`] = 'Informe a recorrência para usar um mês de término';
      }
    }
  });

  return errors;
}
