import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Collapse,
  Group,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconChartLine,
  IconChevronDown,
  IconChevronRight,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';

export interface InvestmentReturnItem {
  start_month: number;
  end_month?: number | null;
  annual_rate: number;
}

interface Props {
  value: InvestmentReturnItem[];
  onChange: (value: InvestmentReturnItem[]) => void;
  errors?: Record<string, ReactNode>;
}

function newUiId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

/** Keeps the backend invariant: month 1, no gaps, and only the last range open. */
export function normalizeInvestmentReturnPeriods(
  value: readonly InvestmentReturnItem[]
): InvestmentReturnItem[] {
  const periods = value.map((item) => ({ ...item }));
  if (periods.length === 0) return periods;

  periods[0].start_month = 1;
  for (let index = 0; index < periods.length; index += 1) {
    const period = periods[index];
    period.start_month = Math.max(1, Math.trunc(Number(period.start_month) || 1));

    if (index === periods.length - 1) {
      period.end_month = null;
      continue;
    }

    const proposedEnd = period.end_month == null ? Number.NaN : Number(period.end_month);
    period.end_month = Number.isFinite(proposedEnd)
      ? Math.max(period.start_month, Math.trunc(proposedEnd))
      : period.start_month + 11;
    periods[index + 1].start_month = period.end_month + 1;
  }

  return periods;
}

function annualToMonthlyPercent(annualPercent: number) {
  const annual = Number(annualPercent);
  if (!Number.isFinite(annual) || annual <= -100) return 0;
  return (Math.pow(1 + annual / 100, 1 / 12) - 1) * 100;
}

