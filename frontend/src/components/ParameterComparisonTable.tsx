import { useMemo, useState, useCallback } from 'react';
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
  Divider,
  rem,
  Tooltip,
  SimpleGrid,
  UnstyledButton,
  Collapse,
  Loader,
} from '@mantine/core';
import {
  IconAdjustments,
  IconArrowRight,
  IconBulb,
  IconChartBar,
  IconEqual,
  IconArrowsExchange,
  IconTarget,
  IconTrendingUp,
  IconCoin,
  IconPercentage,
  IconHome,
  IconCalendar,
  IconPigMoney,
  IconReceipt,
  IconScale,
  IconChevronDown,
  IconChevronRight,
  IconChartAreaLine,
} from '@tabler/icons-react';
import {
  BatchComparisonResult,
  BatchComparisonResultItem,
  ComparisonInput,
  SensitivityAnalysisResult,
  SensitivityParameterType,
} from '../api/types';
import { runSensitivityAnalysis } from '../api/financeApi';
import { money, percent, moneyCompact } from '../utils/format';
import { Preset } from '../utils/presets';
import SensitivityChart from './SensitivityChart';

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
    label: 'Entrada',
    category: 'property',
    format: 'money',
    icon: <IconCoin size={14} />,
  },
  {
    key: 'total_savings',
    label: 'Patrimônio Total',
    category: 'property',
    format: 'money_or_null',
    icon: <IconPigMoney size={14} />,
  },
  {
    key: 'loan_term_years',
    label: 'Prazo do Financiamento',
    category: 'financing',
    format: 'years',
    icon: <IconCalendar size={14} />,
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
    key: 'additional_costs.monthly_hoa',
    nestedKey: 'monthly_hoa',
    label: 'Condomínio Mensal',
    category: 'costs',
    format: 'money_or_null',
    icon: <IconReceipt size={14} />,
  },
  {
    key: 'additional_costs.monthly_property_tax',
    nestedKey: 'monthly_property_tax',
    label: 'IPTU Mensal',
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
function getDefaultRange(
  paramKey: string,
  currentValue: number
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
  let min = currentValue * config.minFactor;
  let max = currentValue * config.maxFactor;
  
  // Special handling for certain parameters
  if (paramKey === 'loan_term_years') {
    min = Math.max(5, Math.floor(min));
    max = Math.min(35, Math.ceil(max));
  } else if (paramKey.includes('rate')) {
    min = Math.max(0.5, min);
    max = Math.min(30, max);
  } else if (paramKey === 'down_payment' || paramKey === 'property_value' || paramKey === 'rent_value') {
    min = Math.max(0, min);
  }

  return { min, max, steps: config.steps };
}

// Helper to get value from input (handles nested keys)
function getParameterValue(input: ComparisonInput, param: ParameterDefinition): unknown {
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
      return (costs as Record<string, unknown>)[param.nestedKey];
    }
    return null;
  }

  return (input as unknown as Record<string, unknown>)[param.key];
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
      return value ? money(Number(value)) : '—';
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

// Estimate impact of parameter difference on final wealth
interface ImpactEstimate {
  param: ParameterDefinition;
  delta: number;
  estimatedImpact: number;
  impactPercentage: number;
  description: string;
}

function estimateParameterImpact(
  inputs: ComparisonInput[],
  results: BatchComparisonResultItem[],
  param: ParameterDefinition
): ImpactEstimate | null {
  if (inputs.length !== 2 || results.length !== 2) return null;

  const value1 = getParameterValue(inputs[0], param);
  const value2 = getParameterValue(inputs[1], param);
  const deltaInfo = calculateDelta(value1, value2, param.format);

  if (!deltaInfo.hasDiff || deltaInfo.delta === null) return null;

  // Get best wealth from each preset
  const wealth1 = results[0].result.scenarios.find(
    (s) => s.name === results[0].result.best_scenario
  )?.final_wealth ?? 0;
  const wealth2 = results[1].result.scenarios.find(
    (s) => s.name === results[1].result.best_scenario
  )?.final_wealth ?? 0;

  const wealthDiff = wealth2 - wealth1;

  // Simple heuristic: attribute impact proportionally to the delta magnitude
  // This is a rough estimate - real sensitivity would require running simulations
  const estimatedImpact = wealthDiff;
  const impactPercentage = wealth1 !== 0 ? (wealthDiff / wealth1) * 100 : 0;

  return {
    param,
    delta: deltaInfo.delta,
    estimatedImpact,
    impactPercentage,
    description: `A variação de ${deltaInfo.formatted} em ${param.label}`,
  };
}

