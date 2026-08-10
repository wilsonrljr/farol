import { Fragment, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Paper,
  Stack,
  Group,
  Text,
  Box,
  ThemeIcon,
  Badge,
  Table,
  ScrollArea,
  Alert,
  rem,
  SimpleGrid,
  UnstyledButton,
  Loader,
} from '@mantine/core';
import {
  IconAdjustments,
  IconBulb,
  IconChartBar,
  IconEqual,
  IconArrowsExchange,
  IconTrendingUp,
  IconCoin,
  IconPercentage,
  IconHome,
  IconCalendar,
  IconPigMoney,
  IconReceipt,
  IconChevronDown,
  IconChevronRight,
  IconChartAreaLine,
} from '@tabler/icons-react';
import {
  BatchComparisonResult,
  ComparisonInput,
  SensitivityAnalysisResult,
  SensitivityParameterType,
} from '../api/types';
import { runSensitivityAnalysis } from '../api/financeApi';
import { isRequestCancelled, toApiError } from '../api/client';
import { money, percent, moneyCompact } from '../utils/format';
import SensitivityChart from './SensitivityChart';

const RESULT_SURFACE_STYLE = {
  background: 'var(--farol-surface-raised)',
  border: '1px solid var(--farol-border)',
  borderRadius: 'var(--mantine-radius-lg)',
  boxShadow: 'none',
} as const;

// Define parameter metadata for display
interface ParameterDefinition {
  key: keyof ComparisonInput | string;
  label: string;
  category: 'property' | 'financing' | 'investment' | 'costs' | 'advanced';
  format: 'money' | 'percent' | 'years' | 'text' | 'boolean' | 'money_or_null';
  icon: React.ReactNode;
  description?: string;
  // For nested values like additional_costs.itbi_percentage
  nestedKey?: string;
}

