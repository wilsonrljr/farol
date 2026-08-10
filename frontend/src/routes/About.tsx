import {
  ActionIcon,
  Anchor,
  Box,
  Button,
  Container,
  Group,
  List,
  Paper,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconBrandGithub,
  IconBrandLinkedin,
  IconBrandPython,
  IconBrandReact,
  IconBrandX,
  IconBulb,
  IconCode,
  IconExternalLink,
  IconId,
  IconInfoCircle,
  IconLayersLinked,
  IconShieldCheck,
  IconTarget,
  IconUser,
} from '@tabler/icons-react';

interface InfoCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
}

function InfoCard({ icon: Icon, title, description }: InfoCardProps) {
  return (
    <Paper className="surface-card principle-card">
      <Box className="icon-tile" aria-hidden="true" mb="md">
        <Icon size={22} stroke={1.8} />
      </Box>
      <Title order={3} size="h4" mb="xs">
        {title}
      </Title>
      <Text size="sm" c="dimmed" lh={1.65}>
        {description}
      </Text>
    </Paper>
  );
}

interface TechCardProps {
  icon: React.ElementType;
  title: string;
  items: string[];
}

function TechCard({ icon: Icon, title, items }: TechCardProps) {
  return (
    <Paper className="surface-card tech-card">
      <Group gap="sm" wrap="nowrap" mb="md">
        <Box className="icon-tile" aria-hidden="true">
          <Icon size={22} stroke={1.8} />
        </Box>
        <Title order={3} size="h4">
          {title}
        </Title>
      </Group>
      <List size="sm" c="dimmed" spacing="xs" withPadding>
        {items.map((item) => (
          <List.Item key={item}>{item}</List.Item>
        ))}
      </List>
    </Paper>
  );
}

