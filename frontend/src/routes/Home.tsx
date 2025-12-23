import {
  Container,
  Box,
  Title,
  Text,
  SimpleGrid,
  Group,
  Button,
  rem,
  Paper,
  ThemeIcon,
  Timeline,
  RingProgress,
  Badge,
  Center,
} from '@mantine/core';
import { Link } from 'react-router-dom';
import {
  IconBuildingBank,
  IconChartLine,
  IconScale,
  IconArrowRight,
  IconHome,
  IconCoin,
  IconPigMoney,
  IconShieldCheck,
  IconCheck,
  IconSparkles,
  IconClipboardList,
  IconSettings,
  IconChartBar,
  IconLeaf,
  IconTrendingUp,
  IconPercentage,
  IconTarget,
} from '@tabler/icons-react';
import { FeatureCard } from '../components/ui';

export default function Home() {
  return (
    <Box>
      {/* Hero Section */}
      <Box
        py={{ base: 80, md: 120 }}
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'light-dark(linear-gradient(180deg, var(--mantine-color-cream-0) 0%, var(--mantine-color-sage-0) 100%), linear-gradient(180deg, var(--mantine-color-dark-8) 0%, var(--mantine-color-dark-9) 100%))',
        }}
      >
        {/* Decorative elements */}
        <Box
          style={{
            position: 'absolute',
            top: '20%',
            right: '-5%',
            width: rem(400),
            height: rem(400),
            borderRadius: '50%',
            background: 'light-dark(radial-gradient(circle, var(--mantine-color-sage-1) 0%, transparent 70%), radial-gradient(circle, color-mix(in srgb, var(--mantine-color-sage-7) 35%, transparent) 0%, transparent 70%))',
            opacity: 0.6,
            pointerEvents: 'none',
          }}
        />
        <Box
          style={{
            position: 'absolute',
            bottom: '10%',
            left: '-10%',
            width: rem(300),
            height: rem(300),
            borderRadius: '50%',
            background: 'light-dark(radial-gradient(circle, var(--mantine-color-cream-2) 0%, transparent 70%), radial-gradient(circle, color-mix(in srgb, var(--mantine-color-dark-6) 45%, transparent) 0%, transparent 70%))',
            opacity: 0.5,
            pointerEvents: 'none',
          }}
        />
        
        <Container size="lg" style={{ position: 'relative', zIndex: 1 }}>
          <Box maw={720} mx="auto" ta="center">
            <Badge 
              size="lg" 
              radius="xl" 
              variant="light" 
              color="sage"
              mb="lg"
              leftSection={<IconLeaf size={14} />}
            >
              Simulador Financeiro Imobiliário
            </Badge>
            <Title
              order={1}
              fw={700}
              mb="lg"
              style={{
                fontSize: 'clamp(2.25rem, 5vw, 3.5rem)',
                lineHeight: 1.15,
              }}
            >
              Tome a melhor decisão para{' '}
              <Text
                component="span"
                inherit
                style={{ color: 'light-dark(var(--mantine-color-sage-7), var(--mantine-color-sage-3))' }}
              >
                adquirir seu imóvel
              </Text>
            </Title>
            <Text size="lg" c="dimmed" maw={580} mx="auto" mb="xl" lh={1.7}>
              Compare financiamento, aluguel + investimento ou investir para comprar à vista.
              Simule diferentes cenários e descubra qual estratégia faz mais sentido para você.
            </Text>
            <Group justify="center" gap="md">
              <Button
                component={Link}
                to="/comparacao"
                size="lg"
                radius="xl"
                rightSection={<IconArrowRight size={18} />}
                color="sage"
                styles={{
                  root: {
                    boxShadow: '0 4px 14px rgba(114, 125, 115, 0.25)',
                  },
                }}
              >
                Comparar Cenários
              </Button>
              <Button
                component={Link}
                to="/docs/quickstart"
                size="lg"
                radius="xl"
                variant="outline"
                color="sage"
              >
                Como funciona
              </Button>
            </Group>
          </Box>
        </Container>
      </Box>

      {/* Stats Section - Quick Visual Overview */}
      <Container size="lg" mt={-40} style={{ position: 'relative', zIndex: 2 }}>
        <Paper
          p={{ base: 'lg', md: 'xl' }}
          radius="xl"
          shadow="lg"
          style={{
            border: '1px solid var(--mantine-color-default-border)',
            backgroundColor: 'var(--mantine-color-body)',
          }}
        >
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xl">
            <Group gap="lg" wrap="nowrap">
              <RingProgress
                size={70}
                thickness={6}
                roundCaps
                sections={[{ value: 100, color: 'sage.6' }]}
                label={
                  <Center>
                    <IconBuildingBank size={24} color="var(--mantine-color-sage-7)" />
                  </Center>
                }
              />
              <Box>
                <Text size="xl" fw={700} c="light-dark(var(--mantine-color-sage-8), var(--mantine-color-text))">Comprar</Text>
                <Text size="sm" c="dimmed">Financiamento SAC ou PRICE</Text>
              </Box>
            </Group>
            <Group gap="lg" wrap="nowrap">
              <RingProgress
                size={70}
                thickness={6}
                roundCaps
                sections={[{ value: 100, color: 'forest.5' }]}
                label={
                  <Center>
                    <IconChartLine size={24} color="var(--mantine-color-forest-6)" />
                  </Center>
                }
              />
              <Box>
                <Text size="xl" fw={700} c="light-dark(var(--mantine-color-sage-8), var(--mantine-color-text))">Alugar</Text>
                <Text size="sm" c="dimmed">Investir a diferença</Text>
              </Box>
            </Group>
            <Group gap="lg" wrap="nowrap">
              <RingProgress
                size={70}
                thickness={6}
                roundCaps
                sections={[{ value: 100, color: 'info.5' }]}
                label={
                  <Center>
                    <IconPigMoney size={24} color="var(--mantine-color-info-6)" />
                  </Center>
                }
              />
              <Box>
                <Text size="xl" fw={700} c="light-dark(var(--mantine-color-sage-8), var(--mantine-color-text))">Investir</Text>
                <Text size="sm" c="dimmed">Juntar e comprar à vista</Text>
              </Box>
            </Group>
          </SimpleGrid>
        </Paper>
      </Container>

      {/* Features Section */}
      <Container size="lg" py={{ base: 60, md: 100 }}>
        <Box ta="center" mb={60}>
          <Badge variant="light" color="sage" size="lg" radius="xl" mb="sm">
            Funcionalidades
          </Badge>
          <Title order={2} fw={600} mb="sm">
            Tudo que você precisa para decidir
          </Title>
          <Text size="md" c="dimmed" maw={520} mx="auto">
            Ferramentas completas para analisar cada aspecto da sua decisão imobiliária
          </Text>
        </Box>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          <FeatureCard
            icon={<IconBuildingBank size={24} />}
            title="Financiamento SAC e PRICE"
            description="Simule financiamentos com sistemas SAC ou PRICE, incluindo amortizações extras."
            link="/comparacao"
            color="sage"
          />
          <FeatureCard
            icon={<IconScale size={24} />}
            title="Comparação de Cenários"
            description="Compare três estratégias: comprar financiado, alugar e investir, ou investir para comprar à vista."
            link="/comparacao"
            color="sage"
          />
          <FeatureCard
            icon={<IconChartLine size={24} />}
            title="Projeções Detalhadas"
            description="Visualize a evolução do seu patrimônio mês a mês, com gráficos e tabelas."
            color="sage"
          />
          <FeatureCard
            icon={<IconCoin size={24} />}
            title="Custos Adicionais"
            description="Inclua ITBI, escritura, condomínio, IPTU e outros custos na sua análise."
            color="sage"
          />
          <FeatureCard
            icon={<IconPigMoney size={24} />}
            title="Retornos Variáveis"
            description="Configure diferentes taxas de retorno para investimentos ao longo do tempo."
            color="sage"
          />
          <FeatureCard
            icon={<IconShieldCheck size={24} />}
            title="FGTS e Inflação"
            description="Considere o uso do FGTS e ajuste valores pela inflação para resultados realistas."
            color="sage"
          />
        </SimpleGrid>
      </Container>

      {/* How it Works Section */}
      <Box
        py={{ base: 60, md: 100 }}
        style={{
          backgroundColor: 'light-dark(var(--mantine-color-sage-0), var(--mantine-color-dark-8))',
          borderTop: '1px solid var(--mantine-color-default-border)',
          borderBottom: '1px solid var(--mantine-color-default-border)',
        }}
      >
        <Container size="lg">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={60} style={{ alignItems: 'center' }}>
            <Box>
              <Badge variant="light" color="sage" size="lg" radius="xl" mb="sm">
                Como Funciona
              </Badge>
              <Title order={2} fw={600} mb="md">
                Simples e intuitivo
              </Title>
              <Text size="md" c="dimmed" mb="xl" lh={1.7}>
                Em poucos passos, você terá uma visão clara de qual estratégia é mais vantajosa
                para o seu perfil e objetivos.
              </Text>
              
              {/* Timeline steps */}
              <Timeline active={2} bulletSize={40} lineWidth={3} color="sage">
                <Timeline.Item
                  bullet={
                    <ThemeIcon size={40} radius="xl" color="sage" variant="filled">
                      <IconClipboardList size={18} />
                    </ThemeIcon>
                  }
                  title={
                    <Text
                      fw={600}
                      size="md"
                      c="light-dark(var(--mantine-color-sage-8), var(--mantine-color-sage-2))"
                    >
                      Informe os dados
                    </Text>
                  }
                >
                  <Text c="dimmed" size="sm" mt={4}>
                    Valor do imóvel, entrada, prazo e taxas de juros.
                  </Text>
                </Timeline.Item>

                <Timeline.Item
                  bullet={
                    <ThemeIcon size={40} radius="xl" color="sage" variant="filled">
                      <IconSettings size={18} />
                    </ThemeIcon>
                  }
                  title={
                    <Text
                      fw={600}
                      size="md"
                      c="light-dark(var(--mantine-color-sage-8), var(--mantine-color-sage-2))"
                    >
                      Configure cenários
                    </Text>
                  }
                >
                  <Text c="dimmed" size="sm" mt={4}>
                    Defina aluguel, retorno de investimentos e inflação.
                  </Text>
                </Timeline.Item>

                <Timeline.Item
                  bullet={
                    <ThemeIcon size={40} radius="xl" color="sage" variant="filled">
                      <IconChartBar size={18} />
                    </ThemeIcon>
                  }
                  title={
                    <Text
                      fw={600}
                      size="md"
                      c="light-dark(var(--mantine-color-sage-8), var(--mantine-color-sage-2))"
                    >
                      Compare resultados
                    </Text>
                  }
                >
                  <Text c="dimmed" size="sm" mt={4}>
                    Visualize patrimônio, custos e ROI de cada estratégia.
                  </Text>
                </Timeline.Item>
              </Timeline>
            </Box>

            <Box>
              <Paper
                p="xl"
                radius="xl"
                style={{
                  backgroundColor: 'var(--mantine-color-body)',
                  border: '1px solid var(--mantine-color-default-border)',
                  boxShadow: 'var(--mantine-shadow-lg)',
                }}
              >
                <Group gap="md" mb="lg">
                  <ThemeIcon size={52} radius="xl" color="sage" variant="light">
                    <IconChartLine size={26} />
                  </ThemeIcon>
                  <Box>
                    <Text fw={600} size="lg" c="light-dark(var(--mantine-color-sage-8), var(--mantine-color-sage-2))">
                      Exemplo de Análise
                    </Text>
                    <Text size="sm" c="dimmed">
                      Imóvel de R$ 500 mil em 30 anos
                    </Text>
                  </Box>
                </Group>

                <SimpleGrid cols={2} spacing="md" mb="lg">
                  <Paper
                    p="md"
                    radius="lg"
                    style={{
                      background: 'light-dark(linear-gradient(135deg, var(--mantine-color-sage-0) 0%, var(--mantine-color-sage-1) 100%), linear-gradient(135deg, var(--mantine-color-dark-7) 0%, var(--mantine-color-dark-6) 100%))',
                      border: '1px solid var(--mantine-color-default-border)',
                    }}
                  >
                    <Group gap="xs" mb={4}>
                      <IconTrendingUp size={16} color="var(--mantine-color-sage-6)" />
                      <Text size="xs" c="sage.7" tt="uppercase" fw={600}>
                        Patrimônio Final
                      </Text>
                    </Group>
                    <Text fw={700} size="xl" c="sage.8">
                      R$ 820k
                    </Text>
                  </Paper>
                  <Paper
                    p="md"
                    radius="lg"
                    style={{
                      background: 'light-dark(linear-gradient(135deg, var(--mantine-color-success-0) 0%, var(--mantine-color-success-1) 100%), linear-gradient(135deg, var(--mantine-color-dark-7) 0%, color-mix(in srgb, var(--mantine-color-success-9) 35%, var(--mantine-color-dark-8)) 100%))',
                      border: '1px solid var(--mantine-color-default-border)',
                    }}
                  >
                    <Group gap="xs" mb={4}>
                      <IconPercentage size={16} color="var(--mantine-color-success-6)" />
                      <Text size="xs" c="success.7" tt="uppercase" fw={600}>
                        ROI Total
                      </Text>
                    </Group>
                    <Text fw={700} size="xl" c="success.8">
                      58%
                    </Text>
                  </Paper>
                </SimpleGrid>

                {/* Visual Bar Chart */}
                <Box
                  style={{
                    height: rem(120),
                    backgroundColor: 'light-dark(var(--mantine-color-cream-1), var(--mantine-color-dark-7))',
                    borderRadius: rem(12),
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-around',
                    padding: rem(16),
                    border: '1px solid var(--mantine-color-default-border)',
                  }}
                >
                  {[
                    { h: 50, label: 'Mês 1' },
                    { h: 62, label: 'Ano 5' },
                    { h: 70, label: 'Ano 10' },
                    { h: 80, label: 'Ano 20' },
                    { h: 95, label: 'Ano 30' },
                  ].map((bar, i) => (
                    <Box key={i} style={{ textAlign: 'center' }}>
                      <Box
                        style={{
                          width: rem(32),
                          height: `${bar.h}px`,
                          background: i === 4 
                            ? 'linear-gradient(180deg, var(--mantine-color-sage-5) 0%, var(--mantine-color-sage-7) 100%)'
                            : 'var(--mantine-color-sage-3)',
                          borderRadius: rem(6),
                          transition: 'all 200ms ease',
                          marginBottom: rem(6),
                        }}
                      />
                      <Text size="xs" c="dimmed">{bar.label}</Text>
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Box>
          </SimpleGrid>
        </Container>
      </Box>

      {/* Benefits Section */}
      <Container size="lg" py={{ base: 60, md: 80 }}>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
          {[
            { icon: IconCheck, title: 'Gratuito', desc: 'Sem custos ou cadastro', color: 'sage' },
            { icon: IconShieldCheck, title: 'Sem dados pessoais', desc: 'Privacidade total', color: 'forest' },
            { icon: IconTarget, title: 'Cálculos precisos', desc: 'Metodologia transparente', color: 'info' },
            { icon: IconSparkles, title: 'Atualizado', desc: 'Melhores práticas do mercado', color: 'sage' },
          ].map((benefit, i) => (
            <Paper
              key={i}
              p="xl"
              radius="xl"
              style={{
                border: '1px solid var(--mantine-color-default-border)',
                textAlign: 'center',
                transition: 'all 200ms ease',
              }}
              className="card-hover"
            >
              <ThemeIcon 
                size={52} 
                radius="xl" 
                variant="light" 
                color={benefit.color} 
                mb="md" 
                mx="auto"
              >
                <benefit.icon size={24} />
              </ThemeIcon>
              <Text fw={600} size="lg" c="light-dark(var(--mantine-color-sage-8), var(--mantine-color-text))" mb={4}>{benefit.title}</Text>
              <Text size="sm" c="dimmed">{benefit.desc}</Text>
            </Paper>
          ))}
        </SimpleGrid>
      </Container>

      {/* CTA Section */}
      <Container size="md" py={{ base: 60, md: 80 }}>
        <Paper
          p={{ base: 'xl', md: 50 }}
          radius="xl"
          style={{
            background: 'linear-gradient(135deg, var(--mantine-color-sage-7) 0%, var(--mantine-color-sage-8) 100%)',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Decorative elements */}
          <Box
            style={{
              position: 'absolute',
              top: -60,
              right: -60,
              width: 200,
              height: 200,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.1)',
              pointerEvents: 'none',
            }}
          />
          <Box
            style={{
              position: 'absolute',
              bottom: -40,
              left: -40,
              width: 150,
              height: 150,
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.05)',
              pointerEvents: 'none',
            }}
          />
          
          <Box style={{ position: 'relative', zIndex: 1 }}>
            <ThemeIcon size={70} radius="xl" mb="lg" mx="auto" color="cream" variant="filled">
              <IconHome size={32} />
            </ThemeIcon>
            <Title order={2} c="white" fw={600} mb="sm">
              Pronto para começar?
            </Title>
            <Text c="sage.2" size="lg" maw={400} mx="auto" mb="xl">
              Compare os cenários e descubra qual estratégia é a melhor para você.
            </Text>
            <Button
              component={Link}
              to="/comparacao"
              size="lg"
              radius="xl"
              rightSection={<IconArrowRight size={18} />}
              color="cream"
              c="sage.8"
              styles={{
                root: {
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
                },
              }}
            >
              Iniciar Simulação
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