const PARAMETER_DEFINITIONS: ParameterDefinition[] = [
  // Property & Financing
  {
    key: 'property_value',
    label: 'Valor do Imóvel',
    category: 'property',
    format: 'money',
    icon: <IconHome size={14} />,
  },
  {
    key: 'down_payment',
    label: 'Entrada em dinheiro',
    category: 'property',
    format: 'money',
    icon: <IconCoin size={14} />,
  },
  {
    key: 'total_savings',
    label: 'Dinheiro disponível hoje',
    category: 'property',
    format: 'money_or_null',
    icon: <IconPigMoney size={14} />,
    description: 'Recursos em dinheiro fora do FGTS e da reserva de emergência',
  },
  {
    key: 'loan_term_years',
    label: 'Prazo do Financiamento',
    category: 'financing',
    format: 'years',
    icon: <IconCalendar size={14} />,
  },
  {
    key: 'comparison_horizon_years',
    label: 'Horizonte da Comparação',
    category: 'financing',
    format: 'years',
    icon: <IconCalendar size={14} />,
    description: 'Data do corte patrimonial, independente do prazo do financiamento',
  },
  {
    key: 'annual_interest_rate',
    label: 'Taxa de Juros (a.a.)',
    category: 'financing',
    format: 'percent',
    icon: <IconPercentage size={14} />,
    description: 'Taxa anual de juros do financiamento',
  },
  {
    key: 'monthly_interest_rate',
    label: 'Taxa de Juros (a.m.)',
    category: 'financing',
    format: 'percent',
    icon: <IconPercentage size={14} />,
    description: 'Taxa mensal informada diretamente no financiamento',
  },
  {
    key: 'loan_type',
    label: 'Sistema de Amortização',
    category: 'financing',
    format: 'text',
    icon: <IconChartBar size={14} />,
  },
  // Rent & Investment
  {
    key: 'rent_value',
    label: 'Aluguel (R$ / mês)',
    category: 'investment',
    format: 'money_or_null',
    icon: <IconReceipt size={14} />,
  },
  {
    key: 'rent_percentage',
    label: 'Aluguel (% do imóvel, a.m.)',
    category: 'investment',
    format: 'percent',
    icon: <IconReceipt size={14} />,
    description: 'Percentual mensal aplicado ao valor do imóvel para estimar o aluguel',
  },
  {
    key: 'investment_returns_rate',
    label: 'Retorno do Investimento (a.a.)',
    category: 'investment',
    format: 'percent',
    icon: <IconTrendingUp size={14} />,
    description: 'Taxa principal de retorno do investimento',
  },
  // Rates
  {
    key: 'inflation_rate',
    label: 'Inflação (a.a.)',
    category: 'costs',
    format: 'percent',
    icon: <IconPercentage size={14} />,
  },
  {
    key: 'rent_inflation_rate',
    label: 'Inflação do Aluguel (a.a.)',
    category: 'costs',
    format: 'percent',
    icon: <IconPercentage size={14} />,
  },
  {
    key: 'property_appreciation_rate',
    label: 'Valorização do Imóvel (a.a.)',
    category: 'costs',
    format: 'percent',
    icon: <IconTrendingUp size={14} />,
  },
  // Additional Costs
  {
    key: 'additional_costs.itbi_percentage',
    nestedKey: 'itbi_percentage',
    label: 'ITBI',
    category: 'costs',
    format: 'percent',
    icon: <IconReceipt size={14} />,
  },
  {
    key: 'additional_costs.deed_percentage',
    nestedKey: 'deed_percentage',
    label: 'Escritura/Registro',
    category: 'costs',
    format: 'percent',
    icon: <IconReceipt size={14} />,
  },
  {
    key: 'additional_costs.owner_monthly_costs.hoa',
    nestedKey: 'owner_monthly_costs.hoa',
    label: 'Condomínio — proprietário',
    category: 'costs',
    format: 'money_or_null',
    icon: <IconReceipt size={14} />,
  },
  {
    key: 'additional_costs.owner_monthly_costs.property_tax',
    nestedKey: 'owner_monthly_costs.property_tax',
    label: 'IPTU — proprietário',
    category: 'costs',
    format: 'money_or_null',
    icon: <IconReceipt size={14} />,
  },
  {
    key: 'additional_costs.owner_monthly_costs.other',
    nestedKey: 'owner_monthly_costs.other',
    label: 'Outros custos — proprietário',
    category: 'costs',
    format: 'money_or_null',
    icon: <IconReceipt size={14} />,
  },
  {
    key: 'additional_costs.renter_monthly_costs.hoa',
    nestedKey: 'renter_monthly_costs.hoa',
    label: 'Condomínio — inquilino',
    category: 'costs',
    format: 'money_or_null',
    icon: <IconReceipt size={14} />,
  },
  {
    key: 'additional_costs.renter_monthly_costs.property_tax',
    nestedKey: 'renter_monthly_costs.property_tax',
    label: 'IPTU — inquilino',
    category: 'costs',
    format: 'money_or_null',
    icon: <IconReceipt size={14} />,
  },
  {
    key: 'additional_costs.renter_monthly_costs.other',
    nestedKey: 'renter_monthly_costs.other',
    label: 'Outros custos — inquilino',
    category: 'costs',
    format: 'money_or_null',
    icon: <IconReceipt size={14} />,
  },
];

// Map parameter keys to sensitivity analysis parameter types
const SENSITIVITY_PARAMETER_MAP: Record<string, SensitivityParameterType> = {
  annual_interest_rate: 'annual_interest_rate',
  investment_returns_rate: 'investment_return_rate',
  down_payment: 'down_payment',
  property_value: 'property_value',
  rent_value: 'rent_value',
  inflation_rate: 'inflation_rate',
  property_appreciation_rate: 'property_appreciation_rate',
  loan_term_years: 'loan_term_years',
};

// Parameters that support sensitivity analysis
const SENSITIVITY_ENABLED_PARAMS = new Set(Object.keys(SENSITIVITY_PARAMETER_MAP));

