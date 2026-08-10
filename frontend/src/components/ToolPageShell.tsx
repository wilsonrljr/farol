import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Accordion,
  Badge,
  Box,
  Button,
  Container,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconBookmark,
  IconCheck,
  IconChevronRight,
  IconTrash,
} from '@tabler/icons-react';
import type { Preset } from '../utils/presets';

interface ToolPageShellProps {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}

/** Shared, low-noise page frame for the planning tools. */
export function ToolPageShell({ title, description, icon, children }: ToolPageShellProps) {
  return (
    <Container size="lg" py={{ base: 'lg', md: 'xl' }}>
      <Stack gap="xl">
        <Box component="header">
          <Badge variant="light" color="ocean" mb="sm">
            Ferramenta de planejamento
          </Badge>
          <Group gap="md" align="flex-start" wrap="nowrap">
            <ThemeIcon size={48} radius="xl" variant="light" color="ocean" aria-hidden="true">
              {icon}
            </ThemeIcon>
            <Box style={{ minWidth: 0 }}>
              <Title
                order={1}
                fw={720}
                style={{ fontSize: 'clamp(1.75rem, 5vw, 2.5rem)', lineHeight: 1.12 }}
              >
                {title}
              </Title>
              <Text c="dimmed" mt="xs" maw={720} lh={1.6}>
                {description}
              </Text>
            </Box>
          </Group>

          <Paper withBorder radius="lg" px={{ base: 'md', sm: 'lg' }} py="sm" mt="lg">
            <Group gap="lg" wrap="wrap">
              {['Preencha os dados', 'Simule o cenário', 'Interprete o resultado'].map(
                (label, index) => (
                  <Group key={label} gap="xs" wrap="nowrap">
                    <Badge circle variant="light" color="ocean">
                      {index + 1}
                    </Badge>
                    <Text size="sm" fw={index === 0 ? 650 : 500}>
                      {label}
                    </Text>
                    {index < 2 && (
                      <IconChevronRight
                        size={15}
                        color="var(--mantine-color-dimmed)"
                        aria-hidden="true"
                      />
                    )}
                  </Group>
                )
              )}
            </Group>
          </Paper>
        </Box>

        {children}
      </Stack>
    </Container>
  );
}

interface ToolPanelProps {
  title?: string;
  description?: string;
  children: ReactNode;
  id?: string;
}

export function ToolPanel({ title, description, children, id }: ToolPanelProps) {
  return (
    <Paper id={id} withBorder radius="xl" p={{ base: 'md', sm: 'xl' }}>
      {(title || description) && (
        <Box mb="lg">
          {title && (
            <Title order={2} size="h3" fw={680}>
              {title}
            </Title>
          )}
          {description && (
            <Text size="sm" c="dimmed" mt={4} maw={720}>
              {description}
            </Text>
          )}
        </Box>
      )}
      {children}
    </Paper>
  );
}

interface ToolMetricCardProps {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: 'default' | 'positive' | 'warning' | 'danger' | 'accent';
}

const metricTone: Record<NonNullable<ToolMetricCardProps['tone']>, string | undefined> = {
  default: undefined,
  positive: 'teal',
  warning: 'yellow',
  danger: 'red',
  accent: 'ocean',
};

export function ToolMetricCard({ label, value, detail, tone = 'default' }: ToolMetricCardProps) {
  const color = metricTone[tone];
  return (
    <Paper
      withBorder
      radius="lg"
      p="lg"
      style={
        color
          ? {
              borderColor: `var(--mantine-color-${color}-3)`,
              background: `light-dark(var(--mantine-color-${color}-0), color-mix(in srgb, var(--mantine-color-${color}-9) 18%, var(--mantine-color-body)))`,
            }
          : undefined
      }
    >
      <Text size="sm" c="dimmed" fw={550}>
        {label}
      </Text>
      <Text fw={720} size="xl" mt={4} style={{ overflowWrap: 'anywhere' }}>
        {value}
      </Text>
      {detail && (
        <Text size="xs" c="dimmed" mt="xs" lh={1.45}>
          {detail}
        </Text>
      )}
    </Paper>
  );
}

