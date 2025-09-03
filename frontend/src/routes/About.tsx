import { Container, Title, Text, ThemeIcon, Group, Stack, SimpleGrid, Card, Anchor, Badge, Divider, useMantineColorScheme, ActionIcon, Tooltip } from '@mantine/core';
import { IconBrandPython, IconBrandReact, IconServerBolt, IconLayersLinked, IconCode, IconUser, IconBrandGithub, IconLockOpen, IconInfoCircle, IconBrandLinkedin, IconBrandX, IconId } from '@tabler/icons-react';

export default function About() {
  return (
    <Container size="lg" py="xl">
      <Title order={2} mb="xs">Sobre</Title>
      <Text size="sm" c="dimmed" mb="lg">Entenda rapidamente o objetivo antes de detalhes técnicos.</Text>

      <SimpleGrid cols={{ base:1, sm:2, md:3 }} spacing="md" mb="xl">
        <InfoCard icon={<IconCode size={18} />} color="indigo" title="Propósito" lines={[
          'Comparar estratégias de aquisição',
          'Responder: financiar ou investir?',
          'Dar clareza a juros e inflação'
        ]} emphasis />
        <InfoCard icon={<IconServerBolt size={18} />} color="grape" title="O que Faz" lines={[
          'Simula fluxos mensais', 'Mostra patrimônio líquido', 'Exibe custos e ROI'
        ]} />
        <InfoCard icon={<IconLockOpen size={18} />} color="cyan" title="Filosofia" lines={[
          'Transparente', 'Educacional', 'Open source em breve'
        ]} />
      </SimpleGrid>

      <Divider label="Tecnologias" labelPosition="center" my="lg" />
      <SimpleGrid cols={{ base:1, sm:2, lg:3 }} spacing="md" mb="xl">
        <InfoCard icon={<IconBrandPython size={18} />} color="yellow" title="Backend (Python)" lines={[
          'FastAPI + Pydantic', 'Conversão de taxas', 'Cálculo mensal determinístico'
        ]} />
        <InfoCard icon={<IconBrandReact size={18} />} color="teal" title="Frontend (React)" lines={[
          'React + TS + Vite', 'Mantine UI/Charts', 'Componentização'
        ]} />
        <InfoCard icon={<IconLayersLinked size={18} />} color="orange" title="Arquitetura" lines={[
            'Inputs estruturados', 'Série temporal gerada', 'Métricas agregadas'
        ]} />
      </SimpleGrid>

      <Card withBorder radius="md" padding="md" shadow="sm" mb="lg">
        <Group align="flex-start" gap="sm">
          <ThemeIcon size={32} radius="md" color="blue" variant="light"><IconUser size={18} /></ThemeIcon>
          <Stack gap={4}>
            <Text fw={600} size="sm">Autor</Text>
            <Text size="xs" c="dimmed">
              Wilson Rocha Lacerda Junior. Criei a <Anchor href="https://github.com/wilsonrljr/sysidentpy" target="_blank" rel="noopener noreferrer">SysIdentPy</Anchor>, mas aqui sou só mais uma pessoa tentando responder (com números) a dúvida existencial imobiliária brasileira: vale chutar o balde e comprar logo ou é melhor respirar fundo, investir e esperar? Se der certo, ótimo. Se der errado, bom... espero que tenha uma reserva de emergência.
            </Text>
            <Group gap={6} wrap="wrap">
              <Badge size="xs" variant="light" color="indigo">Software</Badge>
              <Badge size="xs" variant="light" color="teal">Finanças</Badge>
              <Badge size="xs" variant="light" color="grape">Open Source</Badge>
              <Group gap={4}>
                <Tooltip label="GitHub" withArrow>
                  <ActionIcon size="sm" variant="light" color="gray" component="a" href="https://github.com/wilsonrljr" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                    <IconBrandGithub size={14} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="LinkedIn" withArrow>
                  <ActionIcon size="sm" variant="light" color="blue" component="a" href="https://www.linkedin.com/in/wilsonrljr" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                    <IconBrandLinkedin size={14} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Twitter / X" withArrow>
                  <ActionIcon size="sm" variant="light" color="dark" component="a" href="https://twitter.com/wilsonrljr" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                    <IconBrandX size={14} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="ORCID" withArrow>
                  <ActionIcon size="sm" variant="light" color="lime" component="a" href="https://orcid.org/0000-0002-3263-1152" target="_blank" rel="noopener noreferrer" aria-label="ORCID">
                    <IconId size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
          </Stack>
        </Group>
      </Card>

      <Card withBorder radius="md" padding="md" shadow="sm" mb="lg" style={{ background:'linear-gradient(135deg,var(--mantine-color-dark-3),var(--mantine-color-dark-5))' }}>
        <Group align="flex-start" gap="sm">
          <ThemeIcon size={34} radius="md" color="grape" variant="light"><IconInfoCircle size={18} /></ThemeIcon>
          <Stack gap={4}>
            <Text fw={600} size="sm" c="grape.4">Uso de IA</Text>
            <Text size="xs" c="gray.2" style={{ lineHeight:1.35 }}>
              Grande parte desta aplicação web foi desenvolvida com o auxílio de ferramentas de Inteligência Artificial, utilizadas para apoiar na geração de código, textos e ideias. Todo o conteúdo foi revisado e adaptado antes da disponibilização. Por isso, nada mais justo do que torná-la completamente open source, permitindo que a comunidade colabore, identifique possíveis erros de conceito ou lógica e contribua para seu aprimoramento.
            </Text>
          </Stack>
        </Group>
      </Card>

      <Card withBorder radius="md" padding="md" shadow="sm" mb="xl" style={{ background:'linear-gradient(135deg,var(--mantine-color-dark-6),var(--mantine-color-dark-7))' }}>
        <Group align="flex-start" gap="sm">
          <ThemeIcon size={34} radius="md" color="yellow" variant="light"><IconInfoCircle size={18} /></ThemeIcon>
          <Stack gap={4}>
            <Text fw={600} size="sm" c="yellow.4">Disclaimer</Text>
            <Text size="xs" c="gray.2" style={{ lineHeight:1.35 }}>
              Isto é uma simulação educativa. Nada aqui é recomendação de compra, venda, financiamento ou de como você deve investir seu dinheiro. Os resultados dependem totalmente das premissas inseridas e podem divergir da vida real (taxas, impostos, vacância, custos de manutenção, eventos imprevisíveis etc.). Faça sempre sua própria análise e, se necessário, consulte um profissional qualificado. Use por sua conta e risco.
            </Text>
            <Text size="xs" c="gray.4" style={{ lineHeight:1.3 }}>
              Resumindo: é uma calculadora para reduzir achismo, não um oráculo financeiro.
            </Text>
          </Stack>
        </Group>
      </Card>

      <Text size="10px" c="dimmed" ta="center">Frontend: React + Vite + Mantine · Backend: FastAPI (Python) · © {new Date().getFullYear()}</Text>
    </Container>
  );
}

