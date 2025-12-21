import { Container, Title, Text, Box, rem, Stack, Group, ThemeIcon, SimpleGrid, Paper, Badge } from '@mantine/core';
import ComparisonForm from '../components/ComparisonForm';
import { IconScale, IconBuildingBank, IconChartLine, IconPigMoney } from '@tabler/icons-react';

export default function ScenarioComparison() {
  return (
    <Box>
      {/* Header Section */}
      <Box
        py={{ base: 40, md: 60 }}
        style={{
          borderBottom: '1px solid var(--mantine-color-default-border)',
          background: 'light-dark(linear-gradient(180deg, var(--mantine-color-sage-0) 0%, var(--mantine-color-cream-0) 100%), linear-gradient(180deg, var(--mantine-color-dark-8) 0%, var(--mantine-color-dark-9) 100%))',
        }}
      >
        <Container size="lg">
          <Stack gap="md" align="center" ta="center">
            <Badge size="lg" variant="light" color="sage" radius="sm">
              Comparador de Cenários
            </Badge>
            <ThemeIcon 
              size={64} 
              radius="xl" 
              variant="gradient"
              gradient={{ from: 'sage.5', to: 'sage.7', deg: 135 }}
            >
              <IconScale size={32} />
            </ThemeIcon>
            <Title order={1} fw={700} c="light-dark(var(--mantine-color-sage-8), var(--mantine-color-text))">
              Comparação de Cenários
            </Title>
            <Text size="lg" c="dimmed" maw={600}>
              Analise e compare três estratégias de aquisição imobiliária para descobrir
              qual é a melhor opção para o seu perfil.
            </Text>
          </Stack>

          {/* Quick info cards */}
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg" mt="xl">
            <Paper
              p="md"
              radius="xl"
              style={{
                backgroundColor: 'var(--mantine-color-body)',
                border: '1px solid var(--mantine-color-default-border)',
              }}
            >
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon size={40} radius="xl" variant="light" color="sage">
                  <IconBuildingBank size={20} />
                </ThemeIcon>
                <Box>
                  <Text fw={600} size="sm" c="light-dark(var(--mantine-color-sage-8), var(--mantine-color-text))">
                    Comprar Financiado
                  </Text>
                  <Text size="xs" c="dimmed">
                    Financiamento SAC ou PRICE
                  </Text>
                </Box>
              </Group>
            </Paper>
            <Paper
              p="md"
              radius="xl"
              style={{
                backgroundColor: 'var(--mantine-color-body)',
                border: '1px solid var(--mantine-color-default-border)',
              }}
            >
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon size={40} radius="xl" variant="light" color="sage">
                  <IconChartLine size={20} />
                </ThemeIcon>
                <Box>
                  <Text fw={600} size="sm" c="light-dark(var(--mantine-color-sage-8), var(--mantine-color-text))">
                    Alugar e Investir
                  </Text>
                  <Text size="xs" c="dimmed">
                    Investir a entrada
                  </Text>
                </Box>
              </Group>
            </Paper>
            <Paper
              p="md"
              radius="xl"
              style={{
                backgroundColor: 'var(--mantine-color-body)',
                border: '1px solid var(--mantine-color-default-border)',
              }}
            >
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon size={40} radius="xl" variant="light" color="sage">
                  <IconPigMoney size={20} />
                </ThemeIcon>
                <Box>
                  <Text fw={600} size="sm" c="light-dark(var(--mantine-color-sage-8), var(--mantine-color-text))">
                    Investir e Comprar
                  </Text>
                  <Text size="xs" c="dimmed">
                    Juntar para comprar à vista
                  </Text>
                </Box>
              </Group>
            </Paper>
          </SimpleGrid>
        </Container>
      </Box>

      {/* Form Section */}
      <Container size="lg" py={{ base: 40, md: 60 }}>
        <ComparisonForm />
      </Container>
    </Box>
  );
}