interface ToolResultsProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function ToolResults({ title, description, children }: ToolResultsProps) {
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      titleRef.current?.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
      titleRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <Stack component="section" gap="lg" aria-labelledby={titleId}>
      <Box>
        <Badge
          variant="light"
          color="teal"
          leftSection={<IconCheck size={13} />}
          role="status"
        >
          Simulação concluída
        </Badge>
        <Title
          ref={titleRef}
          id={titleId}
          order={2}
          size="h2"
          mt="sm"
          fw={700}
          tabIndex={-1}
        >
          {title}
        </Title>
        <Text c="dimmed" mt={4} maw={720}>
          {description}
        </Text>
      </Box>
      {children}
    </Stack>
  );
}

interface ToolPresetsPanelProps<T> {
  presets: Preset<T>[];
  name: string;
  onNameChange: (name: string) => void;
  onSave: () => void;
  onLoad: (preset: Preset<T>) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  renderSummary: (preset: Preset<T>) => ReactNode;
  placeholder: string;
  maxNameLength: number;
}

export function ToolPresetsPanel<T>({
  presets,
  name,
  onNameChange,
  onSave,
  onLoad,
  onDelete,
  onClear,
  renderSummary,
  placeholder,
  maxNameLength,
}: ToolPresetsPanelProps<T>) {
  const [clearOpened, setClearOpened] = useState(false);

  return (
    <>
      <Accordion variant="separated" radius="lg">
        <Accordion.Item value="presets">
          <Accordion.Control icon={<IconBookmark size={18} />}>
            <Group gap="xs" wrap="wrap">
              <Text fw={650}>Cenários salvos</Text>
              <Badge variant="light" color="ocean">
                {presets.length}
              </Badge>
              <Text size="sm" c="dimmed">
                Reutilize uma configuração sem poluir o formulário principal.
              </Text>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" verticalSpacing="sm">
                <TextInput
                  label="Nome do cenário"
                  placeholder={placeholder}
                  value={name}
                  onChange={(event) => onNameChange(event.currentTarget.value)}
                  maxLength={maxNameLength}
                />
                <Group align="flex-end" gap="xs" wrap="wrap">
                  <Button onClick={onSave} color="ocean" mih={44}>
                    Salvar configuração
                  </Button>
                  {presets.length > 0 && (
                    <Button
                      variant="subtle"
                      color="red"
                      mih={44}
                      onClick={() => setClearOpened(true)}
                    >
                      Excluir todos
                    </Button>
                  )}
                </Group>
              </SimpleGrid>

              {presets.length === 0 ? (
                <Paper withBorder radius="md" p="lg" ta="center">
                  <Text fw={600}>Nenhum cenário salvo</Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    Dê um nome à configuração atual para encontrá-la aqui depois.
                  </Text>
                </Paper>
              ) : (
                <Stack gap="xs">
                  {presets.map((preset) => (
                    <Paper key={preset.id} withBorder radius="md" p="md">
                      <Group justify="space-between" align="center" wrap="wrap" gap="md">
                        <Box style={{ minWidth: 0, flex: 1 }}>
                          <Text fw={650}>{preset.name}</Text>
                          <Text size="xs" c="dimmed" mt={3}>
                            {renderSummary(preset)}
                          </Text>
                        </Box>
                        <Group gap="xs">
                          <Button variant="light" color="ocean" mih={44} onClick={() => onLoad(preset)}>
                            Carregar
                          </Button>
                          <Button
                            variant="subtle"
                            color="red"
                            mih={44}
                            onClick={() => onDelete(preset.id)}
                          >
                            Excluir
                          </Button>
                        </Group>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      <Modal
        opened={clearOpened}
        onClose={() => setClearOpened(false)}
        title="Excluir todos os cenários?"
        centered
        size="sm"
      >
        <Stack>
          <Text size="sm" c="dimmed">
            Os {presets.length} cenários salvos nesta ferramenta serão removidos. Esta ação não pode
            ser desfeita.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" mih={44} onClick={() => setClearOpened(false)}>
              Cancelar
            </Button>
            <Button
              color="red"
              mih={44}
              leftSection={<IconTrash size={16} />}
              onClick={() => {
                onClear();
                setClearOpened(false);
              }}
            >
              Excluir todos
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
