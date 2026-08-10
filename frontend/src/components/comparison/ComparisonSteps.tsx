import { useId, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Collapse,
  Divider,
  Grid,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Slider,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAdjustments,
  IconBriefcase,
  IconCash,
  IconChartLine,
  IconChevronDown,
  IconChevronUp,
  IconHome2,
  IconInfoCircle,
  IconPigMoney,
  IconPlus,
  IconReceipt,
  IconTrash,
  IconWallet,
} from '@tabler/icons-react';
import type { ExtraIncomeEventInput } from '../../api/types';
import { money } from '../../utils/format';
import InvestmentReturnsFieldArray from '../InvestmentReturnsFieldArray';
import { FormSection } from '../ui/FormWizard';
import { useComparisonFormContext } from './ComparisonFormContext';
import {
  comparisonDerivedValues,
  convertAmountMode,
  convertInterestMode,
  hasNumber,
  initialFgtsAtPurchase,
  type ComparisonModules,
  type NumericFieldValue,
} from './comparisonFormModel';
import {
  calculateMonthlyBudgetSnapshot,
  extraIncomeInFirstMonth,
} from './monthlyBudgetPresentation';

const MONEY_PROPS = {
  prefix: 'R$ ',
  thousandSeparator: '.',
  decimalSeparator: ',',
  min: 0,
} as const;

interface OptionCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  enabled: boolean;
  onAdd: () => void;
}

function OptionCard({ title, description, icon, enabled, onAdd }: OptionCardProps) {
  if (enabled) return null;
  return (
    <Paper withBorder radius="lg" p="md" className="comparison-option-card">
      <Group align="flex-start" wrap="nowrap">
        <ThemeIcon variant="light" radius="md" size={36} aria-hidden="true">
          {icon}
        </ThemeIcon>
        <Box style={{ flex: 1 }}>
          <Text component="h4" fw={650} size="sm" m={0}>{title}</Text>
          <Text size="xs" c="dimmed" mt={3}>{description}</Text>
        </Box>
      </Group>
      <Button
        mt="md"
        variant="light"
        size="sm"
        leftSection={<IconPlus size={15} />}
        onClick={onAdd}
        aria-label={`Adicionar ${title.toLocaleLowerCase('pt-BR')}`}
        mih={44}
      >
        Adicionar
      </Button>
    </Paper>
  );
}

interface ActiveOptionProps {
  title: string;
  description: string;
  onRemove: () => void;
  hasError?: boolean;
  children: ReactNode;
}

function ActiveOption({ title, description, onRemove, hasError = false, children }: ActiveOptionProps) {
  const [opened, setOpened] = useState(true);
  const panelId = useId();
  const displayedOpen = opened || hasError;
  return (
    <Paper withBorder radius="lg" p={{ base: 'md', sm: 'lg' }}>
      <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
        <Box style={{ flex: 1 }}>
          <Text component="h4" fw={700} m={0}>{title}</Text>
          <Text size="sm" c="dimmed" mt={3}>{description}</Text>
        </Box>
        <Group gap="xs">
          <Button variant="subtle" size="sm" mih={44} onClick={() => setOpened((value) => !value)} rightSection={displayedOpen ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />} aria-label={`${displayedOpen ? 'Recolher' : 'Editar'} ${title.toLocaleLowerCase('pt-BR')}`} aria-expanded={displayedOpen} aria-controls={panelId}>
            {displayedOpen ? 'Recolher' : 'Editar'}
          </Button>
          <Button variant="subtle" color="red" size="sm" mih={44} leftSection={<IconTrash size={14} />} aria-label={`Desativar ${title.toLocaleLowerCase('pt-BR')}`} onClick={onRemove}>
            Desativar
          </Button>
        </Group>
      </Group>
      <Collapse id={panelId} in={displayedOpen}><Box mt="md">{children}</Box></Collapse>
    </Paper>
  );
}

function setModule(
  form: ReturnType<typeof useComparisonFormContext>,
  module: keyof ComparisonModules,
  enabled: boolean
) {
  form.setFieldValue(`ui.modules.${module}`, enabled);
}

function numeric(value: NumericFieldValue): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function economicRateSummary(
  value: NumericFieldValue,
  emptyLabel: string
): string {
  return hasNumber(value) ? `${value}%` : emptyLabel;
}

