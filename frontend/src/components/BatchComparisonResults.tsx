import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Box,
  Paper,
  Stack,
  Group,
  Text,
  Title,
  Badge,
  ThemeIcon,
  SimpleGrid,
  Table,
  ScrollArea,
  Tabs,
  Button,
  Popover,
  Divider,
  rem,
  Alert,
  Collapse,
  UnstyledButton,
} from '@mantine/core';
import { LineChart } from '@mantine/charts';
import {
  IconCrown,
  IconTrophy,
  IconBuildingBank,
  IconChartLine,
  IconPigMoney,
  IconArrowUpRight,
  IconArrowDownRight,
  IconMinus,
  IconTable,
  IconChartArea,
  IconDownload,
  IconArrowLeft,
  IconScale,
  IconInfoCircle,
  IconBulb,
  IconAdjustments,
} from '@tabler/icons-react';
import InsightsDashboard from './InsightsDashboard';
import ParameterComparisonTable from './ParameterComparisonTable';
import {
  BatchComparisonResult,
  BatchComparisonResultItem,
  BatchComparisonRanking,
  ComparisonInput,
  ComparisonScenarioType,
  MonthlyRecord,
} from '../api/types';
import {
  money,
  moneyCompact,
  percent,
  formatMonthsYears,
  formatYearTickFromMonth,
  signedMoney,
} from '../utils/format';

const SCENARIO_LABELS: Record<ComparisonScenarioType, string> = {
  buy: 'Comprar',
  rent_invest: 'Alugar e investir',
  invest_buy: 'Investir para comprar',
};

const RESULT_SURFACE_STYLE = {
  background: 'var(--farol-surface-raised)',
  border: '1px solid var(--farol-border)',
  borderRadius: 'var(--mantine-radius-lg)',
  boxShadow: 'none',
} as const;

const COMPARISON_STATUS_LABELS = {
  comparable: { label: 'Comparável', color: 'teal' },
  exploratory: { label: 'Exploratório', color: 'blue' },
  incomparable: { label: 'Não comparável', color: 'orange' },
  no_feasible_scenario: { label: 'Sem fluxo viável', color: 'red' },
} as const;

const BATCH_CHART_COLORS = [
  'var(--farol-chart-1)',
  'var(--farol-chart-2)',
  'var(--farol-chart-3)',
  'var(--farol-chart-4)',
] as const;

function ExplanationLabel({ label, explanation }: { label: string; explanation: string }) {
  return (
    <Popover width={300} position="bottom-start" withArrow shadow="md" withinPortal>
      <Popover.Target>
        <UnstyledButton
          aria-label={`${label}. Abrir explicação`}
          style={{
            minHeight: rem(44),
            display: 'inline-flex',
            alignItems: 'center',
            color: 'var(--mantine-color-dimmed)',
            textAlign: 'start',
          }}
        >
          <Text component="span" size="xs" tt="uppercase" fw={500} td="underline" style={{ textDecorationStyle: 'dotted' }}>
            {label}
          </Text>
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown>
        <Text size="sm" lh={1.5}>{explanation}</Text>
      </Popover.Dropdown>
    </Popover>
  );
}

function formatComparableReturn(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? 'N/D' : percent(value);
}

function monthlyWealth(record: MonthlyRecord) {
  return (
    (record.equity ?? 0) +
    (record.investment_balance ?? 0) +
    (record.fgts_balance ?? 0) +
    (record.residual_cash_balance ?? 0) -
    (record.cumulative_unfunded_amount ?? 0)
  );
}

