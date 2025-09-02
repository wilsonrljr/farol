import { Title, Stack, Group, Paper, Text, Table, SimpleGrid, ScrollArea, SegmentedControl, Tabs, Badge, Switch, Alert } from '@mantine/core';
import { EnhancedComparisonResult } from '../api/types';
import { money, percent } from '../utils/format';
import { AreaChart, BarChart, LineChart } from '@mantine/charts';
import { CardWithStats } from './cards/CardWithStats';
import { ScenarioSummaryCard } from './cards/ScenarioSummaryCard';
import { IconTrendingUp, IconArrowDownRight, IconArrowUpRight, IconMedal, IconCash, IconChartLine, IconBuildingBank } from '@tabler/icons-react';
import { useState } from 'react';

export default function EnhancedComparisonResults({ result }: { result: EnhancedComparisonResult }) {
  const [chartType, setChartType] = useState<'area' | 'bar' | 'line'>('area');
  const [density, setDensity] = useState<'compact' | 'comfortable'>('comfortable');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleExpand = (name: string) => setExpanded(e => ({ ...e, [name]: !e[name] }));
  const wealthSeries = result.scenarios.map((s) => ({ name: s.name, color: 'indigo.6' }));
  const months = new Set<number>();
  result.scenarios.forEach((s) => s.monthly_data.forEach((m) => months.add(m.month)));
  const wealthData = Array.from(months).sort((a,b)=>a-b).map((month) => {
    const row: any = { month };
    result.scenarios.forEach((s) => {
      const md = s.monthly_data.find((m) => m.month === month);
      if (md) row[s.name] = (md.equity || 0) + (md.investment_balance || 0);
    });
    return row;
  });

  const moneySafe = (v: any) => money(v || 0);
  // Show all months by default; user can switch to milestone-only view
  const [milestonesOnly, setMilestonesOnly] = useState(false);
  const colorForProgress = (p: number) => {
    if (p >= 90) return 'green';
    if (p >= 75) return 'teal';
    if (p >= 50) return 'blue';
    if (p >= 25) return 'yellow';
    return 'red';
  };

  return (
    <Stack>
      <Title order={3}>Resultados Avançados</Title>
      <Text size="sm">Melhor cenário: <strong>{result.best_scenario}</strong></Text>
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Group gap="sm">
          <Title order={4}>Visão Geral</Title>
          <SegmentedControl size="xs" value={chartType} onChange={(v)=>setChartType(v as any)} data={[{label:'Área', value:'area'},{label:'Barras', value:'bar'},{label:'Linha', value:'line'}]} />
        </Group>
        <SegmentedControl size="xs" value={density} onChange={(v)=>setDensity(v as any)} data={[{label:'Conforto', value:'comfortable'},{label:'Compacto', value:'compact'}]} />
      </Group>
  <SimpleGrid cols={{ base: 1, sm: density==='compact'?2:1, md: density==='compact'?3:result.scenarios.length }} spacing="md">
        {(() => {
          const ranked = [...result.scenarios].sort((a,b) => {
            if (b.metrics.wealth_accumulation === a.metrics.wealth_accumulation) {
              return b.metrics.roi_percentage - a.metrics.roi_percentage;
            }
            return b.metrics.wealth_accumulation - a.metrics.wealth_accumulation;
          });
          const best = ranked[0];
          const palette = ['indigo','teal','orange','grape'];
          return result.scenarios.map((s, idx) => {
            const accent = palette[idx % palette.length];
            const interestOrRentPct = s.metrics.total_interest_or_rent_paid / (s.total_cost + s.metrics.wealth_accumulation) * 100 || 0;
            const costDelta = s.total_cost - best.total_cost;
            const wealthDelta = s.metrics.wealth_accumulation - best.metrics.wealth_accumulation;
            const costDeltaLabel = costDelta === 0 ? '—' : (costDelta > 0 ? '+'+money(costDelta) : money(costDelta));
            const wealthDeltaLabel = wealthDelta === 0 ? '—' : (wealthDelta > 0 ? '+'+money(wealthDelta) : money(wealthDelta));
            const coreMetrics = [
              { key:'wealth', label:'Patrimônio', value: money(s.metrics.wealth_accumulation), icon:<IconTrendingUp size={14} />, accentColor:accent },
              { key:'equity', label:'Equidade', value: money(s.final_equity), icon:<IconBuildingBank size={14} />, accentColor:accent },
              { key:'roi', label:'ROI', value: percent(s.metrics.roi_percentage), icon:<IconChartLine size={14} /> },
              { key:'custo', label:'Custo', value: money(s.total_cost), icon:<IconCash size={14} /> }
            ];
            const deltaMetrics = [
              { key:'deltaW', label:'Δ Patrimônio', value: wealthDeltaLabel, icon: wealthDelta > 0 ? <IconArrowUpRight size={14} /> : wealthDelta < 0 ? <IconArrowDownRight size={14} /> : <IconMedal size={14} />, accentColor: wealthDelta > 0 ? 'teal' : wealthDelta < 0 ? 'red' : accent },
              { key:'deltaC', label:'Δ Custo', value: costDeltaLabel, icon: costDelta < 0 ? <IconArrowDownRight size={14} /> : costDelta > 0 ? <IconArrowUpRight size={14} /> : <IconMedal size={14} />, accentColor: costDelta < 0 ? 'teal' : costDelta > 0 ? 'red' : accent }
            ];
            const otherMetrics = [
              { key:'avg', label:'Mensal', value: money(s.metrics.average_monthly_cost) },
              { key:'jr', label:'J/Alug %', value: interestOrRentPct.toFixed(1)+'%' }
            ];
            const summaryMetrics = density === 'comfortable' ? coreMetrics : [...coreMetrics, ...deltaMetrics, ...otherMetrics];
            const fullMetrics = [...coreMetrics, ...deltaMetrics, ...otherMetrics];
            return (
              <ScenarioSummaryCard
                key={s.name}
                title={s.name}
                subtitle={s.name === best.name ? 'Maior patrimônio líquido' : 'Comparativo'}
                highlight={s.name === best.name}
                color={accent}
                density={density}
                badges={s.name === best.name ? ['Melhor'] : []}
                metrics={summaryMetrics}
                allMetrics={fullMetrics}
                expandable={density === 'comfortable'}
                expanded={!!expanded[s.name]}
                onToggle={()=>toggleExpand(s.name)}
              />
            );
          });
        })()}
  </SimpleGrid>
      <Tabs defaultValue="wealth" keepMounted={false} variant="pills">
        <Tabs.List>
          <Tabs.Tab value="wealth">Patrimônio</Tabs.Tab>
          {result.scenarios.map((s) => <Tabs.Tab key={s.name} value={s.name}>{s.name}</Tabs.Tab>)}
        </Tabs.List>
        <Tabs.Panel value="wealth" pt="xs">
          <Paper withBorder p="sm" radius="md">
            {chartType === 'area' && (
              <AreaChart h={260} data={wealthData} dataKey="month" series={result.scenarios.map((s,i) => ({ name: s.name, color: ['indigo.6','teal.6','orange.6'][i%3] }))} curveType="monotone" />
            )}
            {chartType === 'bar' && (
              <BarChart h={260} data={wealthData} dataKey="month" series={result.scenarios.map((s,i) => ({ name: s.name, color: ['indigo.6','teal.6','orange.6'][i%3] }))} />
            )}
            {chartType === 'line' && (
              <LineChart h={260} data={wealthData} dataKey="month" series={result.scenarios.map((s,i) => ({ name: s.name, color: ['indigo.6','teal.6','orange.6'][i%3] }))} curveType="monotone" />
            )}
          </Paper>
        </Tabs.Panel>
        {result.scenarios.map((s) => {
          const isInvestBuy = s.monthly_data.some((m: any) => m.scenario_type === 'invest_buy');
          let rows = [...s.monthly_data].sort((a:any,b:any)=>a.month-b.month);
          if (isInvestBuy && milestonesOnly) {
            rows = rows.filter((m: any) => m.is_milestone || m.status === 'Imóvel comprado');
          }
          const latest = s.monthly_data[s.monthly_data.length - 1];
          const first = s.monthly_data[0];
            const progress = latest?.progress_percent ?? (latest?.equity ? 100 : 0);
            const purchaseMonth = first?.purchase_month;
            const projected = first?.projected_purchase_month;
          return (
            <Tabs.Panel key={s.name} value={s.name} pt="xs">
              {isInvestBuy && (
                <Stack gap="xs" mb="xs">
                  <Group justify="space-between" wrap="wrap">
                    <Group gap="sm">
                      <Badge color={purchaseMonth ? 'green' : 'gray'} variant="filled">
                        {purchaseMonth ? `Comprado (mês ${purchaseMonth})` : 'Ainda não comprado'}
                      </Badge>
                      {!purchaseMonth && projected && (
                        <Badge color="blue" variant="light">Prev. compra: mês {projected}</Badge>
                      )}
                      <Badge color={colorForProgress(progress)} variant="light">
                        Progresso {progress.toFixed(1)}%
                      </Badge>
                      {(typeof latest?.shortfall === 'number' && latest.shortfall > 0) && (
                        <Badge color="red" variant="outline">Falta {moneySafe(latest.shortfall)}</Badge>
                      )}
                    </Group>
                    <Group gap="md">
                      <Switch size="xs" checked={milestonesOnly} onChange={(e)=>setMilestonesOnly(e.currentTarget.checked)} label="Apenas marcos" />
                    </Group>
                  </Group>
                  {!purchaseMonth && first?.estimated_months_remaining != null && (
                    <Alert color="blue" variant="light" radius="md" title="Projeção">
                      Estimativa de meses restantes: {first.estimated_months_remaining ?? '—'}
                    </Alert>
                  )}
                </Stack>
              )}
              <Paper withBorder radius="md" p={0} style={{ overflow: 'hidden' }}>
                <ScrollArea h={360} type="hover" scrollbarSize={6} offsetScrollbars>
                  <Table fz="xs" striped withTableBorder stickyHeader stickyHeaderOffset={0} miw={760}>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Mês</Table.Th>
                        <Table.Th>Fluxo</Table.Th>
                        <Table.Th>Equidade</Table.Th>
                        <Table.Th>Invest.</Table.Th>
                        <Table.Th>Valor Imóvel</Table.Th>
                        {isInvestBuy && <Table.Th>Prog%</Table.Th>}
                        {isInvestBuy && <Table.Th>Falta</Table.Th>}
                        {isInvestBuy && <Table.Th>Status</Table.Th>}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {rows.slice(0, 600).map((m: any) => {
                        const purchase = m.status === 'Imóvel comprado';
                        const phaseColor = m.phase === 'pre_purchase' ? 'var(--mantine-color-yellow-light)' : undefined;
                        const style: React.CSSProperties = {
                          background: purchase ? 'var(--mantine-color-green-light)' : phaseColor,
                          fontWeight: m.is_milestone ? 500 : 400,
                        };
                        return (
                          <Table.Tr key={m.month} style={style}>
                            <Table.Td>{m.month}</Table.Td>
                            <Table.Td>{moneySafe(m.cash_flow)}</Table.Td>
                            <Table.Td>{moneySafe(m.equity)}</Table.Td>
                            <Table.Td>{moneySafe(m.investment_balance)}</Table.Td>
                            <Table.Td>{moneySafe(m.property_value)}</Table.Td>
                            {isInvestBuy && <Table.Td>{m.progress_percent != null ? `${m.progress_percent.toFixed(1)}%` : '—'}</Table.Td>}
                            {isInvestBuy && <Table.Td>{m.shortfall != null ? moneySafe(m.shortfall) : '—'}</Table.Td>}
                            {isInvestBuy && <Table.Td>{m.status}</Table.Td>}
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </Paper>
              {isInvestBuy && (
                <Group gap="xs" mt="xs" wrap="wrap" fz="xs">
                  <Badge color="yellow" variant="light">Pré-compra</Badge>
                  <Badge color="green" variant="light">Mês de compra / Pós-compra</Badge>
                  <Badge color="blue" variant="outline">Linha em negrito = marco</Badge>
                </Group>
              )}
            </Tabs.Panel>
          );
        })}
      </Tabs>
    </Stack>
  );
}
