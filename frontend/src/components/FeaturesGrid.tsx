import { Box, Text, Title } from '@mantine/core';
import {
  IconArrowRight,
  IconBook2,
  IconCar,
  IconFlame,
  IconPigMoney,
  IconShieldCheck,
  IconVocabulary,
} from '@tabler/icons-react';
import { Link } from 'react-router-dom';

const features = [
  {
    icon: IconShieldCheck,
    title: 'Teste de estresse',
    description: 'Veja como mudanças de renda, juros e custos afetam sua margem financeira.',
    link: '/estresse',
    action: 'Avaliar resiliência',
  },
  {
    icon: IconPigMoney,
    title: 'Reserva de emergência',
    description: 'Dimensione uma reserva coerente com despesas, estabilidade e dependentes.',
    link: '/reserva',
    action: 'Calcular reserva',
  },
  {
    icon: IconFlame,
    title: 'Planejamento FIRE',
    description: 'Projete sua meta de independência financeira em valores de hoje.',
    link: '/fire',
    action: 'Projetar independência',
  },
  {
    icon: IconCar,
    title: 'Comprar vs Assinar',
    description: 'Compare o custo de possuir um veículo com o de uma assinatura.',
    link: '/veiculos',
    action: 'Comparar veículos',
  },
  {
    icon: IconBook2,
    title: 'Metodologia',
    description: 'Entenda taxas, fluxos de caixa, patrimônio e regras de comparabilidade.',
    link: '/docs/calculos',
    action: 'Ver os cálculos',
  },
  {
    icon: IconVocabulary,
    title: 'Glossário',
    description: 'Consulte os termos financeiros usados nas entradas e nos resultados.',
    link: '/docs/glossario',
    action: 'Consultar termos',
  },
];

export default function FeaturesGrid() {
  return (
    <Box className="feature-grid">
      {features.map((feature) => (
        <Box component={Link} to={feature.link} key={feature.title} className="feature-card">
          <Box className="icon-tile" aria-hidden="true">
            <feature.icon size={22} stroke={1.8} />
          </Box>
          <Box>
            <Title order={3} size="h4" mb={6}>
              {feature.title}
            </Title>
            <Text size="sm" c="dimmed" lh={1.6}>
              {feature.description}
            </Text>
          </Box>
          <span className="feature-card__link">
            {feature.action}
            <IconArrowRight size={16} aria-hidden="true" />
          </span>
        </Box>
      ))}
    </Box>
  );
}
