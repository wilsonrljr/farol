import { useId, useState } from 'react';
import type { ReactNode } from '../../types/react';
import {
  ActionIcon,
  Box,
  Group,
  Paper,
  SimpleGrid,
  Text,
  ThemeIcon,
  Popover,
  rem,
} from '@mantine/core';
import { IconHelpCircle } from '@tabler/icons-react';

interface MetricCardProps {
  label: string;
  help?: ReactNode;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    label?: string;
  };
  variant?: 'default' | 'highlight' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
}

export function MetricCard({
  label,
  help,
  value,
  description,
  icon,
  trend,
  variant = 'default',
  size = 'md',
}: MetricCardProps) {
  const labelId = useId();
  const [helpOpened, setHelpOpened] = useState(false);
  const sizes = {
    sm: { value: rem(20), label: rem(11), icon: 32 },
    md: { value: rem(26), label: rem(12), icon: 40 },
    lg: { value: rem(32), label: rem(13), icon: 44 },
  };
  const currentSize = sizes[size];

  const background =
    variant === 'highlight'
      ? 'var(--farol-surface-accent)'
      : variant === 'subtle'
        ? 'var(--farol-surface-muted)'
        : 'var(--farol-surface-raised)';

  return (
    <Paper
      component="section"
      aria-labelledby={labelId}
      withBorder
      shadow="none"
      radius="lg"
      p="md"
      style={{
        background,
        borderColor:
          variant === 'highlight'
            ? 'var(--mantine-color-ocean-3)'
            : 'var(--farol-border)',
        height: '100%',
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Group gap={4} align="center" wrap="nowrap">
            <Text
              id={labelId}
              component="h3"
              size="xs"
              fw={600}
              c="dimmed"
              tt="uppercase"
              style={{ letterSpacing: rem(0.4), fontSize: currentSize.label }}
            >
              {label}
            </Text>
            {help && (
              <Popover
                opened={helpOpened}
                onChange={setHelpOpened}
                width={320}
                position="bottom-start"
                withArrow
                shadow="md"
                withinPortal
                returnFocus
              >
                <Popover.Target>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size={44}
                  aria-label={`Explicação sobre ${label}`}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape' && helpOpened) {
                      event.preventDefault();
                      setHelpOpened(false);
                    }
                  }}
                >
                  <IconHelpCircle size={18} aria-hidden="true" />
                </ActionIcon>
                </Popover.Target>
                <Popover.Dropdown>
                  <Text size="sm" lh={1.5}>{help}</Text>
                </Popover.Dropdown>
              </Popover>
            )}
          </Group>
          <Text
            fw={700}
            c={variant === 'highlight' ? 'var(--farol-chart-1)' : 'bright'}
            style={{
              fontSize: currentSize.value,
              lineHeight: 1.2,
              overflowWrap: 'anywhere',
            }}
            mt={6}
          >
            {value}
          </Text>
          {description && (
            <Text size="xs" c="dimmed" mt={6} lh={1.45}>
              {description}
            </Text>
          )}
          {trend && (
            <Group gap={6} mt={6} wrap="wrap">
              <Text size="xs" fw={600} c={trend.value >= 0 ? 'var(--farol-chart-positive)' : 'var(--farol-chart-negative)'}>
                {trend.value >= 0 ? '+' : ''}
                {trend.value}%
              </Text>
              {trend.label && (
                <Text size="xs" c="dimmed">
                  {trend.label}
                </Text>
              )}
            </Group>
          )}
        </Box>
        {icon && (
          <ThemeIcon size={currentSize.icon} radius="md" variant="light" color="ocean">
            {icon}
          </ThemeIcon>
        )}
      </Group>
    </Paper>
  );
}

interface MetricGridProps {
  children: ReactNode;
  columns?: number;
}

export function MetricGrid({ children, columns = 4 }: MetricGridProps) {
  return (
    <SimpleGrid cols={{ base: 1, xs: Math.min(columns, 2), lg: columns }} spacing="md">
      {children}
    </SimpleGrid>
  );
}