// Find the most impactful parameter
function findMostImpactfulParameter(
  inputs: ComparisonInput[],
  results: BatchComparisonResultItem[]
): { param: ParameterDefinition; impact: ImpactEstimate } | null {
  if (inputs.length !== 2) return null;

  // Calculate estimated impact for each different parameter
  const impacts: { param: ParameterDefinition; impact: ImpactEstimate }[] = [];

  for (const param of PARAMETER_DEFINITIONS) {
    const value1 = getParameterValue(inputs[0], param);
    const value2 = getParameterValue(inputs[1], param);
    const deltaInfo = calculateDelta(value1, value2, param.format);

    if (deltaInfo.hasDiff && deltaInfo.delta !== null) {
      const impact = estimateParameterImpact(inputs, results, param);
      if (impact) {
        impacts.push({ param, impact });
      }
    }
  }

  if (impacts.length === 0) return null;

  // For simplicity, we'll prioritize key financial parameters
  // In reality, this would need actual sensitivity analysis
  const priorityParams = [
    'annual_interest_rate',
    'investment_returns_rate',
    'down_payment',
    'property_value',
    'rent_value',
    'rent_percentage',
  ];

  // Sort by priority, then by absolute delta magnitude
  impacts.sort((a, b) => {
    const priorityA = priorityParams.indexOf(a.param.key);
    const priorityB = priorityParams.indexOf(b.param.key);

    if (priorityA !== -1 && priorityB !== -1) {
      return priorityA - priorityB;
    }
    if (priorityA !== -1) return -1;
    if (priorityB !== -1) return 1;

    return Math.abs(b.impact.delta) - Math.abs(a.impact.delta);
  });

  return impacts[0];
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

  // Use first preset input as base for sensitivity analysis
  const baseInput = presetInputs[0] || null;

  // Handle parameter row click for sensitivity analysis
  const handleParamClick = useCallback(
    async (paramKey: string) => {
      // Toggle if already expanded
      if (expandedParam === paramKey) {
        setExpandedParam(null);
        return;
      }

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
      if (isNaN(numValue) || numValue === 0) return;

      // Get default range
      const range = getDefaultRange(paramKey, numValue);

      // Run sensitivity analysis
      setSensitivityLoading(paramKey);
      try {
        const result = await runSensitivityAnalysis({
          base_input: baseInput,
          parameter: sensitivityParam,
          range: {
            min_value: range.min,
            max_value: range.max,
            steps: range.steps,
          },
        });
        setSensitivityData((prev) => ({ ...prev, [paramKey]: result }));
      } catch (e: any) {
        setSensitivityError(e.toString());
      } finally {
        setSensitivityLoading(null);
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

  // Calculate most impactful parameter (for 2 presets)
  const mostImpactful = useMemo(() => {
    if (presetInputs.length === 2 && results.length === 2) {
      return findMostImpactfulParameter(presetInputs, results);
    }
    return null;
  }, [presetInputs, results]);

  // Calculate wealth difference
  const wealthComparison = useMemo(() => {
    if (results.length < 2) return null;

    const wealthValues = results.map((r) => {
      const best = r.result.scenarios.find((s) => s.name === r.result.best_scenario);
      return {
        presetName: r.preset_name,
        wealth: best?.final_wealth ?? 0,
      };
    });

    const sorted = [...wealthValues].sort((a, b) => b.wealth - a.wealth);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const diff = best.wealth - worst.wealth;

    return { best, worst, diff };
  }, [results]);

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
        p="lg"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: 'var(--glass-shadow), var(--glass-shadow-glow)',
          borderRadius: 'var(--mantine-radius-xl)',
        }}
      >
        <Group gap="sm" mb="lg">
          <ThemeIcon
            size="lg"
            radius="md"
            variant="gradient"
            gradient={{ from: 'grape.5', to: 'grape.7', deg: 135 }}
          >
            <IconAdjustments size={20} />
          </ThemeIcon>
          <Box>
            <Text fw={600} size="lg">
              Análise de Parâmetros
            </Text>
            <Text size="xs" c="dimmed">
              Compare as configurações de cada preset e identifique diferenças-chave
            </Text>
          </Box>
        </Group>

        {/* Quick Stats */}
        <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md">
          <Paper p="md" radius="md" withBorder>
            <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
              Presets Comparados
            </Text>
            <Text size="xl" fw={700}>
              {results.length}
            </Text>
          </Paper>
          <Paper p="md" radius="md" withBorder>
            <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
              Parâmetros Diferentes
            </Text>
            <Text size="xl" fw={700} c={parametersWithDiffs.size > 0 ? 'orange' : 'ocean'}>
              {parametersWithDiffs.size}
            </Text>
          </Paper>
          {wealthComparison && (
            <Paper p="md" radius="md" withBorder>
              <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                Diferença Máxima de Patrimônio
              </Text>
              <Text size="xl" fw={700} c="ocean.7">
                {moneyCompact(wealthComparison.diff)}
              </Text>
            </Paper>
          )}
        </SimpleGrid>
      </Box>

      {/* Most Impactful Parameter (for 2 presets) */}
      {mostImpactful && wealthComparison && (
        <Paper
          p="lg"
          radius="lg"
          style={{
            border: '2px solid var(--mantine-color-grape-4)',
            backgroundColor:
              'light-dark(var(--mantine-color-grape-0), var(--mantine-color-dark-7))',
          }}
        >
          <Group gap="md" mb="md">
            <ThemeIcon size="xl" radius="md" variant="light" color="grape">
              <IconTarget size={24} />
            </ThemeIcon>
            <Box>
              <Text fw={700} size="lg">
                Parâmetro Mais Impactante
              </Text>
              <Text size="sm" c="dimmed">
                A diferença que mais influencia o resultado final
              </Text>
            </Box>
          </Group>

          <Box
            p="md"
            style={{
              background: 'light-dark(rgba(255, 255, 255, 0.5), rgba(15, 23, 42, 0.5))',
              borderRadius: 'var(--mantine-radius-lg)',
              boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.08)',
            }}
          >
            <Group justify="space-between" wrap="wrap" gap="md">
              <Box>
                <Group gap="xs" mb={4}>
                  {mostImpactful.param.icon}
                  <Text fw={600}>{mostImpactful.param.label}</Text>
                </Group>
                <Group gap="xs">
                  <Badge color="gray" variant="light">
                    {formatValue(
                      getParameterValue(presetInputs[0], mostImpactful.param),
                      mostImpactful.param.format
                    )}
                  </Badge>
                  <IconArrowRight size={14} color="var(--mantine-color-dimmed)" />
                  <Badge color="grape" variant="light">
                    {formatValue(
                      getParameterValue(presetInputs[1], mostImpactful.param),
                      mostImpactful.param.format
                    )}
                  </Badge>
                </Group>
              </Box>
              <Box ta="right">
                <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                  Diferença no Patrimônio Final
                </Text>
                <Text fw={700} size="xl" c={wealthComparison.diff > 0 ? 'ocean.7' : 'red.6'}>
                  {money(wealthComparison.diff)}
                </Text>
              </Box>
            </Group>
          </Box>

          <Alert
            color="grape"
            variant="light"
            icon={<IconBulb size={16} />}
            mt="md"
          >
            <Text size="sm">
              <Text span fw={600}>Dica:</Text>{' '}
              {mostImpactful.param.key === 'annual_interest_rate' && (
                <>
                  Negociar uma taxa de juros menor pode ter um impacto significativo no seu patrimônio final.
                  Considere pesquisar diferentes instituições financeiras.
                </>
              )}
              {mostImpactful.param.key === 'investment_returns_rate' && (
                <>
                  O retorno dos seus investimentos é crucial. Avalie sua estratégia de investimentos e
                  considere diversificar para otimizar retornos.
                </>
              )}
              {mostImpactful.param.key === 'down_payment' && (
                <>
                  O valor da entrada impacta diretamente o valor financiado e os juros totais.
                  Uma entrada maior reduz o custo total do financiamento.
                </>
              )}
              {mostImpactful.param.key === 'property_value' && (
                <>
                  O valor do imóvel é o principal fator no custo total. Considere avaliar
                  imóveis em faixas de preço diferentes.
                </>
              )}
              {mostImpactful.param.key === 'rent_value' && (
                <>
                  O valor do aluguel afeta diretamente a atratividade do cenário de alugar e investir.
                  Aluguéis mais baixos tendem a favorecer essa estratégia.
                </>
              )}
              {!['annual_interest_rate', 'investment_returns_rate', 'down_payment', 'property_value', 'rent_value'].includes(mostImpactful.param.key) && (
                <>
                  Este parâmetro tem impacto relevante no resultado. Analise cuidadosamente as
                  opções disponíveis para otimizar sua decisão.
                </>
              )}
            </Text>
          </Alert>
        </Paper>
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
            p="lg"
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: 'var(--glass-shadow), var(--glass-shadow-glow)',
              borderRadius: 'var(--mantine-radius-xl)',
            }}
          >
            <Group gap="sm" mb="md">
              <ThemeIcon size="md" radius="md" variant="light" color="ocean">
                {categoryInfo.icon}
              </ThemeIcon>
              <Text fw={600}>{categoryInfo.label}</Text>
            </Group>

            <ScrollArea>
              <Table striped highlightOnHover>
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
                    const canExpand = SENSITIVITY_ENABLED_PARAMS.has(param.key);
                    const isExpanded = expandedParam === param.key;
                    const isLoading = sensitivityLoading === param.key;

                    let deltaInfo = null;
                    if (values.length === 2) {
                      deltaInfo = calculateDelta(values[0], values[1], param.format);
                    }

                    return (
                      <>
                        <Table.Tr
                          key={param.key}
                          style={{
                            backgroundColor: isExpanded
                              ? 'light-dark(var(--mantine-color-grape-0), var(--mantine-color-dark-6))'
                              : hasDiff
                                ? 'light-dark(var(--mantine-color-orange-0), var(--mantine-color-dark-6))'
                                : undefined,
                            cursor: canExpand ? 'pointer' : undefined,
                          }}
                          onClick={canExpand ? () => handleParamClick(param.key) : undefined}
                        >
                          <Table.Td>
                            <Group gap="xs">
                              {canExpand && (
                                <ThemeIcon
                                  size="xs"
                                  radius="sm"
                                  variant="subtle"
                                  color={isExpanded ? 'grape' : 'gray'}
                                >
                                  {isLoading ? (
                                    <Loader size={10} color="grape" />
                                  ) : isExpanded ? (
                                    <IconChevronDown size={12} />
                                  ) : (
                                    <IconChevronRight size={12} />
                                  )}
                                </ThemeIcon>
                              )}
                              {param.icon}
                              <Tooltip
                                label={
                                  canExpand
                                    ? `${param.description || param.label} — Clique para análise de sensibilidade`
                                    : param.description || param.label
                                }
                                withArrow
                              >
                                <Text
                                  size="sm"
                                  style={{ cursor: canExpand ? 'pointer' : 'help' }}
                                  fw={isExpanded ? 600 : undefined}
                                >
                                  {param.label}
                                </Text>
                              </Tooltip>
                              {canExpand && (
                                <Tooltip label="Clique para ver análise de sensibilidade">
                                  <ThemeIcon
                                    size="xs"
                                    radius="xl"
                                    variant="light"
                                    color="grape"
                                  >
                                    <IconChartAreaLine size={10} />
                                  </ThemeIcon>
                                </Tooltip>
                              )}
                              {hasDiff && (
                                <Badge size="xs" color="orange" variant="filled">
                                  Diferente
                                </Badge>
                              )}
                            </Group>
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
                                <IconEqual size={14} color="var(--mantine-color-dimmed)" />
                              )}
                            </Table.Td>
                          )}
                        </Table.Tr>

                        {/* Expanded Sensitivity Analysis Row */}
                        {isExpanded && canExpand && (
                          <Table.Tr key={`${param.key}-sensitivity`}>
                            <Table.Td
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
                                    variant="gradient"
                                    gradient={{ from: 'grape.5', to: 'grape.7', deg: 135 }}
                                  >
                                    <IconChartAreaLine size={14} />
                                  </ThemeIcon>
                                  <Box>
                                    <Text size="sm" fw={600}>
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
                      </>
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
          <Text span fw={600}>Análise de Sensibilidade:</Text> Clique em qualquer parâmetro com o ícone{' '}
          <ThemeIcon size="xs" radius="xl" variant="light" color="grape" display="inline-flex" style={{ verticalAlign: 'middle' }}>
            <IconChartAreaLine size={10} />
          </ThemeIcon>{' '}
          para ver como os resultados mudam ao variar esse valor. Parâmetros destacados em{' '}
          <Badge size="xs" color="orange" variant="filled">
            Diferente
          </Badge>{' '}
          variam entre os presets.
        </Text>
      </Alert>
    </Stack>
  );
}
