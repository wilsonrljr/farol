import {
  Container,
  Title,
  Text,
  ThemeIcon,
  Group,
  Stack,
  SimpleGrid,
  Paper,
  Anchor,
  Badge,
  ActionIcon,
  Tooltip,
  Box,
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
    <Paper
      p="lg"
      radius="lg"
      style={{
        border: highlight
          ? '2px solid var(--mantine-color-sage-3)'
          : '1px solid var(--mantine-color-default-border)',
        backgroundColor: highlight
          ? 'light-dark(var(--mantine-color-sage-0), var(--mantine-color-dark-7))'
          : 'var(--mantine-color-body)',
      }}
    >
      <Group gap="md" wrap="nowrap" align="flex-start">
        <ThemeIcon
          size={44}
          radius="lg"
          variant={highlight ? 'filled' : 'light'}
          color="sage"
        >
          <Icon size={22} />
        </ThemeIcon>
        <div>
          <Text fw={600} c="light-dark(var(--mantine-color-sage-8), var(--mantine-color-text))" mb={4}>
            {title}
          </Text>
          <Text size="sm" c="dimmed" style={{ lineHeight: 1.5 }}>
            {description}
          </Text>
        </div>
      </Group>
    </Paper>
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
    <Paper
      p="lg"
      radius="lg"
      style={{
        border: '1px solid var(--mantine-color-default-border)',
        backgroundColor: 'var(--mantine-color-body)',
      }}
    >
      <Group gap="md" wrap="nowrap" align="flex-start">
        <ThemeIcon size={40} radius="lg" variant="light" color="sage">
          <Icon size={20} />
        </ThemeIcon>
        <div>
          <Text fw={600} c="light-dark(var(--mantine-color-sage-8), var(--mantine-color-text))" mb="xs">
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
    </Paper>
  );
}

export default function About() {
  return (
    <Box>
      {/* Header Section */}
      <Box
        py={{ base: 40, md: 60 }}
        style={{
          borderBottom: '1px solid var(--mantine-color-default-border)',
          backgroundColor: 'light-dark(var(--mantine-color-sage-0), var(--mantine-color-dark-8))',
        }}
      >
        <Container size="lg">
          <Stack gap="md" align="center" ta="center">
            <ThemeIcon size={60} radius="xl" color="sage">
              <IconInfoCircle size={30} />
            </ThemeIcon>
            <Title order={1} fw={700}>
              Sobre o Farol
            </Title>
            <Text size="lg" c="sage.6" maw={600}>
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
            <Text size="sm" fw={600} c="sage.6" tt="uppercase" mb="xs">
              Propósito
            </Text>
            <Title order={2} fw={700} c="light-dark(var(--mantine-color-sage-8), var(--mantine-color-text))" mb="md">
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
            <Text size="sm" fw={600} c="sage.6" tt="uppercase" mb="xs">
              Tecnologias
            </Text>
            <Title order={2} fw={700} c="light-dark(var(--mantine-color-sage-8), var(--mantine-color-text))" mb="md">
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
          <Paper
            p="xl"
            radius="lg"
            mt="xl"
            style={{
              border: '1px solid var(--mantine-color-default-border)',
              backgroundColor: 'var(--mantine-color-body)',
            }}
          >
            <Group align="flex-start" gap="lg" wrap="nowrap">
              <ThemeIcon size={50} radius="xl" variant="light" color="sage">
                <IconUser size={24} />
              </ThemeIcon>
              <Stack gap="sm" style={{ flex: 1 }}>
                <div>
                  <Text fw={600} size="lg" c="light-dark(var(--mantine-color-sage-8), var(--mantine-color-text))">
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
                    c="sage.6"
                  >
                    SysIdentPy
                  </Anchor>
                  , mas aqui sou só mais uma pessoa tentando responder (com números) a dúvida
                  existencial imobiliária brasileira: vale chutar o balde e comprar logo ou é melhor
                  respirar fundo, investir e esperar? Se der certo, ótimo. Se der errado, bom...
                  espero que tenha uma reserva de emergência.
                </Text>
                <Group gap="xs">
                  <Badge size="sm" variant="light" color="sage">
                    Software
                  </Badge>
                  <Badge size="sm" variant="light" color="sage">
                    Finanças
                  </Badge>
                  <Badge size="sm" variant="light" color="coral">
                    Open Source
                  </Badge>
                </Group>
                <Group gap="xs" mt="xs">
                  <Tooltip label="GitHub" withArrow>
                    <ActionIcon
                      size="md"
                      variant="light"
                      color="sage"
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
                      color="sage"
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
                      color="sage"
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
                      color="sage"
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
          </Paper>

          {/* AI Notice */}
          <Paper
            p="lg"
            radius="lg"
            style={{
              border: '1px solid var(--mantine-color-default-border)',
              backgroundColor: 'light-dark(var(--mantine-color-sage-1), var(--mantine-color-dark-7))',
            }}
          >
            <Group align="flex-start" gap="md" wrap="nowrap">
              <ThemeIcon size={40} radius="lg" variant="light" color="sage">
                <IconCode size={20} />
              </ThemeIcon>
              <Stack gap="xs">
                <Text fw={600} c="light-dark(var(--mantine-color-sage-8), var(--mantine-color-text))">
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
          </Paper>

          {/* Disclaimer */}
          <Paper
            p="lg"
            radius="lg"
            style={{
              border: '1px solid light-dark(var(--mantine-color-warning-3), var(--mantine-color-dark-5))',
              backgroundColor: 'light-dark(var(--mantine-color-warning-0), color-mix(in srgb, var(--mantine-color-warning-9) 18%, var(--mantine-color-dark-8)))',
            }}
          >
            <Group align="flex-start" gap="md" wrap="nowrap">
              <ThemeIcon size={40} radius="lg" variant="light" color="warning">
                <IconShieldCheck size={20} />
              </ThemeIcon>
              <Stack gap="xs">
                <Text fw={600} c="light-dark(var(--mantine-color-sage-8), var(--mantine-color-text))">
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
          </Paper>

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
