import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
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
import {
  MAX_EXPANDED_SCHEDULE_EVENTS,
  MAX_SCHEDULE_OCCURRENCES,
} from '../constants/limits';

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
  errors?: Record<string, ReactNode>;
  fieldPath?: 'amortizations' | 'contributions';
}

function newUiId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
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
  errors = {},
  fieldPath = 'amortizations',
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
  const [itemIds, setItemIds] = useState(() => value.map(() => newUiId()));
  const [collapsedItems, setCollapsedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    setItemIds((current) => {
      if (current.length === value.length) return current;
      if (current.length > value.length) return current.slice(0, value.length);
      return [
        ...current,
        ...Array.from({ length: value.length - current.length }, () => newUiId()),
      ];
    });
  }, [value.length]);

  useEffect(() => {
    const indexesWithErrors = new Set(
      Object.keys(errors).flatMap((path) => {
        const match = new RegExp(`^${fieldPath}\\.(\\d+)`).exec(path);
        return match ? [Number(match[1])] : [];
      })
    );
    if (indexesWithErrors.size === 0) return;
    setCollapsedItems((current) => {
      const next = new Set(current);
      indexesWithErrors.forEach((index) => {
        const itemId = itemIds[index];
        if (itemId) next.delete(itemId);
      });
      return next.size === current.size ? current : next;
    });
  }, [errors, fieldPath, itemIds]);

  const toggleItemCollapse = (id: string) => {
    setCollapsedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const collapseAll = () => setCollapsedItems(new Set(itemIds));

  const expandAll = () => {
    setCollapsedItems(new Set());
  };

  const previewData = useMemo(() => {
    const out: { month: number; fixed: number; pct: number; fixedInflated: number }[] = [];
    const map = new Map<number, { fixed: number; pct: number; fixedInflated: number }>();
    const monthlyInfl = inflationRate ? Math.pow(1 + inflationRate / 100, 1 / 12) - 1 : 0;

    const validTermMonths = Number.isInteger(termMonths) && termMonths >= 1 ? termMonths : 0;
    let generatedEvents = 0;

    (value || []).forEach((a) => {
      if (generatedEvents >= MAX_EXPANDED_SCHEDULE_EVENTS) return;
      let months: number[] = [];
      const interval = Number(a.interval_months);
      const startValue = Number(a.month ?? 1);
      const start = Number.isInteger(startValue) && startValue >= 1 ? startValue : 1;
      if (Number.isInteger(interval) && interval >= 1 && validTermMonths > 0) {
        if (a.occurrences != null) {
          const occurrences = Number(a.occurrences);
          if (!Number.isInteger(occurrences) || occurrences < 1) return;
          const relevantToHorizon =
            start <= validTermMonths
              ? Math.floor((validTermMonths - start) / interval) + 1
              : 0;
          const count = Math.min(
            occurrences,
            relevantToHorizon,
            MAX_SCHEDULE_OCCURRENCES,
            MAX_EXPANDED_SCHEDULE_EVENTS - generatedEvents
          );
          months = Array.from(
            { length: count },
            (_, i) => start + i * interval
          );
        } else {
          const endValue = Number(a.end_month ?? validTermMonths);
          const end = Number.isInteger(endValue) ? endValue : validTermMonths;
          const relevantToHorizon =
            start <= Math.min(end, validTermMonths)
              ? Math.floor((Math.min(end, validTermMonths) - start) / interval) + 1
              : 0;
          const count = Math.min(
            relevantToHorizon,
            MAX_SCHEDULE_OCCURRENCES,
            MAX_EXPANDED_SCHEDULE_EVENTS - generatedEvents
          );
          months = Array.from({ length: count }, (_, index) => start + index * interval);
        }
      } else if (Number.isInteger(startValue) && startValue >= 1 && startValue <= validTermMonths) {
        months = [startValue];
      }
      generatedEvents += months.length;
      const base = months[0] || 1;
      months.forEach((m) => {
        if (m < 1 || m > validTermMonths) return;
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
    setItemIds((current) => [...current, newUiId()]);
    onChange([...(value || []), baseItem]);
  };

  const removeItem = (index: number, id: string) => {
    setItemIds((current) => current.filter((itemId) => itemId !== id));
    setCollapsedItems((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    onChange(value.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
        <Box>
          <Group gap="xs">
            <Text fw={650}>{ui.configuredTitle}</Text>
            <Badge size="sm" variant="light" color="ocean" radius="sm">
              {(value || []).length}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed" mt={3}>
            Configure eventos únicos ou recorrentes e confira os meses gerados.
          </Text>
        </Box>
        <Group gap="xs" wrap="wrap">
          {(value || []).length > 1 && (
            <>
              <Tooltip label="Minimizar todos">
                <ActionIcon
                  variant="subtle"
                  color="ocean"
                  size={44}
                  radius="lg"
                  onClick={collapseAll}
                  aria-label={`Minimizar ${ui.configuredTitle.toLocaleLowerCase('pt-BR')}`}
                >
                  <IconChevronRight size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Expandir todos">
                <ActionIcon
                  variant="subtle"
                  color="ocean"
                  size={44}
                  radius="lg"
                  onClick={expandAll}
                  aria-label={`Expandir ${ui.configuredTitle.toLocaleLowerCase('pt-BR')}`}
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
              size={44}
              radius="lg"
              onClick={() => setShowPreview((s) => !s)}
              aria-label={showPreview ? 'Ocultar pré-visualização dos meses' : 'Pré-visualizar meses gerados'}
              aria-pressed={showPreview}
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
            mih={44}
          >
            {ui.addButtonLabel}
          </Button>
        </Group>
      </Group>

      {errors[fieldPath] && (
        <Text c="red" size="sm" role="alert">
          {errors[fieldPath]}
        </Text>
      )}

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
              mih={44}
            >
              {ui.addEmptyButtonLabel}
            </Button>
          </Stack>
        </Paper>
      )}

      {/* Amortization Items */}
      {(value || []).map((item, idx) => {
        const itemId = itemIds[idx] ?? `${fieldPath}-${idx}`;
        const panelId = `${fieldPath}-panel-${itemId}`;
        const isCollapsed = collapsedItems.has(itemId);
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
          <Paper
            key={itemId}
            p={isCollapsed ? 'sm' : 'md'}
            radius="lg"
            withBorder
          >
            <Stack gap={isCollapsed ? 0 : 'md'}>
              {/* Header - Always visible, clickable to toggle */}
              <Group justify="space-between" wrap="nowrap">
                <UnstyledButton
                  onClick={() => toggleItemCollapse(itemId)}
                  style={{ flex: 1, minWidth: 0, minHeight: 44 }}
                  aria-expanded={!isCollapsed}
                  aria-controls={panelId}
                >
                  <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                    <Box c="ocean.6" style={{ display: 'flex' }} aria-hidden="true">
                      {isCollapsed ? <IconChevronRight size={14} /> : <IconChevronDown size={14} />}
                    </Box>
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
                </UnstyledButton>
                <ActionIcon
                  color="danger"
                  variant="subtle"
                  size={44}
                  radius="lg"
                  onClick={() => removeItem(idx, itemId)}
                  aria-label={`Excluir ${ui.itemLabel.toLocaleLowerCase('pt-BR')} ${idx + 1}`}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>

              {/* Collapsible content */}
              <Collapse in={!isCollapsed} id={panelId}>
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
                            <ActionIcon
                              variant="subtle"
                              color="ocean"
                              size="sm"
                              aria-label="Explicar seleção de cenários"
                            >
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
                                name={`${fieldPath}.${idx}.applies_to`}
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
                name={`${fieldPath}.${idx}.month`}
                label="Mês inicial"
                description="Quando começa"
                min={1}
                value={item.month || 1}
                onChange={(v) => {
                  const next = [...(value || [])];
                  next[idx] = { ...next[idx], month: Number(v) || 1 } as any;
                  onChange(next as any);
                }}
                error={errors[`${fieldPath}.${idx}.month`]}
              />
              <Select
                name={`${fieldPath}.${idx}.interval_months`}
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
                error={errors[`${fieldPath}.${idx}.interval_months`]}
              />
              <Select
                name={`${fieldPath}.${idx}.value_type`}
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
                  name={`${fieldPath}.${idx}.funding_source`}
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
                  name={`${fieldPath}.${idx}.interval_months`}
                  label="Intervalo (meses)"
                  description="A cada X meses"
                  min={1}
                  value={item.interval_months}
                  onChange={(v) => {
                    const next = [...(value || [])];
                    next[idx] = { ...next[idx], interval_months: Number(v) || 1 } as any;
                    onChange(next as any);
                  }}
                  error={errors[`${fieldPath}.${idx}.interval_months`]}
                />
                <NumberInput
                  name={`${fieldPath}.${idx}.occurrences`}
                  label="Ocorrências"
                  description="Quantas vezes (opcional)"
                  min={1}
                  max={MAX_SCHEDULE_OCCURRENCES}
                  value={item.occurrences ?? ''}
                  placeholder="Indefinido"
                  onChange={(v) => {
                    const next = [...(value || [])];
                    next[idx] = {
                      ...next[idx],
                      occurrences: v === '' ? null : Number(v),
                      end_month: null,
                    } as any;
                    onChange(next as any);
                  }}
                  error={errors[`${fieldPath}.${idx}.occurrences`]}
                />
                <NumberInput
                  name={`${fieldPath}.${idx}.end_month`}
                  label="Mês final"
                  description="Até quando (opcional)"
                  min={item.month || 1}
                  value={item.end_month ?? ''}
                  placeholder="Indefinido"
                  onChange={(v) => {
                    const next = [...(value || [])];
                    next[idx] = {
                      ...next[idx],
                      end_month: v === '' ? null : Number(v),
                      occurrences: null,
                    } as any;
                    onChange(next as any);
                  }}
                  error={errors[`${fieldPath}.${idx}.end_month`]}
                />
              </SimpleGrid>
            )}

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <NumberInput
                name={`${fieldPath}.${idx}.value`}
                label={item.value_type === 'percentage' ? 'Percentual (%)' : 'Valor (R$)'}
                description={
                  item.value_type === 'percentage'
                    ? ui.percentageDescription
                    : 'Valor fixo por ocorrência'
                }
                min={0}
                max={item.value_type === 'percentage' ? 100 : undefined}
                value={item.value}
                onChange={(v) => {
                  const next = [...(value || [])];
                  next[idx] = { ...next[idx], value: Number(v) || 0 } as any;
                  onChange(next as any);
                }}
                error={errors[`${fieldPath}.${idx}.value`]}
                thousandSeparator={item.value_type !== 'percentage' ? '.' : undefined}
                decimalSeparator="," 
                prefix={item.value_type !== 'percentage' ? 'R$ ' : undefined}
                suffix={item.value_type === 'percentage' ? ' %' : undefined}
              />
              {item.value_type !== 'percentage' && (
                <Box pt={24}>
                  <Switch
                    name={`${fieldPath}.${idx}.inflation_adjust`}
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
          </Paper>
        );
      })}

      {/* Preview Panel */}
      <Collapse in={showPreview}>
        <Paper
          p="md"
          radius="lg"
          withBorder
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