function hasFormError(
  errors: Record<string, unknown>,
  ...prefixes: string[]
): boolean {
  return Object.keys(errors).some((path) =>
    prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}.`))
  );
}

export function PropertyStep() {
  const form = useComparisonFormContext();
  const derived = comparisonDerivedValues(form.values);
  const [purchaseCostsOpen, setPurchaseCostsOpen] = useState(false);
  const purchaseCostsId = useId();
  const housingCostsEnabled = form.values.ui.modules.housingCosts;
  const purchaseCostsHaveError = hasFormError(
    form.errors,
    'additional_costs.itbi_percentage',
    'additional_costs.deed_percentage'
  );
  const housingCostsHaveError = hasFormError(
    form.errors,
    'additional_costs.owner_monthly_costs',
    'additional_costs.renter_monthly_costs'
  );
  const purchaseCostsDisplayed = purchaseCostsOpen || purchaseCostsHaveError;
  const changeRentMode = (next: 'amount' | 'percentage') => {
    if (
      next !== form.values.ui.rent_mode &&
      form.values.ui.rent_input !== '' &&
      derived.propertyValue <= 0
    ) {
      notifications.show({
        title: 'Informe o preço do imóvel',
        message: 'Ele é necessário para converter o aluguel sem alterar seu valor.',
        color: 'yellow',
      });
      return;
    }
    const converted = convertAmountMode(
      form.values.ui.rent_input,
      form.values.ui.rent_mode,
      next,
      derived.propertyValue
    );
    if (next === 'percentage' && typeof converted === 'number' && converted > 100) {
      notifications.show({
        title: 'Aluguel fora do limite percentual',
        message: 'Mantenha o aluguel em reais ou informe um valor de até 100% do imóvel por mês.',
        color: 'yellow',
      });
      return;
    }
    form.setFieldValue('ui.rent_input', converted);
    form.setFieldValue('ui.rent_mode', next);
  };
  return (
    <FormSection title="Qual moradia você está comparando?" description="Use um imóvel e um aluguel realmente equivalentes." icon={<IconHome2 size={20} />}>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <NumberInput label="Preço do imóvel" placeholder="Digite o preço" {...MONEY_PROPS} {...form.getInputProps('property_value')} />
        <Box>
          <SegmentedControl fullWidth value={form.values.ui.rent_mode} onChange={(value) => changeRentMode(value as 'amount' | 'percentage')} data={[{ value: 'amount', label: 'Aluguel em R$' }, { value: 'percentage', label: '% do imóvel/mês' }]} mb="xs" />
          <NumberInput label="Aluguel inicial equivalente" description={form.values.ui.rent_mode === 'amount' ? 'Sem condomínio, IPTU e demais custos mensais da moradia' : `Equivale a ${money(derived.rentAmount)} no primeiro mês, sem os demais custos mensais da moradia`} prefix={form.values.ui.rent_mode === 'amount' ? 'R$ ' : undefined} suffix={form.values.ui.rent_mode === 'percentage' ? '% a.m.' : undefined} thousandSeparator="." decimalSeparator="," min={0} max={form.values.ui.rent_mode === 'percentage' ? 100 : undefined} {...form.getInputProps('ui.rent_input')} />
        </Box>
      </SimpleGrid>
      <Paper withBorder radius="lg" p="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Box><Text fw={650}>Horizonte da decisão</Text><Text size="sm" c="dimmed">Quando os patrimônios serão comparados.</Text></Box>
          <NumberInput label="Comparar depois de" suffix=" anos" min={1} max={50} allowDecimal={false} {...form.getInputProps('comparison_horizon_years')} />
        </SimpleGrid>
      </Paper>
      <Paper withBorder radius="lg" p="md">
        <Group justify="space-between" wrap="wrap">
          <Box><Text fw={650}>Custos para comprar</Text><Text size="sm" c="dimmed">ITBI + registro: {money(derived.upfrontCosts)}</Text></Box>
          <Button variant="subtle" mih={44} onClick={() => setPurchaseCostsOpen((value) => !value)} rightSection={purchaseCostsDisplayed ? <IconChevronUp size={15} /> : <IconChevronDown size={15} />} aria-label={`${purchaseCostsDisplayed ? 'Ocultar' : 'Editar'} custos para comprar`} aria-expanded={purchaseCostsDisplayed} aria-controls={purchaseCostsId}>{purchaseCostsDisplayed ? 'Ocultar' : 'Editar'}</Button>
        </Group>
        <Collapse id={purchaseCostsId} in={purchaseCostsDisplayed}>
          <SimpleGrid cols={{ base: 1, sm: 2 }} mt="md">
            <NumberInput label="ITBI" suffix="%" min={0} max={100} {...form.getInputProps('additional_costs.itbi_percentage')} />
            <NumberInput label="Escritura e registro" suffix="%" min={0} max={100} {...form.getInputProps('additional_costs.deed_percentage')} />
          </SimpleGrid>
        </Collapse>
      </Paper>
      {!housingCostsEnabled ? (
        <OptionCard title="Custos mensais da moradia" description="Separe condomínio, IPTU, manutenção e seguro de proprietário e inquilino." icon={<IconReceipt size={18} />} enabled={false} onAdd={() => setModule(form, 'housingCosts', true)} />
      ) : (
        <ActiveOption title="Custos mensais da moradia" description="Inclua apenas custos exclusivos da moradia. Não repita aluguel ou parcela." onRemove={() => setModule(form, 'housingCosts', false)} hasError={housingCostsHaveError}>
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Stack gap="sm"><Text fw={650}>Como proprietário</Text><NumberInput label="Condomínio como proprietário" {...MONEY_PROPS} {...form.getInputProps('additional_costs.owner_monthly_costs.hoa')} /><NumberInput label="IPTU mensal como proprietário" {...MONEY_PROPS} {...form.getInputProps('additional_costs.owner_monthly_costs.property_tax')} /><NumberInput label="Manutenção, seguro e outros como proprietário" description="Custos recorrentes exclusivos do imóvel próprio" {...MONEY_PROPS} {...form.getInputProps('additional_costs.owner_monthly_costs.other')} /></Stack>
            <Stack gap="sm"><Text fw={650}>Como inquilino</Text><NumberInput label="Condomínio como inquilino" {...MONEY_PROPS} {...form.getInputProps('additional_costs.renter_monthly_costs.hoa')} /><NumberInput label="IPTU mensal como inquilino" {...MONEY_PROPS} {...form.getInputProps('additional_costs.renter_monthly_costs.property_tax')} /><NumberInput label="Seguro, taxas e outros como inquilino" description="Custos recorrentes exclusivos do aluguel" {...MONEY_PROPS} {...form.getInputProps('additional_costs.renter_monthly_costs.other')} /></Stack>
          </SimpleGrid>
        </ActiveOption>
      )}
    </FormSection>
  );
}

export function PurchaseStep() {
  const form = useComparisonFormContext();
  const derived = comparisonDerivedValues(form.values);
  const fgtsEnabled = form.values.ui.modules.fgts;
  const fgtsHasError = hasFormError(form.errors, 'fgts');
  const financingNeeded = derived.financedAmount > 0;
  const fgtsAmortization = form.values.fgts.financed_amortization;
  const changeFgtsAtPurchase = (checked: boolean) => {
    const nextFgts = { ...form.values.fgts, use_at_purchase: checked };
    const nextPolicy = nextFgts.financed_amortization;
    if (
      checked &&
      nextPolicy?.enabled &&
      initialFgtsAtPurchase({ ...derived.input, fgts: nextFgts }) > 0 &&
      nextPolicy.first_month < 25
    ) {
      nextFgts.financed_amortization = { ...nextPolicy, first_month: 25 };
    }
    // Update the dependent fields atomically so the visible month and payload
    // never disagree for one render.
    form.setFieldValue('fgts', nextFgts);
  };
  const changeDownPaymentMode = (next: 'amount' | 'percentage') => {
    if (
      next !== form.values.ui.down_payment_mode &&
      form.values.ui.down_payment_input !== '' &&
      derived.propertyValue <= 0
    ) {
      notifications.show({
        title: 'Informe o preço do imóvel',
        message: 'Ele é necessário para converter a entrada sem alterar seu valor.',
        color: 'yellow',
      });
      return;
    }
    const converted = convertAmountMode(
      form.values.ui.down_payment_input,
      form.values.ui.down_payment_mode,
      next,
      derived.propertyValue
    );
    if (next === 'percentage' && typeof converted === 'number' && converted > 100) {
      notifications.show({
        title: 'Entrada maior que o imóvel',
        message: 'Revise a entrada em dinheiro antes de mudar para percentual.',
        color: 'yellow',
      });
      return;
    }
    form.setFieldValue('ui.down_payment_input', converted);
    form.setFieldValue('ui.down_payment_mode', next);
  };
  const changeInterestMode = (next: 'annual' | 'monthly') => {
    const converted = convertInterestMode(
      form.values.ui.interest_input,
      form.values.ui.interest_mode,
      next
    );
    if (
      typeof converted === 'number' &&
      ((next === 'annual' && converted > 1000) ||
        (next === 'monthly' && converted > 100))
    ) {
      notifications.show({
        title: 'Taxa fora do limite',
        message:
          next === 'annual'
            ? 'Essa taxa mensal equivale a mais de 1.000% ao ano. Mantenha a taxa mensal ou informe um valor menor.'
            : 'Essa taxa anual equivale a mais de 100% ao mês. Mantenha a taxa anual ou informe um valor menor.',
        color: 'yellow',
      });
      return;
    }
    form.setFieldValue('ui.interest_input', converted);
    form.setFieldValue('ui.interest_mode', next);
  };
  return (
    <FormSection title="Como seria a compra?" description="Defina os recursos usados hoje; o financiamento só aparece se ainda houver saldo a pagar." icon={<IconWallet size={20} />}>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <NumberInput label="Dinheiro disponível hoje" description="Fora do FGTS e da reserva de emergência" {...MONEY_PROPS} {...form.getInputProps('total_savings')} />
        <Box><SegmentedControl fullWidth value={form.values.ui.down_payment_mode} onChange={(value) => changeDownPaymentMode(value as 'amount' | 'percentage')} data={[{ value: 'amount', label: 'Entrada em dinheiro (R$)' }, { value: 'percentage', label: 'Entrada em dinheiro (%)' }]} mb="xs" /><NumberInput label="Entrada em dinheiro" prefix={form.values.ui.down_payment_mode === 'amount' ? 'R$ ' : undefined} suffix={form.values.ui.down_payment_mode === 'percentage' ? '%' : undefined} thousandSeparator="." decimalSeparator="," min={0} max={form.values.ui.down_payment_mode === 'percentage' ? 100 : undefined} {...form.getInputProps('ui.down_payment_input')} /></Box>
      </SimpleGrid>
      {financingNeeded ? (
        <Paper withBorder radius="lg" p="md">
          <Text fw={700} mb="sm">Financiamento de {money(derived.financedAmount)}</Text>
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <NumberInput label="Prazo do financiamento" suffix=" anos" min={1} max={50} allowDecimal={false} {...form.getInputProps('loan_term_years')} />
              <Select label="Sistema" data={[{ value: 'PRICE', label: 'PRICE — parcela mais estável' }, { value: 'SAC', label: 'SAC — parcela decrescente' }]} {...form.getInputProps('loan_type')} />
            </SimpleGrid>
            <Box><SegmentedControl fullWidth value={form.values.ui.interest_mode} onChange={(value) => changeInterestMode(value as 'annual' | 'monthly')} data={[{ value: 'annual', label: 'Taxa anual' }, { value: 'monthly', label: 'Taxa mensal' }]} mb="xs" /><NumberInput label="Taxa efetiva de juros" suffix={form.values.ui.interest_mode === 'annual' ? '% a.a.' : '% a.m.'} min={0} max={form.values.ui.interest_mode === 'annual' ? 1000 : 100} decimalScale={4} {...form.getInputProps('ui.interest_input')} /></Box>
          </Stack>
        </Paper>
      ) : (
        <Alert color="teal" icon={<IconInfoCircle size={18} />} title="Compra à vista">
          {derived.fgtsAtPurchase > 0
            ? 'A entrada em dinheiro e o FGTS cobrem o imóvel'
            : 'A entrada em dinheiro cobre o imóvel'}; juros, prazo e amortização não são aplicados. ITBI e registro continuam pagos à parte com o dinheiro disponível.
        </Alert>
      )}
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Box><Text size="xs" c="dimmed">Entrada em dinheiro</Text><Text fw={700}>{money(derived.downPayment)}</Text></Box>
        <Box><Text size="xs" c="dimmed">ITBI + registro</Text><Text fw={700}>{money(derived.upfrontCosts)}</Text></Box>
        <Box><Text size="xs" c="dimmed">Caixa restante</Text><Text fw={700}>{derived.remainingResources == null ? '—' : money(derived.remainingResources)}</Text></Box>
      </SimpleGrid>
      {fgtsEnabled && (
        <Text size="sm" c="dimmed">
          FGTS estimado na compra: {money(derived.fgtsAtPurchase)} · valor
          financiado: {money(derived.financedAmount)}
        </Text>
      )}
      {!fgtsEnabled ? (
        <OptionCard title="FGTS" description="Inclua saldo, depósitos e uso na compra ou amortização." icon={<IconPigMoney size={18} />} enabled={false} onAdd={() => setModule(form, 'fgts', true)} />
      ) : (
        <ActiveOption title="FGTS" description="Recurso restrito, contabilizado em todas as estratégias." onRemove={() => setModule(form, 'fgts', false)} hasError={fgtsHasError}>
          <SimpleGrid cols={{ base: 1, sm: 2 }}><NumberInput label="Saldo atual" {...MONEY_PROPS} {...form.getInputProps('fgts.initial_balance')} /><NumberInput label="Depósito mensal" {...MONEY_PROPS} {...form.getInputProps('fgts.monthly_contribution')} /><NumberInput label="Rendimento" suffix="% a.a." min={0} max={100} {...form.getInputProps('fgts.annual_yield_rate')} /></SimpleGrid>
          <Checkbox mt="md" label="Usar FGTS na compra" checked={Boolean(form.values.fgts.use_at_purchase)} onChange={(event) => changeFgtsAtPurchase(event.currentTarget.checked)} />
          {form.values.fgts.use_at_purchase && <NumberInput mt="md" label="Limite na compra" placeholder="Todo o saldo" description="Em branco, usa até todo o saldo necessário" {...MONEY_PROPS} {...form.getInputProps('fgts.max_withdrawal_at_purchase')} />}
          {financingNeeded && (
            <>
              <Checkbox mt="md" label="Usar FGTS em amortizações futuras" checked={Boolean(fgtsAmortization?.enabled)} onChange={(event) => form.setFieldValue('fgts.financed_amortization', event.currentTarget.checked ? { enabled: true, first_month: derived.fgtsAtPurchase > 0 ? 25 : 24, interval_months: 24, amount_mode: 'available_balance', amount: null } : null)} />
              {fgtsAmortization?.enabled && (
                <Paper withBorder radius="md" p="md" mt="md">
                  <Text fw={650} mb="sm">Personalizar amortizações com FGTS</Text>
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <NumberInput label="Primeira amortização" description={derived.fgtsAtPurchase > 0 ? 'Como houve saque na compra, a primeira data elegível é o mês 25.' : undefined} suffix="º mês" min={derived.fgtsAtPurchase > 0 ? 25 : 1} max={600} allowDecimal={false} {...form.getInputProps('fgts.financed_amortization.first_month')} />
                    <NumberInput label="Repetir a cada" suffix=" meses" min={1} max={600} allowDecimal={false} {...form.getInputProps('fgts.financed_amortization.interval_months')} />
                    <Select label="Valor de cada amortização" data={[{ value: 'available_balance', label: 'Todo o saldo disponível' }, { value: 'fixed', label: 'Valor fixo' }]} {...form.getInputProps('fgts.financed_amortization.amount_mode')} />
                    {fgtsAmortization.amount_mode === 'fixed' && <NumberInput label="Valor fixo" {...MONEY_PROPS} {...form.getInputProps('fgts.financed_amortization.amount')} />}
                  </SimpleGrid>
                </Paper>
              )}
            </>
          )}
        </ActiveOption>
      )}
    </FormSection>
  );
}

function BudgetPreview({ title, housing, form, financed = false, extraIncome = 0, outstandingBalance }: { title: string; housing: number; form: ReturnType<typeof useComparisonFormContext>; financed?: boolean; extraIncome?: number; outstandingBalance?: number }) {
  const input = comparisonDerivedValues(form.values).input;
  const plan = input.monthly_plan;
  if (!plan) return null;
  const snapshot = calculateMonthlyBudgetSnapshot(plan, housing, {
    financed,
    extraIncome,
    maxAmortization: outstandingBalance,
  });
  return (
    <Paper withBorder radius="lg" p="md">
      <Text fw={700}>{title}</Text>
      <Stack gap={4} mt="sm"><Group justify="space-between"><Text size="sm" c="dimmed">Renda líquida</Text><Text size="sm">{money(plan.net_income)}</Text></Group>{extraIncome > 0 && <Group justify="space-between"><Text size="sm" c="dimmed">+ Renda extra</Text><Text size="sm">{money(extraIncome)}</Text></Group>}<Group justify="space-between"><Text size="sm" c="dimmed">− Gastos fora da moradia</Text><Text size="sm">{money(plan.non_housing_expenses)}</Text></Group><Group justify="space-between"><Text size="sm" c="dimmed">− Moradia</Text><Text size="sm">{money(housing)}</Text></Group><Group justify="space-between"><Text size="sm" c="dimmed">= Sobra</Text><Text size="sm" fw={650}>{money(snapshot.surplus)}</Text></Group><Divider /><Group justify="space-between"><Text size="sm">Investir</Text><Text size="sm" fw={700}>{money(snapshot.investmentAllocation)}</Text></Group>{financed && <Group justify="space-between"><Text size="sm">Amortizar</Text><Text size="sm" fw={700}>{money(snapshot.amortizationAllocation)}</Text></Group>}<Group justify="space-between"><Text size="sm" c="dimmed">Fora do plano</Text><Text size="sm">{money(snapshot.outsidePlan)}</Text></Group>{snapshot.deficit > 0 && <Text size="xs" c="red">Faltam {money(snapshot.deficit)} para os gastos obrigatórios.</Text>}</Stack>
    </Paper>
  );
}

function ExpenseHelper({ onUse }: { onUse: (value: number) => void }) {
  const [opened, setOpened] = useState(false);
  const panelId = useId();
  const [items, setItems] = useState({ food: 0, transport: 0, health: 0, other: 0 });
  const total = Object.values(items).reduce((sum, value) => sum + value, 0);
  return (
    <Box>
      <Button
        variant="subtle"
        size="sm"
        mih={44}
        onClick={() => setOpened((value) => !value)}
        aria-expanded={opened}
        aria-controls={panelId}
      >
        {opened ? 'Fechar calculadora' : 'Ajude-me a calcular'}
      </Button>
      <Collapse id={panelId} in={opened}>
        <Paper withBorder p="md" mt="xs">
          <Text size="xs" c="dimmed" mb="sm">
            Contas iguais nas três alternativas, como energia e internet, podem entrar em Outros. Não inclua aluguel, parcela, condomínio, IPTU ou custos exclusivos da moradia.
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <NumberInput label="Alimentação e mercado" {...MONEY_PROPS} value={items.food} onChange={(value) => setItems((current) => ({ ...current, food: Number(value) || 0 }))} />
            <NumberInput label="Transporte" {...MONEY_PROPS} value={items.transport} onChange={(value) => setItems((current) => ({ ...current, transport: Number(value) || 0 }))} />
            <NumberInput label="Saúde e educação" {...MONEY_PROPS} value={items.health} onChange={(value) => setItems((current) => ({ ...current, health: Number(value) || 0 }))} />
            <NumberInput label="Outros" {...MONEY_PROPS} value={items.other} onChange={(value) => setItems((current) => ({ ...current, other: Number(value) || 0 }))} />
          </SimpleGrid>
          <Group justify="space-between" mt="md" wrap="wrap">
            <Text fw={700}>Total: {money(total)}</Text>
            <Button mih={44} onClick={() => onUse(total)}>Usar este total</Button>
          </Group>
        </Paper>
      </Collapse>
    </Box>
  );
}

export function MonthlyPlanStep() {
  const form = useComparisonFormContext();
  const derived = comparisonDerivedValues(form.values);
  const ownerCostsInput = derived.input.additional_costs.owner_monthly_costs;
  const renterCostsInput = derived.input.additional_costs.renter_monthly_costs;
  const ownerCosts = (ownerCostsInput?.hoa ?? 0) + (ownerCostsInput?.property_tax ?? 0) + (ownerCostsInput?.other ?? 0);
  const renterCosts = (renterCostsInput?.hoa ?? 0) + (renterCostsInput?.property_tax ?? 0) + (renterCostsInput?.other ?? 0);
  const amortizationPercentage = numeric(form.values.monthly_plan.financed_purchase.amortization_percentage);
  const firstMonthExtraIncome = extraIncomeInFirstMonth(
    derived.input.extra_income_events
  );
  return (
    <FormSection title="Como seu mês deve funcionar?" description="A mesma regra será aplicada à sobra de cada estratégia." icon={<IconCash size={20} />}>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <NumberInput label="Renda líquida mensal" description="Salários e rendas recorrentes depois de impostos" {...MONEY_PROPS} {...form.getInputProps('monthly_plan.net_income')} />
        <Box><NumberInput label="Gastos fora da moradia" description="Alimentação, transporte, saúde e gastos pessoais. Não inclua aluguel, parcela, condomínio, IPTU ou outros custos da moradia." {...MONEY_PROPS} {...form.getInputProps('monthly_plan.non_housing_expenses')} /><ExpenseHelper onUse={(value) => form.setFieldValue('monthly_plan.non_housing_expenses', value)} /></Box>
      </SimpleGrid>
      <Checkbox label="Preservar o poder de compra da renda e dos gastos, corrigindo ambos pela inflação" {...form.getInputProps('monthly_plan.adjust_for_inflation', { type: 'checkbox' })} />
      <Paper withBorder radius="lg" p={{ base: 'md', sm: 'lg' }}>
        <Text fw={700}>Quanto da sobra constrói patrimônio?</Text><Text size="sm" c="dimmed">O restante fica disponível para consumo, imprevistos ou gastos não detalhados e não entra no patrimônio.</Text>
        <Group mt="md" wrap="wrap"><Button mih={44} variant={numeric(form.values.monthly_plan.wealth_allocation_percentage) === 100 ? 'filled' : 'light'} onClick={() => form.setFieldValue('monthly_plan.wealth_allocation_percentage', 100)}>Toda a sobra</Button><Button mih={44} variant={numeric(form.values.monthly_plan.wealth_allocation_percentage) === 50 ? 'filled' : 'light'} onClick={() => form.setFieldValue('monthly_plan.wealth_allocation_percentage', 50)}>Metade</Button></Group>
        <Slider aria-label="Percentual da sobra destinado a construir patrimônio" mt="xl" min={0} max={100} step={5} label={(value) => `${value}%`} value={numeric(form.values.monthly_plan.wealth_allocation_percentage)} onChange={(value) => form.setFieldValue('monthly_plan.wealth_allocation_percentage', value)} marks={[{ value: 0, label: '0%' }, { value: 50, label: '50%' }, { value: 100, label: '100%' }]} />
        <NumberInput mt="xl" label="Percentual da sobra" suffix="%" min={0} max={100} {...form.getInputProps('monthly_plan.wealth_allocation_percentage')} />
      </Paper>
      {derived.financedAmount > 0 && <Paper withBorder radius="lg" p={{ base: 'md', sm: 'lg' }}>
        <Text fw={700}>Na compra financiada</Text><Text size="sm" c="dimmed">Divida o mesmo orçamento patrimonial entre investimento e amortização.</Text>
        <Slider aria-label="Percentual do plano patrimonial destinado a amortizar" mt="xl" min={0} max={100} step={5} label={(value) => `${value}% amortizar`} value={amortizationPercentage} onChange={(value) => form.setFieldValue('monthly_plan.financed_purchase.amortization_percentage', value)} marks={[{ value: 0, label: 'Investir' }, { value: 50, label: '50/50' }, { value: 100, label: 'Amortizar' }]} />
        <NumberInput mt="xl" label="Parcela do plano para amortização" suffix="%" min={0} max={100} {...form.getInputProps('monthly_plan.financed_purchase.amortization_percentage')} />
        {amortizationPercentage > 0 && <SegmentedControl mt="md" fullWidth value={form.values.monthly_plan.financed_purchase.amortization_effect} onChange={(value) => form.setFieldValue('monthly_plan.financed_purchase.amortization_effect', value as 'reduce_term' | 'reduce_payment')} data={[{ value: 'reduce_term', label: 'Reduzir prazo' }, { value: 'reduce_payment', label: 'Reduzir parcela' }]} />}
      </Paper>}
      <Alert color="blue" icon={<IconInfoCircle size={18} />} title="Prévia do primeiro mês">Valores futuros mudam com juros, inflação e amortizações. Esta prévia ajuda a conferir a lógica antes da projeção.</Alert>
      <Grid><Grid.Col span={{ base: 12, md: 4 }}><BudgetPreview title={derived.financedAmount > 0 ? 'Comprar financiado' : 'Comprar à vista'} housing={derived.initialPayment + ownerCosts} form={form} financed={derived.financedAmount > 0} extraIncome={firstMonthExtraIncome} outstandingBalance={derived.financedAmount} /></Grid.Col><Grid.Col span={{ base: 12, md: 4 }}><BudgetPreview title="Alugar e investir" housing={derived.rentAmount + renterCosts} form={form} extraIncome={firstMonthExtraIncome} /></Grid.Col><Grid.Col span={{ base: 12, md: 4 }}><BudgetPreview title="Investir para comprar" housing={derived.rentAmount + renterCosts} form={form} extraIncome={firstMonthExtraIncome} /></Grid.Col></Grid>
    </FormSection>
  );
}

function createExtraIncome(kind: ExtraIncomeEventInput['kind']): ExtraIncomeEventInput {
  return { kind, amount: 0, month: kind === 'thirteenth_salary' ? 12 : 1, interval_months: kind === 'thirteenth_salary' ? 12 : null, end_month: null, inflation_adjust: false };
}

export function AssumptionsStep() {
  const form = useComparisonFormContext();
  const modules = form.values.ui.modules;
  const [ratesOpen, setRatesOpen] = useState(false);
  const ratesPanelId = useId();
  const extraIncomeTotal = useMemo(() => form.values.extra_income_events.reduce((sum, event) => sum + (event.amount || 0), 0), [form.values.extra_income_events]);
  const ratesHaveError = hasFormError(
    form.errors,
    'inflation_rate',
    'rent_inflation_rate',
    'property_appreciation_rate'
  );
  const returnsHaveError = hasFormError(form.errors, 'investment_returns');
  const taxHasError = hasFormError(form.errors, 'investment_tax');
  const extraIncomeHasError = hasFormError(form.errors, 'extra_income_events');
  const ratesDisplayed = ratesOpen || ratesHaveError;
  const enableVariableReturns = () => {
    form.setFieldValue('investment_returns', [
      {
        start_month: 1,
        end_month: null,
        annual_rate: numeric(form.values.ui.base_investment_return),
      },
    ]);
    setModule(form, 'variableReturns', true);
  };
  const disableVariableReturns = () => {
    const initialRate = form.values.investment_returns[0]?.annual_rate;
    if (hasNumber(initialRate)) {
      form.setFieldValue('ui.base_investment_return', initialRate);
    }
    setModule(form, 'variableReturns', false);
  };
  const enableExtraIncome = () => {
    if (form.values.extra_income_events.length === 0) {
      form.setFieldValue('extra_income_events', [
        createExtraIncome('thirteenth_salary'),
      ]);
    }
    setModule(form, 'extraIncome', true);
  };
  return (
    <FormSection title="Quais premissas completam o plano?" description="Comece simples e abra apenas o que realmente existe na sua realidade." icon={<IconChartLine size={20} />}>
      <Title order={4} size="h4">Investimento</Title>
      {!modules.variableReturns && <NumberInput label="Retorno nominal anual esperado" description="Antes da inflação. Se a taxa já for líquida de impostos, não ative a tributação abaixo." suffix="% a.a." min={-99.9} max={1000} {...form.getInputProps('ui.base_investment_return')} />}
      <Paper withBorder radius="lg" p="md"><Group justify="space-between" wrap="wrap"><Box><Text fw={650}>Premissas econômicas</Text><Text size="sm" c="dimmed">Inflação {economicRateSummary(form.values.inflation_rate, 'sem correção')} · aluguel {economicRateSummary(form.values.rent_inflation_rate, 'igual à inflação geral')} · imóvel {economicRateSummary(form.values.property_appreciation_rate, 'igual à inflação geral')}</Text></Box><Button variant="subtle" mih={44} onClick={() => setRatesOpen((value) => !value)} rightSection={ratesDisplayed ? <IconChevronUp size={15} /> : <IconChevronDown size={15} />} aria-label={`${ratesDisplayed ? 'Ocultar' : 'Editar'} premissas econômicas`} aria-expanded={ratesDisplayed} aria-controls={ratesPanelId}>{ratesDisplayed ? 'Ocultar' : 'Editar'}</Button></Group><Collapse id={ratesPanelId} in={ratesDisplayed}><SimpleGrid cols={{ base: 1, sm: 3 }} mt="md"><NumberInput label="Inflação geral" description="Em branco: sem correção geral" placeholder="Sem correção" suffix="% a.a." min={0} max={1000} {...form.getInputProps('inflation_rate')} /><NumberInput label="Reajuste do aluguel" description="Em branco: igual à inflação geral" placeholder="Igual à inflação geral" suffix="% a.a." min={0} max={1000} {...form.getInputProps('rent_inflation_rate')} /><NumberInput label="Valorização do imóvel" description="Em branco: igual à inflação geral" placeholder="Igual à inflação geral" suffix="% a.a." min={0} max={1000} {...form.getInputProps('property_appreciation_rate')} /></SimpleGrid></Collapse></Paper>
      <Box><Group gap="xs"><IconAdjustments size={18} /><Text fw={700}>Detalhes opcionais</Text></Group><SimpleGrid cols={{ base: 1, sm: 3 }} mt="md"><OptionCard title="Retornos por período" description="Taxas diferentes ao longo da projeção." icon={<IconChartLine size={18} />} enabled={modules.variableReturns} onAdd={enableVariableReturns} /><OptionCard title="Imposto sobre investimentos" description="Use quando a taxa informada ainda for bruta." icon={<IconReceipt size={18} />} enabled={modules.investmentTax} onAdd={() => setModule(form, 'investmentTax', true)} /><OptionCard title="13º, bônus ou renda extra" description="Adicione recursos futuros comuns às três estratégias." icon={<IconBriefcase size={18} />} enabled={modules.extraIncome} onAdd={enableExtraIncome} /></SimpleGrid></Box>
      {modules.variableReturns && <ActiveOption title="Retornos por período" description="Taxas nominais anuais, antes da inflação; os períodos cobrem toda a projeção." onRemove={disableVariableReturns} hasError={returnsHaveError}><InvestmentReturnsFieldArray value={form.values.investment_returns} onChange={(value) => form.setFieldValue('investment_returns', value)} errors={form.errors} /></ActiveOption>}
      {modules.investmentTax && <ActiveOption title="Imposto sobre investimentos" description="Aproximação efetiva sobre ganhos." onRemove={() => setModule(form, 'investmentTax', false)} hasError={taxHasError}><SimpleGrid cols={{ base: 1, sm: 2 }}><Select label="Momento da cobrança" data={[{ value: 'on_withdrawal', label: 'Nos resgates simulados' }, { value: 'monthly', label: 'Em cada rendimento mensal' }]} {...form.getInputProps('investment_tax.mode')} /><NumberInput label="Alíquota efetiva" suffix="%" min={0} max={100} {...form.getInputProps('investment_tax.effective_tax_rate')} /></SimpleGrid></ActiveOption>}
      {modules.extraIncome && <ActiveOption title="Rendas extras" description={`Eventos cadastrados: ${form.values.extra_income_events.length} · valores-base ${money(extraIncomeTotal)}`} onRemove={() => setModule(form, 'extraIncome', false)} hasError={extraIncomeHasError}>
        <Stack gap="md">{form.values.extra_income_events.map((event, index) => <Paper key={index} withBorder p="md"><Group justify="space-between" align="flex-start" wrap="wrap"><Text fw={650}>Renda extra {index + 1}</Text><Button variant="subtle" color="red" size="sm" mih={44} onClick={() => form.removeListItem('extra_income_events', index)} leftSection={<IconTrash size={14} />}>Excluir</Button></Group><SimpleGrid cols={{ base: 1, sm: 2 }} mt="sm"><Select label="Tipo" data={[{ value: 'thirteenth_salary', label: '13º salário' }, { value: 'bonus', label: 'Bônus' }, { value: 'other', label: 'Outra renda' }]} {...form.getInputProps(`extra_income_events.${index}.kind`)} /><TextInput label="Nome opcional" maxLength={80} {...form.getInputProps(`extra_income_events.${index}.label`)} /><NumberInput label="Valor" {...MONEY_PROPS} {...form.getInputProps(`extra_income_events.${index}.amount`)} /><NumberInput label="Primeiro mês" min={1} max={600} allowDecimal={false} {...form.getInputProps(`extra_income_events.${index}.month`)} /><NumberInput label="Repetir a cada" suffix=" meses" placeholder="Uma vez" min={1} max={600} allowDecimal={false} {...form.getInputProps(`extra_income_events.${index}.interval_months`)} /><NumberInput label="Até o mês" placeholder="Até o horizonte" min={1} max={600} allowDecimal={false} {...form.getInputProps(`extra_income_events.${index}.end_month`)} /></SimpleGrid><Checkbox mt="sm" label="Corrigir o valor pela inflação desde hoje" {...form.getInputProps(`extra_income_events.${index}.inflation_adjust`, { type: 'checkbox' })} /></Paper>)}<Group wrap="wrap"><Button variant="light" mih={44} disabled={form.values.extra_income_events.length >= 100} onClick={() => form.insertListItem('extra_income_events', createExtraIncome('bonus'))}>Adicionar bônus</Button><Button variant="light" mih={44} disabled={form.values.extra_income_events.length >= 100} onClick={() => form.insertListItem('extra_income_events', createExtraIncome('other'))}>Adicionar outra renda</Button></Group></Stack>
      </ActiveOption>}
    </FormSection>
  );
}
