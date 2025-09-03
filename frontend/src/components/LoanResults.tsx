import { Paper, Stack, Title, Table, Group, SimpleGrid, ScrollArea, SegmentedControl, Tabs, Badge } from '@mantine/core';
import { LoanSimulationResult } from '../api/types';
import { money } from '../utils/format';
import { AreaChart, BarChart, LineChart } from '@mantine/charts';
import { ScenarioSummaryCard } from './cards/ScenarioSummaryCard';
import { useState } from 'react';
import { IconCash, IconTrendingUp, IconChartBar, IconArrowDownRight, IconArrowUpRight, IconChartLine } from '@tabler/icons-react';

export default function LoanResults({ result }: { result: LoanSimulationResult }) {
  const [chartType, setChartType] = useState<'area' | 'bar' | 'line'>('area');
  const [density, setDensity] = useState<'compact' | 'comfortable'>('comfortable');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleExpand = (key: string) => setExpanded(e => ({ ...e, [key]: !e[key] }));
  const dataChart = result.installments.map((i) => ({ month: i.month, Juros: i.interest, Amortizacao: i.amortization }));
  const balanceChart = result.installments.map((i) => ({ month: i.month, Saldo: i.outstanding_balance }));

  const totalPaid = result.total_paid;
  const interestPaid = result.total_interest_paid;
  const avgInstallment = result.installments.reduce((a, i) => a + i.installment, 0) / result.installments.length;
  const interestPct = totalPaid > 0 ? (interestPaid / totalPaid) * 100 : 0;

  const principalPaid = totalPaid - interestPaid;
  const installmentCount = result.installments.length;
  const firstInstallment = result.installments[0];
  const lastInstallment = result.installments[result.installments.length - 1];

  // Metrics for overview card
  const overviewCore = [
    { key:'fin', label:'Financiado', value: money(result.loan_value), icon:<IconCash size={14} /> },
    { key:'pago', label:'Pago', value: money(totalPaid), icon:<IconTrendingUp size={14} /> },
    { key:'juros', label:'Juros', value: money(interestPaid), icon:<IconChartBar size={14} />, accentColor:'red' },
    { key:'media', label:'Parc. Méd', value: money(avgInstallment), icon:<IconChartLine size={14} /> }
  ];
  const overviewExtra = [
    { key:'jurosPct', label:'Juros %', value: interestPct.toFixed(1)+'%' },
    { key:'principalPct', label:'Principal %', value: (100-interestPct).toFixed(1)+'%' },
    { key:'principal', label:'Principal', value: money(principalPaid) },
    { key:'prazo', label:'Parcelas', value: installmentCount.toString() }
  ];

  // Metrics for extremes card
  const extremesCore = [
    { key:'primeira', label:'1ª Parc', value: money(firstInstallment.installment), icon:<IconArrowUpRight size={14} />, accentColor:'indigo' },
    { key:'ultima', label:'Última', value: money(lastInstallment.installment), icon:<IconArrowDownRight size={14} />, accentColor:'teal' }
  ];
  const extremesExtra = [
    { key:'maiorJ', label:'Maior Juros', value: money(Math.max(...result.installments.map(i => i.interest))) },
    { key:'menorJ', label:'Menor Juros', value: money(Math.min(...result.installments.map(i => i.interest))) },
    { key:'maiorParc', label:'Maior Parc', value: money(Math.max(...result.installments.map(i => i.installment))) },
    { key:'menorParc', label:'Menor Parc', value: money(Math.min(...result.installments.map(i => i.installment))) }
  ];

  const metaBadges: React.ReactNode[] = [];
  if (result.months_saved) {
    metaBadges.push(<Badge key="months_saved" color="teal" variant="light">-{result.months_saved} meses</Badge>);
  }
  if (result.total_extra_amortization) {
    metaBadges.push(<Badge key="extra_total" color="indigo" variant="light">Extra {money(result.total_extra_amortization)}</Badge>);
  }
  if (result.actual_term_months && result.original_term_months && result.actual_term_months !== result.original_term_months) {
    const pct = ((result.original_term_months - result.actual_term_months) / result.original_term_months) * 100;
    metaBadges.push(<Badge key="pct_saved" color="grape" variant="light">Prazo -{pct.toFixed(1)}%</Badge>);
  }

  return (
    <Stack>
      <Title order={3}>Resultados</Title>
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Title order={4}>Visão Geral</Title>
        <Group gap="xs">
          <SegmentedControl size="xs" value={chartType} onChange={(v)=>setChartType(v as any)} data={[{label:'Área', value:'area'},{label:'Barras', value:'bar'},{label:'Linha', value:'line'}]} />
          <SegmentedControl size="xs" value={density} onChange={(v)=>setDensity(v as any)} data={[{label:'Conforto', value:'comfortable'},{label:'Compacto', value:'compact'}]} />
        </Group>
      </Group>
      {metaBadges.length > 0 && (
        <Group gap="xs" mb={-4} wrap="wrap">{metaBadges}</Group>
      )}
      <SimpleGrid cols={{ base: 1, md: density==='compact'?2:1, lg: density==='compact'?2:2 }} spacing="md">
        <ScenarioSummaryCard
          title="Resumo"
          subtitle="Financiamento"
          color="indigo"
          density={density}
          expandable={density==='comfortable'}
          expanded={!!expanded.overview}
          onToggle={()=>toggleExpand('overview')}
          metrics={density==='comfortable' ? overviewCore : [...overviewCore, ...overviewExtra]}
          allMetrics={[...overviewCore, ...overviewExtra]}
          badges={[`Juros ${interestPct.toFixed(1)}%`]}
        />
        <ScenarioSummaryCard
          title="Extremos"
          subtitle="Parcelas e Juros"
          color="teal"
          density={density}
          expandable={density==='comfortable'}
          expanded={!!expanded.extremos}
          onToggle={()=>toggleExpand('extremos')}
          metrics={density==='comfortable' ? extremesCore : [...extremesCore, ...extremesExtra]}
          allMetrics={[...extremesCore, ...extremesExtra]}
        />
      </SimpleGrid>
      <Tabs defaultValue="fluxo" keepMounted={false} variant="pills">
        <Tabs.List>
          <Tabs.Tab value="fluxo">Fluxo Juros x Amortização</Tabs.Tab>
          <Tabs.Tab value="saldo">Saldo Devedor</Tabs.Tab>
          <Tabs.Tab value="tabela">Tabela</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="fluxo" pt="xs">
          <Paper withBorder p="sm" radius="md">
            {chartType === 'area' && (
              <AreaChart h={260} data={dataChart} dataKey="month" series={[{name:'Juros', color:'red.6'},{name:'Amortizacao', color:'indigo.6'}]} curveType="monotone" />
            )}
            {chartType === 'bar' && (
              <BarChart h={260} data={dataChart} dataKey="month" series={[{name:'Juros', color:'red.6'},{name:'Amortizacao', color:'indigo.6'}]} />
            )}
            {chartType === 'line' && (
              <LineChart h={260} data={dataChart} dataKey="month" series={[{name:'Juros', color:'red.6'},{name:'Amortizacao', color:'indigo.6'}]} curveType="monotone" />
            )}
          </Paper>
        </Tabs.Panel>
        <Tabs.Panel value="saldo" pt="xs">
          <Paper withBorder p="sm" radius="md">
            {chartType === 'area' && (
              <AreaChart h={260} data={balanceChart} dataKey="month" series={[{name:'Saldo', color:'teal.6'}]} curveType="monotone" />
            )}
            {chartType === 'bar' && (
              <BarChart h={260} data={balanceChart} dataKey="month" series={[{name:'Saldo', color:'teal.6'}]} />
            )}
            {chartType === 'line' && (
              <LineChart h={260} data={balanceChart} dataKey="month" series={[{name:'Saldo', color:'teal.6'}]} curveType="monotone" />
            )}
          </Paper>
        </Tabs.Panel>
        <Tabs.Panel value="tabela" pt="xs">
          <Paper withBorder radius="md" p={0} style={{ overflow: 'hidden' }}>
            <ScrollArea h={400} type="hover" scrollbarSize={6} offsetScrollbars>
              <Table striped withTableBorder highlightOnHover stickyHeader stickyHeaderOffset={0} fz="xs" miw={780}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Mês</Table.Th>
                    <Table.Th>Parcela</Table.Th>
                    <Table.Th>Amortização</Table.Th>
                    <Table.Th>Juros</Table.Th>
                    <Table.Th>Saldo Devedor</Table.Th>
                    <Table.Th>Extra</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {result.installments.slice(0, 600).map((i) => (
                    <Table.Tr key={i.month}>
                      <Table.Td>{i.month}</Table.Td>
                      <Table.Td>{money(i.installment)}</Table.Td>
                      <Table.Td>{money(i.amortization)}</Table.Td>
                      <Table.Td>{money(i.interest)}</Table.Td>
                      <Table.Td>{money(i.outstanding_balance)}</Table.Td>
                      <Table.Td>{money(i.extra_amortization)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
