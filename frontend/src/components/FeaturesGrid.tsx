import { SimpleGrid, Paper, Text, ThemeIcon, Title } from '@mantine/core';
import { IconChartLine, IconBuildingBank, IconArrowsShuffle, IconAdjustmentsDollar, IconTrendingUp, IconReportAnalytics } from '@tabler/icons-react';

const data = [
  { icon: IconBuildingBank, title: 'SAC e PRICE', desc: 'Simulação detalhada dos principais sistemas de amortização.' },
  { icon: IconAdjustmentsDollar, title: 'Amortizações Extras', desc: 'Inclua aportes para reduzir saldo devedor.' },
  { icon: IconChartLine, title: 'Investimentos', desc: 'Retornos variáveis ao longo do tempo com capitalização composta.' },
  { icon: IconArrowsShuffle, title: 'Comparação Completa', desc: 'Comprar, alugar e investir ou investir para comprar à vista.' },
  { icon: IconTrendingUp, title: 'Inflação e Valorização', desc: 'Considere inflação, aluguel e valorização do imóvel.' },
  { icon: IconReportAnalytics, title: 'Métricas Avançadas', desc: 'ROI, custo médio mensal, riqueza acumulada e mais.' }
];

export default function FeaturesGrid() {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
      {data.map((f) => (
        <Paper key={f.title} p="md" withBorder radius="md">
          <ThemeIcon size="lg" radius="md" variant="light">
            <f.icon size={22} />
          </ThemeIcon>
          <Title order={4} mt="sm">{f.title}</Title>
            <Text size="sm" c="dimmed">{f.desc}</Text>
        </Paper>
      ))}
    </SimpleGrid>
  );
}
