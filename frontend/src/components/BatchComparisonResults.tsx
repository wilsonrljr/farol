import { useState, useMemo } from 'react';
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
  SegmentedControl,
  Button,
  Tooltip,
  ActionIcon,
  Divider,
  rem,
  Alert,
} from '@mantine/core';
import { AreaChart, LineChart } from '@mantine/charts';
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
} from '@tabler/icons-react';
import InsightsDashboard from './InsightsDashboard';
import {
  BatchComparisonResult,
  BatchComparisonResultItem,
  BatchComparisonRanking,
  EnhancedComparisonScenario,
} from '../api/types';
import {
  money,
  moneyCompact,
  percent,
  formatMonthsYears,
  formatYearTickFromMonth,
  signedMoney,
} from '../utils/format';

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
  }, 0);
}

interface BatchComparisonResultsProps {
  result: BatchComparisonResult;
  onBack?: () => void;
}

// Color palette for different presets
const PRESET_COLORS = [
  { main: 'sage', light: 'sage.0', dark: 'sage.7' },
  { main: 'info', light: 'blue.0', dark: 'blue.7' },
  { main: 'forest', light: 'green.0', dark: 'green.7' },
  { main: 'orange', light: 'orange.0', dark: 'orange.7' },
  { main: 'grape', light: 'grape.0', dark: 'grape.7' },
  { main: 'pink', light: 'pink.0', dark: 'pink.7' },
  { main: 'cyan', light: 'cyan.0', dark: 'cyan.7' },
  { main: 'teal', light: 'teal.0', dark: 'teal.7' },
  { main: 'indigo', light: 'indigo.0', dark: 'indigo.7' },
  { main: 'yellow', light: 'yellow.0', dark: 'yellow.7' },
];

const SCENARIO_ICONS: Record<string, React.ReactNode> = {
  'Comprar': <IconBuildingBank size={20} />,
  'Alugar e Investir': <IconChartLine size={20} />,
  'Investir e Comprar': <IconPigMoney size={20} />,
};

function getScenarioIcon(name: string) {
  for (const [key, icon] of Object.entries(SCENARIO_ICONS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) {
      return icon;
    }
  }
  return <IconScale size={20} />;
}

