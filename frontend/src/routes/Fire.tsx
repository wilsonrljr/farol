import { useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Container,
  Group,
  NumberInput,
  Paper,
  Progress,
  RingProgress,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { LineChart } from '@mantine/charts';
import { IconFlame, IconInfoCircle, IconLeaf, IconRocket, IconTarget } from '@tabler/icons-react';
import { planFire } from '../api/toolsApi';
import type { FIREPlanInput, FIREPlanResult, FIREMode } from '../api/types';
import { money, moneyCompact, percent } from '../utils/format';
import { loadPresets, newPresetId, savePresets, type Preset } from '../utils/presets';

type FIREPreset = Preset<FIREPlanInput>;
const PRESETS_STORAGE_KEY = 'farol.tools.fire.presets.v1';

function formatYearsMonths(months: number): string {
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years === 0) return `${remainingMonths} meses`;
  if (remainingMonths === 0) return `${years} anos`;
  return `${years} anos e ${remainingMonths} meses`;
}

export default function Fire() {
  // Core inputs
  const [monthlyExpenses, setMonthlyExpenses] = useState<number>(5000);
  const [currentPortfolio, setCurrentPortfolio] = useState<number>(100000);
  const [monthlyContribution, setMonthlyContribution] = useState<number>(3000);
  const [horizonMonths, setHorizonMonths] = useState<number>(360);

  // Rates
  const [annualReturn, setAnnualReturn] = useState<number>(8);
  const [annualInflation, setAnnualInflation] = useState<number | undefined>(4);
  const [safeWithdrawalRate, setSafeWithdrawalRate] = useState<number>(4);

  // FIRE mode
  const [fireMode, setFireMode] = useState<FIREMode>('traditional');
  const [currentAge, setCurrentAge] = useState<number | undefined>(30);
  const [targetRetirementAge, setTargetRetirementAge] = useState<number | undefined>(65);
  const [coastFireAge, setCoastFireAge] = useState<number | undefined>(45);
  const [baristaIncome, setBaristaIncome] = useState<number | undefined>(2000);

  // State
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FIREPlanResult | null>(null);

  // Presets
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState<FIREPreset[]>(() => loadPresets(PRESETS_STORAGE_KEY));

  const chartData = useMemo(() => {
    if (!result) return [];
    return result.monthly_data.map((m) => ({
      month: m.month,
      portfolio: m.portfolio_balance,
      fireNumber: m.fire_number,
    }));
  }, [result]);

  const progressChartData = useMemo(() => {
    if (!result) return [];
    return result.monthly_data
      .filter((_, i) => i % 12 === 0 || i === result.monthly_data.length - 1)
      .map((m) => ({
        month: m.month,
        progress: Math.min(m.progress_percent, 100),
      }));
  }, [result]);

  function currentInput(): FIREPlanInput {
    return {
      monthly_expenses: monthlyExpenses,
      current_portfolio: currentPortfolio,
      monthly_contribution: monthlyContribution,
      horizon_months: horizonMonths,
      annual_return_rate: annualReturn,
      annual_inflation_rate: annualInflation ?? null,
      safe_withdrawal_rate: safeWithdrawalRate,
      fire_mode: fireMode,
      current_age: currentAge ?? null,
      target_retirement_age: targetRetirementAge ?? null,
      coast_fire_age: fireMode === 'coast' ? (coastFireAge ?? null) : null,
      barista_monthly_income: fireMode === 'barista' ? (baristaIncome ?? null) : null,
    };
  }

  async function onSimulate() {
    setLoading(true);
    try {
      const data = await planFire(currentInput());
      setResult(data);
    } catch (e: unknown) {
      notifications.show({ color: 'red', title: 'Erro ao calcular', message: String(e) });
    } finally {
      setLoading(false);
    }
  }

  function onSavePreset() {
    const name = presetName.trim();
    if (!name) {
      notifications.show({ color: 'yellow', title: 'Nome obrigatório', message: 'Informe um nome para o preset.' });
      return;
    }

    const next: FIREPreset[] = [
      { id: newPresetId(), name, createdAt: Date.now(), input: currentInput() },
      ...presets,
    ];
    setPresets(next);
    savePresets(PRESETS_STORAGE_KEY, next);
    setPresetName('');
    notifications.show({ color: 'green', title: 'Preset salvo', message: `"${name}"` });
  }

  function onLoadPreset(p: FIREPreset) {
    const i = p.input;
    setMonthlyExpenses(i.monthly_expenses);
    setCurrentPortfolio(i.current_portfolio);
    setMonthlyContribution(i.monthly_contribution ?? 0);
    setHorizonMonths(i.horizon_months ?? 360);
    setAnnualReturn(i.annual_return_rate ?? 8);
    setAnnualInflation(i.annual_inflation_rate == null ? undefined : i.annual_inflation_rate);
    setSafeWithdrawalRate(i.safe_withdrawal_rate ?? 4);
    setFireMode(i.fire_mode ?? 'traditional');
    setCurrentAge(i.current_age == null ? undefined : i.current_age);
    setTargetRetirementAge(i.target_retirement_age == null ? undefined : i.target_retirement_age);
    setCoastFireAge(i.coast_fire_age == null ? undefined : i.coast_fire_age);
    setBaristaIncome(i.barista_monthly_income == null ? undefined : i.barista_monthly_income);
    notifications.show({ color: 'blue', title: 'Preset carregado', message: p.name });
  }

  function onDeletePreset(id: string) {
    const next = presets.filter((p) => p.id !== id);
    setPresets(next);
    savePresets(PRESETS_STORAGE_KEY, next);
  }

  function onClearPresets() {
    setPresets([]);
    savePresets(PRESETS_STORAGE_KEY, []);
    notifications.show({ color: 'green', title: 'Presets removidos', message: 'Todos os presets foram apagados.' });
  }

  // Quick calculation for preview
  const previewFireNumber = (monthlyExpenses * 12) / (safeWithdrawalRate / 100);
  const previewProgress = previewFireNumber > 0 ? (currentPortfolio / previewFireNumber) * 100 : 0;

  return (
    <Container size="lg" py="xl">
      <Box mb="lg">
        <Group gap="sm" mb={6}>
          <IconFlame size={28} style={{ color: 'var(--mantine-color-orange-6)' }} />
          <Title order={2} fw={700}>
            Independência Financeira (FIRE)
          </Title>
        </Group>
        <Text c="dimmed">
          Calcule quando você pode atingir a independência financeira usando a regra dos 4% (ou taxa personalizada).
          O FIRE Number é o patrimônio necessário para viver apenas dos rendimentos.
        </Text>
      </Box>

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
        {/* FIRE Mode Selector */}
        <Box mb="lg">
          <Text fw={600} mb="xs">Modo FIRE</Text>
          <SegmentedControl
            value={fireMode}
            onChange={(v) => setFireMode(v as FIREMode)}
            data={[
              { label: 'Tradicional', value: 'traditional' },
              { label: 'Coast FIRE', value: 'coast' },
              { label: 'Barista FIRE', value: 'barista' },
            ]}
            fullWidth
          />
          <Text size="xs" c="dimmed" mt="xs">
            {fireMode === 'traditional' && 'Acumule patrimônio suficiente para viver 100% dos rendimentos.'}
            {fireMode === 'coast' && 'Pare de aportar em certa idade e deixe os juros compostos trabalharem até a aposentadoria.'}
            {fireMode === 'barista' && 'Trabalhe meio período cobrindo parte dos gastos, reduzindo o patrimônio necessário.'}
          </Text>
        </Box>

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
          <NumberInput
            label="Gastos mensais"
            description="Quanto você gasta por mês"
            value={monthlyExpenses}
            onChange={(v) => setMonthlyExpenses(Number(v) || 0)}
            min={0}
            thousandSeparator="."
            decimalSeparator=","
            prefix="R$ "
          />
          <NumberInput
            label="Patrimônio atual"
            description="Valor investido hoje"
            value={currentPortfolio}
            onChange={(v) => setCurrentPortfolio(Number(v) || 0)}
            min={0}
            thousandSeparator="."
            decimalSeparator=","
            prefix="R$ "
          />
          <NumberInput
            label="Aporte mensal"
            description="Quanto investe por mês"
            value={monthlyContribution}
            onChange={(v) => setMonthlyContribution(Number(v) || 0)}
            min={0}
            thousandSeparator="."
            decimalSeparator=","
            prefix="R$ "
          />

          <NumberInput
            label={
              <Group gap={4}>
                <span>Retorno real anual</span>
                <Tooltip label="Retorno já descontada a inflação. Ex: 12% nominal - 4% inflação = 8% real">
                  <IconInfoCircle size={14} style={{ opacity: 0.6 }} />
                </Tooltip>
              </Group>
            }
            description="Rendimento acima da inflação"
            value={annualReturn}
            onChange={(v) => setAnnualReturn(Number(v) || 0)}
            step={0.5}
            suffix="% a.a."
          />
          <NumberInput
            label="Inflação anual"
            description="Para ajustar gastos futuros"
            value={annualInflation}
            onChange={(v) => setAnnualInflation(v === '' || v == null ? undefined : Number(v))}
            step={0.5}
            suffix="% a.a."
          />
          <NumberInput
            label={
              <Group gap={4}>
                <span>Taxa de retirada segura</span>
                <Tooltip label="Regra dos 4%: retire 4% ao ano sem esgotar o patrimônio em 30+ anos">
                  <IconInfoCircle size={14} style={{ opacity: 0.6 }} />
                </Tooltip>
              </Group>
            }
            description="Tradicional: 4%"
            value={safeWithdrawalRate}
            onChange={(v) => setSafeWithdrawalRate(Number(v) || 4)}
            min={1}
            max={10}
            step={0.5}
            suffix="%"
          />

          <NumberInput
            label="Sua idade atual"
            description="Para calcular idade na IF"
            value={currentAge}
            onChange={(v) => setCurrentAge(v === '' || v == null ? undefined : Number(v))}
            min={18}
            max={100}
            suffix=" anos"
          />
          <NumberInput
            label="Horizonte (meses)"
            description="Período de simulação"
            value={horizonMonths}
            onChange={(v) => setHorizonMonths(Number(v) || 360)}
            min={12}
            max={600}
            step={12}
          />
          {fireMode === 'traditional' && (
            <NumberInput
              label="Idade-alvo aposentadoria"
              description="Referência (opcional)"
              value={targetRetirementAge}
              onChange={(v) => setTargetRetirementAge(v === '' || v == null ? undefined : Number(v))}
              min={18}
              max={100}
              suffix=" anos"
            />
          )}
          {fireMode === 'coast' && (
            <>
              <NumberInput
                label="Idade para Coast"
                description="Idade para parar de aportar"
                value={coastFireAge}
                onChange={(v) => setCoastFireAge(v === '' || v == null ? undefined : Number(v))}
                min={18}
                max={100}
                suffix=" anos"
              />
              <NumberInput
                label="Idade-alvo aposentadoria"
                description="Quando pretende se aposentar"
                value={targetRetirementAge}
                onChange={(v) => setTargetRetirementAge(v === '' || v == null ? undefined : Number(v))}
                min={18}
                max={100}
                suffix=" anos"
              />
            </>
          )}
          {fireMode === 'barista' && (
            <NumberInput
              label="Renda parcial (Barista)"
              description="Renda de trabalho parcial"
              value={baristaIncome}
              onChange={(v) => setBaristaIncome(v === '' || v == null ? undefined : Number(v))}
              min={0}
              thousandSeparator="."
              decimalSeparator=","
              prefix="R$ "
            />
          )}
        </SimpleGrid>

        {/* Preview Card */}
        <Box
          p="md"
          mt="lg"
          style={{
            background: 'light-dark(rgba(255, 255, 255, 0.5), rgba(15, 23, 42, 0.5))',
            borderRadius: 'var(--mantine-radius-lg)',
          }}
        >
          <Group justify="space-between" align="center">
            <Box>
              <Text size="sm" c="dimmed">FIRE Number (meta)</Text>
              <Text fw={700} size="xl">{money(previewFireNumber)}</Text>
              <Text size="xs" c="dimmed">= {monthlyExpenses * 12 > 0 ? (100 / safeWithdrawalRate).toFixed(0) : 25}× gastos anuais</Text>
            </Box>
            <RingProgress
              size={100}
              thickness={10}
              roundCaps
              sections={[{ value: Math.min(previewProgress, 100), color: previewProgress >= 100 ? 'green' : 'ocean' }]}
              label={
                <Text ta="center" fw={700} size="sm">
                  {percent(Math.min(previewProgress, 999))}
                </Text>
              }
            />
          </Group>
        </Box>

        <Group justify="flex-end" mt="lg">
          <Button color="ocean" radius="xl" loading={loading} onClick={onSimulate} leftSection={<IconRocket size={18} />}>
            Calcular
          </Button>
        </Group>

        {/* Presets */}
        <Box mt="lg">
          <Text fw={600} mb="xs">Presets</Text>
          <Group align="flex-end" wrap="wrap">
            <TextInput
              label="Nome do preset"
              placeholder="Ex.: Plano conservador 4%"
              value={presetName}
              onChange={(e) => setPresetName(e.currentTarget.value)}
              style={{ flex: 1, minWidth: 260 }}
            />
            <Button variant="light" color="ocean" radius="xl" onClick={onSavePreset}>
              Salvar preset
            </Button>
            <Button
              variant="subtle"
              color="red"
              radius="xl"
              disabled={presets.length === 0}
              onClick={onClearPresets}
            >
              Limpar todos
            </Button>
          </Group>

          {presets.length > 0 && (
            <Stack gap="xs" mt="sm">
              {presets.map((p) => (
                <Box
                  key={p.id}
                  p="sm"
                  style={{
                    background: 'light-dark(rgba(255, 255, 255, 0.5), rgba(15, 23, 42, 0.5))',
                    borderRadius: 'var(--mantine-radius-lg)',
                    boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.08)',
                  }}
                >
                  <Group justify="space-between" wrap="wrap">
                    <Box>
                      <Text fw={600}>{p.name}</Text>
                      <Text size="xs" c="dimmed">
                        Gastos: {money(p.input.monthly_expenses)} · Patrimônio: {money(p.input.current_portfolio)} · Aporte: {money(p.input.monthly_contribution ?? 0)}
                      </Text>
                    </Box>
                    <Group gap="xs">
                      <Button size="xs" radius="xl" variant="light" color="ocean" onClick={() => onLoadPreset(p)}>
                        Carregar
                      </Button>
                      <Button size="xs" radius="xl" variant="subtle" color="red" onClick={() => onDeletePreset(p.id)}>
                        Excluir
                      </Button>
                    </Group>
                  </Group>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </Box>

      {/* Results */}
      {result && (
        <Box mt="xl">
          {/* Summary Cards */}
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg" mb="lg">
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
              <Group gap="xs" mb="xs">
                <IconTarget size={20} style={{ color: 'var(--mantine-color-ocean-6)' }} />
                <Text size="sm" c="dimmed">Status</Text>
              </Group>
              {result.fi_achieved ? (
                <Badge color="green" size="lg" variant="light">
                  IF Atingida! 🎉
                </Badge>
              ) : (
                <Badge color="orange" size="lg" variant="light">
                  Em progresso
                </Badge>
              )}
            </Box>

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
              <Text size="sm" c="dimmed">Tempo até IF</Text>
              <Text fw={700} size="xl">
                {result.months_to_fi != null ? formatYearsMonths(result.months_to_fi) : '—'}
              </Text>
              {result.fi_age != null && (
                <Text size="xs" c="dimmed">aos {result.fi_age} anos</Text>
              )}
            </Box>

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
              <Text size="sm" c="dimmed">FIRE Number</Text>
              <Text fw={700} size="xl">{money(result.fire_number)}</Text>
            </Box>

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
              <Text size="sm" c="dimmed">Renda passiva (se aposentar hoje)</Text>
              <Text fw={700} size="xl">{money(result.monthly_data[0]?.monthly_passive_income ?? 0)}/mês</Text>
            </Box>
          </SimpleGrid>

          {/* Additional metrics */}
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg" mb="lg">
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
              <Text size="sm" c="dimmed">Patrimônio final</Text>
              <Text fw={700} size="xl">{money(result.final_portfolio)}</Text>
              <Progress
                value={Math.min((result.final_portfolio / result.fire_number) * 100, 100)}
                color="ocean"
                size="sm"
                mt="xs"
              />
            </Box>

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
              <Text size="sm" c="dimmed">Total de aportes</Text>
              <Text fw={700} size="xl">{money(result.total_contributions)}</Text>
              <Text size="xs" c="dimmed">
                {((result.total_contributions / result.final_portfolio) * 100).toFixed(1)}% do patrimônio final
              </Text>
            </Box>

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
              <Text size="sm" c="dimmed">Total de rendimentos</Text>
              <Text fw={700} size="xl">{money(result.total_investment_returns)}</Text>
              <Text size="xs" c="dimmed">
                {((result.total_investment_returns / result.final_portfolio) * 100).toFixed(1)}% do patrimônio final
              </Text>
            </Box>
          </SimpleGrid>

          {/* Coast FIRE specific */}
          {result.coast_fire_number != null && (
            <Box
              p="lg"
              mb="lg"
              style={{
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                boxShadow: 'var(--glass-shadow), var(--glass-shadow-glow)',
                borderRadius: 'var(--mantine-radius-xl)',
              }}
            >
              <Group gap="xs" mb="xs">
                <IconLeaf size={20} style={{ color: 'var(--mantine-color-teal-6)' }} />
                <Text fw={600}>Coast FIRE</Text>
              </Group>
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                <Box>
                  <Text size="sm" c="dimmed">Coast FIRE Number</Text>
                  <Text fw={700} size="lg">{money(result.coast_fire_number)}</Text>
                  <Text size="xs" c="dimmed">Patrimônio para parar de aportar e ainda atingir IF na idade-alvo</Text>
                </Box>
                <Box>
                  <Text size="sm" c="dimmed">Status Coast FIRE</Text>
                  {result.coast_fire_achieved ? (
                    <Badge color="teal" size="lg" variant="light">Já pode "coastear"! 🏖️</Badge>
                  ) : (
                    <Badge color="gray" size="lg" variant="light">Ainda não atingido</Badge>
                  )}
                </Box>
              </SimpleGrid>
            </Box>
          )}

          {/* Chart */}
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
            <Text fw={600} size="lg" mb="sm">Evolução do patrimônio vs FIRE Number</Text>
            <LineChart
              h={350}
              data={chartData}
              dataKey="month"
              series={[
                { name: 'portfolio', color: 'ocean.6', label: 'Patrimônio' },
                { name: 'fireNumber', color: 'amber.5', label: 'FIRE Number' },
              ]}
              curveType="monotone"
              gridAxis="xy"
              withLegend
              valueFormatter={(value) => money(value)}
              xAxisProps={{
                tickMargin: 10,
                tickFormatter: (v) => `${Math.floor(Number(v) / 12)}a`,
              }}
              yAxisProps={{ tickMargin: 10, tickFormatter: (v) => moneyCompact(v as number) }}
              tooltipAnimationDuration={150}
              referenceLines={
                result.fi_month
                  ? [{ x: result.fi_month, label: 'IF', color: 'emerald.6' }]
                  : undefined
              }
            />
            <Group justify="space-between" mt="md" gap="xs">
              <Text size="sm" c="dimmed">
                Renda passiva final:{' '}
                <Text component="span" fw={600} c="bright">
                  {money(result.final_monthly_passive_income)}/mês
                </Text>
              </Text>
              {result.fi_month && (
                <Text size="sm" c="dimmed">
                  IF no mês {result.fi_month} ({formatYearsMonths(result.fi_month - 1)})
                </Text>
              )}
            </Group>
          </Box>
        </Box>
      )}
    </Container>
  );
}
