import {
  Paper,
  Stack,
  Table,
  Group,
  SimpleGrid,
  ScrollArea,
  Tabs,
  SegmentedControl,
  Badge,
  Button,
  Menu,
  Text,
  Box,
  ThemeIcon,
} from '@mantine/core';
import { LoanSimulationResult } from '../api/types';
import { money } from '../utils/format';
import { AreaChart, LineChart } from '@mantine/charts';
import { useState } from 'react';
import {
  IconDownload,
  IconTable,
  IconChartArea,
  IconClock,
  IconCash,
  IconTrendingUp,
  IconChartBar,
  IconArrowDownRight,
  IconArrowUpRight,
} from '@tabler/icons-react';
import { downloadFile } from '../utils/download';
import { MetricCard } from './ui/MetricCard';
import { formatMonthsYears, formatYearTickFromMonth, moneyCompact, yearFromMonth } from '../utils/format';

export default function LoanResults({
  result,
  inputPayload,
}: {
  result: LoanSimulationResult;
  inputPayload?: unknown;
}) {
  const [chartType, setChartType] = useState<'area' | 'line'>('area');
  const [activeTab, setActiveTab] = useState<string>('fluxo');
  const [tableView, setTableView] = useState<'essential' | 'detailed'>('essential');

  const dataChart = result.installments.map((i) => ({
    month: i.month,
    Juros: i.interest,
    Amortização: i.amortization,
  }));
  const balanceChart = result.installments.map((i) => ({
    month: i.month,
    Saldo: i.outstanding_balance,
  }));

  const totalPaid = result.total_paid;
  const interestPaid = result.total_interest_paid;
  const avgInstallment =
    result.installments.reduce((a, i) => a + i.installment, 0) / result.installments.length;
  const interestPct = totalPaid > 0 ? (interestPaid / totalPaid) * 100 : 0;

  const principalPaid = totalPaid - interestPaid;
  const installmentCount = result.installments.length;
  const firstInstallment = result.installments[0];
  const lastInstallment = result.installments[result.installments.length - 1];

  const originalTermMonths = result.original_term_months ?? installmentCount;
  const actualTermMonths = result.actual_term_months ?? installmentCount;

  const ChartComponent = chartType === 'area' ? AreaChart : LineChart;

  return (
    <Stack gap="lg">
      {/* Badges */}
      {(result.months_saved || result.total_extra_amortization) && (
        <Group gap="xs">
          {result.months_saved && (
            <Badge color="success" variant="light" size="lg">
              -{result.months_saved} meses economizados
            </Badge>
          )}
          {result.total_extra_amortization && result.total_extra_amortization > 0 && (
            <Badge color="sage" variant="light" size="lg">
              {money(result.total_extra_amortization)} em amortizações extras
            </Badge>
          )}
        </Group>
      )}

      {/* Main Metrics Grid */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <MetricCard
          label="Valor Financiado"
          help="Principal do financiamento (valor do imóvel menos a entrada)."
          value={money(result.loan_value)}
          icon={<IconCash size={18} />}
        />
        <MetricCard
          label="Total Pago"
          help="Soma de todas as parcelas pagas (principal + juros + amortizações extras, quando aplicável)."
          value={money(totalPaid)}
          icon={<IconTrendingUp size={18} />}
        />
        <MetricCard
          label="Total em Juros"
          help="Soma dos juros pagos ao longo do tempo (não inclui amortização do principal)."
          value={money(interestPaid)}
          icon={<IconChartBar size={18} />}
          description={`${interestPct.toFixed(1)}% do total`}
        />
        <MetricCard
          label="Parcela Média"
          help="Média simples das parcelas (pode variar por tipo de sistema e amortizações extras)."
          value={money(avgInstallment)}
          icon={<IconClock size={18} />}
        />
      </SimpleGrid>

      {/* Secondary Metrics */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <MetricCard
          label="Principal Pago"
          help="Total do principal amortizado (Total Pago - Total em Juros)."
          value={money(principalPaid)}
          description={`${(100 - interestPct).toFixed(1)}% do total`}
        />
        <MetricCard
          label="Prazo Original"
          help="Prazo planejado antes de amortizações extras."
          value={formatMonthsYears(originalTermMonths)}
        />
        <MetricCard
          label="Prazo Final"
          help="Prazo efetivo considerando amortizações extras (se houver)."
          value={formatMonthsYears(actualTermMonths)}
          description={result.months_saved ? `-${result.months_saved} meses` : undefined}
        />
        <MetricCard
          label="Primeira Parcela"
          help="Valor da parcela no primeiro mês da simulação."
          value={money(firstInstallment.installment)}
          icon={<IconArrowUpRight size={18} />}
        />
        <MetricCard
          label="Última Parcela"
          help="Valor da parcela no último mês da simulação."
          value={money(lastInstallment.installment)}
          icon={<IconArrowDownRight size={18} />}
        />
      </SimpleGrid>

      {/* Charts and Table */}
      <Paper
        radius="lg"
        style={{
          border: '1px solid var(--mantine-color-sage-2)',
          overflow: 'hidden',
        }}
      >
        <Tabs value={activeTab} onChange={(v) => setActiveTab(v || 'fluxo')} variant="default">
          <Box
            px="lg"
            pt="md"
            pb={0}
            style={{
              borderBottom: '1px solid var(--mantine-color-sage-2)',
            }}
          >
            <Group justify="space-between" align="center" mb="md">
              <Tabs.List style={{ border: 'none' }}>
                <Tabs.Tab value="fluxo" leftSection={<IconChartArea size={16} />}>
                  Juros × Amortização
                </Tabs.Tab>
                <Tabs.Tab value="saldo" leftSection={<IconChartBar size={16} />}>
                  Saldo Devedor
                </Tabs.Tab>
                <Tabs.Tab value="tabela" leftSection={<IconTable size={16} />}>
                  Tabela Completa
                </Tabs.Tab>
              </Tabs.List>

              <Group gap="xs">
                <Button
                  size="xs"
                  variant={chartType === 'area' ? 'filled' : 'light'}
                  color="sage"
                  onClick={() => setChartType('area')}
                >
                  Área
                </Button>
                <Button
                  size="xs"
                  variant={chartType === 'line' ? 'filled' : 'light'}
                  color="sage"
                  onClick={() => setChartType('line')}
                >
                  Linha
                </Button>
                {activeTab === 'tabela' && (
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
                )}
                <Menu withinPortal position="bottom-end">
                  <Menu.Target>
                    <Button size="xs" variant="light" leftSection={<IconDownload size={14} />}>
                      Exportar
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>Formato</Menu.Label>
                    <Menu.Item
                      onClick={() =>
                        downloadFile(
                          '/api/simulate-loan/export?format=csv',
                          'POST',
                          inputPayload,
                          'loan_simulation.csv'
                        )
                      }
                    >
                      CSV
                    </Menu.Item>
                    <Menu.Item
                      onClick={() =>
                        downloadFile(
                          '/api/simulate-loan/export?format=xlsx',
                          'POST',
                          inputPayload,
                          'loan_simulation.xlsx'
                        )
                      }
                    >
                      Excel (XLSX)
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Group>
          </Box>

          <Tabs.Panel value="fluxo" p="lg">
            <ChartComponent
              h={300}
              data={dataChart}
              dataKey="month"
              series={[
                { name: 'Juros', color: 'var(--mantine-color-danger-5)' },
                { name: 'Amortização', color: 'var(--mantine-color-success-5)' },
              ]}
              curveType="monotone"
              gridAxis="xy"
              withLegend
              legendProps={{ verticalAlign: 'bottom', height: 50 }}
              valueFormatter={(value) => money(value as number)}
              xAxisProps={{ tickMargin: 10, tickFormatter: (v) => formatYearTickFromMonth(Number(v)) }}
              yAxisProps={{ tickMargin: 10, tickFormatter: (v) => moneyCompact(v as number) }}
              tooltipAnimationDuration={150}
            />
          </Tabs.Panel>

          <Tabs.Panel value="saldo" p="lg">
            <ChartComponent
              h={300}
              data={balanceChart}
              dataKey="month"
              series={[{ name: 'Saldo', color: 'var(--mantine-color-sage-5)' }]}
              curveType="monotone"
              gridAxis="xy"
              withLegend
              legendProps={{ verticalAlign: 'bottom', height: 50 }}
              valueFormatter={(value) => money(value as number)}
              xAxisProps={{ tickMargin: 10, tickFormatter: (v) => formatYearTickFromMonth(Number(v)) }}
              yAxisProps={{ tickMargin: 10, tickFormatter: (v) => moneyCompact(v as number) }}
              tooltipAnimationDuration={150}
            />
          </Tabs.Panel>

          <Tabs.Panel value="tabela" p={0}>
            <ScrollArea h={400} type="hover" scrollbarSize={6}>
              <Table striped highlightOnHover stickyHeader>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ backgroundColor: 'var(--mantine-color-sage-0)' }}>
                      Mês
                    </Table.Th>
                    <Table.Th style={{ backgroundColor: 'var(--mantine-color-sage-0)' }}>
                      Ano
                    </Table.Th>
                    <Table.Th style={{ backgroundColor: 'var(--mantine-color-sage-0)' }}>
                      Parcela
                    </Table.Th>
                    {tableView === 'detailed' && (
                      <Table.Th style={{ backgroundColor: 'var(--mantine-color-sage-0)' }}>
                        Amortização
                      </Table.Th>
                    )}
                    <Table.Th style={{ backgroundColor: 'var(--mantine-color-sage-0)' }}>
                      Juros
                    </Table.Th>
                    <Table.Th style={{ backgroundColor: 'var(--mantine-color-sage-0)' }}>
                      Saldo Devedor
                    </Table.Th>
                    {tableView === 'detailed' && (
                      <Table.Th style={{ backgroundColor: 'var(--mantine-color-sage-0)' }}>
                        Amort. Extra
                      </Table.Th>
                    )}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {result.installments.slice(0, 600).map((i) => (
                    <Table.Tr key={i.month}>
                      <Table.Td fw={500}>{i.month}</Table.Td>
                      <Table.Td>{yearFromMonth(i.month)}</Table.Td>
                      <Table.Td>{money(i.installment)}</Table.Td>
                      {tableView === 'detailed' && <Table.Td>{money(i.amortization)}</Table.Td>}
                      <Table.Td c="danger.6">{money(i.interest)}</Table.Td>
                      <Table.Td>{money(i.outstanding_balance)}</Table.Td>
                      {tableView === 'detailed' && (
                        <Table.Td c={i.extra_amortization > 0 ? 'sage.6' : 'sage.4'}>
                          {money(i.extra_amortization)}
                        </Table.Td>
                      )}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </Stack>
  );
}
