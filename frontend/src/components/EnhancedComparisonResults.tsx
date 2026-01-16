import { useState } from 'react';
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
  Tooltip,
  ActionIcon,
} from '@mantine/core';
import { EnhancedComparisonResult } from '../api/types';
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
import { CHART_COLORS } from '../utils/colors';
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

  // Prefer explicit housing_due when provided (rent + HOA/IPTU).
  if (m?.housing_due != null) {
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
    baseCost += extraCash;
  }

  return baseCost;
};

/**
 * Generates a detailed breakdown tooltip explaining the "Sobra" (surplus) calculation.
 * This helps users understand exactly what is being deducted from their net income.
 */
const SurplusBreakdownTooltip = ({ 
  netIncome, 
  housingCost,
  installment,
  rent,
  monthlyCosts,
  extraAmortCash,
  scenarioType,
}: {
  netIncome: number;
  housingCost: number;
  installment?: number;
  rent?: number;
  monthlyCosts?: number;
  extraAmortCash?: number;
  scenarioType: 'buy' | 'rent_invest' | 'invest_buy';
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
        <Text size="xs" c="ocean.6">Renda líquida informada</Text>
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
        <Text size="xs" fw={700} c={surplus >= 0 ? 'ocean.7' : 'danger.6'}>
          {signedMoney(surplus)}
        </Text>
      </Group>
      <Text size="xs" c="dimmed" mt={6} fs="italic">
        Nota: A sobra considera apenas custos recorrentes mensais. 
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
  const externalSurplus = m?.external_surplus_invested ?? 0;
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
      {(initialAllocation > 0 || additionalInvestment > 0 || contributions > 0 || externalSurplus > 0) && (
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
          {externalSurplus > 0 && (
            <Group justify="space-between" gap={16}>
              <Text size="xs" c="dimmed">Sobra externa investida</Text>
              <Text size="xs">{money(externalSurplus)}</Text>
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
  scenario: any;
  isBest: boolean;
  bestScenario: any;
  index: number;
  monthlyNetIncome?: number | null;
}

function ScenarioCardNew({ scenario, isBest, bestScenario, index, monthlyNetIncome }: ScenarioCardNewProps) {
  const s = scenario;
  // Use new semantic colors for scenarios
  const colorMap = ['ocean', 'teal', 'violet'] as const;
  const color = colorMap[index % colorMap.length];
  const iconMap = [<IconBuildingBank size={24} />, <IconChartLine size={24} />, <IconPigMoney size={24} />];
  
  // Backend semantics:
  // - final_equity (a.k.a. final_wealth) represents total wealth at the end (imóvel + investimentos + FGTS).
  // - equity (monthly record) represents property equity only (imóvel - saldo devedor).
  const finalWealth = (s.final_wealth ?? s.final_equity) as number;
  const bestFinalWealth = (bestScenario.final_wealth ?? bestScenario.final_equity) as number;
  const wealthDelta = finalWealth - bestFinalWealth;
  const costDelta = s.total_cost - bestScenario.total_cost;

  const lastMonth = Array.isArray(s.monthly_data) && s.monthly_data.length > 0
    ? s.monthly_data[s.monthly_data.length - 1]
    : null;
  const propertyEquity = (lastMonth?.equity ?? 0) as number;

  const firstMonth = Array.isArray(s.monthly_data) && s.monthly_data.length > 0
    ? (s.monthly_data.find((m: any) => m.month === 1) || s.monthly_data[0])
    : null;
  // For affordability analysis, include cash amortizations (but not bonus/13_salario)
  const housingCostMonth1 = firstMonth ? recurringHousingCost(firstMonth, true) : 0;
  const incomeSurplusMonth1 =
    typeof monthlyNetIncome === 'number' ? monthlyNetIncome - housingCostMonth1 : null;

  // Affordability metrics: calculate % of income used and months with negative surplus
  const affordabilityMetrics = (() => {
    if (typeof monthlyNetIncome !== 'number' || monthlyNetIncome <= 0) return null;
    
    const monthlyData = Array.isArray(s.monthly_data) ? s.monthly_data : [];
    let monthsNegative = 0;
    let totalHousingCost = 0;
    let validMonths = 0;
    let maxHousingCost = 0;
    let maxHousingMonth = 1;

    for (const m of monthlyData) {
      // Include cash amortizations for affordability (but not bonus/13_salario)
      const cost = recurringHousingCost(m, true);
      if (cost > 0) {
        totalHousingCost += cost;
        validMonths++;
        if (cost > monthlyNetIncome) {
          monthsNegative++;
        }
        if (cost > maxHousingCost) {
          maxHousingCost = cost;
          maxHousingMonth = m.month;
        }
      }
    }

    const incomeUsedMonth1 = housingCostMonth1 > 0 
      ? (housingCostMonth1 / monthlyNetIncome) * 100 
      : 0;
    const avgHousingCost = validMonths > 0 ? totalHousingCost / validMonths : 0;
    const avgIncomeUsed = avgHousingCost > 0 
      ? (avgHousingCost / monthlyNetIncome) * 100 
      : 0;

    return {
      incomeUsedMonth1,
      avgIncomeUsed,
      monthsNegative,
      totalMonths: validMonths,
      maxHousingCost,
      maxHousingMonth,
    };
  })();

  const Help = ({ label, help }: { label: string; help: ReactNode }) => (
    <Tooltip label={help} multiline w={320} withArrow position="top-start">
      <ActionIcon variant="subtle" color="gray" size="xs" aria-label={`Ajuda: ${label}`}>
        <IconHelpCircle size={14} />
      </ActionIcon>
    </Tooltip>
  );

  return (
    <Box
      p="xl"
      className={isBest ? 'card-hover' : ''}
      style={{
        background: isBest
          ? 'light-dark(linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(59, 130, 246, 0.06) 100%), linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.08) 100%))'
          : 'var(--glass-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: isBest
          ? '0 8px 32px -8px rgba(59, 130, 246, 0.3), var(--glass-shadow-glow)'
          : 'var(--glass-shadow), var(--glass-shadow-glow)',
        borderRadius: 'var(--mantine-radius-xl)',
        position: 'relative',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      {/* Winner badge */}
      {isBest && (
        <Badge
          color="ocean"
          variant="filled"
          size="sm"
          leftSection={<IconCrown size={12} />}
          style={{
            position: 'absolute',
            top: rem(16),
            right: rem(16),
          }}
        >
          Melhor Opção
        </Badge>
      )}

      {/* Header */}
      <Group gap="md" mb="lg">
        <ThemeIcon
          size={52}
          radius="md"
          variant={isBest ? 'filled' : 'light'}
          color={color}
        >
          {iconMap[index % 3]}
        </ThemeIcon>
        <Box>
          <Text fw={700} size="xl" c={isBest ? 'bright' : 'bright'}>
            {s.name}
          </Text>
          <Text size="sm" c="dimmed">
            {index === 0 ? 'Financiamento imobiliário' : index === 1 ? 'Aluguel + investimento' : 'Investir para comprar'}
          </Text>
        </Box>
      </Group>

      {/* Main Metric - Patrimônio */}
      <Box
        p="lg"
        mb="lg"
        style={{
          backgroundColor: 'light-dark(var(--mantine-color-ocean-0), var(--mantine-color-dark-7))',
          borderRadius: rem(10),
        }}
      >
        <Group gap={6} align="center" wrap="nowrap">
          <Text size="xs" c="ocean.6" tt="uppercase" fw={500} style={{ letterSpacing: '0.5px' }}>
            Patrimônio Final
          </Text>
          <Help
            label="Patrimônio Final"
            help="Total de ativos acumulados no fim do horizonte da simulação (equidade + investimentos + FGTS)."
          />
        </Group>
        <Text fw={700} style={{ fontSize: rem(32), lineHeight: 1.1 }} c="bright">
          {money(finalWealth)}
        </Text>
        {!isBest && wealthDelta !== 0 && (
          <Group gap={4} mt={4}>
            {wealthDelta < 0 ? (
              <IconArrowDownRight size={14} color="var(--mantine-color-danger-6)" />
            ) : (
              <IconArrowUpRight size={14} color="var(--mantine-color-ocean-7)" />
            )}
            <Text size="xs" c={wealthDelta < 0 ? 'danger.6' : 'ocean.7'} fw={500}>
              {wealthDelta > 0 ? '+' : ''}{money(wealthDelta)} vs melhor
            </Text>
          </Group>
        )}
      </Box>

      {/* Metrics Grid */}
      <SimpleGrid cols={2} spacing="md">
        <Box>
          <Group gap={6} align="center" wrap="nowrap" mb={2}>
            <Text size="xs" c="ocean.5">
              Custo Líquido
            </Text>
            <Help
              label="Custo Líquido"
              help="Custo líquido estimado no horizonte: total de saídas/alocações (total_outflows) menos o patrimônio final (final_equity). Observação: o 'melhor cenário' é escolhido por variação de patrimônio (net_worth_change), não por menor custo líquido."
            />
          </Group>
          <Group gap={4} align="center">
            <Text fw={600} size="md" c="ocean.8">
              {money(s.total_cost)}
            </Text>
            {!isBest && costDelta !== 0 && (
              <Text size="xs" c={costDelta > 0 ? 'danger.6' : 'ocean.7'}>
                ({costDelta > 0 ? '+' : ''}{money(costDelta)})
              </Text>
            )}
          </Group>
        </Box>
        <Box>
          <Group gap={6} align="center" wrap="nowrap" mb={2}>
            <Text size="xs" c="ocean.5">
              Equidade
            </Text>
            <Help
              label="Equidade"
              help="Equidade do imóvel (valor do imóvel menos saldo devedor). Não inclui investimentos nem FGTS. Em cenários sem compra, fica 0."
            />
          </Group>
          <Text fw={600} size="md" c="ocean.8">
            {money(propertyEquity)}
          </Text>
        </Box>
        <Box>
          <Group gap={6} align="center" wrap="nowrap" mb={2}>
            <Text size="xs" c="ocean.5">
              ROI
            </Text>
            <Help
              label="ROI"
              help="Retorno percentual estimado. Em geral, compara o que você terminou com o que saiu do seu bolso (varia por cenário e regras)."
            />
          </Group>
          <Text fw={600} size="md" c="ocean.8">
            {percent(s.metrics.roi_percentage)}
          </Text>
        </Box>
        <Box>
          <Group gap={6} align="center" wrap="nowrap" mb={2}>
            <Text size="xs" c="ocean.5">
              Saída mensal média
            </Text>
            <Help
              label="Saída mensal média"
              help="Média da saída total mensal ao longo do horizonte (inclui entrada/alocação inicial e aportes quando aplicável). Útil para comparar esforço de caixa entre estratégias."
            />
          </Group>
          <Text size="xs" c="ocean.5" mb={2}>
            (inclui entrada/aportes)
          </Text>
          <Text fw={600} size="md" c="ocean.8">
            {money(s.metrics.average_monthly_cost)}
          </Text>
        </Box>
        {incomeSurplusMonth1 != null && (
          <Box>
            <Group gap={6} align="center" wrap="nowrap" mb={2}>
              <Text size="xs" c="ocean.5">
                Sobra mensal (mês 1)
              </Text>
              <Help
                label="Sobra mensal"
                help="Renda líquida menos custo de moradia recorrente no mês 1 (parcela/aluguel + custos mensais)."
              />
            </Group>
            <Text
              fw={600}
              size="md"
              c={incomeSurplusMonth1 >= 0 ? 'ocean.8' : 'danger.6'}
            >
              {signedMoney(incomeSurplusMonth1)}
            </Text>
          </Box>
        )}
        {affordabilityMetrics != null && (
          <Box>
            <Group gap={6} align="center" wrap="nowrap" mb={2}>
              <Text size="xs" c="ocean.5">
                % da renda (mês 1)
              </Text>
              <Help
                label="% da renda comprometida"
                help="Percentual da renda líquida comprometido com moradia no mês 1. Valores acima de 30% são considerados altos."
              />
            </Group>
            <Text
              fw={600}
              size="md"
              c={affordabilityMetrics.incomeUsedMonth1 <= 30 ? 'ocean.8' : affordabilityMetrics.incomeUsedMonth1 <= 50 ? 'warning.6' : 'danger.6'}
            >
              {affordabilityMetrics.incomeUsedMonth1.toFixed(1)}%
            </Text>
          </Box>
        )}
        {affordabilityMetrics != null && affordabilityMetrics.monthsNegative > 0 && (
          <Box>
            <Group gap={6} align="center" wrap="nowrap" mb={2}>
              <Text size="xs" c="ocean.5">
                Meses no vermelho
              </Text>
              <Help
                label="Meses no vermelho"
                help="Quantidade de meses onde o custo de moradia excede sua renda líquida."
              />
            </Group>
            <Text fw={600} size="md" c="danger.6">
              {affordabilityMetrics.monthsNegative} de {affordabilityMetrics.totalMonths}
            </Text>
          </Box>
        )}
      </SimpleGrid>

      {/* Affordability warning */}
      {affordabilityMetrics != null && affordabilityMetrics.monthsNegative > 0 && (
        <Alert
          mt="md"
          color="danger"
          variant="light"
          icon={<IconAlertCircle size={16} />}
          radius="md"
        >
          <Text size="sm" fw={600} c="danger.7">
            Atenção: Renda insuficiente em {affordabilityMetrics.monthsNegative} mês(es)
          </Text>
          <Text size="xs" c="dimmed">
            Em alguns meses, o custo de moradia excede sua renda líquida de {money(monthlyNetIncome as number)}.
            O pico é no mês {affordabilityMetrics.maxHousingMonth} com {money(affordabilityMetrics.maxHousingCost)}.
          </Text>
        </Alert>
      )}

      {/* Purchase breakdown (buy scenario) */}
      {s.purchase_breakdown && (
        <Box
          p="md"
          mt="md"
          style={{
            backgroundColor: 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6))',
            borderRadius: rem(10),
          }}
        >
          <Text size="xs" c="dimmed" fw={600} mb={6}>
            Composição da compra
          </Text>
          <SimpleGrid cols={2} spacing="xs">
            <Group gap={6} align="center">
              <Text size="sm" c="ocean.7">Entrada em dinheiro</Text>
              <Text size="sm" fw={700}>{money(s.purchase_breakdown.cash_down_payment)}</Text>
            </Group>
            <Group gap={6} align="center">
              <Text size="sm" c="ocean.7">FGTS na entrada</Text>
              <Text size="sm" fw={700}>{money(s.purchase_breakdown.fgts_at_purchase)}</Text>
            </Group>
            <Group gap={6} align="center">
              <Text size="sm" c="ocean.7">Financiado</Text>
              <Text size="sm" fw={700}>{money(s.purchase_breakdown.financed_amount)}</Text>
            </Group>
            <Group gap={6} align="center">
              <Text size="sm" c="ocean.7">Custos (ITBI+escritura)</Text>
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
            borderRadius: rem(10),
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
          <SimpleGrid cols={2} spacing="xs">
            <Group gap={6} align="center">
              <Text size="sm" c="ocean.7">Usado na entrada</Text>
              <Text size="sm" fw={700}>{money(s.fgts_summary.withdrawn_at_purchase)}</Text>
            </Group>
            <Group gap={6} align="center">
              <Text size="sm" c="ocean.7">Amortizações FGTS</Text>
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
              <Text size="xs" fw={600} c="warning.7">
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
      <Divider my="md" color="ocean.2" />
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
  );
}

export default function EnhancedComparisonResults({ result, inputPayload }: { result: EnhancedComparisonResult; inputPayload?: any }) {
  const [chartType, setChartType] = useState<'area' | 'line'>('area');
  const [overviewMetric, setOverviewMetric] = useState<'wealth' | 'outflow'>('wealth');
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [milestonesOnly, setMilestonesOnly] = useState(false);
  const [tableView, setTableView] = useState<'essential' | 'detailed'>('essential');
  const [showInputDetails, setShowInputDetails] = useState(false);
  const [showInputJson, setShowInputJson] = useState(false);

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

  const outflowTooltip = (m: any) => {
    const total = monthlyOutflow(m);
    const housing = recurringHousingCost(m);
    const initialAllocation = m?.initial_allocation ?? 0;
    const scheduledContribution = m?.extra_contribution_total ?? 0;
    const additionalInvestment = m?.additional_investment ?? 0;
    const externalSurplusInvested = m?.external_surplus_invested ?? 0;
    const upfront = m?.upfront_additional_costs ?? 0;
    const fgtsUsed = m?.fgts_used ?? 0;

    const rows = [
      { label: 'Moradia (mensal)', value: housing },
      { label: 'Alocação inicial (mês 1)', value: initialAllocation },
      { label: 'Aportes programados', value: scheduledContribution },
      { label: 'Aporte mensal/adicional', value: additionalInvestment },
      { label: 'Sobra externa investida', value: externalSurplusInvested },
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
  const wealthAt = (m: any) => (m?.equity || 0) + (m?.investment_balance || 0) + (m?.fgts_balance || 0);

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
        ? `${numSafe(inputPayload.rent_percentage, 2)}% a.a. (do valor do imóvel)`
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

  // Canonical rule: backend selects `best_scenario` by highest net_worth_change.
  // Keep UI highlight consistent with `result.best_scenario`.
  const bestScenario =
    result.scenarios.find((s) => s.name === result.best_scenario) ??
    [...result.scenarios].sort((a, b) => (b.net_worth_change ?? -Infinity) - (a.net_worth_change ?? -Infinity))[0];

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
      {/* Header */}
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
        <Box>
          <Group gap="sm" mb="xs">
            <ThemeIcon size={40} radius="md" variant="filled" color="ocean">
              <IconChartLine size={20} />
            </ThemeIcon>
            <Title order={2} fw={600} c="ocean.9">
              Resultados da Análise
            </Title>
          </Group>
          <Text size="md" c="ocean.6">
            Melhor cenário (critério: maior variação de patrimônio):{' '}
            <Text component="span" fw={600} c="ocean.8">{result.best_scenario}</Text>
          </Text>
          <Text size="xs" c="ocean.6" mt={4}>
            “Melhor” aqui significa maior variação de patrimônio (não menor desembolso/custo líquido).
          </Text>
        </Box>
        <Menu withinPortal position="bottom-end">
          <Menu.Target>
            <Button
              variant="light"
              color="ocean"
              leftSection={<IconDownload size={16} />}
              radius="lg"
            >
              Exportar
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Formato</Menu.Label>
            <Menu.Item onClick={() => downloadFile('/api/compare-scenarios-enhanced/export?format=csv', 'POST', inputPayload, 'scenarios_comparison.csv')}>
              CSV
            </Menu.Item>
            <Menu.Item onClick={() => downloadFile('/api/compare-scenarios-enhanced/export?format=xlsx', 'POST', inputPayload, 'scenarios_comparison.xlsx')}>
              Excel (XLSX)
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      {/* Global affordability alert */}
      {monthlyNetIncome != null && (() => {
        // Check if any scenario has months where income is insufficient
        const affordabilityIssues = result.scenarios.map((s) => {
          const monthlyData = Array.isArray(s.monthly_data) ? s.monthly_data : [];
          let monthsNegative = 0;
          let maxDeficit = 0;
          let maxDeficitMonth = 1;
          for (const m of monthlyData as any[]) {
            // Include cash amortizations but not bonus/13_salario for affordability
            const cost = recurringHousingCost(m, true);
            const deficit = cost - monthlyNetIncome;
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
                Com base na sua renda líquida de <Text component="span" fw={600}>{money(monthlyNetIncome)}</Text>, identificamos os seguintes pontos de atenção:
              </Text>
              <Stack gap="xs">
                {affordabilityIssues.map((issue) => (
                  <Group key={issue.name} gap="xs">
                    <Badge color="warning" variant="light" size="sm">{issue.name}</Badge>
                    <Text size="xs" c="dimmed">
                      {issue.monthsNegative} mês(es) com renda insuficiente (maior déficit: {money(issue.maxDeficit)} no mês {issue.maxDeficitMonth})
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

      {/* Input payload summary (what was actually simulated) */}
      <Box
        p="lg"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: 'var(--glass-shadow), var(--glass-shadow-glow)',
          borderRadius: 'var(--mantine-radius-xl)',
        }}
      >
        <Group justify="space-between" align="center" wrap="wrap" gap="sm" mb="xs">
          <Group gap="xs">
            <ThemeIcon size={34} radius="lg" variant="light" color="ocean">
              <IconSettings size={16} />
            </ThemeIcon>
            <Box>
              <Text fw={700} c="bright">
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
              size="xs"
              onClick={() => setShowInputDetails((v) => !v)}
            >
              {showInputDetails ? 'Ocultar detalhes' : 'Ver detalhes'}
            </Button>
            <Button
              variant="subtle"
              color="ocean"
              radius="lg"
              size="xs"
              disabled={!inputPayload}
              onClick={() => {
                setShowInputDetails(true);
                setShowInputJson((v) => !v);
              }}
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
                  Renda líquida: {inputSummary?.netIncomeLabel}
                </Badge>
              )}
            </Group>

            <Collapse in={showInputDetails}>
              <Divider my="sm" color="ocean.2" />
              <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="sm">
                <Box>
                  <Text size="xs" c="ocean.6">Aluguel</Text>
                  <Text fw={600} c="bright">{inputSummary?.rentLabel ?? '—'}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="ocean.6">Renda líquida mensal</Text>
                  <Text fw={600} c="bright">{inputSummary?.netIncomeLabel ?? '—'}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="ocean.6">Retornos investimento</Text>
                  <Text fw={600} c="bright">{inputSummary?.invReturnsLabel ?? '—'}</Text>
                </Box>
              </SimpleGrid>

              <Collapse in={showInputJson}>
                <Divider my="sm" color="ocean.2" />
                <ScrollArea h={220} type="hover" scrollbarSize={8} offsetScrollbars>
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
              </Collapse>
            </Collapse>
          </>
        )}
      </Box>

      {/* Scenario Cards */}
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
        {result.scenarios.map((s, idx) => (
          <ScenarioCardNew
            key={`${s.name}-${s.total_cost}-${s.final_equity}`}
            scenario={s}
            isBest={s.name === bestScenario.name}
            bestScenario={bestScenario}
            index={idx}
            monthlyNetIncome={monthlyNetIncome}
          />
        ))}
      </SimpleGrid>

      {/* Comparative Summary */}
      <Box
        p="xl"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: 'var(--glass-shadow), var(--glass-shadow-glow)',
          borderRadius: 'var(--mantine-radius-xl)',
        }}
      >
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm" mb="md">
          <Box>
            <Text fw={600} size="lg" c="bright">
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
          <ScrollArea type="hover" scrollbarSize={8} offsetScrollbars>
            <Table striped highlightOnHover>
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
                    <Table.Td c={r.buy_vs_rent_difference > 0 ? 'danger.6' : r.buy_vs_rent_difference < 0 ? 'success.7' : 'ocean.6'}>
                      {signedMoney(r.buy_vs_rent_difference)}
                    </Table.Td>
                    <Table.Td
                      c={
                        r.buy_vs_rent_percentage == null
                          ? 'dimmed'
                          : r.buy_vs_rent_percentage > 0
                            ? 'danger.6'
                            : r.buy_vs_rent_percentage < 0
                              ? 'success.7'
                              : 'ocean.6'
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
          <Text size="sm" c="ocean.6">
            Resumo comparativo indisponível.
          </Text>
        )}

        <Text size="xs" c="ocean.6" mt="sm">
          Interpretação: valores positivos em “Comprar − Alugar” significam que comprar foi mais caro no mês (pior para comprar no curto prazo).
        </Text>
      </Box>

      {/* Charts and Tables */}
      <Tabs value={activeTab} onChange={(v) => setActiveTab(v || 'overview')} variant="pills" radius="lg">
        <Box
          p="md"
          mb="md"
          style={{
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: 'var(--glass-shadow), var(--glass-shadow-glow)',
            borderRadius: 'var(--mantine-radius-xl)',
          }}
        >
          <Group justify="space-between" align="center" wrap="wrap" gap="md">
            <Tabs.List>
              <Tabs.Tab value="overview" leftSection={<IconChartArea size={16} />}>
                Evolução do Patrimônio
              </Tabs.Tab>
              {result.scenarios.map((s) => (
                <Tabs.Tab key={s.name} value={s.name} leftSection={<IconTable size={16} />}>
                  {s.name}
                </Tabs.Tab>
              ))}
            </Tabs.List>
            {activeTab === 'overview' && (
              <Group gap="xs" wrap="wrap">
                <SegmentedControl
                  size="xs"
                  radius="lg"
                  value={overviewMetric}
                  onChange={(v) => setOverviewMetric(v as any)}
                  data={[
                    { label: 'Patrimônio', value: 'wealth' },
                    { label: 'Saída total', value: 'outflow' },
                  ]}
                />
                <SegmentedControl
                  size="xs"
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
            p="xl"
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: 'var(--glass-shadow), var(--glass-shadow-glow)',
              borderRadius: 'var(--mantine-radius-xl)',
            }}
          >
            <Text fw={600} size="lg" mb="lg" c="bright">
              {overviewMetric === 'wealth'
                ? 'Evolução do Patrimônio ao Longo do Tempo'
                : 'Saída total mensal (inclui eventos e aportes) ao longo do tempo'}
            </Text>
            {chartType === 'area' && (
              <AreaChart
                h={350}
                data={overviewMetric === 'wealth' ? wealthData : outflowData}
                dataKey="month"
                series={result.scenarios.map((s, i) => ({
                  name: s.name,
                  color: [CHART_COLORS.scenarios.buy, CHART_COLORS.scenarios.rent, CHART_COLORS.scenarios.invest][i % 3],
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
                data={overviewMetric === 'wealth' ? wealthData : outflowData}
                dataKey="month"
                series={result.scenarios.map((s, i) => ({
                  name: s.name,
                  color: [CHART_COLORS.scenarios.buy, CHART_COLORS.scenarios.rent, CHART_COLORS.scenarios.invest][i % 3],
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
            <Text size="xs" c="dimmed" mt="sm">
              Eixo X: meses (marcado por anos). Passe o mouse para valores exatos.
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
                p="xl"
                style={{
                  background: 'var(--glass-bg)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  boxShadow: 'var(--glass-shadow), var(--glass-shadow-glow)',
                  borderRadius: 'var(--mantine-radius-xl)',
                }}
              >
                {/* Scenario header */}
                <Group justify="space-between" mb="lg" wrap="wrap" gap="md">
                  <Box>
                    <Text fw={600} size="lg" c="bright">
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
                        size="sm"
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
                      size="xs"
                      radius="lg"
                      value={tableView}
                      onChange={(v) => setTableView(v as any)}
                      data={[
                        { label: 'Essencial', value: 'essential' },
                        { label: 'Detalhada', value: 'detailed' },
                      ]}
                    />
                    <Text size="xs" c="ocean.6">
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
                <ScrollArea h={400} type="hover" scrollbarSize={8} offsetScrollbars>
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

                    const showThroughPayoff = payoffMonth != null;
                    const buyRows = showThroughPayoff
                      ? rows.filter((r: any) => r.month <= payoffMonth!)
                      : rows;

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
                            <Tooltip
                              label="Tabela do financiamento: parcela, juros, amortização (inclui extras) e saldo devedor."
                              withArrow
                            >
                              <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Ajuda: Tabela do financiamento">
                                <IconHelpCircle size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Group>

                        <Table fz="sm" striped highlightOnHover stickyHeader>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Mês</Table.Th>
                              <Table.Th>Ano</Table.Th>
                              <Table.Th>Parcela (R$)</Table.Th>
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
                                  <Tooltip label="Renda líquida menos custo de moradia mensal (parcela base + custos + amort. cash). Amortizações de FGTS, Bônus e 13º não são consideradas." withArrow>
                                    <Text component="span" size="sm">Sobra</Text>
                                  </Tooltip>
                                </Table.Th>
                              )}
                              <Table.Th>
                                <Tooltip label="Aportes programados (investimentos configurados)" withArrow>
                                  <Text component="span" size="sm">Aportes</Text>
                                </Tooltip>
                              </Table.Th>
                              <Table.Th>
                                <Tooltip label="Saldo acumulado de investimentos (inclui aportes)" withArrow>
                                  <Text component="span" size="sm">Saldo inv.</Text>
                                </Tooltip>
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
                              const housingCost = installment + monthlyCosts + extraCash;
                              const surplus = monthlyNetIncome != null ? monthlyNetIncome - housingCost : null;
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
                                      <Tooltip 
                                        label={
                                          <SurplusBreakdownTooltip
                                            netIncome={monthlyNetIncome}
                                            housingCost={housingCost}
                                            installment={installment}
                                            monthlyCosts={monthlyCosts}
                                            extraAmortCash={extraCash}
                                            scenarioType="buy"
                                          />
                                        }
                                        multiline
                                        w={320}
                                        withArrow
                                        position="left"
                                      >
                                        <Text 
                                          c={surplus >= 0 ? 'ocean.7' : 'danger.6'} 
                                          fw={500}
                                          style={{ cursor: 'help', textDecoration: 'underline dotted' }}
                                        >
                                          {signedMoney(surplus)}
                                        </Text>
                                      </Tooltip>
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
                        {!showThroughPayoff && (
                          <Text size="xs" c="dimmed" mt="sm">
                            Dica: se você adicionou amortizações extras, a quitação deve aparecer como saldo devedor ≈ 0.
                          </Text>
                        )}
                      </>
                    );
                  })() : (
                    isRentInvest ? (
                      <Table fz="sm" striped highlightOnHover stickyHeader>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Mês</Table.Th>
                            <Table.Th>Ano</Table.Th>
                            {tableView === 'essential' ? (
                              <>
                                <Table.Th>Moradia (R$)</Table.Th>
                                {monthlyNetIncome != null && (
                                  <Table.Th>
                                    <Tooltip label="Renda líquida menos custo de moradia (aluguel + cond/IPTU). Clique no valor para detalhes." withArrow>
                                      <Text component="span" size="sm">Sobra</Text>
                                    </Tooltip>
                                  </Table.Th>
                                )}
                                <Table.Th>Retorno (líq.)</Table.Th>
                                <Table.Th>Saldo invest.</Table.Th>
                                <Table.Th>Patrimônio</Table.Th>
                              </>
                            ) : (
                              <>
                                {/* Custos de Moradia */}
                                <Table.Th style={{ borderLeft: '2px solid var(--mantine-color-ocean-3)' }}>
                                  <Tooltip label="Valor do aluguel no mês" withArrow>
                                    <Text component="span" size="sm">Aluguel</Text>
                                  </Tooltip>
                                </Table.Th>
                                <Table.Th>
                                  <Tooltip label="Condomínio + IPTU mensal" withArrow>
                                    <Text component="span" size="sm">Cond+IPTU</Text>
                                  </Tooltip>
                                </Table.Th>
                                <Table.Th>
                                  <Tooltip label="Total de moradia devido (aluguel + cond/IPTU)" withArrow>
                                    <Text component="span" size="sm">Total devido</Text>
                                  </Tooltip>
                                </Table.Th>
                                {monthlyNetIncome != null && (
                                  <Table.Th>
                                    <Tooltip label="Renda líquida menos custo de moradia. Clique no valor para detalhes." withArrow>
                                      <Text component="span" size="sm">Sobra</Text>
                                    </Tooltip>
                                  </Table.Th>
                                )}
                                {/* Fluxo de caixa */}
                                <Table.Th style={{ borderLeft: '2px solid var(--mantine-color-info-3)' }}>
                                  <Tooltip label="Total efetivamente pago de moradia" withArrow>
                                    <Text component="span" size="sm">Pago</Text>
                                  </Tooltip>
                                </Table.Th>
                                <Table.Th>
                                  <Tooltip label="Diferença entre devido e pago (falta de caixa)" withArrow>
                                    <Text component="span" size="sm">Falta</Text>
                                  </Tooltip>
                                </Table.Th>
                                <Table.Th>
                                  <Tooltip label="Valor sacado do investimento para pagar moradia" withArrow>
                                    <Text component="span" size="sm">Saque</Text>
                                  </Tooltip>
                                </Table.Th>
                                <Table.Th>
                                  <Tooltip label="Cobertura de fonte externa (ex: poupança externa)" withArrow>
                                    <Text component="span" size="sm">Cob. ext.</Text>
                                  </Tooltip>
                                </Table.Th>
                                <Table.Th>
                                  <Tooltip label="Sobra externa investida" withArrow>
                                    <Text component="span" size="sm">Sobra inv.</Text>
                                  </Tooltip>
                                </Table.Th>
                                {/* Investimentos */}
                                <Table.Th style={{ borderLeft: '2px solid var(--mantine-color-teal-3)' }}>
                                  <Tooltip label="Aportes programados (configurados na entrada)" withArrow>
                                    <Text component="span" size="sm">Aportes</Text>
                                  </Tooltip>
                                </Table.Th>
                                <Table.Th>
                                  <Tooltip label="Retorno líquido do investimento no mês" withArrow>
                                    <Text component="span" size="sm">Retorno</Text>
                                  </Tooltip>
                                </Table.Th>
                                <Table.Th>
                                  <Tooltip label="Saldo acumulado de investimentos" withArrow>
                                    <Text component="span" size="sm">Saldo inv.</Text>
                                  </Tooltip>
                                </Table.Th>
                                <Table.Th>
                                  <Tooltip label="Patrimônio total (investimentos + FGTS)" withArrow>
                                    <Text component="span" size="sm">Patrimônio</Text>
                                  </Tooltip>
                                </Table.Th>
                                <Table.Th>
                                  <Tooltip label="Valor do imóvel de referência (com valorização)" withArrow>
                                    <Text component="span" size="sm">Imóvel ref.</Text>
                                  </Tooltip>
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
                            const surplus = monthlyNetIncome != null ? monthlyNetIncome - housingDue : null;
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
                                        <Tooltip 
                                          label={
                                            <SurplusBreakdownTooltip
                                              netIncome={monthlyNetIncome}
                                              housingCost={housingDue}
                                              rent={m.rent_due}
                                              monthlyCosts={m.monthly_additional_costs}
                                              scenarioType="rent_invest"
                                            />
                                          }
                                          multiline
                                          w={320}
                                          withArrow
                                          position="left"
                                        >
                                          <Text 
                                            c={surplus >= 0 ? 'ocean.7' : 'danger.6'} 
                                            fw={500}
                                            style={{ cursor: 'help', textDecoration: 'underline dotted' }}
                                          >
                                            {signedMoney(surplus)}
                                          </Text>
                                        </Tooltip>
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
                                        <Tooltip 
                                          label={
                                            <SurplusBreakdownTooltip
                                              netIncome={monthlyNetIncome}
                                              housingCost={housingDue}
                                              rent={m.rent_due}
                                              monthlyCosts={m.monthly_additional_costs}
                                              scenarioType="rent_invest"
                                            />
                                          }
                                          multiline
                                          w={320}
                                          withArrow
                                          position="left"
                                        >
                                          <Text 
                                            c={surplus >= 0 ? 'ocean.7' : 'danger.6'} 
                                            fw={500}
                                            style={{ cursor: 'help', textDecoration: 'underline dotted' }}
                                          >
                                            {signedMoney(surplus)}
                                          </Text>
                                        </Tooltip>
                                      </Table.Td>
                                    )}
                                    <Table.Td>{moneySafe(m.housing_paid)}</Table.Td>
                                    <Table.Td>{moneySafe(m.housing_shortfall)}</Table.Td>
                                    <Table.Td>{moneySafe(m.rent_withdrawal_from_investment)}</Table.Td>
                                    <Table.Td>{moneySafe(m.external_cover)}</Table.Td>
                                    <Table.Td>{moneySafe(m.external_surplus_invested)}</Table.Td>
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
                      <Table fz="sm" striped highlightOnHover stickyHeader>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Mês</Table.Th>
                            <Table.Th>Ano</Table.Th>
                            <Table.Th>Status</Table.Th>
                            <Table.Th>
                              <Group gap={6} wrap="nowrap">
                                <Text component="span">Saída total</Text>
                                <Tooltip
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
                                </Tooltip>
                              </Group>
                            </Table.Th>
                            <Table.Th>Patrimônio</Table.Th>
                            {tableView === 'essential' ? (
                              <>
                                {monthlyNetIncome != null && (
                                  <Table.Th>
                                    <Tooltip label="Renda líquida menos custo de moradia mensal" withArrow>
                                      <Text component="span" size="sm">Sobra</Text>
                                    </Tooltip>
                                  </Table.Th>
                                )}
                                <Table.Th>Progresso</Table.Th>
                                <Table.Th>Falta (R$)</Table.Th>
                                <Table.Th>Saldo invest.</Table.Th>
                              </>
                            ) : (
                              <>
                                {/* Custos de Moradia */}
                                <Table.Th style={{ borderLeft: '2px solid var(--mantine-color-ocean-3)' }}>
                                  <Tooltip label="Valor do aluguel no mês" withArrow>
                                    <Text component="span" size="sm">Aluguel</Text>
                                  </Tooltip>
                                </Table.Th>
                                <Table.Th>
                                  <Tooltip label="Condomínio + IPTU mensal" withArrow>
                                    <Text component="span" size="sm">Cond+IPTU</Text>
                                  </Tooltip>
                                </Table.Th>
                                {monthlyNetIncome != null && (
                                  <Table.Th>
                                    <Tooltip label="Renda líquida menos custo de moradia (aluguel + cond/IPTU). Clique no valor para detalhes." withArrow>
                                      <Text component="span" size="sm">Sobra</Text>
                                    </Tooltip>
                                  </Table.Th>
                                )}
                                {/* Investimentos */}
                                <Table.Th style={{ borderLeft: '2px solid var(--mantine-color-info-3)' }}>
                                  <Tooltip label="Aportes programados (configurados na entrada)" withArrow>
                                    <Text component="span" size="sm">Aportes</Text>
                                  </Tooltip>
                                </Table.Th>
                                <Table.Th>
                                  <Tooltip label="Investimento adicional (diferença financiamento-aluguel, se ativo)" withArrow>
                                    <Text component="span" size="sm">Inv. adic.</Text>
                                  </Tooltip>
                                </Table.Th>
                                <Table.Th>
                                  <Tooltip label="Sobra externa investida (quando configurado)" withArrow>
                                    <Text component="span" size="sm">Sobra ext.</Text>
                                  </Tooltip>
                                </Table.Th>
                                <Table.Th>
                                  <Tooltip label="Valor sacado do investimento para pagar aluguel" withArrow>
                                    <Text component="span" size="sm">Saque</Text>
                                  </Tooltip>
                                </Table.Th>
                                <Table.Th>
                                  <Tooltip label="Retorno líquido do investimento no mês" withArrow>
                                    <Text component="span" size="sm">Retorno</Text>
                                  </Tooltip>
                                </Table.Th>
                                <Table.Th>
                                  <Tooltip label="Saldo acumulado de investimentos" withArrow>
                                    <Text component="span" size="sm">Saldo inv.</Text>
                                  </Tooltip>
                                </Table.Th>
                                {/* Meta de compra */}
                                <Table.Th style={{ borderLeft: '2px solid var(--mantine-color-teal-3)' }}>
                                  <Tooltip label="Valor necessário para comprar (imóvel + custos)" withArrow>
                                    <Text component="span" size="sm">Alvo</Text>
                                  </Tooltip>
                                </Table.Th>
                                <Table.Th>Progresso</Table.Th>
                                <Table.Th>
                                  <Tooltip label="Quanto ainda falta para atingir o alvo" withArrow>
                                    <Text component="span" size="sm">Falta</Text>
                                  </Tooltip>
                                </Table.Th>
                                <Table.Th>
                                  <Tooltip label="FGTS utilizado neste mês" withArrow>
                                    <Text component="span" size="sm">FGTS</Text>
                                  </Tooltip>
                                </Table.Th>
                                {/* Patrimônio */}
                                <Table.Th style={{ borderLeft: '2px solid var(--mantine-color-ocean-3)' }}>
                                  <Tooltip label="Valor do imóvel (com valorização)" withArrow>
                                    <Text component="span" size="sm">Imóvel</Text>
                                  </Tooltip>
                                </Table.Th>
                                <Table.Th>
                                  <Tooltip label="Equidade no imóvel (só após compra)" withArrow>
                                    <Text component="span" size="sm">Equidade</Text>
                                  </Tooltip>
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
                            const surplus = monthlyNetIncome != null ? monthlyNetIncome - housingDue : null;
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
                                  <Tooltip 
                                    label={<InvestBuyOutflowExplanation m={m} />} 
                                    multiline 
                                    w={400} 
                                    withArrow 
                                    position="top-start"
                                  >
                                    <Text 
                                      component="span"
                                      style={{ cursor: 'help', textDecoration: 'underline dotted' }}
                                    >
                                      {moneySafe(monthlyOutflow(m))}
                                    </Text>
                                  </Tooltip>
                                </Table.Td>
                                <Table.Td>{moneySafe(wealthAt(m))}</Table.Td>
                                {tableView === 'essential' ? (
                                  <>
                                    {surplus != null && (
                                      <Table.Td>
                                        <Tooltip 
                                          label={
                                            <SurplusBreakdownTooltip
                                              netIncome={monthlyNetIncome}
                                              housingCost={housingDue}
                                              rent={m.rent_due}
                                              monthlyCosts={m.monthly_additional_costs}
                                              scenarioType="invest_buy"
                                            />
                                          }
                                          multiline
                                          w={320}
                                          withArrow
                                          position="left"
                                        >
                                          <Text 
                                            c={surplus >= 0 ? 'ocean.7' : 'danger.6'} 
                                            fw={500}
                                            style={{ cursor: 'help', textDecoration: 'underline dotted' }}
                                          >
                                            {signedMoney(surplus)}
                                          </Text>
                                        </Tooltip>
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
                                        <Tooltip 
                                          label={
                                            <SurplusBreakdownTooltip
                                              netIncome={monthlyNetIncome}
                                              housingCost={housingDue}
                                              rent={m.rent_due}
                                              monthlyCosts={m.monthly_additional_costs}
                                              scenarioType="invest_buy"
                                            />
                                          }
                                          multiline
                                          w={320}
                                          withArrow
                                          position="left"
                                        >
                                          <Text 
                                            c={surplus >= 0 ? 'ocean.7' : 'danger.6'} 
                                            fw={500}
                                            style={{ cursor: 'help', textDecoration: 'underline dotted' }}
                                          >
                                            {signedMoney(surplus)}
                                          </Text>
                                        </Tooltip>
                                      </Table.Td>
                                    )}
                                    <Table.Td>
                                      {m.extra_contribution_total > 0 ? moneySafe(m.extra_contribution_total) : '—'}
                                    </Table.Td>
                                    <Table.Td>
                                      {m.additional_investment > 0 ? moneySafe(m.additional_investment) : '—'}
                                    </Table.Td>
                                    <Table.Td>{moneySafe(m.external_surplus_invested)}</Table.Td>
                                    <Table.Td>{moneySafe(m.rent_withdrawal_from_investment)}</Table.Td>
                                    <Table.Td>{moneySafe(m.investment_return_net)}</Table.Td>
                                    <Table.Td>{moneySafe(m.investment_balance)}</Table.Td>
                                    <Table.Td>{moneySafe(m.target_purchase_cost)}</Table.Td>
                                    <Table.Td>{m.progress_percent != null ? `${m.progress_percent.toFixed(1)}%` : '—'}</Table.Td>
                                    <Table.Td>{moneySafe(m.shortfall)}</Table.Td>
                                    <Table.Td>{m.fgts_used > 0 ? moneySafe(m.fgts_used) : '—'}</Table.Td>
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
                        <Box style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--mantine-color-success-1)' }} />
                        <Text size="xs" c="dimmed">Mês de quitação</Text>
                      </Group>
                      {monthlyNetIncome != null && (
                        <Group gap={6}>
                          <Box style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--mantine-color-danger-1)' }} />
                          <Text size="xs" c="dimmed">Renda insuficiente</Text>
                        </Group>
                      )}
                    </>
                  )}
                  {isRentInvest && (
                    <>
                      <Group gap={6}>
                        <Box style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--mantine-color-warning-1)' }} />
                        <Text size="xs" c="dimmed">Mês de &quot;burn&quot; (saque {'>'} retorno)</Text>
                      </Group>
                      {monthlyNetIncome != null && (
                        <Group gap={6}>
                          <Box style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--mantine-color-danger-1)' }} />
                          <Text size="xs" c="dimmed">Renda insuficiente</Text>
                        </Group>
                      )}
                    </>
                  )}
                  {isInvestBuy && (
                    <>
                      <Group gap={6}>
                        <Box style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--mantine-color-success-1)' }} />
                        <Text size="xs" c="dimmed">Mês da compra</Text>
                      </Group>
                      <Group gap={6}>
                        <Box style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--mantine-color-ocean-1)' }} />
                        <Text size="xs" c="dimmed">Pós-compra</Text>
                      </Group>
                      {monthlyNetIncome != null && (
                        <Group gap={6}>
                          <Box style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--mantine-color-danger-1)' }} />
                          <Text size="xs" c="dimmed">Renda insuficiente (pré-compra)</Text>
                        </Group>
                      )}
                    </>
                  )}
                </Group>

                <Divider my="md" color="ocean.2" />
                <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="md">
                  <Box>
                    <Text size="xs" c="ocean.5">Break-even</Text>
                    <Text fw={600} c="ocean.8">
                      {s.metrics.break_even_month != null ? `Mês ${s.metrics.break_even_month}` : '—'}
                    </Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="ocean.5">ROI (bruto)</Text>
                    <Text fw={600} c="ocean.8">{percent(s.metrics.roi_percentage)}</Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="ocean.5">ROI (incl. saques)</Text>
                    <Text fw={600} c="ocean.8">
                      {s.metrics.roi_including_withdrawals_percentage != null ? percent(s.metrics.roi_including_withdrawals_percentage) : '—'}
                    </Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="ocean.5">Meses com burn</Text>
                    <Text fw={600} c="ocean.8">{s.metrics.months_with_burn ?? '—'}</Text>
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
