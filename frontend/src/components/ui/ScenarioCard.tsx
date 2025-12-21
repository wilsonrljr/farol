import { ReactNode } from 'react';
import { Paper, Text, Box, rem, SimpleGrid, Group, ThemeIcon } from '@mantine/core';
import { IconArrowUpRight, IconArrowDownRight, IconMinus } from '@tabler/icons-react';

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
  color = 'sage',
}: ScenarioCardProps) {
  return (
    <Paper
      p="lg"
      radius="xl"
      className={isWinner ? 'card-hover' : ''}
      style={{
        backgroundColor: isWinner
          ? `var(--mantine-color-${color}-0)`
          : 'var(--mantine-color-body)',
        border: isWinner
          ? `2px solid var(--mantine-color-${color}-3)`
          : '1px solid var(--mantine-color-sage-2)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Winner indicator */}
      {badge && (
        <Box
          style={{
            position: 'absolute',
            top: rem(12),
            right: rem(12),
            backgroundColor: `var(--mantine-color-${color}-5)`,
            color: 'white',
            padding: `${rem(4)} ${rem(12)}`,
            borderRadius: rem(20),
            fontSize: rem(11),
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {badge}
        </Box>
      )}

      {/* Header */}
      <Group gap="md" mb="md">
        {icon && (
          <ThemeIcon
            size={48}
            radius="xl"
            variant={isWinner ? 'filled' : 'light'}
            color={color}
          >
            {icon}
          </ThemeIcon>
        )}
        <Box>
          <Text fw={600} size="lg" c={isWinner ? `${color}.8` : 'sage.8'}>
            {title}
          </Text>
          {subtitle && (
            <Text size="xs" c="sage.6">
              {subtitle}
            </Text>
          )}
        </Box>
      </Group>

      {/* Main Value */}
      <Box mb="lg">
        <Text size="xs" c="sage.5" tt="uppercase" fw={500} style={{ letterSpacing: '0.5px' }}>
          Patrimônio Final
        </Text>
        <Text
          fw={700}
          style={{ fontSize: rem(32), lineHeight: 1.1 }}
          c={isWinner ? `${color}.7` : 'sage.8'}
        >
          {value}
        </Text>
      </Box>

      {/* Metrics Grid */}
      <SimpleGrid cols={2} spacing="sm">
        {metrics.map((metric) => (
          <Box
            key={metric.label}
            p="xs"
            style={{
              backgroundColor: 'var(--mantine-color-sage-0)',
              borderRadius: rem(8),
            }}
          >
            <Text size="xs" c="sage.5" mb={2}>
              {metric.label}
            </Text>
            <Group gap={4} align="center">
              <Text fw={600} size="sm" c="sage.8">
                {metric.value}
              </Text>
              {metric.trend && (
                <>
                  {metric.trend === 'up' && (
                    <IconArrowUpRight size={14} color="var(--mantine-color-success-6)" />
                  )}
                  {metric.trend === 'down' && (
                    <IconArrowDownRight size={14} color="var(--mantine-color-danger-6)" />
                  )}
                  {metric.trend === 'neutral' && (
                    <IconMinus size={14} color="var(--mantine-color-sage-5)" />
                  )}
                </>
              )}
            </Group>
          </Box>
        ))}
      </SimpleGrid>
    </Paper>
  );
}
