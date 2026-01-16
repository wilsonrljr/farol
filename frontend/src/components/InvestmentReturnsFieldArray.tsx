import { useState } from 'react';
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

interface Item {
  start_month: number;
  end_month?: number | null;
  annual_rate: number;
}

interface Props {
  value: Item[];
  onChange: (val: Item[]) => void;
}

export default function InvestmentReturnsFieldArray({ value, onChange }: Props) {
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

  const addItem = () => {
    onChange([...(value || []), { start_month: 1, end_month: null, annual_rate: 8 }]);
  };

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between">
        <Group gap="xs">
          <Text fw={600} c="ocean.8">
            Retornos de Investimento
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
          <Button
            leftSection={<IconPlus size={16} />}
            size="sm"
            variant="light"
            color="ocean"
            radius="lg"
            onClick={addItem}
          >
            Adicionar
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
              <IconChartLine size={24} />
            </ThemeIcon>
            <div>
              <Text fw={500} c="light-dark(var(--mantine-color-ocean-8), var(--mantine-color-text))">
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
            >
              Adicionar Retorno
            </Button>
          </Stack>
        </Paper>
      )}

      {/* Return Items */}
      {(value || []).map((item, idx) => {
        const isCollapsed = collapsedItems.has(idx);
        const periodLabel = item.end_month
          ? `Mês ${item.start_month} a ${item.end_month}`
          : `Mês ${item.start_month} em diante`;

        return (
          <Paper
            key={idx}
            p={isCollapsed ? 'sm' : 'md'}
            radius="lg"
            style={{
              border: '1px solid var(--mantine-color-default-border)',
              backgroundColor: 'var(--mantine-color-body)',
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
                      <IconChartLine size={14} />
                    </ThemeIcon>
                    <Box style={{ minWidth: 0, flex: 1 }}>
                      <Group gap="xs" wrap="nowrap">
                        <Text fw={500} size="sm" c="light-dark(var(--mantine-color-ocean-8), var(--mantine-color-text))">
                          Retorno {idx + 1}
                        </Text>
                        {isCollapsed && (
                          <Text size="xs" c="dimmed" lineClamp={1}>
                            — {periodLabel} • {item.annual_rate}% a.a.
                          </Text>
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
                  <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                    <NumberInput
                      label="Mês inicial"
                      description="Quando começa este retorno"
                      min={1}
                      value={item.start_month}
                      onChange={(v) => {
                        const arr = [...value];
                        arr[idx].start_month = Number(v) || 1;
                        onChange(arr);
                      }}
                    />
                    <NumberInput
                      label="Mês final"
                      description="Quando termina (vazio = indefinido)"
                      min={1}
                      value={item.end_month ?? ''}
                      placeholder="Indefinido"
                      onChange={(v) => {
                        const arr = [...value];
                        arr[idx].end_month = v ? Number(v) : null;
                        onChange(arr);
                      }}
                    />
                    <NumberInput
                      label="Taxa anual"
                      description="Retorno anual do investimento"
                      min={0}
                      max={200}
                      value={item.annual_rate}
                      suffix="% a.a."
                      onChange={(v) => {
                        const arr = [...value];
                        arr[idx].annual_rate = Number(v) || 0;
                        onChange(arr);
                      }}
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
