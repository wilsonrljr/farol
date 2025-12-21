import { useState } from 'react';
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
} from '@mantine/core';
import { EnhancedComparisonResult } from '../api/types';
import { money, percent } from '../utils/format';
import { AreaChart, LineChart } from '@mantine/charts';
import {
  IconTrendingUp,
  IconArrowDownRight,
  IconArrowUpRight,
  IconCrown,
  IconCash,
  IconChartLine,
  IconBuildingBank,
  IconDownload,
  IconTable,
  IconChartArea,
  IconHome,
  IconPigMoney,
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
  const colorMap = ['sage', 'sage', 'sage'];
  const color = colorMap[index % colorMap.length];
  const iconMap = [<IconBuildingBank size={24} />, <IconChartLine size={24} />, <IconPigMoney size={24} />];
  
  const wealthDelta = s.metrics.wealth_accumulation - bestScenario.metrics.wealth_accumulation;
  const costDelta = s.total_cost - bestScenario.total_cost;

  return (
    <Paper
      p="xl"
      radius="lg"
      className={isBest ? 'card-hover' : ''}
      style={{
        backgroundColor: isBest ? 'var(--mantine-color-sage-0)' : 'var(--mantine-color-body)',
        border: isBest ? '2px solid var(--mantine-color-sage-3)' : '1px solid var(--mantine-color-sage-2)',
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
          color='sage'
        >
          {iconMap[index % 3]}
        </ThemeIcon>
        <Box>
          <Text fw={700} size="xl" c={isBest ? 'sage.9' : 'sage.8'}>
            {s.name}
          </Text>
          <Text size="sm" c="sage.5">
            {index === 0 ? 'Financiamento imobiliário' : index === 1 ? 'Aluguel + investimento' : 'Investir para comprar'}
          </Text>
        </Box>
      </Group>

      {/* Main Metric - Patrimônio */}
      <Box
        p="lg"
        mb="lg"
        style={{
          backgroundColor: 'var(--mantine-color-sage-0)',
          borderRadius: rem(10),
        }}
      >
        <Text size="xs" c="sage.6" tt="uppercase" fw={500} style={{ letterSpacing: '0.5px' }}>
          Patrimônio Final
        </Text>
        <Text
          fw={700}
          style={{ fontSize: rem(32), lineHeight: 1.1 }}
          c={isBest ? 'sage.9' : 'sage.8'}
        >
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
              {wealthDelta > 0 ? '+' : ''}{money(wealthDelta)} vs melhor
            </Text>
          </Group>
        )}
      </Box>

      {/* Metrics Grid */}
      <SimpleGrid cols={2} spacing="md">
        <Box>
          <Text size="xs" c="sage.5" mb={2}>
            Custo Total
          </Text>
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
          <Text size="xs" c="sage.5" mb={2}>
            Equidade
          </Text>
          <Text fw={600} size="md" c="sage.8">
            {money(s.final_equity)}
          </Text>
        </Box>
        <Box>
          <Text size="xs" c="sage.5" mb={2}>
            ROI
          </Text>
          <Text fw={600} size="md" c="sage.8">
            {percent(s.metrics.roi_percentage)}
          </Text>
        </Box>
        <Box>
          <Text size="xs" c="sage.5" mb={2}>
            Custo Mensal Médio
          </Text>
          <Text fw={600} size="md" c="sage.8">
            {money(s.metrics.average_monthly_cost)}
          </Text>
        </Box>
      </SimpleGrid>

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
          <Badge variant="light" color="cyan" size="sm">
            Ganho investimento: {money(s.opportunity_cost)}
          </Badge>
        )}
      </Group>
    </Paper>
  );
}

