import { Card, Text, List, ThemeIcon, Stack } from '@mantine/core';
import { IconCircleCheck } from '@tabler/icons-react';

interface FeaturesCardProps { title: string; features: string[]; description?: string; }

export function FeaturesCard({ title, features, description }: FeaturesCardProps) {
  return (
    <Card withBorder radius="md" padding="md" shadow="sm">
      <Stack gap={6}>
        <Text fw={600}>{title}</Text>
        {description && <Text size="xs" c="dimmed">{description}</Text>}
        <List spacing={4} size="xs" icon={<ThemeIcon color="teal" size={18} radius="xl"><IconCircleCheck size={12} /></ThemeIcon>}>
          {features.map((f) => <List.Item key={f}>{f}</List.Item>)}
        </List>
      </Stack>
    </Card>
  );
}
