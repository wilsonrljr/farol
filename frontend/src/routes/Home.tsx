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
          background: 'light-dark(linear-gradient(180deg, rgba(248, 250, 252, 1) 0%, rgba(240, 247, 255, 0.8) 100%), linear-gradient(180deg, rgba(15, 23, 42, 1) 0%, rgba(15, 23, 42, 0.95) 100%))',
        }}
      >
        {/* Decorative elements */}
        <Box
          style={{
            position: 'absolute',
            top: '10%',
            right: '-5%',
            width: rem(500),
            height: rem(500),
            borderRadius: '50%',
            background: 'light-dark(radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%), radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%))',
            filter: 'blur(40px)',
            pointerEvents: 'none',
          }}
        />
        <Box
          style={{
            position: 'absolute',
            bottom: '5%',
            left: '-10%',
            width: rem(400),
            height: rem(400),
            borderRadius: '50%',
            background: 'light-dark(radial-gradient(circle, rgba(20, 184, 166, 0.06) 0%, transparent 70%), radial-gradient(circle, rgba(20, 184, 166, 0.08) 0%, transparent 70%))',
            filter: 'blur(40px)',
            pointerEvents: 'none',
          }}
        />
        
        <Container size="lg" style={{ position: 'relative', zIndex: 1 }}>
          <Box maw={720} mx="auto" ta="center">
            <Badge 
              size="lg" 
              radius="xl" 
              variant="light" 
              color="ocean"
              mb="lg"
              leftSection={<IconLeaf size={14} />}
            >
              Planejamento Financeiro
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
                style={{ color: 'light-dark(var(--mantine-color-ocean-7), var(--mantine-color-ocean-3))' }}
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
                color="ocean"
                styles={{
                  root: {
                    boxShadow: '0 4px 14px rgba(44, 112, 163, 0.25)',
                  },
                }}
              >
                Comprar vs Alugar
              </Button>
              <Button
                component={Link}
                to="/docs/quickstart"
                size="lg"
                radius="xl"
                variant="outline"
                color="ocean"
              >
                Como funciona
              </Button>
            </Group>
          </Box>
        </Container>
      </Box>

      {/* Stats Section - Quick Visual Overview */}
      <Container size="lg" mt={-40} style={{ position: 'relative', zIndex: 2 }}>
        <Box
          p={{ base: 'lg', md: 'xl' }}
          style={{
            borderRadius: rem(24),
            background: 'var(--glass-bg-elevated)',
            backdropFilter: 'blur(var(--glass-blur-heavy))',
            WebkitBackdropFilter: 'blur(var(--glass-blur-heavy))',
            boxShadow: 'var(--glass-shadow-lg), var(--glass-shadow-glow)',
          }}
        >
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xl">
            <Group gap="lg" wrap="nowrap">
              <RingProgress
                size={70}
                thickness={6}
                roundCaps
                sections={[{ value: 100, color: 'ocean.5' }]}
                label={
                  <Center>
                    <IconBuildingBank size={24} color="var(--mantine-color-ocean-6)" />
                  </Center>
                }
              />
              <Box>
                <Text size="xl" fw={700} c="light-dark(var(--mantine-color-ocean-7), var(--mantine-color-text))">Comprar</Text>
                <Text size="sm" c="dimmed">Financiamento SAC ou PRICE</Text>
              </Box>
            </Group>
            <Group gap="lg" wrap="nowrap">
              <RingProgress
                size={70}
                thickness={6}
                roundCaps
                sections={[{ value: 100, color: 'teal.5' }]}
                label={
                  <Center>
                    <IconChartLine size={24} color="var(--mantine-color-teal-6)" />
                  </Center>
                }
              />
              <Box>
                <Text size="xl" fw={700} c="light-dark(var(--mantine-color-ocean-7), var(--mantine-color-text))">Alugar</Text>
                <Text size="sm" c="dimmed">Investir a diferença</Text>
              </Box>
            </Group>
            <Group gap="lg" wrap="nowrap">
              <RingProgress
                size={70}
                thickness={6}
                roundCaps
                sections={[{ value: 100, color: 'violet.5' }]}
                label={
                  <Center>
                    <IconPigMoney size={24} color="var(--mantine-color-violet-6)" />
                  </Center>
                }
              />
              <Box>
                <Text size="xl" fw={700} c="light-dark(var(--mantine-color-ocean-7), var(--mantine-color-text))">Investir</Text>
                <Text size="sm" c="dimmed">Juntar e comprar à vista</Text>
              </Box>
            </Group>
          </SimpleGrid>
        </Box>
      </Container>

      {/* Features Section */}
      <Container size="lg" py={{ base: 60, md: 100 }}>
        <Box ta="center" mb={60}>
          <Badge variant="light" color="ocean" size="lg" radius="xl" mb="sm">
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
            color="ocean"
          />
          <FeatureCard
            icon={<IconScale size={24} />}
            title="Comprar vs Alugar"
            description="Compare três estratégias: comprar financiado, alugar e investir, ou investir para comprar à vista."
            link="/comparacao"
            color="ocean"
          />
          <FeatureCard
            icon={<IconChartLine size={24} />}
            title="Projeções Detalhadas"
            description="Visualize a evolução do seu patrimônio mês a mês, com gráficos e tabelas."
            color="ocean"
          />
          <FeatureCard
            icon={<IconCoin size={24} />}
            title="Custos Adicionais"
            description="Inclua ITBI, escritura, condomínio, IPTU e outros custos na sua análise."
            color="ocean"
          />
          <FeatureCard
            icon={<IconPigMoney size={24} />}
            title="Retornos Variáveis"
            description="Configure diferentes taxas de retorno para investimentos ao longo do tempo."
            color="ocean"
          />
          <FeatureCard
            icon={<IconShieldCheck size={24} />}
            title="FGTS e Inflação"
            description="Considere o uso do FGTS e ajuste valores pela inflação para resultados realistas."
            color="ocean"
          />
        </SimpleGrid>
      </Container>

      {/* How it Works Section */}
      <Box
        py={{ base: 60, md: 100 }}
        style={{
          background: 'light-dark(linear-gradient(180deg, rgba(240, 247, 255, 0.5) 0%, rgba(248, 250, 252, 0.3) 100%), linear-gradient(180deg, rgba(30, 41, 59, 0.3) 0%, rgba(15, 23, 42, 0.2) 100%))',
        }}
      >
        <Container size="lg">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={60} style={{ alignItems: 'center' }}>
            <Box>
              <Badge variant="light" color="ocean" size="lg" radius="xl" mb="sm">
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
              <Timeline active={2} bulletSize={40} lineWidth={3} color="ocean">
                <Timeline.Item
                  bullet={
                    <ThemeIcon size={40} radius="xl" color="ocean" variant="filled">
                      <IconClipboardList size={18} />
                    </ThemeIcon>
                  }
                  title={
                    <Text
                      fw={600}
                      size="md"
                      c="light-dark(var(--mantine-color-ocean-8), var(--mantine-color-ocean-2))"
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
                    <ThemeIcon size={40} radius="xl" color="ocean" variant="filled">
                      <IconSettings size={18} />
                    </ThemeIcon>
                  }
                  title={
                    <Text
                      fw={600}
                      size="md"
                      c="light-dark(var(--mantine-color-ocean-8), var(--mantine-color-ocean-2))"
                    >
                      Configure cenários
                    </Text>
                  }
                >
                  <Text c="dimmed" size="sm" mt={4}>
                    Defina aluguel, retorno do investimento e inflação.
                  </Text>
                </Timeline.Item>

                <Timeline.Item
                  bullet={
                    <ThemeIcon size={40} radius="xl" color="ocean" variant="filled">
                      <IconChartBar size={18} />
                    </ThemeIcon>
                  }
                  title={
                    <Text
                      fw={600}
                      size="md"
                      c="light-dark(var(--mantine-color-ocean-8), var(--mantine-color-ocean-2))"
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
              <Box
                p="xl"
                style={{
                  background: 'var(--glass-bg-elevated)',
                  backdropFilter: 'blur(var(--glass-blur-heavy))',
                  WebkitBackdropFilter: 'blur(var(--glass-blur-heavy))',
                  boxShadow: 'var(--glass-shadow-lg), var(--glass-shadow-glow)',
                  borderRadius: rem(24),
                }}
              >
                <Group gap="md" mb="lg">
                  <ThemeIcon size={52} radius="xl" color="ocean" variant="light">
                    <IconChartLine size={26} />
                  </ThemeIcon>
                  <Box>
                    <Text fw={600} size="lg" c="light-dark(var(--mantine-color-ocean-8), var(--mantine-color-ocean-2))">
                      Exemplo de Análise
                    </Text>
                    <Text size="sm" c="dimmed">
                      Imóvel de R$ 500 mil em 30 anos
                    </Text>
                  </Box>
                </Group>

                <SimpleGrid cols={2} spacing="md" mb="lg">
                  <Box
                    p="md"
                    style={{
                      background: 'light-dark(linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(255, 255, 255, 0.5) 100%), linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(30, 41, 59, 0.8) 100%))',
                      borderRadius: rem(16),
                    }}
                  >
                    <Group gap="xs" mb={4}>
                      <IconTrendingUp size={16} color="var(--mantine-color-ocean-5)" />
                      <Text size="xs" c="ocean.5" tt="uppercase" fw={600}>
                        Patrimônio Final
                      </Text>
                    </Group>
                    <Text fw={700} size="xl" c="ocean.6">
                      R$ 820k
                    </Text>
                  </Box>
                  <Box
                    p="md"
                    style={{
                      background: 'light-dark(linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(255, 255, 255, 0.5) 100%), linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(30, 41, 59, 0.8) 100%))',
                      borderRadius: rem(16),
                    }}
                  >
                    <Group gap="xs" mb={4}>
                      <IconPercentage size={16} color="var(--mantine-color-emerald-5)" />
                      <Text size="xs" c="emerald.5" tt="uppercase" fw={600}>
                        ROI Total
                      </Text>
                    </Group>
                    <Text fw={700} size="xl" c="emerald.6">
                      58%
                    </Text>
                  </Box>
                </SimpleGrid>

                {/* Visual Bar Chart */}
                <Box
                  style={{
                    height: rem(120),
                    background: 'light-dark(rgba(0, 0, 0, 0.03), rgba(255, 255, 255, 0.03))',
                    borderRadius: rem(16),
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-around',
                    padding: rem(16),
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
                            ? 'linear-gradient(180deg, var(--mantine-color-ocean-5) 0%, var(--mantine-color-ocean-7) 100%)'
                            : 'var(--mantine-color-ocean-3)',
                          borderRadius: rem(6),
                          transition: 'all 200ms ease',
                          marginBottom: rem(6),
                        }}
                      />
                      <Text size="xs" c="dimmed">{bar.label}</Text>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          </SimpleGrid>
        </Container>
      </Box>

      {/* Benefits Section */}
      <Container size="lg" py={{ base: 60, md: 80 }}>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
          {[
            { icon: IconCheck, title: 'Gratuito', desc: 'Sem custos ou cadastro', color: 'ocean' },
            { icon: IconShieldCheck, title: 'Sem dados pessoais', desc: 'Privacidade total', color: 'teal' },
            { icon: IconTarget, title: 'Cálculos precisos', desc: 'Metodologia transparente', color: 'violet' },
            { icon: IconSparkles, title: 'Atualizado', desc: 'Melhores práticas do mercado', color: 'ocean' },
          ].map((benefit, i) => (
            <Box
              key={i}
              className="card-hover"
              style={{
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                boxShadow: 'var(--glass-shadow), var(--glass-shadow-glow)',
                borderRadius: rem(20),
                padding: rem(24),
                textAlign: 'center',
                transition: 'all 250ms cubic-bezier(0.2, 0, 0, 1)',
              }}
            >
              <ThemeIcon 
                size={56} 
                radius="xl" 
                variant="light" 
                color={benefit.color} 
                mb="md" 
                mx="auto"
                style={{
                  background: `light-dark(
                    linear-gradient(135deg, var(--mantine-color-${benefit.color}-1) 0%, var(--mantine-color-${benefit.color}-0) 100%),
                    linear-gradient(135deg, var(--mantine-color-${benefit.color}-8) 0%, var(--mantine-color-${benefit.color}-9) 100%)
                  )`,
                  boxShadow: `0 4px 12px -4px var(--mantine-color-${benefit.color}-4)`,
                }}
              >
                <benefit.icon size={24} />
              </ThemeIcon>
              <Text fw={600} size="lg" c="bright" mb={4}>{benefit.title}</Text>
              <Text size="sm" c="dimmed">{benefit.desc}</Text>
            </Box>
          ))})
        </SimpleGrid>
      </Container>

      {/* CTA Section */}
      <Container size="md" py={{ base: 60, md: 80 }}>
        <Box
          p={{ base: 'xl', md: 50 }}
          style={{
            background: 'linear-gradient(135deg, var(--mantine-color-ocean-6) 0%, var(--mantine-color-ocean-7) 100%)',
            borderRadius: rem(28),
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 16px 48px -12px rgba(59, 130, 246, 0.35)',
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
            <ThemeIcon size={70} radius="xl" mb="lg" mx="auto" color="slate" variant="filled">
              <IconHome size={32} />
            </ThemeIcon>
            <Title order={2} c="white" fw={600} mb="sm">
              Pronto para começar?
            </Title>
            <Text c="slate.3" size="lg" maw={400} mx="auto" mb="xl">
              Compare os cenários e descubra qual estratégia é a melhor para você.
            </Text>
            <Button
              component={Link}
              to="/comparacao"
              size="lg"
              radius="xl"
              rightSection={<IconArrowRight size={18} />}
              color="white"
              c="ocean.7"
              styles={{
                root: {
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
                },
              }}
            >
              Iniciar Simulação
            </Button>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