// Default ranges for sensitivity analysis
export function getDefaultRange(
  paramKey: string,
  currentValue: number,
  input: ComparisonInput
): { min: number; max: number; steps: number } {
  const ranges: Record<string, { minFactor: number; maxFactor: number; steps: number }> = {
    annual_interest_rate: { minFactor: 0.6, maxFactor: 1.4, steps: 7 },
    investment_returns_rate: { minFactor: 0.5, maxFactor: 1.5, steps: 7 },
    down_payment: { minFactor: 0.5, maxFactor: 1.5, steps: 7 },
    property_value: { minFactor: 0.8, maxFactor: 1.2, steps: 5 },
    rent_value: { minFactor: 0.6, maxFactor: 1.4, steps: 7 },
    inflation_rate: { minFactor: 0.5, maxFactor: 2.0, steps: 7 },
    property_appreciation_rate: { minFactor: 0.5, maxFactor: 2.0, steps: 7 },
    loan_term_years: { minFactor: 0.5, maxFactor: 1.2, steps: 5 },
  };

  const config = ranges[paramKey] || { minFactor: 0.7, maxFactor: 1.3, steps: 7 };
  
  // Ensure minimum values are sensible
  let min = Math.min(
    currentValue * config.minFactor,
    currentValue * config.maxFactor
  );
  let max = Math.max(
    currentValue * config.minFactor,
    currentValue * config.maxFactor
  );
  let steps = config.steps;
  
  // Special handling for certain parameters
  if (paramKey === 'loan_term_years') {
    min = Math.max(1, Math.floor(min));
    max = Math.min(50, Math.ceil(max));
    const desiredSpan = config.steps - 1;
    if (max - min < desiredSpan) {
      max = Math.min(50, min + desiredSpan);
      min = Math.max(1, max - desiredSpan);
    }
    steps = Math.min(config.steps, max - min + 1);
  } else if (paramKey === 'investment_returns_rate') {
    min = Math.max(-99.9, min);
    max = Math.min(1000, max);
    if (min === max) max = Math.min(1000, min + 5);
  } else if (paramKey.includes('rate')) {
    min = Math.max(0, min);
    max = Math.min(1000, max);
    if (min === max) max = Math.min(1000, min + 5);
  } else if (paramKey === 'down_payment') {
    min = Math.max(0, min);
    let availableForDownPayment = input.property_value;
    if (input.total_savings != null) {
      const upfrontRate =
        ((input.additional_costs?.itbi_percentage ?? 2) +
          (input.additional_costs?.deed_percentage ?? 1)) /
        100;
      availableForDownPayment = Math.min(
        availableForDownPayment,
        input.total_savings - input.property_value * upfrontRate
      );
    }
    max = Math.min(Math.max(0, availableForDownPayment), max);
  } else if (paramKey === 'property_value') {
    min = Math.max(input.down_payment, min, Number.EPSILON);
    if (input.total_savings != null) {
      const upfrontRate =
        ((input.additional_costs?.itbi_percentage ?? 2) +
          (input.additional_costs?.deed_percentage ?? 1)) /
        100;
      if (upfrontRate > 0) {
        max = Math.min(max, (input.total_savings - input.down_payment) / upfrontRate);
      }
    }
  } else if (paramKey === 'rent_value') {
    min = Math.max(0, min);
    if (min === max) max = min + 1000;
  }

  if (min >= max) {
    let upperBound = Infinity;
    if (paramKey === 'down_payment') {
      const upfrontRate =
        ((input.additional_costs?.itbi_percentage ?? 2) +
          (input.additional_costs?.deed_percentage ?? 1)) /
        100;
      upperBound = Math.min(
        input.property_value,
        input.total_savings == null
          ? input.property_value
          : input.total_savings - input.property_value * upfrontRate
      );
    } else if (paramKey === 'property_value' && input.total_savings != null) {
      const upfrontRate =
        ((input.additional_costs?.itbi_percentage ?? 2) +
          (input.additional_costs?.deed_percentage ?? 1)) /
        100;
      if (upfrontRate > 0) {
        upperBound = (input.total_savings - input.down_payment) / upfrontRate;
      }
    }
    upperBound = Math.max(0, upperBound);
    const lowerBound = paramKey === 'property_value' ? Math.max(input.down_payment, Number.EPSILON) : 0;
    min = Math.max(lowerBound, Math.min(currentValue, upperBound) * 0.8);
    max = Math.min(upperBound, Math.max(currentValue + 1, currentValue * 1.2));
  }

  return { min, max, steps };
}

