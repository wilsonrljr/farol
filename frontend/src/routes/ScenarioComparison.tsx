import { Box, Container, Group, Stack, Text, Title } from '@mantine/core';
import {
  IconBuildingBank,
  IconChartLine,
  IconPigMoney,
  IconScale,
} from '@tabler/icons-react';
import ComparisonJourney from '../components/comparison/ComparisonJourney';

const strategies = [
  { label: 'Comprar', icon: IconBuildingBank },
  { label: 'Alugar e investir', icon: IconChartLine },
  { label: 'Investir para comprar', icon: IconPigMoney },
];

export default function ScenarioComparison() {
  return (
    <Box>
      <Box component="header" className="page-hero">
        <Container size="lg" className="page-hero__content">
          <Stack gap="sm">
            <Group gap="xs" wrap="nowrap" className="comparison-eyebrow">
              <IconScale
                size={20}
                color="var(--mantine-color-ocean-6)"
                aria-hidden="true"
              />
              <Text className="eyebrow">Simulação imobiliária</Text>
            </Group>
            <Title order={1} className="page-hero__title">
              Comprar ou alugar: compare com as mesmas premissas
            </Title>
            <Text className="page-hero__description">
              Projete custos, patrimônio e viabilidade de três estratégias. Comece pelos dados
              essenciais e refine a análise somente quando precisar.
            </Text>
            <Text size="sm" c="dimmed" className="comparison-strategies">
              {strategies.map((strategy) => strategy.label).join(' · ')}
            </Text>
          </Stack>
        </Container>
      </Box>

      <Container size="lg" className="comparison-workspace">
        <ComparisonJourney />
      </Container>
    </Box>
  );
}
