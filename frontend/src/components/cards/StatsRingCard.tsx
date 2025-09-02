import { Card, Group, Text, RingProgress, Stack } from '@mantine/core';

interface StatsRingCardProps {
  title: string;
  sections: { value: number; color: string; tooltip?: string }[];
  labels?: { label: string; value: string }[];
}

export function StatsRingCard({ title, sections, labels }: StatsRingCardProps) {
  return (
    <Card withBorder radius="md" padding="md" shadow="sm" style={{ height: '100%' }}>
      <Group align="flex-start" justify="space-between" wrap="nowrap">
        <RingProgress size={110} thickness={14} sections={sections} />
        <Stack gap={4} style={{ flex: 1 }}>
          <Text fw={600} size="sm">{title}</Text>
          <Stack gap={2}>
            {labels?.map((l) => (
              <Group key={l.label} gap={6} wrap="nowrap">
                <Text size="10px" c="dimmed" fw={500} tt="uppercase" style={{ flex: '0 0 70px' }}>{l.label}</Text>
                <Text fw={600} size="xs">{l.value}</Text>
              </Group>
            ))}
          </Stack>
        </Stack>
      </Group>
    </Card>
  );
}
