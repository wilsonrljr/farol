import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Chip,
  Collapse,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  ThemeIcon,
  Tooltip,
  Badge,
  UnstyledButton,
} from '@mantine/core';
import { IconCalendar, IconCoin, IconEye, IconInfoCircle, IconPlus, IconTrash, IconChevronDown, IconChevronRight, IconCheck } from '@tabler/icons-react';
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
  showFundingSource?: boolean;
  showScenarioSelector?: boolean;
  scenarioOptions?: { value: string; label: string }[];
}

export default function AmortizationsFieldArray({
  value,
  onChange,
  termMonths = 360,
  inflationRate,
  uiText,
  showFundingSource = true,
  showScenarioSelector = false,
  scenarioOptions = [],
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
  const [collapsedItems, setCollapsedItems] = useState<Set<number>>(new Set());

  const toggleItemCollapse = (idx: number) => {
    setCollapsedItems((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const collapseAll = () => {
    setCollapsedItems(new Set((value || []).map((_, i) => i)));
  };

  const expandAll = () => {
    setCollapsedItems(new Set());
  };

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
    const baseItem: any = { month: 12, value: 10000, value_type: 'fixed' };
    if (showScenarioSelector && scenarioOptions.length > 0) {
      // Default to all scenarios (matches backend behavior when applies_to is omitted).
      baseItem.applies_to = scenarioOptions.map((o) => o.value);
    }
    onChange([...(value || []), baseItem]);
  };

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between">
        <Group gap="xs">
          <Text fw={600} c="ocean.8">
            {ui.configuredTitle}
          </Text>
          <Badge size="sm" variant="light" color="ocean" radius="sm">
            {(value || []).length}
          </Badge>
        </Group>
        <Group gap="xs">
          {(value || []).length > 1 && (
            <>
              <Tooltip label="Minimizar todos">
                <ActionIcon
                  variant="subtle"
                  color="ocean"
                  size="md"
                  radius="lg"
                  onClick={collapseAll}
                >
                  <IconChevronRight size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Expandir todos">
                <ActionIcon
                  variant="subtle"
                  color="ocean"
                  size="md"
                  radius="lg"
                  onClick={expandAll}
                >
                  <IconChevronDown size={16} />
                </ActionIcon>
              </Tooltip>
            </>
          )}
          <Tooltip label="Pré-visualizar meses gerados">
            <ActionIcon
              variant={showPreview ? 'filled' : 'light'}
              color="ocean"
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
            color="ocean"
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
            backgroundColor: 'light-dark(var(--mantine-color-ocean-0), var(--mantine-color-dark-7))',
          }}
        >
          <Stack gap="sm" align="center">
            <ThemeIcon size={48} radius="xl" variant="light" color="ocean">
              <IconCoin size={24} />
            </ThemeIcon>
            <div>
              <Text fw={500} c="light-dark(var(--mantine-color-ocean-8), var(--mantine-color-text))">
                {ui.emptyTitle}
              </Text>
              <Text size="sm" c="dimmed">
                {ui.emptyDescription}
              </Text>
            </div>
            <Button
              leftSection={<IconPlus size={16} />}
              variant="light"
              color="ocean"
              radius="lg"
              onClick={addItem}
            >
              {ui.addEmptyButtonLabel}
            </Button>
          </Stack>
        </Paper>
      )}

      {/* Amortization Items */}
      {(value || []).map((item, idx) => {
        const isCollapsed = collapsedItems.has(idx);
        const itemSummary = item.value_type === 'percentage'
          ? `${item.value}% do saldo`
          : `R$ ${item.value?.toLocaleString('pt-BR')}`;
        const recurrenceLabel = item.interval_months
          ? `a cada ${item.interval_months} meses`
          : 'única';

        const appliesTo: string[] | null | undefined = (item as any).applies_to;
        const selectedScenarios: string[] =
          showScenarioSelector && scenarioOptions.length > 0
            ? (Array.isArray(appliesTo) ? appliesTo : scenarioOptions.map((o) => o.value))
            : [];
        
        // Create shorter labels for display in collapsed state
        const shortScenarioLabels: Record<string, string> = {
          'buy': 'Financ.',
          'rent_invest': 'Alugar',
          'invest_buy': 'À Vista',
        };
        
        const isAllScenarios = selectedScenarios.length === scenarioOptions.length;
        const scenarioSummary = showScenarioSelector && scenarioOptions.length > 0
          ? (isAllScenarios ? 'Todos' : selectedScenarios.map(v => shortScenarioLabels[v] || v).join(', '))
          : null;

        return (
          <Box
            key={idx}
            p={isCollapsed ? 'sm' : 'md'}
            style={{
              background: 'light-dark(rgba(255, 255, 255, 0.5), rgba(15, 23, 42, 0.5))',
              borderRadius: 'var(--mantine-radius-lg)',
              boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.08)',
              transition: 'all 200ms ease',
            }}
          >
            <Stack gap={isCollapsed ? 0 : 'md'}>
              {/* Header - Always visible, clickable to toggle */}
              <UnstyledButton
                onClick={() => toggleItemCollapse(idx)}
                style={{ width: '100%' }}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                    <ActionIcon
                      variant="subtle"
                      color="ocean"
                      size="sm"
                      radius="lg"
                    >
                      {isCollapsed ? <IconChevronRight size={14} /> : <IconChevronDown size={14} />}
                    </ActionIcon>
                    <ThemeIcon size={28} radius="lg" variant="light" color="ocean">
                      <IconCalendar size={14} />
                    </ThemeIcon>
                    <Box style={{ minWidth: 0, flex: 1 }}>
                      <Group gap="xs" wrap="nowrap">
                        <Text fw={500} size="sm" c="light-dark(var(--mantine-color-ocean-8), var(--mantine-color-text))">
                          {ui.itemLabel} {idx + 1}
                        </Text>
                        {isCollapsed && (
                          <>
                            <Text size="xs" c="dimmed" lineClamp={1}>
                              — Mês {item.month || 1} • {itemSummary} • {recurrenceLabel}
                            </Text>
                            {showScenarioSelector && scenarioOptions.length > 0 && !isAllScenarios && (
                              <Badge
                                size="xs"
                                variant="light"
                                color={selectedScenarios.length === 1 ? 'teal' : 'ocean'}
                                radius="sm"
                              >
                                {scenarioSummary}
                              </Badge>
                            )}
                          </>
                        )}
                      </Group>
                    </Box>
                  </Group>
                  <ActionIcon
                    color="danger"
                    variant="subtle"
                    size="md"
                    radius="lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(value.filter((_, i) => i !== idx));
                    }}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </UnstyledButton>

              {/* Collapsible content */}
              <Collapse in={!isCollapsed}>
                <Stack gap="md" pt="sm">
                  {/* Scenario selector - shown first as a dedicated section when enabled */}
                  {showScenarioSelector && scenarioOptions.length > 0 && (
                    <Paper
                      p="sm"
                      radius="md"
                      style={{
                        backgroundColor: 'light-dark(var(--mantine-color-ocean-0), var(--mantine-color-dark-6))',
                        border: '1px solid light-dark(var(--mantine-color-ocean-1), var(--mantine-color-dark-4))',
                      }}
                    >
                      <Stack gap="xs">
                        <Group justify="space-between" align="center">
                          <Text size="sm" fw={500} c="ocean.7">
                            Aplicar em quais cenários?
                          </Text>
                          <Tooltip label="Este aporte será considerado apenas nos cenários selecionados">
                            <ActionIcon variant="subtle" color="ocean" size="sm">
                              <IconInfoCircle size={14} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                        <Chip.Group
                          multiple
                          value={selectedScenarios}
                          onChange={(vals) => {
                            // Prevent empty selection
                            if (!vals || vals.length === 0) return;
                            const next = [...(value || [])];
                            next[idx] = { ...(next[idx] as any), applies_to: vals } as any;
                            onChange(next as any);
                          }}
                        >
                          <Group gap="xs">
                            {scenarioOptions.map((o) => (
                              <Chip
                                key={o.value}
                                value={o.value}
                                variant="outline"
                                color="ocean"
                                size="sm"
                                radius="md"
                              >
                                {o.label}
                              </Chip>
                            ))}
                          </Group>
                        </Chip.Group>
                        {selectedScenarios.length === scenarioOptions.length && (
                          <Text size="xs" c="dimmed" fs="italic">
                            Todos os cenários selecionados = comportamento padrão
                          </Text>
                        )}
                      </Stack>
                    </Paper>
                  )}

                  <SimpleGrid cols={{ base: 1, sm: 2, md: showFundingSource ? 4 : 3 }} spacing="md">
              <NumberInput
                label="Mês inicial"
                description="Quando começa"
                min={1}
                value={item.month || 1}
                onChange={(v) => {
                  const next = [...(value || [])];
                  next[idx] = { ...next[idx], month: Number(v) || 1 } as any;
                  onChange(next as any);
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
                  const next = [...(value || [])];
                  if (val === 'rec') {
                    next[idx] = {
                      ...next[idx],
                      month: next[idx].month || 1,
                      interval_months: next[idx].interval_months || 12,
                    } as any;
                  } else {
                    next[idx] = {
                      ...next[idx],
                      interval_months: null,
                      end_month: null,
                      occurrences: null,
                    } as any;
                  }
                  onChange(next as any);
                }}
              />
              <Select
                label="Tipo de valor"
                description="Fixo ou percentual"
                value={item.value_type || 'fixed'}
                onChange={(val) => {
                  const next = [...(value || [])];
                  next[idx] = {
                    ...next[idx],
                    value_type: (val as 'fixed' | 'percentage') || 'fixed',
                  } as any;
                  onChange(next as any);
                }}
                data={[
                  { value: 'fixed', label: 'Valor Fixo (R$)' },
                  { value: 'percentage', label: '% do Saldo' },
                ]}
              />
              {showFundingSource && (
                <Select
                  label="Fonte do recurso"
                  description="De onde vem o pagamento extra"
                  value={item.funding_source || 'cash'}
                  onChange={(val) => {
                    const next = [...(value || [])];
                    next[idx] = {
                      ...next[idx],
                      funding_source: (val as 'cash' | 'fgts' | 'bonus' | '13_salario') || 'cash',
                    } as any;
                    onChange(next as any);
                  }}
                  data={[
                    { value: 'cash', label: '💵 Recursos Próprios' },
                    { value: 'fgts', label: '🏦 FGTS' },
                    { value: '13_salario', label: '🎄 13º Salário' },
                    { value: 'bonus', label: '🎯 Bônus' },
                  ]}
                />
              )}
            </SimpleGrid>

            {showFundingSource && item.funding_source === 'fgts' && (
              <Paper
                p="sm"
                radius="md"
                style={{ backgroundColor: 'light-dark(var(--mantine-color-ocean-0), var(--mantine-color-dark-6))' }}
              >
                <Group gap="xs" align="flex-start">
                  <IconInfoCircle size={16} color="var(--mantine-color-ocean-6)" style={{ marginTop: 2 }} />
                  <Text size="xs" c="dimmed">
                    FGTS só pode ser usado se houver saldo e após carência de 24 meses desde o último saque (inclui uso na entrada).
                  </Text>
                </Group>
              </Paper>
            )}

            {item.interval_months && (
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                <NumberInput
                  label="Intervalo (meses)"
                  description="A cada X meses"
                  min={1}
                  value={item.interval_months}
                  onChange={(v) => {
                    const next = [...(value || [])];
                    next[idx] = { ...next[idx], interval_months: Number(v) || 1 } as any;
                    onChange(next as any);
                  }}
                />
                <NumberInput
                  label="Ocorrências"
                  description="Quantas vezes (opcional)"
                  min={1}
                  value={item.occurrences || ''}
                  placeholder="Indefinido"
                  onChange={(v) => {
                    const next = [...(value || [])];
                    next[idx] = {
                      ...next[idx],
                      occurrences: v ? Number(v) : null,
                      end_month: null,
                    } as any;
                    onChange(next as any);
                  }}
                />
                <NumberInput
                  label="Mês final"
                  description="Até quando (opcional)"
                  min={item.month || 1}
                  value={item.end_month || ''}
                  placeholder="Indefinido"
                  onChange={(v) => {
                    const next = [...(value || [])];
                    next[idx] = {
                      ...next[idx],
                      end_month: v ? Number(v) : null,
                      occurrences: null,
                    } as any;
                    onChange(next as any);
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
                  const next = [...(value || [])];
                  next[idx] = { ...next[idx], value: Number(v) || 0 } as any;
                  onChange(next as any);
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
                      const next = [...(value || [])];
                      next[idx] = {
                        ...next[idx],
                        inflation_adjust: e.currentTarget.checked,
                      } as any;
                      onChange(next as any);
                    }}
                  />
                </Box>
              )}
            </SimpleGrid>
                </Stack>
              </Collapse>
            </Stack>
          </Box>
        );
      })}

      {/* Preview Panel */}
      <Collapse in={showPreview}>
        <Box
          p="md"
          style={{
            background: 'light-dark(rgba(255, 255, 255, 0.5), rgba(15, 23, 42, 0.5))',
            borderRadius: 'var(--mantine-radius-lg)',
            boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.08)',
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
            )}n          </Group>
        </Box>
      </Collapse>
    </Stack>
  );
}
