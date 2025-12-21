import { ReactNode } from 'react';
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
  color = 'sage',
}: FeatureCardProps) {
  const content = (
    <Paper
      p="xl"
      radius="xl"
      className="card-hover"
      style={{
        border: '1px solid var(--mantine-color-sage-2)',
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
      <Text fw={600} size="lg" c="sage.8" mb="xs">
        {title}
      </Text>
      <Text size="sm" c="neutral.6" lh={1.6}>
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
        backgroundColor: isActive ? 'var(--mantine-color-sage-0)' : 'transparent',
        border: isActive
          ? '1px solid var(--mantine-color-sage-2)'
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
            ? 'var(--mantine-color-sage-6)'
            : 'var(--mantine-color-cream-2)',
          color: isActive ? 'white' : 'var(--mantine-color-sage-6)',
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
        <Text fw={600} size="md" c={isActive ? 'sage.7' : 'sage.8'}>
          {title}
        </Text>
        <Text size="sm" c="neutral.5" lh={1.5}>
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
    default: { bg: 'sage', text: 'sage' },
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
        backgroundColor: `var(--mantine-color-${color.bg}-0)`,
        border: `1px solid var(--mantine-color-${color.bg}-2)`,
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box>
          <Text size="xs" c="neutral.5" tt="uppercase" fw={500}>
            {title}
          </Text>
          <Text fw={700} size="xl" c={`${color.text}.7`}>
            {value}
          </Text>
          {subtitle && (
            <Text size="xs" c="neutral.5">
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
