import { cloneElement, isValidElement, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactElement } from 'react';
import type { ReactNode } from '../types/react';
import {
  Title,
  Stack,
  Group,
  Paper,
  Text,
  Collapse,
  Table,
  SimpleGrid,
  ScrollArea,
  SegmentedControl,
  Tabs,
  Badge,
  Switch,
  Alert,
  Menu,
  Button,
  Box,
  rem,
  ThemeIcon,
  Divider,
  Popover,
  ActionIcon,
} from '@mantine/core';
import type { PopoverProps } from '@mantine/core';
import type {
  ComparisonScenarioType,
  ComparisonInput,
  EnhancedComparisonResult,
  EnhancedComparisonScenario,
} from '../api/types';
import {
  money,
  moneyCompact,
  percent,
  formatMonthsYears,
  formatMonthLabel,
  formatYearTickFromMonth,
  signedMoney,
  signedPercent,
  yearFromMonth,
  ratio,
  ratioAsPercent,
} from '../utils/format';
import { AreaChart, LineChart } from '@mantine/charts';
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconCrown,
  IconChartLine,
  IconBuildingBank,
  IconSettings,
  IconDownload,
  IconTable,
  IconChartArea,
  IconPigMoney,
  IconHelpCircle,
  IconAlertCircle,
} from '@tabler/icons-react';
import { downloadFile } from '../utils/download';

/**
 * Column group definitions for standardized table headers
 */
interface ColumnGroup {
  label: string;
  color?: string;
  columns: string[];
}

const RESULT_SURFACE_STYLE = {
  background: 'var(--farol-surface-raised)',
  border: '1px solid var(--farol-border)',
  borderRadius: 'var(--mantine-radius-lg)',
  boxShadow: 'none',
} as const;

const RESULT_SUBTLE_SURFACE_STYLE = {
  background: 'var(--farol-surface-muted)',
  border: '1px solid var(--farol-border)',
  borderRadius: 'var(--mantine-radius-md)',
} as const;

const SCENARIO_CHART_COLORS = [
  'var(--farol-chart-1)',
  'var(--farol-chart-2)',
  'var(--farol-chart-3)',
] as const;

interface ExplanationTargetProps {
  role?: string;
  tabIndex?: number;
  style?: React.CSSProperties;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLElement>) => void;
  'aria-label'?: string;
}

interface AccessibleExplanationProps {
  label: ReactNode;
  children: ReactElement<ExplanationTargetProps>;
  w?: number | string;
  maw?: number | string;
  position?: PopoverProps['position'];
  withArrow?: boolean;
  multiline?: boolean;
}

/**
 * Drop-in replacement for the former hover-only hints. It is intentionally a
 * popover: pointer, touch, Enter and Space all expose the same explanation.
 */
function ExplanationPopover({
  label,
  children,
  w,
  maw,
  position = 'bottom-start',
  withArrow = true,
}: AccessibleExplanationProps) {
  const [opened, setOpened] = useState(false);
  if (!isValidElement(children)) return null;

  const target = children as ReactElement<ExplanationTargetProps>;
  const accessibleTarget = cloneElement(target, {
    role: target.props.role ?? 'button',
    tabIndex: target.props.tabIndex ?? 0,
    'aria-label': target.props['aria-label'],
    style: {
      minWidth: rem(44),
      minHeight: rem(44),
      display: 'inline-flex',
      alignItems: 'center',
      cursor: 'pointer',
      ...target.props.style,
    },
    onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
      target.props.onKeyDown?.(event);
      if (event.defaultPrevented) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpened((current) => !current);
      } else if (event.key === 'Escape' && opened) {
        event.preventDefault();
        setOpened(false);
      }
    },
  });

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      width={w ?? maw ?? 320}
      position={position}
      withArrow={withArrow}
      shadow="md"
      withinPortal
      returnFocus
    >
      <Popover.Target>{accessibleTarget}</Popover.Target>
      <Popover.Dropdown>{label}</Popover.Dropdown>
    </Popover>
  );
}

const getAmortizationParts = (m: any) => {
  const extraCashRaw = typeof m?.extra_amortization_cash === 'number' ? m.extra_amortization_cash : 0;
  const extraFgts = typeof m?.extra_amortization_fgts === 'number' ? m.extra_amortization_fgts : 0;
  const extraBonus = typeof m?.extra_amortization_bonus === 'number' ? m.extra_amortization_bonus : 0;
  const extra13Salario = typeof m?.extra_amortization_13_salario === 'number' ? m.extra_amortization_13_salario : 0;
  const extraTotalFallback = typeof m?.extra_amortization === 'number' ? m.extra_amortization : 0;
  const extraTotalKnown = extraCashRaw + extraFgts + extraBonus + extra13Salario;
  const extraTotal = extraTotalKnown || extraTotalFallback;
  const extraCash = extraTotalKnown > 0 ? extraCashRaw : (extraTotalFallback > 0 ? extraTotalFallback : 0);
  return {
    extraCash,
    extraFgts,
    extraBonus,
    extra13Salario,
    extraTotal,
  };
};

const getRegularInstallment = (m: any) => {
  const explicitBase = typeof m?.installment_base === 'number' ? m.installment_base : null;
  if (explicitBase != null) return explicitBase;
  const installment = typeof m?.installment === 'number' ? m.installment : 0;
  const { extraTotal } = getAmortizationParts(m);
  return Math.max(0, installment - extraTotal);
};

const getRegularPrincipal = (m: any) => {
  const explicitBase = typeof m?.principal_base === 'number' ? m.principal_base : null;
  if (explicitBase != null) return explicitBase;
  const principal = typeof m?.principal_payment === 'number' ? m.principal_payment : 0;
  const { extraTotal } = getAmortizationParts(m);
  return Math.max(0, principal - extraTotal);
};

const isFiniteNumber = (v: any): v is number => typeof v === 'number' && Number.isFinite(v);
const asNumberOrZero = (v: any) => (isFiniteNumber(v) ? v : 0);
const roi = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? 'N/D' : percent(value);

/**
 * Canonical housing cost used for affordability (card + table must match).
 * - For buy: use backend `housing_due` when available (already includes extra cash amortization exactly once).
 *   Otherwise fall back to (installment_base + monthly_costs + extra_cash).
 * - For rent scenarios: use `housing_due` when available, otherwise (rent_due + monthly_costs).
 */
const housingCostForAffordability = (m: any) => {
  const housingDue = isFiniteNumber(m?.housing_due) ? m.housing_due : null;
  if (housingDue != null) return housingDue;

  const monthlyCosts = asNumberOrZero(m?.monthly_additional_costs);
  const rentDue = asNumberOrZero(m?.rent_due);
  const looksLikeBuy = m?.installment != null || m?.outstanding_balance != null || m?.installment_base != null;
  if (looksLikeBuy) {
    const { extraCash } = getAmortizationParts(m);
    const installmentBase = getRegularInstallment(m);
    return installmentBase + monthlyCosts + extraCash;
  }

  return rentDue + monthlyCosts;
};

/**
 * Calculates the recurring housing cost for a month.
 * For affordability analysis, we can optionally include extra amortizations.
 * Bonus, 13_salario and FGTS amortizations are excluded from affordability
 * since they are funded by extraordinary or external sources.
 */
const recurringHousingCost = (m: any, includeExtraAmortization = false) => {
  // Base cost calculation
  let baseCost = 0;
  const { extraCash } = getAmortizationParts(m);
  const regularInstallment = getRegularInstallment(m);

  // Prefer explicit housing_due when provided (rent + HOA/IPTU or installment + costs).
  // For buy scenario, backend housing_due already includes extra cash amortization.
  const hasHousingDue = isFiniteNumber(m?.housing_due);
  if (hasHousingDue) {
    baseCost = m.housing_due;
  } else if (m?.installment != null) {
    // For buy scenario (and some post-purchase months), approximate housing as installment + recurring costs.
    const additional = m?.monthly_additional_costs ?? 0;
    baseCost = regularInstallment + additional;
  } else if (m?.monthly_additional_costs != null) {
    // Post-purchase invest-buy months may have only HOA/IPTU.
    baseCost = m?.monthly_additional_costs ?? 0;
  }

  if (includeExtraAmortization) {
    // Include cash amortizations but NOT bonus/13_salario/FGTS (those are external)
    // Avoid double-counting if housing_due already includes extra cash amortization.
    if (!hasHousingDue) baseCost += extraCash;
  }

  return baseCost;
};

/**
 * Gets the effective surplus (sobra) for a month, using backend-calculated values.
 * This ensures inflation-adjusted income is used in all calculations.
 *
 * Priority:
 * 1. Use backend's effective_income if available (inflation-adjusted)
 * 2. Fall back to frontend's static monthlyNetIncome
 *
 * Returns: { surplus: number | null, effectiveIncome: number | null }
 */
const getEffectiveSurplus = (
  m: any,
  housingCost: number,
  monthlyNetIncome: number | null,
  includeExtraAmortization = false
): { surplus: number | null; effectiveIncome: number | null } => {
  // If backend provides income_surplus_available, we can derive info
  // But we need the effective_income to know the actual income used
  const effectiveIncome = m?.effective_income ?? monthlyNetIncome;

  if (effectiveIncome == null) {
    return { surplus: null, effectiveIncome: null };
  }

  // Backend provides income_surplus_available only when surplus > 0
  // We need to calculate the actual surplus including negative values
  const surplus = effectiveIncome - housingCost;

  return { surplus, effectiveIncome };
};

/**
 * Generates a detailed breakdown tooltip explaining the "Sobra" (surplus) calculation.
 * This helps users understand exactly what is being deducted from their net income.
 * Note: netIncome should be the effective (inflation-adjusted) income for the specific month.
 */
const SurplusBreakdown = ({
  netIncome,
  housingCost,
  installment,
  rent,
  monthlyCosts,
  extraAmortCash,
  scenarioType,
  incomeAdjusted,
}: {
  netIncome: number;
  housingCost: number;
  installment?: number;
  rent?: number;
  monthlyCosts?: number;
  extraAmortCash?: number;
  scenarioType: 'buy' | 'rent_invest' | 'invest_buy';
  incomeAdjusted?: boolean;
}) => {
  const surplus = netIncome - housingCost;

  const getScenarioLabel = () => {
    switch (scenarioType) {
      case 'buy': return 'Financiamento';
      case 'rent_invest': return 'Alugar + Investir';
      case 'invest_buy': return 'Investir para Comprar';
    }
  };

  const costRows = [];

  if (scenarioType === 'buy') {
    if (installment && installment > 0) {
      costRows.push({ label: 'Parcela do financiamento', value: installment });
    }
    if (monthlyCosts && monthlyCosts > 0) {
      costRows.push({ label: 'Condomínio + IPTU', value: monthlyCosts });
    }
    if (extraAmortCash && extraAmortCash > 0) {
      costRows.push({ label: 'Amortização extra (cash)', value: extraAmortCash });
    }
  } else {
    if (rent && rent > 0) {
      costRows.push({ label: 'Aluguel', value: rent });
    }
    if (monthlyCosts && monthlyCosts > 0) {
      costRows.push({ label: 'Condomínio + IPTU', value: monthlyCosts });
    }
  }

  return (
    <Stack gap={6}>
      <Text size="xs" fw={700} c="bright">
        Cálculo da Sobra ({getScenarioLabel()})
      </Text>
      <Divider size="xs" />
      <Group justify="space-between" gap={16}>
        <Text size="xs" c="var(--farol-chart-1)">
          Orçamento mensal disponível{incomeAdjusted ? ' (corrigido pela inflação)' : ''}
        </Text>
        <Text size="xs" fw={600}>{money(netIncome)}</Text>
      </Group>
      <Text size="xs" fw={600} c="dimmed" mt={4}>Menos custos recorrentes:</Text>
      {costRows.map((row, idx) => (
        <Group key={idx} justify="space-between" gap={16}>
          <Text size="xs" c="dimmed">− {row.label}</Text>
          <Text size="xs">{money(row.value)}</Text>
        </Group>
      ))}
      <Divider size="xs" my={4} />
      <Group justify="space-between" gap={16}>
        <Text size="xs" fw={700}>= Sobra mensal</Text>
        <Text size="xs" fw={700} c={surplus >= 0 ? 'var(--farol-chart-positive)' : 'var(--farol-chart-negative)'}>
          {signedMoney(surplus)}
        </Text>
      </Group>
      <Text size="xs" c="dimmed" mt={6} fs="italic">
        Nota: Os custos são corrigidos pela inflação ao longo do tempo.
        {incomeAdjusted && ' O orçamento disponível também é corrigido.'}{' '}
        Custos pontuais (ITBI, escritura) e aportes não são incluídos.
        {scenarioType === 'buy' && ' Amortizações de FGTS, Bônus e 13º não são consideradas (fontes externas/extraordinárias).'}
      </Text>
    </Stack>
  );
};