// Helper to get value from input (handles nested keys)
function getParameterValue(input: ComparisonInput, param: ParameterDefinition): unknown {
  if (param.key === 'comparison_horizon_years') {
    return input.comparison_horizon_years ?? input.loan_term_years;
  }
  if (param.key === 'annual_interest_rate') {
    if (input.annual_interest_rate != null) return input.annual_interest_rate;
    if (input.monthly_interest_rate != null) {
      return (Math.pow(1 + input.monthly_interest_rate / 100, 12) - 1) * 100;
    }
    return null;
  }

  if (param.key === 'rent_value') {
    if (input.rent_value != null) return input.rent_value;
    if (input.rent_percentage != null) {
      return input.property_value * input.rent_percentage / 100;
    }
    return null;
  }

  if (param.key === 'investment_returns_rate') {
    // Special case: get the first investment return rate
    const returns = input.investment_returns;
    if (returns && returns.length > 0) {
      return returns[0].annual_rate;
    }
    return null;
  }

  if (param.nestedKey && param.key.startsWith('additional_costs.')) {
    const costs = input.additional_costs;
    if (costs) {
      return param.nestedKey.split('.').reduce<unknown>((value, key) => {
        if (value === null || typeof value !== 'object') return null;
        return (value as Record<string, unknown>)[key];
      }, costs);
    }
    return null;
  }

  return (input as unknown as Record<string, unknown>)[param.key];
}

export function canAnalyzeSensitivity(paramKey: string, input: ComparisonInput | null): boolean {
  if (!input || !SENSITIVITY_ENABLED_PARAMS.has(paramKey)) return false;
  const purchaseNeed = Math.max(0, input.property_value - input.down_payment);
  const fgtsBalance = Math.max(0, input.fgts?.initial_balance ?? 0);
  const fgtsAtPurchase = input.fgts?.use_at_purchase
    ? Math.min(
        purchaseNeed,
        fgtsBalance,
        input.fgts.max_withdrawal_at_purchase == null
          ? fgtsBalance
          : Math.max(0, input.fgts.max_withdrawal_at_purchase)
      )
    : 0;
  const hasFinancedPrincipal = purchaseNeed - fgtsAtPurchase > 0;
  if (
    (paramKey === 'annual_interest_rate' || paramKey === 'loan_term_years') &&
    !hasFinancedPrincipal
  ) {
    return false;
  }
  if (paramKey === 'down_payment' || paramKey === 'property_value') {
    const explicitFinancingContract =
      input.loan_term_years != null &&
      input.loan_type != null &&
      Number(input.annual_interest_rate != null) +
        Number(input.monthly_interest_rate != null) ===
        1;
    if (!explicitFinancingContract) return false;
  }
  if (paramKey === 'investment_returns_rate' && input.investment_returns.length !== 1) {
    return false;
  }

  const definition = PARAMETER_DEFINITIONS.find((param) => param.key === paramKey);
  if (!definition) return false;
  const currentValue = Number(getParameterValue(input, definition));
  if (!Number.isFinite(currentValue)) return false;

  const { min, max, steps } = getDefaultRange(paramKey, currentValue, input);
  return Number.isFinite(min) && Number.isFinite(max) && min < max && steps >= 3;
}

// Format value for display
function formatValue(value: unknown, format: ParameterDefinition['format']): string {
  if (value === null || value === undefined) {
    return '—';
  }

  switch (format) {
    case 'money':
      return money(Number(value));
    case 'money_or_null':
      return Number.isFinite(Number(value)) ? money(Number(value)) : '—';
    case 'percent':
      return `${Number(value).toFixed(2)}%`;
    case 'years':
      return `${value} anos`;
    case 'boolean':
      return value ? 'Sim' : 'Não';
    case 'text':
    default:
      return String(value);
  }
}

// Calculate numeric delta between two values
function calculateDelta(
  value1: unknown,
  value2: unknown,
  format: ParameterDefinition['format']
): { hasDiff: boolean; delta: number | null; formatted: string } {
  const num1 = value1 !== null && value1 !== undefined ? Number(value1) : null;
  const num2 = value2 !== null && value2 !== undefined ? Number(value2) : null;

  if (num1 === null || num2 === null || isNaN(num1) || isNaN(num2)) {
    const hasDiff = String(value1) !== String(value2);
    return { hasDiff, delta: null, formatted: hasDiff ? 'Diferente' : '—' };
  }

  const delta = num2 - num1;
  const hasDiff = Math.abs(delta) > 0.001;

  if (!hasDiff) {
    return { hasDiff: false, delta: 0, formatted: '—' };
  }

  let formatted: string;
  switch (format) {
    case 'money':
    case 'money_or_null':
      formatted = `${delta > 0 ? '+' : ''}${money(delta)}`;
      break;
    case 'percent':
      formatted = `${delta > 0 ? '+' : ''}${delta.toFixed(2)}%`;
      break;
    case 'years':
      formatted = `${delta > 0 ? '+' : ''}${delta} anos`;
      break;
    default:
      formatted = `${delta > 0 ? '+' : ''}${delta}`;
  }

  return { hasDiff, delta, formatted };
}

