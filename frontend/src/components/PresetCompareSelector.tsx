import { useState, useMemo } from 'react';
import {
  Modal,
  Button,
  Stack,
  Group,
  Text,
  Box,
  Paper,
  Checkbox,
  ThemeIcon,
  Badge,
  ScrollArea,
  Alert,
  Divider,
  SimpleGrid,
  rem,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconScale,
  IconBookmark,
  IconArrowRight,
  IconAlertCircle,
  IconCrown,
  IconCheck,
} from '@tabler/icons-react';
import { Preset } from '../utils/presets';
import { ComparisonInput } from '../api/types';

interface PresetCompareSelectorProps {
  presets: Preset<ComparisonInput>[];
  onCompare: (selectedPresets: Preset<ComparisonInput>[]) => void;
  isLoading?: boolean;
  minSelection?: number;
  maxSelection?: number;
}

export function PresetCompareSelector({
  presets,
  onCompare,
  isLoading = false,
  minSelection = 2,
  maxSelection = 10,
}: PresetCompareSelectorProps) {
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectedPresets = useMemo(
    () => presets.filter((p) => selectedIds.has(p.id)),
    [presets, selectedIds]
  );

  const canCompare = selectedPresets.length >= minSelection && selectedPresets.length <= maxSelection;

  const togglePreset = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < maxSelection) {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    const ids = presets.slice(0, maxSelection).map((p) => p.id);
    setSelectedIds(new Set(ids));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleCompare = () => {
    if (canCompare) {
      onCompare(selectedPresets);
      close();
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <>
      <Button
        variant="gradient"
        gradient={{ from: 'ocean.5', to: 'ocean.7', deg: 135 }}
        size="sm"
        leftSection={<IconScale size={16} />}
        onClick={open}
        disabled={presets.length < minSelection}
        loading={isLoading}
      >
        Comparar Presets
      </Button>

      <Modal
        opened={opened}
        onClose={close}
        title={
          <Group gap="sm">
            <ThemeIcon
              size="lg"
              radius="md"
              variant="gradient"
              gradient={{ from: 'ocean.5', to: 'ocean.7', deg: 135 }}
            >
              <IconScale size={18} />
            </ThemeIcon>
            <Box>
              <Text fw={600} size="lg">
                Comparar Presets
              </Text>
              <Text size="xs" c="dimmed">
                Selecione {minSelection}-{maxSelection} presets para comparar
              </Text>
            </Box>
          </Group>
        }
        size="xl"
        centered
        styles={{
          body: { padding: 0 },
        }}
      >
        <Stack gap={0}>
          {/* Actions Bar */}
          <Box
            px="md"
            py="sm"
            style={{
              borderBottom: '1px solid light-dark(rgba(0, 0, 0, 0.06), rgba(255, 255, 255, 0.08))',
              backgroundColor:
                'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))',
            }}
          >
            <Group justify="space-between">
              <Group gap="xs">
                <Badge
                  size="lg"
                  variant={canCompare ? 'filled' : 'light'}
                  color={canCompare ? 'ocean' : 'gray'}
                >
                  {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
                </Badge>
                <Button
                  variant="subtle"
                  color="ocean"
                  size="xs"
                  onClick={selectAll}
                  disabled={presets.length === 0}
                >
                  Selecionar todos
                </Button>
                <Button
                  variant="subtle"
                  color="gray"
                  size="xs"
                  onClick={clearSelection}
                  disabled={selectedIds.size === 0}
                >
                  Limpar seleção
                </Button>
              </Group>
            </Group>
          </Box>

          {/* Info Alert */}
          {selectedIds.size < minSelection && (
            <Alert
              color="blue"
              variant="light"
              icon={<IconAlertCircle size={16} />}
              mx="md"
              mt="md"
            >
              Selecione pelo menos {minSelection} presets para comparar os resultados das
              simulações lado a lado.
            </Alert>
          )}

          {/* Presets List */}
          {presets.length === 0 ? (
            <Box p="xl" ta="center">
              <ThemeIcon size={60} radius="xl" variant="light" color="ocean" mx="auto" mb="md">
                <IconBookmark size={30} />
              </ThemeIcon>
              <Text fw={600} size="lg" mb="xs">
                Nenhum preset disponível
              </Text>
              <Text size="sm" c="dimmed" maw={300} mx="auto">
                Salve configurações de simulação como presets para poder compará-las.
              </Text>
            </Box>
          ) : (
            <ScrollArea.Autosize mah={400} offsetScrollbars>
              <Stack gap={0} p="md">
                {presets.map((preset, index) => {
                  const isSelected = selectedIds.has(preset.id);
                  const input = preset.input;
                  
                  return (
                    <Paper
                      key={preset.id}
                      p="md"
                      radius="md"
                      mb="sm"
                      style={{
                        border: isSelected
                          ? '2px solid var(--mantine-color-ocean-5)'
                          : '1px solid var(--mantine-color-default-border)',
                        backgroundColor: isSelected
                          ? 'light-dark(var(--mantine-color-ocean-0), var(--mantine-color-dark-7))'
                          : undefined,
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                      }}
                      onClick={() => togglePreset(preset.id)}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="md" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                          <Checkbox
                            checked={isSelected}
                            onChange={() => {}}
                            color="ocean"
                            size="md"
                            styles={{ input: { cursor: 'pointer' } }}
                          />
                          <Box style={{ minWidth: 0, flex: 1 }}>
                            <Group gap="xs" mb={4}>
                              <Text fw={600} size="sm" truncate="end">
                                {preset.name}
                              </Text>
                              {index === 0 && (
                                <Badge size="xs" variant="light" color="ocean">
                                  Mais recente
                                </Badge>
                              )}
                            </Group>
                            {preset.description && (
                              <Text size="xs" c="dimmed" lineClamp={1} mb={4}>
                                {preset.description}
                              </Text>
                            )}
                            <SimpleGrid cols={3} spacing="xs">
                              <Group gap={4}>
                                <Text size="xs" c="dimmed">
                                  Imóvel:
                                </Text>
                                <Text size="xs" fw={500}>
                                  {formatMoney(input.property_value)}
                                </Text>
                              </Group>
                              <Group gap={4}>
                                <Text size="xs" c="dimmed">
                                  Entrada:
                                </Text>
                                <Text size="xs" fw={500}>
                                  {formatMoney(input.down_payment)}
                                </Text>
                              </Group>
                              <Group gap={4}>
                                <Text size="xs" c="dimmed">
                                  Prazo:
                                </Text>
                                <Text size="xs" fw={500}>
                                  {input.loan_term_years} anos
                                </Text>
                              </Group>
                            </SimpleGrid>
                          </Box>
                        </Group>
                        <Text size="xs" c="dimmed">
                          {formatDate(preset.updatedAt || preset.createdAt)}
                        </Text>
                      </Group>
                    </Paper>
                  );
                })}
              </Stack>
            </ScrollArea.Autosize>
          )}

          {/* Selected Summary */}
          {selectedPresets.length > 0 && (
            <>
              <Divider />
              <Box
                px="md"
                py="sm"
                style={{
                  backgroundColor:
                    'light-dark(var(--mantine-color-ocean-0), var(--mantine-color-dark-8))',
                }}
              >
                <Text size="xs" c="dimmed" mb="xs" fw={500}>
                  Presets selecionados para comparação:
                </Text>
                <Group gap="xs" wrap="wrap">
                  {selectedPresets.map((preset) => (
                    <Badge
                      key={preset.id}
                      variant="light"
                      color="ocean"
                      size="sm"
                      rightSection={
                        <IconCheck
                          size={12}
                          style={{ marginLeft: rem(4) }}
                        />
                      }
                    >
                      {preset.name}
                    </Badge>
                  ))}
                </Group>
              </Box>
            </>
          )}

          {/* Footer */}
          <Box
            px="md"
            py="md"
            style={{
              borderTop: '1px solid light-dark(rgba(0, 0, 0, 0.06), rgba(255, 255, 255, 0.08))',
            }}
          >
            <Group justify="flex-end" gap="sm">
              <Button variant="subtle" onClick={close}>
                Cancelar
              </Button>
              <Button
                color="ocean"
                leftSection={<IconArrowRight size={16} />}
                onClick={handleCompare}
                disabled={!canCompare}
                loading={isLoading}
              >
                Comparar {selectedPresets.length} preset{selectedPresets.length !== 1 ? 's' : ''}
              </Button>
            </Group>
          </Box>
        </Stack>
      </Modal>
    </>
  );
}
