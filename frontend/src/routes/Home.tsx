import { Box, Button, Container, Group, Paper, Stack, Text, Title } from '@mantine/core';
import {
  IconAdjustments,
  IconArrowRight,
  IconBook2,
  IconBuildingBank,
  IconChartLine,
  IconCheck,
  IconFileDescription,
  IconPigMoney,
  IconScale,
  IconShieldCheck,
  IconTimeline,
} from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import FeaturesGrid from '../components/FeaturesGrid';

const strategies = [
  {
    icon: IconBuildingBank,
    title: 'Comprar à vista ou financiado',
    description: 'Entrada em dinheiro, custos de compra e, quando houver, parcelas e amortizações.',
  },
  {
    icon: IconChartLine,
    title: 'Alugar e investir',
    description: 'Aluguel, capital preservado, aportes, retiradas e retorno do investimento.',
  },
  {
    icon: IconPigMoney,
    title: 'Investir para comprar',
    description: 'Acumulação de recursos até alcançar o custo da compra à vista.',
  },
];

const proofPoints = [
  {
    icon: IconAdjustments,
    title: 'Premissas comparáveis',
    description: 'As estratégias partem do mesmo contexto financeiro sempre que possível.',
  },
  {
    icon: IconTimeline,
    title: 'Evolução mês a mês',
    description: 'Custos, patrimônio, investimentos e dívidas permanecem rastreáveis.',
  },
  {
    icon: IconShieldCheck,
    title: 'Viabilidade explícita',
    description: 'Déficits e limitações aparecem antes de qualquer interpretação de vencedor.',
  },
];

const comparisonCoverage = [
  'Entrada, ITBI, escritura, condomínio e IPTU',
  'Juros SAC ou PRICE e amortizações extras',
  'Aluguel, inflação, valorização e retorno dos investimentos',
  'Poupança e renda para verificar se cada cenário cabe no orçamento',
];

const processSteps = [
  {
    title: 'Informe o que você sabe',
    description:
      'Comece pelos dados essenciais. Campos avançados ficam disponíveis quando você precisar refinar a análise.',
  },
  {
    title: 'Compare cenários equivalentes',
    description:
      'O Farol projeta cada estratégia no mesmo horizonte e sinaliza quando as premissas não permitem um ranking justo.',
  },
  {
    title: 'Questione o resultado',
    description:
      'Leia os alertas, altere taxas e custos e observe quais premissas realmente mudam sua decisão.',
  },
];

