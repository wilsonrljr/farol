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
      className="card-hover"
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: 'var(--glass-shadow), var(--glass-shadow-glow)',
        borderRadius: rem(20),
        padding: rem(24),
        cursor: link ? 'pointer' : 'default',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 250ms cubic-bezier(0.2, 0, 0, 1)',
      }}
    >
      {/* Accent glow on hover */}
      <Box
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: rem(80),
          background: `linear-gradient(180deg, var(--mantine-color-${color}-5) 0%, transparent 100%)`,
          opacity: 0,
          transition: 'opacity 300ms ease',
          pointerEvents: 'none',
        }}
        className="feature-card-accent"
      />
      
      <ThemeIcon 
        size={56} 
        radius="xl" 
        variant="light" 
        color={color} 
        mb="lg"
        style={{
          background: `light-dark(
            linear-gradient(135deg, var(--mantine-color-${color}-1) 0%, var(--mantine-color-${color}-0) 100%),
            linear-gradient(135deg, var(--mantine-color-${color}-8) 0%, var(--mantine-color-${color}-9) 100%)
          )`,
          boxShadow: `0 4px 12px -4px var(--mantine-color-${color}-4)`,
        }}
      >
        {icon}
      </ThemeIcon>
      <Text 
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
          <Text size="sm" fw={600} c={`${color}.5`}>
            Começar
          </Text>
          <IconChevronRight size={16} color={`var(--mantine-color-${color}-5)`} />
        </Group>
      )}
    </Box>
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
        borderRadius: rem(16),
        background: isActive ? 'var(--glass-bg)' : 'transparent',
        backdropFilter: isActive ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: isActive ? 'blur(12px)' : 'none',
        boxShadow: isActive ? 'var(--glass-shadow)' : 'none',
        transition: 'all 250ms cubic-bezier(0.2, 0, 0, 1)',
      }}
    >
      <Box
        style={{
          width: rem(40),
          height: rem(40),
          borderRadius: rem(12),
          background: isActive
            ? 'linear-gradient(135deg, var(--mantine-color-ocean-5) 0%, var(--mantine-color-ocean-6) 100%)'
            : 'light-dark(rgba(0, 0, 0, 0.04), rgba(255, 255, 255, 0.06))',
          color: isActive ? 'white' : 'var(--mantine-color-ocean-5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: rem(15),
          flexShrink: 0,
          boxShadow: isActive ? '0 4px 12px -2px var(--mantine-color-ocean-5)' : 'none',
        }}
      >
        {step}
      </Box>
      <Box>
        <Text fw={600} size="md" c={isActive ? 'ocean.6' : 'bright'}>
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
        background: `light-dark(
          linear-gradient(145deg, var(--mantine-color-${color.bg}-0) 0%, rgba(255, 255, 255, 0.85) 100%),
          linear-gradient(145deg, var(--mantine-color-${color.bg}-9) 0%, rgba(30, 41, 59, 0.9) 100%)
        )`,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: 'var(--glass-shadow), var(--glass-shadow-glow)',
        borderRadius: rem(16),
        padding: rem(16),
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.5px' }}>
            {title}
          </Text>
          <Text fw={700} size="xl" c={`${color.text}.6`} mt={4}>
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
            style={{
              background: `light-dark(
                linear-gradient(135deg, var(--mantine-color-${color.bg}-1) 0%, var(--mantine-color-${color.bg}-0) 100%),
                linear-gradient(135deg, var(--mantine-color-${color.bg}-8) 0%, var(--mantine-color-${color.bg}-9) 100%)
              )`,
            }}
          >
            {icon}
          </ThemeIcon>
        )}
      </Group>
    </Box>
  );
}
