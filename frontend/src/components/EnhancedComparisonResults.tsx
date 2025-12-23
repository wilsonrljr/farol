import { useState } from 'react';
import type { ReactNode } from '../types/react';
import {
  Title,
  Stack,
  Group,
  Paper,
  Text,
  Table,
  SimpleGrid,
  ScrollArea,
  SegmentedControl,
  Tabs,
  Badge,
  Switch,
  Alert,
  Menu,
  Button,
  Box,
  rem,
  ThemeIcon,
  Divider,
  Tooltip,
  ActionIcon,
} from '@mantine/core';
import { EnhancedComparisonResult } from '../api/types';
import {
  money,
  moneyCompact,
  percent,
  formatMonthsYears,
  formatMonthLabel,
  formatYearTickFromMonth,
  signedMoney,
  signedPercent,
  yearFromMonth,
  ratio,
  ratioAsPercent,
} from '../utils/format';
import { AreaChart, LineChart } from '@mantine/charts';
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconCrown,
  IconChartLine,
  IconBuildingBank,
  IconDownload,
  IconTable,
  IconChartArea,
  IconPigMoney,
  IconHelpCircle,
  IconAlertCircle,
} from '@tabler/icons-react';
import { downloadFile } from '../utils/download';

interface ScenarioCardNewProps {
  scenario: any;
  isBest: boolean;
  bestScenario: any;
  index: number;
}