export default function EnhancedComparisonResults({ result, inputPayload }: { result: EnhancedComparisonResult; inputPayload?: any }) {
  const [chartType, setChartType] = useState<'area' | 'line'>('area');
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [milestonesOnly, setMilestonesOnly] = useState(false);

  const months = new Set<number>();
  result.scenarios.forEach((s) => s.monthly_data.forEach((m) => months.add(m.month)));
  
  const wealthData = Array.from(months)
    .sort((a, b) => a - b)
    .map((month) => {
      const row: any = { month: `Mês ${month}` };
      result.scenarios.forEach((s) => {
        const md = s.monthly_data.find((m) => m.month === month);
        if (md) row[s.name] = (md.equity || 0) + (md.investment_balance || 0);
      });
      return row;
    });

  const moneySafe = (v: any) => money(v || 0);

  // Find best scenario
  const ranked = [...result.scenarios].sort((a, b) => {
    if (b.metrics.wealth_accumulation === a.metrics.wealth_accumulation) {
      return b.metrics.roi_percentage - a.metrics.roi_percentage;
    }
    return b.metrics.wealth_accumulation - a.metrics.wealth_accumulation;
  });
  const bestScenario = ranked[0];

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
            Melhor cenário identificado: <Text component="span" fw={600} c="sage.8">{result.best_scenario}</Text>
          </Text>
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

      {/* Charts and Tables */}
      <Tabs value={activeTab} onChange={(v) => setActiveTab(v || 'overview')} variant="pills" radius="lg">
        <Paper
          p="md"
          radius="xl"
          mb="md"
          style={{
            backgroundColor: 'var(--mantine-color-sage-0)',
            border: '1px solid var(--mantine-color-sage-2)',
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
            )}
          </Group>
        </Paper>

        <Tabs.Panel value="overview">
          <Paper
            p="xl"
            radius="xl"
            style={{
              border: '1px solid var(--mantine-color-sage-2)',
            }}
          >
            <Text fw={600} size="lg" mb="lg" c="sage.8">
              Evolução do Patrimônio ao Longo do Tempo
            </Text>
            {chartType === 'area' && (
              <AreaChart
                h={350}
                data={wealthData}
                dataKey="month"
                series={result.scenarios.map((s, i) => ({
                  name: s.name,
                  color: ['sage.9', 'sage.6', 'sage.4'][i % 3],
                }))}
                curveType="monotone"
                gridAxis="xy"
                withLegend
                legendProps={{ verticalAlign: 'bottom', height: 50 }}
                valueFormatter={(value) => money(value)}
              />
            )}
            {chartType === 'line' && (
              <LineChart
                h={350}
                data={wealthData}
                dataKey="month"
                series={result.scenarios.map((s, i) => ({
                  name: s.name,
                  color: ['sage.9', 'sage.6', 'sage.4'][i % 3],
                }))}
                curveType="monotone"
                gridAxis="xy"
                withLegend
                legendProps={{ verticalAlign: 'bottom', height: 50 }}
                valueFormatter={(value) => money(value)}
              />
            )}
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

          return (
            <Tabs.Panel key={s.name} value={s.name}>
              <Paper
                p="xl"
                radius="xl"
                style={{
                  border: '1px solid var(--mantine-color-sage-2)',
                }}
              >
                {/* Scenario header */}
                <Group justify="space-between" mb="lg" wrap="wrap" gap="md">
                  <Box>
                    <Text fw={600} size="lg" c="sage.8">
                      Detalhamento: {s.name}
                    </Text>
                    <Text size="sm" c="sage.5">
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
                        <Table.Th>Fluxo</Table.Th>
                        <Table.Th>Equidade</Table.Th>
                        <Table.Th>Investimento</Table.Th>
                        <Table.Th>Valor Imóvel</Table.Th>
                        {isInvestBuy && <Table.Th>Progresso</Table.Th>}
                        {isInvestBuy && <Table.Th>Status</Table.Th>}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {rows.slice(0, 600).map((m: any) => {
                        const isPurchase = m.status === 'Imóvel comprado';
                        return (
                          <Table.Tr
                            key={m.month}
                            style={{
                              backgroundColor: isPurchase ? 'var(--mantine-color-success-0)' : undefined,
                              fontWeight: m.is_milestone ? 600 : 400,
                            }}
                          >
                            <Table.Td>{m.month}</Table.Td>
                            <Table.Td>{moneySafe(m.cash_flow)}</Table.Td>
                            <Table.Td>{moneySafe(m.equity)}</Table.Td>
                            <Table.Td>{moneySafe(m.investment_balance)}</Table.Td>
                            <Table.Td>{moneySafe(m.property_value)}</Table.Td>
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
              </Paper>
            </Tabs.Panel>
          );
        })}
      </Tabs>
    </Stack>
  );
}
