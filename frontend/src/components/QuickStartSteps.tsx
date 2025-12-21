import { Card, Group, Text, ThemeIcon, Stack, SimpleGrid } from '@mantine/core';
import { IconAdjustments, IconPlayerPlay, IconArrowsShuffle } from '@tabler/icons-react';

interface StepDef { icon: React.ReactNode; title: string; description: string; }

const steps: StepDef[] = [
  { icon: <IconAdjustments size={18} />, title: '1. Parametrize', description: 'Defina financiamento, entrada, aportes, valorização e retornos.' },
  { icon: <IconPlayerPlay size={18} />, title: '2. Simule', description: 'Rode cálculos mensais com juros compostos, amortizações e inflação.' },
  { icon: <IconArrowsShuffle size={18} />, title: '3. Compare', description: 'Veja patrimônio líquido, custo total e ROI lado a lado.' }
];

export function QuickStartSteps() {
  return (
    <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
      {steps.map(s => (
        <Card key={s.title} withBorder radius="md" padding="md" shadow="sm" style={{ position:'relative' }}>
          <Group align="flex-start" gap="sm" wrap="nowrap">
            <ThemeIcon size={34} radius="md" variant="light" color="moss">{s.icon}</ThemeIcon>
            <Stack gap={4} style={{ flex:1 }}>
              <Text fw={600} size="sm">{s.title}</Text>
              <Text size="xs" c="dimmed" style={{ lineHeight:1.3 }}>{s.description}</Text>
            </Stack>
          </Group>
        </Card>
      ))}
    </SimpleGrid>
  );
}
