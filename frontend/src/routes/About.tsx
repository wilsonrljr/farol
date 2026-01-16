import {
  Container,
  Title,
  Text,
  ThemeIcon,
  Group,
  Stack,
  SimpleGrid,
  Anchor,
  Badge,
  ActionIcon,
  Tooltip,
  Box,
  rem,
} from '@mantine/core';
import {
  IconBrandPython,
  IconBrandReact,
  IconServerBolt,
  IconLayersLinked,
  IconCode,
  IconUser,
  IconBrandGithub,
  IconLockOpen,
  IconInfoCircle,
  IconBrandLinkedin,
  IconBrandX,
  IconId,
  IconBulb,
  IconTarget,
  IconShieldCheck,
} from '@tabler/icons-react';

// Feature Card Component
function FeatureCard({
  icon: Icon,
  title,
  description,
  highlight = false,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  highlight?: boolean;
}) {
  return (
    <Box
      p="lg"
      style={{
        background: highlight
          ? `light-dark(
              linear-gradient(145deg, var(--mantine-color-ocean-0) 0%, rgba(255, 255, 255, 0.85) 100%),
              linear-gradient(145deg, var(--mantine-color-ocean-9) 0%, rgba(30, 41, 59, 0.9) 100%)
            )`
          : 'var(--glass-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: highlight 
          ? 'var(--glass-shadow-lg), 0 0 0 1px var(--mantine-color-ocean-2) inset' 
          : 'var(--glass-shadow), var(--glass-shadow-glow)',
        borderRadius: rem(16),
      }}
    >
      <Group gap="md" wrap="nowrap" align="flex-start">
        <ThemeIcon
          size={48}
          radius="xl"
          variant={highlight ? 'filled' : 'light'}
          color="ocean"
          style={{
            boxShadow: highlight ? '0 4px 12px -2px var(--mantine-color-ocean-5)' : 'none',
          }}
        >
          <Icon size={22} />
        </ThemeIcon>
        <div>
          <Text fw={600} c="bright" mb={4}>
            {title}
          </Text>
          <Text size="sm" c="dimmed" style={{ lineHeight: 1.5 }}>
            {description}
          </Text>
        </div>
      </Group>
    </Box>
  );
}

// Tech Card Component
function TechCard({
  icon: Icon,
  title,
  items,
}: {
  icon: React.ElementType;
  title: string;
  items: string[];
}) {
  return (
    <Box
      p="lg"
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: 'var(--glass-shadow), var(--glass-shadow-glow)',
        borderRadius: rem(16),
      }}
    >
      <Group gap="md" wrap="nowrap" align="flex-start">
        <ThemeIcon size={44} radius="xl" variant="light" color="ocean">
          <Icon size={20} />
        </ThemeIcon>
        <div>
          <Text fw={600} c="bright" mb="xs">
            {title}
          </Text>
          <Stack gap={4}>
            {items.map((item) => (
              <Text key={item} size="sm" c="dimmed">
                • {item}
              </Text>
            ))}
          </Stack>
        </div>
      </Group>
    </Box>
  );
}