function ScenarioCardNew({ scenario, isBest, bestScenario, index }: ScenarioCardNewProps) {
  const s = scenario;
  const colorMap = ['sage', 'info', 'forest'] as const;
  const color = colorMap[index % colorMap.length];
  const iconMap = [<IconBuildingBank size={24} />, <IconChartLine size={24} />, <IconPigMoney size={24} />];
  
  const wealthDelta = s.metrics.wealth_accumulation - bestScenario.metrics.wealth_accumulation;
  const costDelta = s.total_cost - bestScenario.total_cost;

  const Help = ({ label, help }: { label: string; help: ReactNode }) => (
    <Tooltip label={help} multiline w={320} withArrow position="top-start">
      <ActionIcon variant="subtle" color="gray" size="xs" aria-label={`Ajuda: ${label}`}>
        <IconHelpCircle size={14} />
      </ActionIcon>
    </Tooltip>
  );

  return (
    <Paper
      p="xl"
      radius="lg"
      className={isBest ? 'card-hover' : ''}
      style={{
        backgroundColor: isBest
          ? 'light-dark(var(--mantine-color-sage-0), var(--mantine-color-dark-8))'
          : 'var(--mantine-color-body)',
        border: isBest
          ? '2px solid light-dark(var(--mantine-color-sage-3), var(--mantine-color-sage-6))'
          : '1px solid var(--mantine-color-default-border)',
        position: 'relative',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      {/* Winner badge */}
      {isBest && (
        <Badge
          color="sage"
          variant="filled"
          size="sm"
          leftSection={<IconCrown size={12} />}
          style={{
            position: 'absolute',
            top: rem(16),
            right: rem(16),
          }}
        >
          Melhor Opção
        </Badge>
      )}

      {/* Header */}
      <Group gap="md" mb="lg">
        <ThemeIcon
          size={52}
          radius="md"
          variant={isBest ? 'filled' : 'light'}
          color={color}
        >
          {iconMap[index % 3]}
        </ThemeIcon>
        <Box>
          <Text fw={700} size="xl" c={isBest ? 'bright' : 'bright'}>
            {s.name}
          </Text>
          <Text size="sm" c="dimmed">
            {index === 0 ? 'Financiamento imobiliário' : index === 1 ? 'Aluguel + investimento' : 'Investir para comprar'}
          </Text>
        </Box>
      </Group>

      {/* Main Metric - Patrimônio */}
      <Box
        p="lg"
        mb="lg"
        style={{
          backgroundColor: 'light-dark(var(--mantine-color-sage-0), var(--mantine-color-dark-7))',
          borderRadius: rem(10),
        }}
      >
        <Group gap={6} align="center" wrap="nowrap">
          <Text size="xs" c="sage.6" tt="uppercase" fw={500} style={{ letterSpacing: '0.5px' }}>
            Patrimônio Final
          </Text>
          <Help
            label="Patrimônio Final"
            help="Total acumulado no fim do horizonte da simulação. No comparador, é calculado como (equidade + investimentos + FGTS)."
          />
        </Group>
        <Text fw={700} style={{ fontSize: rem(32), lineHeight: 1.1 }} c="bright">
          {money(s.metrics.wealth_accumulation)}
        </Text>
        {!isBest && wealthDelta !== 0 && (
          <Group gap={4} mt={4}>
            {wealthDelta < 0 ? (
              <IconArrowDownRight size={14} color="var(--mantine-color-danger-6)" />
            ) : (
              <IconArrowUpRight size={14} color="var(--mantine-color-sage-7)" />
            )}
            <Text size="xs" c={wealthDelta < 0 ? 'danger.6' : 'sage.7'} fw={500}>
              {wealthDelta > 0 ? '+' : ''}{money(wealthDelta)} vs melhor (menor custo)
            </Text>
          </Group>
        )}
      </Box>

      {/* Metrics Grid */}
      <SimpleGrid cols={2} spacing="md">
        <Box>
          <Group gap={6} align="center" wrap="nowrap" mb={2}>
            <Text size="xs" c="sage.5">
              Custo Líquido
            </Text>
            <Help
              label="Custo Líquido"
              help="Custo total ao longo do tempo (saídas de caixa), considerando entradas/aportes e regras do cenário. O 'melhor' cenário do backend hoje é o de menor custo líquido."
            />
          </Group>
          <Group gap={4} align="center">
            <Text fw={600} size="md" c="sage.8">
              {money(s.total_cost)}
            </Text>
            {!isBest && costDelta !== 0 && (
              <Text size="xs" c={costDelta > 0 ? 'danger.6' : 'sage.7'}>
                ({costDelta > 0 ? '+' : ''}{money(costDelta)})
              </Text>
            )}
          </Group>
        </Box>
        <Box>
          <Group gap={6} align="center" wrap="nowrap" mb={2}>
            <Text size="xs" c="sage.5">
              Equidade
            </Text>
            <Help
              label="Equidade"
              help="Parcela do imóvel que já é sua (valor do imóvel menos o saldo devedor). Para cenários sem financiamento, representa o valor do imóvel após compra."
            />
          </Group>
          <Text fw={600} size="md" c="sage.8">
            {money(s.final_equity)}
          </Text>
        </Box>
        <Box>
          <Group gap={6} align="center" wrap="nowrap" mb={2}>
            <Text size="xs" c="sage.5">
              ROI
            </Text>
            <Help
              label="ROI"
              help="Retorno percentual estimado. Em geral, compara o que você terminou com o que saiu do seu bolso (varia por cenário e regras)."
            />
          </Group>
          <Text fw={600} size="md" c="sage.8">
            {percent(s.metrics.roi_percentage)}
          </Text>
        </Box>
        <Box>
          <Group gap={6} align="center" wrap="nowrap" mb={2}>
            <Text size="xs" c="sage.5">
              Desembolso Mensal Médio
            </Text>
            <Help
              label="Desembolso Mensal Médio"
              help="Média das saídas mensais ao longo do horizonte (inclui entrada/aportes quando aplicável). Útil para comparar esforço de caixa entre estratégias."
            />
          </Group>
          <Text size="xs" c="sage.5" mb={2}>
            (inclui entrada/aportes)
          </Text>
          <Text fw={600} size="md" c="sage.8">
            {money(s.metrics.average_monthly_cost)}
          </Text>
        </Box>
      </SimpleGrid>

      {/* Purchase breakdown (buy scenario) */}
      {s.purchase_breakdown && (
        <Box
          p="md"
          mt="md"
          style={{
            backgroundColor: 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6))',
            borderRadius: rem(10),
          }}
        >
          <Text size="xs" c="dimmed" fw={600} mb={6}>
            Composição da compra
          </Text>
          <SimpleGrid cols={2} spacing="xs">
            <Group gap={6} align="center">
              <Text size="sm" c="sage.7">Entrada em dinheiro</Text>
              <Text size="sm" fw={700}>{money(s.purchase_breakdown.cash_down_payment)}</Text>
            </Group>
            <Group gap={6} align="center">
              <Text size="sm" c="sage.7">FGTS na entrada</Text>
              <Text size="sm" fw={700}>{money(s.purchase_breakdown.fgts_at_purchase)}</Text>
            </Group>
            <Group gap={6} align="center">
              <Text size="sm" c="sage.7">Financiado</Text>
              <Text size="sm" fw={700}>{money(s.purchase_breakdown.financed_amount)}</Text>
            </Group>
            <Group gap={6} align="center">
              <Text size="sm" c="sage.7">Custos (ITBI+escritura)</Text>
              <Text size="sm" fw={700}>{money(s.purchase_breakdown.upfront_costs)}</Text>
            </Group>
          </SimpleGrid>
        </Box>
      )}

      {/* FGTS summary */}
      {s.fgts_summary && (
        <Box
          p="md"
          mt="md"
          style={{
            backgroundColor: 'light-dark(var(--mantine-color-sage-0), var(--mantine-color-dark-7))',
            borderRadius: rem(10),
          }}
        >
          <Group gap={8} mb={8}>
            <ThemeIcon size={28} radius="xl" color="sage" variant="filled">
              <IconPigMoney size={16} />
            </ThemeIcon>
            <Box>
              <Text size="sm" fw={700}>FGTS</Text>
              <Text size="xs" c="dimmed">Saldo final {money(s.fgts_summary.final_balance)} | Saques {money(s.fgts_summary.total_withdrawn)}</Text>
            </Box>
          </Group>
          <SimpleGrid cols={2} spacing="xs">
            <Group gap={6} align="center">
              <Text size="sm" c="sage.7">Usado na entrada</Text>
              <Text size="sm" fw={700}>{money(s.fgts_summary.withdrawn_at_purchase)}</Text>
            </Group>
            <Group gap={6} align="center">
              <Text size="sm" c="sage.7">Amortizações FGTS</Text>
              <Text size="sm" fw={700}>{money(s.fgts_summary.withdrawn_for_amortizations)}</Text>
            </Group>
          </SimpleGrid>
          {s.fgts_summary.blocked_count > 0 && (
            <Alert
              mt={10}
              color="warning"
              variant="light"
              icon={<IconAlertCircle size={14} />}
            >
              <Text size="xs" fw={600} c="warning.7">
                {s.fgts_summary.blocked_count} amortização(ões) FGTS não aplicada(s)
              </Text>
              <Text size="xs" c="dimmed">
                Valor solicitado: {money(s.fgts_summary.blocked_total_value)} (carência de 24 meses ou saldo insuficiente).
              </Text>
            </Alert>
          )}
        </Box>
      )}

      {/* Additional info */}
      <Divider my="md" color="sage.2" />
      <Group gap="xs" wrap="wrap">
        <Badge variant="light" color="sage" size="sm">
          {s.monthly_data.length} meses
        </Badge>
        <Badge variant="light" color="sage" size="sm">
          Juros/Aluguel: {money(s.metrics.total_interest_or_rent_paid)}
        </Badge>
        {s.opportunity_cost != null && s.opportunity_cost > 0 && (
          <Badge variant="light" color="info" size="sm">
            Ganho investimento: {money(s.opportunity_cost)}
          </Badge>
        )}
      </Group>
    </Paper>
  );
}

