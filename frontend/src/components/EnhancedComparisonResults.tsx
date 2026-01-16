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

const recurringHousingCost = (m: any) => {
  // Prefer explicit housing_due when provided (rent + HOA/IPTU).
  if (m?.housing_due != null) return m.housing_due;

  // For buy scenario (and some post-purchase months), approximate housing as installment + recurring costs.
  const installment = m?.installment ?? 0;
  const additional = m?.monthly_additional_costs ?? 0;
  if (m?.installment != null) return installment + additional;

  // Post-purchase invest-buy months may have only HOA/IPTU.
  if (m?.monthly_additional_costs != null) return additional;

  return 0;
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
  const colorMap = ['sage', 'info', 'forest'] as const;
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
  const housingCostMonth1 = firstMonth ? recurringHousingCost(firstMonth) : 0;
  const incomeSurplusMonth1 =
    typeof monthlyNetIncome === 'number' ? monthlyNetIncome - housingCostMonth1 : null;

  const Help = ({ label, help }: { label: string; help: ReactNode }) => (
    <Tooltip label={help} multiline w={320} withArrow position="top-start">
      <ActionIcon variant="subtle" color="gray" size="xs" aria-label={`Ajuda: ${label}`}>
        <IconHelpCircle size={14} />
      </ActionIcon>
    </Tooltip>
  );

  return (
    <Paper
      p="xl"
      radius="lg"
      className={isBest ? 'card-hover' : ''}
      style={{
        backgroundColor: isBest
          ? 'light-dark(var(--mantine-color-sage-0), var(--mantine-color-dark-8))'
          : 'var(--mantine-color-body)',
        border: isBest
          ? '2px solid light-dark(var(--mantine-color-sage-3), var(--mantine-color-sage-6))'
          : '1px solid var(--mantine-color-default-border)',
        position: 'relative',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      {/* Winner badge */}
      {isBest && (
        <Badge
          color="sage"
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
          backgroundColor: 'light-dark(var(--mantine-color-sage-0), var(--mantine-color-dark-7))',
          borderRadius: rem(10),
        }}
      >
        <Group gap={6} align="center" wrap="nowrap">
          <Text size="xs" c="sage.6" tt="uppercase" fw={500} style={{ letterSpacing: '0.5px' }}>
            Patrimônio Final
          </Text>
          <Help
            label="Patrimônio Final"
            help="Total de ativos acumulados no fim do horizonte da simulação (equidade + investimentos + FGTS). Observação importante: se o aluguel estiver modelado como pago externamente (rent_reduces_investment=false), mudanças em aluguel/inflação afetam o Custo Líquido e o fluxo de caixa, mas podem não alterar o Patrimônio Final. Para ver o impacto do aluguel no patrimônio, ative 'Aluguel reduz investimento' ou informe 'sobra externa' / aportes mensais."
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
              <IconArrowUpRight size={14} color="var(--mantine-color-sage-7)" />
            )}
            <Text size="xs" c={wealthDelta < 0 ? 'danger.6' : 'sage.7'} fw={500}>
              {wealthDelta > 0 ? '+' : ''}{money(wealthDelta)} vs melhor
            </Text>
          </Group>
        )}
      </Box>

      {/* Metrics Grid */}
      <SimpleGrid cols={2} spacing="md">
        <Box>
          <Group gap={6} align="center" wrap="nowrap" mb={2}>
            <Text size="xs" c="sage.5">
              Custo Líquido
            </Text>
            <Help
              label="Custo Líquido"
              help="Custo líquido estimado no horizonte: total de saídas/alocações (total_outflows) menos o patrimônio final (final_equity). Observação: o 'melhor cenário' é escolhido por variação de patrimônio (net_worth_change), não por menor custo líquido."
            />
          </Group>
          <Group gap={4} align="center">
            <Text fw={600} size="md" c="sage.8">
              {money(s.total_cost)}
            </Text>
            {!isBest && costDelta !== 0 && (
              <Text size="xs" c={costDelta > 0 ? 'danger.6' : 'sage.7'}>
                ({costDelta > 0 ? '+' : ''}{money(costDelta)})
              </Text>
            )}
          </Group>
        </Box>
        <Box>
          <Group gap={6} align="center" wrap="nowrap" mb={2}>
            <Text size="xs" c="sage.5">
              Equidade
            </Text>
            <Help
              label="Equidade"
              help="Equidade do imóvel (valor do imóvel menos saldo devedor). Não inclui investimentos nem FGTS. Em cenários sem compra, fica 0."
            />
          </Group>
          <Text fw={600} size="md" c="sage.8">
            {money(propertyEquity)}
          </Text>
        </Box>
        <Box>
          <Group gap={6} align="center" wrap="nowrap" mb={2}>
            <Text size="xs" c="sage.5">
              ROI
            </Text>
            <Help
              label="ROI"
              help="Retorno percentual estimado. Em geral, compara o que você terminou com o que saiu do seu bolso (varia por cenário e regras)."
            />
          </Group>
          <Text fw={600} size="md" c="sage.8">
            {percent(s.metrics.roi_percentage)}
          </Text>
        </Box>
        <Box>
          <Group gap={6} align="center" wrap="nowrap" mb={2}>
            <Text size="xs" c="sage.5">
              Saída mensal média
            </Text>
            <Help
              label="Saída mensal média"
              help="Média da saída total mensal ao longo do horizonte (inclui entrada/alocação inicial e aportes quando aplicável). Útil para comparar esforço de caixa entre estratégias."
            />
          </Group>
          <Text size="xs" c="sage.5" mb={2}>
            (inclui entrada/aportes)
          </Text>
          <Text fw={600} size="md" c="sage.8">
            {money(s.metrics.average_monthly_cost)}
          </Text>
        </Box>
        {incomeSurplusMonth1 != null && (
          <Box>
            <Group gap={6} align="center" wrap="nowrap" mb={2}>
              <Text size="xs" c="sage.5">
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
              c={incomeSurplusMonth1 >= 0 ? 'sage.8' : 'danger.6'}
            >
              {signedMoney(incomeSurplusMonth1)}
            </Text>
          </Box>
        )}
      </SimpleGrid>

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
              <Text size="sm" c="sage.7">Entrada em dinheiro</Text>
              <Text size="sm" fw={700}>{money(s.purchase_breakdown.cash_down_payment)}</Text>
            </Group>
            <Group gap={6} align="center">
              <Text size="sm" c="sage.7">FGTS na entrada</Text>
              <Text size="sm" fw={700}>{money(s.purchase_breakdown.fgts_at_purchase)}</Text>
            </Group>
            <Group gap={6} align="center">
              <Text size="sm" c="sage.7">Financiado</Text>
              <Text size="sm" fw={700}>{money(s.purchase_breakdown.financed_amount)}</Text>
            </Group>
            <Group gap={6} align="center">
              <Text size="sm" c="sage.7">Custos (ITBI+escritura)</Text>
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
            backgroundColor: 'light-dark(var(--mantine-color-sage-0), var(--mantine-color-dark-7))',
            borderRadius: rem(10),
          }}
        >
          <Group gap={8} mb={8}>
            <ThemeIcon size={28} radius="xl" color="sage" variant="filled">
              <IconPigMoney size={16} />
            </ThemeIcon>
            <Box>
              <Text size="sm" fw={700}>FGTS</Text>
              <Text size="xs" c="dimmed">Saldo final {money(s.fgts_summary.final_balance)} | Saques {money(s.fgts_summary.total_withdrawn)}</Text>
            </Box>
          </Group>
          <SimpleGrid cols={2} spacing="xs">
            <Group gap={6} align="center">
              <Text size="sm" c="sage.7">Usado na entrada</Text>
              <Text size="sm" fw={700}>{money(s.fgts_summary.withdrawn_at_purchase)}</Text>
            </Group>
            <Group gap={6} align="center">
              <Text size="sm" c="sage.7">Amortizações FGTS</Text>
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
      <Divider my="md" color="sage.2" />
      <Group gap="xs" wrap="wrap">
        <Badge variant="light" color="sage" size="sm">
          {s.monthly_data.length} meses
        </Badge>
        <Badge variant="light" color="sage" size="sm">
          Juros/Aluguel: {money(s.metrics.total_interest_or_rent_paid)}
        </Badge>
        {s.opportunity_cost != null && s.opportunity_cost > 0 && (
          <Badge variant="light" color="info" size="sm">
            Ganho investimento: {money(s.opportunity_cost)}
          </Badge>
        )}
      </Group>
    </Paper>
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
            <ThemeIcon size={40} radius="md" variant="filled" color="sage">
              <IconChartLine size={20} />
            </ThemeIcon>
            <Title order={2} fw={600} c="sage.9">
              Resultados da Análise
            </Title>
          </Group>
          <Text size="md" c="sage.6">
            Melhor cenário (critério: maior variação de patrimônio):{' '}
            <Text component="span" fw={600} c="sage.8">{result.best_scenario}</Text>
          </Text>
          <Text size="xs" c="sage.6" mt={4}>
            “Melhor” aqui significa maior variação de patrimônio (não menor desembolso/custo líquido).
          </Text>
        </Box>
        <Menu withinPortal position="bottom-end">
          <Menu.Target>
            <Button
              variant="light"
              color="sage"
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

      {/* Input payload summary (what was actually simulated) */}
      <Paper
        p="lg"
        radius="xl"
        style={{
          border: '1px solid var(--mantine-color-default-border)',
          backgroundColor: 'light-dark(var(--mantine-color-sage-0), var(--mantine-color-dark-8))',
        }}
      >
        <Group justify="space-between" align="center" wrap="wrap" gap="sm" mb="xs">
          <Group gap="xs">
            <ThemeIcon size={34} radius="lg" variant="light" color="sage">
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
              color="sage"
              radius="lg"
              size="xs"
              onClick={() => setShowInputDetails((v) => !v)}
            >
              {showInputDetails ? 'Ocultar detalhes' : 'Ver detalhes'}
            </Button>
            <Button
              variant="subtle"
              color="sage"
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
              <Badge variant="light" color="sage">
                Imóvel: {money(inputPayload.property_value)}
              </Badge>
              <Badge variant="light" color="sage">
                Entrada: {money(inputPayload.down_payment)}
              </Badge>
              <Badge variant="light" color="sage">
                Prazo: {inputPayload.loan_term_years} anos
              </Badge>
              <Badge variant="light" color="sage">
                Sistema: {inputPayload.loan_type}
              </Badge>
              {inputSummary?.interestLabel !== '—' && (
                <Badge variant="light" color="sage">Juros: {inputSummary?.interestLabel}</Badge>
              )}
              {inputPayload.rent_inflation_rate != null && (
                <Badge variant="light" color="sage">Inflação aluguel: {percentSafe(inputPayload.rent_inflation_rate, 2)} a.a.</Badge>
              )}
              {inputPayload.inflation_rate != null && (
                <Badge variant="light" color="sage">Inflação geral: {percentSafe(inputPayload.inflation_rate, 2)} a.a.</Badge>
              )}
              {inputPayload.property_appreciation_rate != null && (
                <Badge variant="light" color="sage">Valorização imóvel: {percentSafe(inputPayload.property_appreciation_rate, 2)} a.a.</Badge>
              )}
              <Badge variant="light" color="sage">
                Amortizações: {inputSummary?.amortizationsCount ?? 0}
              </Badge>
              <Badge variant="light" color="sage">
                Aportes: {inputSummary?.contributionsCount ?? 0}
              </Badge>
              {inputSummary?.netIncomeLabel !== '—' && (
                <Badge variant="light" color="sage">
                  Renda líquida: {inputSummary?.netIncomeLabel}
                </Badge>
              )}
            </Group>

            <Collapse in={showInputDetails}>
              <Divider my="sm" color="sage.2" />
              <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="sm">
                <Box>
                  <Text size="xs" c="sage.6">Aluguel</Text>
                  <Text fw={600} c="bright">{inputSummary?.rentLabel ?? '—'}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="sage.6">Renda líquida mensal</Text>
                  <Text fw={600} c="bright">{inputSummary?.netIncomeLabel ?? '—'}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="sage.6">Retornos investimento</Text>
                  <Text fw={600} c="bright">{inputSummary?.invReturnsLabel ?? '—'}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="sage.6">Aluguel consome investimento</Text>
                  <Text fw={600} c="bright">{inputPayload.rent_reduces_investment ? 'Sim' : 'Não'}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="sage.6">Investir sobra externa</Text>
                  <Text fw={600} c="bright">{inputPayload.invest_external_surplus ? 'Sim' : 'Não'}</Text>
                </Box>
              </SimpleGrid>

              <Collapse in={showInputJson}>
                <Divider my="sm" color="sage.2" />
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
      </Paper>

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
      <Paper
        p="xl"
        radius="xl"
        style={{
          border: '1px solid var(--mantine-color-default-border)',
          backgroundColor: 'var(--mantine-color-body)',
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
            <Badge variant="light" color="sage" size="lg">
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
                    <Table.Td c={r.buy_vs_rent_difference > 0 ? 'danger.6' : r.buy_vs_rent_difference < 0 ? 'success.7' : 'sage.6'}>
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
                              : 'sage.6'
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
          <Text size="sm" c="sage.6">
            Resumo comparativo indisponível.
          </Text>
        )}

        <Text size="xs" c="sage.6" mt="sm">
          Interpretação: valores positivos em “Comprar − Alugar” significam que comprar foi mais caro no mês (pior para comprar no curto prazo).
        </Text>
      </Paper>

      {/* Charts and Tables */}
      <Tabs value={activeTab} onChange={(v) => setActiveTab(v || 'overview')} variant="pills" radius="lg">
        <Paper
          p="md"
          radius="xl"
          mb="md"
          style={{
            backgroundColor: 'light-dark(var(--mantine-color-sage-0), var(--mantine-color-dark-8))',
            border: '1px solid var(--mantine-color-default-border)',
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
        </Paper>

        <Tabs.Panel value="overview">
          <Paper
            p="xl"
            radius="xl"
            style={{
              border: '1px solid var(--mantine-color-default-border)',
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
                  color: ['sage.9', 'info.6', 'forest.6'][i % 3],
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
                  color: ['sage.9', 'info.6', 'forest.6'][i % 3],
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
          </Paper>
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
              <Paper
                p="xl"
                radius="xl"
                style={{
                  border: '1px solid var(--mantine-color-default-border)',
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
                      <Badge color={purchaseMonth ? 'success' : 'sage'} variant="light" size="lg">
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
                    <Text size="xs" c="sage.6">
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
                            <Badge variant="light" color="sage">
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
                              <Table.Th>Saldo devedor</Table.Th>
                              <Table.Th>Custos (cond+IPTU)</Table.Th>
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
                              const installment = typeof m.installment === 'number' ? m.installment : 0;
                              const interest = typeof m.interest_payment === 'number' ? m.interest_payment : 0;
                              const principal = typeof m.principal_payment === 'number' ? m.principal_payment : 0;
                              const extraCash = typeof m.extra_amortization_cash === 'number'
                                ? m.extra_amortization_cash
                                : (typeof m.extra_amortization === 'number' ? m.extra_amortization : 0);
                              const extraFgts = typeof m.extra_amortization_fgts === 'number' ? m.extra_amortization_fgts : 0;
                              const monthlyCosts = typeof m.monthly_additional_costs === 'number' ? m.monthly_additional_costs : 0;
                              const upfront = typeof m.upfront_additional_costs === 'number' ? m.upfront_additional_costs : 0;

                              return (
                                <Table.Tr
                                  key={m.month}
                                  style={{
                                    backgroundColor: isPayoffRow
                                      ? 'light-dark(var(--mantine-color-success-0), var(--mantine-color-dark-7))'
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
                                  <Table.Td>{moneySafe(m.outstanding_balance)}</Table.Td>
                                  <Table.Td>{moneySafe(monthlyCosts)}</Table.Td>
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
                                <Table.Th>Retorno (líq.)</Table.Th>
                                <Table.Th>Saldo invest.</Table.Th>
                                <Table.Th>Patrimônio</Table.Th>
                              </>
                            ) : (
                              <>
                                <Table.Th>Aluguel devido</Table.Th>
                                <Table.Th>Custos (cond+IPTU)</Table.Th>
                                <Table.Th>Moradia (devido)</Table.Th>
                                <Table.Th>Moradia (pago)</Table.Th>
                                <Table.Th>Shortfall</Table.Th>
                                <Table.Th>Saque invest.</Table.Th>
                                <Table.Th>Cobertura externa</Table.Th>
                                <Table.Th>Sobra ext. investida</Table.Th>
                                <Table.Th>Retorno (líq.)</Table.Th>
                                <Table.Th>Saldo invest.</Table.Th>
                                <Table.Th>Patrimônio</Table.Th>
                                <Table.Th>Valor imóvel</Table.Th>
                              </>
                            )}
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {rows.slice(0, 600).map((m: any) => {
                            const isBurn = Boolean(m.burn_month);
                            const rowStyle = isBurn
                              ? {
                                  backgroundColor:
                                    'light-dark(var(--mantine-color-warning-0), var(--mantine-color-dark-7))',
                                }
                              : undefined;

                            const housingDue =
                              m?.housing_due != null
                                ? m.housing_due
                                : (m?.rent_due ?? 0) + (m?.monthly_additional_costs ?? 0);

                            return (
                              <Table.Tr key={m.month} style={rowStyle}>
                                <Table.Td>{m.month}</Table.Td>
                                <Table.Td>{yearFromMonth(m.month)}</Table.Td>
                                {tableView === 'essential' ? (
                                  <>
                                    <Table.Td>{moneySafe(housingDue)}</Table.Td>
                                    <Table.Td>{moneySafe(m.investment_return_net)}</Table.Td>
                                    <Table.Td>{moneySafe(m.investment_balance)}</Table.Td>
                                    <Table.Td>{moneySafe(wealthAt(m))}</Table.Td>
                                  </>
                                ) : (
                                  <>
                                    <Table.Td>{moneySafe(m.rent_due)}</Table.Td>
                                    <Table.Td>{moneySafe(m.monthly_additional_costs)}</Table.Td>
                                    <Table.Td>{moneySafe(housingDue)}</Table.Td>
                                    <Table.Td>{moneySafe(m.housing_paid)}</Table.Td>
                                    <Table.Td>{moneySafe(m.housing_shortfall)}</Table.Td>
                                    <Table.Td>{moneySafe(m.rent_withdrawal_from_investment)}</Table.Td>
                                    <Table.Td>{moneySafe(m.external_cover)}</Table.Td>
                                    <Table.Td>{moneySafe(m.external_surplus_invested)}</Table.Td>
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
                                <Table.Th>Progresso</Table.Th>
                                <Table.Th>Falta (R$)</Table.Th>
                                <Table.Th>Saldo invest.</Table.Th>
                              </>
                            ) : (
                              <>
                                <Table.Th>Aluguel devido</Table.Th>
                                <Table.Th>Custos (cond+IPTU)</Table.Th>
                                <Table.Th>Aportes progr.</Table.Th>
                                <Table.Th>Aporte adicional</Table.Th>
                                <Table.Th>Sobra ext. investida</Table.Th>
                                <Table.Th>Saque invest.</Table.Th>
                                <Table.Th>Retorno (líq.)</Table.Th>
                                <Table.Th>Saldo invest.</Table.Th>
                                <Table.Th>Alvo compra</Table.Th>
                                <Table.Th>Progresso</Table.Th>
                                <Table.Th>Falta (R$)</Table.Th>
                                <Table.Th>FGTS usado</Table.Th>
                                <Table.Th>Valor imóvel</Table.Th>
                                <Table.Th>Equidade</Table.Th>
                              </>
                            )}
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {rows.slice(0, 600).map((m: any) => {
                            const isPurchase =
                              purchaseMonth != null ? m.month === purchaseMonth : m.status === 'Imóvel comprado';
                            const isPostPurchase = purchaseMonth != null ? m.month > purchaseMonth : m.phase === 'post_purchase';

                            return (
                              <Table.Tr
                                key={m.month}
                                style={{
                                  backgroundColor: isPurchase
                                    ? 'light-dark(var(--mantine-color-success-0), var(--mantine-color-dark-7))'
                                    : isPostPurchase
                                      ? 'light-dark(var(--mantine-color-sage-0), var(--mantine-color-dark-8))'
                                      : undefined,
                                  fontWeight: m.is_milestone ? 600 : 400,
                                }}
                              >
                                <Table.Td>{m.month}</Table.Td>
                                <Table.Td>{yearFromMonth(m.month)}</Table.Td>
                                <Table.Td>
                                  <Badge size="sm" variant="light" color={isPurchase ? 'success' : 'sage'}>
                                    {m.status || '—'}
                                  </Badge>
                                </Table.Td>
                                <Table.Td>
                                  <Tooltip label={outflowTooltip(m)} multiline w={360} withArrow position="top-start">
                                    <Text component="span">{moneySafe(monthlyOutflow(m))}</Text>
                                  </Tooltip>
                                </Table.Td>
                                <Table.Td>{moneySafe(wealthAt(m))}</Table.Td>
                                {tableView === 'essential' ? (
                                  <>
                                    <Table.Td>{m.progress_percent != null ? `${m.progress_percent.toFixed(1)}%` : '—'}</Table.Td>
                                    <Table.Td>{moneySafe(m.shortfall)}</Table.Td>
                                    <Table.Td>{moneySafe(m.investment_balance)}</Table.Td>
                                  </>
                                ) : (
                                  <>
                                    <Table.Td>{moneySafe(m.rent_due)}</Table.Td>
                                    <Table.Td>{moneySafe(m.monthly_additional_costs)}</Table.Td>
                                    <Table.Td>{moneySafe(m.extra_contribution_total)}</Table.Td>
                                    <Table.Td>{moneySafe(m.additional_investment)}</Table.Td>
                                    <Table.Td>{moneySafe(m.external_surplus_invested)}</Table.Td>
                                    <Table.Td>{moneySafe(m.rent_withdrawal_from_investment)}</Table.Td>
                                    <Table.Td>{moneySafe(m.investment_return_net)}</Table.Td>
                                    <Table.Td>{moneySafe(m.investment_balance)}</Table.Td>
                                    <Table.Td>{moneySafe(m.target_purchase_cost)}</Table.Td>
                                    <Table.Td>{m.progress_percent != null ? `${m.progress_percent.toFixed(1)}%` : '—'}</Table.Td>
                                    <Table.Td>{moneySafe(m.shortfall)}</Table.Td>
                                    <Table.Td>{moneySafe(m.fgts_used)}</Table.Td>
                                    <Table.Td>{moneySafe(m.property_value)}</Table.Td>
                                    <Table.Td>{moneySafe(m.equity)}</Table.Td>
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

                <Divider my="md" color="sage.2" />
                <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="md">
                  <Box>
                    <Text size="xs" c="sage.5">Break-even</Text>
                    <Text fw={600} c="sage.8">
                      {s.metrics.break_even_month != null ? `Mês ${s.metrics.break_even_month}` : '—'}
                    </Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="sage.5">ROI (bruto)</Text>
                    <Text fw={600} c="sage.8">{percent(s.metrics.roi_percentage)}</Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="sage.5">ROI (incl. saques)</Text>
                    <Text fw={600} c="sage.8">
                      {s.metrics.roi_including_withdrawals_percentage != null ? percent(s.metrics.roi_including_withdrawals_percentage) : '—'}
                    </Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="sage.5">Meses com burn</Text>
                    <Text fw={600} c="sage.8">{s.metrics.months_with_burn ?? '—'}</Text>
                  </Box>
                </SimpleGrid>

                {(s.metrics.total_rent_withdrawn_from_investment != null || s.metrics.average_sustainable_withdrawal_ratio != null) && (
                  <Group gap="xs" mt="md" wrap="wrap">
                    {s.metrics.total_rent_withdrawn_from_investment != null && (
                      <Badge variant="light" color="sage">
                        Aluguel sacado do investimento: {money(s.metrics.total_rent_withdrawn_from_investment)}
                      </Badge>
                    )}
                    {s.metrics.average_sustainable_withdrawal_ratio != null && (
                      <Badge variant="light" color="sage">
                        Retirada sustentável média: {ratio(s.metrics.average_sustainable_withdrawal_ratio, 2)} ({ratioAsPercent(s.metrics.average_sustainable_withdrawal_ratio, 0)})
                      </Badge>
                    )}
                  </Group>
                )}
              </Paper>
            </Tabs.Panel>
          );
        })}
      </Tabs>
    </Stack>
  );
}