export default function Home() {
  return (
    <Box>
      <Box component="section" className="home-hero">
        <Container size="xl">
          <Box className="home-hero__grid">
            <Stack gap="lg">
              <Text component="p" className="eyebrow">
                Simulador financeiro educativo
              </Text>
              <Title order={1} className="home-hero__title">
                Compare caminhos financeiros antes de comprometer seu orçamento.
              </Title>
              <Text className="home-hero__lead">
                O Farol organiza custos, patrimônio e viabilidade para você analisar compra de
                imóvel, aluguel e investimento com premissas claras — sem transformar projeções em
                promessas.
              </Text>
              <Group className="home-hero__actions" gap="sm">
                <Button
                  component={Link}
                  to="/comparacao"
                  size="lg"
                  rightSection={<IconArrowRight size={18} />}
                >
                  Comparar compra e aluguel
                </Button>
                <Button
                  component={Link}
                  to="/docs/quickstart"
                  size="lg"
                  variant="default"
                  leftSection={<IconBook2 size={18} />}
                >
                  Entender como funciona
                </Button>
              </Group>
              <Text className="home-hero__note">
                Sem cadastro para começar • os resultados dependem dos dados que você informar
              </Text>
            </Stack>

            <Paper className="surface-card strategy-panel" aria-label="Estratégias comparadas">
              <Box className="strategy-panel__header">
                <Text className="eyebrow" mb={6}>
                  Uma decisão, três caminhos
                </Text>
                <Title order={2} size="h3">
                  O que entra na comparação
                </Title>
              </Box>

              {strategies.map((strategy, index) => (
                <Box className="strategy-row" key={strategy.title}>
                  <span className="strategy-row__number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <Box>
                    <Group gap="xs" mb={4} wrap="nowrap">
                      <strategy.icon size={18} aria-hidden="true" />
                      <Text fw={650}>{strategy.title}</Text>
                    </Group>
                    <Text size="sm" c="dimmed" lh={1.55}>
                      {strategy.description}
                    </Text>
                  </Box>
                </Box>
              ))}

              <Text size="xs" c="dimmed" lh={1.5} mt="md">
                O ranking só é apresentado quando os cenários têm recursos comparáveis e ao menos
                uma estratégia é viável.
              </Text>
            </Paper>
          </Box>
        </Container>
      </Box>

      <Box component="section" className="home-proof-bar" aria-label="Como o Farol apresenta a análise">
        <Container size="xl">
          <Box className="home-proof-grid">
            {proofPoints.map((point) => (
              <Box className="home-proof-item" key={point.title}>
                <Box className="icon-tile" aria-hidden="true">
                  <point.icon size={20} stroke={1.8} />
                </Box>
                <Box>
                  <Text fw={650} size="sm">
                    {point.title}
                  </Text>
                  <Text size="xs" c="dimmed" lh={1.5} mt={3}>
                    {point.description}
                  </Text>
                </Box>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      <Container component="section" size="xl" className="home-section">
        <Stack gap="xl">
          <Box className="section-heading">
            <Text className="eyebrow" mb="xs">
              Decisão principal
            </Text>
            <Title order={2} className="section-title" mb="sm">
              Veja a decisão completa — não apenas o valor da parcela
            </Title>
            <Text className="section-description">
              Uma comparação útil precisa considerar o capital inicial, o orçamento mensal e o que
              acontece com o patrimônio ao longo do tempo.
            </Text>
          </Box>

          <Paper className="surface-card transparency-panel">
            <Stack gap="md">
              <Box className="icon-tile" aria-hidden="true">
                <IconScale size={22} stroke={1.8} />
              </Box>
              <Title order={3}>Comprar vs Alugar</Title>
              <Text c="dimmed" lh={1.65}>
                Monte uma análise exploratória rapidamente ou informe poupança e renda para validar
                a viabilidade e habilitar uma comparação autoritativa.
              </Text>
              <Button
                component={Link}
                to="/comparacao"
                variant="light"
                rightSection={<IconArrowRight size={17} />}
                style={{ alignSelf: 'flex-start' }}
              >
                Abrir comparação
              </Button>
            </Stack>

            <Stack gap="sm" aria-label="Itens considerados na comparação">
              {comparisonCoverage.map((item) => (
                <Group key={item} gap="sm" align="flex-start" wrap="nowrap">
                  <Box className="icon-tile" style={{ width: 32, height: 32 }} aria-hidden="true">
                    <IconCheck size={17} stroke={2} />
                  </Box>
                  <Text size="sm" lh={1.55} pt={4}>
                    {item}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Paper>
        </Stack>
      </Container>

      <Box component="section" className="home-section home-section--muted">
        <Container size="xl">
          <Box className="section-heading" mb="xl">
            <Text className="eyebrow" mb="xs">
              Ferramentas e referências
            </Text>
            <Title order={2} className="section-title" mb="sm">
              Aprofunde a análise sem perder o contexto
            </Title>
            <Text className="section-description">
              Use calculadoras específicas para outras decisões e consulte a metodologia sempre que
              um resultado precisar de explicação.
            </Text>
          </Box>
          <FeaturesGrid />
        </Container>
      </Box>

      <Container component="section" size="xl" className="home-section">
        <Box className="section-heading" mb="xl">
          <Text className="eyebrow" mb="xs">
            Fluxo de uso
          </Text>
          <Title order={2} className="section-title" mb="sm">
            Da premissa ao resultado em três etapas
          </Title>
          <Text className="section-description">
            Comece simples, refine apenas o necessário e trate o resultado como apoio para pensar.
          </Text>
        </Box>

        <Box className="process-grid">
          {processSteps.map((step, index) => (
            <Paper key={step.title} className="surface-card process-step">
              <Text className="process-step__number" mb="md">
                Etapa {index + 1}
              </Text>
              <Title order={3} size="h4" mb="sm">
                {step.title}
              </Title>
              <Text size="sm" c="dimmed" lh={1.65}>
                {step.description}
              </Text>
            </Paper>
          ))}
        </Box>
      </Container>

      <Box component="section" className="home-section home-section--muted">
        <Container size="xl">
          <Paper className="surface-card transparency-panel">
            <Stack gap="md">
              <Box className="icon-tile" aria-hidden="true">
                <IconFileDescription size={22} stroke={1.8} />
              </Box>
              <Text className="eyebrow">Transparência antes da conclusão</Text>
              <Title order={2} className="section-title">
                Projeção não é previsão
              </Title>
              <Text c="dimmed" lh={1.7}>
                Taxas, renda, inflação e valorização podem mudar. O papel do simulador é tornar o
                raciocínio auditável e ajudar você a testar cenários — não decidir por você.
              </Text>
              <Group gap="sm">
                <Button component={Link} to="/docs/calculos" variant="default">
                  Ver metodologia
                </Button>
                <Button component={Link} to="/sobre" variant="subtle">
                  Limites e propósito
                </Button>
              </Group>
            </Stack>

            <Box className="transparency-list">
              {[
                'Premissas incompletas geram uma análise exploratória, sem vencedor declarado.',
                'Déficits de caixa e recursos não financiados reduzem o patrimônio e ficam visíveis.',
                'Cálculos, termos e simplificações do modelo estão documentados para consulta.',
              ].map((item) => (
                <Box className="transparency-list__item" key={item}>
                  <Box className="icon-tile" style={{ width: 32, height: 32 }} aria-hidden="true">
                    <IconCheck size={17} />
                  </Box>
                  <Text size="sm" lh={1.65} pt={3}>
                    {item}
                  </Text>
                </Box>
              ))}
            </Box>
          </Paper>
        </Container>
      </Box>

      <Container component="section" size="lg" className="home-section">
        <Box className="home-cta">
          <Box>
            <Text className="eyebrow" mb="xs">
              Comece com sua realidade
            </Text>
            <Title order={2} className="section-title" mb={6}>
              Compare, ajuste e volte às premissas
            </Title>
            <Text c="dimmed" lh={1.6}>
              Você pode iniciar com os campos essenciais e aprofundar a simulação depois.
            </Text>
          </Box>
          <Button
            component={Link}
            to="/comparacao"
            size="lg"
            rightSection={<IconArrowRight size={18} />}
          >
            Iniciar comparação
          </Button>
        </Box>
      </Container>
    </Box>
  );
}