export default function About() {
  return (
    <Box>
      <Box component="header" className="page-hero">
        <Container size="lg" className="page-hero__content">
          <Stack gap="md">
            <Group gap="xs" wrap="nowrap">
              <IconInfoCircle
                size={20}
                color="var(--mantine-color-ocean-6)"
                aria-hidden="true"
              />
              <Text className="eyebrow">Sobre o projeto</Text>
            </Group>
            <Title order={1} className="page-hero__title">
              Clareza para decisões financeiras importantes
            </Title>
            <Text className="page-hero__description">
              O Farol é uma ferramenta educativa e de código aberto para explorar decisões
              imobiliárias e de planejamento financeiro com premissas explícitas.
            </Text>
          </Stack>
        </Container>
      </Box>

      <Container size="lg" className="home-section">
        <Stack gap={56}>
          <Box component="section" aria-labelledby="purpose-title">
            <Box className="section-heading" mb="xl">
              <Text className="eyebrow" mb="xs">
                Propósito
              </Text>
              <Title id="purpose-title" order={2} className="section-title" mb="sm">
                Ajudar a pensar, não escolher por você
              </Title>
              <Text className="section-description">
                Decisões de longo prazo dependem de hipóteses incertas. O produto existe para
                organizar essas hipóteses e tornar as consequências mais fáceis de inspecionar.
              </Text>
            </Box>

            <Box className="principles-grid">
              <InfoCard
                icon={IconTarget}
                title="Comparar estratégias"
                description="Colocar financiamento, aluguel e investimento no mesmo horizonte e com recursos equivalentes."
              />
              <InfoCard
                icon={IconBulb}
                title="Explicar o resultado"
                description="Mostrar custos, patrimônio, viabilidade e avisos em vez de reduzir a análise a um único número."
              />
              <InfoCard
                icon={IconShieldCheck}
                title="Assumir os limites"
                description="Diferenciar cenários exploratórios de comparações válidas e documentar simplificações do modelo."
              />
            </Box>
          </Box>

          <Box component="section" aria-labelledby="architecture-title">
            <Box className="section-heading" mb="xl">
              <Text className="eyebrow" mb="xs">
                Implementação
              </Text>
              <Title id="architecture-title" order={2} className="section-title" mb="sm">
                Como o Farol é construído
              </Title>
              <Text className="section-description">
                A interface coleta premissas estruturadas; o motor calcula séries mensais e devolve
                métricas, avisos e estados de comparabilidade.
              </Text>
            </Box>

            <Box className="tech-grid">
              <TechCard
                icon={IconBrandPython}
                title="Motor de cálculo"
                items={['Python, FastAPI e Pydantic', 'Regras financeiras determinísticas', 'Validação de contratos de entrada e saída']}
              />
              <TechCard
                icon={IconBrandReact}
                title="Experiência web"
                items={['React e TypeScript', 'Componentes Mantine', 'Gráficos e tabelas responsivos']}
              />
              <TechCard
                icon={IconLayersLinked}
                title="Modelo de análise"
                items={['Fluxos mensais reconciliados', 'Métricas agregadas e alertas', 'Documentação da metodologia']}
              />
            </Box>
          </Box>

          <Box component="section" aria-labelledby="author-title">
            <Paper className="surface-card profile-card">
              <Stack gap="md">
                <Box className="icon-tile" aria-hidden="true">
                  <IconUser size={22} stroke={1.8} />
                </Box>
                <Box>
                  <Text className="eyebrow" mb="xs">
                    Autor e manutenção
                  </Text>
                  <Title id="author-title" order={2} size="h3" mb="xs">
                    Wilson Rocha Lacerda Junior
                  </Title>
                  <Text size="sm" c="dimmed">
                    Desenvolvedor de software e criador da biblioteca científica{' '}
                    <Anchor
                      href="https://github.com/wilsonrljr/sysidentpy"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      SysIdentPy
                    </Anchor>
                    .
                  </Text>
                </Box>

                <Group gap="xs">
                  <Tooltip label="GitHub">
                    <ActionIcon
                      className="social-link"
                      size={44}
                      variant="default"
                      component="a"
                      href="https://github.com/wilsonrljr"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Perfil de Wilson no GitHub"
                    >
                      <IconBrandGithub size={19} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="LinkedIn">
                    <ActionIcon
                      className="social-link"
                      size={44}
                      variant="default"
                      component="a"
                      href="https://www.linkedin.com/in/wilsonrljr"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Perfil de Wilson no LinkedIn"
                    >
                      <IconBrandLinkedin size={19} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="X / Twitter">
                    <ActionIcon
                      className="social-link"
                      size={44}
                      variant="default"
                      component="a"
                      href="https://twitter.com/wilsonrljr"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Perfil de Wilson no X"
                    >
                      <IconBrandX size={19} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="ORCID">
                    <ActionIcon
                      className="social-link"
                      size={44}
                      variant="default"
                      component="a"
                      href="https://orcid.org/0000-0002-3263-1152"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Perfil ORCID de Wilson"
                    >
                      <IconId size={19} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Stack>

              <Stack gap="md" justify="center">
                <Text c="dimmed" lh={1.7}>
                  O projeto nasceu de uma dúvida comum: financiar agora ou preservar capital e
                  comprar depois? Tornar o código e a metodologia públicos permite que outras
                  pessoas revisem premissas, apontem falhas e proponham melhorias.
                </Text>
                <Button
                  component="a"
                  href="https://github.com/wilsonrljr/farol"
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="default"
                  leftSection={<IconBrandGithub size={18} />}
                  rightSection={<IconExternalLink size={16} />}
                  style={{ alignSelf: 'flex-start' }}
                >
                  Ver código-fonte
                </Button>
              </Stack>
            </Paper>
          </Box>

          <Box component="section" className="about-grid" aria-label="Transparência e limites">
            <Paper className="surface-card notice-card">
              <Group align="flex-start" gap="md" wrap="nowrap">
                <Box className="icon-tile" aria-hidden="true">
                  <IconCode size={21} />
                </Box>
                <Box>
                  <Title order={2} size="h4" mb="xs">
                    Uso de inteligência artificial
                  </Title>
                  <Text size="sm" c="dimmed" lh={1.65}>
                    Ferramentas de IA auxiliaram parte do desenvolvimento. O repositório aberto
                    possibilita revisão técnica e contribuições da comunidade.
                  </Text>
                </Box>
              </Group>
            </Paper>

            <Paper className="surface-card notice-card notice-card--warning">
              <Group align="flex-start" gap="md" wrap="nowrap">
                <Box className="icon-tile" aria-hidden="true">
                  <IconShieldCheck size={21} />
                </Box>
                <Box>
                  <Title order={2} size="h4" mb="xs">
                    Limite de responsabilidade
                  </Title>
                  <Text size="sm" c="dimmed" lh={1.65}>
                    Esta é uma simulação educativa, não uma recomendação de compra, financiamento ou
                    investimento. Resultados dependem das premissas e podem divergir da realidade.
                  </Text>
                </Box>
              </Group>
            </Paper>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
