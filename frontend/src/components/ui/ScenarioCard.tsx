import type { ReactNode } from '../../types/react';
import { Text, Box, rem, SimpleGrid, Group, ThemeIcon } from '@mantine/core';
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
  color = 'ocean',
}: ScenarioCardProps) {
  return (
    <Box
      className={isWinner ? 'card-hover' : ''}
      style={{
        background: isWinner
          ? `light-dark(
              linear-gradient(145deg, var(--mantine-color-${color}-0) 0%, rgba(255, 255, 255, 0.85) 100%),
              linear-gradient(145deg, var(--mantine-color-${color}-9) 0%, rgba(30, 41, 59, 0.9) 100%)
            )`
          : 'var(--glass-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: isWinner 
          ? `var(--glass-shadow-lg), 0 0 0 1px var(--mantine-color-${color}-3) inset`
          : 'var(--glass-shadow), var(--glass-shadow-glow)',
        borderRadius: rem(24),
        padding: rem(24),
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 250ms cubic-bezier(0.2, 0, 0, 1)',
      }}
    >
      {/* Winner badge */}
      {badge && (
        <Box
          style={{
            position: 'absolute',
            top: rem(16),
            right: rem(16),
            background: `linear-gradient(135deg, var(--mantine-color-${color}-5) 0%, var(--mantine-color-${color}-6) 100%)`,
            color: 'white',
            padding: `${rem(6)} ${rem(14)}`,
            borderRadius: rem(20),
            fontSize: rem(11),
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            boxShadow: `0 2px 8px -2px var(--mantine-color-${color}-5)`,
          }}
        >
          {badge}
        </Box>
      )}

      {/* Header */}
      <Group gap="md" mb="lg">
        {icon && (
          <ThemeIcon
            size={52}
            radius="xl"
            variant={isWinner ? 'filled' : 'light'}
            color={color}
            style={{
              boxShadow: isWinner 
                ? `0 4px 12px -2px var(--mantine-color-${color}-5)` 
                : 'none',
            }}
          >
            {icon}
          </ThemeIcon>
        )}
        <Box>
          <Text fw={600} size="lg" c={isWinner ? `${color}.7` : 'bright'}>
            {title}
          </Text>
          {subtitle && (
            <Text size="sm" c="dimmed" mt={2}>
              {subtitle}
            </Text>
          )}
        </Box>
      </Group>

      {/* Main Value */}
      <Box mb="xl">
        <Text 
          size="xs" 
          c="dimmed" 
          tt="uppercase" 
          fw={600} 
          style={{ letterSpacing: '0.5px' }}
        >
          Patrimônio Final
        </Text>
        <Text
          fw={700}
          style={{ fontSize: rem(36), lineHeight: 1.1 }}
          c={isWinner ? `${color}.6` : 'bright'}
        >
          {value}
        </Text>
      </Box>

      {/* Metrics Grid */}
      <SimpleGrid cols={2} spacing="sm">
        {metrics.map((metric) => (
          <Box
            key={metric.label}
            p="sm"
            style={{
              background: 'light-dark(rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.05))',
              borderRadius: rem(12),
            }}
          >
            <Text size="xs" c="dimmed" mb={4}>
              {metric.label}
            </Text>
            <Group gap={6} align="center">
              <Text fw={600} size="sm" c="bright">
                {metric.value}
              </Text>
              {metric.trend && (
                <>
                  {metric.trend === 'up' && (
                    <IconArrowUpRight size={14} color="var(--mantine-color-emerald-5)" />
                  )}
                  {metric.trend === 'down' && (
                    <IconArrowDownRight size={14} color="var(--mantine-color-rose-5)" />
                  )}
                  {metric.trend === 'neutral' && (
                    <IconMinus size={14} color="var(--mantine-color-slate-4)" />
                  )}
                </>
              )}
            </Group>
          </Box>
        ))}
      </SimpleGrid>
    </Box>
  );
}
