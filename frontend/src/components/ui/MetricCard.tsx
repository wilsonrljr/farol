import type { ReactNode } from '../../types/react';
import { Box, Text, Group, ThemeIcon, rem, Tooltip, ActionIcon } from '@mantine/core';
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
    sm: { value: rem(20), label: rem(11), icon: 32 },
    md: { value: rem(28), label: rem(12), icon: 40 },
    lg: { value: rem(36), label: rem(13), icon: 48 },
  };

  const currentSize = sizes[size];

  const getBackground = () => {
    switch (variant) {
      case 'highlight':
        return `light-dark(
          linear-gradient(145deg, var(--mantine-color-ocean-0) 0%, rgba(255, 255, 255, 0.85) 100%),
          linear-gradient(145deg, var(--mantine-color-ocean-9) 0%, rgba(30, 41, 59, 0.9) 100%)
        )`;
      case 'subtle':
        return 'var(--glass-bg-subtle)';
      default:
        return 'var(--glass-bg)';
    }
  };

  const getShadow = () => {
    switch (variant) {
      case 'highlight':
        return 'var(--glass-shadow-lg), 0 0 0 1px var(--mantine-color-ocean-2) inset';
      default:
        return 'var(--glass-shadow), var(--glass-shadow-glow)';
    }
  };

  return (
    <Box
      style={{
        padding: rem(16),
        borderRadius: rem(16),
        background: getBackground(),
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: getShadow(),
        transition: 'all 250ms cubic-bezier(0.2, 0, 0, 1)',
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Group gap={4} align="center" wrap="nowrap">
            <Text
              size="xs"
              fw={600}
              c="dimmed"
              tt="uppercase"
              style={{ letterSpacing: '0.5px', fontSize: currentSize.label }}
            >
              {label}
            </Text>
            {help && (
              <Tooltip label={help} multiline w={320} position="top-start">
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
            fw={700}
            c={variant === 'highlight' ? 'ocean.6' : 'bright'}
            style={{ fontSize: currentSize.value, lineHeight: 1.2 }}
            mt={6}
          >
            {value}
          </Text>
          {description && (
            <Text size="xs" c="dimmed" mt={4}>
              {description}
            </Text>
          )}
          {trend && (
            <Group gap={6} mt={6}>
              <Text
                size="xs"
                fw={600}
                c={trend.value >= 0 ? 'emerald.5' : 'rose.5'}
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
            radius="xl"
            variant="light"
            color="ocean"
            style={{
              background: 'light-dark(rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.15))',
            }}
          >
            {icon}
          </ThemeIcon>
        )}
      </Group>
    </Box>
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
        gap: rem(12),
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
