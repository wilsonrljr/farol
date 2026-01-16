import type { ReactNode } from '../../types/react';
import { Box, Text, Group, ThemeIcon, rem, UnstyledButton, Paper } from '@mantine/core';
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
    <Paper
      p="xl"
      radius="xl"
      className="card-hover"
      style={{
        border: '1px solid var(--mantine-color-default-border)',
        cursor: link ? 'pointer' : 'default',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: 'var(--mantine-color-body)',
      }}
    >
      {/* Accent bar on hover */}
      <Box
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: rem(3),
          background: `linear-gradient(90deg, var(--mantine-color-${color}-5) 0%, var(--mantine-color-${color}-7) 100%)`,
          opacity: 0,
          transition: 'opacity 200ms ease',
        }}
        className="feature-card-accent"
      />
      
      <ThemeIcon 
        size={52} 
        radius="xl" 
        variant="light" 
        color={color} 
        mb="md"
      >
        {icon}
      </ThemeIcon>
      <Text fw={600} size="lg" c="light-dark(var(--mantine-color-ocean-8), var(--mantine-color-text))" mb="xs">
        {title}
      </Text>
      <Text size="sm" c="dimmed" lh={1.6}>
        {description}
      </Text>
      {link && (
        <Group gap={4} mt="md">
          <Text size="sm" fw={500} c={`${color}.6`}>
            Começar
          </Text>
          <IconChevronRight size={16} color={`var(--mantine-color-${color}-6)`} />
        </Group>
      )}
    </Paper>
  );

  if (link) {
    return (
      <UnstyledButton component={Link} to={link} style={{ display: 'block', height: '100%' }}>
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
        borderRadius: rem(12),
        backgroundColor: isActive
          ? 'light-dark(var(--mantine-color-ocean-0), var(--mantine-color-dark-7))'
          : 'transparent',
        border: isActive
          ? '1px solid var(--mantine-color-default-border)'
          : '1px solid transparent',
        transition: 'all 200ms ease',
      }}
    >
      <Box
        style={{
          width: rem(36),
          height: rem(36),
          borderRadius: rem(8),
          backgroundColor: isActive
            ? 'var(--mantine-color-ocean-6)'
            : 'light-dark(var(--mantine-color-slate-2), var(--mantine-color-dark-7))',
          color: isActive ? 'white' : 'var(--mantine-color-ocean-6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 600,
          fontSize: rem(14),
          flexShrink: 0,
        }}
      >
        {step}
      </Box>
      <Box>
        <Text fw={600} size="md" c={isActive ? 'ocean.7' : 'bright'}>
          {title}
        </Text>
        <Text size="sm" c="dimmed" lh={1.5}>
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
    success: { bg: 'success', text: 'success' },
    warning: { bg: 'warning', text: 'warning' },
    danger: { bg: 'danger', text: 'danger' },
  };

  const color = colors[variant];

  return (
    <Paper
      p="md"
      radius="xl"
      style={{
        backgroundColor: `light-dark(var(--mantine-color-${color.bg}-0), var(--mantine-color-dark-7))`,
        border: '1px solid var(--mantine-color-default-border)',
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box>
          <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
            {title}
          </Text>
          <Text fw={700} size="xl" c={`${color.text}.7`}>
            {value}
          </Text>
          {subtitle && (
            <Text size="xs" c="dimmed">
              {subtitle}
            </Text>
          )}
        </Box>
        {icon && (
          <ThemeIcon size={40} radius="xl" variant="light" color={color.bg}>
            {icon}
          </ThemeIcon>
        )}
      </Group>
    </Paper>
  );
}
