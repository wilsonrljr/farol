import { useState, useRef } from "react";
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
import { compareScenarios, compareScenariosBatch } from "../api/financeApi";
import { ComparisonInput, EnhancedComparisonResult, BatchComparisonResult, BatchComparisonItem } from "../api/types";
import { useApi } from "../hooks/useApi";
import { usePresets } from "../hooks/usePresets";
import AmortizationsFieldArray from "./AmortizationsFieldArray";
import InvestmentReturnsFieldArray from "./InvestmentReturnsFieldArray";
import { PresetManager } from "./PresetManager";
import { PresetCompareSelector } from "./PresetCompareSelector";
import BatchComparisonResults from "./BatchComparisonResults";
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
import { Preset } from "../utils/presets";

const PRESETS_STORAGE_KEY = 'farol-comparison-presets';

type ViewMode = 'form' | 'single-result' | 'batch-result';

export default function ComparisonForm() {
  const batchResultsRef = useRef<HTMLDivElement>(null);

  const form = useForm<ComparisonInput>({
    mode: 'controlled',
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
      contributions: [],
      continue_contributions_after_purchase: true,
      additional_costs: {
        itbi_percentage: 2,
        deed_percentage: 1,
        monthly_hoa: 0,
        monthly_property_tax: 0,
      },
      inflation_rate: 4,
      rent_inflation_rate: 5,
      property_appreciation_rate: 4,
      invest_loan_difference: false,
      fixed_monthly_investment: 0,
      fixed_investment_start_month: 1,
      rent_reduces_investment: false,
      monthly_external_savings: null,
      invest_external_surplus: false,
      monthly_net_income: null,
      fgts: {
        initial_balance: 0,
        monthly_contribution: 0,
        annual_yield_rate: 0,
        use_at_purchase: true,
        max_withdrawal_at_purchase: null,
      },
      investment_tax: {
        enabled: false,
        mode: "on_withdrawal",
        effective_tax_rate: 15,
      },
    },
  });

  const { data, loading, call, reset } = useApi<
    [ComparisonInput, boolean],
    EnhancedComparisonResult
  >(
    async (input: ComparisonInput, enhanced: boolean) =>
      compareScenarios(input, enhanced) as Promise<EnhancedComparisonResult>,
  );
  const [lastInput, setLastInput] = useState<ComparisonInput | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  
  // Batch comparison state
  const [viewMode, setViewMode] = useState<ViewMode>('form');
  const [batchResult, setBatchResult] = useState<BatchComparisonResult | null>(null);
  const [batchInputs, setBatchInputs] = useState<ComparisonInput[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  // Presets management
  const presetsManager = usePresets<ComparisonInput>({
    storageKey: PRESETS_STORAGE_KEY,
  });

  const handleLoadPreset = (preset: Preset<ComparisonInput>) => {
    form.setValues(preset.input);
  };

  // Helper to clean input values that would fail backend validation
  const cleanInputForBackend = (input: ComparisonInput): ComparisonInput => {
    const cleaned = { ...input };

    const nullIfEmpty = (v: unknown) => (v === '' ? null : v);

    cleaned.annual_interest_rate = nullIfEmpty(cleaned.annual_interest_rate) as any;
    cleaned.monthly_interest_rate = nullIfEmpty(cleaned.monthly_interest_rate) as any;
    cleaned.rent_value = nullIfEmpty(cleaned.rent_value) as any;
    cleaned.rent_percentage = nullIfEmpty(cleaned.rent_percentage) as any;
    cleaned.inflation_rate = nullIfEmpty(cleaned.inflation_rate) as any;
    cleaned.rent_inflation_rate = nullIfEmpty(cleaned.rent_inflation_rate) as any;
    cleaned.property_appreciation_rate = nullIfEmpty(cleaned.property_appreciation_rate) as any;
    cleaned.monthly_external_savings = nullIfEmpty(cleaned.monthly_external_savings) as any;
    cleaned.fixed_monthly_investment = nullIfEmpty(cleaned.fixed_monthly_investment) as any;
    cleaned.monthly_net_income = nullIfEmpty(cleaned.monthly_net_income) as any;

    // Enforce mutually exclusive fields to avoid "I changed X but nothing happened".
    // Backend accepts both today, but the engine will necessarily pick one, which is confusing UX.
    const annual = cleaned.annual_interest_rate;
    const monthly = cleaned.monthly_interest_rate;
    if (monthly != null && monthly !== 0) {
      cleaned.annual_interest_rate = null;
    } else if (annual != null && annual !== 0) {
      cleaned.monthly_interest_rate = null;
    }

    const rentValue = cleaned.rent_value;
    const rentPct = cleaned.rent_percentage;
    if (rentPct != null && rentPct !== 0) {
      cleaned.rent_value = null;
    } else if (rentValue != null && rentValue !== 0) {
      cleaned.rent_percentage = null;
    }
    
    // If rent_reduces_investment is false, monthly_external_savings must be null
    if (!cleaned.rent_reduces_investment) {
      cleaned.monthly_external_savings = null;
    }
    
    // Convert 0 values to null where appropriate
    if (cleaned.monthly_external_savings === 0) {
      cleaned.monthly_external_savings = null;
    }
    if (cleaned.fixed_monthly_investment === 0) {
      cleaned.fixed_monthly_investment = null;
    }
    if (cleaned.monthly_net_income === 0) {
      cleaned.monthly_net_income = null;
    }

    if (cleaned.annual_interest_rate === 0) cleaned.annual_interest_rate = null;
    if (cleaned.monthly_interest_rate === 0) cleaned.monthly_interest_rate = null;
    if (cleaned.rent_value === 0) cleaned.rent_value = null;
    if (cleaned.rent_percentage === 0) cleaned.rent_percentage = null;
    
    return cleaned;
  };

  const handleBatchCompare = async (selectedPresets: Preset<ComparisonInput>[]) => {
    setBatchLoading(true);
    try {
      const items: BatchComparisonItem[] = selectedPresets.map((preset) => ({
        preset_id: preset.id,
        preset_name: preset.name,
        input: cleanInputForBackend(preset.input),
      }));

      const result = await compareScenariosBatch({ items });
      setBatchResult(result);
      setBatchInputs(selectedPresets.map((p) => cleanInputForBackend(p.input)));
      setViewMode('batch-result');
      
      notifications.show({
        title: "Comparação concluída",
        message: `${selectedPresets.length} presets analisados com sucesso`,
        color: "sage",
      });

      // Scroll to results after a brief delay for DOM update
      setTimeout(() => {
        batchResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (e: any) {
      notifications.show({
        title: "Erro na comparação",
        message: e.toString(),
        color: "red",
      });
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBackFromBatch = () => {
    setViewMode('form');
    setBatchResult(null);
    setBatchInputs([]);
  };

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
      const cleaned = cleanInputForBackend(values);
      // Clear previous results immediately so users don't mistake stale cards as "no change".
      // Also helps when backends have cold starts and older calls return after newer ones.
      reset();
      setLastInput(cleaned);
      const res = await call(cleaned, true);
      setViewMode('single-result');
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
        message: String(e),
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
          border: '1px solid var(--mantine-color-default-border)',
          backgroundColor: 'light-dark(var(--mantine-color-sage-0), var(--mantine-color-dark-8))',
        }}
      >
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="lg">
          <Group gap="sm">
            <ThemeIcon size={36} radius="lg" variant="light" color="sage">
              <IconChartLine size={18} />
            </ThemeIcon>
            <Box>
              <Text fw={600} c="bright">
                Resumo da simulação
              </Text>
              <Text size="xs" c="dimmed">
                O que você está simulando
              </Text>
            </Box>
          </Group>
          <Group gap="xl" wrap="wrap">
            <Box ta="center">
              <Text size="xs" c="sage.6" tt="uppercase" fw={500}>
                Valor do imóvel
              </Text>
              <Text size="lg" fw={700} c="bright">
                {money(propertyValue)}
              </Text>
            </Box>
            <Box ta="center">
              <Text size="xs" c="sage.6" tt="uppercase" fw={500}>
                Entrada
              </Text>
              <Text size="lg" fw={700} c="bright">
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

      {/* Preset Management */}
      <Group justify="space-between" align="center">
        <PresetManager<ComparisonInput>
          presets={presetsManager.presets}
          onSave={(name, description, tags) => presetsManager.addPreset(name, form.values, description, tags)}
          onLoad={handleLoadPreset}
          onDelete={presetsManager.removePreset}
          onDuplicate={presetsManager.duplicatePreset}
          onEdit={(id, updates) => presetsManager.editPreset(id, updates)}
          onExportAll={presetsManager.exportAllPresets}
          onExportSelected={presetsManager.exportSelectedPresets}
          onImport={presetsManager.importPresets}
          onClearAll={presetsManager.clearAllPresets}
          // Quick Compare
          onCompare={handleBatchCompare}
          isCompareLoading={batchLoading}
          minCompareSelection={2}
          // Tag management
          allTags={presetsManager.allTags}
          onAddTag={presetsManager.addTagToPreset}
          onRemoveTag={presetsManager.removeTagFromPreset}
          isLoading={loading}
        />
        <PresetCompareSelector
          presets={presetsManager.presets}
          onCompare={handleBatchCompare}
          isLoading={batchLoading}
        />
      </Group>

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
                    onChange={(v) => {
                      form.setFieldValue("annual_interest_rate", v as any);
                      if (v != null && v !== '' && Number(v) !== 0) {
                        form.setFieldValue("monthly_interest_rate", null);
                      }
                    }}
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
                    onChange={(v) => {
                      form.setFieldValue("monthly_interest_rate", v as any);
                      if (v != null && v !== '' && Number(v) !== 0) {
                        form.setFieldValue("annual_interest_rate", null);
                      }
                    }}
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
                    onChange={(v) => {
                      form.setFieldValue("rent_value", v as any);
                      if (v != null && v !== '' && Number(v) !== 0) {
                        form.setFieldValue("rent_percentage", null);
                      }
                    }}
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
                    onChange={(v) => {
                      form.setFieldValue("rent_percentage", v as any);
                      if (v != null && v !== '' && Number(v) !== 0) {
                        form.setFieldValue("rent_value", null);
                      }
                    }}
                    suffix="%"
                    decimalScale={2}
                    size="md"
                  />
                </Grid.Col>
              </Grid>

              <Divider my="lg" color="var(--mantine-color-default-border)" />

              <Text fw={600} size="sm" mb="sm" c="bright">
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
                  <Tabs.Tab value="custos" leftSection={<IconCash size={16} />}>
                    Custos
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
                  <Tabs.Tab value="aportes" leftSection={<IconCash size={16} />}>
                    Aportes
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

                <Tabs.Panel value="custos" pt="md">
                  <Text fw={600} size="sm" c="bright" mb="sm">
                    Custos adicionais (compra e posse do imóvel)
                  </Text>
                  <Text size="xs" c="dimmed" mb="md">
                    ITBI e Escritura entram como custo de compra (no mês da compra). Condomínio e IPTU entram
                    como custos mensais do imóvel. Se no aluguel esses custos não se aplicarem, deixe 0.
                  </Text>
                  <Grid gutter="lg">
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="ITBI"
                        description="Custo de compra (percentual do valor do imóvel)"
                        placeholder="2"
                        min={0}
                        suffix="%"
                        decimalScale={2}
                        size="md"
                        {...form.getInputProps("additional_costs.itbi_percentage")}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="Escritura"
                        description="Custo de compra (percentual do valor do imóvel)"
                        placeholder="1"
                        min={0}
                        suffix="%"
                        decimalScale={2}
                        size="md"
                        {...form.getInputProps("additional_costs.deed_percentage")}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="Condomínio"
                        description="Custo mensal do imóvel (se não se aplica no aluguel, deixe 0)"
                        placeholder="R$ 0"
                        min={0}
                        thousandSeparator="."
                        decimalSeparator="," 
                        prefix="R$ "
                        size="md"
                        {...form.getInputProps("additional_costs.monthly_hoa")}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="IPTU"
                        description="Custo mensal do imóvel (se não se aplica no aluguel, deixe 0)"
                        placeholder="R$ 0"
                        min={0}
                        thousandSeparator="."
                        decimalSeparator="," 
                        prefix="R$ "
                        size="md"
                        {...form.getInputProps(
                          "additional_costs.monthly_property_tax",
                        )}
                      />
                    </Grid.Col>
                  </Grid>
                </Tabs.Panel>

                <Tabs.Panel value="estrategia" pt="md">
                  <Stack gap="md">
                    <Grid gutter="lg">
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <LabelWithHelp
                          label="Renda líquida mensal"
                          help="Usada apenas para análise de capacidade de pagamento. Não altera a simulação."
                        />
                        <NumberInput
                          mt={4}
                          placeholder="R$ 0"
                          {...form.getInputProps("monthly_net_income")}
                          thousandSeparator="."
                          decimalSeparator=","
                          prefix="R$ "
                          min={0}
                          size="md"
                        />
                      </Grid.Col>
                    </Grid>

                    <Divider color="sage.2" />

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
                          help="Usada quando 'Aluguel consome investimento' está ativo. Cobre aluguel/custos antes de retirar do investimento."
                        />
                        <NumberInput
                          mt={4}
                          placeholder="R$ 0"
                          {...form.getInputProps("monthly_external_savings")}
                          disabled={!form.values.rent_reduces_investment}
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
                            disabled={!form.values.rent_reduces_investment}
                          />
                        </Box>
                      </Grid.Col>
                    </Grid>

                    <Divider color="sage.2" />

                    <Grid gutter="lg">
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <LabelWithHelp
                          label="Aporte mensal fixo"
                          help="Aporte contínuo ao longo do horizonte (inclusive após a compra à vista). Para aportes com duração específica, use a aba Aportes."
                        />
                        <NumberInput
                          mt={4}
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
                        description="Se ligado, aplica IR conforme o modo escolhido"
                        {...form.getInputProps("investment_tax.enabled", {
                          type: "checkbox",
                        })}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Select
                        label="Modo de tributação"
                        description="Mensal (aproximação) ou no resgate (mais realista)"
                        data={[
                          { value: "on_withdrawal", label: "No resgate (ganho realizado)" },
                          { value: "monthly", label: "Mensal (aproximação simples)" },
                        ]}
                        {...form.getInputProps("investment_tax.mode")}
                        disabled={!form.values.investment_tax?.enabled}
                        size="md"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="Alíquota efetiva"
                        description="Percentual sobre ganho (modo mensal/no resgate)"
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

                <Tabs.Panel value="aportes" pt="md">
                  <Stack gap="md">
                    <Text size="sm" c="dimmed">
                      Configure aportes programados que serão aplicados em todos os cenários de investimento
                      ("Alugar e investir" e "Investir e comprar à vista"). Você pode definir aportes únicos,
                      recorrentes, ou com valor variável ao longo do tempo.
                    </Text>
                    
                    <Checkbox
                      label="Continuar aportes após a compra do imóvel"
                      description="No cenário 'Investir e comprar à vista', se marcado, os aportes programados continuam mesmo após a compra"
                      {...form.getInputProps("continue_contributions_after_purchase", {
                        type: "checkbox",
                      })}
                    />

                    <Divider color="sage.2" />
                    
                    <AmortizationsFieldArray
                      value={form.values.contributions || []}
                      onChange={(v: any) => form.setFieldValue("contributions", v)}
                      inflationRate={form.values.inflation_rate || undefined}
                      termMonths={form.values.loan_term_years * 12}
                      showFundingSource={false}
                      uiText={{
                        configuredTitle: "Aportes Configurados",
                        emptyTitle: "Nenhum aporte programado",
                        emptyDescription:
                          "Adicione aportes programados para aumentar seus investimentos ao longo do tempo",
                        addButtonLabel: "Adicionar",
                        addEmptyButtonLabel: "Adicionar Aporte",
                        itemLabel: "Aporte",
                        percentageDescription: "Percentual do saldo investido",
                        previewTitle: "Pré-visualização dos Aportes",
                        percentageFootnote:
                          "* Valores percentuais dependem do saldo investido.",
                      }}
                    />
                  </Stack>
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
                Simular Comprar vs Alugar
              </Button>
            </FormSection>
          )}
        </FormWizard>
      </form>

      {/* Single Simulation Results */}
      {data && viewMode === 'single-result' && (
        <Box id="results-section" pt="xl">
          <EnhancedComparisonResults
            result={data}
            inputPayload={lastInput || undefined}
          />
        </Box>
      )}

      {/* Batch Comparison Results */}
      {batchResult && viewMode === 'batch-result' && (
        <Box ref={batchResultsRef} id="batch-results-section" pt="xl">
          <BatchComparisonResults
            result={batchResult}
            presetInputs={batchInputs}
            onBack={handleBackFromBatch}
          />
        </Box>
      )}
    </Stack>
  );
}
