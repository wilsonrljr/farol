import { lazy, Suspense, useEffect, useState, useRef } from "react";
import {
  Accordion,
  Badge,
  Button,
  NumberInput,
  Select,
  Paper,
  Stack,
  Group,
  Checkbox,
  Text,
  Box,
  ThemeIcon,
  Tooltip,
  SimpleGrid,
  Divider,
  Tabs,
  Grid,
  Alert,
  Loader,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { api, isRequestCancelled, toApiError } from "../api/client";
import { ComparisonInput, EnhancedComparisonResult, BatchComparisonResult, BatchComparisonItem } from "../api/types";
import { useApi } from "../hooks/useApi";
import { usePresets } from "../hooks/usePresets";
import AmortizationsFieldArray from "./AmortizationsFieldArray";
import InvestmentReturnsFieldArray, {
  normalizeInvestmentReturnPeriods,
} from "./InvestmentReturnsFieldArray";
import { PresetManager } from "./PresetManager";
import { PresetCompareSelector } from "./PresetCompareSelector";
import { notifications } from "@mantine/notifications";
import {
  IconBuildingBank,
  IconChartLine,
  IconHome2,
  IconPercentage,
  IconCash,
  IconSettings,
  IconPigMoney,
  IconReceipt,
  IconScale,
  IconArrowRight,
  IconWallet,
  IconAdjustments,
  IconInfoCircle,
} from "@tabler/icons-react";
import { LabelWithHelp } from "./LabelWithHelp";
import { FormSection, FormWizard } from "./ui/FormWizard";
import { money } from "../utils/format";
import {
  MAX_EXPANDED_SCHEDULE_EVENTS,
  MAX_FINANCIAL_AMOUNT,
  MAX_MONTHLY_INTEREST_RATE,
  MAX_MONTHLY_PERCENTAGE_CONTRIBUTION,
  MAX_SCHEDULE_OCCURRENCES,
} from '../constants/limits';
import {
  clonePresetValue,
  Preset,
  PresetInputValidator,
} from "../utils/presets";

const PRESETS_STORAGE_KEY = 'farol-comparison-presets';

const DEFAULT_INVESTMENT_RETURNS = [{ start_month: 1, end_month: null, annual_rate: 8 }];
const DEFAULT_INVESTMENT_TAX = {
  enabled: false,
  mode: "on_withdrawal" as const,
  effective_tax_rate: 15,
};
const DEFAULT_FGTS = {
  initial_balance: 0,
  monthly_contribution: 0,
  annual_yield_rate: 0,
  use_at_purchase: true,
  max_withdrawal_at_purchase: null,
};

type ViewMode = 'form' | 'single-result' | 'batch-result';

const EnhancedComparisonResults = lazy(() => import('./EnhancedComparisonResults'));
const BatchComparisonResults = lazy(() => import('./BatchComparisonResults'));

function ResultsFallback({ label }: { label: string }) {
  return (
    <Paper withBorder p="xl" role="status" aria-live="polite">
      <Group justify="center" gap="sm">
        <Loader size="sm" color="ocean" aria-hidden="true" />
        <Text size="sm" c="dimmed">
          {label}
        </Text>
      </Group>
    </Paper>
  );
}

const FIELD_STEP_PREFIXES: Array<[string, number]> = [
  ['monthly_net_income', 0],
  ['monthly_net_income_adjust_inflation', 0],
  ['total_savings', 0],
  ['fgts.annual_yield_rate', 3],
  ['fgts.max_withdrawal_at_purchase', 3],
  ['fgts', 0],
  ['property_value', 1],
  ['down_payment', 1],
  ['loan_term_years', 1],
  ['annual_interest_rate', 1],
  ['monthly_interest_rate', 1],
  ['loan_type', 1],
  ['additional_costs', 3],
  ['rent_value', 2],
  ['rent_percentage', 2],
  ['investment_returns', 2],
  ['contributions', 2],
  ['continue_contributions_after_purchase', 2],
  ['investment_tax', 2],
  ['inflation_rate', 3],
  ['rent_inflation_rate', 3],
  ['property_appreciation_rate', 3],
  ['amortizations', 3],
];

function isProvided(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}

function asFiniteNumber(value: unknown): number | null {
  if (!isProvided(value)) return null;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function fieldStep(path: string): number {
  return FIELD_STEP_PREFIXES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}.`))?.[1] ?? 0;
}

type ScheduleInput = NonNullable<ComparisonInput['amortizations']>[number];

function relevantScheduleMonths(schedule: ScheduleInput | unknown, termMonths: number): number[] {
  if (!isRecord(schedule) || !Number.isInteger(termMonths) || termMonths < 1) return [];
  const item = schedule as unknown as ScheduleInput;
  const interval = asFiniteNumber(item.interval_months);
  const explicitMonth = asFiniteNumber(item.month);
  if (interval === null || interval < 1) {
    return explicitMonth !== null && Number.isInteger(explicitMonth) && explicitMonth >= 1 && explicitMonth <= termMonths
      ? [explicitMonth]
      : [];
  }
  if (!Number.isInteger(interval)) return [];

  const start = explicitMonth ?? 1;
  if (!Number.isInteger(start) || start < 1 || start > termMonths) return [];
  const maxByHorizon = Math.floor((termMonths - start) / interval) + 1;
  const occurrences = asFiniteNumber(item.occurrences);
  const endMonth = asFiniteNumber(item.end_month);
  if (occurrences !== null && (!Number.isInteger(occurrences) || occurrences < 1)) return [];
  if (endMonth !== null && (!Number.isInteger(endMonth) || endMonth < start)) return [];
  const count = occurrences !== null
    ? Math.min(Math.max(0, Math.floor(occurrences)), maxByHorizon)
    : Math.min(
        maxByHorizon,
        Math.floor(((endMonth ?? termMonths) - start) / interval) + 1
      );

  return Array.from({ length: Math.max(0, count) }, (_, index) => start + index * interval);
}

export const isComparisonPresetInput: PresetInputValidator<ComparisonInput> = (
  input: unknown
): input is ComparisonInput => {
  if (!input || typeof input !== 'object') return false;
  const candidate = input as Partial<ComparisonInput>;
  const hasRequiredShape =
    typeof candidate.property_value === 'number' && Number.isFinite(candidate.property_value) &&
    typeof candidate.down_payment === 'number' && Number.isFinite(candidate.down_payment) &&
    typeof candidate.loan_term_years === 'number' && Number.isFinite(candidate.loan_term_years) &&
    (candidate.loan_type === 'PRICE' || candidate.loan_type === 'SAC') &&
    (candidate.investment_returns === undefined || Array.isArray(candidate.investment_returns));
  if (!hasRequiredShape) return false;

  try {
    return Object.keys(validateComparisonInput(normalizeComparisonInput(candidate as ComparisonInput)))
      .length === 0;
  } catch {
    return false;
  }
};

export function normalizeComparisonInput(input: ComparisonInput): ComparisonInput {
  const cloned = clonePresetValue(input);
  return {
    ...cloned,
    additional_costs: cloned.additional_costs ?? {
      itbi_percentage: 2,
      deed_percentage: 1,
      monthly_hoa: 0,
      monthly_property_tax: 0,
    },
    amortizations: clonePresetValue(cloned.amortizations ?? []),
    contributions: clonePresetValue(cloned.contributions ?? []),
    investment_returns: normalizeInvestmentReturnPeriods(
      cloned.investment_returns?.length
        ? cloned.investment_returns
        : clonePresetValue(DEFAULT_INVESTMENT_RETURNS)
    ),
    investment_tax: clonePresetValue(cloned.investment_tax ?? DEFAULT_INVESTMENT_TAX),
    fgts: clonePresetValue(cloned.fgts ?? DEFAULT_FGTS),
  };
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
  cleaned.monthly_net_income = nullIfEmpty(cleaned.monthly_net_income) as number | null;

  if (cleaned.monthly_net_income == null) {
    cleaned.monthly_net_income_adjust_inflation = false;
  }

  // A zero rate/value is explicit and valid; only absence loses precedence.
  if (isProvided(cleaned.monthly_interest_rate)) cleaned.annual_interest_rate = null;
  else if (isProvided(cleaned.annual_interest_rate)) cleaned.monthly_interest_rate = null;

  if (isProvided(cleaned.rent_percentage)) cleaned.rent_value = null;
  else if (isProvided(cleaned.rent_value)) cleaned.rent_percentage = null;

  if (Array.isArray(cleaned.contributions)) {
    cleaned.contributions = cleaned.contributions.map((contribution) => {
      const withoutLegacyFundingSource = {
        ...contribution,
      } as typeof contribution & { funding_source?: unknown };
      delete withoutLegacyFundingSource.funding_source;
      if (!Array.isArray(withoutLegacyFundingSource.applies_to)) {
        return withoutLegacyFundingSource;
      }
      const appliesTo = new Set<string>(withoutLegacyFundingSource.applies_to);
      const allScenarios = ['buy', 'rent_invest', 'invest_buy'];
      if (
        appliesTo.size === 0 ||
        (appliesTo.size === allScenarios.length &&
          allScenarios.every((scenario) => appliesTo.has(scenario)))
      ) {
        const { applies_to: _appliesTo, ...rest } = withoutLegacyFundingSource;
        return rest;
      }
      return {
        ...withoutLegacyFundingSource,
        applies_to: [...withoutLegacyFundingSource.applies_to],
      };
    }) as ComparisonInput['contributions'];
  }

  return clonePresetValue(cleaned);
}

export function validateComparisonInput(values: ComparisonInput): Record<string, string> {
  const errors: Record<string, string> = {};
  const validateOptionalRange = (
    path: string,
    value: unknown,
    minimum: number,
    maximum: number,
    message: string
  ) => {
    if (!isProvided(value)) return;
    const parsed = asFiniteNumber(value);
    if (parsed === null || parsed < minimum || parsed > maximum) errors[path] = message;
  };
  const propertyValue = asFiniteNumber(values.property_value);
  const downPayment = asFiniteNumber(values.down_payment);
  const totalSavings = asFiniteNumber(values.total_savings);
  const monthlyNetIncome = asFiniteNumber(values.monthly_net_income);
  const additionalCosts = isRecord(values.additional_costs)
    ? values.additional_costs
    : null;
  const itbiRaw = additionalCosts?.itbi_percentage;
  const deedRaw = additionalCosts?.deed_percentage;
  const itbi = asFiniteNumber(itbiRaw) ?? 0;
  const deed = asFiniteNumber(deedRaw) ?? 0;
  const termMonths = typeof values.loan_term_years === 'number'
    ? values.loan_term_years * 12
    : 0;

  if (
    propertyValue === null ||
    propertyValue <= 0 ||
    propertyValue > MAX_FINANCIAL_AMOUNT
  ) {
    errors.property_value = 'Informe um valor de imóvel entre zero e R$ 1 quadrilhão';
  }
  if (downPayment === null || downPayment < 0 || downPayment > MAX_FINANCIAL_AMOUNT) {
    errors.down_payment = 'A entrada deve ficar entre zero e R$ 1 quadrilhão';
  } else if (propertyValue !== null && downPayment > propertyValue) {
    errors.down_payment = 'A entrada não pode superar o valor do imóvel';
  }
  if (
    typeof values.loan_term_years !== 'number' ||
    !Number.isInteger(values.loan_term_years) ||
    values.loan_term_years < 1 ||
    values.loan_term_years > 50
  ) {
    errors.loan_term_years = 'O prazo deve ficar entre 1 e 50 anos';
  }
  if (values.loan_type !== 'PRICE' && values.loan_type !== 'SAC') {
    errors.loan_type = 'Selecione SAC ou PRICE';
  }
  if (!additionalCosts) {
    errors.additional_costs = 'Informe uma configuração válida de custos adicionais';
  }
  if (isProvided(itbiRaw) && (asFiniteNumber(itbiRaw) === null || itbi < 0 || itbi > 100)) {
    errors['additional_costs.itbi_percentage'] = 'O ITBI deve ficar entre 0% e 100%';
  }
  if (isProvided(deedRaw) && (asFiniteNumber(deedRaw) === null || deed < 0 || deed > 100)) {
    errors['additional_costs.deed_percentage'] = 'A escritura deve ficar entre 0% e 100%';
  }

  if (typeof values.continue_contributions_after_purchase !== 'undefined' &&
      typeof values.continue_contributions_after_purchase !== 'boolean') {
    errors.continue_contributions_after_purchase = 'Escolha se os aportes continuam após a compra';
  }
  if (typeof values.monthly_net_income_adjust_inflation !== 'undefined' &&
      typeof values.monthly_net_income_adjust_inflation !== 'boolean') {
    errors.monthly_net_income_adjust_inflation = 'A opção de correção do orçamento é inválida';
  }

  if (isProvided(values.total_savings)) {
    if (
      totalSavings === null ||
      totalSavings < 0 ||
      totalSavings > MAX_FINANCIAL_AMOUNT
    ) {
      errors.total_savings = 'O patrimônio disponível deve ficar entre zero e R$ 1 quadrilhão';
    } else if (propertyValue !== null && downPayment !== null) {
      const minimum = downPayment + propertyValue * ((itbi + deed) / 100);
      if (totalSavings < minimum) {
        errors.total_savings = `Informe pelo menos ${money(minimum)} para cobrir entrada e custos`;
      }
    }
  }

  if (
    isProvided(values.monthly_net_income) &&
    (monthlyNetIncome === null ||
      monthlyNetIncome < 0 ||
      monthlyNetIncome > MAX_FINANCIAL_AMOUNT)
  ) {
    errors.monthly_net_income = 'O orçamento mensal deve ficar entre zero e R$ 1 quadrilhão';
  }

  validateOptionalRange(
    'additional_costs.monthly_hoa',
    additionalCosts?.monthly_hoa,
    0,
    MAX_FINANCIAL_AMOUNT,
    'O condomínio mensal deve ficar entre zero e R$ 1 quadrilhão'
  );
  validateOptionalRange(
    'additional_costs.monthly_property_tax',
    additionalCosts?.monthly_property_tax,
    0,
    MAX_FINANCIAL_AMOUNT,
    'O IPTU mensal deve ficar entre zero e R$ 1 quadrilhão'
  );
  validateOptionalRange('inflation_rate', values.inflation_rate, 0, 1000, 'A inflação deve ficar entre 0% e 1.000%');
  validateOptionalRange(
    'rent_inflation_rate',
    values.rent_inflation_rate,
    0,
    1000,
    'A inflação do aluguel deve ficar entre 0% e 1.000%'
  );
  validateOptionalRange(
    'property_appreciation_rate',
    values.property_appreciation_rate,
    0,
    1000,
    'A valorização deve ficar entre 0% e 1.000%'
  );
  const fgts = values.fgts == null ? null : isRecord(values.fgts) ? values.fgts : null;
  if (values.fgts != null && !fgts) errors.fgts = 'A configuração do FGTS é inválida';
  if (fgts && isProvided(fgts.use_at_purchase) && typeof fgts.use_at_purchase !== 'boolean') {
    errors['fgts.use_at_purchase'] = 'A opção de uso do FGTS é inválida';
  }
  validateOptionalRange(
    'fgts.initial_balance',
    fgts?.initial_balance,
    0,
    MAX_FINANCIAL_AMOUNT,
    'O saldo do FGTS deve ficar entre zero e R$ 1 quadrilhão'
  );
  validateOptionalRange(
    'fgts.monthly_contribution',
    fgts?.monthly_contribution,
    0,
    MAX_FINANCIAL_AMOUNT,
    'O aporte mensal do FGTS deve ficar entre zero e R$ 1 quadrilhão'
  );
  validateOptionalRange(
    'fgts.annual_yield_rate',
    fgts?.annual_yield_rate,
    0,
    100,
    'O rendimento do FGTS deve ficar entre 0% e 100%'
  );
  validateOptionalRange(
    'fgts.max_withdrawal_at_purchase',
    fgts?.max_withdrawal_at_purchase,
    0,
    MAX_FINANCIAL_AMOUNT,
    'O limite de saque do FGTS deve ficar entre zero e R$ 1 quadrilhão'
  );
  const investmentTax = values.investment_tax == null
    ? null
    : isRecord(values.investment_tax)
      ? values.investment_tax
      : null;
  if (values.investment_tax != null && !investmentTax) {
    errors.investment_tax = 'A configuração de tributação é inválida';
  }
  if (investmentTax && isProvided(investmentTax.enabled) && typeof investmentTax.enabled !== 'boolean') {
    errors['investment_tax.enabled'] = 'A opção de tributação é inválida';
  }
  if (
    investmentTax &&
    isProvided(investmentTax.mode) &&
    investmentTax.mode !== 'monthly' &&
    investmentTax.mode !== 'on_withdrawal'
  ) {
    errors['investment_tax.mode'] = 'Selecione um modo de tributação válido';
  }
  validateOptionalRange(
    'investment_tax.effective_tax_rate',
    investmentTax?.effective_tax_rate,
    0,
    100,
    'A alíquota deve ficar entre 0% e 100%'
  );

  const annualInterest = asFiniteNumber(values.annual_interest_rate);
  const monthlyInterest = asFiniteNumber(values.monthly_interest_rate);
  const hasAnnualInterest = isProvided(values.annual_interest_rate);
  const hasMonthlyInterest = isProvided(values.monthly_interest_rate);
  if (!hasAnnualInterest && !hasMonthlyInterest) {
    errors.annual_interest_rate = 'Informe a taxa anual ou mensal';
  } else if (hasAnnualInterest && hasMonthlyInterest) {
    errors.monthly_interest_rate = 'Use apenas uma taxa de juros';
  }
  if (hasAnnualInterest && (annualInterest === null || annualInterest < 0 || annualInterest > 1000)) {
    errors.annual_interest_rate = 'A taxa anual deve ficar entre 0% e 1.000%';
  }
  if (
    hasMonthlyInterest &&
    (monthlyInterest === null ||
      monthlyInterest < 0 ||
      monthlyInterest > MAX_MONTHLY_INTEREST_RATE)
  ) {
    errors.monthly_interest_rate = 'A taxa mensal deve ficar entre 0% e 100%';
  }

  const hasRentValue = isProvided(values.rent_value);
  const hasRentPercentage = isProvided(values.rent_percentage);
  const rentValue = asFiniteNumber(values.rent_value);
  const rentPercentage = asFiniteNumber(values.rent_percentage);
  if (!hasRentValue && !hasRentPercentage) {
    errors.rent_value = 'Informe o aluguel em reais ou como percentual';
  } else if (hasRentValue && hasRentPercentage) {
    errors.rent_percentage = 'Use apenas uma forma de informar o aluguel';
  }
  if (
    hasRentValue &&
    (rentValue === null || rentValue < 0 || rentValue > MAX_FINANCIAL_AMOUNT)
  ) {
    errors.rent_value = 'O aluguel deve ficar entre zero e R$ 1 quadrilhão';
  }
  if (hasRentPercentage && (rentPercentage === null || rentPercentage < 0 || rentPercentage > 100)) {
    errors.rent_percentage = 'O percentual de aluguel deve ficar entre 0% e 100%';
  }

  const validateSchedules = (
    field: 'amortizations' | 'contributions',
    schedules: ComparisonInput['amortizations'] | ComparisonInput['contributions']
  ) => {
    if (!Array.isArray(schedules)) return;
    if (schedules.length > 500) {
      errors[field] = 'Use no máximo 500 programações';
      return;
    }

    schedules.forEach((candidate, index) => {
      const prefix = `${field}.${index}`;
      if (!isRecord(candidate)) {
        errors[prefix] = 'A programação é inválida';
        return;
      }
      const schedule = candidate as unknown as ScheduleInput & {
        applies_to?: unknown;
        funding_source?: unknown;
      };
      const month = asFiniteNumber(schedule.month);
      const endMonth = asFiniteNumber(schedule.end_month);
      const interval = asFiniteNumber(schedule.interval_months);
      const occurrences = asFiniteNumber(schedule.occurrences);
      const amount = asFiniteNumber(schedule.value);
      const hasMonth = isProvided(schedule.month);
      const hasInterval = isProvided(schedule.interval_months);

      if (!hasMonth && !hasInterval) {
        errors[`${prefix}.month`] = 'Informe um mês ou um intervalo de recorrência';
      } else if (
        hasMonth &&
        (month === null || !Number.isInteger(month) || month < 1 || month > termMonths)
      ) {
        errors[`${prefix}.month`] = `Informe um mês entre 1 e ${termMonths}`;
      }
      if (amount === null || amount < 0 || amount > MAX_FINANCIAL_AMOUNT) {
        errors[`${prefix}.value`] = 'O valor deve ficar entre zero e R$ 1 quadrilhão';
      } else if (schedule.value_type === 'percentage' && amount > 100) {
        errors[`${prefix}.value`] = 'O percentual deve ficar entre 0% e 100%';
      }
      if (
        isProvided(schedule.value_type) &&
        schedule.value_type !== 'fixed' &&
        schedule.value_type !== 'percentage'
      ) {
        errors[`${prefix}.value_type`] = 'Selecione valor fixo ou percentual';
      }
      if (isProvided(schedule.inflation_adjust) && typeof schedule.inflation_adjust !== 'boolean') {
        errors[`${prefix}.inflation_adjust`] = 'A opção de correção pela inflação é inválida';
      }
      if (
        hasInterval &&
        (interval === null || !Number.isInteger(interval) || interval < 1)
      ) {
        errors[`${prefix}.interval_months`] = 'O intervalo deve ser um número inteiro positivo';
      }
      if (
        (isProvided(schedule.end_month) || isProvided(schedule.occurrences)) &&
        !hasInterval
      ) {
        errors[`${prefix}.interval_months`] = 'Defina o intervalo para a recorrência';
      }
      if (isProvided(schedule.end_month)) {
        if (
          endMonth === null ||
          !Number.isInteger(endMonth) ||
          endMonth < (month ?? 1) ||
          endMonth > termMonths
        ) {
          errors[`${prefix}.end_month`] = `O mês final deve ficar entre o início e ${termMonths}`;
        }
      }
      if (
        isProvided(schedule.occurrences) &&
        (occurrences === null ||
          !Number.isInteger(occurrences) ||
          occurrences < 1 ||
          occurrences > MAX_SCHEDULE_OCCURRENCES)
      ) {
        errors[`${prefix}.occurrences`] = 'Use entre 1 e 600 ocorrências';
      }
      if (isProvided(schedule.end_month) && isProvided(schedule.occurrences)) {
        errors[`${prefix}.occurrences`] = 'Use ocorrências ou mês final, não ambos';
      }
      if (field === 'contributions') {
        const appliesTo = schedule.applies_to;
        if (appliesTo != null && !Array.isArray(appliesTo)) {
          errors[`${prefix}.applies_to`] = 'A seleção de cenários é inválida';
        } else if (Array.isArray(appliesTo) && appliesTo.length === 0) {
          errors[`${prefix}.applies_to`] = 'Selecione ao menos um cenário';
        } else if (
          Array.isArray(appliesTo) &&
          (appliesTo.some((scenario) => !['buy', 'rent_invest', 'invest_buy'].includes(String(scenario))) ||
            new Set(appliesTo).size !== appliesTo.length)
        ) {
          errors[`${prefix}.applies_to`] = 'Selecione cenários válidos, sem duplicidades';
        }
      } else if (
        isProvided(schedule.funding_source) &&
        !['cash', 'fgts', 'bonus', '13_salario'].includes(String(schedule.funding_source))
      ) {
        errors[`${prefix}.funding_source`] = 'Selecione uma fonte de recurso válida';
      }
    });
  };

  validateSchedules('amortizations', values.amortizations);
  validateSchedules('contributions', values.contributions);

  const amortizationEvents = (values.amortizations ?? []).reduce(
    (total, schedule) => total + relevantScheduleMonths(schedule, termMonths).length,
    0
  );
  const contributionEvents = (values.contributions ?? []).reduce(
    (total, schedule) => total + relevantScheduleMonths(schedule, termMonths).length,
    0
  );
  if (amortizationEvents + contributionEvents > MAX_EXPANDED_SCHEDULE_EVENTS) {
    const path = contributionEvents > 0 ? 'contributions' : 'amortizations';
    errors[path] = `As programações geram mais de ${MAX_EXPANDED_SCHEDULE_EVENTS.toLocaleString('pt-BR')} eventos`;
  }

  const percentageByScenarioMonth = new Map<string, number>();
  (values.contributions ?? []).forEach((contribution, index) => {
    if (!isRecord(contribution)) return;
    if (contribution.value_type !== 'percentage') return;
    const amount = asFiniteNumber(contribution.value);
    if (amount === null) return;
    const scenarios = Array.isArray(contribution.applies_to) && contribution.applies_to.length
      ? contribution.applies_to.filter((scenario): scenario is 'buy' | 'rent_invest' | 'invest_buy' =>
          scenario === 'buy' || scenario === 'rent_invest' || scenario === 'invest_buy')
      : ['buy', 'rent_invest', 'invest_buy'];
    relevantScheduleMonths(contribution, termMonths).forEach((month) => {
      scenarios.forEach((scenario) => {
        const key = `${scenario}:${month}`;
        const total = (percentageByScenarioMonth.get(key) ?? 0) + amount;
        percentageByScenarioMonth.set(key, total);
        if (total > MAX_MONTHLY_PERCENTAGE_CONTRIBUTION) {
          errors[`contributions.${index}.value`] =
            'Os aportes percentuais somados não podem superar 100% no mesmo mês e cenário';
        }
      });
    });
  });

  const returns = values.investment_returns ?? [];
  if (returns.length === 0) {
    errors.investment_returns = 'Adicione ao menos um período de retorno';
  } else if (returns.length > 100) {
    errors.investment_returns = 'Use no máximo 100 períodos de retorno';
  } else {
    returns.forEach((candidate, index) => {
      const prefix = `investment_returns.${index}`;
      if (!isRecord(candidate)) {
        errors[prefix] = 'O período de retorno é inválido';
        return;
      }
      const period = candidate as unknown as NonNullable<ComparisonInput['investment_returns']>[number];
      const startMonth = asFiniteNumber(period.start_month);
      const endMonth = asFiniteNumber(period.end_month);
      const annualRate = asFiniteNumber(period.annual_rate);
      if (startMonth === null || !Number.isInteger(startMonth) || startMonth < 1) {
        errors[`${prefix}.start_month`] = 'O mês inicial deve ser um inteiro positivo';
      } else if (index === 0 && startMonth !== 1) {
        errors[`investment_returns.${index}.start_month`] = 'O primeiro período deve começar no mês 1';
      }
      if (
        annualRate === null ||
        annualRate <= -100 ||
        annualRate > 1000
      ) {
        errors[`investment_returns.${index}.annual_rate`] = 'A taxa deve ser maior que -100% e até 1.000%';
      }

      const isLast = index === returns.length - 1;
      if (isLast && period.end_month != null) {
        errors[`investment_returns.${index}.end_month`] = 'O último período deve ser indefinido';
      }
      if (!isLast && period.end_month == null) {
        errors[`investment_returns.${index}.end_month`] = 'Defina o fim deste período';
      }
      if (period.end_month != null && (endMonth === null || !Number.isInteger(endMonth))) {
        errors[`${prefix}.end_month`] = 'O mês final deve ser um inteiro positivo';
      } else if (endMonth != null && startMonth != null && endMonth < startMonth) {
        errors[`investment_returns.${index}.end_month`] = 'O fim deve ser igual ou posterior ao início';
      }

      const previous = returns[index - 1];
      const previousEnd = isRecord(previous) ? asFiniteNumber(previous.end_month) : null;
      if (previous && previousEnd != null && startMonth !== previousEnd + 1) {
        errors[`investment_returns.${index}.start_month`] = `Este período deve começar no mês ${previousEnd + 1}`;
      }
    });
  }

  return errors;
}

export default function ComparisonForm() {
  const batchResultsRef = useRef<HTMLDivElement>(null);
  const batchAbortRef = useRef<AbortController | null>(null);
  const batchRequestIdRef = useRef(0);
  const submittedFingerprintRef = useRef<string | null>(null);
  const notifiedStorageErrorRef = useRef<string | null>(null);

  const form = useForm<ComparisonInput>({
    mode: 'controlled',
    validate: validateComparisonInput,
    validateInputOnBlur: true,
    initialValues: {
      property_value: 500000,
      down_payment: 100000,
      total_savings: null,
      loan_term_years: 30,
      annual_interest_rate: 10,
      monthly_interest_rate: null,
      loan_type: "PRICE",
      rent_value: 2000,
      rent_percentage: null,
      investment_returns: clonePresetValue(DEFAULT_INVESTMENT_RETURNS),
      amortizations: [],
      contributions: [],
      continue_contributions_after_purchase: true,
      additional_costs: {
        itbi_percentage: 2,
        deed_percentage: 1,
        monthly_hoa: 0,
        monthly_property_tax: 0,
      },
      inflation_rate: 4,
      rent_inflation_rate: 5,
      property_appreciation_rate: 4,
      monthly_net_income: null,
      monthly_net_income_adjust_inflation: false,
      fgts: clonePresetValue(DEFAULT_FGTS),
      investment_tax: clonePresetValue(DEFAULT_INVESTMENT_TAX),
    },
  });

  const { data, loading, call, reset } = useApi<
    [ComparisonInput, boolean],
    EnhancedComparisonResult
  >(
    async (input: ComparisonInput, enhanced: boolean, { signal }) => {
      const endpoint = enhanced ? '/api/compare-scenarios-enhanced' : '/api/compare-scenarios';
      const response = await api.post<EnhancedComparisonResult>(endpoint, input, { signal });
      return response.data;
    },
  );
  const [lastInput, setLastInput] = useState<ComparisonInput | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [investmentTab, setInvestmentTab] = useState<string | null>('retorno');
  const [adjustmentsTab, setAdjustmentsTab] = useState<string | null>('custos');
  
  // Batch comparison state
  const [viewMode, setViewMode] = useState<ViewMode>('form');
  const [batchResult, setBatchResult] = useState<BatchComparisonResult | null>(null);
  const [batchInputs, setBatchInputs] = useState<ComparisonInput[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  // Presets management
  const presetsManager = usePresets<ComparisonInput>({
    storageKey: PRESETS_STORAGE_KEY,
    validateInput: isComparisonPresetInput,
  });

  const handleLoadPreset = (preset: Preset<ComparisonInput>) => {
    form.setValues(normalizeComparisonInput(preset.input));
    form.clearErrors();
    setActiveStep(3);
  };

  const handleBatchCompare = async (selectedPresets: Preset<ComparisonInput>[]) => {
    const invalidPreset = selectedPresets.find((preset) => !isComparisonPresetInput(preset.input));
    if (invalidPreset) {
      notifications.show({
        title: 'Preset inválido',
        message: `Revise “${invalidPreset.name}” antes de iniciar a comparação.`,
        color: 'red',
      });
      return;
    }
    batchAbortRef.current?.abort();
    const controller = new AbortController();
    batchAbortRef.current = controller;
    const requestId = ++batchRequestIdRef.current;
    setBatchLoading(true);
    try {
      const items: BatchComparisonItem[] = selectedPresets.map((preset) => ({
        preset_id: preset.id,
        preset_name: preset.name,
        input: prepareComparisonInput(preset.input),
      }));

      const response = await api.post<BatchComparisonResult>(
        '/api/compare-scenarios-batch',
        { items },
        { signal: controller.signal }
      );
      if (controller.signal.aborted || requestId !== batchRequestIdRef.current) return;

      const result = response.data;
      setBatchResult(result);
      setBatchInputs(selectedPresets.map((preset) => prepareComparisonInput(preset.input)));
      setViewMode('batch-result');
      
      notifications.show({
        title: "Comparação concluída",
        message: `${selectedPresets.length} presets analisados com sucesso`,
        color: "ocean",
      });

      // Scroll to results after a brief delay for DOM update
      setTimeout(() => {
        batchResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (error: unknown) {
      if (controller.signal.aborted || requestId !== batchRequestIdRef.current) return;
      const apiError = await toApiError(error);
      if (isRequestCancelled(apiError)) return;
      notifications.show({
        title: "Erro na comparação",
        message: apiError.message,
        color: "red",
      });
    } finally {
      if (requestId === batchRequestIdRef.current) {
        setBatchLoading(false);
        if (batchAbortRef.current === controller) batchAbortRef.current = null;
      }
    }
  };

  const handleBackFromBatch = () => {
    batchRequestIdRef.current += 1;
    batchAbortRef.current?.abort();
    batchAbortRef.current = null;
    setBatchLoading(false);
    setViewMode('form');
    setBatchResult(null);
    setBatchInputs([]);
  };

  const propertyValue = Number(form.values.property_value || 0);
  const downPayment = Number(form.values.down_payment || 0);
  const totalSavings = Number(form.values.total_savings || 0);
  const totalSavingsProvided = isProvided(form.values.total_savings);
  
  // Calculate upfront costs (ITBI + deed) for validation
  const itbiPercentage = Number(form.values.additional_costs?.itbi_percentage || 0);
  const deedPercentage = Number(form.values.additional_costs?.deed_percentage || 0);
  const upfrontCosts = propertyValue * ((itbiPercentage + deedPercentage) / 100);
  
  // The minimum required is: down_payment + ITBI + deed costs
  const minRequiredSavings = downPayment + upfrontCosts;
  
  // Initial investment is what remains after paying entry + transaction costs
  const initialInvestment = totalSavingsProvided
    ? Math.max(0, totalSavings - minRequiredSavings)
    : 0;
  
  // Validation: check if total_savings covers all required costs
  const insufficientSavings = totalSavingsProvided && totalSavings < minRequiredSavings;
  
  const loanAmount = Math.max(0, propertyValue - downPayment);
  const downPaymentPct =
    propertyValue > 0 ? (downPayment / propertyValue) * 100 : 0;
  const rentValue = Number(form.values.rent_value || 0);
  const rentPercentage = Number(form.values.rent_percentage || 0);
  const rentFromPct = propertyValue > 0 && rentPercentage > 0 ? propertyValue * (rentPercentage / 100) : 0;

  async function onSubmit(values: ComparisonInput) {
    try {
      const cleaned = prepareComparisonInput(values);
      submittedFingerprintRef.current = JSON.stringify(cleaned);
      reset();
      setLastInput(null);
      setViewMode('form');

      const outcome = await call(cleaned, true);
      if (!outcome.committed) return;

      setLastInput(clonePresetValue(cleaned));
      setViewMode('single-result');
      notifications.show({
        title: "Análise concluída",
        message: "Os resultados estão prontos abaixo",
        color: "ocean",
      });
      // Scroll to results
      setTimeout(() => {
        document
          .getElementById("results-section")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
      return outcome.data;
    } catch (error: unknown) {
      submittedFingerprintRef.current = null;
      const apiError = await toApiError(error);
      if (isRequestCancelled(apiError)) return;
      notifications.show({
        title: "Erro",
        message: apiError.message,
        color: "red",
      });
    }
  }

  const focusFirstError = (errors: typeof form.errors, maximumStep = 3) => {
    const firstError = Object.keys(errors)
      .filter((path) => fieldStep(path) <= maximumStep)
      .sort((left, right) => fieldStep(left) - fieldStep(right))[0];
    if (!firstError) return false;

    const step = fieldStep(firstError);
    setActiveStep(step);
    if (firstError.startsWith('investment_returns')) setInvestmentTab('retorno');
    else if (
      firstError.startsWith('contributions') ||
      firstError === 'continue_contributions_after_purchase'
    ) setInvestmentTab('aportes');
    else if (firstError.startsWith('investment_tax')) setInvestmentTab('tributacao');

    if (firstError.startsWith('additional_costs')) setAdjustmentsTab('custos');
    else if (
      firstError === 'inflation_rate' ||
      firstError === 'rent_inflation_rate' ||
      firstError === 'property_appreciation_rate'
    ) setAdjustmentsTab('inflacao');
    else if (firstError.startsWith('amortizations')) setAdjustmentsTab('amortizacoes');
    else if (
      firstError === 'fgts.annual_yield_rate' ||
      firstError === 'fgts.max_withdrawal_at_purchase'
    ) setAdjustmentsTab('fgts-avancado');

    setTimeout(() => {
      const registeredInput = form.getInputNode(firstError);
      const namedInput = document.querySelector<HTMLElement>(`[name="${firstError}"]`);
      (registeredInput ?? namedInput)?.focus();
    }, 0);
    return true;
  };

  const handleStepClick = (nextStep: number) => {
    if (nextStep <= activeStep) {
      setActiveStep(nextStep);
      return;
    }

    const validation = form.validate();
    if (focusFirstError(validation.errors, nextStep - 1)) {
      notifications.show({
        title: 'Revise esta etapa',
        message: 'Corrija os campos destacados antes de continuar.',
        color: 'red',
      });
      return;
    }
    setActiveStep(nextStep);
  };

  const handleInvalidSubmit = (errors: typeof form.errors) => {
    focusFirstError(errors);
    notifications.show({
      title: 'Não foi possível simular',
      message: 'Revise os campos destacados nas etapas do formulário.',
      color: 'red',
    });
  };

  const handleSavePreset = (name: string, description?: string, tags?: Parameters<typeof presetsManager.addPreset>[3]) => {
    const validation = form.validate();
    if (Object.keys(validation.errors).length > 0) {
      focusFirstError(validation.errors);
      notifications.show({
        title: 'Não foi possível salvar o preset',
        message: 'Corrija os campos destacados antes de salvar esta configuração.',
        color: 'red',
      });
      return false;
    }
    return Boolean(
      presetsManager.addPreset(
        name,
        prepareComparisonInput(form.values),
        description,
        tags
      )
    );
  };

  useEffect(() => {
    const expected = submittedFingerprintRef.current;
    if (!expected || (!loading && !data)) return;

    const current = JSON.stringify(prepareComparisonInput(form.values));
    if (current !== expected) {
      submittedFingerprintRef.current = null;
      reset();
      setLastInput(null);
      setViewMode('form');
    }
  }, [form.values, loading, data, reset]);

  useEffect(() => {
    const storageError = presetsManager.storageError;
    if (!storageError) {
      notifiedStorageErrorRef.current = null;
      return;
    }
    if (notifiedStorageErrorRef.current === storageError) return;
    notifiedStorageErrorRef.current = storageError;
    notifications.show({
      title: 'Presets não puderam ser persistidos',
      message: storageError,
      color: 'red',
      autoClose: 8000,
    });
  }, [presetsManager.storageError]);

  useEffect(
    () => () => {
      batchRequestIdRef.current += 1;
      batchAbortRef.current?.abort();
    },
    []
  );

  return (
    <Stack gap="xl">
      <Accordion variant="separated" radius="xl">
        <Accordion.Item value="presets">
          <Accordion.Control icon={<IconSettings size={18} />}>
            <Group gap="xs" wrap="wrap">
              <Text fw={650}>Cenários salvos</Text>
              <Badge variant="light" color="ocean">
                {presetsManager.presets.length}
              </Badge>
              <Text size="sm" c="dimmed">
                Salve, reutilize ou compare configurações em lote.
              </Text>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Group gap="sm" wrap="wrap">
              <PresetManager<ComparisonInput>
                presets={presetsManager.presets}
                onSave={handleSavePreset}
                onLoad={handleLoadPreset}
                onDelete={presetsManager.removePreset}
                onDuplicate={presetsManager.duplicatePreset}
                onEdit={(id, updates) => presetsManager.editPreset(id, updates)}
                onExportAll={presetsManager.exportAllPresets}
                onExportSelected={presetsManager.exportSelectedPresets}
                onImport={presetsManager.importPresets}
                onClearAll={presetsManager.clearAllPresets}
                onCompare={handleBatchCompare}
                isCompareLoading={batchLoading}
                minCompareSelection={2}
                allTags={presetsManager.allTags}
                onAddTag={presetsManager.addTagToPreset}
                onRemoveTag={presetsManager.removeTagFromPreset}
                isLoading={loading}
              />
              <PresetCompareSelector
                presets={presetsManager.presets}
                onCompare={handleBatchCompare}
                isLoading={batchLoading}
              />
            </Group>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      {/* Form Section */}
      <form onSubmit={form.onSubmit(onSubmit, handleInvalidSubmit)} noValidate>
        <FormWizard
          active={activeStep}
          onStepClick={handleStepClick}
          steps={[
            {
              label: "Sua situação",
              description: "Renda e patrimônio",
              icon: <IconWallet size={16} />,
            },
            {
              label: "Imóvel",
              description: "Valor, entrada e taxa",
              icon: <IconHome2 size={16} />,
            },
            {
              label: "Aluguel & Investimentos",
              description: "Aluguel, retorno e aportes",
              icon: <IconChartLine size={16} />,
            },
            {
              label: "Ajustes",
              description: "Opcional",
              icon: <IconAdjustments size={16} />,
            },
          ]}
        >
          {activeStep === 0 && (
            <FormSection
              title="Sua situação financeira"
              description="Informe o orçamento que sobra após despesas de vida e o patrimônio disponível. Esses dados determinam se o fluxo é comparável e viável."
              icon={<IconWallet size={20} />}
            >
              <Grid gutter="lg">
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <NumberInput
                    label={
                      <LabelWithHelp
                        label="Orçamento mensal disponível"
                        help="Valor que sobra todo mês, depois de alimentação, saúde, transporte e demais despesas de vida, para pagar moradia e aportes configurados. Eventual excedente fica como caixa sem rendimento; faltas viram passivo explícito."
                      />
                    }
                    description="Quanto sobra por mês para moradia e aportes"
                    placeholder="R$ 10.000"
                    {...form.getInputProps("monthly_net_income")}
                    thousandSeparator="."
                    decimalSeparator=","
                    prefix="R$ "
                    min={0}
                    size="md"
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }} style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <Checkbox
                    label="Ajustar orçamento pela inflação"
                    description="Corrige o orçamento disponível pela inflação ao longo do tempo"
                    {...form.getInputProps("monthly_net_income_adjust_inflation", {
                      type: "checkbox",
                    })}
                    disabled={!Number(form.values.monthly_net_income || 0)}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <NumberInput
                    label={
                      <LabelWithHelp 
                        label="Patrimônio disponível" 
                        help={`Seu patrimônio líquido disponível para a compra. Este valor deve cobrir: entrada em dinheiro + custos de ITBI e escritura (tipicamente ${(itbiPercentage + deedPercentage).toFixed(0)}% do imóvel). O que sobrar será seu capital inicial para investir nos cenários de aluguel.`} 
                      />
                    }
                    description="Quanto você tem disponível para a compra/investimento"
                    placeholder="R$ 150.000"
                    min={0}
                    {...form.getInputProps("total_savings")}
                    thousandSeparator="."
                    decimalSeparator=","
                    prefix="R$ "
                    size="md"
                  />
                </Grid.Col>
                {(!isProvided(form.values.monthly_net_income) ||
                  !isProvided(form.values.total_savings)) && (
                  <Grid.Col span={12}>
                    <Alert
                      color="blue"
                      variant="light"
                      icon={<IconInfoCircle size={16} />}
                      title="Preencha os dois valores para obter um ranking"
                    >
                      Sem orçamento mensal disponível ou patrimônio inicial, a análise continua
                      exploratória e não declara um vencedor, mesmo que mostre as trajetórias.
                    </Alert>
                  </Grid.Col>
                )}
                <Grid.Col span={12}>
                  <Box 
                    p="md" 
                    style={{ 
                      backgroundColor: 'light-dark(var(--mantine-color-ocean-0), var(--mantine-color-dark-7))', 
                      borderRadius: 'var(--mantine-radius-md)',
                      border: '1px solid var(--mantine-color-ocean-2)'
                    }}
                  >
                    <Group gap="sm" mb="xs">
                      <ThemeIcon size={24} radius="md" variant="light" color="ocean">
                        <IconPigMoney size={14} />
                      </ThemeIcon>
                      <Text fw={600} size="sm" c="ocean.7">
                        FGTS (Opcional)
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed" mb="md">
                      O FGTS é tratado separadamente da entrada em dinheiro. O valor informado aqui será somado à entrada no momento da compra.
                    </Text>
                    <Grid gutter="md">
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <NumberInput
                          label="Saldo FGTS"
                          description="Saldo disponível para uso na compra"
                          placeholder="R$ 0"
                          {...form.getInputProps("fgts.initial_balance")}
                          thousandSeparator="."
                          decimalSeparator=","
                          prefix="R$ "
                          min={0}
                          size="sm"
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <NumberInput
                          label="Aporte mensal FGTS"
                          description="Depósito mensal no FGTS"
                          placeholder="R$ 0"
                          {...form.getInputProps("fgts.monthly_contribution")}
                          thousandSeparator="."
                          decimalSeparator=","
                          prefix="R$ "
                          min={0}
                          size="sm"
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <Checkbox
                          label="Usar FGTS na compra do imóvel"
                          {...form.getInputProps("fgts.use_at_purchase", {
                            type: "checkbox",
                          })}
                        />
                      </Grid.Col>
                    </Grid>
                  </Box>
                </Grid.Col>
              </Grid>
            </FormSection>
          )}

          {activeStep === 1 && (
            <FormSection
              title="Imóvel e financiamento"
              description="Defina o valor do imóvel, entrada e condições do financiamento."
              icon={<IconHome2 size={20} />}
            >
              <Grid gutter="lg">
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <NumberInput
                    label="Valor do imóvel"
                    description="Preço total do imóvel que você está considerando"
                    placeholder="R$ 500.000"
                    min={0}
                    required
                    {...form.getInputProps("property_value")}
                    thousandSeparator="."
                    decimalSeparator=","
                    prefix="R$ "
                    size="md"
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <NumberInput
                    label={
                      <LabelWithHelp 
                        label="Entrada (em dinheiro)" 
                        help="Valor em dinheiro que você vai usar como entrada no financiamento. NÃO inclua aqui o FGTS - ele é somado automaticamente se configurado." 
                      />
                    }
                    description="Apenas dinheiro, sem contar FGTS"
                    placeholder="R$ 100.000"
                    min={0}
                    required
                    {...form.getInputProps("down_payment")}
                    thousandSeparator="."
                    decimalSeparator=","
                    prefix="R$ "
                    size="md"
                    error={
                      form.errors.down_payment || (insufficientSavings
                        ? `Patrimônio insuficiente para cobrir entrada (${money(downPayment)}) + custos (${money(upfrontCosts)}). Mínimo: ${money(minRequiredSavings)}.`
                        : undefined)
                    }
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <NumberInput
                    label="Prazo do financiamento"
                    description="Duração em anos"
                    placeholder="30"
                    min={1}
                    max={50}
                    required
                    {...form.getInputProps("loan_term_years")}
                    suffix=" anos"
                    size="md"
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Select
                    label="Sistema de amortização"
                    description="SAC (parcelas decrescentes) ou PRICE (fixas)"
                    data={[
                      { value: "SAC", label: "SAC - Parcelas decrescentes" },
                      { value: "PRICE", label: "PRICE - Parcelas fixas" },
                    ]}
                    {...form.getInputProps("loan_type")}
                    size="md"
                  />
                </Grid.Col>

                <Grid.Col span={12}>
                  <Divider 
                    my="sm" 
                    label={
                      <Text size="sm" fw={500} c="dimmed">
                        Taxa de juros
                      </Text>
                    } 
                    labelPosition="left" 
                  />
                </Grid.Col>

                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <NumberInput
                    label="Taxa anual"
                    description="CET ou taxa nominal anual"
                    placeholder="10"
                    {...form.getInputProps("annual_interest_rate")}
                    onChange={(v) => {
                      form.setFieldValue("annual_interest_rate", v as any);
                      if (isProvided(v)) {
                        form.setFieldValue("monthly_interest_rate", null);
                      }
                    }}
                    suffix="% a.a."
                    min={0}
                    max={1000}
                    decimalScale={2}
                    size="md"
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <NumberInput
                    label="Taxa mensal"
                    description="Alternativa à taxa anual"
                    placeholder="0,8"
                    {...form.getInputProps("monthly_interest_rate")}
                    onChange={(v) => {
                      form.setFieldValue("monthly_interest_rate", v as any);
                      if (isProvided(v)) {
                        form.setFieldValue("annual_interest_rate", null);
                      }
                    }}
                    suffix="% a.m."
                    min={0}
                    max={MAX_MONTHLY_INTEREST_RATE}
                    decimalScale={4}
                    size="md"
                  />
                </Grid.Col>
              </Grid>
              <Text size="xs" c="ocean.6" mt="sm">
                Informe apenas uma das taxas. A outra será calculada automaticamente.
              </Text>
            </FormSection>
          )}

          {activeStep === 2 && (
            <FormSection
              title="Aluguel & Investimentos"
              description="Defina o aluguel e, em um só lugar, o retorno, os aportes e a tributação dos investimentos."
              icon={<IconChartLine size={20} />}
            >
              <Grid gutter="lg">
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <NumberInput
                    label="Valor do aluguel"
                    description="Aluguel mensal de um imóvel equivalente"
                    placeholder="R$ 2.000"
                    {...form.getInputProps("rent_value")}
                    onChange={(v) => {
                      form.setFieldValue("rent_value", v as any);
                      if (isProvided(v)) {
                        form.setFieldValue("rent_percentage", null);
                      }
                    }}
                    thousandSeparator="."
                    decimalSeparator=","
                    prefix="R$ "
                    min={0}
                    size="md"
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <NumberInput
                    label={
                      <LabelWithHelp
                        label="Aluguel como % do valor"
                        help="Alternativa ao valor fixo. O yield típico de aluguel no Brasil varia entre 0,3% e 0,5% do valor do imóvel por mês."
                      />
                    }
                    description="Alternativa ao valor fixo (yield típico: 0,3% a 0,5% a.m.)"
                    placeholder="0,4"
                    {...form.getInputProps("rent_percentage")}
                    onChange={(v) => {
                      form.setFieldValue("rent_percentage", v as any);
                      if (isProvided(v)) {
                        form.setFieldValue("rent_value", null);
                      }
                    }}
                    suffix="% a.m."
                    min={0}
                    max={100}
                    decimalScale={2}
                    size="md"
                  />
                </Grid.Col>
              </Grid>

              {totalSavingsProvided && (
                <Box
                  mt="md"
                  p="md"
                  style={{
                    backgroundColor: 'light-dark(var(--mantine-color-ocean-0), var(--mantine-color-dark-7))',
                    borderRadius: 'var(--mantine-radius-md)',
                    border: `1px solid ${insufficientSavings ? 'var(--mantine-color-danger-3)' : 'var(--mantine-color-ocean-2)'}`,
                  }}
                >
                  <Group gap="sm" mb={4}>
                    <ThemeIcon size={24} radius="md" variant="light" color={insufficientSavings ? 'danger' : 'ocean'}>
                      <IconPigMoney size={14} />
                    </ThemeIcon>
                    <Text fw={600} size="sm" c={insufficientSavings ? 'danger.7' : 'ocean.7'}>
                      Capital inicial para investir
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Patrimônio ({money(totalSavings)}) − Entrada ({money(downPayment)}) − Custos de compra ({money(upfrontCosts)})
                  </Text>
                  <Text fw={700} size="md" mt={6} c={insufficientSavings ? 'danger.7' : 'bright'}>
                    {insufficientSavings ? 'Insuficiente para cobrir entrada + custos' : money(initialInvestment)}
                  </Text>
                </Box>
              )}

              <Divider my="lg" color="var(--mantine-color-default-border)" />

              <Tabs value={investmentTab} onChange={setInvestmentTab} variant="pills" color="ocean">
                <Tabs.List style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
                  <Tabs.Tab value="retorno" leftSection={<IconChartLine size={16} />}>
                    Retorno
                  </Tabs.Tab>
                  <Tabs.Tab value="aportes" leftSection={<IconCash size={16} />}>
                    Aportes
                  </Tabs.Tab>
                  <Tabs.Tab value="tributacao" leftSection={<IconReceipt size={16} />}>
                    Tributação
                  </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="retorno" pt="md">
                  <Text fw={600} size="sm" mb="sm" c="bright">
                    Retorno do investimento
                  </Text>
                  <Text size="xs" c="dimmed" mb="md">
                    Configure as taxas de retorno esperadas. Se você não quiser segmentar por períodos, mantenha apenas 1 item.
                  </Text>
                  <InvestmentReturnsFieldArray
                    value={form.values.investment_returns}
                    onChange={(nextValue) => form.setFieldValue("investment_returns", nextValue)}
                    errors={form.errors}
                  />
                </Tabs.Panel>

                <Tabs.Panel value="aportes" pt="md">
                  <Stack gap="md">
                    <Text fw={600} size="sm" c="bright">
                      Aportes programados (opcional)
                    </Text>
                    <Text size="sm" c="dimmed">
                      Você pode definir aportes únicos, recorrentes, ou variáveis no tempo e escolher em quais cenários eles devem ser considerados.
                    </Text>

                    <Checkbox
                      label="Continuar aportes após a compra do imóvel"
                      description="No cenário 'Investir e comprar à vista', se marcado, os aportes programados continuam mesmo após a compra"
                      {...form.getInputProps("continue_contributions_after_purchase", {
                        type: "checkbox",
                      })}
                    />

                    <Divider color="ocean.2" />

                    <AmortizationsFieldArray
                      value={form.values.contributions || []}
                      onChange={(v: any) => form.setFieldValue("contributions", v)}
                      errors={form.errors}
                      fieldPath="contributions"
                      inflationRate={form.values.inflation_rate || undefined}
                      termMonths={form.values.loan_term_years * 12}
                      showFundingSource={false}
                      showScenarioSelector
                      scenarioOptions={[
                        { value: 'buy', label: 'Financiamento' },
                        { value: 'rent_invest', label: 'Alugar e Investir' },
                        { value: 'invest_buy', label: 'Comprar à Vista' },
                      ]}
                      uiText={{
                        configuredTitle: "Aportes Configurados",
                        emptyTitle: "Nenhum aporte programado",
                        emptyDescription:
                          "Adicione aportes programados para aumentar seus investimentos ao longo do tempo",
                        addButtonLabel: "Adicionar",
                        addEmptyButtonLabel: "Adicionar Aporte",
                        itemLabel: "Aporte",
                        percentageDescription: "Percentual do saldo investido",
                        previewTitle: "Pré-visualização dos Aportes",
                        percentageFootnote:
                          "* Valores percentuais dependem do saldo investido.",
                      }}
                    />
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="tributacao" pt="md">
                  <Text fw={600} size="sm" c="bright" mb="sm">
                    Tributação dos investimentos (opcional)
                  </Text>
                  <Grid gutter="lg" align="flex-end">
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Checkbox
                        label="Aplicar imposto sobre rendimentos"
                        description="Se ligado, aplica IR conforme o modo escolhido"
                        {...form.getInputProps("investment_tax.enabled", {
                          type: "checkbox",
                        })}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Select
                        label="Modo de tributação"
                        description="Mensal (aproximação) ou no resgate (mais realista)"
                        data={[
                          { value: "on_withdrawal", label: "No resgate (ganho realizado)" },
                          { value: "monthly", label: "Mensal (aproximação simples)" },
                        ]}
                        {...form.getInputProps("investment_tax.mode")}
                        disabled={!form.values.investment_tax?.enabled}
                        size="md"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="Alíquota efetiva"
                        description="Percentual sobre ganho (modo mensal/no resgate)"
                        placeholder="15"
                        {...form.getInputProps("investment_tax.effective_tax_rate")}
                        suffix="%"
                        min={0}
                        max={100}
                        disabled={!form.values.investment_tax?.enabled}
                        size="md"
                      />
                    </Grid.Col>
                  </Grid>
                  <Text size="xs" c="ocean.6" mt="md">
                    Esta é uma aproximação. O IR real depende do tipo de investimento e prazo.
                  </Text>
                </Tabs.Panel>
              </Tabs>
            </FormSection>
          )}

          {activeStep === 3 && (
            <FormSection
              title="Ajustes avançados (opcional)"
              description="Refine a simulação com parâmetros adicionais. Esses valores já têm padrões razoáveis."
              icon={<IconAdjustments size={20} />}
            >
              <Tabs value={adjustmentsTab} onChange={setAdjustmentsTab} variant="pills" color="ocean">
                <Tabs.List style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
                  <Tabs.Tab value="custos" leftSection={<IconCash size={16} />}>
                    Custos
                  </Tabs.Tab>
                  <Tabs.Tab value="inflacao" leftSection={<IconBuildingBank size={16} />}>
                    Inflação
                  </Tabs.Tab>
                  <Tabs.Tab value="amortizacoes" leftSection={<IconScale size={16} />}>
                    Amortizações
                  </Tabs.Tab>
                  <Tabs.Tab value="fgts-avancado" leftSection={<IconPigMoney size={16} />}>
                    FGTS avançado
                  </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="custos" pt="md">
                  <Text fw={600} size="sm" c="bright" mb="sm">
                    Custos de compra e posse do imóvel
                  </Text>
                  <Text size="xs" c="dimmed" mb="md">
                    ITBI e Escritura são custos de compra (pagos no momento da aquisição). Condomínio e IPTU são custos mensais de posse.
                  </Text>
                  <Grid gutter="lg">
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="ITBI"
                        description="Imposto de transmissão (% do valor do imóvel)"
                        placeholder="2"
                        min={0}
                        max={100}
                        suffix="%"
                        decimalScale={2}
                        size="md"
                        {...form.getInputProps("additional_costs.itbi_percentage")}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="Escritura"
                        description="Custos cartorários (% do valor do imóvel)"
                        placeholder="1"
                        min={0}
                        max={100}
                        suffix="%"
                        decimalScale={2}
                        size="md"
                        {...form.getInputProps("additional_costs.deed_percentage")}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="Condomínio mensal"
                        description="Taxa de condomínio (se não se aplica, deixe 0)"
                        placeholder="R$ 0"
                        min={0}
                        thousandSeparator="."
                        decimalSeparator="," 
                        prefix="R$ "
                        size="md"
                        {...form.getInputProps("additional_costs.monthly_hoa")}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="IPTU mensal"
                        description="Valor mensal do IPTU (se não se aplica, deixe 0)"
                        placeholder="R$ 0"
                        min={0}
                        thousandSeparator="."
                        decimalSeparator="," 
                        prefix="R$ "
                        size="md"
                        {...form.getInputProps("additional_costs.monthly_property_tax")}
                      />
                    </Grid.Col>
                  </Grid>
                </Tabs.Panel>

                <Tabs.Panel value="inflacao" pt="md">
                  <Text size="xs" c="dimmed" mb="md">
                    Configure as taxas de inflação para atualizar os valores ao longo do tempo.
                  </Text>
                  <Grid gutter="lg">
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <LabelWithHelp
                        label="Inflação geral"
                        help="Taxa anual média usada para atualizar custos ao longo do tempo."
                      />
                      <NumberInput
                        mt={4}
                        placeholder="4"
                        {...form.getInputProps("inflation_rate")}
                        suffix="% a.a."
                        min={0}
                        max={1000}
                        size="md"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <LabelWithHelp
                        label="Inflação do aluguel"
                        help="Reajuste anual do aluguel. Use se diferente da inflação geral."
                      />
                      <NumberInput
                        mt={4}
                        placeholder="5"
                        {...form.getInputProps("rent_inflation_rate")}
                        suffix="% a.a."
                        min={0}
                        max={1000}
                        size="md"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <LabelWithHelp
                        label="Valorização do imóvel"
                        help="Estimativa anual de valorização do imóvel no mercado."
                      />
                      <NumberInput
                        mt={4}
                        placeholder="4"
                        {...form.getInputProps("property_appreciation_rate")}
                        suffix="% a.a."
                        min={0}
                        max={1000}
                        size="md"
                      />
                    </Grid.Col>
                  </Grid>
                </Tabs.Panel>

                <Tabs.Panel value="amortizacoes" pt="md">
                  <AmortizationsFieldArray
                    value={form.values.amortizations || []}
                    onChange={(v: any) => form.setFieldValue("amortizations", v)}
                    errors={form.errors}
                    fieldPath="amortizations"
                    inflationRate={form.values.inflation_rate || undefined}
                    termMonths={form.values.loan_term_years * 12}
                  />
                </Tabs.Panel>

                <Tabs.Panel value="fgts-avancado" pt="md">
                  <Text size="xs" c="dimmed" mb="md">
                    Configure opções avançadas do FGTS. O saldo inicial e opção de uso na compra estão no primeiro passo.
                  </Text>
                  <Grid gutter="lg">
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="Rendimento FGTS"
                        description="Taxa anual de rendimento do FGTS (padrão: TR + 3%)"
                        placeholder="3"
                        {...form.getInputProps("fgts.annual_yield_rate")}
                        suffix="% a.a."
                        min={0}
                        max={100}
                        size="md"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="Limite de saque"
                        description="Máximo a usar na compra (deixe vazio para sem limite)"
                        placeholder="Sem limite"
                        {...form.getInputProps("fgts.max_withdrawal_at_purchase")}
                        thousandSeparator="."
                        decimalSeparator="," 
                        prefix="R$ "
                        min={0}
                        size="md"
                      />
                    </Grid.Col>
                  </Grid>
                </Tabs.Panel>
              </Tabs>
            </FormSection>
          )}
        </FormWizard>

        {/* Review and primary action only appear at the end of the guided flow. */}
        {activeStep === 3 && (
        <Paper withBorder radius="xl" p={{ base: 'md', sm: 'lg' }} mt="xl">
          <Stack gap="md">
            <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
              <Group gap="sm">
                <ThemeIcon size={32} radius="lg" variant="light" color="ocean">
                  <IconScale size={16} />
                </ThemeIcon>
                <Box>
                  <Text fw={600} size="sm" c="bright">
                    Revise e simule
                  </Text>
                  <Text size="xs" c="dimmed">
                    Os principais números reunidos antes de gerar o resultado
                  </Text>
                </Box>
              </Group>
            </Group>
            
            <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="md">
              {Number(form.values.monthly_net_income || 0) > 0 && (
                <Tooltip label="Orçamento mensal disponível após despesas de vida" withArrow>
                  <Box style={{ cursor: 'help' }}>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                      Orçamento
                    </Text>
                    <Text size="sm" fw={600} c="teal.6">
                      {money(Number(form.values.monthly_net_income || 0))}
                    </Text>
                  </Box>
                </Tooltip>
              )}
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                  Imóvel
                </Text>
                <Text size="sm" fw={600} c="bright">
                  {money(propertyValue)}
                </Text>
              </Box>
              <Tooltip label="Entrada em dinheiro (FGTS é somado separadamente)" withArrow>
                <Box style={{ cursor: 'help' }}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                    Entrada
                  </Text>
                  <Text size="sm" fw={600} c="bright">
                    {money(downPayment)} ({downPaymentPct.toFixed(0)}%)
                  </Text>
                </Box>
              </Tooltip>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                  Financiado
                </Text>
                <Text size="sm" fw={600} c="ocean.7">
                  {money(loanAmount)}
                </Text>
              </Box>
              {upfrontCosts > 0 && (
                <Tooltip label="ITBI + Escritura (custos de compra)" withArrow>
                  <Box style={{ cursor: 'help' }}>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                      Custos
                    </Text>
                    <Text size="sm" fw={600} c="warning.6">
                      {money(upfrontCosts)}
                    </Text>
                  </Box>
                </Tooltip>
              )}
              {totalSavingsProvided && (
                <Tooltip 
                  label={`Patrimônio - Entrada - Custos = Capital para investir`}
                  withArrow
                >
                  <Box style={{ cursor: 'help' }}>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                      Investir
                    </Text>
                    <Text size="sm" fw={600} c={insufficientSavings ? 'danger.6' : 'ocean.7'}>
                      {insufficientSavings ? 'Insuficiente' : money(initialInvestment)}
                    </Text>
                  </Box>
                </Tooltip>
              )}
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                  Aluguel
                </Text>
                <Text size="sm" fw={600} c="ocean.7">
                  {rentValue > 0
                    ? money(rentValue)
                    : rentPercentage > 0
                      ? `${rentPercentage.toFixed(2)}% a.m. (~${money(rentFromPct)})`
                      : '—'}
                </Text>
              </Box>
            </SimpleGrid>

            {/* Warning when savings are insufficient */}
            {insufficientSavings && (
              <Box 
                p="sm" 
                style={{ 
                  backgroundColor: 'var(--mantine-color-danger-0)', 
                  borderRadius: 'var(--mantine-radius-md)',
                  border: '1px solid var(--mantine-color-danger-3)'
                }}
              >
                <Text size="sm" c="danger.7" fw={500}>
                  ⚠️ Patrimônio insuficiente
                </Text>
                <Text size="xs" c="danger.6">
                  Você precisa de {money(minRequiredSavings)} ({money(downPayment)} entrada + {money(upfrontCosts)} custos).
                </Text>
              </Box>
            )}

            <Divider color="var(--mantine-color-default-border)" />

            <Button
              type="submit"
              loading={loading}
              size="lg"
              radius="lg"
              fullWidth
              rightSection={<IconArrowRight size={18} />}
              mih={52}
            >
              Gerar comparação
            </Button>
          </Stack>
        </Paper>
        )}
      </form>

      {/* Single Simulation Results */}
      {data && viewMode === 'single-result' && (
        <Box id="results-section" pt="xl">
          <Suspense fallback={<ResultsFallback label="Preparando resultados…" />}>
            <EnhancedComparisonResults
              result={data}
              inputPayload={lastInput || undefined}
            />
          </Suspense>
        </Box>
      )}

      {/* Batch Comparison Results */}
      {batchResult && viewMode === 'batch-result' && (
        <Box ref={batchResultsRef} id="batch-results-section" pt="xl">
          <Suspense fallback={<ResultsFallback label="Preparando comparação de presets…" />}>
            <BatchComparisonResults
              result={batchResult}
              presetInputs={batchInputs}
              onBack={handleBackFromBatch}
            />
          </Suspense>
        </Box>
      )}
    </Stack>
  );
}