export default function About() {
  return (
    <Box>
      {/* Header Section */}
      <Box
        py={{ base: 40, md: 60 }}
        style={{
          background: 'light-dark(linear-gradient(180deg, rgba(240, 247, 255, 0.5) 0%, rgba(248, 250, 252, 0.3) 100%), linear-gradient(180deg, rgba(30, 41, 59, 0.3) 0%, rgba(15, 23, 42, 0.2) 100%))',
        }}
      >
        <Container size="lg">
          <Stack gap="md" align="center" ta="center">
            <ThemeIcon 
              size={64} 
              radius="xl" 
              color="ocean"
              style={{
                boxShadow: '0 4px 16px -4px var(--mantine-color-ocean-5)',
              }}
            >
              <IconInfoCircle size={30} />
            </ThemeIcon>
            <Title order={1} fw={700}>
              Sobre o Farol
            </Title>
            <Text size="lg" c="ocean.5" maw={600}>
              Uma ferramenta educativa para ajudar você a entender melhor as opções de aquisição
              imobiliária no Brasil.
            </Text>
          </Stack>
        </Container>
      </Box>

      {/* Purpose Section */}
      <Container size="lg" py={{ base: 40, md: 60 }}>
        <Stack gap="xl">
          <div>
            <Text size="sm" fw={600} c="ocean.6" tt="uppercase" mb="xs">
              Propósito
            </Text>
            <Title order={2} fw={700} c="light-dark(var(--mantine-color-ocean-7), var(--mantine-color-text))" mb="md">
              Por que criamos o Farol?
            </Title>
          </div>

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            <FeatureCard
              icon={IconTarget}
              title="Comparar Estratégias"
              description="Responder a pergunta: vale a pena financiar agora ou investir e comprar depois?"
              highlight
            />
            <FeatureCard
              icon={IconBulb}
              title="Trazer Clareza"
              description="Entender o impacto real de juros compostos, inflação e valorização imobiliária."
            />
            <FeatureCard
              icon={IconShieldCheck}
              title="Decisão Informada"
              description="Tomar decisões financeiras importantes com base em números, não em achismo."
            />
          </SimpleGrid>

          {/* Technologies */}
          <Box mt="xl">
            <Text size="sm" fw={600} c="ocean.6" tt="uppercase" mb="xs">
              Tecnologias
            </Text>
            <Title order={2} fw={700} c="light-dark(var(--mantine-color-ocean-7), var(--mantine-color-text))" mb="md">
              Como foi construído
            </Title>

            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
              <TechCard
                icon={IconBrandPython}
                title="Backend (Python)"
                items={['FastAPI + Pydantic', 'Conversão de taxas', 'Cálculo determinístico']}
              />
              <TechCard
                icon={IconBrandReact}
                title="Frontend (React)"
                items={['React + TypeScript', 'Mantine UI/Charts', 'Vite para build']}
              />
              <TechCard
                icon={IconLayersLinked}
                title="Arquitetura"
                items={['Inputs estruturados', 'Série temporal', 'Métricas agregadas']}
              />
            </SimpleGrid>
          </Box>

          {/* Author */}
          <Box
            p="xl"
            mt="xl"
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: 'var(--glass-shadow), var(--glass-shadow-glow)',
              borderRadius: rem(20),
            }}
          >
            <Group align="flex-start" gap="lg" wrap="nowrap">
              <ThemeIcon 
                size={56} 
                radius="xl" 
                variant="light" 
                color="ocean"
                style={{
                  background: 'light-dark(linear-gradient(135deg, var(--mantine-color-ocean-1) 0%, var(--mantine-color-ocean-0) 100%), linear-gradient(135deg, var(--mantine-color-ocean-8) 0%, var(--mantine-color-ocean-9) 100%))',
                  boxShadow: '0 4px 12px -4px var(--mantine-color-ocean-4)',
                }}
              >
                <IconUser size={24} />
              </ThemeIcon>
              <Stack gap="sm" style={{ flex: 1 }}>
                <div>
                  <Text fw={600} size="lg" c="bright">
                    Autor
                  </Text>
                  <Text size="sm" c="dimmed">
                    Wilson Rocha Lacerda Junior
                  </Text>
                </div>
                <Text size="sm" c="dimmed" style={{ lineHeight: 1.6 }}>
                  Criei a{' '}
                  <Anchor
                    href="https://github.com/wilsonrljr/sysidentpy"
                    target="_blank"
                    rel="noopener noreferrer"
                    c="ocean.6"
                  >
                    SysIdentPy
                  </Anchor>
                  , mas aqui sou só mais uma pessoa tentando responder (com números) a dúvida
                  existencial imobiliária brasileira: vale chutar o balde e comprar logo ou é melhor
                  respirar fundo, investir e esperar? Se der certo, ótimo. Se der errado, bom...
                  espero que tenha uma reserva de emergência.
                </Text>
                <Group gap="xs">
                  <Badge size="sm" variant="light" color="ocean">
                    Software
                  </Badge>
                  <Badge size="sm" variant="light" color="ocean">
                    Finanças
                  </Badge>
                  <Badge size="sm" variant="light" color="rose">
                    Open Source
                  </Badge>
                </Group>
                <Group gap="xs" mt="xs">
                  <Tooltip label="GitHub" withArrow>
                    <ActionIcon
                      size="md"
                      variant="light"
                      color="ocean"
                      component="a"
                      href="https://github.com/wilsonrljr"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="GitHub"
                      radius="lg"
                    >
                      <IconBrandGithub size={18} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="LinkedIn" withArrow>
                    <ActionIcon
                      size="md"
                      variant="light"
                      color="ocean"
                      component="a"
                      href="https://www.linkedin.com/in/wilsonrljr"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="LinkedIn"
                      radius="lg"
                    >
                      <IconBrandLinkedin size={18} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Twitter / X" withArrow>
                    <ActionIcon
                      size="md"
                      variant="light"
                      color="ocean"
                      component="a"
                      href="https://twitter.com/wilsonrljr"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Twitter"
                      radius="lg"
                    >
                      <IconBrandX size={18} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="ORCID" withArrow>
                    <ActionIcon
                      size="md"
                      variant="light"
                      color="ocean"
                      component="a"
                      href="https://orcid.org/0000-0002-3263-1152"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="ORCID"
                      radius="lg"
                    >
                      <IconId size={18} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Stack>
            </Group>
          </Box>

          {/* AI Notice */}
          <Box
            p="lg"
            style={{
              background: `light-dark(
                linear-gradient(145deg, var(--mantine-color-ocean-0) 0%, rgba(255, 255, 255, 0.85) 100%),
                linear-gradient(145deg, var(--mantine-color-ocean-9) 0%, rgba(30, 41, 59, 0.9) 100%)
              )`,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: 'var(--glass-shadow), 0 0 0 1px var(--mantine-color-ocean-2) inset',
              borderRadius: rem(16),
            }}
          >
            <Group align="flex-start" gap="md" wrap="nowrap">
              <ThemeIcon size={44} radius="xl" variant="light" color="ocean">
                <IconCode size={20} />
              </ThemeIcon>
              <Stack gap="xs">
                <Text fw={600} c="bright">
                  Uso de IA
                </Text>
                <Text size="sm" c="dimmed" style={{ lineHeight: 1.6 }}>
                  Grande parte desta aplicação foi desenvolvida com o auxílio de ferramentas de
                  Inteligência Artificial. Todo o conteúdo foi revisado e adaptado. Por isso, nada
                  mais justo do que torná-la open source, permitindo que a comunidade colabore e
                  identifique possíveis melhorias.
                </Text>
              </Stack>
            </Group>
          </Box>

          {/* Disclaimer */}
          <Box
            p="lg"
            style={{
              background: `light-dark(
                linear-gradient(145deg, var(--mantine-color-amber-0) 0%, rgba(255, 255, 255, 0.85) 100%),
                linear-gradient(145deg, var(--mantine-color-amber-9) 0%, rgba(30, 41, 59, 0.9) 100%)
              )`,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: 'var(--glass-shadow), 0 0 0 1px var(--mantine-color-amber-2) inset',
              borderRadius: rem(16),
            }}
          >
            <Group align="flex-start" gap="md" wrap="nowrap">
              <ThemeIcon size={44} radius="xl" variant="light" color="amber">
                <IconShieldCheck size={20} />
              </ThemeIcon>
              <Stack gap="xs">
                <Text fw={600} c="bright">
                  Disclaimer
                </Text>
                <Text size="sm" c="dimmed" style={{ lineHeight: 1.6 }}>
                  Isto é uma simulação educativa. Nada aqui é recomendação de compra, venda,
                  financiamento ou de como você deve investir seu dinheiro. Os resultados dependem
                  totalmente das premissas inseridas e podem divergir da vida real. Faça sempre sua
                  própria análise e, se necessário, consulte um profissional qualificado.
                </Text>
                <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>
                  Resumindo: é uma calculadora para reduzir achismo, não um oráculo financeiro.
                </Text>
              </Stack>
            </Group>
          </Box>

          {/* Footer */}
          <Text size="xs" c="dimmed" ta="center" mt="xl">
            Frontend: React + Vite + Mantine · Backend: FastAPI (Python) · ©{' '}
            {new Date().getFullYear()}
          </Text>
        </Stack>
      </Container>
    </Box>
  );
}
