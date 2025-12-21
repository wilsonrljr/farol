import { Container, Space, Title, SimpleGrid, Group, Text, Divider } from '@mantine/core';
import { IconBuildingBank, IconChartLine, IconArrowsShuffle, IconReportAnalytics, IconSparkles, IconChecklist } from '@tabler/icons-react';
import Hero from '../components/Hero';
import { StatsGroup } from '../components/StatsGroup';
import { BadgeCard } from '../components/cards/BadgeCard';
import { FeaturesCard } from '../components/cards/FeaturesCard';
// Removed StatsRingCard (pie/ring) per user preference
// import { StatsRingCard } from '../components/cards/StatsRingCard';
import { SampleGrowthChart } from '../components/SampleGrowthChart';
import { QuickStartSteps } from '../components/QuickStartSteps';
import { ScenarioSummaryCard } from '../components/cards/ScenarioSummaryCard';
import { IconCash, IconBuildingFactory, IconTrendingUp } from '@tabler/icons-react';

export default function Home() {
  return (
    <Container size="xl">
      <Hero />
      <Space h="xl" />
      <Title order={2} mb="md" ta="center">Recursos Principais</Title>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="xl">
        <BadgeCard icon={<IconBuildingBank size={18} />} color="moss" title="Financiamentos" description="Sistemas SAC e PRICE com amortizações extras." badges={["SAC", "PRICE", "Amortizações"]} />
        <BadgeCard icon={<IconChartLine size={18} />} color="ember" title="Investimentos" description="Retornos variáveis, inflação e valorização." badges={["ROI", "Inflação", "Valorização"]} />
        <BadgeCard icon={<IconArrowsShuffle size={18} />} color="moss" title="Comparações" description="Três estratégias lado a lado para decisão." badges={["Comprar", "Alugar", "Investir"]} />
        <BadgeCard icon={<IconReportAnalytics size={18} />} color="sand" title="Métricas" description="Custo total, ROI, patrimônio e mais." badges={["Custo", "Equity", "Wealth"]} />
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md" mb="xl">
        <ScenarioSummaryCard
          title="Exemplo Custos"
          subtitle="Distribuição"
          color="moss"
          density="compact"
          metrics={[
            { key:'entrada', label:'Entrada', value:'R$ 100k', icon:<IconCash size={14} /> },
            { key:'juros', label:'Juros', value:'R$ 230k', icon:<IconTrendingUp size={14} />, accentColor:'red' },
            { key:'total', label:'Total', value:'R$ 830k', icon:<IconCash size={14} /> },
            { key:'prazo', label:'Prazo', value:'30 anos' }
          ]}
        />
        <ScenarioSummaryCard
          title="Exemplo Tempo"
          subtitle="Horizonte"
          color="ember"
          density="compact"
          metrics={[
            { key:'meses', label:'Meses', value:'360' },
            { key:'quit', label:'Quitação', value:'2035' },
            { key:'val', label:'Valorização', value:'+180%' },
            { key:'equity', label:'Equity', value:'R$ 580k' }
          ]}
        />
        <ScenarioSummaryCard
          title="Exemplo Patrimônio"
          subtitle="Crescimento"
          color="moss"
          density="compact"
          metrics={[
            { key:'eq', label:'Equity', value:'R$ 580k' },
            { key:'inv', label:'Invest.', value:'R$ 240k' },
            { key:'liq', label:'Líquido', value:'R$ 820k' },
            { key:'roi', label:'ROI', value:'58%' }
          ]}
        />
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mb="xl">
        <SampleGrowthChart />
        <QuickStartSteps />
      </SimpleGrid>
      <Divider my="xl" label="Como funciona" labelPosition="center" />
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mb="xl">
        <FeaturesCard title="Por que usar?" description="Entenda o impacto de cada decisão." features={["Visual Rápido", "Entrada Ideal", "Redução de Juros", "Planejamento de Aportes"]} />
        <FeaturesCard title="O que você obtém" features={["Tabela de Parcelas", "Gráficos de Fluxo", "Crescimento de Patrimônio", "Diferenças Mensais"]} />
      </SimpleGrid>
      <StatsGroup stats={[
        { label: 'Simulações', value: '⚡ Instantâneas' },
        { label: 'Sistemas', value: 'SAC / PRICE' },
        { label: 'Cenários', value: '3 Estratégias' },
        { label: 'Taxas', value: 'Variáveis' }
      ]} />
      <Space h={60} />
    </Container>
  );
}
