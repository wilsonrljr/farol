import { Container, Title, Text, Box, Stack, Group, ThemeIcon, SimpleGrid, Paper, Badge } from '@mantine/core';
import LoanSimulationForm from '../components/LoanSimulationForm';
import { IconCalculator, IconChartBar, IconCoin, IconReceipt } from '@tabler/icons-react';

export default function LoanSimulation() {
  return (
    <Box>
      {/* Header Section */}
      <Box
        py={{ base: 40, md: 60 }}
        style={{
          borderBottom: '1px solid var(--mantine-color-sage-2)',
          background: 'linear-gradient(180deg, var(--mantine-color-sage-0) 0%, var(--mantine-color-cream-0) 100%)',
        }}
      >
        <Container size="lg">
          <Stack gap="md" align="center" ta="center">
            <Badge size="lg" variant="light" color="sage" radius="sm">
              Simulador de Financiamento
            </Badge>
            <ThemeIcon 
              size={64} 
              radius="xl" 
              variant="gradient"
              gradient={{ from: 'sage.5', to: 'sage.7', deg: 135 }}
            >
              <IconCalculator size={32} />
            </ThemeIcon>
            <Title order={1} fw={700} c="sage.8">
              Simulação de Financiamento
            </Title>
            <Text size="lg" c="neutral.6" maw={600}>
              Simule seu financiamento imobiliário com sistemas SAC ou PRICE,
              incluindo amortizações extras e custos adicionais.
            </Text>
          </Stack>

          {/* Quick info cards */}
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg" mt="xl">
            <Paper
              p="md"
              radius="xl"
              style={{
                backgroundColor: 'var(--mantine-color-body)',
                border: '1px solid var(--mantine-color-sage-2)',
              }}
            >
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon size={40} radius="xl" variant="light" color="sage">
                  <IconChartBar size={20} />
                </ThemeIcon>
                <Box>
                  <Text fw={600} size="sm" c="sage.8">
                    SAC
                  </Text>
                  <Text size="xs" c="neutral.5">
                    Parcelas decrescentes
                  </Text>
                </Box>
              </Group>
            </Paper>
            <Paper
              p="md"
              radius="xl"
              style={{
                backgroundColor: 'var(--mantine-color-body)',
                border: '1px solid var(--mantine-color-sage-2)',
              }}
            >
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon size={40} radius="xl" variant="light" color="sage">
                  <IconChartBar size={20} />
                </ThemeIcon>
                <Box>
                  <Text fw={600} size="sm" c="sage.8">
                    PRICE
                  </Text>
                  <Text size="xs" c="neutral.5">
                    Parcelas fixas
                  </Text>
                </Box>
              </Group>
            </Paper>
            <Paper
              p="md"
              radius="xl"
              style={{
                backgroundColor: 'var(--mantine-color-body)',
                border: '1px solid var(--mantine-color-sage-2)',
              }}
            >
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon size={40} radius="xl" variant="light" color="sage">
                  <IconCoin size={20} />
                </ThemeIcon>
                <Box>
                  <Text fw={600} size="sm" c="sage.8">
                    Amortizações
                  </Text>
                  <Text size="xs" c="neutral.5">
                    Pagamentos extras
                  </Text>
                </Box>
              </Group>
            </Paper>
            <Paper
              p="md"
              radius="xl"
              style={{
                backgroundColor: 'var(--mantine-color-body)',
                border: '1px solid var(--mantine-color-sage-2)',
              }}
            >
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon size={40} radius="xl" variant="light" color="sage">
                  <IconReceipt size={20} />
                </ThemeIcon>
                <Box>
                  <Text fw={600} size="sm" c="sage.8">
                    Custos
                  </Text>
                  <Text size="xs" c="neutral.5">
                    ITBI, escritura, etc.
                  </Text>
                </Box>
              </Group>
            </Paper>
          </SimpleGrid>
        </Container>
      </Box>

      {/* Form Section */}
      <Container size="lg" py={{ base: 40, md: 60 }}>
        <LoanSimulationForm />
      </Container>
    </Box>
  );
}