/**
 * Generates a tooltip explaining the "Saída Total" (total outflow) for invest-buy scenario,
 * with special handling for month 1 where initial allocation appears.
 */
const InvestBuyOutflowExplanation = ({
  m
}: {
  m: any;
}) => {
  const total = m?.total_monthly_cost ?? 0;
  const rent = m?.rent_due ?? 0;
  const monthlyCosts = m?.monthly_additional_costs ?? 0;
  const initialAllocation = m?.initial_allocation ?? 0;
  const additionalInvestment = m?.additional_investment ?? 0;
  const contributions = m?.extra_contribution_total ?? 0;
  const upfrontCosts = m?.upfront_additional_costs ?? 0;
  const fgtsUsed = m?.fgts_used ?? 0;
  const isPurchaseMonth = m?.status === 'Imóvel comprado' && m?.phase === 'post_purchase';
  const isMonth1 = m?.month === 1;

  return (
    <Stack gap={6}>
      <Text size="xs" fw={700} c="bright">
        Composição da Saída Total (Mês {m?.month})
      </Text>
      <Divider size="xs" />

      {/* Housing costs */}
      <Text size="xs" fw={600} c="dimmed">Custos de Moradia:</Text>
      {rent > 0 && (
        <Group justify="space-between" gap={16}>
          <Text size="xs" c="dimmed">Aluguel</Text>
          <Text size="xs">{money(rent)}</Text>
        </Group>
      )}
      {monthlyCosts > 0 && (
        <Group justify="space-between" gap={16}>
          <Text size="xs" c="dimmed">Condomínio + IPTU</Text>
          <Text size="xs">{money(monthlyCosts)}</Text>
        </Group>
      )}

      {/* Investments/Allocations */}
      {(initialAllocation > 0 || additionalInvestment > 0 || contributions > 0) && (
        <>
          <Text size="xs" fw={600} c="dimmed" mt={4}>Alocações em Investimento:</Text>
          {initialAllocation > 0 && (
            <Group justify="space-between" gap={16}>
              <Text size="xs" c="dimmed">Alocação inicial (entrada)</Text>
              <Text size="xs">{money(initialAllocation)}</Text>
            </Group>
          )}
          {contributions > 0 && (
            <Group justify="space-between" gap={16}>
              <Text size="xs" c="dimmed">Aportes programados</Text>
              <Text size="xs">{money(contributions)}</Text>
            </Group>
          )}
          {additionalInvestment > 0 && (
            <Group justify="space-between" gap={16}>
              <Text size="xs" c="dimmed">Investimento adicional</Text>
              <Text size="xs">{money(additionalInvestment)}</Text>
            </Group>
          )}
        </>
      )}

      {/* Purchase costs (only on purchase month) */}
      {isPurchaseMonth && upfrontCosts > 0 && (
        <>
          <Text size="xs" fw={600} c="dimmed" mt={4}>Custos da Compra:</Text>
          <Group justify="space-between" gap={16}>
            <Text size="xs" c="dimmed">ITBI + Escritura</Text>
            <Text size="xs">{money(upfrontCosts)}</Text>
          </Group>
        </>
      )}

      {fgtsUsed > 0 && (
        <Group justify="space-between" gap={16}>
          <Text size="xs" c="dimmed">FGTS utilizado</Text>
          <Text size="xs">{money(fgtsUsed)}</Text>
        </Group>
      )}

      <Divider size="xs" my={4} />
      <Group justify="space-between" gap={16}>
        <Text size="xs" fw={700}>Total</Text>
        <Text size="xs" fw={700}>{money(total)}</Text>
      </Group>

      {isMonth1 && initialAllocation > 0 && (
        <Text size="xs" c="dimmed" fs="italic" mt={4}>
          O mês 1 inclui a alocação inicial de capital, por isso o valor é maior.
        </Text>
      )}
    </Stack>
  );
};

interface ScenarioCardNewProps {
  scenario: EnhancedComparisonScenario;
  isBest: boolean;
  bestScenario: EnhancedComparisonScenario | null;
  index: number;
  monthlyNetIncome?: number | null;
}