export function escapeCsvCell(value: string | number | null | undefined) {
  if (value == null || (typeof value === 'number' && !Number.isFinite(value))) return '""';
  if (typeof value === 'number') return String(value);

  let text = value;
  // Prevent spreadsheet applications from interpreting user-controlled preset
  // names as formulas when the CSV is opened.
  if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

// Local download helper for CSV content
function downloadLocalFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

interface BatchComparisonResultsProps {
  result: BatchComparisonResult;
  presetInputs?: ComparisonInput[];
  onBack?: () => void;
}

// Color palette for different presets - using new design system
const PRESET_COLORS = [
  { main: 'ocean', light: 'ocean.0', dark: 'ocean.7' },
  { main: 'teal', light: 'teal.0', dark: 'teal.7' },
  { main: 'violet', light: 'violet.0', dark: 'violet.7' },
  { main: 'amber', light: 'amber.0', dark: 'amber.7' },
  { main: 'rose', light: 'rose.0', dark: 'rose.7' },
  { main: 'sky', light: 'sky.0', dark: 'sky.7' },
  { main: 'emerald', light: 'emerald.0', dark: 'emerald.7' },
  { main: 'slate', light: 'slate.0', dark: 'slate.7' },
];

const SCENARIO_ICONS: Record<ComparisonScenarioType, React.ReactNode> = {
  buy: <IconBuildingBank size={20} />,
  rent_invest: <IconChartLine size={20} />,
  invest_buy: <IconPigMoney size={20} />,
};

function getScenarioIcon(type: ComparisonScenarioType | null | undefined) {
  return type == null ? <IconScale size={20} /> : SCENARIO_ICONS[type];
}

function RankingTable({ ranking, globalBest }: { ranking: BatchComparisonRanking[]; globalBest: NonNullable<BatchComparisonResult['global_best']> }) {
  return (
    <Box
      component="section"
      aria-labelledby="batch-ranking-title"
      p="lg"
      style={RESULT_SURFACE_STYLE}
    >
      <Group gap="sm" mb="lg">
        <ThemeIcon size="lg" radius="md" variant="light" color="ocean">
          <IconTrophy size={20} />
        </ThemeIcon>
        <Box>
          <Text id="batch-ranking-title" component="h3" fw={600} size="lg">
            Ranking global
          </Text>
          <Text size="xs" c="dimmed">
            Somente cenários comparáveis e viáveis, ordenados por patrimônio final.
          </Text>
        </Box>
      </Group>

      <ScrollArea type="auto" scrollbarSize={8} offsetScrollbars>
        <Table striped highlightOnHover miw={840} aria-label="Ranking global de cenários comparáveis">
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={50}>#</Table.Th>
              <Table.Th>Preset</Table.Th>
              <Table.Th>Cenário</Table.Th>
              <Table.Th ta="right">Patrimônio Final</Table.Th>
              <Table.Th ta="right">Variação Patrimônio</Table.Th>
              <Table.Th ta="right">Retorno comparável</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {ranking.map((item, index) => {
              const isGlobalBest =
                item.preset_id === globalBest.preset_id &&
                item.scenario_type === globalBest.scenario_type;

              return (
                <Table.Tr
                  key={`${item.preset_id}-${item.scenario_name}`}
                  style={{
                    backgroundColor: isGlobalBest
                      ? 'light-dark(var(--mantine-color-ocean-0), var(--mantine-color-dark-7))'
                      : undefined,
                  }}
                >
                  <Table.Td>
                    <Group gap={4}>
                      {isGlobalBest ? (
                        <ThemeIcon size="sm" color="amber" variant="filled" radius="xl">
                          <IconCrown size={12} />
                        </ThemeIcon>
                      ) : (
                        <Text fw={500} c="dimmed">
                          {index + 1}
                        </Text>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {item.preset_name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={6}>
                      {getScenarioIcon(item.scenario_type)}
                      <Text size="sm">{item.scenario_name}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" fw={600} c={isGlobalBest ? 'var(--farol-chart-1)' : undefined}>
                      {money(item.final_wealth)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Group gap={4} justify="flex-end">
                      {item.net_worth_change > 0 ? (
                        <IconArrowUpRight size={14} color="var(--farol-chart-positive)" aria-hidden="true" />
                      ) : item.net_worth_change < 0 ? (
                        <IconArrowDownRight size={14} color="var(--farol-chart-negative)" aria-hidden="true" />
                      ) : (
                        <IconMinus size={14} color="var(--mantine-color-dimmed)" aria-hidden="true" />
                      )}
                      <Text
                        size="sm"
                        c={
                          item.net_worth_change > 0
                            ? 'var(--farol-chart-positive)'
                            : item.net_worth_change < 0
                              ? 'var(--farol-chart-negative)'
                              : 'dimmed'
                        }
                      >
                        {signedMoney(item.net_worth_change)}
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm">{formatComparableReturn(item.roi_percentage)}</Text>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Box>
  );
}

function PresetCard({
  item,
  index,
  isGlobalBest,
  globalBestWealth,
}: {
  item: BatchComparisonResultItem;
  index: number;
  isGlobalBest: boolean;
  globalBestWealth: number | null;
}) {
  const titleId = useId();
  const color = PRESET_COLORS[index % PRESET_COLORS.length];
  const bestScenario = item.result.comparison_status !== 'comparable' || item.result.best_scenario_type == null
    ? null
    : item.result.scenarios.find((s) => s.scenario_type === item.result.best_scenario_type) ?? null;
  const bestWealth = bestScenario?.final_wealth ?? bestScenario?.final_equity ?? null;
  const deltaFromGlobal = bestWealth == null || globalBestWealth == null
    ? null
    : bestWealth - globalBestWealth;
  const comparisonStatus = COMPARISON_STATUS_LABELS[
    item.result.comparison_status ?? 'exploratory'
  ];

  return (
    <Paper
      component="article"
      aria-labelledby={titleId}
      p="lg"
      radius="lg"
      style={{
        border: isGlobalBest
          ? '2px solid var(--mantine-color-ocean-4)'
          : '1px solid var(--mantine-color-default-border)',
        backgroundColor: isGlobalBest
          ? 'var(--farol-surface-accent)'
          : 'var(--farol-surface-raised)',
        height: '100%',
        boxShadow: 'none',
      }}
    >
      <Group justify="space-between" align="flex-start" gap="sm" mb="md" wrap="wrap">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          <ThemeIcon
            size={44}
            radius="md"
            variant={isGlobalBest ? 'filled' : 'light'}
            color={color.main}
          >
            <IconScale size={22} />
          </ThemeIcon>
          <Box style={{ minWidth: 0 }}>
            <Text id={titleId} component="h3" fw={700} size="lg" style={{ overflowWrap: 'anywhere' }}>
              {item.preset_name}
            </Text>
            <Text size="xs" c="dimmed">
              {bestScenario ? `Maior patrimônio: ${bestScenario.name}` : 'Sem ranking local'}
            </Text>
          </Box>
        </Group>
        <Group gap={6} wrap="wrap">
          <Badge color={comparisonStatus.color} variant="light" size="sm">
            {comparisonStatus.label}
          </Badge>
          {isGlobalBest && (
            <Badge color="ocean" variant="filled" size="sm" leftSection={<IconCrown size={12} />}>
              Maior global
            </Badge>
          )}
        </Group>
      </Group>

      <Box
        p="md"
        mb="md"
        style={{
          backgroundColor:
            'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))',
          borderRadius: rem(10),
        }}
      >
        <Text size="xs" c="dimmed" tt="uppercase" fw={500} mb={4}>
          {bestScenario ? 'Maior patrimônio final deste preset' : 'Patrimônio não ranqueado'}
        </Text>
        <Text fw={700} size="xl">
          {bestWealth == null ? '—' : money(bestWealth)}
        </Text>
        {!isGlobalBest && deltaFromGlobal != null && deltaFromGlobal !== 0 && (
          <Group gap={4} mt={4}>
            <IconArrowDownRight size={14} color="var(--farol-chart-negative)" aria-hidden="true" />
            <Text size="xs" c="var(--farol-chart-negative)">
              {money(Math.abs(deltaFromGlobal))} menos que o melhor
            </Text>
          </Group>
        )}
      </Box>

      <SimpleGrid cols={{ base: 1, xs: 3, md: 1, xl: 3 }} spacing="sm">
        {item.result.scenarios.map((scenario) => {
          const isScenarioBest =
            bestScenario != null && scenario.scenario_type === bestScenario.scenario_type;
          const wealth = scenario.final_wealth ?? scenario.final_equity;

          return (
            <Paper
              key={scenario.scenario_type}
              p="sm"
              radius="md"
              shadow="none"
              style={{
                backgroundColor: isScenarioBest
                  ? `light-dark(var(--mantine-color-${color.main}-0), var(--mantine-color-dark-6))`
                  : 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6))',
                border: isScenarioBest
                  ? `1px solid var(--mantine-color-${color.main}-3)`
                  : '1px solid var(--mantine-color-default-border)',
              }}
            >
              <Group gap={6} mb={4}>
                {getScenarioIcon(scenario.scenario_type)}
                <Text size="xs" fw={600} truncate="end">
                  {scenario.name}
                </Text>
                {isScenarioBest && (
                  <Badge size="xs" color={color.main}>
                    Maior
                  </Badge>
                )}
              </Group>
              <Text size="sm" fw={500}>
                {money(wealth)}
              </Text>
              <Text size="xs" c="dimmed">
                Retorno comparável: {formatComparableReturn(scenario.metrics.roi_percentage)}
              </Text>
            </Paper>
          );
        })}
      </SimpleGrid>
    </Paper>
  );
}

function WealthComparisonChart({
  results,
}: {
  results: BatchComparisonResultItem[];
}) {
  const comparableWinners = useMemo(
    () =>
      results.flatMap((item, index) => {
        if (
          item.result.comparison_status !== 'comparable' ||
          item.result.best_scenario_type == null
        ) {
          return [];
        }
        const scenario = item.result.scenarios.find(
          (candidate) => candidate.scenario_type === item.result.best_scenario_type
        );
        if (!scenario) return [];
        return [{
          item,
          index,
          scenario,
          dataKey: `preset:${item.preset_id}`,
        }];
      }),
    [results]
  );

  const chartData = useMemo(() => {
    // Get all months across all results
    const allMonths = new Set<number>();
    comparableWinners.forEach(({ scenario }) => {
      scenario.monthly_data.forEach((m) => allMonths.add(m.month));
    });

    const monthsSorted = Array.from(allMonths).sort((a, b) => a - b);

    return monthsSorted.map((month) => {
      const row: Record<string, number | string> = { month };

      comparableWinners.forEach(({ scenario, dataKey }) => {
        const monthData = scenario.monthly_data.find((m) => m.month === month);
        if (monthData) {
          row[dataKey] = monthlyWealth(monthData);
        }
      });

      return row;
    });
  }, [comparableWinners]);

  const series = comparableWinners.map(({ item, index, dataKey }) => ({
    name: dataKey,
    label: item.preset_name,
    color: BATCH_CHART_COLORS[index % BATCH_CHART_COLORS.length],
  }));
  const chartHeight = Math.max(340, 300 + Math.ceil(series.length / 3) * 22);

  return (
    <Box
      component="section"
      aria-labelledby="batch-wealth-chart-title"
      p="lg"
      style={RESULT_SURFACE_STYLE}
    >
      <Group gap="sm" mb="lg">
        <ThemeIcon size="lg" radius="md" variant="light" color="ocean">
          <IconChartArea size={20} />
        </ThemeIcon>
        <Box>
          <Text id="batch-wealth-chart-title" component="h3" fw={600} size="lg">
            Evolução do patrimônio
          </Text>
          <Text size="xs" c="dimmed">
            Maior patrimônio comparável de cada preset; resultados excluídos do ranking não entram no gráfico.
          </Text>
        </Box>
      </Group>

      <Box
        role="img"
        aria-labelledby="batch-wealth-chart-title"
        aria-describedby="batch-wealth-chart-alternative"
      >
        <LineChart
          h={chartHeight}
          data={chartData}
          dataKey="month"
          series={series}
          curveType="monotone"
          withLegend
          legendProps={{ verticalAlign: 'bottom' }}
          valueFormatter={(value) => moneyCompact(value)}
          xAxisProps={{
            tickFormatter: (v) => formatYearTickFromMonth(Number(v)),
          }}
          tooltipProps={{
            content: ({ payload, label }) => {
              if (!payload || payload.length === 0) return null;
              return (
                <Paper p="sm" radius="md" shadow="sm" withBorder>
                  <Text size="xs" fw={600} mb="xs">
                    Mês {label}
                  </Text>
                  {payload.map((entry: any) => {
                    const seriesLabel = series.find((candidate) => candidate.name === entry.name)?.label;
                    return (
                      <Group key={entry.name} gap="xs" justify="space-between" wrap="nowrap">
                        <Group gap={4}>
                          <Box
                            w={8}
                            h={8}
                            style={{ backgroundColor: entry.color, borderRadius: 2 }}
                          />
                          <Text size="xs">{seriesLabel ?? entry.name}</Text>
                        </Group>
                        <Text size="xs" fw={600}>
                          {money(entry.value)}
                        </Text>
                      </Group>
                    );
                  })}
                </Paper>
              );
            },
          }}
        />
      </Box>
      <Box id="batch-wealth-chart-alternative" mt="sm">
        <Text size="xs" c="dimmed" mb={6}>
          Alternativa textual — patrimônio final das séries exibidas:
        </Text>
        <Group gap="xs" wrap="wrap">
          {comparableWinners.map(({ item, scenario }) => (
            <Badge key={item.preset_id} variant="light" color="gray" size="lg">
              {item.preset_name}: {money(scenario.final_wealth ?? scenario.final_equity)}
            </Badge>
          ))}
        </Group>
      </Box>
    </Box>
  );
}

function SummaryMetrics({
  results,
  allowCrossPresetComparison,
}: {
  results: BatchComparisonResultItem[];
  allowCrossPresetComparison: boolean;
}) {
  const [showExploratoryStats, setShowExploratoryStats] = useState(false);
  const stats = useMemo(() => {
    // Stats for ALL scenarios across all presets
    const allScenarios = results.flatMap((r) =>
      r.result.scenarios.map((s) => ({
        preset: r.preset_name,
        ...s,
      }))
    );

    const allWealthValues = allScenarios.map((s) => s.final_wealth ?? s.final_equity);
    const allAvgWealth = allWealthValues.length
      ? allWealthValues.reduce((a, b) => a + b, 0) / allWealthValues.length
      : null;
    const allRoiValues = allScenarios
      .map((s) => s.metrics.roi_percentage)
      .filter((value): value is number => value != null && Number.isFinite(value));
    const allAvgRoi = allRoiValues.length
      ? allRoiValues.reduce((a, b) => a + b, 0) / allRoiValues.length
      : null;

    // Stats for BEST scenario of each preset only
    const bestScenarios = results.flatMap((r) => {
      if (
        r.result.comparison_status !== 'comparable' ||
        r.result.best_scenario_type == null
      ) return [];
      const best = r.result.scenarios.find(
        (s) => s.scenario_type === r.result.best_scenario_type
      );
      if (!best) return [];
      return {
        preset: r.preset_name,
        scenario: best,
        wealth: best.final_wealth ?? best.final_equity,
        roi: best.metrics.roi_percentage,
      };
    });

    const bestWealthValues = bestScenarios.map((s) => s.wealth);
    const bestAvgWealth = bestWealthValues.length
      ? bestWealthValues.reduce((a, b) => a + b, 0) / bestWealthValues.length
      : null;
    const bestRoiValues = bestScenarios
      .map((s) => s.roi)
      .filter((value): value is number => value != null && Number.isFinite(value));
    const bestAvgRoi = bestRoiValues.length
      ? bestRoiValues.reduce((a, b) => a + b, 0) / bestRoiValues.length
      : null;

    return {
      totalPresets: results.length,
      comparablePresets: results.filter(
        (item) => item.result.comparison_status === 'comparable'
      ).length,
      rankedLocalPresets: bestScenarios.length,
      totalScenarios: allScenarios.length,
      // All scenarios stats
      all: {
        avgWealth: allAvgWealth,
        avgRoi: allAvgRoi,
        bestWealth: allWealthValues.length ? Math.max(...allWealthValues) : null,
        worstWealth: allWealthValues.length ? Math.min(...allWealthValues) : null,
      },
      // Best of each preset stats
      best: {
        avgWealth: bestAvgWealth,
        avgRoi: bestAvgRoi,
        bestWealth: bestWealthValues.length ? Math.max(...bestWealthValues) : null,
        worstWealth: bestWealthValues.length ? Math.min(...bestWealthValues) : null,
      },
    };
  }, [results]);

  return (
    <Stack component="section" aria-labelledby="batch-summary-title" gap="lg">
      <Box>
        <Text id="batch-summary-title" component="h3" fw={600} size="lg">
          Resumo dos resultados
        </Text>
        <Text size="sm" c="dimmed">
          {allowCrossPresetComparison
            ? 'Contagens gerais e estatísticas apenas sobre bases autorizadas para comparação.'
            : 'Contagens locais; agregados patrimoniais entre presets foram ocultados porque as bases não são comparáveis.'}
        </Text>
      </Box>
      {/* Overview counts */}
      <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} spacing="md">
        <Paper p="md" radius="lg" shadow="none" withBorder>
          <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
            Presets Comparados
          </Text>
          <Text size="xl" fw={700}>
            {stats.totalPresets}
          </Text>
        </Paper>
        <Paper p="md" radius="lg" shadow="none" withBorder>
          <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
            Presets comparáveis
          </Text>
          <Text size="xl" fw={700}>
            {stats.comparablePresets} de {stats.totalPresets}
          </Text>
          <Text size="xs" c="dimmed">
            Aptos a produzir ranking local
          </Text>
        </Paper>
        <Paper p="md" radius="lg" shadow="none" withBorder>
          <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
            Cenários Analisados
          </Text>
          <Text size="xl" fw={700}>
            {stats.totalScenarios}
          </Text>
          <Text size="xs" c="dimmed">
            {stats.totalPresets > 0
              ? `${stats.totalPresets} presets × ${stats.totalScenarios / stats.totalPresets} cenários`
              : 'Nenhum preset processado'}
          </Text>
        </Paper>
        <Paper p="md" radius="lg" shadow="none" withBorder>
          <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
            Líderes locais ranqueados
          </Text>
          <Text size="xl" fw={700}>
            {stats.rankedLocalPresets}
          </Text>
          <Text size="xs" c="dimmed">
            Um por preset comparável
          </Text>
        </Paper>
      </SimpleGrid>

      {/* Best scenario of each comparable preset */}
      {allowCrossPresetComparison && stats.best.bestWealth != null && stats.best.worstWealth != null && stats.best.avgWealth != null && <Box>
        <Group gap="xs" mb="sm">
          <ThemeIcon size="sm" radius="md" variant="light" color="ocean">
            <IconCrown size={14} />
          </ThemeIcon>
          <Text component="h4" size="sm" fw={600} c="var(--farol-chart-1)">
            Maiores patrimônios locais (1 por preset comparável)
          </Text>
        </Group>
        <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} spacing="md">
          <Paper p="md" radius="lg" shadow="none" style={{ border: '1px solid var(--farol-border)' }}>
            <ExplanationLabel label="Melhor" explanation="O maior patrimônio entre os melhores cenários comparáveis de cada preset." />
            <Text size="xl" fw={700} c="var(--farol-chart-positive)">
              {money(stats.best.bestWealth)}
            </Text>
          </Paper>
          <Paper p="md" radius="lg" shadow="none" style={{ border: '1px solid var(--farol-border)' }}>
            <ExplanationLabel label="Menor" explanation="O menor patrimônio entre os melhores cenários comparáveis de cada preset." />
            <Text size="xl" fw={700}>
              {money(stats.best.worstWealth)}
            </Text>
          </Paper>
          <Paper p="md" radius="lg" shadow="none" style={{ border: '1px solid var(--farol-border)' }}>
            <ExplanationLabel label="Média" explanation="Média do patrimônio dos melhores cenários comparáveis de cada preset." />
            <Text size="xl" fw={700}>
              {money(stats.best.avgWealth)}
            </Text>
          </Paper>
          <Paper p="md" radius="lg" shadow="none" style={{ border: '1px solid var(--farol-border)' }}>
            <ExplanationLabel label="Retorno comparável médio" explanation="Média apenas dos retornos comparáveis definidos; mostra N/D quando o contrato não fornece um retorno válido." />
            <Text
              size="xl"
              fw={700}
              c={stats.best.avgRoi == null ? 'dimmed' : stats.best.avgRoi >= 0 ? 'var(--farol-chart-positive)' : 'var(--farol-chart-negative)'}
            >
              {formatComparableReturn(stats.best.avgRoi)}
            </Text>
          </Paper>
        </SimpleGrid>
      </Box>}

      {allowCrossPresetComparison ? <Box>
        <Button
          variant="subtle"
          color="gray"
          size="sm"
          style={{ minHeight: rem(44) }}
          onClick={() => setShowExploratoryStats((current) => !current)}
          aria-expanded={showExploratoryStats}
          aria-controls="exploratory-batch-stats"
        >
          {showExploratoryStats ? 'Ocultar estatísticas exploratórias' : 'Ver todos os cenários (leitura exploratória)'}
        </Button>
        <Collapse in={showExploratoryStats}>
          <Box id="exploratory-batch-stats" pt="sm">
            <Text size="xs" c="dimmed" mb="sm">
              Estes agregados incluem {stats.totalScenarios} cenários e não implicam comparabilidade entre eles.
            </Text>
            <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} spacing="md">
              <Paper p="md" radius="lg" shadow="none" withBorder>
                <ExplanationLabel label="Maior patrimônio" explanation="O maior valor observado, sem implicar que os cenários sejam comparáveis." />
                <Text size="xl" fw={700} c="var(--farol-chart-positive)">
                  {stats.all.bestWealth == null ? '—' : money(stats.all.bestWealth)}
                </Text>
              </Paper>
              <Paper p="md" radius="lg" shadow="none" withBorder>
                <ExplanationLabel label="Menor patrimônio" explanation="O menor valor observado, sem implicar que os cenários sejam comparáveis." />
                <Text size="xl" fw={700} c="var(--farol-chart-negative)">
                  {stats.all.worstWealth == null ? '—' : money(stats.all.worstWealth)}
                </Text>
              </Paper>
              <Paper p="md" radius="lg" shadow="none" withBorder>
                <ExplanationLabel label="Média" explanation="Média do patrimônio de todos os cenários, inclusive os não comparáveis." />
                <Text size="xl" fw={700}>
                  {stats.all.avgWealth == null ? '—' : money(stats.all.avgWealth)}
                </Text>
              </Paper>
              <Paper p="md" radius="lg" shadow="none" withBorder>
                <ExplanationLabel label="Retorno comparável médio" explanation="Cenários sem retorno comparável definido são ignorados nesta média exploratória." />
                <Text
                  size="xl"
                  fw={700}
                  c={stats.all.avgRoi == null ? 'dimmed' : stats.all.avgRoi >= 0 ? 'var(--farol-chart-positive)' : 'var(--farol-chart-negative)'}
                >
                  {formatComparableReturn(stats.all.avgRoi)}
                </Text>
              </Paper>
            </SimpleGrid>
          </Box>
        </Collapse>
      </Box> : (
        <Alert color="orange" icon={<IconInfoCircle size={18} />}>
          Consulte os cartões de cada preset separadamente. Exibir maior, menor, média ou curvas cruzadas aqui sugeriria uma comparação que o contrato não autoriza.
        </Alert>
      )}
    </Stack>
  );
}

export default function BatchComparisonResults({
  result,
  presetInputs = [],
  onBack,
}: BatchComparisonResultsProps) {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const resultTitleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    resultTitleRef.current?.focus({ preventScroll: true });
  }, []);

  const rankingCandidate = result.global_best;
  const hasRankingPayload =
    rankingCandidate != null && result.ranking.length > 0;
  const totalScenarios = result.results.reduce(
    (total, item) => total + item.result.scenarios.length,
    0
  );
  const aggregateStatus =
    result.comparison_status ?? (hasRankingPayload ? 'ranked' : 'no_authoritative_result');
  const globalBest = aggregateStatus === 'no_authoritative_result'
    ? null
    : rankingCandidate;
  const hasGlobalRanking = globalBest != null && result.ranking.length > 0;
  const aggregateStatusCopy = {
    ranked: { label: 'Ranking completo', color: 'teal' },
    partial: { label: 'Ranking parcial', color: 'orange' },
    no_authoritative_result: { label: 'Sem ranking comparável', color: 'orange' },
  } as const;
  const currentAggregateStatus = aggregateStatusCopy[aggregateStatus];
  const allowCrossPresetComparison =
    aggregateStatus !== 'no_authoritative_result';

  const handleExportCSV = () => {
    const headers = [
      'Posição',
      'Preset',
      'Cenário',
      'Patrimônio Final',
      'Variação Patrimônio',
      'Retorno comparável (%)',
    ];
    const rows = result.ranking.map((item, idx) => [
      idx + 1,
      item.preset_name,
      item.scenario_name,
      Number(item.final_wealth.toFixed(2)),
      Number(item.net_worth_change.toFixed(2)),
      item.roi_percentage == null || !Number.isFinite(item.roi_percentage)
        ? null
        : Number(item.roi_percentage.toFixed(2)),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsvCell).join(';'))
      .join('\r\n');
    downloadLocalFile(`\uFEFF${csv}`, 'comparacao-presets.csv', 'text/csv;charset=utf-8');
  };

  return (
    <Stack gap="xl">
      {onBack && (
        <Box>
          <Button
            variant="subtle"
            color="gray"
            size="md"
            leftSection={<IconArrowLeft size={16} />}
            onClick={onBack}
          >
            Voltar ao formulário
          </Button>
        </Box>
      )}

      <Paper
        component="section"
        aria-labelledby="batch-result-title"
        p={{ base: 'md', sm: 'xl' }}
        radius="lg"
        shadow="none"
        withBorder
        style={{ background: 'var(--farol-surface-raised)' }}
      >
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="lg">
          <Group gap="md" align="flex-start" wrap="nowrap" style={{ flex: 1, minWidth: rem(250) }}>
            <ThemeIcon size={48} radius="md" variant="light" color="ocean">
              <IconScale size={24} />
            </ThemeIcon>
            <Box style={{ minWidth: 0 }}>
              <Group gap="sm" wrap="wrap">
                <Title ref={resultTitleRef} id="batch-result-title" order={2} fw={700} tabIndex={-1}>
                  Comparação de presets
                </Title>
                <Badge color={currentAggregateStatus.color} variant="light" size="lg">
                  {currentAggregateStatus.label}
                </Badge>
              </Group>
              <Text c="dimmed" size="sm" mt={2}>
                {result.results.length} presets · {totalScenarios} cenários simulados
              </Text>
              {hasGlobalRanking && (
                <Box mt="md">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                    Maior patrimônio final comparável
                  </Text>
                  <Title order={3} c="var(--farol-chart-1)" mt={2}>
                    {money(globalBest.final_wealth)}
                  </Title>
                  <Text size="sm" mt={4}>
                    {globalBest.scenario_name} · {globalBest.preset_name}
                  </Text>
                </Box>
              )}
            </Box>
          </Group>
          <Box>
            <Button
              variant="light"
              color="ocean"
              size="md"
              leftSection={<IconDownload size={16} />}
              onClick={handleExportCSV}
              disabled={!hasGlobalRanking}
              aria-describedby={!hasGlobalRanking ? 'batch-export-unavailable' : undefined}
            >
              Exportar ranking CSV
            </Button>
            {!hasGlobalRanking && (
              <Text id="batch-export-unavailable" size="xs" c="dimmed" mt={4} maw={280}>
                O CSV contém apenas o ranking comparável, indisponível nesta rodada.
              </Text>
            )}
          </Box>
        </Group>
      </Paper>

      {hasGlobalRanking ? (
        <Alert
          color="ocean"
          variant="light"
          icon={<IconCrown size={20} />}
          title="Ranking entre presets comparáveis"
        >
          <Text size="sm">
            O ranking inclui somente cenários comparáveis e viáveis. O resultado descreve estas premissas e não constitui recomendação financeira.
          </Text>
        </Alert>
      ) : (
        <Alert
          color="orange"
          variant="light"
          icon={<IconInfoCircle size={20} />}
          title="Sem ranking global comparável"
        >
          Os presets não possuem base de recursos comparável ou não têm cenário viável. Os resultados individuais continuam disponíveis sem declarar um campeão.
          {(result.warnings?.length ?? 0) > 0 && (
            <Stack gap={4} mt="xs">
              {result.warnings?.map((warning, index) => (
                <Text size="xs" key={`${index}-${warning}`}>• {warning}</Text>
              ))}
            </Stack>
          )}
        </Alert>
      )}

      {hasGlobalRanking && result.comparison_status === 'partial' && (
        <Alert
          color="orange"
          variant="light"
          icon={<IconInfoCircle size={20} />}
          title="Ranking parcial"
        >
          <Text size="sm">
            O ranking exclui presets ou cenários exploratórios, incomparáveis ou inviáveis.
          </Text>
          {(result.warnings?.length ?? 0) > 0 && (
            <Stack gap={4} mt="xs">
              {result.warnings?.slice(0, 3).map((warning, index) => (
                <Text size="xs" key={`${index}-${warning}`}>• {warning}</Text>
              ))}
              {(result.warnings?.length ?? 0) > 3 && (
                <Text size="xs">• Mais {(result.warnings?.length ?? 0) - 3} aviso(s).</Text>
              )}
            </Stack>
          )}
        </Alert>
      )}

      {/* Summary Metrics */}
      <SummaryMetrics
        results={result.results}
        allowCrossPresetComparison={allowCrossPresetComparison}
      />

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(v) => setActiveTab(v || 'overview')}
        keepMounted={false}
        styles={{ tab: { minHeight: rem(44) } }}
      >
        <ScrollArea type="auto" scrollbarSize={6} offsetScrollbars>
          <Tabs.List style={{ flexWrap: 'nowrap', width: 'max-content' }}>
            <Tabs.Tab value="overview" leftSection={<IconChartArea size={16} />}>
              Visão geral
            </Tabs.Tab>
            <Tabs.Tab value="insights" leftSection={<IconBulb size={16} />}>
              Leitura dos resultados
            </Tabs.Tab>
            <Tabs.Tab value="presets" leftSection={<IconScale size={16} />}>
              Por preset
            </Tabs.Tab>
            <Tabs.Tab value="ranking" leftSection={<IconTrophy size={16} />}>
              Ranking
            </Tabs.Tab>
            <Tabs.Tab value="parameters" leftSection={<IconAdjustments size={16} />}>
              Parâmetros
            </Tabs.Tab>
          </Tabs.List>
        </ScrollArea>

        <Tabs.Panel value="overview" pt="lg">
          <Stack gap="lg">
            {allowCrossPresetComparison && result.results.some(
              (item) =>
                item.result.comparison_status === 'comparable' &&
                item.result.best_scenario_type != null
            ) && (
              <WealthComparisonChart results={result.results} />
            )}
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              {result.results.map((item, index) => (
                <PresetCard
                  key={item.preset_id}
                  item={item}
                  index={index}
                  isGlobalBest={globalBest != null && item.preset_id === globalBest.preset_id}
                  globalBestWealth={globalBest?.final_wealth ?? null}
                />
              ))}
            </SimpleGrid>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="parameters" pt="lg">
          <ParameterComparisonTable result={result} presetInputs={presetInputs} />
        </Tabs.Panel>

        <Tabs.Panel value="insights" pt="lg">
          <InsightsDashboard result={result} />
        </Tabs.Panel>

        <Tabs.Panel value="ranking" pt="lg">
          {hasGlobalRanking ? (
            <RankingTable ranking={result.ranking} globalBest={globalBest} />
          ) : (
            <Alert color="orange" icon={<IconInfoCircle size={18} />}>
              Não há ranking porque nenhum conjunto comparável pôde ser formado.
            </Alert>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="presets" pt="lg">
          <Stack gap="xl">
            {result.results.map((item, index) => (
              <Box
                key={item.preset_id}
                component="section"
                aria-label={`Resultado do preset ${item.preset_name}`}
              >
                <Group gap="md" mb="md">
                  <ThemeIcon
                    size="lg"
                    radius="md"
                    variant="light"
                    color={PRESET_COLORS[index % PRESET_COLORS.length].main}
                  >
                    <IconScale size={20} />
                  </ThemeIcon>
                  <Box>
                    <Group gap="xs">
                      <Text fw={600} size="lg">
                        {item.preset_name}
                      </Text>
                      {globalBest != null && item.preset_id === globalBest.preset_id && (
                        <Badge color="amber" variant="filled" size="sm" leftSection={<IconCrown size={10} />}>
                          Maior global
                        </Badge>
                      )}
                    </Group>
                    <Text size="xs" c="dimmed">
                      {item.result.comparison_status === 'comparable' && item.result.best_scenario_type != null
                        ? `Maior patrimônio local: ${item.result.best_scenario ?? 'identificado'}`
                        : 'Sem ranking local comparável'}
                    </Text>
                  </Box>
                </Group>

                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                  {item.result.scenarios.map((scenario) => {
                    const isGlobalBest =
                      globalBest != null &&
                      item.preset_id === globalBest.preset_id &&
                      scenario.scenario_type === globalBest.scenario_type;
                    const isLocalBest =
                      item.result.comparison_status === 'comparable' &&
                      item.result.best_scenario_type != null &&
                      scenario.scenario_type === item.result.best_scenario_type;

                    return (
                      <Paper
                        component="article"
                        aria-label={`${scenario.name} no preset ${item.preset_name}`}
                        key={scenario.scenario_type}
                        p="lg"
                        radius="lg"
                        shadow="none"
                        style={{
                          border: isGlobalBest
                            ? '2px solid var(--mantine-color-amber-5)'
                            : isLocalBest
                              ? '2px solid var(--mantine-color-ocean-5)'
                              : '1px solid var(--mantine-color-default-border)',
                          backgroundColor: isGlobalBest
                            ? 'light-dark(var(--mantine-color-yellow-0), var(--mantine-color-dark-8))'
                            : isLocalBest
                              ? 'light-dark(var(--mantine-color-ocean-0), var(--mantine-color-dark-8))'
                              : 'var(--farol-surface-raised)',
                        }}
                      >
                        <Group justify="space-between" mb="md">
                          <Group gap="sm">
                            {getScenarioIcon(scenario.scenario_type)}
                            <Text fw={600}>{scenario.name}</Text>
                          </Group>
                          <Group gap={4}>
                            {isGlobalBest && (
                              <Badge color="amber" variant="filled" size="xs">
                                Maior global
                              </Badge>
                            )}
                            {isLocalBest && !isGlobalBest && (
                              <Badge color="ocean" variant="filled" size="xs">
                                Maior local
                              </Badge>
                            )}
                          </Group>
                        </Group>

                        <Stack gap="xs">
                          <Group justify="space-between">
                            <Text size="sm" c="dimmed">
                              Patrimônio Final
                            </Text>
                            <Text size="sm" fw={600}>
                              {money(scenario.final_wealth ?? scenario.final_equity)}
                            </Text>
                          </Group>
                          <Group justify="space-between">
                            <Text size="sm" c="dimmed">
                              Variação
                            </Text>
                            <Text
                              size="sm"
                              fw={500}
                              c={
                                (scenario.net_worth_change ?? 0) > 0
                                  ? 'var(--farol-chart-positive)'
                                  : (scenario.net_worth_change ?? 0) < 0
                                    ? 'var(--farol-chart-negative)'
                                    : 'dimmed'
                              }
                            >
                              {signedMoney(scenario.net_worth_change)}
                            </Text>
                          </Group>
                          <Group justify="space-between">
                            <Text size="sm" c="dimmed">
                              Consumo estimado
                            </Text>
                            <Text size="sm" fw={500}>
                              {money(scenario.total_consumption ?? scenario.total_cost)}
                            </Text>
                          </Group>
                          <Group justify="space-between">
                            <Text size="sm" c="dimmed">
                              Retorno comparável
                            </Text>
                            <Text size="sm" fw={500}>
                              {formatComparableReturn(scenario.metrics.roi_percentage)}
                            </Text>
                          </Group>
                          <Group justify="space-between">
                            <Text size="sm" c="dimmed">
                              Duração
                            </Text>
                            <Text size="sm" fw={500}>
                              {scenario.monthly_data.length} meses
                            </Text>
                          </Group>
                        </Stack>
                      </Paper>
                    );
                  })}
                </SimpleGrid>
                {index < result.results.length - 1 && <Divider my="xl" />}
              </Box>
            ))}
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
