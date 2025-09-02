import { Title, Stack, Group, Paper, Text, Table, Accordion, ScrollArea } from '@mantine/core';
import { ComparisonResult } from '../api/types';
import { money } from '../utils/format';

export default function ComparisonResults({ result }: { result: ComparisonResult }) {
  return (
    <Stack>
      <Title order={3}>Resultados</Title>
      <Text size="sm">Melhor cenário: <strong>{result.best_scenario}</strong></Text>
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
                <Table fz="xs" striped withTableBorder stickyHeader stickyHeaderOffset={0} miw={640}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Mês</Table.Th><Table.Th>Fluxo</Table.Th><Table.Th>Equidade</Table.Th><Table.Th>Invest.</Table.Th><Table.Th>Valor Imóvel</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {s.monthly_data.slice(0, 360).map((m: any) => (
                      <Table.Tr key={m.month}>
                        <Table.Td>{m.month}</Table.Td>
                        <Table.Td>{money(m.cash_flow)}</Table.Td>
                        <Table.Td>{money(m.equity)}</Table.Td>
                        <Table.Td>{money(m.investment_balance)}</Table.Td>
                        <Table.Td>{money(m.property_value)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Stack>
  );
}
