import { Card, Group, Text, ThemeIcon, Stack, Progress, Badge } from '@mantine/core';
import { ReactNode } from 'react';

interface StatItem { label: string; value: string; icon?: ReactNode; tooltip?: string; accent?: string; }
interface CardWithStatsProps {
  title: string;
  subtitle?: string;
  stats: StatItem[];
  progress?: { value: number; label?: string; color?: string };
  accentColor?: string; // mantine color name
  highlight?: boolean;
  badge?: string;
  description?: string; // small muted line at bottom
}

export function CardWithStats({ title, subtitle, stats, progress, accentColor = 'indigo', highlight, badge, description }: CardWithStatsProps) {
  const borderStyle = highlight ? `1px solid var(--mantine-color-${accentColor}-5)` : '1px solid var(--mantine-color-dark-3)';
  return (
    <Card
      withBorder
      radius="md"
      padding="md"
      shadow={highlight ? 'md' : 'sm'}
      style={{
        height: '100%',
        position: 'relative',
        border: borderStyle,
        background: highlight
          ? `linear-gradient(135deg,var(--mantine-color-${accentColor}-0), var(--mantine-color-${accentColor}-1))`
          : 'var(--mantine-color-body)',
        boxShadow: highlight ? '0 4px 18px -4px rgba(0,0,0,0.25)' : undefined,
        overflow: 'hidden'
      }}
    >
      {highlight && badge && (
        <Badge color={accentColor} variant="filled" size="xs" style={{ position: 'absolute', top: 8, right: 8 }} leftSection={undefined}> {badge} </Badge>
      )}
      <Stack gap={4} mb="xs">
        <Text fw={700} size="sm" c={highlight ? accentColor : undefined}>{title}</Text>
        {subtitle && <Text size="xs" c="dimmed">{subtitle}</Text>}
      </Stack>
      <Group wrap="wrap" gap="md" align="flex-start" mb={progress || description ? 'sm' : 0} style={{ rowGap: '0.75rem' }}>
        {stats.map((s) => (
          <Stack key={s.label} gap={2} style={{ minWidth: 92 }}>
            <Group gap={4}>
              {s.icon && <ThemeIcon variant={highlight ? 'filled' : 'light'} size={24} radius="sm" color={s.accent || accentColor}>{s.icon}</ThemeIcon>}
              <Text size="10px" c="dimmed" tt="uppercase" fw={500}>{s.label}</Text>
            </Group>
            <Text fw={700} fz={s.label.toLowerCase().includes('patrimônio') || s.label.toLowerCase().includes('principal') ? 'sm' : 'sm'} style={{ letterSpacing: '-0.25px' }}>{s.value}</Text>
          </Stack>
        ))}
      </Group>
      {progress && (
        <Stack gap={4} mb={description ? 'xs' : 0}>
          {progress.label && <Text size="10px" c="dimmed" tt="uppercase" fw={500}>{progress.label}</Text>}
          <Progress value={progress.value} color={progress.color || accentColor} size="sm" radius="xl" />
        </Stack>
      )}
      {description && <Text size="10px" c="dimmed">{description}</Text>}
    </Card>
  );
}
