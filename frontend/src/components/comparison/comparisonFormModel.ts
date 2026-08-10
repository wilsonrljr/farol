import type {
  AdditionalCostsInput,
  ComparisonInput,
  ExtraIncomeEventInput,
  FGTSInput,
  InvestmentReturnInput,
  InvestmentTaxInput,
  LoanType,
} from '../../api/types';
import { clonePresetValue } from '../../utils/presets';
import {
  normalizeComparisonInput,
  prepareComparisonInput,
  validateComparisonInput,
} from './comparisonInput';

export type NumericFieldValue = number | string;
export type ValueMode = 'amount' | 'percentage';
export type InterestMode = 'annual' | 'monthly';

export interface ComparisonModules {
  housingCosts: boolean;
  fgts: boolean;
  variableReturns: boolean;
  investmentTax: boolean;
  extraIncome: boolean;
}

export interface ComparisonFormValues {
  property_value: NumericFieldValue;
  total_savings: NumericFieldValue;
  loan_term_years: NumericFieldValue;
  comparison_horizon_years: NumericFieldValue;
  loan_type: LoanType;
  monthly_plan: {
    net_income: NumericFieldValue;
    non_housing_expenses: NumericFieldValue;
    adjust_for_inflation: boolean;
    wealth_allocation_percentage: NumericFieldValue;
    financed_purchase: {
      amortization_percentage: NumericFieldValue;
      amortization_effect: 'reduce_term' | 'reduce_payment';
    };
  };
  additional_costs: AdditionalCostsInput;
  inflation_rate: NumericFieldValue;
  rent_inflation_rate: NumericFieldValue;
  property_appreciation_rate: NumericFieldValue;
  investment_returns: InvestmentReturnInput[];
  extra_income_events: ExtraIncomeEventInput[];
  investment_tax: InvestmentTaxInput;
  fgts: FGTSInput;
  ui: {
    rent_mode: ValueMode;
    rent_input: NumericFieldValue;
    down_payment_mode: ValueMode;
    down_payment_input: NumericFieldValue;
    interest_mode: InterestMode;
    interest_input: NumericFieldValue;
    base_investment_return: NumericFieldValue;
    modules: ComparisonModules;
  };
}

const DEFAULT_COSTS: AdditionalCostsInput = {
  itbi_percentage: 2,
  deed_percentage: 1,
  owner_monthly_costs: { hoa: 0, property_tax: 0, other: 0 },
  renter_monthly_costs: { hoa: 0, property_tax: 0, other: 0 },
};

const DEFAULT_FGTS: FGTSInput = {
  initial_balance: 0,
  monthly_contribution: 0,
  annual_yield_rate: 3,
  use_at_purchase: true,
  max_withdrawal_at_purchase: null,
  financed_amortization: null,
};

const DEFAULT_TAX: InvestmentTaxInput = {
  enabled: false,
  mode: 'on_withdrawal',
  effective_tax_rate: 15,
};

export const COMPARISON_EXAMPLE: ComparisonInput = {
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
    non_housing_expenses: 3_500,
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
  investment_tax: DEFAULT_TAX,
  fgts: DEFAULT_FGTS,
};

