import {
  Button,
  Group,
  NumberInput,
  Paper,
  Select,
  Switch,
  Tooltip,
  Table,
  Collapse,
  ActionIcon,
  Text,
  Stack,
  SimpleGrid,
  Box,
  ThemeIcon,
} from '@mantine/core';
import { IconPlus, IconTrash, IconEye, IconCalendar, IconCoin } from '@tabler/icons-react';
import { useState, useMemo } from 'react';
import type { AmortizationInput } from '../api/types';

interface UIText {
  configuredTitle: string;
  emptyTitle: string;
  emptyDescription: string;
  addButtonLabel: string;
  addEmptyButtonLabel: string;
  itemLabel: string;
  percentageDescription: string;
  previewTitle: string;
  percentageFootnote: string;
}

interface Props<T extends AmortizationInput = AmortizationInput> {
  value: T[];
  onChange: (val: T[]) => void;
  termMonths?: number;
  inflationRate?: number | null;
  uiText?: Partial<UIText>;
}

export default function AmortizationsFieldArray({
  value,
  onChange,
  termMonths = 360,
  inflationRate,
  uiText,
}: Props) {
  const ui: UIText = {
    configuredTitle: 'Amortizações Configuradas',
    emptyTitle: 'Nenhuma amortização extra',
    emptyDescription: 'Adicione pagamentos extras para reduzir o prazo ou juros',
    addButtonLabel: 'Adicionar',
    addEmptyButtonLabel: 'Adicionar Amortização',
    itemLabel: 'Amortização',
    percentageDescription: 'Percentual do saldo devedor',
    previewTitle: 'Pré-visualização dos Pagamentos',
    percentageFootnote: '* Valores percentuais dependem do saldo devedor.',
    ...uiText,
  };

  const [showPreview, setShowPreview] = useState(false);

  const previewData = useMemo(() => {
    const out: { month: number; fixed: number; pct: number; fixedInflated: number }[] = [];
    const map = new Map<number, { fixed: number; pct: number; fixedInflated: number }>();
    const monthlyInfl = inflationRate ? Math.pow(1 + inflationRate / 100, 1 / 12) - 1 : 0;

    (value || []).forEach((a) => {
      let months: number[] = [];
      if (a.interval_months && a.interval_months > 0) {
        const start = a.month || 1;
        if (a.occurrences) {
          months = Array.from({ length: a.occurrences }, (_, i) => start + i * a.interval_months!);
        } else {
          const end = a.end_month || termMonths;
          for (let m = start; m <= Math.min(end, termMonths); m += a.interval_months) months.push(m);
        }
      } else if (a.month) {
        months = [a.month];
      }
      const base = months[0] || 1;
      months.forEach((m) => {
        if (m < 1 || m > termMonths) return;
        const entry = map.get(m) || { fixed: 0, pct: 0, fixedInflated: 0 };
        if (a.value_type === 'percentage') {
          entry.pct += a.value;
        } else {
          const nominal = a.value;
          entry.fixed += nominal;
          if (a.inflation_adjust && monthlyInfl > 0) {
            const monthsPassed = m - base;
            entry.fixedInflated += nominal * Math.pow(1 + monthlyInfl, monthsPassed);
          } else {
            entry.fixedInflated += nominal;
          }
        }
        map.set(m, entry);
      });
    });
    Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([month, v]) => out.push({ month, ...v }));
    return out;
  }, [value, termMonths, inflationRate]);

  const totals = useMemo(() => {
    const nominalFixed = previewData.reduce((s, r) => s + r.fixed, 0);
    const inflatedFixed = previewData.reduce((s, r) => s + r.fixedInflated, 0);
    const pctList = previewData.filter((r) => r.pct > 0);
    return { nominalFixed, inflatedFixed, hasPct: pctList.length > 0 };
  }, [previewData]);

  const addItem = () => {
    onChange([...(value || []), { month: 12, value: 10000, value_type: 'fixed' } as any]);
  };

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between">
        <Group gap="xs">
          <Text fw={600} c="sage.8">
            {ui.configuredTitle}
          </Text>
          <Text size="xs" c="sage.5">
            ({(value || []).length})
          </Text>
        </Group>
        <Group gap="xs">
          <Tooltip label="Pré-visualizar meses gerados">
            <ActionIcon
              variant={showPreview ? 'filled' : 'light'}
              color="sage"
              size="md"
              radius="lg"
              onClick={() => setShowPreview((s) => !s)}
            >
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
          <Button
            leftSection={<IconPlus size={16} />}
            size="sm"
            variant="light"
            color="sage"
            radius="lg"
            onClick={addItem}
          >
            {ui.addButtonLabel}
          </Button>
        </Group>
      </Group>

      {/* Empty State */}
      {(value || []).length === 0 && (
        <Paper
          p="lg"
          radius="lg"
          ta="center"
          style={{
            border: '2px dashed var(--mantine-color-default-border)',
            backgroundColor: 'light-dark(var(--mantine-color-sage-0), var(--mantine-color-dark-7))',
          }}
        >
          <Stack gap="sm" align="center">
            <ThemeIcon size={48} radius="xl" variant="light" color="sage">
              <IconCoin size={24} />
            </ThemeIcon>
            <div>
              <Text fw={500} c="light-dark(var(--mantine-color-sage-8), var(--mantine-color-text))">
                {ui.emptyTitle}
              </Text>
              <Text size="sm" c="dimmed">
                {ui.emptyDescription}
              </Text>
            </div>
            <Button
              leftSection={<IconPlus size={16} />}
              variant="light"
              color="sage"
              radius="lg"
              onClick={addItem}
            >
              {ui.addEmptyButtonLabel}
            </Button>
          </Stack>
        </Paper>
      )}

      {/* Amortization Items */}
      {(value || []).map((item, idx) => (
        <Paper
          key={idx}
          p="md"
          radius="lg"
          style={{
            border: '1px solid var(--mantine-color-default-border)',
            backgroundColor: 'var(--mantine-color-body)',
          }}
        >
          <Stack gap="md">
            <Group justify="space-between">
              <Group gap="xs">
                <ThemeIcon size={32} radius="lg" variant="light" color="sage">
                  <IconCalendar size={16} />
                </ThemeIcon>
                <Text fw={500} c="light-dark(var(--mantine-color-sage-8), var(--mantine-color-text))">
                  {ui.itemLabel} {idx + 1}
                </Text>
              </Group>
              <ActionIcon
                color="danger"
                variant="subtle"
                size="md"
                radius="lg"
                onClick={() => onChange(value.filter((_, i) => i !== idx))}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
              <NumberInput
                label="Mês inicial"
                description="Quando começa"
                min={1}
                value={item.month || 1}
                onChange={(v) => {
                  const arr = [...value];
                  arr[idx].month = Number(v) || 1;
                  onChange(arr);
                }}
              />
              <Select
                label="Recorrência"
                description="Única ou periódica"
                value={item.interval_months ? 'rec' : 'one'}
                data={[
                  { value: 'one', label: 'Única' },
                  { value: 'rec', label: 'Recorrente' },
                ]}
                onChange={(val) => {
                  const arr = [...value];
                  if (val === 'rec') {
                    arr[idx].interval_months = arr[idx].interval_months || 12;
                  } else {
                    arr[idx].interval_months = null;
                    arr[idx].end_month = null;
                    arr[idx].occurrences = null;
                  }
                  onChange(arr);
                }}
              />
              <Select
                label="Tipo de valor"
                description="Fixo ou percentual"
                value={item.value_type || 'fixed'}
                onChange={(val) => {
                  const arr = [...value];
                  arr[idx].value_type = (val as 'fixed' | 'percentage') || 'fixed';
                  onChange(arr);
                }}
                data={[
                  { value: 'fixed', label: 'Valor Fixo (R$)' },
                  { value: 'percentage', label: '% do Saldo' },
                ]}
              />
            </SimpleGrid>

            {item.interval_months && (
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                <NumberInput
                  label="Intervalo (meses)"
                  description="A cada X meses"
                  min={1}
                  value={item.interval_months}
                  onChange={(v) => {
                    const arr = [...value];
                    arr[idx].interval_months = Number(v) || 1;
                    onChange(arr);
                  }}
                />
                <NumberInput
                  label="Ocorrências"
                  description="Quantas vezes (opcional)"
                  min={1}
                  value={item.occurrences || ''}
                  placeholder="Indefinido"
                  onChange={(v) => {
                    const arr = [...value];
                    arr[idx].occurrences = v ? Number(v) : null;
                    arr[idx].end_month = null;
                    onChange(arr);
                  }}
                />
                <NumberInput
                  label="Mês final"
                  description="Até quando (opcional)"
                  min={item.month || 1}
                  value={item.end_month || ''}
                  placeholder="Indefinido"
                  onChange={(v) => {
                    const arr = [...value];
                    arr[idx].end_month = v ? Number(v) : null;
                    arr[idx].occurrences = null;
                    onChange(arr);
                  }}
                />
              </SimpleGrid>
            )}

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <NumberInput
                label={item.value_type === 'percentage' ? 'Percentual (%)' : 'Valor (R$)'}
                description={
                  item.value_type === 'percentage'
                    ? ui.percentageDescription
                    : 'Valor fixo por ocorrência'
                }
                min={0}
                value={item.value}
                onChange={(v) => {
                  const arr = [...value];
                  arr[idx].value = Number(v) || 0;
                  onChange(arr);
                }}
                thousandSeparator={item.value_type !== 'percentage' ? '.' : undefined}
                decimalSeparator=","
                prefix={item.value_type !== 'percentage' ? 'R$ ' : undefined}
                suffix={item.value_type === 'percentage' ? ' %' : undefined}
              />
              {item.value_type !== 'percentage' && (
                <Box pt={24}>
                  <Switch
                    label="Ajustar pela inflação"
                    description="Corrigir valor ao longo do tempo"
                    checked={!!item.inflation_adjust}
                    onChange={(e) => {
                      const arr = [...value];
                      arr[idx].inflation_adjust = e.currentTarget.checked;
                      onChange(arr);
                    }}
                  />
                </Box>
              )}
            </SimpleGrid>
          </Stack>
        </Paper>
      ))}

      {/* Preview Panel */}
      <Collapse in={showPreview}>
        <Paper
          p="md"
          radius="lg"
          style={{
            border: '1px solid var(--mantine-color-default-border)',
            backgroundColor: 'light-dark(var(--mantine-color-sage-0), var(--mantine-color-dark-7))',
          }}
        >
          <Text fw={600} size="sm" c="bright" mb="md">
            {ui.previewTitle}
          </Text>

          {previewData.length === 0 && (
            <Text size="sm" c="dimmed">
              Nenhum mês gerado com as configurações atuais.
            </Text>
          )}

          {previewData.length > 0 && (
            <Box style={{ overflowX: 'auto' }}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Mês</Table.Th>
                    <Table.Th>Valor Fixo</Table.Th>
                    <Table.Th>% Saldo</Table.Th>
                    <Table.Th>Fixo Ajustado</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {previewData.slice(0, 20).map((r) => (
                    <Table.Tr key={r.month}>
                      <Table.Td fw={500}>{r.month}</Table.Td>
                      <Table.Td>
                        {r.fixed.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </Table.Td>
                      <Table.Td>{r.pct.toFixed(2)}%</Table.Td>
                      <Table.Td>
                        {r.fixedInflated.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>
          )}

          {previewData.length > 20 && (
            <Text size="xs" c="dimmed" mt="sm">
              Mostrando primeiros 20 de {previewData.length} meses.
            </Text>
          )}

          <Group gap="lg" mt="md">
            <div>
              <Text size="xs" c="dimmed">
                Total nominal
              </Text>
              <Text fw={600} size="sm" c="bright">
                {totals.nominalFixed.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Total ajustado
              </Text>
              <Text fw={600} size="sm" c="bright">
                {totals.inflatedFixed.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </Text>
            </div>
            {totals.hasPct && (
              <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>
                {ui.percentageFootnote}
              </Text>
            )}
          </Group>
        </Paper>
      </Collapse>
    </Stack>
  );
}
