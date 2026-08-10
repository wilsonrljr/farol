import { useId } from 'react';
import type { ReactNode } from '../../types/react';
import { Badge, Box, Group, Paper, SimpleGrid, Text, ThemeIcon, VisuallyHidden, rem } from '@mantine/core';
import { IconArrowDownRight, IconArrowUpRight, IconMinus } from '@tabler/icons-react';

interface ScenarioCardProps {
  title: string;
  subtitle?: string;
  value: string;
  badge?: string;
  isWinner?: boolean;
  metrics: Array<{
    label: string;
    value: string;
    trend?: 'up' | 'down' | 'neutral';
  }>;
  icon?: ReactNode;
  color?: string;
}

export function ScenarioCard({
  title,
  subtitle,
  value,
  badge,
  isWinner = false,
  metrics,
  icon,
  color = 'ocean',
}: ScenarioCardProps) {
  const titleId = useId();

  const trendLabel = {
    up: 'Tendência de alta',
    down: 'Tendência de baixa',
    neutral: 'Sem variação',
  } as const;

  return (
    <Paper
      component="article"
      aria-labelledby={titleId}
      withBorder
      shadow="none"
      radius="lg"
      p={{ base: 'md', sm: 'lg' }}
      style={{
        background: isWinner
          ? 'var(--farol-surface-accent)'
          : 'var(--farol-surface-raised)',
        borderColor: isWinner
          ? `var(--mantine-color-${color}-4)`
          : 'var(--farol-border)',
        borderWidth: isWinner ? rem(2) : rem(1),
        height: '100%',
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm" mb="lg">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          {icon && (
            <ThemeIcon size={44} radius="md" variant={isWinner ? 'filled' : 'light'} color={color}>
              {icon}
            </ThemeIcon>
          )}
          <Box style={{ minWidth: 0 }}>
            <Text id={titleId} component="h3" fw={650} size="lg" c="bright" style={{ overflowWrap: 'anywhere' }}>
              {title}
            </Text>
            {subtitle && (
              <Text size="sm" c="dimmed" mt={2}>
                {subtitle}
              </Text>
            )}
          </Box>
        </Group>
        {badge && (
          <Badge color={color} variant={isWinner ? 'filled' : 'light'} size="sm">
            {badge}
          </Badge>
        )}
      </Group>

      <Box mb="lg">
        <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: rem(0.4) }}>
          Patrimônio final
        </Text>
        <Text
          fw={700}
          style={{ fontSize: rem(30), lineHeight: 1.15, overflowWrap: 'anywhere' }}
          c={isWinner ? `light-dark(var(--mantine-color-${color}-8), var(--mantine-color-${color}-3))` : 'bright'}
        >
          {value}
        </Text>
      </Box>

      <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
        {metrics.map((metric) => (
          <Box
            key={metric.label}
            p="sm"
            style={{
              background: 'var(--farol-surface-muted)',
              border: '1px solid var(--farol-border)',
              borderRadius: 'var(--mantine-radius-md)',
            }}
          >
            <Text size="xs" c="dimmed" mb={4}>
              {metric.label}
            </Text>
            <Group gap={6} align="center" wrap="nowrap">
              <Text fw={600} size="sm" c="bright" style={{ overflowWrap: 'anywhere' }}>
                {metric.value}
              </Text>
              {metric.trend === 'up' && (
                <IconArrowUpRight size={14} color="var(--farol-chart-positive)" aria-hidden="true" />
              )}
              {metric.trend === 'down' && (
                <IconArrowDownRight size={14} color="var(--farol-chart-negative)" aria-hidden="true" />
              )}
              {metric.trend === 'neutral' && (
                <IconMinus size={14} color="var(--mantine-color-dimmed)" aria-hidden="true" />
              )}
              {metric.trend && <VisuallyHidden>{trendLabel[metric.trend]}</VisuallyHidden>}
            </Group>
          </Box>
        ))}
      </SimpleGrid>
    </Paper>
  );
}