export default function EnhancedComparisonResults({ result, inputPayload }: { result: EnhancedComparisonResult; inputPayload?: any }) {
  const [chartType, setChartType] = useState<'area' | 'line'>('area');
  const [overviewMetric, setOverviewMetric] = useState<'wealth' | 'outflow'>('wealth');
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [milestonesOnly, setMilestonesOnly] = useState(false);
  const [tableView, setTableView] = useState<'essential' | 'detailed'>('essential');

  const months = new Set<number>();
  const scenarioByMonth = new Map<string, Map<number, any>>();
  result.scenarios.forEach((s) => {
    const byMonth = new Map<number, any>();
    s.monthly_data.forEach((m: any) => {
      months.add(m.month);
      byMonth.set(m.month, m);
    });
    scenarioByMonth.set(s.name, byMonth);
  });
  const monthsSorted = Array.from(months).sort((a, b) => a - b);

  const moneySafe = (v: any) => money(v || 0);
  const monthlyOutflow = (m: any) => {
    if (m?.total_monthly_cost != null) return m.total_monthly_cost;
    if (m?.cash_flow != null) return -m.cash_flow;
    return 0;
  };

  const horizonLabel = (monthsCount: number | null) => formatMonthsYears(monthsCount);
  const wealthAt = (m: any) => (m?.equity || 0) + (m?.investment_balance || 0) + (m?.fgts_balance || 0);

  const wealthData = monthsSorted.map((month) => {
    const row: any = { month };
    result.scenarios.forEach((s) => {
      const md = scenarioByMonth.get(s.name)?.get(month);
      if (md) row[s.name] = wealthAt(md);
    });
    return row;
  });

  const outflowData = monthsSorted.map((month) => {
    const row: any = { month };
    result.scenarios.forEach((s) => {
      const md = scenarioByMonth.get(s.name)?.get(month);
      if (md) row[s.name] = monthlyOutflow(md);
    });
    return row;
  });

  // Best scenario comes from the backend decision rule (currently: lowest total_cost).
  // Keep UI highlight consistent with `result.best_scenario`.
  const bestScenario =
    result.scenarios.find((s) => s.name === result.best_scenario) ??
    [...result.scenarios].sort((a, b) => a.total_cost - b.total_cost)[0];

  const maxWealthScenario = [...result.scenarios].sort(
    (a, b) => (b.metrics?.wealth_accumulation ?? 0) - (a.metrics?.wealth_accumulation ?? 0)
  )[0];

  const comparativeRowsRaw = Object.values(result.comparative_summary || {}).filter(
    (v: any) => v && typeof v === 'object' && typeof v.month === 'number'
  ) as any[];
  const comparativeRows = [...comparativeRowsRaw].sort((a, b) => (a.month ?? 0) - (b.month ?? 0));
  const lastComparativeMonth = comparativeRows.length ? (comparativeRows[comparativeRows.length - 1].month as number) : null;
  const monthsToShow = lastComparativeMonth
    ? Array.from(
        new Set(
          [1, 12, 60, 120, lastComparativeMonth]
            .filter((m) => m >= 1 && m <= lastComparativeMonth)
        )
      ).sort((a, b) => a - b)
    : [];
  const comparativeMiniTable = monthsToShow
    .map((m) => comparativeRows.find((r) => r.month === m))
    .filter(Boolean);

  return (
    <Stack gap="xl">
      {/* Header */}
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
        <Box>
          <Group gap="sm" mb="xs">
            <ThemeIcon size={40} radius="md" variant="filled" color="sage">
              <IconChartLine size={20} />
            </ThemeIcon>
            <Title order={2} fw={600} c="sage.9">
              Resultados da Análise
            </Title>
          </Group>
          <Text size="md" c="sage.6">
            Melhor cenário (critério: menor custo líquido):{' '}
            <Text component="span" fw={600} c="sage.8">{result.best_scenario}</Text>
          </Text>
          <Text size="xs" c="sage.6" mt={4}>
            O critério “melhor” pode diferir do maior patrimônio final.
          </Text>
          {maxWealthScenario?.name && maxWealthScenario.name !== bestScenario.name && (
            <Text size="sm" c="sage.6" mt={4}>
              Maior patrimônio final:{' '}
              <Text component="span" fw={600} c="sage.8">{maxWealthScenario.name}</Text>
            </Text>
          )}
        </Box>
        <Menu withinPortal position="bottom-end">
          <Menu.Target>
            <Button
              variant="light"
              color="sage"
              leftSection={<IconDownload size={16} />}
              radius="lg"
            >
              Exportar
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Formato</Menu.Label>
            <Menu.Item onClick={() => downloadFile('/api/compare-scenarios-enhanced/export?format=csv', 'POST', inputPayload, 'scenarios_comparison.csv')}>
              CSV
            </Menu.Item>
            <Menu.Item onClick={() => downloadFile('/api/compare-scenarios-enhanced/export?format=xlsx', 'POST', inputPayload, 'scenarios_comparison.xlsx')}>
              Excel (XLSX)
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      {/* Scenario Cards */}
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
        {result.scenarios.map((s, idx) => (
          <ScenarioCardNew
            key={s.name}
            scenario={s}
            isBest={s.name === bestScenario.name}
            bestScenario={bestScenario}
            index={idx}
          />
        ))}
      </SimpleGrid>

      {/* Comparative Summary */}
      <Paper
        p="xl"
        radius="xl"
        style={{
          border: '1px solid var(--mantine-color-default-border)',
          backgroundColor: 'var(--mantine-color-body)',
        }}
      >
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm" mb="md">
          <Box>
            <Text fw={600} size="lg" c="bright">
              Resumo comparativo
            </Text>
            <Text size="sm" c="dimmed">
              Alguns pontos no tempo para facilitar a leitura (mês a mês está no export).
            </Text>
          </Box>
          {lastComparativeMonth != null && (
            <Badge variant="light" color="sage" size="lg">
              Horizonte: {horizonLabel(lastComparativeMonth)}
            </Badge>
          )}
        </Group>

        {comparativeMiniTable.length ? (
          <ScrollArea type="hover" scrollbarSize={8} offsetScrollbars>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Mês</Table.Th>
                  <Table.Th>Comprar − Alugar (R$)</Table.Th>
                  <Table.Th>Comprar − Alugar (%)</Table.Th>
                  <Table.Th>Patrimônio (Comprar)</Table.Th>
                  <Table.Th>Patrimônio (Alugar + Investir)</Table.Th>
                  <Table.Th>Patrimônio (Investir p/ Comprar)</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {comparativeMiniTable.map((r: any) => (
                  <Table.Tr key={r.month}>
                    <Table.Td fw={600}>{formatMonthLabel(r.month)}</Table.Td>
                    <Table.Td c={r.buy_vs_rent_difference > 0 ? 'danger.6' : r.buy_vs_rent_difference < 0 ? 'success.7' : 'sage.6'}>
                      {signedMoney(r.buy_vs_rent_difference)}
                    </Table.Td>
                    <Table.Td c={r.buy_vs_rent_percentage > 0 ? 'danger.6' : r.buy_vs_rent_percentage < 0 ? 'success.7' : 'sage.6'}>
                      {signedPercent(r.buy_vs_rent_percentage, 1)}
                    </Table.Td>
                    <Table.Td>{moneySafe(r.buy_total_wealth)}</Table.Td>
                    <Table.Td>{moneySafe(r.rent_total_wealth)}</Table.Td>
                    <Table.Td>{moneySafe(r.invest_total_wealth)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        ) : (
          <Text size="sm" c="sage.6">
            Resumo comparativo indisponível.
          </Text>
        )}

        <Text size="xs" c="sage.6" mt="sm">
          Interpretação: valores positivos em “Comprar − Alugar” significam que comprar foi mais caro no mês (pior para comprar no curto prazo).
        </Text>
      </Paper>

      {/* Charts and Tables */}
      <Tabs value={activeTab} onChange={(v) => setActiveTab(v || 'overview')} variant="pills" radius="lg">
        <Paper
          p="md"
          radius="xl"
          mb="md"
          style={{
            backgroundColor: 'light-dark(var(--mantine-color-sage-0), var(--mantine-color-dark-8))',
            border: '1px solid var(--mantine-color-default-border)',
          }}
        >
          <Group justify="space-between" align="center" wrap="wrap" gap="md">
            <Tabs.List>
              <Tabs.Tab value="overview" leftSection={<IconChartArea size={16} />}>
                Evolução do Patrimônio
              </Tabs.Tab>
              {result.scenarios.map((s) => (
                <Tabs.Tab key={s.name} value={s.name} leftSection={<IconTable size={16} />}>
                  {s.name}
                </Tabs.Tab>
              ))}
            </Tabs.List>
            {activeTab === 'overview' && (
              <Group gap="xs" wrap="wrap">
                <SegmentedControl
                  size="xs"
                  radius="lg"
                  value={overviewMetric}
                  onChange={(v) => setOverviewMetric(v as any)}
                  data={[
                    { label: 'Patrimônio', value: 'wealth' },
                    { label: 'Desembolso', value: 'outflow' },
                  ]}
                />
                <SegmentedControl
                  size="xs"
                  radius="lg"
                  value={chartType}
                  onChange={(v) => setChartType(v as any)}
                  data={[
                    { label: 'Área', value: 'area' },
                    { label: 'Linha', value: 'line' },
                  ]}
                />
              </Group>
            )}
          </Group>
        </Paper>

        <Tabs.Panel value="overview">
          <Paper
            p="xl"
            radius="xl"
            style={{
              border: '1px solid var(--mantine-color-default-border)',
            }}
          >
            <Text fw={600} size="lg" mb="lg" c="bright">
              {overviewMetric === 'wealth'
                ? 'Evolução do Patrimônio ao Longo do Tempo'
                : 'Desembolso mensal (saída de caixa) ao longo do tempo'}
            </Text>
            {chartType === 'area' && (
              <AreaChart
                h={350}
                data={overviewMetric === 'wealth' ? wealthData : outflowData}
                dataKey="month"
                series={result.scenarios.map((s, i) => ({
                  name: s.name,
                  color: ['sage.9', 'info.6', 'forest.6'][i % 3],
                }))}
                curveType="monotone"
                gridAxis="xy"
                withLegend
                legendProps={{ verticalAlign: 'bottom', height: 50 }}
                valueFormatter={(value) => money(value)}
                xAxisProps={{ tickMargin: 10, tickFormatter: (v) => formatYearTickFromMonth(Number(v)) }}
                yAxisProps={{ tickMargin: 10, tickFormatter: (v) => moneyCompact(v as number) }}
                tooltipAnimationDuration={150}
              />
            )}
            {chartType === 'line' && (
              <LineChart
                h={350}
                data={overviewMetric === 'wealth' ? wealthData : outflowData}
                dataKey="month"
                series={result.scenarios.map((s, i) => ({
                  name: s.name,
                  color: ['sage.9', 'info.6', 'forest.6'][i % 3],
                }))}
                curveType="monotone"
                gridAxis="xy"
                withLegend
                legendProps={{ verticalAlign: 'bottom', height: 50 }}
                valueFormatter={(value) => money(value)}
                xAxisProps={{ tickMargin: 10, tickFormatter: (v) => formatYearTickFromMonth(Number(v)) }}
                yAxisProps={{ tickMargin: 10, tickFormatter: (v) => moneyCompact(v as number) }}
                tooltipAnimationDuration={150}
              />
            )}
            <Text size="xs" c="dimmed" mt="sm">
              Eixo X: meses (marcado por anos). Passe o mouse para valores exatos.
            </Text>
          </Paper>
        </Tabs.Panel>

        {result.scenarios.map((s) => {
          const isInvestBuy = s.monthly_data.some((m: any) => m.scenario_type === 'invest_buy');
          let rows = [...s.monthly_data].sort((a: any, b: any) => a.month - b.month);
          if (isInvestBuy && milestonesOnly) {
            rows = rows.filter((m: any) => m.is_milestone || m.status === 'Imóvel comprado');
          }
          const latest = s.monthly_data[s.monthly_data.length - 1];
          const first = s.monthly_data[0];
          const progress = latest?.progress_percent ?? (latest?.equity ? 100 : 0);
          const purchaseMonth = first?.purchase_month;
          const projected = first?.projected_purchase_month;

          const hasCumulativeCost = rows.some(
            (m: any) => m.cumulative_payments != null || m.cumulative_rent_paid != null
          );
          const hasCumulativeSecondary = rows.some(
            (m: any) => m.cumulative_interest != null || m.cumulative_investment_gains != null
          );

          return (
            <Tabs.Panel key={s.name} value={s.name}>
              <Paper
                p="xl"
                radius="xl"
                style={{
                  border: '1px solid var(--mantine-color-default-border)',
                }}
              >
                {/* Scenario header */}
                <Group justify="space-between" mb="lg" wrap="wrap" gap="md">
                  <Box>
                    <Text fw={600} size="lg" c="bright">
                      Detalhamento: {s.name}
                    </Text>
                    <Text size="sm" c="dimmed">
                      Dados mensais da simulação
                    </Text>
                  </Box>
                  {isInvestBuy && (
                    <Group gap="md">
                      <Badge color={purchaseMonth ? 'success' : 'sage'} variant="light" size="lg">
                        {purchaseMonth ? `Comprado no mês ${purchaseMonth}` : 'Ainda não comprado'}
                      </Badge>
                      <Switch
                        size="sm"
                        checked={milestonesOnly}
                        onChange={(e) => setMilestonesOnly(e.currentTarget.checked)}
                        label="Apenas marcos"
                      />
                    </Group>
                  )}
                </Group>

                <Group justify="space-between" align="center" wrap="wrap" gap="sm" mb="md">
                  <SegmentedControl
                    size="xs"
                    radius="lg"
                    value={tableView}
                    onChange={(v) => setTableView(v as any)}
                    data={[
                      { label: 'Essencial', value: 'essential' },
                      { label: 'Detalhada', value: 'detailed' },
                    ]}
                  />
                  <Text size="xs" c="sage.6">
                    Essencial = leitura rápida; Detalhada = mais colunas.
                  </Text>
                </Group>

                {/* Progress info for invest-buy */}
                {isInvestBuy && !purchaseMonth && first?.estimated_months_remaining != null && (
                  <Alert color="warning" variant="light" radius="lg" mb="lg">
                    <Text size="sm">
                      Estimativa de {first.estimated_months_remaining} meses restantes para compra.
                      {projected && ` Previsão: mês ${projected}.`}
                    </Text>
                  </Alert>
                )}

                {/* Table */}
                <ScrollArea h={400} type="hover" scrollbarSize={8} offsetScrollbars>
                  <Table fz="sm" striped highlightOnHover stickyHeader>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Mês</Table.Th>
                        <Table.Th>Ano</Table.Th>
                        <Table.Th>Desembolso</Table.Th>
                        <Table.Th>Patrimônio</Table.Th>
                        <Table.Th>Equidade</Table.Th>
                        <Table.Th>Investimento</Table.Th>
                        <Table.Th>Valor Imóvel</Table.Th>
                        {tableView === 'detailed' && hasCumulativeCost && <Table.Th>Acumulado (custo)</Table.Th>}
                        {tableView === 'detailed' && hasCumulativeSecondary && <Table.Th>Acumulado (juros/ganhos)</Table.Th>}
                        {isInvestBuy && <Table.Th>Progresso</Table.Th>}
                        {isInvestBuy && <Table.Th>Status</Table.Th>}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {rows.slice(0, 600).map((m: any) => {
                        const isPurchase =
                          isInvestBuy && purchaseMonth != null
                            ? m.month === purchaseMonth
                            : m.status === 'Imóvel comprado';
                        const isPostPurchase =
                          isInvestBuy && purchaseMonth != null
                            ? m.month > purchaseMonth
                            : false;
                        const cumulativeCost =
                          m.cumulative_payments != null
                            ? m.cumulative_payments
                            : m.cumulative_rent_paid != null
                              ? m.cumulative_rent_paid
                              : null;
                        const cumulativeSecondary =
                          m.cumulative_interest != null
                            ? m.cumulative_interest
                            : m.cumulative_investment_gains != null
                              ? m.cumulative_investment_gains
                              : null;
                        return (
                          <Table.Tr
                            key={m.month}
                            style={{
                              backgroundColor: isPurchase
                                ? 'light-dark(var(--mantine-color-success-0), var(--mantine-color-dark-7))'
                                : isPostPurchase
                                  ? 'light-dark(var(--mantine-color-sage-0), var(--mantine-color-dark-8))'
                                  : undefined,
                              fontWeight: m.is_milestone ? 600 : 400,
                            }}
                          >
                            <Table.Td>{m.month}</Table.Td>
                            <Table.Td>{yearFromMonth(m.month)}</Table.Td>
                            <Table.Td>{moneySafe(monthlyOutflow(m))}</Table.Td>
                            <Table.Td>{moneySafe(wealthAt(m))}</Table.Td>
                            <Table.Td>{moneySafe(m.equity)}</Table.Td>
                            <Table.Td>{moneySafe(m.investment_balance)}</Table.Td>
                            <Table.Td>{moneySafe(m.property_value)}</Table.Td>
                            {tableView === 'detailed' && hasCumulativeCost && (
                              <Table.Td>{cumulativeCost != null ? moneySafe(cumulativeCost) : '—'}</Table.Td>
                            )}
                            {tableView === 'detailed' && hasCumulativeSecondary && (
                              <Table.Td>{cumulativeSecondary != null ? moneySafe(cumulativeSecondary) : '—'}</Table.Td>
                            )}
                            {isInvestBuy && (
                              <Table.Td>
                                {m.progress_percent != null ? `${m.progress_percent.toFixed(1)}%` : '—'}
                              </Table.Td>
                            )}
                            {isInvestBuy && (
                              <Table.Td>
                                <Badge
                                  size="sm"
                                  variant="light"
                                  color={isPurchase ? 'success' : 'sage'}
                                >
                                  {m.status || '—'}
                                </Badge>
                              </Table.Td>
                            )}
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>

                <Divider my="md" color="sage.2" />
                <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="md">
                  <Box>
                    <Text size="xs" c="sage.5">Break-even</Text>
                    <Text fw={600} c="sage.8">
                      {s.metrics.break_even_month != null ? `Mês ${s.metrics.break_even_month}` : '—'}
                    </Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="sage.5">ROI (bruto)</Text>
                    <Text fw={600} c="sage.8">{percent(s.metrics.roi_percentage)}</Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="sage.5">ROI (ajustado)</Text>
                    <Text fw={600} c="sage.8">
                      {s.metrics.roi_adjusted_percentage != null ? percent(s.metrics.roi_adjusted_percentage) : '—'}
                    </Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="sage.5">Meses com burn</Text>
                    <Text fw={600} c="sage.8">{s.metrics.months_with_burn ?? '—'}</Text>
                  </Box>
                </SimpleGrid>

                {(s.metrics.total_rent_withdrawn_from_investment != null || s.metrics.average_sustainable_withdrawal_ratio != null) && (
                  <Group gap="xs" mt="md" wrap="wrap">
                    {s.metrics.total_rent_withdrawn_from_investment != null && (
                      <Badge variant="light" color="sage">
                        Aluguel sacado do investimento: {money(s.metrics.total_rent_withdrawn_from_investment)}
                      </Badge>
                    )}
                    {s.metrics.average_sustainable_withdrawal_ratio != null && (
                      <Badge variant="light" color="sage">
                        Retirada sustentável média: {ratio(s.metrics.average_sustainable_withdrawal_ratio, 2)} ({ratioAsPercent(s.metrics.average_sustainable_withdrawal_ratio, 0)})
                      </Badge>
                    )}
                  </Group>
                )}
              </Paper>
            </Tabs.Panel>
          );
        })}
      </Tabs>
    </Stack>
  );
}