export default function InvestmentReturnsFieldArray({ value, onChange, errors = {} }: Props) {
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
        const match = /^investment_returns\.(\d+)/.exec(path);
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
  }, [errors, itemIds]);

  const toggleItemCollapse = (id: string) => {
    setCollapsedItems((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const collapseAll = () => setCollapsedItems(new Set(itemIds));
  const expandAll = () => setCollapsedItems(new Set());

  const addItem = () => {
    const periods = normalizeInvestmentReturnPeriods(value);
    const id = newUiId();
    setItemIds((current) => [...current, id]);

    if (periods.length === 0) {
      onChange([{ start_month: 1, end_month: null, annual_rate: 8 }]);
      return;
    }

    const last = periods[periods.length - 1];
    const splitEnd = last.start_month + 11;
    last.end_month = splitEnd;
    periods.push({
      start_month: splitEnd + 1,
      end_month: null,
      annual_rate: last.annual_rate,
    });
    onChange(periods);
  };

  const removeItem = (index: number, id: string) => {
    setItemIds((current) => current.filter((itemId) => itemId !== id));
    setCollapsedItems((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    onChange(normalizeInvestmentReturnPeriods(value.filter((_, itemIndex) => itemIndex !== index)));
  };

  const updateEndMonth = (index: number, rawValue: string | number) => {
    const periods = value.map((item) => ({ ...item }));
    periods[index].end_month = Math.max(
      periods[index].start_month,
      Math.trunc(Number(rawValue) || periods[index].start_month)
    );
    onChange(normalizeInvestmentReturnPeriods(periods));
  };

  const updateAnnualRate = (index: number, rawValue: string | number) => {
    const annualRate = rawValue === '' ? 0 : Number(rawValue);
    onChange(
      value.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, annual_rate: Number.isFinite(annualRate) ? annualRate : 0 }
          : { ...item }
      )
    );
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
        <Box>
          <Group gap="xs">
            <Text fw={650}>Retorno do investimento</Text>
            <Badge size="sm" variant="light" color="ocean" radius="sm">
              {value.length}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed" mt={3}>
            Use períodos apenas quando a taxa mudar ao longo da projeção.
          </Text>
        </Box>
        <Group gap="xs" wrap="wrap">
          {value.length > 1 && (
            <>
              <Tooltip label="Minimizar todos">
                <ActionIcon
                  variant="subtle"
                  color="ocean"
                  size={44}
                  radius="lg"
                  onClick={collapseAll}
                  aria-label="Minimizar todos os retornos"
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
                  aria-label="Expandir todos os retornos"
                >
                  <IconChevronDown size={16} />
                </ActionIcon>
              </Tooltip>
            </>
          )}
          <Button
            leftSection={<IconPlus size={16} />}
            size="sm"
            variant="light"
            color="ocean"
            radius="lg"
            onClick={addItem}
            mih={44}
          >
            Adicionar
          </Button>
        </Group>
      </Group>

      {errors.investment_returns && (
        <Text c="red" size="sm" role="alert">
          {errors.investment_returns}
        </Text>
      )}

      {value.length === 0 && (
        <Paper
          p="lg"
          radius="lg"
          ta="center"
          style={{
            border: '2px dashed var(--mantine-color-default-border)',
            backgroundColor:
              'light-dark(var(--mantine-color-ocean-0), var(--mantine-color-dark-7))',
          }}
        >
          <Stack gap="sm" align="center">
            <ThemeIcon size={48} radius="xl" variant="light" color="ocean">
              <IconChartLine size={24} />
            </ThemeIcon>
            <div>
              <Text
                fw={500}
                c="light-dark(var(--mantine-color-ocean-8), var(--mantine-color-text))"
              >
                Nenhum retorno configurado
              </Text>
              <Text size="sm" c="dimmed">
                Adicione retornos de investimento por período
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
              Adicionar Retorno
            </Button>
          </Stack>
        </Paper>
      )}

      {value.map((item, index) => {
        const itemId = itemIds[index] ?? `return-${index}`;
        const panelId = `investment-return-panel-${itemId}`;
        const isCollapsed = collapsedItems.has(itemId);
        const canDelete = value.length > 1;
        const isLast = index === value.length - 1;
        const periodLabel = item.end_month
          ? `Mês ${item.start_month} a ${item.end_month}`
          : `Mês ${item.start_month} em diante`;
        const monthlyEquivalent = annualToMonthlyPercent(item.annual_rate);

        return (
          <Paper
            key={itemId}
            p={isCollapsed ? 'sm' : 'md'}
            radius="lg"
            withBorder
          >
            <Stack gap={isCollapsed ? 0 : 'md'}>
              <Group justify="space-between" wrap="nowrap">
                <UnstyledButton
                  onClick={() => toggleItemCollapse(itemId)}
                  style={{ flex: 1, minWidth: 0, minHeight: 44 }}
                  aria-expanded={!isCollapsed}
                  aria-controls={panelId}
                >
                  <Group gap="sm" wrap="nowrap">
                    <Box c="ocean.6" style={{ display: 'flex' }}>
                      {isCollapsed ? (
                        <IconChevronRight size={14} />
                      ) : (
                        <IconChevronDown size={14} />
                      )}
                    </Box>
                    <ThemeIcon size={28} radius="lg" variant="light" color="ocean">
                      <IconChartLine size={14} />
                    </ThemeIcon>
                    <Box style={{ minWidth: 0, flex: 1 }}>
                      <Group gap="xs" wrap="nowrap">
                        <Text
                          fw={500}
                          size="sm"
                          c="light-dark(var(--mantine-color-ocean-8), var(--mantine-color-text))"
                        >
                          Retorno {index + 1}
                        </Text>
                        {isCollapsed && (
                          <Text size="xs" c="dimmed" lineClamp={1}>
                            — {periodLabel} • {item.annual_rate}% a.a. (~
                            {monthlyEquivalent.toFixed(2)}% a.m.)
                          </Text>
                        )}
                      </Group>
                    </Box>
                  </Group>
                </UnstyledButton>
                {canDelete && (
                  <ActionIcon
                    color="danger"
                    variant="subtle"
                    size={44}
                    radius="lg"
                    onClick={() => removeItem(index, itemId)}
                    aria-label={`Excluir retorno ${index + 1}`}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                )}
              </Group>

              <Collapse in={!isCollapsed} id={panelId}>
                <Stack gap="md" pt="sm">
                  <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                    <NumberInput
                      name={`investment_returns.${index}.start_month`}
                      label="Mês inicial"
                      description={index === 0 ? 'A série sempre começa no mês 1' : 'Derivado do período anterior'}
                      min={1}
                      value={item.start_month}
                      disabled
                      error={errors[`investment_returns.${index}.start_month`]}
                    />
                    <NumberInput
                      name={`investment_returns.${index}.end_month`}
                      label="Mês final"
                      description={isLast ? 'O último período segue até o fim' : 'Define a próxima mudança de taxa'}
                      min={item.start_month}
                      value={item.end_month ?? ''}
                      placeholder="Indefinido"
                      disabled={isLast}
                      onChange={(nextValue) => updateEndMonth(index, nextValue)}
                      error={errors[`investment_returns.${index}.end_month`]}
                    />
                    <NumberInput
                      name={`investment_returns.${index}.annual_rate`}
                      label="Taxa anual"
                      description={`Retorno anual do investimento (≈ ${monthlyEquivalent.toFixed(2)}% a.m.)`}
                      min={-99.99}
                      max={1000}
                      decimalScale={2}
                      value={item.annual_rate}
                      suffix="% a.a."
                      onChange={(nextValue) => updateAnnualRate(index, nextValue)}
                      error={errors[`investment_returns.${index}.annual_rate`]}
                    />
                  </SimpleGrid>
                </Stack>
              </Collapse>
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}
