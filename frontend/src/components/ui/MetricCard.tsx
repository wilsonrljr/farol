import type { ReactNode } from '../../types/react';
import { Box, Text, Group, ThemeIcon, rem, Paper, Tooltip, ActionIcon } from '@mantine/core';
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
  const sizes = {
    sm: { value: rem(20), label: rem(12), icon: 28 },
    md: { value: rem(28), label: rem(13), icon: 36 },
    lg: { value: rem(36), label: rem(14), icon: 44 },
  };

  const currentSize = sizes[size];

  const bgColors = {
    default: 'var(--mantine-color-body)',
    highlight: 'light-dark(var(--mantine-color-sage-0), var(--mantine-color-dark-7))',
    subtle: 'light-dark(var(--mantine-color-sage-0), var(--mantine-color-dark-7))',
  };

  const borderColors = {
    default: 'var(--mantine-color-default-border)',
    highlight: 'light-dark(var(--mantine-color-sage-3), var(--mantine-color-dark-5))',
    subtle: 'var(--mantine-color-default-border)',
  };

  return (
    <Paper
      p="md"
      radius="lg"
      style={{
        backgroundColor: bgColors[variant],
        border: `1px solid ${borderColors[variant]}`,
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box style={{ flex: 1 }}>
          <Group gap={4} align="center" wrap="nowrap">
            <Text
              size="xs"
              fw={500}
              c="dimmed"
              tt="uppercase"
              style={{ letterSpacing: '0.5px', fontSize: currentSize.label }}
            >
              {label}
            </Text>
            {help && (
              <Tooltip label={help} multiline w={320} withArrow position="top-start">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="xs"
                  aria-label={`Ajuda: ${label}`}
                >
                  <IconHelpCircle size={14} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
          <Text
            fw={600}
            c={
              variant === 'highlight'
                ? 'light-dark(var(--mantine-color-sage-9), var(--mantine-color-text))'
                : 'bright'
            }
            style={{ fontSize: currentSize.value, lineHeight: 1.2 }}
            mt={4}
          >
            {value}
          </Text>
          {description && (
            <Text size="xs" c="dimmed" mt={4}>
              {description}
            </Text>
          )}
          {trend && (
            <Group gap={4} mt={4}>
              <Text
                size="xs"
                fw={500}
                c={trend.value >= 0 ? 'sage.7' : 'danger.6'}
              >
                {trend.value >= 0 ? '+' : ''}{trend.value}%
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
          <ThemeIcon
            size={currentSize.icon}
            radius="lg"
            variant="light"
            color="sage"
          >
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
    <Box
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: rem(16),
        '@media (max-width: 992px)': {
          gridTemplateColumns: 'repeat(2, 1fr)',
        },
        '@media (max-width: 576px)': {
          gridTemplateColumns: '1fr',
        },
      }}
    >
      {children}
    </Box>
  );
}
