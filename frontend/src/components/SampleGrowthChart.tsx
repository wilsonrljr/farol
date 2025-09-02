import { Card, Text } from '@mantine/core';
import { AreaChart } from '@mantine/charts';

const sampleData = Array.from({ length: 13 }).map((_, i) => ({ mes: i * 12, Comprar: 100000 + i*40000 + (i*i*8000), AlugarInvestir: 100000 + i*50000 + (i*i*6000) }));

export function SampleGrowthChart() {
  return (
    <Card withBorder radius="md" padding="md" shadow="sm">
      <Text fw={600} size="sm" mb={4}>Evolução Patrimonial Estimada</Text>
      <Text size="xs" c="dimmed" mb="sm">Exemplo ilustrativo de crescimento de patrimônio em diferentes estratégias ao longo do tempo.</Text>
      <AreaChart
        h={220}
        data={sampleData}
        dataKey="mes"
        series={[{ name: 'Comprar', color: 'indigo.6' }, { name: 'AlugarInvestir', color: 'teal.6' }]}
        curveType="monotone"
      />
    </Card>
  );
}
