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
  IconWallet,
  IconAdjustments,
} from "@tabler/icons-react";
import { LabelWithHelp } from "./LabelWithHelp";
import { FormSection, FormWizard } from "./ui/FormWizard";
import { money } from "../utils/format";
import { Preset } from "../utils/presets";

const PRESETS_STORAGE_KEY = 'farol-comparison-presets';

const DEFAULT_INVESTMENT_RETURNS = [{ start_month: 1, end_month: null, annual_rate: 8 }];
const DEFAULT_INVESTMENT_TAX = {
  enabled: false,
  mode: "on_withdrawal" as const,
  effective_tax_rate: 15,
};
const DEFAULT_FGTS = {
  initial_balance: 0,
  monthly_contribution: 0,
  annual_yield_rate: 0,
  use_at_purchase: true,
  max_withdrawal_at_purchase: null,
};

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
      investment_returns: DEFAULT_INVESTMENT_RETURNS,
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
      monthly_net_income: null, // Renda líquida mensal
      monthly_net_income_adjust_inflation: false,
      fgts: DEFAULT_FGTS,
      investment_tax: DEFAULT_INVESTMENT_TAX,
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

  const normalizePresetInput = (input: ComparisonInput): ComparisonInput => {
    const normalized: ComparisonInput = {
      ...input,
      additional_costs: input.additional_costs ?? {
        itbi_percentage: 2,
        deed_percentage: 1,
        monthly_hoa: 0,
        monthly_property_tax: 0,
      },
      amortizations: input.amortizations ?? [],
      contributions: input.contributions ?? [],
      investment_returns:
        input.investment_returns && input.investment_returns.length > 0
          ? input.investment_returns
          : DEFAULT_INVESTMENT_RETURNS,
      investment_tax: input.investment_tax ?? DEFAULT_INVESTMENT_TAX,
      fgts: input.fgts ?? DEFAULT_FGTS,
    };

    return normalized;
  };

  const handleLoadPreset = (preset: Preset<ComparisonInput>) => {
    form.setValues(normalizePresetInput(preset.input));
  };

  // Helper to clean input values that would fail backend validation
  const cleanInputForBackend = (input: ComparisonInput): ComparisonInput => {
    const cleaned = normalizePresetInput({ ...input });

    const nullIfEmpty = (v: unknown) => (v === '' ? null : v);

    cleaned.annual_interest_rate = nullIfEmpty(cleaned.annual_interest_rate) as any;
    cleaned.monthly_interest_rate = nullIfEmpty(cleaned.monthly_interest_rate) as any;
    cleaned.rent_value = nullIfEmpty(cleaned.rent_value) as any;
    cleaned.rent_percentage = nullIfEmpty(cleaned.rent_percentage) as any;
    cleaned.inflation_rate = nullIfEmpty(cleaned.inflation_rate) as any;
    cleaned.rent_inflation_rate = nullIfEmpty(cleaned.rent_inflation_rate) as any;
    cleaned.property_appreciation_rate = nullIfEmpty(cleaned.property_appreciation_rate) as any;
    cleaned.monthly_net_income = nullIfEmpty(cleaned.monthly_net_income) as any;

    if (cleaned.monthly_net_income == null) {
      cleaned.monthly_net_income_adjust_inflation = false;
    }

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
    
    // Convert 0 values to null where appropriate
    if (cleaned.monthly_net_income === 0) {
      cleaned.monthly_net_income = null;
    }

    if (cleaned.annual_interest_rate === 0) cleaned.annual_interest_rate = null;
    if (cleaned.monthly_interest_rate === 0) cleaned.monthly_interest_rate = null;
    if (cleaned.rent_value === 0) cleaned.rent_value = null;
    if (cleaned.rent_percentage === 0) cleaned.rent_percentage = null;

    // Backend assumes at least one investment return definition.
    if (!cleaned.investment_returns || cleaned.investment_returns.length === 0) {
      cleaned.investment_returns = DEFAULT_INVESTMENT_RETURNS;
    }

    // Contributions: avoid sending invalid empty applies_to arrays.
    if (Array.isArray(cleaned.contributions)) {
      cleaned.contributions = cleaned.contributions.map((c: any) => {
        if (c && Array.isArray(c.applies_to) && c.applies_to.length === 0) {
          // Backend rejects empty applies_to; treat as omitted (backward-compatible: applies to all).
          const { applies_to, ...rest } = c;
          return rest;
        }

        // If user selected all scenarios, omit applies_to to match the implicit default.
        if (c && Array.isArray(c.applies_to)) {
          const s = new Set(c.applies_to);
          const all = ['buy', 'rent_invest', 'invest_buy'];
          const isAll = all.every((x) => s.has(x)) && s.size === all.length;
          if (isAll) {
            const { applies_to, ...rest } = c;
            return rest;
          }
        }
        return c;
      }) as any;
    }
    
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
        color: "ocean",
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
  
  // Calculate upfront costs (ITBI + deed) for validation
  const itbiPercentage = Number(form.values.additional_costs?.itbi_percentage || 0);
  const deedPercentage = Number(form.values.additional_costs?.deed_percentage || 0);
  const upfrontCosts = propertyValue * ((itbiPercentage + deedPercentage) / 100);
  
  // The minimum required is: down_payment + ITBI + deed costs
  const minRequiredSavings = downPayment + upfrontCosts;
  
  // Initial investment is what remains after paying entry + transaction costs
  const initialInvestment = totalSavings > 0 ? Math.max(0, totalSavings - minRequiredSavings) : 0;
  
  // Validation: check if total_savings covers all required costs
  const insufficientSavings = totalSavings > 0 && totalSavings < minRequiredSavings;
  
  const loanAmount = Math.max(0, propertyValue - downPayment);
  const downPaymentPct =
    propertyValue > 0 ? (downPayment / propertyValue) * 100 : 0;
  const rentValue = Number(form.values.rent_value || 0);
  const rentPercentage = Number(form.values.rent_percentage || 0);
  const rentFromPct = propertyValue > 0 && rentPercentage > 0 ? propertyValue * (rentPercentage / 100) : 0;

  async function onSubmit(values: ComparisonInput) {
    // Validate savings before submitting
    const propVal = Number(values.property_value || 0);
    const downPay = Number(values.down_payment || 0);
    const savings = Number(values.total_savings || 0);
    const itbi = Number(values.additional_costs?.itbi_percentage || 0);
    const deed = Number(values.additional_costs?.deed_percentage || 0);
    const upfront = propVal * ((itbi + deed) / 100);
    const minRequired = downPay + upfront;
    
    if (savings > 0 && savings < minRequired) {
      notifications.show({
        title: "Patrimônio insuficiente",
        message: `Você informou ${money(savings)} de patrimônio, mas precisa de pelo menos ${money(minRequired)} para cobrir a entrada (${money(downPay)}) + custos de ITBI/escritura (${money(upfront)}).`,
        color: "red",
        autoClose: 8000,
      });
      return;
    }
    
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
        color: "ocean",
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
      {/* Preset Management - First section for loading saved configurations */}
      <Box
        p="md"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: 'var(--glass-shadow), var(--glass-shadow-glow)',
          borderRadius: 'var(--mantine-radius-xl)',
        }}
      >
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          <Group gap="sm">
            <ThemeIcon size={32} radius="lg" variant="light" color="ocean">
              <IconSettings size={16} />
            </ThemeIcon>
            <Box>
              <Text fw={600} size="sm" c="bright">
                Presets
              </Text>
              <Text size="xs" c="dimmed">
                Salve e carregue configurações
              </Text>
            </Box>
          </Group>
          <Group gap="xs">
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
              onCompare={handleBatchCompare}
              isCompareLoading={batchLoading}
              minCompareSelection={2}
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
        </Group>
      </Box>

      {/* Form Section */}
      <form onSubmit={form.onSubmit(onSubmit)}>
        <FormWizard
          active={activeStep}
          onStepClick={setActiveStep}
          steps={[
            {
              label: "Sua situação",
              description: "Renda e patrimônio",
              icon: <IconWallet size={16} />,
            },
            {
              label: "Imóvel",
              description: "Valor, entrada e taxa",
              icon: <IconHome2 size={16} />,
            },
            {
              label: "Aluguel & Investimentos",
              description: "Aluguel, retorno e aportes",
              icon: <IconChartLine size={16} />,
            },
            {
              label: "Ajustes",
              description: "Opcional",
              icon: <IconAdjustments size={16} />,
            },
          ]}
        >
          {activeStep === 0 && (
            <FormSection
              title="Sua situação financeira"
              description="Informe sua renda e patrimônio disponível. Esses dados são essenciais para uma simulação realista."
              icon={<IconWallet size={20} />}
            >
              <Grid gutter="lg">
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <NumberInput
                    label={
                      <LabelWithHelp
                        label="Renda líquida mensal"
                        help="Sua renda líquida após impostos e descontos. No cenário de aluguel, os custos de moradia são pagos desta renda e o excedente é investido automaticamente. Se não informada, o sistema assume que os custos são pagos por fonte externa."
                      />
                    }
                    description="Quanto você recebe por mês (já livre de impostos)"
                    placeholder="R$ 10.000"
                    {...form.getInputProps("monthly_net_income")}
                    thousandSeparator="."
                    decimalSeparator=","
                    prefix="R$ "
                    min={0}
                    size="md"
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }} style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <Checkbox
                    label="Ajustar renda pela inflação"
                    description="Corrige a renda pela inflação ao longo do tempo"
                    {...form.getInputProps("monthly_net_income_adjust_inflation", {
                      type: "checkbox",
                    })}
                    disabled={!Number(form.values.monthly_net_income || 0)}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <NumberInput
                    label={
                      <LabelWithHelp 
                        label="Patrimônio disponível" 
                        help={`Seu patrimônio líquido disponível para a compra. Este valor deve cobrir: entrada em dinheiro + custos de ITBI e escritura (tipicamente ${(itbiPercentage + deedPercentage).toFixed(0)}% do imóvel). O que sobrar será seu capital inicial para investir nos cenários de aluguel.`} 
                      />
                    }
                    description="Quanto você tem disponível para a compra/investimento"
                    placeholder="R$ 150.000"
                    min={0}
                    {...form.getInputProps("total_savings")}
                    thousandSeparator="."
                    decimalSeparator=","
                    prefix="R$ "
                    size="md"
                  />
                </Grid.Col>
                <Grid.Col span={12}>
                  <Box 
                    p="md" 
                    style={{ 
                      backgroundColor: 'light-dark(var(--mantine-color-ocean-0), var(--mantine-color-dark-7))', 
                      borderRadius: 'var(--mantine-radius-md)',
                      border: '1px solid var(--mantine-color-ocean-2)'
                    }}
                  >
                    <Group gap="sm" mb="xs">
                      <ThemeIcon size={24} radius="md" variant="light" color="ocean">
                        <IconPigMoney size={14} />
                      </ThemeIcon>
                      <Text fw={600} size="sm" c="ocean.7">
                        FGTS (Opcional)
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed" mb="md">
                      O FGTS é tratado separadamente da entrada em dinheiro. O valor informado aqui será somado à entrada no momento da compra.
                    </Text>
                    <Grid gutter="md">
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <NumberInput
                          label="Saldo FGTS"
                          description="Saldo disponível para uso na compra"
                          placeholder="R$ 0"
                          {...form.getInputProps("fgts.initial_balance")}
                          thousandSeparator="."
                          decimalSeparator=","
                          prefix="R$ "
                          min={0}
                          size="sm"
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
                          size="sm"
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <Checkbox
                          label="Usar FGTS na compra do imóvel"
                          {...form.getInputProps("fgts.use_at_purchase", {
                            type: "checkbox",
                          })}
                        />
                      </Grid.Col>
                    </Grid>
                  </Box>
                </Grid.Col>
              </Grid>
            </FormSection>
          )}

          {activeStep === 1 && (
            <FormSection
              title="Imóvel e financiamento"
              description="Defina o valor do imóvel, entrada e condições do financiamento."
              icon={<IconHome2 size={20} />}
            >
              <Grid gutter="lg">
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <NumberInput
                    label="Valor do imóvel"
                    description="Preço total do imóvel que você está considerando"
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
                    label={
                      <LabelWithHelp 
                        label="Entrada (em dinheiro)" 
                        help="Valor em dinheiro que você vai usar como entrada no financiamento. NÃO inclua aqui o FGTS - ele é somado automaticamente se configurado." 
                      />
                    }
                    description="Apenas dinheiro, sem contar FGTS"
                    placeholder="R$ 100.000"
                    min={0}
                    required
                    {...form.getInputProps("down_payment")}
                    thousandSeparator="."
                    decimalSeparator=","
                    prefix="R$ "
                    size="md"
                    error={
                      insufficientSavings
                        ? `Patrimônio insuficiente para cobrir entrada (${money(downPayment)}) + custos (${money(upfrontCosts)}). Mínimo: ${money(minRequiredSavings)}.`
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

                <Grid.Col span={12}>
                  <Divider 
                    my="sm" 
                    label={
                      <Text size="sm" fw={500} c="dimmed">
                        Taxa de juros
                      </Text>
                    } 
                    labelPosition="left" 
                  />
                </Grid.Col>

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
              <Text size="xs" c="ocean.6" mt="sm">
                Informe apenas uma das taxas. A outra será calculada automaticamente.
              </Text>
            </FormSection>
          )}

          {activeStep === 2 && (
            <FormSection
              title="Aluguel & Investimentos"
              description="Defina o aluguel e, em um só lugar, o retorno, os aportes e a tributação dos investimentos."
              icon={<IconChartLine size={20} />}
            >
              <Grid gutter="lg">
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <NumberInput
                    label="Valor do aluguel"
                    description="Aluguel mensal de um imóvel equivalente"
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
                    label={
                      <LabelWithHelp
                        label="Aluguel como % do valor"
                        help="Alternativa ao valor fixo. O yield típico de aluguel no Brasil varia entre 0,3% e 0,5% do valor do imóvel por mês."
                      />
                    }
                    description="Alternativa ao valor fixo (yield típico: 0,3% a 0,5% a.m.)"
                    placeholder="0,4"
                    {...form.getInputProps("rent_percentage")}
                    onChange={(v) => {
                      form.setFieldValue("rent_percentage", v as any);
                      if (v != null && v !== '' && Number(v) !== 0) {
                        form.setFieldValue("rent_value", null);
                      }
                    }}
                    suffix="% a.m."
                    decimalScale={2}
                    size="md"
                  />
                </Grid.Col>
              </Grid>

              {totalSavings > 0 && (
                <Box
                  mt="md"
                  p="md"
                  style={{
                    backgroundColor: 'light-dark(var(--mantine-color-ocean-0), var(--mantine-color-dark-7))',
                    borderRadius: 'var(--mantine-radius-md)',
                    border: `1px solid ${insufficientSavings ? 'var(--mantine-color-danger-3)' : 'var(--mantine-color-ocean-2)'}`,
                  }}
                >
                  <Group gap="sm" mb={4}>
                    <ThemeIcon size={24} radius="md" variant="light" color={insufficientSavings ? 'danger' : 'ocean'}>
                      <IconPigMoney size={14} />
                    </ThemeIcon>
                    <Text fw={600} size="sm" c={insufficientSavings ? 'danger.7' : 'ocean.7'}>
                      Capital inicial para investir
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Patrimônio ({money(totalSavings)}) − Entrada ({money(downPayment)}) − Custos de compra ({money(upfrontCosts)})
                  </Text>
                  <Text fw={700} size="md" mt={6} c={insufficientSavings ? 'danger.7' : 'bright'}>
                    {insufficientSavings ? 'Insuficiente para cobrir entrada + custos' : money(initialInvestment)}
                  </Text>
                </Box>
              )}

              <Divider my="lg" color="var(--mantine-color-default-border)" />

              <Tabs defaultValue="retorno" variant="pills" color="ocean">
                <Tabs.List>
                  <Tabs.Tab value="retorno" leftSection={<IconChartLine size={16} />}>
                    Retorno
                  </Tabs.Tab>
                  <Tabs.Tab value="aportes" leftSection={<IconCash size={16} />}>
                    Aportes
                  </Tabs.Tab>
                  <Tabs.Tab value="tributacao" leftSection={<IconReceipt size={16} />}>
                    Tributação
                  </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="retorno" pt="md">
                  <Text fw={600} size="sm" mb="sm" c="bright">
                    Retorno do investimento
                  </Text>
                  <Text size="xs" c="dimmed" mb="md">
                    Configure as taxas de retorno esperadas. Se você não quiser segmentar por períodos, mantenha apenas 1 item.
                  </Text>
                  <InvestmentReturnsFieldArray
                    value={form.values.investment_returns}
                    onChange={(v: any) => form.setFieldValue("investment_returns", v)}
                  />
                </Tabs.Panel>

                <Tabs.Panel value="aportes" pt="md">
                  <Stack gap="md">
                    <Text fw={600} size="sm" c="bright">
                      Aportes programados (opcional)
                    </Text>
                    <Text size="sm" c="dimmed">
                      Você pode definir aportes únicos, recorrentes, ou variáveis no tempo e escolher em quais cenários eles devem ser considerados.
                    </Text>

                    <Checkbox
                      label="Continuar aportes após a compra do imóvel"
                      description="No cenário 'Investir e comprar à vista', se marcado, os aportes programados continuam mesmo após a compra"
                      {...form.getInputProps("continue_contributions_after_purchase", {
                        type: "checkbox",
                      })}
                    />

                    <Divider color="ocean.2" />

                    <AmortizationsFieldArray
                      value={form.values.contributions || []}
                      onChange={(v: any) => form.setFieldValue("contributions", v)}
                      inflationRate={form.values.inflation_rate || undefined}
                      termMonths={form.values.loan_term_years * 12}
                      showFundingSource={false}
                      showScenarioSelector
                      scenarioOptions={[
                        { value: 'buy', label: 'Comprar com financiamento' },
                        { value: 'rent_invest', label: 'Alugar e investir' },
                        { value: 'invest_buy', label: 'Investir e comprar à vista' },
                      ]}
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

                <Tabs.Panel value="tributacao" pt="md">
                  <Text fw={600} size="sm" c="bright" mb="sm">
                    Tributação dos investimentos (opcional)
                  </Text>
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
                        {...form.getInputProps("investment_tax.effective_tax_rate")}
                        suffix="%"
                        min={0}
                        max={100}
                        disabled={!form.values.investment_tax?.enabled}
                        size="md"
                      />
                    </Grid.Col>
                  </Grid>
                  <Text size="xs" c="ocean.6" mt="md">
                    Esta é uma aproximação. O IR real depende do tipo de investimento e prazo.
                  </Text>
                </Tabs.Panel>
              </Tabs>
            </FormSection>
          )}

          {activeStep === 3 && (
            <FormSection
              title="Ajustes avançados (opcional)"
              description="Refine a simulação com parâmetros adicionais. Esses valores já têm padrões razoáveis."
              icon={<IconAdjustments size={20} />}
            >
              <Tabs defaultValue="custos" variant="pills" color="ocean">
                <Tabs.List>
                  <Tabs.Tab value="custos" leftSection={<IconCash size={16} />}>
                    Custos
                  </Tabs.Tab>
                  <Tabs.Tab value="inflacao" leftSection={<IconBuildingBank size={16} />}>
                    Inflação
                  </Tabs.Tab>
                  <Tabs.Tab value="amortizacoes" leftSection={<IconScale size={16} />}>
                    Amortizações
                  </Tabs.Tab>
                  <Tabs.Tab value="fgts-avancado" leftSection={<IconPigMoney size={16} />}>
                    FGTS avançado
                  </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="custos" pt="md">
                  <Text fw={600} size="sm" c="bright" mb="sm">
                    Custos de compra e posse do imóvel
                  </Text>
                  <Text size="xs" c="dimmed" mb="md">
                    ITBI e Escritura são custos de compra (pagos no momento da aquisição). Condomínio e IPTU são custos mensais de posse.
                  </Text>
                  <Grid gutter="lg">
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="ITBI"
                        description="Imposto de transmissão (% do valor do imóvel)"
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
                        description="Custos cartorários (% do valor do imóvel)"
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
                        label="Condomínio mensal"
                        description="Taxa de condomínio (se não se aplica, deixe 0)"
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
                        label="IPTU mensal"
                        description="Valor mensal do IPTU (se não se aplica, deixe 0)"
                        placeholder="R$ 0"
                        min={0}
                        thousandSeparator="."
                        decimalSeparator="," 
                        prefix="R$ "
                        size="md"
                        {...form.getInputProps("additional_costs.monthly_property_tax")}
                      />
                    </Grid.Col>
                  </Grid>
                </Tabs.Panel>

                <Tabs.Panel value="inflacao" pt="md">
                  <Text size="xs" c="dimmed" mb="md">
                    Configure as taxas de inflação para atualizar os valores ao longo do tempo.
                  </Text>
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

                <Tabs.Panel value="amortizacoes" pt="md">
                  <AmortizationsFieldArray
                    value={form.values.amortizations || []}
                    onChange={(v: any) => form.setFieldValue("amortizations", v)}
                    inflationRate={form.values.inflation_rate || undefined}
                    termMonths={form.values.loan_term_years * 12}
                  />
                </Tabs.Panel>

                <Tabs.Panel value="fgts-avancado" pt="md">
                  <Text size="xs" c="dimmed" mb="md">
                    Configure opções avançadas do FGTS. O saldo inicial e opção de uso na compra estão no primeiro passo.
                  </Text>
                  <Grid gutter="lg">
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="Rendimento FGTS"
                        description="Taxa anual de rendimento do FGTS (padrão: TR + 3%)"
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
                        description="Máximo a usar na compra (deixe vazio para sem limite)"
                        placeholder="Sem limite"
                        {...form.getInputProps("fgts.max_withdrawal_at_purchase")}
                        thousandSeparator="."
                        decimalSeparator="," 
                        prefix="R$ "
                        min={0}
                        size="md"
                      />
                    </Grid.Col>
                  </Grid>
                </Tabs.Panel>
              </Tabs>
            </FormSection>
          )}
        </FormWizard>

        {/* Simulation Summary and Submit - Always visible */}
        <Box
          p="lg"
          mt="xl"
          style={{
            background: 'light-dark(linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.04) 100%), linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(59, 130, 246, 0.06) 100%))',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: 'var(--glass-shadow), var(--glass-shadow-glow)',
            borderRadius: 'var(--mantine-radius-xl)',
          }}
        >
          <Stack gap="md">
            <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
              <Group gap="sm">
                <ThemeIcon size={32} radius="lg" variant="light" color="ocean">
                  <IconScale size={16} />
                </ThemeIcon>
                <Box>
                  <Text fw={600} size="sm" c="bright">
                    Resumo da simulação
                  </Text>
                  <Text size="xs" c="dimmed">
                    Confira os valores antes de simular
                  </Text>
                </Box>
              </Group>
            </Group>
            
            <SimpleGrid cols={{ base: 2, sm: 4, md: 7 }} spacing="md">
              {Number(form.values.monthly_net_income || 0) > 0 && (
                <Tooltip label="Renda líquida mensal informada" withArrow>
                  <Box style={{ cursor: 'help' }}>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                      Renda
                    </Text>
                    <Text size="sm" fw={600} c="teal.6">
                      {money(Number(form.values.monthly_net_income || 0))}
                    </Text>
                  </Box>
                </Tooltip>
              )}
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                  Imóvel
                </Text>
                <Text size="sm" fw={600} c="bright">
                  {money(propertyValue)}
                </Text>
              </Box>
              <Tooltip label="Entrada em dinheiro (FGTS é somado separadamente)" withArrow>
                <Box style={{ cursor: 'help' }}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                    Entrada
                  </Text>
                  <Text size="sm" fw={600} c="bright">
                    {money(downPayment)} ({downPaymentPct.toFixed(0)}%)
                  </Text>
                </Box>
              </Tooltip>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                  Financiado
                </Text>
                <Text size="sm" fw={600} c="ocean.7">
                  {money(loanAmount)}
                </Text>
              </Box>
              {upfrontCosts > 0 && (
                <Tooltip label="ITBI + Escritura (custos de compra)" withArrow>
                  <Box style={{ cursor: 'help' }}>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                      Custos
                    </Text>
                    <Text size="sm" fw={600} c="warning.6">
                      {money(upfrontCosts)}
                    </Text>
                  </Box>
                </Tooltip>
              )}
              {totalSavings > 0 && (
                <Tooltip 
                  label={`Patrimônio - Entrada - Custos = Capital para investir`}
                  withArrow
                >
                  <Box style={{ cursor: 'help' }}>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                      Investir
                    </Text>
                    <Text size="sm" fw={600} c={insufficientSavings ? 'danger.6' : 'ocean.7'}>
                      {insufficientSavings ? 'Insuficiente' : money(initialInvestment)}
                    </Text>
                  </Box>
                </Tooltip>
              )}
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                  Aluguel
                </Text>
                <Text size="sm" fw={600} c="ocean.7">
                  {rentValue > 0
                    ? money(rentValue)
                    : rentPercentage > 0
                      ? `${rentPercentage.toFixed(2)}% a.m. (~${money(rentFromPct)})`
                      : '—'}
                </Text>
              </Box>
            </SimpleGrid>

            {/* Warning when savings are insufficient */}
            {insufficientSavings && (
              <Box 
                p="sm" 
                style={{ 
                  backgroundColor: 'var(--mantine-color-danger-0)', 
                  borderRadius: 'var(--mantine-radius-md)',
                  border: '1px solid var(--mantine-color-danger-3)'
                }}
              >
                <Text size="sm" c="danger.7" fw={500}>
                  ⚠️ Patrimônio insuficiente
                </Text>
                <Text size="xs" c="danger.6">
                  Você precisa de {money(minRequiredSavings)} ({money(downPayment)} entrada + {money(upfrontCosts)} custos).
                </Text>
              </Box>
            )}

            <Divider color="var(--mantine-color-default-border)" />

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
          </Stack>
        </Box>
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
