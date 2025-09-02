import { Card, Group, Stack, Text, Badge, ThemeIcon, Grid, Tooltip, ActionIcon } from '@mantine/core';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { ReactNode } from 'react';

export interface ScenarioMetric {
  key: string;
  label: string;
  value: string;
  icon?: ReactNode;
  help?: string;
  accentColor?: string;
}

interface ScenarioSummaryCardProps {
  title: string;
  subtitle?: string;
  highlight?: boolean;
  badges?: string[];
  metrics: ScenarioMetric[]; // summary metrics when expandable
  allMetrics?: ScenarioMetric[]; // full metrics set when expanded
  footer?: ReactNode;
  color?: string; // mantine color
  density?: 'compact' | 'comfortable';
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}

export function ScenarioSummaryCard({
  title,
  subtitle,
  highlight,
  badges = [],
  metrics,
  allMetrics,
  footer,
  color = 'indigo',
  density = 'comfortable',
  expandable = false,
  expanded = false,
  onToggle
}: ScenarioSummaryCardProps) {
  const showMetrics = expandable && !expanded ? metrics : (allMetrics || metrics);
  // Always use 2 columns in comfortable mode per user request (avoid switching to 3 when expanded)
  const cols = 2;
  return (
    <Card
      radius="md"
      withBorder={false}
      padding={density === 'compact' ? 'sm' : 'md'}
      shadow={highlight ? 'lg' : 'sm'}
      style={{
        position: 'relative',
        background: highlight
          ? `linear-gradient(145deg,var(--mantine-color-${color}-0),var(--mantine-color-${color}-1))`
          : 'var(--mantine-color-body)',
        border: highlight ? `1px solid var(--mantine-color-${color}-4)` : '1px solid var(--mantine-color-dark-3)',
        minHeight: density === 'compact' ? (expanded ? 220 : 170) : (expanded ? 260 : 185),
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit', boxShadow: highlight ? `0 0 0 1px var(--mantine-color-${color}-4), 0 6px 22px -6px rgba(0,0,0,0.25)` : undefined }} />
      <Stack gap={6} mb={4} style={{ flex: '0 0 auto' }}>
        <Group gap={8} align="center" justify="space-between" wrap="nowrap">
          <Group gap={8} align="center">
            <Text fw={700} size="sm" c={highlight ? color : undefined}>{title}</Text>
            {highlight && <Badge size="xs" color={color} variant="filled">Melhor</Badge>}
            {badges.length > 0 && badges.filter(b=>b!=='Melhor').length>0 && (
              <Group gap={4} wrap="wrap">
                {badges.filter(b=>b!=='Melhor').map(b => <Badge key={b} size="xs" variant={highlight ? 'light' : 'outline'} color={color}>{b}</Badge>)}
              </Group>
            )}
          </Group>
          {expandable && (
            <ActionIcon size="sm" variant="subtle" aria-label={expanded? 'Recolher' : 'Expandir'} onClick={onToggle} style={{ flexShrink:0 }}>
              {expanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            </ActionIcon>
          )}
        </Group>
        {subtitle && <Text size="10px" c="dimmed" fw={500} style={{ letterSpacing: 0.5 }}>{subtitle}</Text>}
      </Stack>
      <Grid gutter={density === 'compact' ? 6 : 10} columns={cols * 2} style={{ flex: '1 1 auto', transition: 'max-height .25s ease' }}>
        {showMetrics.map(m => (
          <Grid.Col key={m.key} span={2} style={{ minWidth: 0 }}>
            <Stack gap={2} style={{ position: 'relative' }}>
              <Group gap={4} wrap="nowrap">
                {m.icon && <ThemeIcon size={22} variant={highlight ? 'filled' : 'light'} radius="sm" color={m.accentColor || color}>{m.icon}</ThemeIcon>}
                <Text size="10px" c="dimmed" tt="uppercase" fw={500} style={{ lineHeight: 1.1 }}>{m.label}</Text>
              </Group>
              <Tooltip label={m.value} disabled={m.value.length < 14} openDelay={400} withArrow>
                <Text fw={600} size={density === 'compact' ? 'xs' : 'sm'} style={{ lineHeight: 1.15, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '100%' }}>{m.value}</Text>
              </Tooltip>
            </Stack>
          </Grid.Col>
        ))}
      </Grid>
      {footer && <div style={{ marginTop: 8 }}>{footer}</div>}
    </Card>
  );
}