interface ParameterComparisonTableProps {
  result: BatchComparisonResult;
  presetInputs: ComparisonInput[];
}

export default function ParameterComparisonTable({
  result,
  presetInputs,
}: ParameterComparisonTableProps) {
  const { results } = result;

  // Sensitivity analysis state
  const [expandedParam, setExpandedParam] = useState<string | null>(null);
  const [sensitivityData, setSensitivityData] = useState<Record<string, SensitivityAnalysisResult>>({});
  const [sensitivityLoading, setSensitivityLoading] = useState<string | null>(null);
  const [sensitivityError, setSensitivityError] = useState<string | null>(null);
  const sensitivityControllerRef = useRef<AbortController | null>(null);
  const sensitivityRequestIdRef = useRef(0);

  // Use first preset input as base for sensitivity analysis
  const baseInput = presetInputs[0] || null;
  const baseInputSignature = useMemo(() => JSON.stringify(baseInput), [baseInput]);

  useEffect(() => {
    sensitivityRequestIdRef.current += 1;
    sensitivityControllerRef.current?.abort();
    sensitivityControllerRef.current = null;
    setSensitivityData({});
    setSensitivityLoading(null);
    setSensitivityError(null);
    setExpandedParam(null);
  }, [baseInputSignature]);

  useEffect(
    () => () => {
      sensitivityRequestIdRef.current += 1;
      sensitivityControllerRef.current?.abort();
      sensitivityControllerRef.current = null;
    },
    []
  );

  // Handle parameter row click for sensitivity analysis
  const handleParamClick = useCallback(
    async (paramKey: string) => {
      if (!canAnalyzeSensitivity(paramKey, baseInput)) return;

      // Toggle if already expanded
      if (expandedParam === paramKey) {
        sensitivityRequestIdRef.current += 1;
        sensitivityControllerRef.current?.abort();
        sensitivityControllerRef.current = null;
        setSensitivityLoading(null);
        setExpandedParam(null);
        return;
      }

      sensitivityRequestIdRef.current += 1;
      sensitivityControllerRef.current?.abort();
      sensitivityControllerRef.current = null;
      setSensitivityLoading(null);
      setExpandedParam(paramKey);
      setSensitivityError(null);

      // Check if we already have data
      if (sensitivityData[paramKey]) {
        return;
      }

      // Check if sensitivity is supported for this param
      const sensitivityParam = SENSITIVITY_PARAMETER_MAP[paramKey];
      if (!sensitivityParam || !baseInput) {
        return;
      }

      // Get current value
      const paramDef = PARAMETER_DEFINITIONS.find((p) => p.key === paramKey);
      if (!paramDef) return;

      const currentValue = getParameterValue(baseInput, paramDef);
      if (currentValue === null || currentValue === undefined) return;

      const numValue = Number(currentValue);
      if (!Number.isFinite(numValue)) return;

      // Get default range
      const range = getDefaultRange(paramKey, numValue, baseInput);
      if (!(range.min < range.max)) return;

      // Run sensitivity analysis
      const controller = new AbortController();
      sensitivityControllerRef.current = controller;
      const requestId = ++sensitivityRequestIdRef.current;
      setSensitivityLoading(paramKey);
      try {
        const result = await runSensitivityAnalysis(
          {
            base_input: baseInput,
            parameter: sensitivityParam,
            range: {
              min_value: range.min,
              max_value: range.max,
              steps: range.steps,
            },
          },
          controller.signal
        );
        if (requestId !== sensitivityRequestIdRef.current || controller.signal.aborted) return;
        setSensitivityData((prev) => ({ ...prev, [paramKey]: result }));
      } catch (caught: unknown) {
        const error = await toApiError(caught);
        if (
          requestId !== sensitivityRequestIdRef.current ||
          controller.signal.aborted ||
          isRequestCancelled(error)
        ) return;
        setSensitivityError(error.message);
      } finally {
        if (requestId === sensitivityRequestIdRef.current) {
          setSensitivityLoading(null);
          if (sensitivityControllerRef.current === controller) {
            sensitivityControllerRef.current = null;
          }
        }
      }
    },
    [expandedParam, sensitivityData, baseInput]
  );

  // Group parameters by category
  const parametersByCategory = useMemo(() => {
    const groups: Record<string, ParameterDefinition[]> = {
      property: [],
      financing: [],
      investment: [],
      costs: [],
      advanced: [],
    };

    for (const param of PARAMETER_DEFINITIONS) {
      groups[param.category].push(param);
    }

    return groups;
  }, []);

  // Find parameters with differences
  const parametersWithDiffs = useMemo(() => {
    const diffs: Set<string> = new Set();

    if (presetInputs.length < 2) return diffs;

    const baseInput = presetInputs[0];
    for (let i = 1; i < presetInputs.length; i++) {
      for (const param of PARAMETER_DEFINITIONS) {
        const baseValue = getParameterValue(baseInput, param);
        const compareValue = getParameterValue(presetInputs[i], param);
        const delta = calculateDelta(baseValue, compareValue, param.format);
        if (delta.hasDiff) {
          diffs.add(param.key);
        }
      }
    }

    return diffs;
  }, [presetInputs]);

  // Descriptive spread among authoritative local winners. This deliberately
  // does not attribute causality when presets differ in multiple parameters.
  const wealthComparison = useMemo(() => {
    if (
      result.comparison_status === 'no_authoritative_result' ||
      results.length < 2 ||
      results.some(
        (item) =>
          item.result.comparison_status !== 'comparable' ||
          item.result.best_scenario_type == null
      )
    ) return null;

    const wealthValues = results.flatMap((r) => {
      const best = r.result.scenarios.find(
        (scenario) => scenario.scenario_type === r.result.best_scenario_type
      );
      if (!best) return [];
      return {
        presetName: r.preset_name,
        wealth: best.final_wealth ?? best.final_equity,
      };
    });
    if (wealthValues.length !== results.length) return null;

    const sorted = [...wealthValues].sort((a, b) => b.wealth - a.wealth);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const diff = best.wealth - worst.wealth;

    return { best, worst, diff };
  }, [result.comparison_status, results]);

  const categoryLabels: Record<string, { label: string; icon: React.ReactNode }> = {
    property: { label: 'Imóvel', icon: <IconHome size={16} /> },
    financing: { label: 'Financiamento', icon: <IconChartBar size={16} /> },
    investment: { label: 'Investimento', icon: <IconTrendingUp size={16} /> },
    costs: { label: 'Custos e Taxas', icon: <IconReceipt size={16} /> },
  };

  if (presetInputs.length === 0) {
    return (
      <Alert color="blue" variant="light" icon={<IconAdjustments size={16} />}>
        Dados de entrada dos presets não disponíveis para análise comparativa.
      </Alert>
    );
  }

  return (
    <Stack gap="lg">
      {/* Summary Header */}
      <Box
        component="section"
        aria-labelledby="parameter-comparison-title"
        p="lg"
        style={RESULT_SURFACE_STYLE}
      >
        <Group gap="sm" mb="lg">
          <ThemeIcon
            size="lg"
            radius="md"
            variant="light"
            color="violet"
          >
            <IconAdjustments size={20} />
          </ThemeIcon>
          <Box>
            <Text id="parameter-comparison-title" component="h3" fw={600} size="lg">
              Parâmetros dos presets
            </Text>
            <Text size="xs" c="dimmed">
              Veja o que mudou e, quando disponível, varie uma premissa por vez.
            </Text>
          </Box>
        </Group>

        {/* Quick Stats */}
        <SimpleGrid cols={{ base: 1, xs: wealthComparison ? 3 : 2 }} spacing="md">
          <Paper p="md" radius="md" shadow="none" withBorder>
            <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
              Presets Comparados
            </Text>
            <Text size="xl" fw={700}>
              {results.length}
            </Text>
          </Paper>
          <Paper p="md" radius="md" shadow="none" withBorder>
            <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
              Parâmetros Diferentes
            </Text>
            <Text size="xl" fw={700} c={parametersWithDiffs.size > 0 ? 'orange' : 'ocean'}>
              {parametersWithDiffs.size}
            </Text>
          </Paper>
          {wealthComparison && (
            <Paper p="md" radius="md" shadow="none" withBorder>
              <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                Diferença Máxima de Patrimônio
              </Text>
              <Text size="xl" fw={700} c="var(--farol-chart-1)">
                {moneyCompact(wealthComparison.diff)}
              </Text>
            </Paper>
          )}
        </SimpleGrid>
      </Box>

      {parametersWithDiffs.size > 1 && (
        <Alert color="grape" variant="light" icon={<IconBulb size={16} />}>
          <Text size="sm" fw={600}>Diferenças simultâneas não demonstram causalidade</Text>
          <Text size="xs">
            Como os presets alteram {parametersWithDiffs.size} parâmetros ao mesmo tempo, a diferença de patrimônio não pode ser atribuída a um único deles. Use a análise de sensibilidade abaixo para variar uma premissa por vez.
          </Text>
        </Alert>
      )}

      {/* Comparison Table by Category */}
      {Object.entries(parametersByCategory).map(([category, params]) => {
        if (params.length === 0) return null;
        const categoryInfo = categoryLabels[category];
        if (!categoryInfo) return null;

        // Filter to show only parameters that have differences or are important
        const relevantParams = params.filter((p) => {
          // Always show key parameters
          const keyParams = [
            'property_value',
            'down_payment',
            'annual_interest_rate',
            'monthly_interest_rate',
            'loan_type',
            'rent_value',
            'investment_returns_rate',
          ];
          if (keyParams.includes(p.key)) return true;
          // Show if there's a difference
          return parametersWithDiffs.has(p.key);
        });

        if (relevantParams.length === 0) return null;

        return (
          <Box
            key={category}
            component="section"
            aria-labelledby={`parameter-category-${category}`}
            p={{ base: 'md', sm: 'lg' }}
            style={RESULT_SURFACE_STYLE}
          >
            <Group gap="sm" mb="md">
              <ThemeIcon size="md" radius="md" variant="light" color="ocean">
                {categoryInfo.icon}
              </ThemeIcon>
              <Text id={`parameter-category-${category}`} component="h4" fw={600}>
                {categoryInfo.label}
              </Text>
            </Group>

            <ScrollArea type="auto" scrollbarSize={8} offsetScrollbars>
              <Table
                striped
                highlightOnHover
                miw={220 + results.length * 140 + (results.length === 2 ? 110 : 0)}
                aria-label={`Comparação de parâmetros: ${categoryInfo.label}`}
              >
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ minWidth: rem(220) }}>Parâmetro</Table.Th>
                    {results.map((r) => (
                      <Table.Th key={r.preset_id} ta="right" style={{ minWidth: rem(120) }}>
                        {r.preset_name}
                      </Table.Th>
                    ))}
                    {results.length === 2 && (
                      <Table.Th ta="center" style={{ minWidth: rem(100) }}>
                        Diferença
                      </Table.Th>
                    )}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {relevantParams.map((param) => {
                    const values = presetInputs.map((input) =>
                      getParameterValue(input, param)
                    );
                    const hasDiff = parametersWithDiffs.has(param.key);
                    const canExpand = canAnalyzeSensitivity(param.key, baseInput);
                    const isExpanded = expandedParam === param.key;
                    const isLoading = sensitivityLoading === param.key;

                    let deltaInfo = null;
                    if (values.length === 2) {
                      deltaInfo = calculateDelta(values[0], values[1], param.format);
                    }

                    const parameterContent = (
                      <Group gap="xs" wrap="nowrap">
                        {canExpand && (
                          <ThemeIcon
                            size="xs"
                            radius="sm"
                            variant="subtle"
                            color={isExpanded ? 'violet' : 'gray'}
                          >
                            {isLoading ? (
                              <Loader size={10} color="violet" />
                            ) : isExpanded ? (
                              <IconChevronDown size={12} />
                            ) : (
                              <IconChevronRight size={12} />
                            )}
                          </ThemeIcon>
                        )}
                        {param.icon}
                        <Box style={{ minWidth: 0 }}>
                          <Text size="sm" fw={isExpanded ? 600 : undefined}>
                            {param.label}
                          </Text>
                          {param.description && (
                            <Text size="xs" c="dimmed" lh={1.35}>
                              {param.description}
                            </Text>
                          )}
                        </Box>
                        {canExpand && (
                          <Badge
                            size="xs"
                            radius="sm"
                            variant="light"
                            color="violet"
                            leftSection={<IconChartAreaLine size={10} aria-hidden="true" />}
                          >
                            Sensibilidade
                          </Badge>
                        )}
                        {hasDiff && (
                          <Badge size="xs" color="orange" variant="light">
                            Diferente
                          </Badge>
                        )}
                      </Group>
                    );

                    return (
                      <Fragment key={param.key}>
                        <Table.Tr
                          style={{
                            backgroundColor: isExpanded
                              ? 'light-dark(var(--mantine-color-grape-0), var(--mantine-color-dark-6))'
                              : hasDiff
                                ? 'light-dark(var(--mantine-color-orange-0), var(--mantine-color-dark-6))'
                                : undefined,
                          }}
                        >
                          <Table.Td>
                            {canExpand ? (
                              <UnstyledButton
                                onClick={() => void handleParamClick(param.key)}
                                aria-label={`${isExpanded ? 'Fechar' : 'Abrir'} análise de sensibilidade de ${param.label}`}
                                aria-expanded={isExpanded}
                                aria-controls={`sensitivity-${param.key}`}
                                aria-busy={isLoading}
                                style={{ width: '100%', minHeight: rem(44), textAlign: 'left' }}
                              >
                                {parameterContent}
                              </UnstyledButton>
                            ) : parameterContent}
                          </Table.Td>
                          {values.map((value, idx) => (
                            <Table.Td key={idx} ta="right">
                              <Text size="sm" fw={hasDiff ? 600 : 400}>
                                {formatValue(value, param.format)}
                              </Text>
                            </Table.Td>
                          ))}
                          {results.length === 2 && deltaInfo && (
                            <Table.Td ta="center">
                              {deltaInfo.hasDiff ? (
                                <Badge
                                  color={
                                    deltaInfo.delta && deltaInfo.delta > 0 ? 'ocean' : 'orange'
                                  }
                                  variant="light"
                                  leftSection={<IconArrowsExchange size={10} />}
                                >
                                  {deltaInfo.formatted}
                                </Badge>
                              ) : (
                                <IconEqual size={14} color="var(--mantine-color-dimmed)" aria-hidden="true" />
                              )}
                            </Table.Td>
                          )}
                        </Table.Tr>

                        {/* Expanded Sensitivity Analysis Row */}
                        {isExpanded && canExpand && (
                          <Table.Tr key={`${param.key}-sensitivity`}>
                            <Table.Td
                              id={`sensitivity-${param.key}`}
                              colSpan={results.length + (results.length === 2 ? 2 : 1)}
                              style={{
                                backgroundColor:
                                  'light-dark(var(--mantine-color-grape-0), var(--mantine-color-dark-7))',
                                padding: rem(16),
                              }}
                            >
                              <Box>
                                <Group gap="sm" mb="md">
                                  <ThemeIcon
                                    size="sm"
                                    radius="md"
                                    variant="light"
                                    color="violet"
                                  >
                                    <IconChartAreaLine size={14} />
                                  </ThemeIcon>
                                  <Box>
                                    <Text component="h5" size="sm" fw={600}>
                                      Análise de Sensibilidade: {param.label}
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                      Como os resultados mudam ao variar este parâmetro
                                    </Text>
                                  </Box>
                                </Group>

                                <SensitivityChart
                                  result={sensitivityData[param.key] || null}
                                  isLoading={isLoading}
                                  error={isExpanded ? sensitivityError : null}
                                />
                              </Box>
                            </Table.Td>
                          </Table.Tr>
                        )}
                      </Fragment>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Box>
        );
      })}

      {/* Legend / Help */}
      <Alert color="grape" variant="light" icon={<IconChartAreaLine size={16} />}>
        <Text size="sm">
          <Text span fw={600}>Análise de sensibilidade:</Text> Selecione um parâmetro marcado com{' '}
          <ThemeIcon size="xs" radius="xl" variant="light" color="grape" display="inline-flex" style={{ verticalAlign: 'middle' }}>
            <IconChartAreaLine size={10} aria-hidden="true" />
          </ThemeIcon>{' '}
          para ver como os resultados mudam ao variar esse valor. Parâmetros destacados como{' '}
          <Badge size="xs" color="orange" variant="filled">
            Diferente
          </Badge>{' '}
          variam entre os presets.
        </Text>
      </Alert>
    </Stack>
  );
}
