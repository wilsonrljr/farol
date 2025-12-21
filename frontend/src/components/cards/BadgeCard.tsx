import { Card, Image, Text, Badge, Group, Stack, ThemeIcon, useMantineColorScheme } from '@mantine/core';
import { ReactNode } from 'react';

interface BadgeCardProps {
  title: string;
  description: string;
  badges: string[];
  image?: string;
  footer?: ReactNode;
  icon?: ReactNode;
  color?: string; // mantine color name
}

export function BadgeCard({ title, description, badges, image, footer, icon, color = 'moss' }: BadgeCardProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  return (
    <Card
      withBorder
      radius="md"
      padding="md"
      shadow="sm"
      style={{ position: 'relative', height: '100%', overflow: 'hidden', borderTop: `3px solid var(--mantine-color-${color}-6)` }}
    >
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