function numberOrNull(value: NumericFieldValue | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function roundTo(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function roundInterest(value: number): number {
  const rounded = roundTo(value, 10);
  const nearestInteger = Math.round(rounded);
  return Math.abs(rounded - nearestInteger) < 1e-8 ? nearestInteger : rounded;
}

export function hasNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasRecurringCosts(costs: AdditionalCostsInput): boolean {
  return [
    costs.owner_monthly_costs?.hoa,
    costs.owner_monthly_costs?.property_tax,
    costs.owner_monthly_costs?.other,
    costs.renter_monthly_costs?.hoa,
    costs.renter_monthly_costs?.property_tax,
    costs.renter_monthly_costs?.other,
  ].some((value) => (value ?? 0) > 0);
}

function hasFgts(fgts: FGTSInput | null | undefined): boolean {
  return Boolean(
    fgts &&
      ((fgts.initial_balance ?? 0) > 0 ||
        (fgts.monthly_contribution ?? 0) > 0 ||
        fgts.max_withdrawal_at_purchase != null ||
        fgts.financed_amortization?.enabled)
  );
}

export function createEmptyComparisonForm(): ComparisonFormValues {
  return {
    property_value: '',
    total_savings: '',
    loan_term_years: 30,
    comparison_horizon_years: 10,
    loan_type: 'PRICE',
    monthly_plan: {
      net_income: '',
      non_housing_expenses: '',
      adjust_for_inflation: true,
      wealth_allocation_percentage: 100,
      financed_purchase: {
        amortization_percentage: 0,
        amortization_effect: 'reduce_term',
      },
    },
    additional_costs: clonePresetValue(DEFAULT_COSTS),
    inflation_rate: 4,
    rent_inflation_rate: 5,
    property_appreciation_rate: 4,
    investment_returns: [{ start_month: 1, end_month: null, annual_rate: 8 }],
    extra_income_events: [],
    investment_tax: clonePresetValue(DEFAULT_TAX),
    fgts: clonePresetValue(DEFAULT_FGTS),
    ui: {
      rent_mode: 'amount',
      rent_input: '',
      down_payment_mode: 'amount',
      down_payment_input: '',
      interest_mode: 'annual',
      interest_input: '',
      base_investment_return: 8,
      modules: {
        housingCosts: false,
        fgts: false,
        variableReturns: false,
        investmentTax: false,
        extraIncome: false,
      },
    },
  };
}

export function comparisonInputToForm(input: ComparisonInput): ComparisonFormValues {
  const normalized = normalizeComparisonInput(input);
  const usesRentPercentage = hasNumber(normalized.rent_percentage);
  const usesMonthlyInterest = hasNumber(normalized.monthly_interest_rate);
  const returns = clonePresetValue(normalized.investment_returns);
  const costs = clonePresetValue(normalized.additional_costs);
  const fgts = {
    ...clonePresetValue(DEFAULT_FGTS),
    ...clonePresetValue(normalized.fgts ?? {}),
  };
  const tax = {
    ...clonePresetValue(DEFAULT_TAX),
    ...clonePresetValue(normalized.investment_tax ?? {}),
  };
  const plan = normalized.monthly_plan;

  return {
    property_value: normalized.property_value,
    total_savings: normalized.total_savings ?? '',
    loan_term_years:
      normalized.loan_term_years ?? normalized.comparison_horizon_years ?? 30,
    comparison_horizon_years:
      normalized.comparison_horizon_years ?? normalized.loan_term_years ?? 10,
    loan_type: normalized.loan_type ?? 'PRICE',
    monthly_plan: {
      net_income: plan?.net_income ?? '',
      non_housing_expenses: plan?.non_housing_expenses ?? '',
      adjust_for_inflation: plan?.adjust_for_inflation ?? true,
      wealth_allocation_percentage: plan?.wealth_allocation_percentage ?? 100,
      financed_purchase: {
        amortization_percentage:
          plan?.financed_purchase?.amortization_percentage ?? 0,
        amortization_effect:
          plan?.financed_purchase?.amortization_effect ?? 'reduce_term',
      },
    },
    additional_costs: costs,
    inflation_rate: normalized.inflation_rate ?? '',
    rent_inflation_rate: normalized.rent_inflation_rate ?? '',
    property_appreciation_rate: normalized.property_appreciation_rate ?? '',
    investment_returns: returns,
    extra_income_events: clonePresetValue(normalized.extra_income_events ?? []),
    investment_tax: tax,
    fgts,
    ui: {
      rent_mode: usesRentPercentage ? 'percentage' : 'amount',
      rent_input: usesRentPercentage
        ? normalized.rent_percentage ?? ''
        : normalized.rent_value ?? '',
      down_payment_mode: 'amount',
      down_payment_input: normalized.down_payment,
      interest_mode: usesMonthlyInterest ? 'monthly' : 'annual',
      interest_input: usesMonthlyInterest
        ? normalized.monthly_interest_rate ?? ''
        : normalized.annual_interest_rate ?? '',
      base_investment_return: returns[0]?.annual_rate ?? 8,
      modules: {
        housingCosts: hasRecurringCosts(costs),
        fgts: hasFgts(fgts),
        variableReturns: returns.length > 1,
        investmentTax: Boolean(tax.enabled),
        extraIncome: Boolean(normalized.extra_income_events?.length),
      },
    },
  };
}

export function comparisonFormToInput(values: ComparisonFormValues): ComparisonInput {
  const propertyValue = numberOrNull(values.property_value);
  const downPaymentInput = numberOrNull(values.ui.down_payment_input);
  const downPayment =
    values.ui.down_payment_mode === 'percentage' && propertyValue != null
      ? propertyValue * ((downPaymentInput ?? 0) / 100)
      : downPaymentInput;
  const rentInput = numberOrNull(values.ui.rent_input);
  const interestInput = numberOrNull(values.ui.interest_input);
  const modules = values.ui.modules;
  const ownerCosts = values.additional_costs.owner_monthly_costs;
  const renterCosts = values.additional_costs.renter_monthly_costs;
  const costs: AdditionalCostsInput = {
    itbi_percentage:
      optionalNumber(values.additional_costs.itbi_percentage) ?? 0,
    deed_percentage:
      optionalNumber(values.additional_costs.deed_percentage) ?? 0,
    owner_monthly_costs: modules.housingCosts
      ? {
          hoa: optionalNumber(ownerCosts?.hoa) ?? 0,
          property_tax: optionalNumber(ownerCosts?.property_tax) ?? 0,
          other: optionalNumber(ownerCosts?.other) ?? 0,
        }
      : { hoa: 0, property_tax: 0, other: 0 },
    renter_monthly_costs: modules.housingCosts
      ? {
          hoa: optionalNumber(renterCosts?.hoa) ?? 0,
          property_tax: optionalNumber(renterCosts?.property_tax) ?? 0,
          other: optionalNumber(renterCosts?.other) ?? 0,
        }
      : { hoa: 0, property_tax: 0, other: 0 },
  };
  const netIncome = numberOrNull(values.monthly_plan.net_income);
  const nonHousingExpenses = numberOrNull(values.monthly_plan.non_housing_expenses);
  const extraIncomeEvents = clonePresetValue(values.extra_income_events).map(
    (event) => ({
      ...event,
      label: event.label?.trim() || null,
      interval_months: optionalNumber(event.interval_months),
      end_month: optionalNumber(event.end_month),
    })
  );
  const fgts = clonePresetValue(values.fgts);
  fgts.max_withdrawal_at_purchase = optionalNumber(
    fgts.max_withdrawal_at_purchase
  );
  if (!fgts.use_at_purchase) {
    // A hidden limit must not survive as an invalid, no-effect backend field.
    fgts.max_withdrawal_at_purchase = null;
  }
  if (fgts.financed_amortization) {
    fgts.financed_amortization.amount = optionalNumber(
      fgts.financed_amortization.amount
    );
    if (fgts.financed_amortization.amount_mode !== 'fixed') {
      fgts.financed_amortization.amount = null;
    }
  }

  const prepared = prepareComparisonInput({
    property_value: propertyValue ?? 0,
    down_payment: downPayment ?? 0,
    total_savings: numberOrNull(values.total_savings),
    loan_term_years: numberOrNull(values.loan_term_years) ?? 0,
    comparison_horizon_years: numberOrNull(values.comparison_horizon_years),
    loan_type: values.loan_type,
    annual_interest_rate:
      values.ui.interest_mode === 'annual' ? interestInput : null,
    monthly_interest_rate:
      values.ui.interest_mode === 'monthly' ? interestInput : null,
    rent_value: values.ui.rent_mode === 'amount' ? rentInput : null,
    rent_percentage: values.ui.rent_mode === 'percentage' ? rentInput : null,
    investment_returns: modules.variableReturns
      ? clonePresetValue(values.investment_returns)
      : [
          {
            start_month: 1,
            end_month: null,
            annual_rate: numberOrNull(values.ui.base_investment_return) ?? 0,
          },
        ],
    monthly_plan:
      netIncome == null || nonHousingExpenses == null
        ? null
        : {
            net_income: netIncome,
            non_housing_expenses: nonHousingExpenses,
            adjust_for_inflation: values.monthly_plan.adjust_for_inflation,
            wealth_allocation_percentage:
              numberOrNull(values.monthly_plan.wealth_allocation_percentage) ?? 0,
            financed_purchase: {
              amortization_percentage:
                numberOrNull(
                  values.monthly_plan.financed_purchase.amortization_percentage
                ) ?? 0,
              amortization_effect:
                values.monthly_plan.financed_purchase.amortization_effect,
            },
          },
    extra_income_events: modules.extraIncome ? extraIncomeEvents : [],
    additional_costs: costs,
    inflation_rate: numberOrNull(values.inflation_rate),
    rent_inflation_rate: numberOrNull(values.rent_inflation_rate),
    property_appreciation_rate: numberOrNull(values.property_appreciation_rate),
    investment_tax: modules.investmentTax
      ? { ...clonePresetValue(values.investment_tax), enabled: true }
      : null,
    fgts: modules.fgts ? fgts : null,
  });
  if (
    prepared.fgts?.financed_amortization?.enabled &&
    initialFgtsAtPurchase(prepared) > 0
  ) {
    prepared.fgts.financed_amortization.first_month = Math.max(
      25,
      prepared.fgts.financed_amortization.first_month
    );
  }
  if (
    Math.max(
      0,
      prepared.property_value -
        prepared.down_payment -
        initialFgtsAtPurchase(prepared)
    ) === 0
  ) {
    prepared.annual_interest_rate = null;
    prepared.monthly_interest_rate = null;
    prepared.loan_term_years = null;
    prepared.loan_type = null;
    if (prepared.monthly_plan) {
      prepared.monthly_plan.financed_purchase = {
        amortization_percentage: 0,
        amortization_effect: 'reduce_term',
      };
    }
    if (prepared.fgts) prepared.fgts.financed_amortization = null;
  }
  return prepared;
}

const API_TO_FORM_PATHS: Array<[string, string]> = [
  ['annual_interest_rate', 'ui.interest_input'],
  ['monthly_interest_rate', 'ui.interest_input'],
  ['rent_value', 'ui.rent_input'],
  ['rent_percentage', 'ui.rent_input'],
  ['down_payment', 'ui.down_payment_input'],
  ['investment_returns.0.annual_rate', 'ui.base_investment_return'],
];

export function comparisonApiPathToForm(
  values: ComparisonFormValues,
  path: string
): string {
  if (values.ui.modules.variableReturns && path.startsWith('investment_returns.')) {
    return path;
  }
  return API_TO_FORM_PATHS.find(([apiPath]) => path === apiPath)?.[1] ?? path;
}

export function validateComparisonForm(
  values: ComparisonFormValues
): Record<string, string> {
  const ownerCosts = values.additional_costs.owner_monthly_costs;
  const renterCosts = values.additional_costs.renter_monthly_costs;
  const input = comparisonFormToInput(values);
  const financedAmount = Math.max(
    0,
    input.property_value - input.down_payment - initialFgtsAtPurchase(input)
  );
  const apiErrors = validateComparisonInput(input);
  const mappedErrors = Object.fromEntries(
    Object.entries(apiErrors).map(([path, message]) => {
      return [comparisonApiPathToForm(values, path), message];
    })
  );
  if (numberOrNull(values.ui.down_payment_input) == null) {
    mappedErrors['ui.down_payment_input'] = 'Informe a entrada em dinheiro';
  }
  if (!hasNumber(values.comparison_horizon_years)) {
    mappedErrors.comparison_horizon_years = 'Informe quando os patrimônios serão comparados';
  }
  if (values.total_savings !== '' && !hasNumber(values.total_savings)) {
    mappedErrors.total_savings = 'Informe um valor válido ou deixe em branco';
  }
  if (numberOrNull(values.monthly_plan.net_income) == null) {
    mappedErrors['monthly_plan.net_income'] = 'Informe sua renda líquida mensal';
  }
  if (numberOrNull(values.monthly_plan.non_housing_expenses) == null) {
    mappedErrors['monthly_plan.non_housing_expenses'] =
      'Informe os gastos fora da moradia; use zero se não houver';
  }
  // The aggregate API error has no focusable input. The two explicit errors
  // above tell the user exactly what is missing and let the wizard focus it.
  delete mappedErrors.monthly_plan;
  if (!hasNumber(values.monthly_plan.wealth_allocation_percentage)) {
    mappedErrors['monthly_plan.wealth_allocation_percentage'] =
      'Informe quanto da sobra constrói patrimônio';
  }
  if (
    financedAmount > 0 &&
    !hasNumber(values.monthly_plan.financed_purchase.amortization_percentage)
  ) {
    mappedErrors['monthly_plan.financed_purchase.amortization_percentage'] =
      'Informe quanto do plano será usado para amortizar';
  }
  if (!hasNumber(values.additional_costs.itbi_percentage)) {
    mappedErrors['additional_costs.itbi_percentage'] =
      'Informe o ITBI; use zero se não houver';
  }
  if (!hasNumber(values.additional_costs.deed_percentage)) {
    mappedErrors['additional_costs.deed_percentage'] =
      'Informe escritura e registro; use zero se não houver';
  }
  if (values.ui.modules.housingCosts) {
    const requiredHousingCosts: Array<[string, unknown, string]> = [
      ['additional_costs.owner_monthly_costs.hoa', ownerCosts?.hoa, 'condomínio do proprietário'],
      ['additional_costs.owner_monthly_costs.property_tax', ownerCosts?.property_tax, 'IPTU do proprietário'],
      ['additional_costs.owner_monthly_costs.other', ownerCosts?.other, 'outros custos do proprietário'],
      ['additional_costs.renter_monthly_costs.hoa', renterCosts?.hoa, 'condomínio do inquilino'],
      ['additional_costs.renter_monthly_costs.property_tax', renterCosts?.property_tax, 'IPTU do inquilino'],
      ['additional_costs.renter_monthly_costs.other', renterCosts?.other, 'outros custos do inquilino'],
    ];
    requiredHousingCosts.forEach(([path, value, label]) => {
      if (!hasNumber(value)) mappedErrors[path] = `Informe o ${label}; use zero se não houver`;
    });
  }
  if (
    !values.ui.modules.variableReturns &&
    numberOrNull(values.ui.base_investment_return) == null
  ) {
    mappedErrors['ui.base_investment_return'] = 'Informe o retorno anual esperado';
  }
  if (values.ui.modules.investmentTax) {
    if (!hasNumber(values.investment_tax.effective_tax_rate)) {
      mappedErrors['investment_tax.effective_tax_rate'] =
        'Informe a alíquota efetiva';
    }
  }
  if (values.ui.modules.fgts) {
    if (!hasNumber(values.fgts.initial_balance)) {
      mappedErrors['fgts.initial_balance'] = 'Informe o saldo; use zero se não houver';
    }
    if (!hasNumber(values.fgts.monthly_contribution)) {
      mappedErrors['fgts.monthly_contribution'] =
        'Informe o depósito mensal; use zero se não houver';
    }
    if (!hasNumber(values.fgts.annual_yield_rate)) {
      mappedErrors['fgts.annual_yield_rate'] = 'Informe o rendimento anual';
    }
  }
  return mappedErrors;
}

export function initialFgtsAtPurchase(input: ComparisonInput): number {
  const fgts = input.fgts;
  if (!fgts?.use_at_purchase) return 0;
  const balance = Math.max(0, fgts.initial_balance ?? 0);
  const purchaseNeed = Math.max(0, input.property_value - input.down_payment);
  const withdrawalLimit =
    fgts.max_withdrawal_at_purchase == null
      ? balance
      : Math.max(0, fgts.max_withdrawal_at_purchase);
  return Math.min(balance, purchaseNeed, withdrawalLimit);
}

export function initialFinancingPayment(input: ComparisonInput): number {
  const principal = Math.max(
    0,
    input.property_value - input.down_payment - initialFgtsAtPurchase(input)
  );
  if (principal === 0) return 0;
  const months = Math.max(1, (input.loan_term_years ?? 1) * 12);
  const monthlyRate =
    input.monthly_interest_rate != null
      ? input.monthly_interest_rate / 100
      : Math.pow(1 + (input.annual_interest_rate ?? 0) / 100, 1 / 12) - 1;
  if (!Number.isFinite(monthlyRate) || monthlyRate < 0) return 0;
  if (input.loan_type === 'SAC') {
    return principal / months + principal * monthlyRate;
  }
  if (monthlyRate === 0) return principal / months;
  const growth = Math.pow(1 + monthlyRate, months);
  return principal * ((monthlyRate * growth) / (growth - 1));
}

export function comparisonDerivedValues(values: ComparisonFormValues) {
  const input = comparisonFormToInput(values);
  const propertyValue = numberOrNull(values.property_value) ?? 0;
  const downPayment = input.down_payment ?? 0;
  const upfrontCosts =
    propertyValue *
    (((input.additional_costs.itbi_percentage ?? 0) +
      (input.additional_costs.deed_percentage ?? 0)) /
      100);
  const totalSavings = numberOrNull(values.total_savings);
  const rentAmount =
    input.rent_value ?? propertyValue * ((input.rent_percentage ?? 0) / 100);
  const fgtsAtPurchase = initialFgtsAtPurchase(input);

  return {
    input,
    propertyValue,
    downPayment,
    upfrontCosts,
    minimumResources: downPayment + upfrontCosts,
    remainingResources:
      totalSavings == null ? null : totalSavings - downPayment - upfrontCosts,
    rentAmount,
    fgtsAtPurchase,
    financedAmount: Math.max(0, propertyValue - downPayment - fgtsAtPurchase),
    initialPayment: initialFinancingPayment(input),
    resourcesMissing: totalSavings == null || input.monthly_plan == null,
  };
}

export function convertAmountMode(
  value: NumericFieldValue,
  from: ValueMode,
  to: ValueMode,
  referenceAmount: number
): NumericFieldValue {
  const numeric = numberOrNull(value);
  if (numeric == null || from === to) return value;
  if (referenceAmount <= 0) return '';
  return to === 'percentage'
    ? roundTo((numeric / referenceAmount) * 100, 6)
    : roundTo(referenceAmount * (numeric / 100), 2);
}

export function convertInterestMode(
  value: NumericFieldValue,
  from: InterestMode,
  to: InterestMode
): NumericFieldValue {
  const numeric = numberOrNull(value);
  if (numeric == null || from === to) return value;
  if (to === 'monthly') {
    return roundInterest((Math.pow(1 + numeric / 100, 1 / 12) - 1) * 100);
  }
  return roundInterest((Math.pow(1 + numeric / 100, 12) - 1) * 100);
}

export function comparisonReadiness(values: ComparisonFormValues) {
  const derived = comparisonDerivedValues(values);
  if (derived.resourcesMissing) {
    return {
      status: 'exploratory' as const,
      message:
        'Faltam recursos iniciais e/ou o plano mensal. As trajetórias não terão ranking autoritativo.',
    };
  }
  return {
    status: 'comparable' as const,
    message:
      'A mesma regra percentual será aplicada à sobra das três estratégias.',
  };
}
