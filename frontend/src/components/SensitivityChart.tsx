import { useMemo } from 'react';
import {
  Paper,
  Stack,
  Group,
  Text,
  Box,
  ThemeIcon,
  Badge,
  SimpleGrid,
  Loader,
  Alert,
  rem,
  Tooltip,
} from '@mantine/core';
import { LineChart } from '@mantine/charts';
import {
  IconTrendingUp,
  IconAlertCircle,
  IconArrowsShuffle,
  IconCrown,
  IconBuildingBank,
  IconChartLine,
  IconPigMoney,
} from '@tabler/icons-react';
import { SensitivityAnalysisResult, SensitivityDataPoint } from '../api/types';
import { money, moneyCompact, percent } from '../utils/format';

interface SensitivityChartProps {
  result: SensitivityAnalysisResult | null;
  isLoading?: boolean;
  error?: string | null;
  formatValue?: (value: number) => string;
}

const SCENARIO_COLORS: Record<string, string> = {
  'Comprar': 'var(--mantine-color-blue-6)',
  'Alugar e Investir': 'var(--mantine-color-sage-6)',
  'Investir e Comprar': 'var(--mantine-color-orange-6)',
};

const SCENARIO_ICONS: Record<string, React.ReactNode> = {
  'Comprar': <IconBuildingBank size={14} />,
  'Alugar e Investir': <IconChartLine size={14} />,
  'Investir e Comprar': <IconPigMoney size={14} />,
};

function getScenarioColor(name: string): string {
  for (const [key, color] of Object.entries(SCENARIO_COLORS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) {
      return color;
    }
  }
  return 'var(--mantine-color-gray-6)';
}

function getScenarioIcon(name: string): React.ReactNode {
  for (const [key, icon] of Object.entries(SCENARIO_ICONS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) {
      return icon;
    }
  }
  return <IconChartLine size={14} />;
}

