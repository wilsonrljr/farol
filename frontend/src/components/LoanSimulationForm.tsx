import { useState } from 'react';
import {
  Button,
  NumberInput,
  Select,
  Paper,
  Stack,
  Group,
  Text,
  Box,
  SimpleGrid,
  rem,
  Grid,
  Divider,
  ThemeIcon,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { simulateLoan } from '../api/financeApi';
import { LoanSimulationInput, LoanSimulationResult } from '../api/types';
import { useApi } from '../hooks/useApi';
import AmortizationsFieldArray from './AmortizationsFieldArray';
import { notifications } from '@mantine/notifications';
import LoanResults from './LoanResults';
import {
  IconHome,
  IconPercentage,
  IconCoin,
  IconChartLine,
  IconCalculator,
  IconArrowRight,
  IconArrowLeft,
} from '@tabler/icons-react';
import { FormSection, FormWizard } from './ui/FormWizard';
import { money } from '../utils/format';

export default function LoanSimulationForm() {
  const form = useForm<LoanSimulationInput>({
    initialValues: {
      property_value: 500000,
      down_payment: 100000,
      loan_term_years: 30,
      annual_interest_rate: 10,
      monthly_interest_rate: null,
      loan_type: 'PRICE',
      amortizations: [],
      inflation_rate: 4,
      rent_inflation_rate: null,
      property_appreciation_rate: null,
      additional_costs: {
        itbi_percentage: 2,
        deed_percentage: 1,
        monthly_hoa: 0,
        monthly_property_tax: 0,
      },
    },
  });

  const { data, loading, call } = useApi(simulateLoan);
  const [lastInput, setLastInput] = useState<LoanSimulationInput | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const propertyValue = Number(form.values.property_value || 0);
  const downPayment = Number(form.values.down_payment || 0);
  const loanAmount = Math.max(0, propertyValue - downPayment);
  const downPaymentPct = propertyValue > 0 ? (downPayment / propertyValue) * 100 : 0;

  async function onSubmit(values: LoanSimulationInput) {
    try {
      setLastInput(values);
      const res = await call(values);
      notifications.show({
        title: 'Simulação concluída',
        message: 'Resultados disponíveis abaixo',
        color: 'sage',
      });
      return res;
    } catch (e: unknown) {
      notifications.show({
        title: 'Erro',
        message: String(e),
        color: 'red',
      });
    }
  }

  return (
    <Stack gap="xl">
      {/* Form */}
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Grid gutter="xl" align="flex-start">
          <Grid.Col span={{ base: 12, md: 8 }}>
            <FormWizard
              active={activeStep}
              onStepClick={setActiveStep}
              steps={[
                { label: 'Imóvel', description: 'Valor e entrada', icon: <IconHome size={16} /> },
                { label: 'Financiamento', description: 'Prazo e taxa', icon: <IconPercentage size={16} /> },
                { label: 'Custos', description: 'ITBI, escritura, mensal', icon: <IconCoin size={16} /> },
                { label: 'Extras', description: 'Inflação e amortizações', icon: <IconCalculator size={16} /> },
              ]}
            >
              {activeStep === 0 && (
                <FormSection
                  title="Dados do imóvel"
                  description="Comece pelo essencial. O resumo à direita ajuda a validar se faz sentido."
                  icon={<IconHome size={20} />}
                >
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <NumberInput
                      label="Valor do imóvel"
                      description="Preço total do imóvel"
                      placeholder="R$ 500.000"
                      min={0}
                      required
                      thousandSeparator="."
                      decimalSeparator=","
                      prefix="R$ "
                      {...form.getInputProps('property_value')}
                    />
                    <NumberInput
                      label="Entrada"
                      description="Valor pago à vista"
                      placeholder="R$ 100.000"
                      min={0}
                      required
                      thousandSeparator="."
                      decimalSeparator=","
                      prefix="R$ "
                      {...form.getInputProps('down_payment')}
                    />
                  </SimpleGrid>
                </FormSection>
              )}

              {activeStep === 1 && (
                <FormSection
                  title="Condições do financiamento"
                  description="Informe o sistema, prazo e a taxa (anual ou mensal)."
                  icon={<IconPercentage size={20} />}
                >
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <NumberInput
                      label="Prazo (anos)"
                      description="Duração do financiamento"
                      placeholder="30"
                      min={1}
                      max={35}
                      required
                      {...form.getInputProps('loan_term_years')}
                    />
                    <Select
                      label="Sistema de amortização"
                      description="SAC (parcelas decrescentes) ou PRICE (fixas)"
                      data={[
                        { value: 'SAC', label: 'SAC - Parcelas decrescentes' },
                        { value: 'PRICE', label: 'PRICE - Parcelas fixas' },
                      ]}
                      {...form.getInputProps('loan_type')}
                    />
                    <NumberInput
                      label="Taxa anual"
                      description="Ex: 10% ao ano"
                      placeholder="10"
                      suffix=" % a.a."
                      decimalScale={2}
                      {...form.getInputProps('annual_interest_rate')}
                    />
                    <NumberInput
                      label="Taxa mensal"
                      description="Alternativa à taxa anual"
                      placeholder="0.83"
                      suffix=" % a.m."
                      decimalScale={4}
                      {...form.getInputProps('monthly_interest_rate')}
                    />
                  </SimpleGrid>
                  <Text size="xs" c="sage.6" mt="sm">
                    Informe apenas uma das taxas. A outra será calculada automaticamente.
                  </Text>
                </FormSection>
              )}

              {activeStep === 2 && (
                <FormSection
                  title="Custos adicionais"
                  description="Custos de compra e custos mensais do imóvel."
                  icon={<IconCoin size={20} />}
                >
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <NumberInput
                      label="ITBI"
                      description="Imposto sobre transmissão"
                      placeholder="2"
                      suffix=" %"
                      decimalScale={2}
                      {...form.getInputProps('additional_costs.itbi_percentage')}
                    />
                    <NumberInput
                      label="Escritura"
                      description="Custos cartorários"
                      placeholder="1"
                      suffix=" %"
                      decimalScale={2}
                      {...form.getInputProps('additional_costs.deed_percentage')}
                    />
                    <NumberInput
                      label="Condomínio"
                      description="Mensalidade do condomínio"
                      placeholder="R$ 800"
                      thousandSeparator="."
                      decimalSeparator=","
                      prefix="R$ "
                      {...form.getInputProps('additional_costs.monthly_hoa')}
                    />
                    <NumberInput
                      label="IPTU"
                      description="Valor mensal do IPTU"
                      placeholder="R$ 300"
                      thousandSeparator="."
                      decimalSeparator=","
                      prefix="R$ "
                      {...form.getInputProps('additional_costs.monthly_property_tax')}
                    />
                  </SimpleGrid>
                </FormSection>
              )}

              {activeStep === 3 && (
                <FormSection
                  title="Extras (opcional)"
                  description="Refina a simulação com inflação, valorização e amortizações extras."
                  icon={<IconCalculator size={20} />}
                >
                  <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                    <NumberInput
                      label="Inflação geral"
                      description="IPCA anual estimado"
                      placeholder="4"
                      suffix=" % a.a."
                      decimalScale={2}
                      {...form.getInputProps('inflation_rate')}
                    />
                    <NumberInput
                      label="Inflação do aluguel"
                      description="Reajuste anual do aluguel"
                      placeholder="4"
                      suffix=" % a.a."
                      decimalScale={2}
                      {...form.getInputProps('rent_inflation_rate')}
                    />
                    <NumberInput
                      label="Valorização do imóvel"
                      description="Apreciação anual"
                      placeholder="3"
                      suffix=" % a.a."
                      decimalScale={2}
                      {...form.getInputProps('property_appreciation_rate')}
                    />
                  </SimpleGrid>

                  <Divider my="lg" color="sage.2" />

                  <Text fw={600} size="sm" c="sage.8" mb="xs">
                    Amortizações extras
                  </Text>
                  <Text size="sm" c="sage.6" mb="md">
                    Use para simular pagamentos extraordinários ao longo do tempo.
                  </Text>
                  <AmortizationsFieldArray
                    termMonths={(form.values.loan_term_years || 0) * 12}
                    inflationRate={form.values.inflation_rate as number | null}
                    value={form.values.amortizations || []}
                    onChange={(v: any) => form.setFieldValue('amortizations', v)}
                  />

                  <Divider my="lg" color="sage.2" />

                  <Button
                    type="submit"
                    loading={loading}
                    size="lg"
                    radius="lg"
                    fullWidth
                    leftSection={<IconCalculator size={18} />}
                    style={{
                      height: rem(52),
                      fontSize: rem(15),
                      fontWeight: 600,
                    }}
                  >
                    Simular financiamento
                  </Button>
                </FormSection>
              )}

              <Group justify="space-between" mt="md">
                <Button
                  variant="default"
                  leftSection={<IconArrowLeft size={16} />}
                  disabled={activeStep === 0}
                  onClick={() => setActiveStep((s: number) => Math.max(0, s - 1))}
                >
                  Voltar
                </Button>
                <Button
                  rightSection={<IconArrowRight size={16} />}
                  disabled={activeStep === 3}
                  onClick={() => setActiveStep((s: number) => Math.min(3, s + 1))}
                >
                  Próximo
                </Button>
              </Group>
            </FormWizard>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <Paper
              p="lg"
              radius="xl"
              style={{
                border: '1px solid var(--mantine-color-sage-2)',
                position: 'sticky',
                top: rem(92),
              }}
            >
              <Group gap="sm" mb="md">
                <ThemeIcon size={36} radius="lg" variant="light" color="sage">
                  <IconChartLine size={18} />
                </ThemeIcon>
                <Box>
                  <Text fw={600} c="sage.9">
                    Resumo
                  </Text>
                  <Text size="xs" c="sage.6">
                    Checagem rápida dos números
                  </Text>
                </Box>
              </Group>

              <Stack gap={10}>
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm" c="sage.6">
                    Valor do imóvel
                  </Text>
                  <Text size="sm" fw={600} c="sage.9">
                    {money(propertyValue)}
                  </Text>
                </Group>
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm" c="sage.6">
                    Entrada
                  </Text>
                  <Text size="sm" fw={600} c="sage.9">
                    {money(downPayment)}
                  </Text>
                </Group>
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm" c="sage.6">
                    Entrada (% do imóvel)
                  </Text>
                  <Text size="sm" fw={600} c="sage.9">
                    {Number.isFinite(downPaymentPct) ? `${downPaymentPct.toFixed(1)}%` : '—'}
                  </Text>
                </Group>
                <Divider my={4} color="sage.2" />
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm" c="sage.6">
                    Valor financiado
                  </Text>
                  <Text size="sm" fw={700} c="sage.9">
                    {money(loanAmount)}
                  </Text>
                </Group>
                <Text size="xs" c="sage.6">
                  Dica: se a entrada estiver muito baixa, o valor financiado pode ficar agressivo.
                </Text>
              </Stack>
            </Paper>
          </Grid.Col>
        </Grid>
      </form>

      {/* Results Section */}
      {data ? (
        <Box>
          <Group gap="sm" mb="lg">
            <Box
              p="sm"
              style={{
                backgroundColor: 'var(--mantine-color-sage-1)',
                borderRadius: 'var(--mantine-radius-md)',
              }}
            >
              <IconChartLine size={20} style={{ color: 'var(--mantine-color-sage-7)' }} />
            </Box>
            <div>
              <Text fw={600} size="lg" c="sage.8">
                Resultado da Simulação
              </Text>
              <Text size="sm" c="sage.5">
                Análise detalhada do seu financiamento
              </Text>
            </div>
          </Group>
          <LoanResults
            result={data as LoanSimulationResult}
            inputPayload={lastInput || undefined}
          />
        </Box>
      ) : (
        <Paper
          p="xl"
          radius="lg"
          ta="center"
          style={{
            border: '2px dashed var(--mantine-color-sage-2)',
            backgroundColor: 'var(--mantine-color-sage-0)',
          }}
        >
          <Stack gap="md" align="center">
            <Box
              p="lg"
              style={{
                backgroundColor: 'var(--mantine-color-sage-1)',
                borderRadius: 'var(--mantine-radius-xl)',
              }}
            >
              <IconCalculator size={32} style={{ color: 'var(--mantine-color-sage-8)' }} />
            </Box>
            <div>
              <Text fw={600} c="sage.8">
                Preencha os dados acima
              </Text>
              <Text size="sm" c="sage.5" maw={400}>
                Configure os parâmetros do financiamento e clique em "Simular" para ver os
                resultados detalhados com gráficos e tabelas.
              </Text>
            </div>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
