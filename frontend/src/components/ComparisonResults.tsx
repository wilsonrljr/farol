import { Title, Stack, Group, Paper, Text, Table, Accordion, ScrollArea, Menu, Button } from '@mantine/core';
import { ComparisonResult } from '../api/types';
import { money } from '../utils/format';
import { IconDownload } from '@tabler/icons-react';
import { downloadFile } from '../utils/download';

export default function ComparisonResults({ result, inputPayload }: { result: ComparisonResult, inputPayload?: any }) {
  return (
    <Stack>
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <div>
          <Title order={3}>Resultados</Title>
          <Text size="sm">Melhor cenário: <strong>{result.best_scenario}</strong></Text>
        </div>
        <Menu withinPortal position="bottom-end">
          <Menu.Target>
            <Button size="xs" leftSection={<IconDownload size={14} />}>Exportar</Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Básico</Menu.Label>
            <Menu.Item onClick={()=>downloadFile('/api/compare-scenarios/export?format=csv','POST', inputPayload, 'scenarios_comparison.csv')}>CSV</Menu.Item>
            <Menu.Item onClick={()=>downloadFile('/api/compare-scenarios/export?format=xlsx','POST', inputPayload, 'scenarios_comparison.xlsx')}>XLSX</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
      <Group wrap="wrap" gap="sm">
        {result.scenarios.map((s) => (
          <Paper key={s.name} withBorder p="sm" radius="md" style={{ minWidth: 220 }}>
            <Text fw={600}>{s.name}</Text>
            <Text size="xs" c="dimmed">Custo total</Text>
            <Text fw={600}>{money(s.total_cost)}</Text>
            <Text size="xs" c="dimmed">Equidade final</Text>
            <Text fw={600}>{money(s.final_equity)}</Text>
          </Paper>
        ))}
      </Group>
      <Accordion variant="separated" radius="md">
        {result.scenarios.map((s) => (
          <Accordion.Item key={s.name} value={s.name}>
            <Accordion.Control>{s.name}</Accordion.Control>
            <Accordion.Panel>
              <ScrollArea h={300} scrollbarSize={6} type="hover" offsetScrollbars>
        <Table fz="xs" striped withTableBorder stickyHeader stickyHeaderOffset={0} miw={880}>
                  <Table.Thead>
                    <Table.Tr>
          <Table.Th>Mês</Table.Th><Table.Th>Fluxo</Table.Th><Table.Th>Equidade</Table.Th><Table.Th>Invest.</Table.Th><Table.Th>Valor Imóvel</Table.Th><Table.Th>Status</Table.Th><Table.Th>Prog%</Table.Th><Table.Th>Falta</Table.Th><Table.Th>Aporte Fixo</Table.Th><Table.Th>Aporte %</Table.Th><Table.Th>Aporte Total</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {[...s.monthly_data].sort((a:any,b:any)=>a.month-b.month).slice(0, 360).map((m: any) => {
                      const purchase = m.status === 'Imóvel comprado';
                      const phaseColor = m.phase === 'pre_purchase' ? 'var(--mantine-color-sage-0)' : undefined;
                      const style: React.CSSProperties = {
                        background: purchase ? 'var(--mantine-color-sage-1)' : phaseColor,
                        fontWeight: m.is_milestone ? 500 : 400,
                      };
                      return (
                        <Table.Tr key={m.month} style={style}>
                          <Table.Td>{m.month}</Table.Td>
                          <Table.Td>{money(m.cash_flow)}</Table.Td>
                          <Table.Td>{money(m.equity)}</Table.Td>
                          <Table.Td>{money(m.investment_balance)}</Table.Td>
                          <Table.Td>{money(m.property_value)}</Table.Td>
                          <Table.Td>{m.status || ''}</Table.Td>
                          <Table.Td>{m.progress_percent != null ? `${m.progress_percent.toFixed(1)}%` : ''}</Table.Td>
                          <Table.Td>{m.shortfall != null ? money(m.shortfall) : ''}</Table.Td>
                          <Table.Td>{m.extra_contribution_fixed ? money(m.extra_contribution_fixed) : ''}</Table.Td>
                          <Table.Td>{m.extra_contribution_percentage ? money(m.extra_contribution_percentage) : ''}</Table.Td>
                          <Table.Td>{m.extra_contribution_total ? money(m.extra_contribution_total) : ''}</Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
                {s.monthly_data.some((m:any)=>m.scenario_type==='invest_buy') && (
                  <Group gap="xs" mt="xs" wrap="wrap" fz="xs">
                    <span style={{background:'var(--mantine-color-sage-0)',padding:'2px 6px',borderRadius:4}}>Pré-compra</span>
                    <span style={{background:'var(--mantine-color-sage-1)',padding:'2px 6px',borderRadius:4}}>Compra / Pós</span>
                    <span style={{fontWeight:500}}>Negrito = marco</span>
                  </Group>
                )}
              </ScrollArea>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Stack>
  );
}