export default function SensitivityChart({
  result,
  isLoading = false,
  error = null,
  formatValue,
}: SensitivityChartProps) {
  // Transform data for chart
  const chartData = useMemo(() => {
    if (!result) return [];

    return result.data_points.map((dp) => {
      const row: Record<string, number | string> = {
        value: dp.parameter_value,
      };

      for (const [scenarioName, scenario] of Object.entries(dp.scenarios)) {
        row[scenarioName] = scenario.final_wealth;
      }

      return row;
    });
  }, [result]);

  // Get scenario names for series
  const scenarioNames = useMemo(() => {
    if (!result || result.data_points.length === 0) return [];
    return Object.keys(result.data_points[0].scenarios);
  }, [result]);

  // Chart series configuration
  const series = useMemo(() => {
    return scenarioNames.map((name) => ({
      name,
      color: getScenarioColor(name),
    }));
  }, [scenarioNames]);

  // Value formatter for the parameter
  const paramFormatter = useMemo(() => {
    if (formatValue) return formatValue;

    if (!result) return (v: number) => String(v);

    // Detect parameter type and format accordingly
    const param = result.parameter;
    if (param.includes('rate') || param.includes('percentage')) {
      return (v: number) => `${v.toFixed(1)}%`;
    }
    if (param.includes('value') || param.includes('payment') || param.includes('rent')) {
      return (v: number) => moneyCompact(v);
    }
    if (param.includes('years')) {
      return (v: number) => `${v} anos`;
    }
    return (v: number) => v.toFixed(1);
  }, [result, formatValue]);

  if (isLoading) {
    return (
      <Paper p="lg" radius="md" withBorder>
        <Stack align="center" gap="md" py="xl">
          <Loader color="sage" size="md" />
          <Text size="sm" c="dimmed">
            Calculando análise de sensibilidade...
          </Text>
        </Stack>
      </Paper>
    );
  }

  if (error) {
    return (
      <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
        {error}
      </Alert>
    );
  }

  if (!result) {
    return null;
  }

  const hasBreakeven = result.breakeven_points.length > 0;

  return (
    <Stack gap="md">
      {/* Chart */}
      <Paper
        p="md"
        radius="md"
        style={{
          backgroundColor: 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))',
        }}
      >
        <Group gap="sm" mb="md">
          <ThemeIcon size="sm" radius="md" variant="light" color="grape">
            <IconTrendingUp size={14} />
          </ThemeIcon>
          <Text size="sm" fw={600}>
            Patrimônio Final × {result.parameter_label}
          </Text>
          {hasBreakeven && (
            <Tooltip label="Existem pontos onde o melhor cenário muda">
              <Badge
                size="xs"
                color="orange"
                variant="light"
                leftSection={<IconArrowsShuffle size={10} />}
              >
                {result.breakeven_points.length} ponto(s) de virada
              </Badge>
            </Tooltip>
          )}
        </Group>

        <LineChart
          h={220}
          data={chartData}
          dataKey="value"
          series={series}
          curveType="monotone"
          withLegend
          legendProps={{ verticalAlign: 'bottom' }}
          valueFormatter={(value) => moneyCompact(value)}
          xAxisProps={{
            tickFormatter: paramFormatter,
          }}
          referenceLines={[
            {
              x: result.base_value,
              label: 'Atual',
              color: 'var(--mantine-color-dimmed)',
            },
          ]}
          tooltipProps={{
            content: ({ payload, label }) => {
              if (!payload || payload.length === 0) return null;

              const dataPoint = result.data_points.find(
                (dp) => dp.parameter_value === Number(label)
              );

              return (
                <Paper p="sm" radius="md" shadow="sm" withBorder>
                  <Text size="xs" fw={600} mb="xs">
                    {result.parameter_label}: {paramFormatter(Number(label))}
                    {Number(label) === result.base_value && (
                      <Badge size="xs" ml="xs" color="gray">
                        atual
                      </Badge>
                    )}
                  </Text>
                  <Stack gap={4}>
                    {payload.map((entry: any) => (
                      <Group key={entry.name} gap="xs" justify="space-between">
                        <Group gap={4}>
                          <Box
                            w={8}
                            h={8}
                            style={{
                              backgroundColor: entry.color,
                              borderRadius: 2,
                            }}
                          />
                          <Text size="xs">{entry.name}</Text>
                          {dataPoint?.best_scenario === entry.name && (
                            <IconCrown
                              size={10}
                              color="var(--mantine-color-gold-5)"
                            />
                          )}
                        </Group>
                        <Text size="xs" fw={600}>
                          {money(entry.value)}
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                </Paper>
              );
            },
          }}
        />
      </Paper>

      {/* Key insights */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        {/* Best Overall */}
        <Paper p="sm" radius="md" withBorder>
          <Group gap="xs" mb={4}>
            <ThemeIcon size="xs" radius="sm" variant="light" color="sage">
              <IconCrown size={10} />
            </ThemeIcon>
            <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
              Melhor Configuração
            </Text>
          </Group>
          <Text size="sm" fw={600}>
            {paramFormatter(result.best_overall.parameter_value)}
          </Text>
          <Group gap={4} mt={2}>
            {getScenarioIcon(result.best_overall.best_scenario)}
            <Text size="xs" c="dimmed">
              {result.best_overall.best_scenario}
            </Text>
          </Group>
        </Paper>

        {/* Current value comparison */}
        <Paper p="sm" radius="md" withBorder>
          <Group gap="xs" mb={4}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
              Valor Atual
            </Text>
          </Group>
          <Text size="sm" fw={600}>
            {paramFormatter(result.base_value)}
          </Text>
          {result.base_value !== result.best_overall.parameter_value && (
            <Text size="xs" c="orange" mt={2}>
              {result.base_value < result.best_overall.parameter_value
                ? '↑ Aumentar pode melhorar'
                : '↓ Reduzir pode melhorar'}
            </Text>
          )}
        </Paper>

        {/* Breakeven points */}
        {hasBreakeven ? (
          <Paper
            p="sm"
            radius="md"
            style={{
              border: '1px solid var(--mantine-color-orange-3)',
              backgroundColor:
                'light-dark(var(--mantine-color-orange-0), var(--mantine-color-dark-7))',
            }}
          >
            <Group gap="xs" mb={4}>
              <ThemeIcon size="xs" radius="sm" variant="light" color="orange">
                <IconArrowsShuffle size={10} />
              </ThemeIcon>
              <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                Ponto de Virada
              </Text>
            </Group>
            <Text size="sm" fw={600}>
              {paramFormatter(result.breakeven_points[0].parameter_value)}
            </Text>
            <Text size="xs" c="dimmed" mt={2}>
              {result.breakeven_points[0].from_scenario} →{' '}
              {result.breakeven_points[0].to_scenario}
            </Text>
          </Paper>
        ) : (
          <Paper p="sm" radius="md" withBorder>
            <Group gap="xs" mb={4}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                Cenário Dominante
              </Text>
            </Group>
            <Group gap={4}>
              {getScenarioIcon(result.data_points[0]?.best_scenario || '')}
              <Text size="sm" fw={600}>
                {result.data_points[0]?.best_scenario || 'N/A'}
              </Text>
            </Group>
            <Text size="xs" c="sage" mt={2}>
              Em todo o intervalo analisado
            </Text>
          </Paper>
        )}
      </SimpleGrid>
    </Stack>
  );
}