function ScenarioCardNew({ scenario, isBest, bestScenario, index, monthlyNetIncome }: ScenarioCardNewProps) {
  const s = scenario;
  const titleId = useId();
  const [showDetails, setShowDetails] = useState(false);
  const visualByType: Record<ComparisonScenarioType, { color: 'ocean' | 'teal' | 'violet'; icon: ReactNode; subtitle: string }> = {
    buy: { color: 'ocean', icon: <IconBuildingBank size={24} />, subtitle: 'Financiamento imobiliário' },
    rent_invest: { color: 'teal', icon: <IconChartLine size={24} />, subtitle: 'Aluguel + investimento' },
    invest_buy: { color: 'violet', icon: <IconPigMoney size={24} />, subtitle: 'Investir para comprar' },
  };
  const visual = visualByType[s.scenario_type] ?? {
    color: (['ocean', 'teal', 'violet'] as const)[index % 3],
    icon: <IconChartLine size={24} />,
    subtitle: 'Estratégia simulada',
  };
  const color = visual.color;

  // Backend semantics:
  // - final_equity (a.k.a. final_wealth) represents total wealth at the end (imóvel + investimentos + FGTS).
  // - equity (monthly record) represents property equity only (imóvel - saldo devedor).
  const finalWealth = (s.final_wealth ?? s.final_equity) as number;
  const bestFinalWealth = bestScenario == null
    ? null
    : (bestScenario.final_wealth ?? bestScenario.final_equity);
  const wealthDelta = bestFinalWealth == null ? null : finalWealth - bestFinalWealth;
  const estimatedConsumption = s.total_consumption ?? s.total_cost;

  const lastMonth = Array.isArray(s.monthly_data) && s.monthly_data.length > 0
    ? s.monthly_data[s.monthly_data.length - 1]
    : null;
  const propertyEquity = (lastMonth?.equity ?? 0) as number;

  const firstMonth = Array.isArray(s.monthly_data) && s.monthly_data.length > 0
    ? (s.monthly_data.find((m: any) => m.month === 1) || s.monthly_data[0])
    : null;
  // For affordability analysis, use the canonical cost rule (must match the table).
  const housingCostMonth1 = firstMonth ? housingCostForAffordability(firstMonth) : 0;
  // Use effective_income from backend (inflation-adjusted) or fall back to static input
  const effectiveIncomeMonth1 = firstMonth?.effective_income ?? monthlyNetIncome;
  const incomeSurplusMonth1 =
    typeof effectiveIncomeMonth1 === 'number' ? effectiveIncomeMonth1 - housingCostMonth1 : null;

  // Affordability metrics: calculate % of income used and months with negative surplus
  // Uses inflation-adjusted income (effective_income) from backend when available
  const affordabilityMetrics = (() => {
    if (typeof monthlyNetIncome !== 'number' || monthlyNetIncome <= 0) return null;

    const monthlyData = Array.isArray(s.monthly_data) ? s.monthly_data : [];
    let monthsNegative = 0;
    let totalHousingCost = 0;
    let totalIncome = 0;
    let validMonths = 0;
    let maxHousingCost = 0;
    let maxHousingMonth = 1;
    let maxDeficit = 0;
    let maxDeficitIncome = monthlyNetIncome;

    for (const m of monthlyData) {
      const cost = housingCostForAffordability(m);
      const effectiveIncome = isFiniteNumber(m?.effective_income) ? m.effective_income : monthlyNetIncome;

      if (cost > 0 && effectiveIncome > 0) {
        totalHousingCost += cost;
        totalIncome += effectiveIncome;
        validMonths++;
        // Compare against inflation-adjusted income for this specific month
        const deficit = cost - effectiveIncome;
        if (deficit > 0) {
          monthsNegative++;
          if (deficit > maxDeficit) {
            maxDeficit = deficit;
            maxHousingCost = cost;
            maxHousingMonth = m.month;
            maxDeficitIncome = effectiveIncome;
          }
        }
      }
    }

    const incomeUsedMonth1 = housingCostMonth1 > 0 && effectiveIncomeMonth1
      ? (housingCostMonth1 / effectiveIncomeMonth1) * 100
      : 0;
    const avgIncomeUsed = totalIncome > 0
      ? (totalHousingCost / totalIncome) * 100
      : 0;

    return {
      incomeUsedMonth1,
      avgIncomeUsed,
      monthsNegative,
      totalMonths: validMonths,
      maxHousingCost,
      maxHousingMonth,
      maxDeficit,
      maxDeficitIncome,
    };
  })();

  const Help = ({ label, help }: { label: string; help: ReactNode }) => (
    <ExplanationPopover label={help} multiline maw={320} withArrow position="top-start">
      <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Entenda: ${label}`}>
        <IconHelpCircle size={14} />
      </ActionIcon>
    </ExplanationPopover>
  );

  return (
    <Paper
      component="article"
      aria-labelledby={titleId}
      p={{ base: 'md', sm: 'lg' }}
      radius="lg"
      shadow="none"
      withBorder
      style={{
        background: isBest
          ? 'var(--farol-surface-accent)'
          : 'var(--farol-surface-raised)',
        borderColor: isBest
          ? 'var(--mantine-color-ocean-4)'
          : 'var(--mantine-color-default-border)',
        borderWidth: isBest ? rem(2) : rem(1),
        height: '100%',
      }}
    >
      <Group justify="space-between" align="flex-start" gap="sm" mb="lg" wrap="wrap">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          <ThemeIcon
            size={44}
            radius="md"
            variant={isBest ? 'filled' : 'light'}
            color={color}
          >
            {visual.icon}
          </ThemeIcon>
          <Box style={{ minWidth: 0 }}>
            <Text id={titleId} component="h3" fw={700} size="lg" c="bright" style={{ overflowWrap: 'anywhere' }}>
              {s.name}
            </Text>
            <Text size="sm" c="dimmed">
              {visual.subtitle}
            </Text>
          </Box>
        </Group>
        {isBest && (
          <Badge color="ocean" variant="filled" size="sm" leftSection={<IconCrown size={12} />}>
            Maior patrimônio
          </Badge>
        )}
      </Group>

      {/* Main Metric - Patrimônio */}
      <Box
        p="lg"
        mb="lg"
        style={RESULT_SUBTLE_SURFACE_STYLE}
      >
        <Group gap={6} align="center" wrap="nowrap">
          <Text size="xs" c="var(--farol-chart-1)" tt="uppercase" fw={500} style={{ letterSpacing: '0.5px' }}>
            Patrimônio Líquido Final
          </Text>
          <Help
            label="Patrimônio Líquido Final"
            help="Ativos finais (equidade, investimentos, FGTS e caixa residual) menos obrigações não financiadas."
          />
        </Group>
        <Text
          fw={700}
          style={{ fontSize: rem(30), lineHeight: 1.15, overflowWrap: 'anywhere' }}
          c="bright"
        >
          {money(finalWealth)}
        </Text>
        {!isBest && wealthDelta != null && wealthDelta !== 0 && (
          <Group gap={4} mt={4}>
            {wealthDelta < 0 ? (
              <IconArrowDownRight size={14} color="var(--farol-chart-negative)" aria-hidden="true" />
            ) : (
              <IconArrowUpRight size={14} color="var(--farol-chart-positive)" aria-hidden="true" />
            )}
            <Text size="xs" c={wealthDelta < 0 ? 'var(--farol-chart-negative)' : 'var(--farol-chart-positive)'} fw={500}>
              {wealthDelta > 0 ? '+' : ''}{money(wealthDelta)} vs melhor
            </Text>
          </Group>
        )}
      </Box>

      {/* Metrics Grid */}
      <SimpleGrid cols={{ base: 1, xs: 2, md: 1, xl: 2 }} spacing="sm">
        <Box p="sm" style={RESULT_SUBTLE_SURFACE_STYLE}>
          <Group gap={6} align="center" wrap="nowrap" mb={2}>
            <Text size="xs" c="dimmed">
              Consumo estimado
            </Text>
            <Help
              label="Consumo estimado"
              help="Gastos que não viram ativo, como juros, aluguel, condomínio, IPTU e custos de transação. Quando o backend legado não informa essa decomposição, exibimos o custo antigo apenas como aproximação. O ranking não usa este valor isoladamente."
            />
          </Group>
          <Group gap={4} align="center">
            <Text fw={600} size="md" c="bright">
              {money(estimatedConsumption)}
            </Text>
          </Group>
        </Box>
        <Box p="sm" style={RESULT_SUBTLE_SURFACE_STYLE}>
          <Group gap={6} align="center" wrap="nowrap" mb={2}>
            <Text size="xs" c="dimmed">
              Equidade
            </Text>
            <Help
              label="Equidade"
              help="Equidade do imóvel (valor do imóvel menos saldo devedor). Não inclui investimentos nem FGTS. Em cenários sem compra, fica 0."
            />
          </Group>
          <Text fw={600} size="md" c="bright">
            {money(propertyEquity)}
          </Text>
        </Box>
        <Box p="sm" style={RESULT_SUBTLE_SURFACE_STYLE}>
          <Group gap={6} align="center" wrap="nowrap" mb={2}>
            <Text size="xs" c="dimmed">
              Retorno comparável
            </Text>
            <Help
              label="Retorno comparável"
              help="Só é exibido quando a simulação consegue isolar uma base de capital adequada. Orçamento mensal acumulado e outros fluxos externos não são tratados como retorno; nesses casos, mostramos N/D."
            />
          </Group>
          <Text fw={600} size="md" c="bright">
            {roi(s.metrics.roi_percentage)}
          </Text>
        </Box>
        <Box p="sm" style={RESULT_SUBTLE_SURFACE_STYLE}>
          <Group gap={6} align="center" wrap="nowrap" mb={2}>
            <Text size="xs" c="dimmed">
              Saída mensal média
            </Text>
            <Help
              label="Saída mensal média"
              help="Média da saída total mensal ao longo do horizonte (inclui entrada/alocação inicial e aportes quando aplicável). Útil para comparar esforço de caixa entre estratégias."
            />
          </Group>
          <Text size="xs" c="dimmed" mb={2}>
            (inclui entrada/aportes)
          </Text>
          <Text fw={600} size="md" c="bright">
            {money(s.metrics.average_monthly_cost)}
          </Text>
        </Box>
        {incomeSurplusMonth1 != null && (
          <Box p="sm" style={RESULT_SUBTLE_SURFACE_STYLE}>
            <Group gap={6} align="center" wrap="nowrap" mb={2}>
              <Text size="xs" c="dimmed">
                Sobra mensal (mês 1)
              </Text>
              <Help
                label="Sobra mensal"
                help="Orçamento mensal disponível menos custo de moradia recorrente no mês 1 (parcela/aluguel + custos mensais)."
              />
            </Group>
            <Text
              fw={600}
              size="md"
              c={incomeSurplusMonth1 >= 0 ? 'var(--farol-chart-positive)' : 'var(--farol-chart-negative)'}
            >
              {signedMoney(incomeSurplusMonth1)}
            </Text>
          </Box>
        )}
        {affordabilityMetrics != null && (
          <Box p="sm" style={RESULT_SUBTLE_SURFACE_STYLE}>
            <Group gap={6} align="center" wrap="nowrap" mb={2}>
              <Text size="xs" c="dimmed">
                % do orçamento (mês 1)
              </Text>
              <Help
                label="% do orçamento comprometido"
                help="Percentual do orçamento mensal disponível comprometido com moradia no mês 1."
              />
            </Group>
            <Text
              fw={600}
              size="md"
              c={affordabilityMetrics.incomeUsedMonth1 <= 30 ? 'var(--farol-chart-positive)' : affordabilityMetrics.incomeUsedMonth1 <= 50 ? 'light-dark(var(--mantine-color-amber-8), var(--mantine-color-amber-3))' : 'var(--farol-chart-negative)'}
            >
              {affordabilityMetrics.incomeUsedMonth1.toFixed(1)}%
            </Text>
          </Box>
        )}
        {affordabilityMetrics != null && affordabilityMetrics.monthsNegative > 0 && (
          <Box p="sm" style={RESULT_SUBTLE_SURFACE_STYLE}>
            <Group gap={6} align="center" wrap="nowrap" mb={2}>
              <Text size="xs" c="dimmed">
                Meses no vermelho
              </Text>
              <Help
                label="Meses no vermelho"
                help="Quantidade de meses em que o custo de moradia excede o orçamento disponível naquele mês."
              />
            </Group>
            <Text fw={600} size="md" c="var(--farol-chart-negative)">
              {affordabilityMetrics.monthsNegative} de {affordabilityMetrics.totalMonths}
            </Text>
          </Box>
        )}
      </SimpleGrid>

      <Group gap="xs" mt="md" wrap="wrap">
        {s.is_feasible === false ? (
          <Badge color="red" variant="light">Fluxo inviável</Badge>
        ) : s.is_feasible === true ? (
          <Badge color="teal" variant="light">Fluxo viável</Badge>
        ) : (
          <Badge color="gray" variant="light">Viabilidade não avaliada</Badge>
        )}
        {(s.final_liabilities ?? 0) > 0 && (
          <Badge color="red" variant="outline">
            Passivos finais: {money(s.final_liabilities ?? 0)}
          </Badge>
        )}
        {(s.residual_cash_balance ?? 0) > 0 && (
          <Badge color="blue" variant="outline">
            Caixa residual: {money(s.residual_cash_balance ?? 0)}
          </Badge>
        )}
      </Group>

      {s.is_feasible === false && (
        <Alert
          mt="md"
          color="red"
          variant="light"
          icon={<IconAlertCircle size={16} />}
          title="Recursos insuficientes"
        >
          <Text size="xs">
            Faltaram {money(s.total_unfunded_amount ?? s.final_liabilities ?? 0)} ao longo da simulação
            {s.first_unfunded_month != null ? `, a partir do mês ${s.first_unfunded_month}` : ''}.
            Esse valor é tratado como passivo e o cenário não pode ser declarado vencedor.
          </Text>
        </Alert>
      )}

      {/* Affordability warning */}
      {affordabilityMetrics != null && affordabilityMetrics.monthsNegative > 0 && (
        <Alert
          mt="md"
          color="danger"
          variant="light"
          icon={<IconAlertCircle size={16} />}
          radius="md"
        >
          <Text size="sm" fw={600} c="var(--farol-chart-negative)">
            Atenção: orçamento do mês insuficiente em {affordabilityMetrics.monthsNegative} mês(es)
          </Text>
          <Text size="xs" c="dimmed">
            Em alguns meses, o custo de moradia excede o orçamento mensal disponível.
            Maior déficit: {money(affordabilityMetrics.maxDeficit)} no mês {affordabilityMetrics.maxHousingMonth}
            {' '}(custo {money(affordabilityMetrics.maxHousingCost)} vs orçamento {money(affordabilityMetrics.maxDeficitIncome)}).
          </Text>
        </Alert>
      )}

      <Button
        mt="md"
        variant="subtle"
        color="gray"
        size="sm"
        fullWidth
        style={{ minHeight: rem(44) }}
        onClick={() => setShowDetails((current) => !current)}
        aria-expanded={showDetails}
        aria-controls={`scenario-details-${s.scenario_type}`}
      >
        {showDetails ? 'Ocultar detalhes' : 'Ver composição e detalhes'}
      </Button>

      <Collapse in={showDetails}>
        <Box id={`scenario-details-${s.scenario_type}`}>
      {/* Purchase breakdown (buy scenario) */}
      {s.purchase_breakdown && (
        <Box
          p="md"
          mt="md"
          style={RESULT_SUBTLE_SURFACE_STYLE}
        >
          <Text size="xs" c="dimmed" fw={600} mb={6}>
            Composição da compra
          </Text>
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs">
            <Group gap={6} align="center">
              <Text size="sm" c="var(--farol-chart-1)">Entrada em dinheiro</Text>
              <Text size="sm" fw={700}>{money(s.purchase_breakdown.cash_down_payment)}</Text>
            </Group>
            <Group gap={6} align="center">
              <Text size="sm" c="var(--farol-chart-1)">FGTS na entrada</Text>
              <Text size="sm" fw={700}>{money(s.purchase_breakdown.fgts_at_purchase)}</Text>
            </Group>
            <Group gap={6} align="center">
              <Text size="sm" c="var(--farol-chart-1)">Financiado</Text>
              <Text size="sm" fw={700}>{money(s.purchase_breakdown.financed_amount)}</Text>
            </Group>
            <Group gap={6} align="center">
              <Text size="sm" c="var(--farol-chart-1)">Custos (ITBI+escritura)</Text>
              <Text size="sm" fw={700}>{money(s.purchase_breakdown.upfront_costs)}</Text>
            </Group>
          </SimpleGrid>
        </Box>
      )}

      {/* FGTS summary */}
      {s.fgts_summary && (
        <Box
          p="md"
          mt="md"
          style={{
            backgroundColor: 'light-dark(var(--mantine-color-ocean-0), var(--mantine-color-dark-7))',
            border: '1px solid light-dark(var(--mantine-color-ocean-2), var(--mantine-color-ocean-7))',
            borderRadius: 'var(--mantine-radius-md)',
          }}
        >
          <Group gap={8} mb={8}>
            <ThemeIcon size={28} radius="xl" color="ocean" variant="filled">
              <IconPigMoney size={16} />
            </ThemeIcon>
            <Box>
              <Text size="sm" fw={700}>FGTS</Text>
              <Text size="xs" c="dimmed">Saldo final {money(s.fgts_summary.final_balance)} | Saques {money(s.fgts_summary.total_withdrawn)}</Text>
            </Box>
          </Group>
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs">
            <Group gap={6} align="center">
              <Text size="sm" c="var(--farol-chart-1)">Usado na entrada</Text>
              <Text size="sm" fw={700}>{money(s.fgts_summary.withdrawn_at_purchase)}</Text>
            </Group>
            <Group gap={6} align="center">
              <Text size="sm" c="var(--farol-chart-1)">Amortizações FGTS</Text>
              <Text size="sm" fw={700}>{money(s.fgts_summary.withdrawn_for_amortizations)}</Text>
            </Group>
          </SimpleGrid>
          {s.fgts_summary.blocked_count > 0 && (
            <Alert
              mt={10}
              color="warning"
              variant="light"
              icon={<IconAlertCircle size={14} />}
            >
              <Text size="xs" fw={600} c="light-dark(var(--mantine-color-amber-8), var(--mantine-color-amber-3))">
                {s.fgts_summary.blocked_count} amortização(ões) FGTS não aplicada(s)
              </Text>
              <Text size="xs" c="dimmed">
                Valor solicitado: {money(s.fgts_summary.blocked_total_value)} (carência de 24 meses ou saldo insuficiente).
              </Text>
            </Alert>
          )}
        </Box>
      )}

      {/* Additional info */}
      <Divider my="md" color="var(--farol-border)" />
      <Group gap="xs" wrap="wrap">
        <Badge variant="light" color="ocean" size="sm">
          {s.monthly_data.length} meses
        </Badge>
        <Badge variant="light" color="ocean" size="sm">
          Juros/Aluguel: {money(s.metrics.total_interest_or_rent_paid)}
        </Badge>
        {s.opportunity_cost != null && s.opportunity_cost > 0 && (
          <Badge variant="light" color="info" size="sm">
            Ganho investimento: {money(s.opportunity_cost)}
          </Badge>
        )}
      </Group>
        </Box>
      </Collapse>
    </Paper>
  );
}

export default function EnhancedComparisonResults({
  result,
  inputPayload,
}: {
  result: EnhancedComparisonResult;
  inputPayload?: ComparisonInput;
}) {
  const [chartType, setChartType] = useState<'area' | 'line'>('line');
  const [overviewMetric, setOverviewMetric] = useState<'wealth' | 'outflow'>('wealth');
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [milestonesOnly, setMilestonesOnly] = useState(false);
  const [tableView, setTableView] = useState<'essential' | 'detailed'>('essential');
  const [showInputDetails, setShowInputDetails] = useState(false);
  const [showInputJson, setShowInputJson] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const downloadControllerRef = useRef<AbortController | null>(null);
  const resultTitleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    resultTitleRef.current?.focus({ preventScroll: true });
  }, []);
  useEffect(
    () => () => {
      downloadControllerRef.current?.abort();
      downloadControllerRef.current = null;
    },
    []
  );

  const handleExport = async (format: 'csv' | 'xlsx') => {
    if (!inputPayload) return;
    downloadControllerRef.current?.abort();
    const controller = new AbortController();
    downloadControllerRef.current = controller;
    setDownloadLoading(true);
    await downloadFile(
      `/api/compare-scenarios-enhanced/export?format=${format}`,
      'POST',
      inputPayload,
      `scenarios_comparison.${format}`,
      controller.signal
    );
    if (downloadControllerRef.current === controller) {
      downloadControllerRef.current = null;
      setDownloadLoading(false);
    }
  };

  const months = new Set<number>();
  const scenarioByMonth = new Map<string, Map<number, any>>();
  result.scenarios.forEach((s) => {
    const byMonth = new Map<number, any>();
    s.monthly_data.forEach((m: any) => {
      months.add(m.month);
      byMonth.set(m.month, m);
    });
    scenarioByMonth.set(s.name, byMonth);
  });
  const monthsSorted = Array.from(months).sort((a, b) => a - b);

  const moneySafe = (v: any) => money(v || 0);
  const percentSafe = (v: any, digits = 2) => {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) return '—';
    return percent(n, digits);
  };
  const numSafe = (v: any, digits = 2) => {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) return '—';
    return n.toFixed(digits);
  };
  const monthlyOutflow = (m: any) => {
    if (m?.total_monthly_cost != null) return m.total_monthly_cost;
    if (m?.cash_flow != null) return -m.cash_flow;
    return 0;
  };

  const outflowBreakdown = (m: any) => {
    const total = monthlyOutflow(m);
    const housing = recurringHousingCost(m);
    const initialAllocation = m?.initial_allocation ?? 0;
    const scheduledContribution = m?.extra_contribution_total ?? 0;
    const additionalInvestment = m?.additional_investment ?? 0;
    const upfront = m?.upfront_additional_costs ?? 0;
    const fgtsUsed = m?.fgts_used ?? 0;

    const rows = [
      { label: 'Moradia (mensal)', value: housing },
      { label: 'Alocação inicial (mês 1)', value: initialAllocation },
      { label: 'Aportes programados', value: scheduledContribution },
      { label: 'Aporte mensal/adicional', value: additionalInvestment },
      { label: 'Custos de compra (ITBI/escritura)', value: upfront },
      { label: 'FGTS usado', value: fgtsUsed },
    ].filter((r) => (r.value ?? 0) > 0.005);

    return (
      <Stack gap={4}>
        <Text size="xs" fw={600}>Saída total do mês (composição)</Text>
        {rows.length ? (
          rows.map((r) => (
            <Group key={r.label} justify="space-between" gap={12}>
              <Text size="xs" c="dimmed">{r.label}</Text>
              <Text size="xs" fw={600}>{money(r.value)}</Text>
            </Group>
          ))
        ) : (
          <Text size="xs" c="dimmed">Sem detalhamento disponível para este mês.</Text>
        )}
        <Divider my={2} />
        <Group justify="space-between" gap={12}>
          <Text size="xs" fw={700}>Total</Text>
          <Text size="xs" fw={700}>{money(total)}</Text>
        </Group>
        <Text size="xs" c="dimmed">
          Observação: o mês 1 costuma ser maior porque inclui a alocação inicial de capital (entrada/aporte inicial).
        </Text>
      </Stack>
    );
  };

  const horizonLabel = (monthsCount: number | null) => formatMonthsYears(monthsCount);
  const wealthAt = (m: any) =>
    (m?.equity || 0) +
    (m?.investment_balance || 0) +
    (m?.fgts_balance || 0) +
    (m?.residual_cash_balance || 0) -
    (m?.cumulative_unfunded_amount || 0);

  const inputSummary = (() => {
    if (!inputPayload) return null;

    const invReturns = Array.isArray(inputPayload?.investment_returns)
      ? inputPayload.investment_returns
      : [];
    const invReturnsLabel = invReturns.length
      ? invReturns
          .map((r: any) => {
            const start = r?.start_month ?? 1;
            const end = r?.end_month ?? '∞';
            const rate = r?.annual_rate;
            return `${start}-${end}: ${numSafe(rate, 2)}% a.a.`;
          })
          .join(' · ')
      : '—';

    const amortizations = Array.isArray(inputPayload?.amortizations)
      ? inputPayload.amortizations
      : [];
    const contributions = Array.isArray(inputPayload?.contributions)
      ? inputPayload.contributions
      : [];

    const hasAnnualRate = inputPayload?.annual_interest_rate != null;
    const hasMonthlyRate = inputPayload?.monthly_interest_rate != null;
    const interestLabel = hasMonthlyRate
      ? `${numSafe(inputPayload.monthly_interest_rate, 4)}% a.m.`
      : hasAnnualRate
        ? `${numSafe(inputPayload.annual_interest_rate, 2)}% a.a.`
        : '—';

    const rentLabel = inputPayload?.rent_value != null
      ? money(inputPayload.rent_value)
      : inputPayload?.rent_percentage != null
        ? `${numSafe(inputPayload.rent_percentage, 2)}% a.m. (do valor do imóvel)`
        : '—';

    const netIncomeLabel = inputPayload?.monthly_net_income != null
      ? money(inputPayload.monthly_net_income)
      : '—';

    return {
      interestLabel,
      rentLabel,
      invReturnsLabel,
      netIncomeLabel,
      amortizationsCount: amortizations.length,
      contributionsCount: contributions.length,
    };
  })();

  const monthlyNetIncome =
    typeof inputPayload?.monthly_net_income === 'number'
      ? inputPayload.monthly_net_income
      : null;

  const wealthData = monthsSorted.map((month) => {
    const row: any = { month };
    result.scenarios.forEach((s) => {
      const md = scenarioByMonth.get(s.name)?.get(month);
      if (md) row[s.name] = wealthAt(md);
    });
    return row;
  });

  const outflowData = monthsSorted.map((month) => {
    const row: any = { month };
    result.scenarios.forEach((s) => {
      const md = scenarioByMonth.get(s.name)?.get(month);
      if (md) row[s.name] = monthlyOutflow(md);
    });
    return row;
  });

  // Only the backend may authorize a winner. Scenario type is the stable identity;
  // labels are localized presentation and must never be used as a fallback ranking.
  const hasAuthoritativeWinner =
    result.comparison_status === 'comparable' && result.best_scenario_type != null;
  const bestScenario = hasAuthoritativeWinner
    ? result.scenarios.find((s) => s.scenario_type === result.best_scenario_type) ?? null
    : null;
  const bestScenarioWealth = bestScenario == null
    ? null
    : bestScenario.final_wealth ?? bestScenario.final_equity;

  const statusCopy = {
    comparable: {
      color: 'teal',
      title: 'Cenários comparáveis',
      message: 'Os cenários usam a mesma base de recursos. O ranking considera somente os fluxos viáveis; cenários com déficit permanecem visíveis e sinalizados.',
    },
    exploratory: {
      color: 'blue',
      title: 'Simulação exploratória — sem vencedor',
      message: 'Faltam recursos compartilhados suficientes para um ranking conclusivo. Use os resultados para explorar trajetórias, não para declarar uma estratégia superior.',
    },
    incomparable: {
      color: 'orange',
      title: 'Cenários não comparáveis — sem vencedor',
      message: 'Os cenários receberam recursos diferentes. O patrimônio final pode ser inspecionado, mas não forma um ranking justo.',
    },
    no_feasible_scenario: {
      color: 'red',
      title: 'Nenhum cenário possui fluxo viável',
      message: 'O orçamento e os recursos informados não cobrem todas as obrigações. Os déficits foram registrados como passivos; ajuste os parâmetros antes de comparar.',
    },
  } as const;
  const comparisonStatus = result.comparison_status ?? 'exploratory';
  const currentStatus = statusCopy[comparisonStatus];

  const comparativeRowsRaw = Object.values(result.comparative_summary || {}).filter(
    (v: any) => v && typeof v === 'object' && typeof v.month === 'number'
  ) as any[];
  const comparativeRows = [...comparativeRowsRaw].sort((a, b) => (a.month ?? 0) - (b.month ?? 0));
  const lastComparativeMonth = comparativeRows.length ? (comparativeRows[comparativeRows.length - 1].month as number) : null;
  const monthsToShow = lastComparativeMonth
    ? Array.from(
        new Set(
          [1, 12, 60, 120, lastComparativeMonth]
            .filter((m) => m >= 1 && m <= lastComparativeMonth)
        )
      ).sort((a, b) => a - b)
    : [];
  const comparativeMiniTable = monthsToShow
    .map((m) => comparativeRows.find((r) => r.month === m))
    .filter(Boolean);

  return (
    <Stack gap="xl">
      <Paper
        component="section"
        aria-labelledby="comparison-result-title"
        p={{ base: 'md', sm: 'xl' }}
        radius="lg"
        shadow="none"
        withBorder
        style={{ background: 'var(--farol-surface-raised)' }}
      >
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="lg">
          <Box style={{ flex: 1, minWidth: rem(250) }}>
            <Group gap="sm" mb="md" wrap="wrap">
              <ThemeIcon size={40} radius="md" variant="light" color="ocean">
                <IconChartLine size={20} />
              </ThemeIcon>
              <Box>
                <Title
                  ref={resultTitleRef}
                  id="comparison-result-title"
                  order={2}
                  fw={650}
                  c="bright"
                  tabIndex={-1}
                >
                  Resultado da simulação
                </Title>
                <Text size="sm" c="dimmed">
                  Comparação de três estratégias ao longo do mesmo horizonte.
                </Text>
              </Box>
              <Badge color={currentStatus.color} variant="light" size="lg">
                {currentStatus.title}
              </Badge>
            </Group>

            {bestScenario && bestScenarioWealth != null ? (
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  Maior patrimônio líquido final comparável
                </Text>
                <Title order={3} fw={700} c="var(--farol-chart-1)" mt={2}>
                  {money(bestScenarioWealth)}
                </Title>
                <Text size="sm" mt={4}>
                  <Text component="span" fw={650}>{bestScenario.name}</Text>
                  {' '}nas premissas desta simulação. Isso não constitui recomendação financeira.
                </Text>
              </Box>
            ) : (
              <Box>
                <Text fw={650}>Sem vencedor comparável</Text>
                <Text size="sm" c="dimmed" mt={4} maw={680}>
                  Os valores continuam úteis para explorar cada trajetória, mas não sustentam um ranking justo.
                </Text>
              </Box>
            )}
          </Box>

          <Menu withinPortal position="bottom-end">
            <Menu.Target>
              <Button
                variant="light"
                color="ocean"
                leftSection={<IconDownload size={16} />}
                radius="lg"
                size="md"
                loading={downloadLoading}
                disabled={!inputPayload}
              >
                Exportar resultados
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Formato</Menu.Label>
              <Menu.Item disabled={!inputPayload || downloadLoading} onClick={() => void handleExport('csv')}>
                CSV
              </Menu.Item>
              <Menu.Item disabled={!inputPayload || downloadLoading} onClick={() => void handleExport('xlsx')}>
                Excel (XLSX)
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Paper>

      <Alert
        color={currentStatus.color}
        variant="light"
        icon={<IconAlertCircle size={18} />}
        radius="lg"
        title={currentStatus.title}
      >
        <Text size="sm">{currentStatus.message}</Text>
        {(result.warnings?.length ?? 0) > 0 && (
          <Stack gap={4} mt="xs">
            {result.warnings?.map((warning, warningIndex) => (
              <Text key={`${warningIndex}-${warning}`} size="xs">• {warning}</Text>
            ))}
          </Stack>
        )}
      </Alert>

      {/* Global affordability alert */}
      {monthlyNetIncome != null && (() => {
        // Check if any scenario has months where income is insufficient
        // Uses inflation-adjusted income (effective_income) from backend when available
        const affordabilityIssues = result.scenarios.map((s) => {
          const monthlyData = Array.isArray(s.monthly_data) ? s.monthly_data : [];
          let monthsNegative = 0;
          let maxDeficit = 0;
          let maxDeficitMonth = 1;
          for (const m of monthlyData as any[]) {
            // Include cash amortizations but not bonus/13_salario for affordability
            const cost = recurringHousingCost(m, true);
            // Use effective_income from backend (inflation-adjusted) or fall back to static input
            const effectiveIncome = m?.effective_income ?? monthlyNetIncome;
            const deficit = cost - effectiveIncome;
            if (deficit > 0) {
              monthsNegative++;
              if (deficit > maxDeficit) {
                maxDeficit = deficit;
                maxDeficitMonth = m.month;
              }
            }
          }
          return { name: s.name, monthsNegative, maxDeficit, maxDeficitMonth, totalMonths: monthlyData.length };
        }).filter(s => s.monthsNegative > 0);

        if (affordabilityIssues.length > 0) {
          return (
            <Alert
              color="warning"
              variant="light"
              icon={<IconAlertCircle size={18} />}
              radius="lg"
              title="Análise de Capacidade de Pagamento"
            >
              <Text size="sm" c="dimmed" mb="xs">
                Com base no orçamento mensal disponível de <Text component="span" fw={600}>{money(monthlyNetIncome)}</Text>
                {inputPayload?.monthly_net_income_adjust_inflation
                  ? ' (corrigido pela inflação ao longo do tempo)'
                  : ''}, identificamos os seguintes pontos de atenção:
              </Text>
              <Stack gap="xs">
                {affordabilityIssues.map((issue) => (
                  <Group key={issue.name} gap="xs">
                    <Badge color="warning" variant="light" size="sm">{issue.name}</Badge>
                    <Text size="xs" c="dimmed">
                      {issue.monthsNegative} mês(es) com orçamento mensal insuficiente (maior déficit: {money(issue.maxDeficit)} no mês {issue.maxDeficitMonth})
                    </Text>
                  </Group>
                ))}
              </Stack>
              <Text size="xs" c="dimmed" mt="xs">
                💡 Dica: considere ajustar o valor do imóvel, entrada, ou prazo para melhorar sua capacidade de pagamento.
              </Text>
            </Alert>
          );
        }
        return null;
      })()}

      <Box component="section" aria-labelledby="scenario-summary-title">
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm" mb="md">
          <Box>
            <Title id="scenario-summary-title" order={3} fw={650}>
              Resultado por estratégia
            </Title>
            <Text size="sm" c="dimmed" mt={2}>
              Patrimônio, esforço de caixa, retorno comparável e viabilidade em uma única leitura.
            </Text>
          </Box>
          <Badge variant="light" color="gray" size="lg">
            {result.scenarios.length} cenários
          </Badge>
        </Group>
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
          {result.scenarios.map((s, idx) => (
            <ScenarioCardNew
              key={s.scenario_type}
              scenario={s}
              isBest={bestScenario?.scenario_type === s.scenario_type}
              bestScenario={bestScenario}
              index={idx}
              monthlyNetIncome={monthlyNetIncome}
            />
          ))}
        </SimpleGrid>
      </Box>

      {/* Input payload summary (what was actually simulated) */}
      <Box
        component="section"
        aria-labelledby="simulation-input-title"
        p="lg"
        style={RESULT_SURFACE_STYLE}
      >
        <Group justify="space-between" align="center" wrap="wrap" gap="sm" mb="xs">
          <Group gap="xs">
            <ThemeIcon size={34} radius="lg" variant="light" color="ocean">
              <IconSettings size={16} />
            </ThemeIcon>
            <Box>
              <Text id="simulation-input-title" component="h3" fw={700} c="bright">
                Parâmetros usados na simulação
              </Text>
              <Text size="xs" c="dimmed">
                Ajuda a evitar leitura de resultados “de outra rodada”.
              </Text>
            </Box>
          </Group>
          <Group gap="xs">
            <Button
              variant="light"
              color="ocean"
              radius="lg"
              size="sm"
              style={{ minHeight: rem(44) }}
              onClick={() => setShowInputDetails((v) => !v)}
              aria-expanded={showInputDetails}
              aria-controls="simulation-input-details"
            >
              {showInputDetails ? 'Ocultar detalhes' : 'Ver detalhes'}
            </Button>
            <Button
              variant="subtle"
              color="ocean"
              radius="lg"
              size="sm"
              style={{ minHeight: rem(44) }}
              disabled={!inputPayload}
              onClick={() => {
                setShowInputDetails(true);
                setShowInputJson((v) => !v);
              }}
              aria-expanded={showInputJson}
              aria-controls="simulation-input-json"
            >
              {showInputJson ? 'Ocultar JSON' : 'Ver JSON'}
            </Button>
          </Group>
        </Group>

        {!inputPayload ? (
          <Text size="sm" c="dimmed">
            Payload indisponível (rodadas anteriores podem não ter registrado o input).
          </Text>
        ) : (
          <>
            <Group gap="xs" wrap="wrap">
              <Badge variant="light" color="ocean">
                Imóvel: {money(inputPayload.property_value)}
              </Badge>
              <Badge variant="light" color="ocean">
                Entrada: {money(inputPayload.down_payment)}
              </Badge>
              <Badge variant="light" color="ocean">
                Prazo: {inputPayload.loan_term_years} anos
              </Badge>
              <Badge variant="light" color="ocean">
                Sistema: {inputPayload.loan_type}
              </Badge>
              {inputSummary?.interestLabel !== '—' && (
                <Badge variant="light" color="ocean">Juros: {inputSummary?.interestLabel}</Badge>
              )}
              {inputPayload.rent_inflation_rate != null && (
                <Badge variant="light" color="ocean">Inflação aluguel: {percentSafe(inputPayload.rent_inflation_rate, 2)} a.a.</Badge>
              )}
              {inputPayload.inflation_rate != null && (
                <Badge variant="light" color="ocean">Inflação geral: {percentSafe(inputPayload.inflation_rate, 2)} a.a.</Badge>
              )}
              {inputPayload.property_appreciation_rate != null && (
                <Badge variant="light" color="ocean">Valorização imóvel: {percentSafe(inputPayload.property_appreciation_rate, 2)} a.a.</Badge>
              )}
              <Badge variant="light" color="ocean">
                Amortizações: {inputSummary?.amortizationsCount ?? 0}
              </Badge>
              <Badge variant="light" color="ocean">
                Aportes: {inputSummary?.contributionsCount ?? 0}
              </Badge>
              {inputSummary?.netIncomeLabel !== '—' && (
                <Badge variant="light" color="ocean">
                  Orçamento mensal disponível: {inputSummary?.netIncomeLabel}
                </Badge>
              )}
            </Group>

            <Collapse in={showInputDetails}>
              <Box id="simulation-input-details">
              <Divider my="sm" color="var(--farol-border)" />
              <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="sm">
                <Box>
                  <Text size="xs" c="var(--farol-chart-1)">Aluguel</Text>
                  <Text fw={600} c="bright">{inputSummary?.rentLabel ?? '—'}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="var(--farol-chart-1)">Orçamento mensal disponível</Text>
                  <Text fw={600} c="bright">{inputSummary?.netIncomeLabel ?? '—'}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="var(--farol-chart-1)">Retornos investimento</Text>
                  <Text fw={600} c="bright">{inputSummary?.invReturnsLabel ?? '—'}</Text>
                </Box>
              </SimpleGrid>

              <Collapse in={showInputJson}>
                <Box id="simulation-input-json">
              <Divider my="sm" color="var(--farol-border)" />
                <ScrollArea h={220} type="auto" scrollbarSize={8} offsetScrollbars>
                  <Text
                    component="pre"
                    fz="xs"
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    }}
                  >
                    {JSON.stringify(inputPayload, null, 2)}
                  </Text>
                </ScrollArea>
                </Box>
              </Collapse>
              </Box>
            </Collapse>
          </>
        )}
      </Box>

      {/* Comparative Summary */}
      <Box
        component="section"
        aria-labelledby="comparative-summary-title"
        p="xl"
        style={RESULT_SURFACE_STYLE}
      >
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm" mb="md">
          <Box>
            <Text id="comparative-summary-title" component="h3" fw={600} size="lg" c="bright">
              Resumo comparativo
            </Text>
            <Text size="sm" c="dimmed">
              Alguns pontos no tempo para facilitar a leitura (mês a mês está no export).
            </Text>
          </Box>
          {lastComparativeMonth != null && (
            <Badge variant="light" color="ocean" size="lg">
              Horizonte: {horizonLabel(lastComparativeMonth)}
            </Badge>
          )}
        </Group>

        {comparativeMiniTable.length ? (
          <ScrollArea type="auto" scrollbarSize={8} offsetScrollbars>
            <Table striped highlightOnHover miw={920} aria-label="Resumo comparativo por período">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Mês</Table.Th>
                  <Table.Th>Comprar − Alugar (R$)</Table.Th>
                  <Table.Th>Comprar − Alugar (%)</Table.Th>
                  <Table.Th>Patrimônio (Comprar)</Table.Th>
                  <Table.Th>Patrimônio (Alugar + Investir)</Table.Th>
                  <Table.Th>Patrimônio (Investir p/ Comprar)</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {comparativeMiniTable.map((r: any) => (
                  <Table.Tr key={r.month}>
                    <Table.Td fw={600}>{formatMonthLabel(r.month)}</Table.Td>
                    <Table.Td c={r.buy_vs_rent_difference > 0 ? 'var(--farol-chart-negative)' : r.buy_vs_rent_difference < 0 ? 'var(--farol-chart-positive)' : 'dimmed'}>
                      {signedMoney(r.buy_vs_rent_difference)}
                    </Table.Td>
                    <Table.Td
                      c={
                        r.buy_vs_rent_percentage == null
                          ? 'dimmed'
                          : r.buy_vs_rent_percentage > 0
                            ? 'var(--farol-chart-negative)'
                            : r.buy_vs_rent_percentage < 0
                              ? 'var(--farol-chart-positive)'
                              : 'dimmed'
                      }
                    >
                      {r.buy_vs_rent_percentage == null
                        ? '—'
                        : signedPercent(r.buy_vs_rent_percentage, 1)}
                    </Table.Td>
                    <Table.Td>{moneySafe(r.buy_total_wealth)}</Table.Td>
                    <Table.Td>{moneySafe(r.rent_total_wealth)}</Table.Td>
                    <Table.Td>{moneySafe(r.invest_total_wealth)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        ) : (
          <Text size="sm" c="dimmed">
            Resumo comparativo indisponível.
          </Text>
        )}

        <Text size="xs" c="dimmed" mt="sm">
          Interpretação: valores positivos em “Comprar − Alugar” significam que comprar foi mais caro no mês (pior para comprar no curto prazo).
        </Text>
      </Box>

      {/* Charts and Tables */}
      <Tabs
        value={activeTab}
        onChange={(v) => setActiveTab(v || 'overview')}
        variant="pills"
        radius="lg"
        keepMounted={false}
        styles={{ tab: { minHeight: rem(44) } }}
      >
        <Box
          p="md"
          mb="md"
          style={RESULT_SURFACE_STYLE}
        >
          <Group justify="space-between" align="center" wrap="wrap" gap="md">
            <ScrollArea type="auto" scrollbarSize={6} style={{ flex: 1, minWidth: 0 }}>
              <Tabs.List style={{ flexWrap: 'nowrap', width: 'max-content' }}>
                <Tabs.Tab value="overview" leftSection={<IconChartArea size={16} />}>
                  Evolução geral
                </Tabs.Tab>
                {result.scenarios.map((s) => (
                  <Tabs.Tab key={s.name} value={s.name} leftSection={<IconTable size={16} />}>
                    {s.name}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </ScrollArea>
            {activeTab === 'overview' && (
              <Group gap="xs" wrap="wrap">
                <SegmentedControl
                  size="sm"
                  styles={{ control: { minHeight: rem(44) } }}
                  radius="lg"
                  value={overviewMetric}
                  onChange={(v) => setOverviewMetric(v as any)}
                  data={[
                    { label: 'Patrimônio', value: 'wealth' },
                    { label: 'Saída total', value: 'outflow' },
                  ]}
                />
                <SegmentedControl
                  size="sm"
                  styles={{ control: { minHeight: rem(44) } }}
                  radius="lg"
                  value={chartType}
                  onChange={(v) => setChartType(v as any)}
                  data={[
                    { label: 'Área', value: 'area' },
                    { label: 'Linha', value: 'line' },
                  ]}
                />
              </Group>
            )}
          </Group>
        </Box>

        <Tabs.Panel value="overview">
          <Box
            component="section"
            aria-labelledby="overview-chart-title"
            p={{ base: 'md', sm: 'xl' }}
            w="100%"
            miw={0}
            style={RESULT_SURFACE_STYLE}
          >
            <Text id="overview-chart-title" component="h3" fw={600} size="lg" mb="lg" c="bright">
              {overviewMetric === 'wealth'
                ? 'Evolução do Patrimônio ao Longo do Tempo'
                : 'Saída total mensal (inclui eventos e aportes) ao longo do tempo'}
            </Text>
            <Box
              h={350}
              w="100%"
              miw={0}
              role="img"
              aria-labelledby="overview-chart-title"
              aria-describedby="overview-chart-alternative"
            >
              {chartType === 'area' && (
                  <AreaChart
                    h={350}
                    w="100%"
                    miw={0}
                    data={overviewMetric === 'wealth' ? wealthData : outflowData}
                    dataKey="month"
                    series={result.scenarios.map((s, i) => ({
                      name: s.name,
                      color: SCENARIO_CHART_COLORS[i % SCENARIO_CHART_COLORS.length],
                    }))}
                    curveType="monotone"
                    gridAxis="xy"
                    withLegend
                    legendProps={{ verticalAlign: 'bottom', height: 50 }}
                    valueFormatter={(value) => money(value)}
                    xAxisProps={{ tickMargin: 10, tickFormatter: (v) => formatYearTickFromMonth(Number(v)) }}
                    yAxisProps={{ tickMargin: 10, tickFormatter: (v) => moneyCompact(v as number) }}
                    tooltipAnimationDuration={150}
                  />
              )}
              {chartType === 'line' && (
                  <LineChart
                    h={350}
                    w="100%"
                    miw={0}
                    data={overviewMetric === 'wealth' ? wealthData : outflowData}
                    dataKey="month"
                    series={result.scenarios.map((s, i) => ({
                      name: s.name,
                      color: SCENARIO_CHART_COLORS[i % SCENARIO_CHART_COLORS.length],
                    }))}
                    curveType="monotone"
                    gridAxis="xy"
                    withLegend
                    legendProps={{ verticalAlign: 'bottom', height: 50 }}
                    valueFormatter={(value) => money(value)}
                    xAxisProps={{ tickMargin: 10, tickFormatter: (v) => formatYearTickFromMonth(Number(v)) }}
                    yAxisProps={{ tickMargin: 10, tickFormatter: (v) => moneyCompact(v as number) }}
                    tooltipAnimationDuration={150}
                  />
              )}
            </Box>
            <Text id="overview-chart-alternative" size="xs" c="dimmed" mt="sm">
              Eixo X: meses (marcado por anos). Para patrimônio, os marcos estão no “Resumo comparativo”; para saídas, os valores mensais estão nas tabelas de cada estratégia. No gráfico, toque ou use o ponteiro para inspecionar pontos intermediários.
            </Text>
            {overviewMetric === 'outflow' && (
              <Text size="xs" c="dimmed" mt={6}>
                Dica: o mês 1 tende a ter um pico porque registra a alocação inicial de capital (entrada/aporte inicial).
              </Text>
            )}
          </Box>
        </Tabs.Panel>

        {result.scenarios.map((s) => {
          const isInvestBuy = s.monthly_data.some((m: any) => m.scenario_type === 'invest_buy');
          const isRentInvest = s.monthly_data.some((m: any) => m.scenario_type === 'rent_invest');
          const isBuy = s.monthly_data.some(
            (m: any) => m.scenario_type === 'buy' || m.installment != null || m.outstanding_balance != null
          );
          let rows = [...s.monthly_data].sort((a: any, b: any) => a.month - b.month);
          if (isInvestBuy && milestonesOnly) {
            rows = rows.filter((m: any) => m.is_milestone || m.status === 'Imóvel comprado');
          }
          const latest = s.monthly_data[s.monthly_data.length - 1];
          const first = s.monthly_data[0];
          const progress = latest?.progress_percent ?? (latest?.equity ? 100 : 0);
          const purchaseMonth = first?.purchase_month;
          const projected = first?.projected_purchase_month;

          const hasCumulativeCost = rows.some(
            (m: any) => m.cumulative_payments != null || m.cumulative_rent_paid != null
          );
          const hasCumulativeSecondary = rows.some(
            (m: any) => m.cumulative_interest != null || m.cumulative_investment_gains != null
          );

          return (
            <Tabs.Panel key={s.name} value={s.name}>
              <Box
                component="section"
                aria-labelledby={`scenario-detail-title-${s.scenario_type}`}
                p={{ base: 'md', sm: 'xl' }}
                style={RESULT_SURFACE_STYLE}
              >
                {/* Scenario header */}
                <Group justify="space-between" mb="lg" wrap="wrap" gap="md">
                  <Box>
                    <Text id={`scenario-detail-title-${s.scenario_type}`} component="h3" fw={600} size="lg" c="bright">
                      Detalhamento: {s.name}
                    </Text>
                    <Text size="sm" c="dimmed">
                      Dados mensais da simulação
                    </Text>
                  </Box>
                  {isInvestBuy && (
                    <Group gap="md">
                      <Badge color={purchaseMonth ? 'success' : 'ocean'} variant="light" size="lg">
                        {purchaseMonth ? `Comprado no mês ${purchaseMonth}` : 'Ainda não comprado'}
                      </Badge>
                      <Switch
                        size="md"
                        styles={{ root: { minHeight: rem(44), display: 'flex', alignItems: 'center' } }}
                        checked={milestonesOnly}
                        onChange={(e) => setMilestonesOnly(e.currentTarget.checked)}
                        label="Apenas marcos"
                      />
                    </Group>
                  )}
                </Group>

                {!isBuy && (
                  <Group justify="space-between" align="center" wrap="wrap" gap="sm" mb="md">
                    <SegmentedControl
                      size="sm"
                      styles={{ control: { minHeight: rem(44) } }}
                      radius="lg"
                      value={tableView}
                      onChange={(v) => setTableView(v as any)}
                      data={[
                        { label: 'Essencial', value: 'essential' },
                        { label: 'Detalhada', value: 'detailed' },
                      ]}
                    />
                    <Text size="xs" c="dimmed">
                      Essencial = leitura rápida; Detalhada = mais colunas.
                    </Text>
                  </Group>
                )}

                {/* Progress info for invest-buy */}
                {isInvestBuy && !purchaseMonth && first?.estimated_months_remaining != null && (
                  <Alert color="warning" variant="light" radius="lg" mb="lg">
                    <Text size="sm">
                      Estimativa de {first.estimated_months_remaining} meses restantes para compra.
                      {projected && ` Previsão: mês ${projected}.`}
                    </Text>
                  </Alert>
                )}

                {/* Table */}
                <ScrollArea h={440} type="auto" scrollbarSize={8} offsetScrollbars>
                  {isBuy ? (() => {
                    const payoffThreshold = 0.01;
                    let payoffMonth: number | null = null;
                    for (const r of rows) {
                      const bal = r.outstanding_balance;
                      if (typeof bal === 'number' && bal <= payoffThreshold) {
                        payoffMonth = r.month;
                        break;
                      }
                    }

                    const buyRows = rows;

                    const pb = (s as any).purchase_breakdown;
                    const cashDown = typeof pb?.cash_down_payment === 'number' ? pb.cash_down_payment : null;
                    const fgtsAtPurchase = typeof pb?.fgts_at_purchase === 'number' ? pb.fgts_at_purchase : null;

                    return (
                      <>
                        <Group justify="space-between" align="center" wrap="wrap" gap="sm" mb="sm">
                          <Group gap="xs" wrap="wrap">
                            <Badge variant="light" color="ocean">
                              {payoffMonth != null ? `Quitado no mês ${payoffMonth}` : 'Não quitado no horizonte'}
                            </Badge>
                            <ExplanationPopover
                              label="Tabela do financiamento: parcela, juros, amortização (inclui extras) e saldo devedor."
                              withArrow
                            >
                              <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Ajuda: Tabela do financiamento">
                                <IconHelpCircle size={16} />
                              </ActionIcon>
                            </ExplanationPopover>
                          </Group>
                        </Group>

                        <Table
                          fz="sm"
                          striped
                          highlightOnHover
                          stickyHeader
                          miw={2200}
                          aria-label={`Fluxo mensal de ${s.name}`}
                        >
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Mês</Table.Th>
                              <Table.Th>Ano</Table.Th>
                              <Table.Th>
                                <ExplanationPopover label="Parcela base do financiamento (sem amortizações extras). As extras aparecem nas colunas ao lado." withArrow>
                                  <Text component="span" size="sm">Parcela (base)</Text>
                                </ExplanationPopover>
                              </Table.Th>
                              <Table.Th>Juros</Table.Th>
                              <Table.Th>Amortização</Table.Th>
                              <Table.Th>Extra (cash)</Table.Th>
                              <Table.Th>Extra (FGTS)</Table.Th>
                              <Table.Th>Extra (Bônus)</Table.Th>
                              <Table.Th>Extra (13º)</Table.Th>
                              <Table.Th>Saldo devedor</Table.Th>
                              <Table.Th>Custos (cond+IPTU)</Table.Th>
                              {monthlyNetIncome != null && (
                                <Table.Th>
                                  <ExplanationPopover label="Orçamento disponível menos custo de moradia mensal (parcela base + custos + amortização em dinheiro). FGTS, bônus e 13º não são considerados." withArrow>
                                    <Text component="span" size="sm">Sobra</Text>
                                  </ExplanationPopover>
                                </Table.Th>
                              )}
                              <Table.Th>
                                <ExplanationPopover label="Aportes programados (investimentos configurados)" withArrow>
                                  <Text component="span" size="sm">Aportes</Text>
                                </ExplanationPopover>
                              </Table.Th>
                              <Table.Th>
                                <ExplanationPopover label="Saldo acumulado de investimentos (inclui aportes)" withArrow>
                                  <Text component="span" size="sm">Saldo inv.</Text>
                                </ExplanationPopover>
                              </Table.Th>
                              <Table.Th>Custos compra</Table.Th>
                              <Table.Th>Entrada (cash)</Table.Th>
                              <Table.Th>FGTS na compra</Table.Th>
                              <Table.Th>Valor imóvel</Table.Th>
                              <Table.Th>Equidade</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {buyRows.slice(0, 600).map((m: any) => {
                              const isPayoffRow = payoffMonth != null && m.month === payoffMonth;
                              const interest = typeof m.interest_payment === 'number' ? m.interest_payment : 0;
                              const { extraCash, extraFgts, extraBonus, extra13Salario } = getAmortizationParts(m);
                              const installment = getRegularInstallment(m);
                              const principal = getRegularPrincipal(m);
                              const monthlyCosts = typeof m.monthly_additional_costs === 'number' ? m.monthly_additional_costs : 0;
                              const upfront = typeof m.upfront_additional_costs === 'number' ? m.upfront_additional_costs : 0;
                              // Affordability: include cash amortizations but NOT FGTS/bonus/13_salario (external income)
                              const housingCost = typeof m.housing_due === 'number'
                                ? m.housing_due
                                : installment + monthlyCosts + extraCash;
                              // Use backend's inflation-adjusted income for surplus calculation
                              const { surplus, effectiveIncome } = getEffectiveSurplus(m, housingCost, monthlyNetIncome, true);
                              const isNegativeSurplus = surplus != null && surplus < 0;

                              return (
                                <Table.Tr
                                  key={m.month}
                                  style={{
                                    backgroundColor: isPayoffRow
                                      ? 'light-dark(var(--mantine-color-success-0), var(--mantine-color-dark-7))'
                                      : isNegativeSurplus
                                        ? 'light-dark(var(--mantine-color-danger-0), var(--mantine-color-dark-7))'
                                        : undefined,
                                    fontWeight: isPayoffRow ? 700 : 400,
                                  }}
                                >
                                  <Table.Td>{m.month}</Table.Td>
                                  <Table.Td>{yearFromMonth(m.month)}</Table.Td>
                                  <Table.Td>{moneySafe(installment)}</Table.Td>
                                  <Table.Td>{moneySafe(interest)}</Table.Td>
                                  <Table.Td>{moneySafe(principal)}</Table.Td>
                                  <Table.Td>{moneySafe(extraCash)}</Table.Td>
                                  <Table.Td>{moneySafe(extraFgts)}</Table.Td>
                                  <Table.Td>{extraBonus > 0 ? moneySafe(extraBonus) : '—'}</Table.Td>
                                  <Table.Td>{extra13Salario > 0 ? moneySafe(extra13Salario) : '—'}</Table.Td>
                                  <Table.Td>{moneySafe(m.outstanding_balance)}</Table.Td>
                                  <Table.Td>{moneySafe(monthlyCosts)}</Table.Td>
                                  {surplus != null && (
                                    <Table.Td>
                                      <ExplanationPopover
                                        label={
                                          <SurplusBreakdown
                                            netIncome={effectiveIncome ?? monthlyNetIncome ?? 0}
                                            housingCost={housingCost}
                                            installment={installment}
                                            monthlyCosts={monthlyCosts}
                                            extraAmortCash={extraCash}
                                            scenarioType="buy"
                                            incomeAdjusted={Boolean(inputPayload?.monthly_net_income_adjust_inflation)}
                                          />
                                        }
                                        multiline
                                        w={320}
                                        withArrow
                                        position="left"
                                      >
                                        <Text
                                          c={surplus >= 0 ? 'var(--farol-chart-positive)' : 'var(--farol-chart-negative)'}
                                          fw={500}
                                          style={{ textDecoration: 'underline dotted' }}
                                        >
                                          {signedMoney(surplus)}
                                        </Text>
                                      </ExplanationPopover>
                                    </Table.Td>
                                  )}
                                  <Table.Td>{m.extra_contribution_total > 0 ? moneySafe(m.extra_contribution_total) : '—'}</Table.Td>
                                  <Table.Td>{m.investment_balance != null ? moneySafe(m.investment_balance) : '—'}</Table.Td>
                                  <Table.Td>{m.month === 1 ? moneySafe(upfront) : '—'}</Table.Td>
                                  <Table.Td>{m.month === 1 && cashDown != null ? moneySafe(cashDown) : '—'}</Table.Td>
                                  <Table.Td>{m.month === 1 && fgtsAtPurchase != null ? moneySafe(fgtsAtPurchase) : '—'}</Table.Td>
                                  <Table.Td>{moneySafe(m.property_value)}</Table.Td>
                                  <Table.Td>{moneySafe(m.equity)}</Table.Td>
                                </Table.Tr>
                              );
                            })}
                          </Table.Tbody>
                        </Table>
                        <Text size="xs" c="dimmed" mt="sm">
                          Dica: se você adicionou amortizações extras, a quitação deve aparecer como saldo devedor ≈ 0.
                        </Text>
                      </>
                    );
                  })() : (
                    isRentInvest ? (
                      <Table
                        fz="sm"
                        striped
                        highlightOnHover
                        stickyHeader
                        miw={tableView === 'essential' ? 820 : 1900}
                        aria-label={`Fluxo mensal de ${s.name}`}
                      >
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Mês</Table.Th>
                            <Table.Th>Ano</Table.Th>
                            {tableView === 'essential' ? (
                              <>
                                <Table.Th>Moradia (R$)</Table.Th>
                                {monthlyNetIncome != null && (
                                  <Table.Th>
                                    <ExplanationPopover label="Orçamento disponível menos custo de moradia (aluguel + condomínio/IPTU). Ative o valor para abrir a composição." withArrow>
                                      <Text component="span" size="sm">Sobra</Text>
                                    </ExplanationPopover>
                                  </Table.Th>
                                )}
                                <Table.Th>Retorno (líq.)</Table.Th>
                                <Table.Th>Saldo invest.</Table.Th>
                                <Table.Th>Patrimônio</Table.Th>
                              </>
                            ) : (
                              <>
                                {/* Custos de Moradia */}
                                <Table.Th style={{ boxShadow: 'inset 2px 0 0 var(--farol-chart-1)' }}>
                                  <ExplanationPopover label="Valor do aluguel no mês" withArrow>
                                    <Text component="span" size="sm">Aluguel</Text>
                                  </ExplanationPopover>
                                </Table.Th>
                                <Table.Th>
                                  <ExplanationPopover label="Condomínio + IPTU mensal" withArrow>
                                    <Text component="span" size="sm">Cond+IPTU</Text>
                                  </ExplanationPopover>
                                </Table.Th>
                                <Table.Th>
                                  <ExplanationPopover label="Total de moradia devido (aluguel + cond/IPTU)" withArrow>
                                    <Text component="span" size="sm">Total devido</Text>
                                  </ExplanationPopover>
                                </Table.Th>
                                {monthlyNetIncome != null && (
                                  <Table.Th>
                                    <ExplanationPopover label="Orçamento disponível menos custo de moradia. Ative o valor para abrir a composição." withArrow>
                                      <Text component="span" size="sm">Sobra</Text>
                                    </ExplanationPopover>
                                  </Table.Th>
                                )}
                                {/* Fluxo de caixa */}
                                <Table.Th style={{ boxShadow: 'inset 2px 0 0 var(--farol-chart-3)' }}>
                                  <ExplanationPopover label="Total efetivamente pago de moradia" withArrow>
                                    <Text component="span" size="sm">Pago</Text>
                                  </ExplanationPopover>
                                </Table.Th>
                                <Table.Th>
                                  <ExplanationPopover label="Diferença entre devido e pago (falta de caixa)" withArrow>
                                    <Text component="span" size="sm">Falta</Text>
                                  </ExplanationPopover>
                                </Table.Th>
                                <Table.Th>
                                  <ExplanationPopover label="Valor sacado do investimento para pagar moradia" withArrow>
                                    <Text component="span" size="sm">Saque</Text>
                                  </ExplanationPopover>
                                </Table.Th>
                                <Table.Th>
                                  <ExplanationPopover label="Cobertura de fonte externa (ex: poupança externa)" withArrow>
                                    <Text component="span" size="sm">Cob. ext.</Text>
                                  </ExplanationPopover>
                                </Table.Th>
                                {/* Investimentos */}
                                <Table.Th style={{ boxShadow: 'inset 2px 0 0 var(--farol-chart-2)' }}>
                                  <ExplanationPopover label="Aportes programados (configurados na entrada)" withArrow>
                                    <Text component="span" size="sm">Aportes</Text>
                                  </ExplanationPopover>
                                </Table.Th>
                                <Table.Th>
                                  <ExplanationPopover label="Retorno líquido do investimento no mês" withArrow>
                                    <Text component="span" size="sm">Retorno</Text>
                                  </ExplanationPopover>
                                </Table.Th>
                                <Table.Th>
                                  <ExplanationPopover label="Saldo acumulado de investimentos" withArrow>
                                    <Text component="span" size="sm">Saldo inv.</Text>
                                  </ExplanationPopover>
                                </Table.Th>
                                <Table.Th>
                                  <ExplanationPopover label="Patrimônio total (investimentos + FGTS)" withArrow>
                                    <Text component="span" size="sm">Patrimônio</Text>
                                  </ExplanationPopover>
                                </Table.Th>
                                <Table.Th>
                                  <ExplanationPopover label="Valor do imóvel de referência (com valorização)" withArrow>
                                    <Text component="span" size="sm">Imóvel ref.</Text>
                                  </ExplanationPopover>
                                </Table.Th>
                              </>
                            )}
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {rows.slice(0, 600).map((m: any) => {
                            const isBurn = Boolean(m.burn_month);
                            const housingDue =
                              m?.housing_due != null
                                ? m.housing_due
                                : (m?.rent_due ?? 0) + (m?.monthly_additional_costs ?? 0);
                            // Use backend's inflation-adjusted income for surplus calculation
                            const { surplus, effectiveIncome } = getEffectiveSurplus(m, housingDue, monthlyNetIncome);
                            const isNegativeSurplus = surplus != null && surplus < 0;
                            const rowStyle = isBurn
                              ? {
                                  backgroundColor:
                                    'light-dark(var(--mantine-color-warning-0), var(--mantine-color-dark-7))',
                                }
                              : isNegativeSurplus
                                ? {
                                    backgroundColor:
                                      'light-dark(var(--mantine-color-danger-0), var(--mantine-color-dark-7))',
                                  }
                                : undefined;

                            return (
                              <Table.Tr key={m.month} style={rowStyle}>
                                <Table.Td>{m.month}</Table.Td>
                                <Table.Td>{yearFromMonth(m.month)}</Table.Td>
                                {tableView === 'essential' ? (
                                  <>
                                    <Table.Td>{moneySafe(housingDue)}</Table.Td>
                                    {surplus != null && (
                                      <Table.Td>
                                        <ExplanationPopover
                                          label={
                                          <SurplusBreakdown
                                              netIncome={effectiveIncome ?? monthlyNetIncome ?? 0}
                                              housingCost={housingDue}
                                              rent={m.rent_due}
                                              monthlyCosts={m.monthly_additional_costs}
                                              scenarioType="rent_invest"
                                              incomeAdjusted={Boolean(inputPayload?.monthly_net_income_adjust_inflation)}
                                            />
                                          }
                                          multiline
                                          w={320}
                                          withArrow
                                          position="left"
                                        >
                                          <Text
                                          c={surplus >= 0 ? 'var(--farol-chart-positive)' : 'var(--farol-chart-negative)'}
                                            fw={500}
                                            style={{ textDecoration: 'underline dotted' }}
                                          >
                                            {signedMoney(surplus)}
                                          </Text>
                                        </ExplanationPopover>
                                      </Table.Td>
                                    )}
                                    <Table.Td>{moneySafe(m.investment_return_net)}</Table.Td>
                                    <Table.Td>{moneySafe(m.investment_balance)}</Table.Td>
                                    <Table.Td>{moneySafe(wealthAt(m))}</Table.Td>
                                  </>
                                ) : (
                                  <>
                                    <Table.Td>{moneySafe(m.rent_due)}</Table.Td>
                                    <Table.Td>{moneySafe(m.monthly_additional_costs)}</Table.Td>
                                    <Table.Td>{moneySafe(housingDue)}</Table.Td>
                                    {surplus != null && (
                                      <Table.Td>
                                        <ExplanationPopover
                                          label={
                                          <SurplusBreakdown
                                              netIncome={effectiveIncome ?? monthlyNetIncome ?? 0}
                                              housingCost={housingDue}
                                              rent={m.rent_due}
                                              monthlyCosts={m.monthly_additional_costs}
                                              scenarioType="rent_invest"
                                              incomeAdjusted={Boolean(inputPayload?.monthly_net_income_adjust_inflation)}
                                            />
                                          }
                                          multiline
                                          w={320}
                                          withArrow
                                          position="left"
                                        >
                                          <Text
                                          c={surplus >= 0 ? 'var(--farol-chart-positive)' : 'var(--farol-chart-negative)'}
                                            fw={500}
                                            style={{ textDecoration: 'underline dotted' }}
                                          >
                                            {signedMoney(surplus)}
                                          </Text>
                                        </ExplanationPopover>
                                      </Table.Td>
                                    )}
                                    <Table.Td>{moneySafe(m.housing_paid)}</Table.Td>
                                    <Table.Td>{moneySafe(m.housing_shortfall)}</Table.Td>
                                    <Table.Td>{moneySafe(m.rent_withdrawal_from_investment)}</Table.Td>
                                    <Table.Td>{moneySafe(m.external_cover)}</Table.Td>
                                    <Table.Td>{m.extra_contribution_total > 0 ? moneySafe(m.extra_contribution_total) : '—'}</Table.Td>
                                    <Table.Td>{moneySafe(m.investment_return_net)}</Table.Td>
                                    <Table.Td>{moneySafe(m.investment_balance)}</Table.Td>
                                    <Table.Td>{moneySafe(wealthAt(m))}</Table.Td>
                                    <Table.Td>{moneySafe(m.property_value)}</Table.Td>
                                  </>
                                )}
                              </Table.Tr>
                            );
                          })}
                        </Table.Tbody>
                      </Table>
                    ) : (
                      <Table
                        fz="sm"
                        striped
                        highlightOnHover
                        stickyHeader
                        miw={1800}
                        aria-label={`Fluxo mensal de ${s.name}`}
                      >
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Mês</Table.Th>
                            <Table.Th>Ano</Table.Th>
                            <Table.Th>Status</Table.Th>
                            <Table.Th>
                              <Group gap={6} wrap="nowrap">
                                <Text component="span">Saída total</Text>
                                <ExplanationPopover
                                  label={
                                    <Stack gap={4}>
                                      <Text size="xs" fw={600}>O que entra em “Saída total”?</Text>
                                      <Text size="xs" c="dimmed">
                                        Inclui moradia (aluguel + cond/IPTU), custos pontuais (ITBI/escritura) e alocações/aportes.
                                      </Text>
                                      <Text size="xs" c="dimmed">O mês 1 costuma ter pico (alocação inicial).</Text>
                                    </Stack>
                                  }
                                  multiline
                                  w={360}
                                  withArrow
                                  position="top-start"
                                >
                                  <ActionIcon variant="subtle" color="gray" size="xs" aria-label="Ajuda: Saída total">
                                    <IconHelpCircle size={14} />
                                  </ActionIcon>
                                </ExplanationPopover>
                              </Group>
                            </Table.Th>
                            <Table.Th>Patrimônio</Table.Th>
                            {tableView === 'essential' ? (
                              <>
                                {monthlyNetIncome != null && (
                                  <Table.Th>
                                    <ExplanationPopover label="Orçamento disponível menos custo de moradia mensal" withArrow>
                                      <Text component="span" size="sm">Sobra</Text>
                                    </ExplanationPopover>
                                  </Table.Th>
                                )}
                                <Table.Th>Progresso</Table.Th>
                                <Table.Th>Falta (R$)</Table.Th>
                                <Table.Th>Saldo invest.</Table.Th>
                              </>
                            ) : (
                              <>
                                {/* Custos de Moradia */}
                                <Table.Th style={{ boxShadow: 'inset 2px 0 0 var(--farol-chart-1)' }}>
                                  <ExplanationPopover label="Valor do aluguel no mês" withArrow>
                                    <Text component="span" size="sm">Aluguel</Text>
                                  </ExplanationPopover>
                                </Table.Th>
                                <Table.Th>
                                  <ExplanationPopover label="Condomínio + IPTU mensal" withArrow>
                                    <Text component="span" size="sm">Cond+IPTU</Text>
                                  </ExplanationPopover>
                                </Table.Th>
                                {monthlyNetIncome != null && (
                                  <Table.Th>
                                    <ExplanationPopover label="Orçamento disponível menos custo de moradia (aluguel + condomínio/IPTU). Ative o valor para abrir a composição." withArrow>
                                      <Text component="span" size="sm">Sobra</Text>
                                    </ExplanationPopover>
                                  </Table.Th>
                                )}
                                {/* Investimentos */}
                                <Table.Th style={{ boxShadow: 'inset 2px 0 0 var(--farol-chart-3)' }}>
                                  <ExplanationPopover label="Aportes programados (configurados na entrada)" withArrow>
                                    <Text component="span" size="sm">Aportes</Text>
                                  </ExplanationPopover>
                                </Table.Th>
                                <Table.Th>
                                  <ExplanationPopover label="Investimento adicional (diferença financiamento-aluguel, se ativo)" withArrow>
                                    <Text component="span" size="sm">Inv. adic.</Text>
                                  </ExplanationPopover>
                                </Table.Th>
                                <Table.Th>
                                  <ExplanationPopover label="Valor sacado do investimento para pagar aluguel" withArrow>
                                    <Text component="span" size="sm">Saque</Text>
                                  </ExplanationPopover>
                                </Table.Th>
                                <Table.Th>
                                  <ExplanationPopover label="Retorno líquido do investimento no mês" withArrow>
                                    <Text component="span" size="sm">Retorno</Text>
                                  </ExplanationPopover>
                                </Table.Th>
                                <Table.Th>
                                  <ExplanationPopover label="Saldo acumulado de investimentos" withArrow>
                                    <Text component="span" size="sm">Saldo inv.</Text>
                                  </ExplanationPopover>
                                </Table.Th>
                                {/* Meta de compra */}
                                <Table.Th style={{ boxShadow: 'inset 2px 0 0 var(--farol-chart-2)' }}>
                                  <ExplanationPopover label="Valor necessário para comprar (imóvel + custos)" withArrow>
                                    <Text component="span" size="sm">Alvo</Text>
                                  </ExplanationPopover>
                                </Table.Th>
                                <Table.Th>Progresso</Table.Th>
                                <Table.Th>
                                  <ExplanationPopover label="Quanto ainda falta para atingir o alvo" withArrow>
                                    <Text component="span" size="sm">Falta</Text>
                                  </ExplanationPopover>
                                </Table.Th>
                                <Table.Th>
                                  <ExplanationPopover label="FGTS utilizado neste mês" withArrow>
                                    <Text component="span" size="sm">FGTS</Text>
                                  </ExplanationPopover>
                                </Table.Th>
                                <Table.Th>
                                  <ExplanationPopover label="Reserva de caixa sem rendimento usada na compra à vista" withArrow>
                                    <Text component="span" size="sm">Caixa compra</Text>
                                  </ExplanationPopover>
                                </Table.Th>
                                {/* Patrimônio */}
                                <Table.Th style={{ boxShadow: 'inset 2px 0 0 var(--farol-chart-1)' }}>
                                  <ExplanationPopover label="Valor do imóvel (com valorização)" withArrow>
                                    <Text component="span" size="sm">Imóvel</Text>
                                  </ExplanationPopover>
                                </Table.Th>
                                <Table.Th>
                                  <ExplanationPopover label="Equidade no imóvel (só após compra)" withArrow>
                                    <Text component="span" size="sm">Equidade</Text>
                                  </ExplanationPopover>
                                </Table.Th>
                              </>
                            )}
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {rows.slice(0, 600).map((m: any) => {
                            const isPurchase =
                              purchaseMonth != null ? m.month === purchaseMonth : m.status === 'Imóvel comprado';
                            const isPostPurchase = purchaseMonth != null ? m.month > purchaseMonth : m.phase === 'post_purchase';

                            // Calculate housing cost and surplus for invest-buy scenario
                            const housingDue = (m?.rent_due ?? 0) + (m?.monthly_additional_costs ?? 0);
                            // Use backend's inflation-adjusted income for surplus calculation
                            const { surplus, effectiveIncome } = getEffectiveSurplus(m, housingDue, monthlyNetIncome);
                            const isNegativeSurplus = surplus != null && surplus < 0 && !isPurchase && !isPostPurchase;

                            return (
                              <Table.Tr
                                key={m.month}
                                style={{
                                  backgroundColor: isPurchase
                                    ? 'light-dark(var(--mantine-color-success-0), var(--mantine-color-dark-7))'
                                    : isPostPurchase
                                      ? 'light-dark(var(--mantine-color-ocean-0), var(--mantine-color-dark-8))'
                                      : isNegativeSurplus
                                        ? 'light-dark(var(--mantine-color-danger-0), var(--mantine-color-dark-7))'
                                        : undefined,
                                  fontWeight: m.is_milestone ? 600 : 400,
                                }}
                              >
                                <Table.Td>{m.month}</Table.Td>
                                <Table.Td>{yearFromMonth(m.month)}</Table.Td>
                                <Table.Td>
                                  <Badge size="sm" variant="light" color={isPurchase ? 'success' : 'ocean'}>
                                    {m.status || '—'}
                                  </Badge>
                                </Table.Td>
                                <Table.Td>
                                  <ExplanationPopover
                                    label={<InvestBuyOutflowExplanation m={m} />}
                                    multiline
                                    w={400}
                                    withArrow
                                    position="top-start"
                                  >
                                    <Text
                                      component="span"
                                      style={{ textDecoration: 'underline dotted' }}
                                    >
                                      {moneySafe(monthlyOutflow(m))}
                                    </Text>
                                  </ExplanationPopover>
                                </Table.Td>
                                <Table.Td>{moneySafe(wealthAt(m))}</Table.Td>
                                {tableView === 'essential' ? (
                                  <>
                                    {surplus != null && (
                                      <Table.Td>
                                        <ExplanationPopover
                                          label={
                                          <SurplusBreakdown
                                              netIncome={effectiveIncome ?? monthlyNetIncome ?? 0}
                                              housingCost={housingDue}
                                              rent={m.rent_due}
                                              monthlyCosts={m.monthly_additional_costs}
                                              scenarioType="invest_buy"
                                              incomeAdjusted={Boolean(inputPayload?.monthly_net_income_adjust_inflation)}
                                            />
                                          }
                                          multiline
                                          w={320}
                                          withArrow
                                          position="left"
                                        >
                                          <Text
                                          c={surplus >= 0 ? 'var(--farol-chart-positive)' : 'var(--farol-chart-negative)'}
                                            fw={500}
                                            style={{ textDecoration: 'underline dotted' }}
                                          >
                                            {signedMoney(surplus)}
                                          </Text>
                                        </ExplanationPopover>
                                      </Table.Td>
                                    )}
                                    <Table.Td>{m.progress_percent != null ? `${m.progress_percent.toFixed(1)}%` : '—'}</Table.Td>
                                    <Table.Td>{moneySafe(m.shortfall)}</Table.Td>
                                    <Table.Td>{moneySafe(m.investment_balance)}</Table.Td>
                                  </>
                                ) : (
                                  <>
                                    <Table.Td>{moneySafe(m.rent_due)}</Table.Td>
                                    <Table.Td>{moneySafe(m.monthly_additional_costs)}</Table.Td>
                                    {surplus != null && (
                                      <Table.Td>
                                        <ExplanationPopover
                                          label={
                                          <SurplusBreakdown
                                              netIncome={effectiveIncome ?? monthlyNetIncome ?? 0}
                                              housingCost={housingDue}
                                              rent={m.rent_due}
                                              monthlyCosts={m.monthly_additional_costs}
                                              scenarioType="invest_buy"
                                              incomeAdjusted={Boolean(inputPayload?.monthly_net_income_adjust_inflation)}
                                            />
                                          }
                                          multiline
                                          w={320}
                                          withArrow
                                          position="left"
                                        >
                                          <Text
                                          c={surplus >= 0 ? 'var(--farol-chart-positive)' : 'var(--farol-chart-negative)'}
                                            fw={500}
                                            style={{ textDecoration: 'underline dotted' }}
                                          >
                                            {signedMoney(surplus)}
                                          </Text>
                                        </ExplanationPopover>
                                      </Table.Td>
                                    )}
                                    <Table.Td>
                                      {m.extra_contribution_total > 0 ? moneySafe(m.extra_contribution_total) : '—'}
                                    </Table.Td>
                                    <Table.Td>
                                      {m.additional_investment > 0 ? moneySafe(m.additional_investment) : '—'}
                                    </Table.Td>
                                    <Table.Td>{moneySafe(m.rent_withdrawal_from_investment)}</Table.Td>
                                    <Table.Td>{moneySafe(m.investment_return_net)}</Table.Td>
                                    <Table.Td>{moneySafe(m.investment_balance)}</Table.Td>
                                    <Table.Td>{moneySafe(m.target_purchase_cost)}</Table.Td>
                                    <Table.Td>{m.progress_percent != null ? `${m.progress_percent.toFixed(1)}%` : '—'}</Table.Td>
                                    <Table.Td>{moneySafe(m.shortfall)}</Table.Td>
                                    <Table.Td>{m.fgts_used > 0 ? moneySafe(m.fgts_used) : '—'}</Table.Td>
                                    <Table.Td>
                                      {m.cash_reserve_used_for_purchase > 0
                                        ? moneySafe(m.cash_reserve_used_for_purchase)
                                        : '—'}
                                    </Table.Td>
                                    <Table.Td>{moneySafe(m.property_value)}</Table.Td>
                                    <Table.Td>{m.equity > 0 ? moneySafe(m.equity) : '—'}</Table.Td>
                                  </>
                                )}
                              </Table.Tr>
                            );
                          })}
                        </Table.Tbody>
                      </Table>
                    )
                  )}
                </ScrollArea>

                {/* Color legend for table rows */}
                <Group gap="md" mt="md" wrap="wrap">
                  <Text size="xs" c="dimmed" fw={600}>Legenda de cores:</Text>
                  {isBuy && (
                    <>
                      <Group gap={6}>
                        <Box aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--farol-chart-positive)' }} />
                        <Text size="xs" c="dimmed">Mês de quitação</Text>
                      </Group>
                      {monthlyNetIncome != null && (
                        <Group gap={6}>
                          <Box aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--farol-chart-negative)' }} />
                          <Text size="xs" c="dimmed">Orçamento insuficiente</Text>
                        </Group>
                      )}
                    </>
                  )}
                  {isRentInvest && (
                    <>
                      <Group gap={6}>
                        <Box aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--farol-chart-4)' }} />
                        <Text size="xs" c="dimmed">Mês de &quot;burn&quot; (saque {'>'} retorno)</Text>
                      </Group>
                      {monthlyNetIncome != null && (
                        <Group gap={6}>
                          <Box aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--farol-chart-negative)' }} />
                          <Text size="xs" c="dimmed">Orçamento insuficiente</Text>
                        </Group>
                      )}
                    </>
                  )}
                  {isInvestBuy && (
                    <>
                      <Group gap={6}>
                        <Box aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--farol-chart-positive)' }} />
                        <Text size="xs" c="dimmed">Mês da compra</Text>
                      </Group>
                      <Group gap={6}>
                        <Box aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--farol-chart-1)' }} />
                        <Text size="xs" c="dimmed">Pós-compra</Text>
                      </Group>
                      {monthlyNetIncome != null && (
                        <Group gap={6}>
                          <Box aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--farol-chart-negative)' }} />
                          <Text size="xs" c="dimmed">Orçamento insuficiente (pré-compra)</Text>
                        </Group>
                      )}
                    </>
                  )}
                </Group>

                <Divider my="md" color="var(--farol-border)" />
                <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="md">
                  <Box>
                    <Text size="xs" c="dimmed">Break-even</Text>
                    <Text fw={600} c="var(--farol-chart-1)">
                      {s.metrics.break_even_month != null ? `Mês ${s.metrics.break_even_month}` : '—'}
                    </Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed">Retorno comparável</Text>
                    <Text fw={600} c="var(--farol-chart-1)">{roi(s.metrics.roi_percentage)}</Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed">Retorno incl. saques</Text>
                    <Text fw={600} c="var(--farol-chart-1)">
                      {roi(s.metrics.roi_including_withdrawals_percentage)}
                    </Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed">Meses com burn</Text>
                    <Text fw={600} c="var(--farol-chart-1)">{s.metrics.months_with_burn ?? '—'}</Text>
                  </Box>
                </SimpleGrid>

                {(s.metrics.total_rent_withdrawn_from_investment != null || s.metrics.average_sustainable_withdrawal_ratio != null) && (
                  <Group gap="xs" mt="md" wrap="wrap">
                    {s.metrics.total_rent_withdrawn_from_investment != null && (
                      <Badge variant="light" color="ocean">
                        Aluguel sacado do investimento: {money(s.metrics.total_rent_withdrawn_from_investment)}
                      </Badge>
                    )}
                    {s.metrics.average_sustainable_withdrawal_ratio != null && (
                      <Badge variant="light" color="ocean">
                        Retirada sustentável média: {ratio(s.metrics.average_sustainable_withdrawal_ratio, 2)} ({ratioAsPercent(s.metrics.average_sustainable_withdrawal_ratio, 0)})
                      </Badge>
                    )}
                  </Group>
                )}
              </Box>
            </Tabs.Panel>
          );
        })}
      </Tabs>
    </Stack>
  );
}
