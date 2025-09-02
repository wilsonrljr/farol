import { Card, Image, Text, Badge, Group, Stack, useMantineTheme, ThemeIcon } from '@mantine/core';
import { ReactNode } from 'react';

interface BadgeCardProps {
  title: string;
  description: string;
  badges: string[];
  image?: string;
  footer?: ReactNode;
  icon?: ReactNode;
  color?: string; // mantine color or gradient start
}

export function BadgeCard({ title, description, badges, image, footer, icon, color = 'indigo' }: BadgeCardProps) {
  const theme = useMantineTheme();
  // Mantine v7 exposes resolved color scheme via data attributes; fallback to light
  const isDark = document?.documentElement?.getAttribute('data-mantine-color-scheme') === 'dark';
  return (
    <Card
      withBorder
      radius="md"
      padding="md"
      shadow="sm"
      style={{ position: 'relative', height: '100%', overflow: 'hidden' }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(135deg, ${theme.colors[color]?.[6] || theme.colors.indigo[6]}11 0%, transparent 60%)`,
          pointerEvents: 'none'
        }}
      />
      {image && <Image src={image} h={120} radius="sm" alt={title} fit="cover" mb="sm" />}
      <Stack gap={4} mb="xs">
        <Group gap={6}>
          {icon && <ThemeIcon variant="light" size={30} radius="md" color={color}>{icon}</ThemeIcon>}
          <Text fw={600}>{title}</Text>
        </Group>
  <Text size="xs" c="dimmed" style={{whiteSpace:'normal'}}>{description}</Text>
      </Stack>
      <Group gap={4} mb={footer ? 'sm' : 0} wrap="wrap">
        {badges.map((b) => (
          <Badge
            key={b}
            variant={isDark ? 'light' : 'outline'}
            size="sm"
            color={color}
            styles={{ label: { fontWeight: 500 } }}
          >
            {b}
          </Badge>
        ))}
      </Group>
      {footer}
    </Card>
  );
}
