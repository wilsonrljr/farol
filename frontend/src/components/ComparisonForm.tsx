import { useState } from "react";
import {
  Button,
  NumberInput,
  Select,
  Paper,
  Stack,
  Group,
  Checkbox,
  Text,
  Box,
  rem,
  ThemeIcon,
  Tooltip,
  SimpleGrid,
  Divider,
  Tabs,
  Grid,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { compareScenarios } from "../api/financeApi";
import { ComparisonInput, EnhancedComparisonResult } from "../api/types";
import { useApi } from "../hooks/useApi";
import AmortizationsFieldArray from "./AmortizationsFieldArray";
import InvestmentReturnsFieldArray from "./InvestmentReturnsFieldArray";
import { notifications } from "@mantine/notifications";
import EnhancedComparisonResults from "./EnhancedComparisonResults";
import {
  IconBuildingBank,
  IconChartLine,
  IconHome2,
  IconPercentage,
  IconCash,
  IconSettings,
  IconPigMoney,
  IconReceipt,
  IconScale,
  IconArrowRight,
} from "@tabler/icons-react";
import { LabelWithHelp } from "./LabelWithHelp";
import { FormSection, FormWizard } from "./ui/FormWizard";
import { money } from "../utils/format";

export default function ComparisonForm() {
  const form = useForm<ComparisonInput>({
    initialValues: {
      property_value: 500000,
      down_payment: 100000,
      total_savings: null,
      loan_term_years: 30,
      annual_interest_rate: 10,
      monthly_interest_rate: null,
      loan_type: "PRICE",
      rent_value: 2000,
      rent_percentage: null,
      investment_returns: [{ start_month: 1, end_month: null, annual_rate: 8 }],
      amortizations: [],
      inflation_rate: 4,
      rent_inflation_rate: 5,
      property_appreciation_rate: 4,
      invest_loan_difference: false,
      fixed_monthly_investment: 0,
      fixed_investment_start_month: 1,
      rent_reduces_investment: false,
      monthly_external_savings: 0,
      invest_external_surplus: false,
      fgts: {
        initial_balance: 0,
        monthly_contribution: 0,
        annual_yield_rate: 0,
        use_at_purchase: true,
        max_withdrawal_at_purchase: null,
      },
      investment_tax: {
        enabled: false,
        effective_tax_rate: 15,
      },
    },
  });

  const { data, loading, call } = useApi<
    [ComparisonInput, boolean],
    EnhancedComparisonResult
  >(
    async (input: ComparisonInput, enhanced: boolean) =>
      compareScenarios(input, enhanced) as Promise<EnhancedComparisonResult>,
  );
  const [lastInput, setLastInput] = useState<ComparisonInput | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const propertyValue = Number(form.values.property_value || 0);
  const downPayment = Number(form.values.down_payment || 0);
  const totalSavings = Number(form.values.total_savings || 0);
  const initialInvestment = totalSavings > 0 ? Math.max(0, totalSavings - downPayment) : 0;
  const loanAmount = Math.max(0, propertyValue - downPayment);
  const downPaymentPct =
    propertyValue > 0 ? (downPayment / propertyValue) * 100 : 0;
  const rentValue = Number(form.values.rent_value || 0);

  async function onSubmit(values: ComparisonInput) {
    try {
      setLastInput(values);
      const res = await call(values, true);
      notifications.show({
        title: "Análise concluída",
        message: "Os resultados estão prontos abaixo",
        color: "sage",
      });
      // Scroll to results
      setTimeout(() => {
        document
          .getElementById("results-section")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
      return res;
    } catch (e: any) {
      notifications.show({
        title: "Erro",
        message: e.toString(),
        color: "red",
      });
    }
  }

  return (
    <Stack gap="xl">
      {/* Quick Summary Card */}
      <Paper
        p="lg"
        radius="xl"
        style={{
          border: "1px solid var(--mantine-color-sage-2)",
          backgroundColor: "var(--mantine-color-sage-0)",
        }}
      >
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="lg">
          <Group gap="sm">
            <ThemeIcon size={36} radius="lg" variant="light" color="sage">
              <IconChartLine size={18} />
            </ThemeIcon>
            <Box>
              <Text fw={600} c="sage.9">
                Resumo da comparação
              </Text>
              <Text size="xs" c="sage.6">
                O que você está comparando
              </Text>
            </Box>
          </Group>
          <Group gap="xl" wrap="wrap">
            <Box ta="center">
              <Text size="xs" c="sage.6" tt="uppercase" fw={500}>
                Valor do imóvel
              </Text>
              <Text size="lg" fw={700} c="sage.9">
                {money(propertyValue)}
              </Text>
            </Box>
            <Box ta="center">
              <Text size="xs" c="sage.6" tt="uppercase" fw={500}>
                Entrada
              </Text>
              <Text size="lg" fw={700} c="sage.9">
                {money(downPayment)} ({downPaymentPct.toFixed(0)}%)
              </Text>
            </Box>
            <Box ta="center">
              <Text size="xs" c="sage.6" tt="uppercase" fw={500}>
                Valor financiado
              </Text>
              <Text size="lg" fw={700} c="sage.9">
                {money(loanAmount)}
              </Text>
            </Box>
            {initialInvestment > 0 && (
              <Box ta="center">
                <Text size="xs" c="sage.6" tt="uppercase" fw={500}>
                  Capital para investir
                </Text>
                <Text size="lg" fw={700} c="sage.9">
                  {money(initialInvestment)}
                </Text>
              </Box>
            )}
            <Box ta="center">
              <Text size="xs" c="sage.6" tt="uppercase" fw={500}>
                Aluguel mensal
              </Text>
              <Text size="lg" fw={700} c="sage.9">
                {money(rentValue)}
              </Text>
            </Box>
          </Group>
        </Group>
      </Paper>

      {/* Form Section */}
      <form onSubmit={form.onSubmit(onSubmit)}>
        <FormWizard
          active={activeStep}
          onStepClick={setActiveStep}
          steps={[
            {
              label: "Imóvel",
              description: "Entrada e prazo",
              icon: <IconHome2 size={16} />,
            },
            {
              label: "Taxa",
              description: "Anual ou mensal",
              icon: <IconPercentage size={16} />,
            },
            {
              label: "Aluguel",
              description: "Retornos e aluguel",
              icon: <IconChartLine size={16} />,
            },
            {
              label: "Ajustes",
              description: "Opcional",
              icon: <IconSettings size={16} />,
            },
          ]}
        >
          {activeStep === 0 && (
            <FormSection
              title="Imóvel e financiamento"
              description="Defina o valor, entrada e o tipo de amortização."
              icon={<IconHome2 size={20} />}
            >
              <Grid gutter="lg">
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <NumberInput
                    label="Valor do imóvel"
                    description="Preço total do imóvel"
                    placeholder="R$ 500.000"
                    min={0}
                    required
                    {...form.getInputProps("property_value")}
                    thousandSeparator="."
                    decimalSeparator=","
                    prefix="R$ "
                    size="md"
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <NumberInput
                    label="Entrada"
                    description="Valor que você vai usar de entrada"
                    placeholder="R$ 100.000"
                    min={0}
                    required
                    {...form.getInputProps("down_payment")}
                    thousandSeparator="."
                    decimalSeparator=","
                    prefix="R$ "
                    size="md"
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <NumberInput
                    label="Patrimônio total disponível"
                    description="Valor total que você tem (entrada + reserva para investir)"
                    placeholder="R$ 150.000"
                    min={0}
                    {...form.getInputProps("total_savings")}
                    thousandSeparator="."
                    decimalSeparator=","
                    prefix="R$ "
                    size="md"
                    error={
                      totalSavings > 0 && totalSavings < downPayment
                        ? "Deve ser maior ou igual à entrada"
                        : undefined
                    }
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <NumberInput
                    label="Prazo do financiamento"
                    description="Duração em anos"
                    placeholder="30"
                    min={1}
                    max={35}
                    required
                    {...form.getInputProps("loan_term_years")}
                    suffix=" anos"
                    size="md"
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Select
                    label="Sistema de amortização"
                    description="SAC (parcelas decrescentes) ou PRICE (fixas)"
                    data={[
                      { value: "SAC", label: "SAC - Parcelas decrescentes" },
                      { value: "PRICE", label: "PRICE - Parcelas fixas" },
                    ]}
                    {...form.getInputProps("loan_type")}
                    size="md"
                  />
                </Grid.Col>
              </Grid>
            </FormSection>
          )}

          {activeStep === 1 && (
            <FormSection
              title="Taxa de juros"
              description="Informe a taxa anual ou mensal (apenas uma delas)."
              icon={<IconPercentage size={20} />}
            >
              <Grid gutter="lg">
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <NumberInput
                    label="Taxa anual"
                    description="CET ou taxa nominal anual"
                    placeholder="10"
                    {...form.getInputProps("annual_interest_rate")}
                    suffix="% a.a."
                    decimalScale={2}
                    size="md"
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <NumberInput
                    label="Taxa mensal"
                    description="Alternativa à taxa anual"
                    placeholder="0,8"
                    {...form.getInputProps("monthly_interest_rate")}
                    suffix="% a.m."
                    decimalScale={4}
                    size="md"
                  />
                </Grid.Col>
              </Grid>
              <Text size="xs" c="sage.6" mt="sm">
                Informe apenas uma das taxas. A outra será calculada
                automaticamente.
              </Text>
            </FormSection>
          )}

          {activeStep === 2 && (
            <FormSection
              title="Aluguel e retornos"
              description="Define o aluguel e como o investimento rende ao longo do tempo."
              icon={<IconChartLine size={20} />}
            >
              <Grid gutter="lg">
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <NumberInput
                    label="Valor do aluguel"
                    description="Aluguel mensal de imóvel equivalente"
                    placeholder="R$ 2.000"
                    {...form.getInputProps("rent_value")}
                    thousandSeparator="."
                    decimalSeparator=","
                    prefix="R$ "
                    size="md"
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <NumberInput
                    label="Aluguel como % do valor"
                    description="Alternativa ao valor fixo"
                    placeholder="0,4"
                    {...form.getInputProps("rent_percentage")}
                    suffix="%"
                    decimalScale={2}
                    size="md"
                  />
                </Grid.Col>
              </Grid>

              <Divider my="lg" color="sage.2" />

              <Text fw={600} size="sm" mb="sm" c="sage.8">
                Retornos de investimento
              </Text>
              <InvestmentReturnsFieldArray
                value={form.values.investment_returns}
                onChange={(v: any) =>
                  form.setFieldValue("investment_returns", v)
                }
              />
            </FormSection>
          )}

          {activeStep === 3 && (
            <FormSection
              title="Ajustes (opcional)"
              description="Refina a simulação com hipóteses e regras adicionais."
              icon={<IconSettings size={20} />}
            >
              <Tabs defaultValue="inflacao" variant="pills" color="sage">
                <Tabs.List>
                  <Tabs.Tab
                    value="inflacao"
                    leftSection={<IconBuildingBank size={16} />}
                  >
                    Inflação
                  </Tabs.Tab>
                  <Tabs.Tab
                    value="estrategia"
                    leftSection={<IconCash size={16} />}
                  >
                    Estratégia
                  </Tabs.Tab>
                  <Tabs.Tab
                    value="fgts"
                    leftSection={<IconPigMoney size={16} />}
                  >
                    FGTS
                  </Tabs.Tab>
                  <Tabs.Tab
                    value="tributacao"
                    leftSection={<IconReceipt size={16} />}
                  >
                    Tributação
                  </Tabs.Tab>
                  <Tabs.Tab
                    value="amortizacoes"
                    leftSection={<IconScale size={16} />}
                  >
                    Amortizações
                  </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="inflacao" pt="md">
                  <Grid gutter="lg">
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <LabelWithHelp
                        label="Inflação geral"
                        help="Taxa anual média usada para atualizar custos ao longo do tempo."
                      />
                      <NumberInput
                        mt={4}
                        placeholder="4"
                        {...form.getInputProps("inflation_rate")}
                        suffix="% a.a."
                        size="md"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <LabelWithHelp
                        label="Inflação do aluguel"
                        help="Reajuste anual do aluguel. Use se diferente da inflação geral."
                      />
                      <NumberInput
                        mt={4}
                        placeholder="5"
                        {...form.getInputProps("rent_inflation_rate")}
                        suffix="% a.a."
                        size="md"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <LabelWithHelp
                        label="Valorização do imóvel"
                        help="Estimativa anual de valorização do imóvel no mercado."
                      />
                      <NumberInput
                        mt={4}
                        placeholder="4"
                        {...form.getInputProps("property_appreciation_rate")}
                        suffix="% a.a."
                        size="md"
                      />
                    </Grid.Col>
                  </Grid>
                </Tabs.Panel>

                <Tabs.Panel value="estrategia" pt="md">
                  <Stack gap="md">
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                      <Checkbox
                        label="Investir diferença de parcela vs aluguel"
                        description="Se a parcela for maior que o aluguel, investe a diferença"
                        {...form.getInputProps("invest_loan_difference", {
                          type: "checkbox",
                        })}
                      />
                      <Tooltip
                        label="Se marcado, aluguel e custos mensais são pagos do saldo investido"
                        multiline
                        w={280}
                        withArrow
                      >
                        <Checkbox
                          label="Aluguel consome investimento"
                          description="Paga aluguel retirando dos investimentos"
                          {...form.getInputProps("rent_reduces_investment", {
                            type: "checkbox",
                          })}
                        />
                      </Tooltip>
                    </SimpleGrid>

                    <Divider color="sage.2" />

                    <Grid gutter="lg">
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <LabelWithHelp
                          label="Renda externa para custos"
                          help="Valor mensal externo usado para pagar aluguel e custos antes de usar investimentos."
                        />
                        <NumberInput
                          mt={4}
                          placeholder="R$ 0"
                          {...form.getInputProps("monthly_external_savings")}
                          thousandSeparator="."
                          decimalSeparator=","
                          prefix="R$ "
                          min={0}
                          size="md"
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <LabelWithHelp
                          label="Investir sobra externa"
                          help="Se houver sobra da renda externa após custos, investe automaticamente."
                        />
                        <Box mt={12}>
                          <Checkbox
                            label="Sim, investir sobra"
                            {...form.getInputProps("invest_external_surplus", {
                              type: "checkbox",
                            })}
                          />
                        </Box>
                      </Grid.Col>
                    </Grid>

                    <Divider color="sage.2" />

                    <Grid gutter="lg">
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <NumberInput
                          label="Aporte mensal fixo"
                          description="Valor fixo investido todo mês"
                          placeholder="R$ 0"
                          {...form.getInputProps("fixed_monthly_investment")}
                          thousandSeparator="."
                          decimalSeparator=","
                          prefix="R$ "
                          size="md"
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <NumberInput
                          label="Início do aporte"
                          description="Mês em que começam os aportes"
                          placeholder="1"
                          {...form.getInputProps(
                            "fixed_investment_start_month",
                          )}
                          suffix="º mês"
                          min={1}
                          size="md"
                        />
                      </Grid.Col>
                    </Grid>
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="fgts" pt="md">
                  <Grid gutter="lg">
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="Saldo FGTS"
                        description="Saldo disponível para uso"
                        placeholder="R$ 0"
                        {...form.getInputProps("fgts.initial_balance")}
                        thousandSeparator="."
                        decimalSeparator=","
                        prefix="R$ "
                        min={0}
                        size="md"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="Aporte mensal FGTS"
                        description="Depósito mensal no FGTS"
                        placeholder="R$ 0"
                        {...form.getInputProps("fgts.monthly_contribution")}
                        thousandSeparator="."
                        decimalSeparator=","
                        prefix="R$ "
                        min={0}
                        size="md"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="Rendimento FGTS"
                        description="Taxa anual de rendimento"
                        placeholder="3"
                        {...form.getInputProps("fgts.annual_yield_rate")}
                        suffix="% a.a."
                        min={0}
                        size="md"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="Limite de saque"
                        description="Máximo a usar na compra (opcional)"
                        placeholder="Sem limite"
                        {...form.getInputProps(
                          "fgts.max_withdrawal_at_purchase",
                        )}
                        thousandSeparator="."
                        decimalSeparator=","
                        prefix="R$ "
                        min={0}
                        size="md"
                      />
                    </Grid.Col>
                  </Grid>
                  <Checkbox
                    mt="lg"
                    label="Usar FGTS na compra do imóvel"
                    {...form.getInputProps("fgts.use_at_purchase", {
                      type: "checkbox",
                    })}
                  />
                </Tabs.Panel>

                <Tabs.Panel value="tributacao" pt="md">
                  <Grid gutter="lg" align="flex-end">
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Checkbox
                        label="Aplicar imposto sobre rendimentos"
                        description="Aproximação simples sobre ganhos mensais"
                        {...form.getInputProps("investment_tax.enabled", {
                          type: "checkbox",
                        })}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="Alíquota efetiva"
                        description="Percentual sobre rendimentos"
                        placeholder="15"
                        {...form.getInputProps(
                          "investment_tax.effective_tax_rate",
                        )}
                        suffix="%"
                        min={0}
                        max={100}
                        disabled={!form.values.investment_tax?.enabled}
                        size="md"
                      />
                    </Grid.Col>
                  </Grid>
                  <Text size="xs" c="sage.6" mt="md">
                    Esta é uma aproximação. O IR real depende do tipo de
                    investimento e prazo.
                  </Text>
                </Tabs.Panel>

                <Tabs.Panel value="amortizacoes" pt="md">
                  <AmortizationsFieldArray
                    value={form.values.amortizations || []}
                    onChange={(v: any) =>
                      form.setFieldValue("amortizations", v)
                    }
                    inflationRate={form.values.inflation_rate || undefined}
                    termMonths={form.values.loan_term_years * 12}
                  />
                </Tabs.Panel>
              </Tabs>

              <Divider my="lg" color="sage.2" />

              <Button
                type="submit"
                loading={loading}
                size="lg"
                radius="lg"
                fullWidth
                rightSection={<IconArrowRight size={18} />}
                style={{
                  height: rem(52),
                  fontSize: rem(15),
                  fontWeight: 600,
                }}
              >
                Comparar cenários
              </Button>
            </FormSection>
          )}
        </FormWizard>
      </form>

      {/* Results Section */}
      {data && (
        <Box id="results-section" pt="xl">
          <EnhancedComparisonResults
            result={data}
            inputPayload={lastInput || undefined}
          />
        </Box>
      )}
    </Stack>
  );
}