interface InfoCardProps {
  icon: React.ReactNode;
  title: string;
  lines: string[];
  color: string;
}

interface ExtendedInfoCardProps extends InfoCardProps { emphasis?: boolean }

function InfoCard({ icon, title, lines, color, emphasis }: ExtendedInfoCardProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  // Light mode keeps colorful gradient; dark mode uses neutral dark surfaces for better contrast
  const background = emphasis
    ? (isDark
        ? 'linear-gradient(145deg,var(--mantine-color-dark-6),var(--mantine-color-dark-7))'
        : `linear-gradient(145deg,var(--mantine-color-${color}-0),var(--mantine-color-${color}-1))`)
    : 'var(--mantine-color-body)';
  const overlayGradient = isDark
    ? 'linear-gradient(145deg,var(--mantine-color-dark-5),var(--mantine-color-dark-6))'
    : `linear-gradient(145deg,var(--mantine-color-${color}-1),var(--mantine-color-${color}-2))`;
  return (
    <Card
      withBorder
      radius="md"
      padding="md"
      shadow={emphasis ? 'md' : 'sm'}
      style={{ position: 'relative', overflow: 'hidden', background }}
    >
      {emphasis && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: overlayGradient,
            opacity: isDark ? 0.4 : 0.25,
            pointerEvents: 'none'
          }}
        />
      )}
      <Group align="flex-start" gap="sm" style={{ position: 'relative' }} wrap="nowrap">
        <ThemeIcon size={34} radius="md" variant={emphasis ? 'filled' : 'light'} color={color}>
          {icon}
        </ThemeIcon>
        <Stack gap={4} style={{ flex: 1 }}>
          <Text fw={600} size="sm" c={emphasis ? (isDark ? undefined : color) : undefined}>
            {title}
          </Text>
          <Stack gap={2}>
            {lines.map((l) => (
              <Text key={l} size="xs" c={emphasis ? (isDark ? 'dimmed' : undefined) : 'dimmed'} style={{ lineHeight: 1.3 }}>
                {l}
              </Text>
            ))}
          </Stack>
        </Stack>
      </Group>
    </Card>
  );
}
