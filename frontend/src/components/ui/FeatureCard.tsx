import type { ReactNode } from '../../types/react';
import { Box, Text, Group, ThemeIcon, rem, UnstyledButton } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import { Link } from 'react-router-dom';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  link?: string;
  color?: string;
}

export function FeatureCard({
  title,
  description,
  icon,
  link,
  color = 'ocean',
}: FeatureCardProps) {
  const content = (
    <Box
      className={link ? 'card-hover' : undefined}
      style={{
        background: 'var(--farol-surface-raised)',
        border: '1px solid var(--farol-border)',
        boxShadow: 'none',
        borderRadius: rem(16),
        padding: rem(24),
        cursor: link ? 'pointer' : 'default',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
      }}
    >
      <Box
        aria-hidden="true"
        style={{
          position: 'absolute',
          insetInline: rem(20),
          top: 0,
          height: rem(3),
          borderRadius: `0 0 ${rem(3)} ${rem(3)}`,
          background: `var(--mantine-color-${color}-5)`,
        }}
      />

      <ThemeIcon 
        size={56} 
        radius="xl" 
        variant="light" 
        color={color} 
        mb="lg"
        style={{
          background: `light-dark(var(--mantine-color-${color}-0), var(--mantine-color-${color}-9))`,
        }}
      >
        {icon}
      </ThemeIcon>
      <Text 
        component="h3"
        fw={600} 
        size="lg" 
        c="bright" 
        mb="xs"
      >
        {title}
      </Text>
      <Text size="sm" c="dimmed" lh={1.6}>
        {description}
      </Text>
      {link && (
        <Group gap={6} mt="lg">
          <Text size="sm" fw={600} c={`light-dark(var(--mantine-color-${color}-7), var(--mantine-color-${color}-3))`}>
            Começar
          </Text>
          <IconChevronRight size={16} color={`light-dark(var(--mantine-color-${color}-7), var(--mantine-color-${color}-3))`} aria-hidden="true" />
        </Group>
      )}
    </Box>
  );

  if (link) {
    return (
      <UnstyledButton
        component={Link}
        to={link}
        style={{ display: 'block', height: '100%', minHeight: rem(44), borderRadius: rem(16) }}
      >
        {content}
      </UnstyledButton>
    );
  }

  return content;
}

interface StepCardProps {
  step: number;
  title: string;
  description: string;
  isActive?: boolean;
}

export function StepCard({ step, title, description, isActive = false }: StepCardProps) {
  return (
    <Box
      style={{
        display: 'flex',
        gap: rem(16),
        padding: rem(16),
        borderRadius: rem(16),
        background: isActive
          ? 'light-dark(var(--mantine-color-ocean-0), var(--mantine-color-dark-7))'
          : 'transparent',
        border: isActive
          ? '1px solid var(--mantine-color-ocean-3)'
          : '1px solid transparent',
        boxShadow: 'none',
        transition: 'background-color 180ms ease, border-color 180ms ease',
      }}
    >
      <Box
        style={{
          width: rem(40),
          height: rem(40),
          borderRadius: rem(12),
          background: isActive
            ? 'var(--mantine-color-ocean-6)'
            : 'light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-6))',
          color: isActive ? 'white' : 'var(--mantine-color-ocean-5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: rem(15),
          flexShrink: 0,
          boxShadow: 'none',
        }}
      >
        {step}
      </Box>
      <Box>
        <Text fw={600} size="md" c={isActive ? 'var(--farol-chart-1)' : 'bright'}>
          {title}
        </Text>
        <Text size="sm" c="dimmed" lh={1.5} mt={2}>
          {description}
        </Text>
      </Box>
    </Box>
  );
}

interface InfoCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export function InfoCard({
  title,
  value,
  subtitle,
  icon,
  variant = 'default',
}: InfoCardProps) {
  const colors = {
    default: { bg: 'ocean', text: 'ocean' },
    success: { bg: 'emerald', text: 'emerald' },
    warning: { bg: 'amber', text: 'amber' },
    danger: { bg: 'rose', text: 'rose' },
  };

  const color = colors[variant];

  return (
    <Box
      style={{
        background: `light-dark(var(--mantine-color-${color.bg}-0), var(--mantine-color-dark-7))`,
        border: `1px solid var(--mantine-color-${color.bg}-3)`,
        boxShadow: 'none',
        borderRadius: rem(16),
        padding: rem(16),
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.5px' }}>
            {title}
          </Text>
          <Text fw={700} size="xl" c={`light-dark(var(--mantine-color-${color.text}-7), var(--mantine-color-${color.text}-3))`} mt={4}>
            {value}
          </Text>
          {subtitle && (
            <Text size="xs" c="dimmed" mt={2}>
              {subtitle}
            </Text>
          )}
        </Box>
        {icon && (
          <ThemeIcon 
            size={44} 
            radius="xl" 
            variant="light" 
            color={color.bg}
            style={{ background: `light-dark(var(--mantine-color-${color.bg}-1), var(--mantine-color-${color.bg}-9))` }}
          >
            {icon}
          </ThemeIcon>
        )}
      </Group>
    </Box>
  );
}