function RankingTable({ ranking, globalBest }: { ranking: BatchComparisonRanking[]; globalBest: BatchComparisonResult['global_best'] }) {
  return (
    <Paper
      p="lg"
      radius="lg"
      style={{
        border: '1px solid var(--mantine-color-default-border)',
        backgroundColor: 'var(--mantine-color-body)',
      }}
    >
      <Group gap="sm" mb="lg">
        <ThemeIcon size="lg" radius="md" variant="light" color="sage">
          <IconTrophy size={20} />
        </ThemeIcon>
        <Box>
          <Text fw={600} size="lg">
            Ranking Global
          </Text>
          <Text size="xs" c="dimmed">
            Todos os cenários ordenados por patrimônio final
          </Text>
        </Box>
      </Group>

      <ScrollArea>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={50}>#</Table.Th>
              <Table.Th>Preset</Table.Th>
              <Table.Th>Cenário</Table.Th>
              <Table.Th ta="right">Patrimônio Final</Table.Th>
              <Table.Th ta="right">Variação Patrimônio</Table.Th>
              <Table.Th ta="right">Custo Líquido</Table.Th>
              <Table.Th ta="right">ROI</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {ranking.map((item, index) => {
              const isGlobalBest =
                item.preset_id === globalBest.preset_id &&
                item.scenario_name === globalBest.scenario_name;

              return (
                <Table.Tr
                  key={`${item.preset_id}-${item.scenario_name}`}
                  style={{
                    backgroundColor: isGlobalBest
                      ? 'light-dark(var(--mantine-color-sage-0), var(--mantine-color-dark-7))'
                      : undefined,
                  }}
                >
                  <Table.Td>
                    <Group gap={4}>
                      {isGlobalBest ? (
                        <ThemeIcon size="sm" color="gold" variant="filled" radius="xl">
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
                      {getScenarioIcon(item.scenario_name)}
                      <Text size="sm">{item.scenario_name}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" fw={600} c={isGlobalBest ? 'sage.7' : undefined}>
                      {money(item.final_wealth)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Group gap={4} justify="flex-end">
                      {item.net_worth_change > 0 ? (
                        <IconArrowUpRight size={14} color="var(--mantine-color-sage-7)" />
                      ) : item.net_worth_change < 0 ? (
                        <IconArrowDownRight size={14} color="var(--mantine-color-red-6)" />
                      ) : (
                        <IconMinus size={14} color="var(--mantine-color-gray-5)" />
                      )}
                      <Text
                        size="sm"
                        c={
                          item.net_worth_change > 0
                            ? 'sage.7'
                            : item.net_worth_change < 0
                              ? 'red.6'
                              : 'dimmed'
                        }
                      >
                        {signedMoney(item.net_worth_change)}
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm">{money(item.total_cost)}</Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm">{percent(item.roi_percentage)}</Text>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Paper>
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
  globalBestWealth: number;
}) {
  const color = PRESET_COLORS[index % PRESET_COLORS.length];
  const bestScenario = item.result.scenarios.find(
    (s) => s.name === item.result.best_scenario
  );
  const bestWealth = bestScenario?.final_wealth ?? bestScenario?.final_equity ?? 0;
  const deltaFromGlobal = bestWealth - globalBestWealth;

  return (
    <Paper
      p="lg"
      radius="lg"
      style={{
        border: isGlobalBest
          ? '2px solid var(--mantine-color-sage-5)'
          : '1px solid var(--mantine-color-default-border)',
        backgroundColor: isGlobalBest
          ? 'light-dark(var(--mantine-color-sage-0), var(--mantine-color-dark-8))'
          : 'var(--mantine-color-body)',
        position: 'relative',
        height: '100%',
      }}
    >
      {isGlobalBest && (
        <Badge
          color="gold"
          variant="filled"
          size="sm"
          leftSection={<IconCrown size={12} />}
          style={{
            position: 'absolute',
            top: rem(12),
            right: rem(12),
          }}
        >
          Melhor Global
        </Badge>
      )}

      <Group gap="md" mb="md">
        <ThemeIcon
          size={48}
          radius="md"
          variant={isGlobalBest ? 'filled' : 'light'}
          color={color.main}
        >
          <IconScale size={24} />
        </ThemeIcon>
        <Box>
          <Text fw={700} size="lg">
            {item.preset_name}
          </Text>
          <Text size="xs" c="dimmed">
            Melhor: {item.result.best_scenario}
          </Text>
        </Box>
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
          Melhor Patrimônio Final
        </Text>
        <Text fw={700} size="xl">
          {money(bestWealth)}
        </Text>
        {!isGlobalBest && deltaFromGlobal !== 0 && (
          <Group gap={4} mt={4}>
            <IconArrowDownRight size={14} color="var(--mantine-color-red-6)" />
            <Text size="xs" c="red.6">
              {money(Math.abs(deltaFromGlobal))} menos que o melhor
            </Text>
          </Group>
        )}
      </Box>

      <SimpleGrid cols={2} spacing="sm">
        {item.result.scenarios.map((scenario) => {
          const isScenarioBest = scenario.name === item.result.best_scenario;
          const wealth = scenario.final_wealth ?? scenario.final_equity;

          return (
            <Paper
              key={scenario.name}
              p="sm"
              radius="md"
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
                {getScenarioIcon(scenario.name)}
                <Text size="xs" fw={600} truncate="end">
                  {scenario.name}
                </Text>
                {isScenarioBest && (
                  <Badge size="xs" color={color.main}>
                    Melhor
                  </Badge>
                )}
              </Group>
              <Text size="sm" fw={500}>
                {money(wealth)}
              </Text>
              <Text size="xs" c="dimmed">
                ROI: {percent(scenario.metrics.roi_percentage)}
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
  const chartData = useMemo(() => {
    // Get all months across all results
    const allMonths = new Set<number>();
    results.forEach((item) => {
      item.result.scenarios.forEach((scenario) => {
        scenario.monthly_data.forEach((m) => allMonths.add(m.month));
      });
    });

    const monthsSorted = Array.from(allMonths).sort((a, b) => a - b);

    return monthsSorted.map((month) => {
      const row: Record<string, number | string> = { month };

      results.forEach((item, idx) => {
        const bestScenario = item.result.scenarios.find(
          (s) => s.name === item.result.best_scenario
        );
        if (bestScenario) {
          const monthData = bestScenario.monthly_data.find((m) => m.month === month);
          if (monthData) {
            const wealth =
              (monthData.equity || 0) +
              (monthData.investment_balance || 0) +
              (monthData.fgts_balance || 0);
            row[item.preset_name] = wealth;
          }
        }
      });

      return row;
    });
  }, [results]);

  const series = results.map((item, idx) => ({
    name: item.preset_name,
    color: `var(--mantine-color-${PRESET_COLORS[idx % PRESET_COLORS.length].main}-6)`,
  }));

  return (
    <Paper
      p="lg"
      radius="lg"
      style={{
        border: '1px solid var(--mantine-color-default-border)',
        backgroundColor: 'var(--mantine-color-body)',
      }}
    >
      <Group gap="sm" mb="lg">
        <ThemeIcon size="lg" radius="md" variant="light" color="sage">
          <IconChartArea size={20} />
        </ThemeIcon>
        <Box>
          <Text fw={600} size="lg">
            Evolução do Patrimônio
          </Text>
          <Text size="xs" c="dimmed">
            Melhor cenário de cada preset ao longo do tempo
          </Text>
        </Box>
      </Group>

      <AreaChart
        h={350}
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
                {payload.map((entry: any) => (
                  <Group key={entry.name} gap="xs" justify="space-between">
                    <Group gap={4}>
                      <Box
                        w={8}
                        h={8}
                        style={{ backgroundColor: entry.color, borderRadius: 2 }}
                      />
                      <Text size="xs">{entry.name}</Text>
                    </Group>
                    <Text size="xs" fw={600}>
                      {money(entry.value)}
                    </Text>
                  </Group>
                ))}
              </Paper>
            );
          },
        }}
      />
    </Paper>
  );
}

function SummaryMetrics({
  results,
  globalBest,
}: {
  results: BatchComparisonResultItem[];
  globalBest: BatchComparisonResult['global_best'];
}) {
  const stats = useMemo(() => {
    // Stats for ALL scenarios across all presets
    const allScenarios = results.flatMap((r) =>
      r.result.scenarios.map((s) => ({
        preset: r.preset_name,
        ...s,
      }))
    );

    const allWealthValues = allScenarios.map((s) => s.final_wealth ?? s.final_equity);
    const allAvgWealth = allWealthValues.reduce((a, b) => a + b, 0) / allWealthValues.length;
    const allRoiValues = allScenarios.map((s) => s.metrics.roi_percentage);
    const allAvgRoi = allRoiValues.reduce((a, b) => a + b, 0) / allRoiValues.length;

    // Stats for BEST scenario of each preset only
    const bestScenarios = results.map((r) => {
      const best = r.result.scenarios.find((s) => s.name === r.result.best_scenario);
      return {
        preset: r.preset_name,
        scenario: best,
        wealth: best ? (best.final_wealth ?? best.final_equity) : 0,
        roi: best?.metrics.roi_percentage ?? 0,
      };
    });

    const bestWealthValues = bestScenarios.map((s) => s.wealth);
    const bestAvgWealth = bestWealthValues.reduce((a, b) => a + b, 0) / bestWealthValues.length;
    const bestRoiValues = bestScenarios.map((s) => s.roi);
    const bestAvgRoi = bestRoiValues.reduce((a, b) => a + b, 0) / bestRoiValues.length;

    return {
      totalPresets: results.length,
      totalScenarios: allScenarios.length,
      // All scenarios stats
      all: {
        avgWealth: allAvgWealth,
        avgRoi: allAvgRoi,
        bestWealth: Math.max(...allWealthValues),
        worstWealth: Math.min(...allWealthValues),
      },
      // Best of each preset stats
      best: {
        avgWealth: bestAvgWealth,
        avgRoi: bestAvgRoi,
        bestWealth: Math.max(...bestWealthValues),
        worstWealth: Math.min(...bestWealthValues),
      },
    };
  }, [results]);

  return (
    <Stack gap="lg">
      {/* Overview counts */}
      <SimpleGrid cols={{ base: 2, sm: 2 }} spacing="md">
        <Paper p="md" radius="lg" withBorder>
          <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
            Presets Comparados
          </Text>
          <Text size="xl" fw={700}>
            {stats.totalPresets}
          </Text>
        </Paper>
        <Paper p="md" radius="lg" withBorder>
          <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
            Cenários Analisados
          </Text>
          <Text size="xl" fw={700}>
            {stats.totalScenarios}
          </Text>
          <Text size="xs" c="dimmed">
            {stats.totalPresets} presets × {stats.totalScenarios / stats.totalPresets} cenários
          </Text>
        </Paper>
      </SimpleGrid>

      {/* Best scenario of each preset */}
      <Box>
        <Group gap="xs" mb="sm">
          <ThemeIcon size="sm" radius="md" variant="light" color="sage">
            <IconCrown size={14} />
          </ThemeIcon>
          <Text size="sm" fw={600} c="sage.7">
            Melhores Cenários (1 por preset)
          </Text>
        </Group>
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          <Paper p="md" radius="lg" style={{ border: '1px solid var(--mantine-color-sage-3)' }}>
            <Tooltip label="O maior patrimônio entre os melhores cenários de cada preset">
              <Text size="xs" c="dimmed" tt="uppercase" fw={500} style={{ cursor: 'help' }}>
                Melhor
              </Text>
            </Tooltip>
            <Text size="xl" fw={700} c="sage.7">
              {money(stats.best.bestWealth)}
            </Text>
          </Paper>
          <Paper p="md" radius="lg" style={{ border: '1px solid var(--mantine-color-sage-3)' }}>
            <Tooltip label="O menor patrimônio entre os melhores cenários de cada preset">
              <Text size="xs" c="dimmed" tt="uppercase" fw={500} style={{ cursor: 'help' }}>
                Pior
              </Text>
            </Tooltip>
            <Text size="xl" fw={700}>
              {money(stats.best.worstWealth)}
            </Text>
          </Paper>
          <Paper p="md" radius="lg" style={{ border: '1px solid var(--mantine-color-sage-3)' }}>
            <Tooltip label="Média do patrimônio dos melhores cenários">
              <Text size="xs" c="dimmed" tt="uppercase" fw={500} style={{ cursor: 'help' }}>
                Média
              </Text>
            </Tooltip>
            <Text size="xl" fw={700}>
              {money(stats.best.avgWealth)}
            </Text>
          </Paper>
          <Paper p="md" radius="lg" style={{ border: '1px solid var(--mantine-color-sage-3)' }}>
            <Tooltip label="ROI médio dos melhores cenários">
              <Text size="xs" c="dimmed" tt="uppercase" fw={500} style={{ cursor: 'help' }}>
                ROI Médio
              </Text>
            </Tooltip>
            <Text size="xl" fw={700} c={stats.best.avgRoi >= 0 ? 'sage.7' : 'red.6'}>
              {percent(stats.best.avgRoi)}
            </Text>
          </Paper>
        </SimpleGrid>
      </Box>

      {/* All scenarios */}
      <Box>
        <Group gap="xs" mb="sm">
          <ThemeIcon size="sm" radius="md" variant="light" color="gray">
            <IconScale size={14} />
          </ThemeIcon>
          <Text size="sm" fw={600} c="dimmed">
            Todos os Cenários ({stats.totalScenarios} no total)
          </Text>
        </Group>
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          <Paper p="md" radius="lg" withBorder>
            <Tooltip label="O maior patrimônio considerando todos os cenários de todos os presets">
              <Text size="xs" c="dimmed" tt="uppercase" fw={500} style={{ cursor: 'help' }}>
                Melhor
              </Text>
            </Tooltip>
            <Text size="xl" fw={700} c="sage.7">
              {money(stats.all.bestWealth)}
            </Text>
          </Paper>
          <Paper p="md" radius="lg" withBorder>
            <Tooltip label="O menor patrimônio considerando todos os cenários de todos os presets">
              <Text size="xs" c="dimmed" tt="uppercase" fw={500} style={{ cursor: 'help' }}>
                Pior
              </Text>
            </Tooltip>
            <Text size="xl" fw={700} c="red.6">
              {money(stats.all.worstWealth)}
            </Text>
          </Paper>
          <Paper p="md" radius="lg" withBorder>
            <Tooltip label="Média do patrimônio de todos os cenários">
              <Text size="xs" c="dimmed" tt="uppercase" fw={500} style={{ cursor: 'help' }}>
                Média
              </Text>
            </Tooltip>
            <Text size="xl" fw={700}>
              {money(stats.all.avgWealth)}
            </Text>
          </Paper>
          <Paper p="md" radius="lg" withBorder>
            <Tooltip label="ROI médio de todos os cenários">
              <Text size="xs" c="dimmed" tt="uppercase" fw={500} style={{ cursor: 'help' }}>
                ROI Médio
              </Text>
            </Tooltip>
            <Text size="xl" fw={700} c={stats.all.avgRoi >= 0 ? 'sage.7' : 'red.6'}>
              {percent(stats.all.avgRoi)}
            </Text>
          </Paper>
        </SimpleGrid>
      </Box>
    </Stack>
  );
}

export default function BatchComparisonResults({
  result,
  onBack,
}: BatchComparisonResultsProps) {
  const [activeTab, setActiveTab] = useState<string>('overview');

  const globalBestPresetIndex = result.results.findIndex(
    (r) => r.preset_id === result.global_best.preset_id
  );

  const handleExportCSV = () => {
    const headers = [
      'Posição',
      'Preset',
      'Cenário',
      'Patrimônio Final',
      'Variação Patrimônio',
      'Custo Líquido',
      'ROI (%)',
    ];
    const rows = result.ranking.map((item, idx) => [
      idx + 1,
      item.preset_name,
      item.scenario_name,
      item.final_wealth.toFixed(2),
      item.net_worth_change.toFixed(2),
      item.total_cost.toFixed(2),
      item.roi_percentage.toFixed(2),
    ]);

    const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    downloadLocalFile(csv, 'comparacao-presets.csv', 'text/csv');
  };

  return (
    <Stack gap="xl">
      {/* Header */}
      <Group justify="space-between" align="flex-start">
        <Box>
          {onBack && (
            <Button
              variant="subtle"
              color="gray"
              size="sm"
              leftSection={<IconArrowLeft size={16} />}
              onClick={onBack}
              mb="sm"
            >
              Voltar ao formulário
            </Button>
          )}
          <Group gap="md">
            <ThemeIcon
              size={56}
              radius="xl"
              variant="gradient"
              gradient={{ from: 'sage.5', to: 'sage.7', deg: 135 }}
            >
              <IconScale size={28} />
            </ThemeIcon>
            <Box>
              <Title order={2} fw={700}>
                Comparação de Presets
              </Title>
              <Text c="dimmed">
                {result.results.length} presets · {result.ranking.length} cenários analisados
              </Text>
            </Box>
          </Group>
        </Box>
        <Button
          variant="light"
          color="sage"
          leftSection={<IconDownload size={16} />}
          onClick={handleExportCSV}
        >
          Exportar CSV
        </Button>
      </Group>

      {/* Global Best Alert */}
      <Alert
        color="sage"
        variant="light"
        icon={<IconCrown size={20} />}
        title="Melhor Resultado Global"
      >
        <Text size="sm">
          <Text span fw={600}>
            {result.global_best.preset_name}
          </Text>{' '}
          com o cenário{' '}
          <Text span fw={600}>
            {result.global_best.scenario_name}
          </Text>{' '}
          alcançou o maior patrimônio final de{' '}
          <Text span fw={700} c="sage.7">
            {money(result.global_best.final_wealth)}
          </Text>
        </Text>
      </Alert>

      {/* Summary Metrics */}
      <SummaryMetrics results={result.results} globalBest={result.global_best} />

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(v) => setActiveTab(v || 'overview')}>
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconChartArea size={16} />}>
            Visão Geral
          </Tabs.Tab>
          <Tabs.Tab value="insights" leftSection={<IconBulb size={16} />}>
            Insights
          </Tabs.Tab>
          <Tabs.Tab value="ranking" leftSection={<IconTrophy size={16} />}>
            Ranking
          </Tabs.Tab>
          <Tabs.Tab value="presets" leftSection={<IconScale size={16} />}>
            Por Preset
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="lg">
          <Stack gap="lg">
            <WealthComparisonChart results={result.results} />
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              {result.results.map((item, index) => (
                <PresetCard
                  key={item.preset_id}
                  item={item}
                  index={index}
                  isGlobalBest={item.preset_id === result.global_best.preset_id}
                  globalBestWealth={result.global_best.final_wealth}
                />
              ))}
            </SimpleGrid>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="insights" pt="lg">
          <InsightsDashboard result={result} />
        </Tabs.Panel>

        <Tabs.Panel value="ranking" pt="lg">
          <RankingTable ranking={result.ranking} globalBest={result.global_best} />
        </Tabs.Panel>

        <Tabs.Panel value="presets" pt="lg">
          <Stack gap="xl">
            {result.results.map((item, index) => (
              <Box key={item.preset_id}>
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
                      {item.preset_id === result.global_best.preset_id && (
                        <Badge color="gold" variant="filled" size="sm" leftSection={<IconCrown size={10} />}>
                          Melhor Global
                        </Badge>
                      )}
                    </Group>
                    <Text size="xs" c="dimmed">
                      Melhor cenário local: {item.result.best_scenario}
                    </Text>
                  </Box>
                </Group>

                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                  {item.result.scenarios.map((scenario) => {
                    const isGlobalBest =
                      item.preset_id === result.global_best.preset_id &&
                      scenario.name === result.global_best.scenario_name;
                    const isLocalBest = scenario.name === item.result.best_scenario;

                    return (
                      <Paper
                        key={scenario.name}
                        p="lg"
                        radius="lg"
                        style={{
                          border: isGlobalBest
                            ? '2px solid var(--mantine-color-gold-5)'
                            : isLocalBest
                              ? '2px solid var(--mantine-color-sage-5)'
                              : '1px solid var(--mantine-color-default-border)',
                          backgroundColor: isGlobalBest
                            ? 'light-dark(var(--mantine-color-yellow-0), var(--mantine-color-dark-8))'
                            : isLocalBest
                              ? 'light-dark(var(--mantine-color-sage-0), var(--mantine-color-dark-8))'
                              : 'var(--mantine-color-body)',
                        }}
                      >
                        <Group justify="space-between" mb="md">
                          <Group gap="sm">
                            {getScenarioIcon(scenario.name)}
                            <Text fw={600}>{scenario.name}</Text>
                          </Group>
                          <Group gap={4}>
                            {isGlobalBest && (
                              <Badge color="gold" variant="filled" size="xs">
                                Melhor Global
                              </Badge>
                            )}
                            {isLocalBest && !isGlobalBest && (
                              <Badge color="sage" variant="filled" size="xs">
                                Melhor
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
                                  ? 'sage.7'
                                  : (scenario.net_worth_change ?? 0) < 0
                                    ? 'red.6'
                                    : 'dimmed'
                              }
                            >
                              {signedMoney(scenario.net_worth_change)}
                            </Text>
                          </Group>
                          <Group justify="space-between">
                            <Text size="sm" c="dimmed">
                              Custo Líquido
                            </Text>
                            <Text size="sm" fw={500}>
                              {money(scenario.total_cost)}
                            </Text>
                          </Group>
                          <Group justify="space-between">
                            <Text size="sm" c="dimmed">
                              ROI
                            </Text>
                            <Text size="sm" fw={500}>
                              {percent(scenario.metrics.roi_percentage)}
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
