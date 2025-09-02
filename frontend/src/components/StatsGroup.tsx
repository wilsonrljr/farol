import { Group, Paper, Text } from '@mantine/core';

interface StatProps { label: string; value: string; }

export function StatsGroup({ stats }: { stats: StatProps[] }) {
  return (
    <Group wrap="wrap" gap="md">
      {stats.map((s) => (
        <Paper key={s.label} withBorder p="md" radius="md" style={{ minWidth: 180 }}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>{s.label}</Text>
          <Text fw={700} fz="lg">{s.value}</Text>
        </Paper>
      ))}
    </Group>
  );
}
