import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Container,
  Group,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { LineChart } from '@mantine/charts';
import { runStressTest } from '../api/toolsApi';
import type { StressTestInput } from '../api/types';
import type { StressTestResult } from '../api/types';
import { money, moneyCompact, percent, formatMonthsYears } from '../utils/format';

type StressTestPreset = {
  id: string;
  name: string;
  createdAt: number;
  input: StressTestInput;
};

const PRESETS_STORAGE_KEY = 'farol.tools.stressTest.presets.v1';

function safeLoadPresets(): StressTestPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as StressTestPreset[];
  } catch {
    return [];
  }
}

function safeSavePresets(presets: StressTestPreset[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
}

function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function StressTest() {
  const [monthlyIncome, setMonthlyIncome] = useState<number>(8000);
  const [monthlyExpenses, setMonthlyExpenses] = useState<number>(5500);
  const [initialEmergencyFund, setInitialEmergencyFund] = useState<number>(30000);

  const [horizonMonths, setHorizonMonths] = useState<number>(60);
  const [incomeDrop, setIncomeDrop] = useState<number>(40);
  const [shockDuration, setShockDuration] = useState<number>(6);
  const [shockStartMonth, setShockStartMonth] = useState<number>(1);

  const [annualInflation, setAnnualInflation] = useState<number | undefined>(4);
  const [annualFundYield, setAnnualFundYield] = useState<number | undefined>(10);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StressTestResult | null>(null);

  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState<StressTestPreset[]>(() => safeLoadPresets());

  const chartData = useMemo(() => {
    if (!result) return [];
    return result.monthly_data.map((m) => ({
      month: m.month,
      balance: m.emergency_fund_balance,
      uncovered: m.uncovered_deficit,
    }));
  }, [result]);

  async function onSimulate() {
    setLoading(true);
    try {
      const data = await runStressTest({
        monthly_income: monthlyIncome,
        monthly_expenses: monthlyExpenses,
        initial_emergency_fund: initialEmergencyFund,
        horizon_months: horizonMonths,
        income_drop_percentage: incomeDrop,
        shock_duration_months: shockDuration,
        shock_start_month: shockStartMonth,
        annual_inflation_rate: annualInflation ?? null,
        annual_emergency_fund_yield_rate: annualFundYield ?? null,
      });
      setResult(data);
    } catch (e: any) {
      notifications.show({
        color: 'red',
        title: 'Erro ao simular',
        message: String(e),
      });
    } finally {
      setLoading(false);
    }
  }

  function currentInput(): StressTestInput {
    return {
      monthly_income: monthlyIncome,
      monthly_expenses: monthlyExpenses,
      initial_emergency_fund: initialEmergencyFund,
      horizon_months: horizonMonths,
      income_drop_percentage: incomeDrop,
      shock_duration_months: shockDuration,
      shock_start_month: shockStartMonth,
      annual_inflation_rate: annualInflation ?? null,
      annual_emergency_fund_yield_rate: annualFundYield ?? null,
    };
  }

  function onSavePreset() {
    const name = presetName.trim();
    if (!name) {
      notifications.show({ color: 'yellow', title: 'Nome obrigatório', message: 'Informe um nome para o preset.' });
      return;
    }

    const next: StressTestPreset[] = [
      {
        id: newId(),
        name,
        createdAt: Date.now(),
        input: currentInput(),
      },
      ...presets,
    ];
    setPresets(next);
    safeSavePresets(next);
    setPresetName('');
    notifications.show({ color: 'green', title: 'Preset salvo', message: `“${name}”` });
  }

  function onLoadPreset(p: StressTestPreset) {
    const i = p.input;
    setMonthlyIncome(i.monthly_income);
    setMonthlyExpenses(i.monthly_expenses);
    setInitialEmergencyFund(i.initial_emergency_fund);

    setHorizonMonths(i.horizon_months ?? 60);
    setIncomeDrop(i.income_drop_percentage ?? 30);
    setShockDuration(i.shock_duration_months ?? 6);
    setShockStartMonth(i.shock_start_month ?? 1);

    setAnnualInflation(i.annual_inflation_rate == null ? undefined : i.annual_inflation_rate);
    setAnnualFundYield(i.annual_emergency_fund_yield_rate == null ? undefined : i.annual_emergency_fund_yield_rate);
    notifications.show({ color: 'blue', title: 'Preset carregado', message: p.name });
  }

  function onDeletePreset(id: string) {
    const next = presets.filter((p) => p.id !== id);
    setPresets(next);
    safeSavePresets(next);
  }

  function onClearPresets() {
    const next: StressTestPreset[] = [];
    setPresets(next);
    safeSavePresets(next);
    notifications.show({ color: 'green', title: 'Presets removidos', message: 'Todos os presets foram apagados.' });
  }

  return (
    <Container size="lg" py="xl">
      <Box mb="lg">
        <Title order={2} fw={700} mb={6}>
          Teste de estresse
        </Title>
        <Text c="dimmed">
          Simule um choque de renda e veja por quanto tempo sua reserva cobre o déficit.
        </Text>
      </Box>

      <Paper
        p="xl"
        radius="xl"
        style={{ border: '1px solid var(--mantine-color-default-border)' }}
      >
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
          <NumberInput
            label="Renda mensal (líquida)"
            value={monthlyIncome}
            onChange={(v) => setMonthlyIncome(Number(v) || 0)}
            min={0}
            thousandSeparator="."
            decimalSeparator="," 
            prefix="R$ "
          />
          <NumberInput
            label="Gastos mensais"
            value={monthlyExpenses}
            onChange={(v) => setMonthlyExpenses(Number(v) || 0)}
            min={0}
            thousandSeparator="."
            decimalSeparator="," 
            prefix="R$ "
          />
          <NumberInput
            label="Reserva atual"
            value={initialEmergencyFund}
            onChange={(v) => setInitialEmergencyFund(Number(v) || 0)}
            min={0}
            thousandSeparator="."
            decimalSeparator="," 
            prefix="R$ "
          />

          <NumberInput
            label="Queda de renda (%)"
            value={incomeDrop}
            onChange={(v) => setIncomeDrop(Number(v) || 0)}
            min={0}
            max={100}
            step={1}
          />
          <NumberInput
            label="Duração do choque (meses)"
            value={shockDuration}
            onChange={(v) => setShockDuration(Number(v) || 0)}
            min={0}
            max={600}
            step={1}
          />
          <NumberInput
            label="Início do choque (mês)"
            value={shockStartMonth}
            onChange={(v) => setShockStartMonth(Number(v) || 1)}
            min={1}
            max={horizonMonths}
            step={1}
          />

          <NumberInput
            label="Inflação anual (gastos)"
            value={annualInflation}
            onChange={(v) => setAnnualInflation(v === '' || v == null ? undefined : Number(v))}
            step={0.5}
            suffix="% a.a."
          />
          <NumberInput
            label="Rendimento anual (reserva)"
            value={annualFundYield}
            onChange={(v) => setAnnualFundYield(v === '' || v == null ? undefined : Number(v))}
            step={0.5}
            suffix="% a.a."
          />
          <NumberInput
            label="Horizonte (meses)"
            value={horizonMonths}
            onChange={(v) => setHorizonMonths(Number(v) || 1)}
            min={1}
            max={600}
            step={1}
          />
        </SimpleGrid>

        <Group justify="flex-end" mt="lg">
          <Button color="ocean" radius="xl" loading={loading} onClick={onSimulate}>
            Simular
          </Button>
        </Group>

        <Box mt="lg">
          <Text fw={600} mb="xs">Presets</Text>
          <Group align="flex-end" wrap="wrap">
            <TextInput
              label="Nome do preset"
              placeholder="Ex.: Queda de renda 40% por 6 meses"
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
                <Paper
                  key={p.id}
                  p="sm"
                  radius="lg"
                  style={{ border: '1px solid var(--mantine-color-default-border)' }}
                >
                  <Group justify="space-between" wrap="wrap">
                    <Box>
                      <Text fw={600}>{p.name}</Text>
                      <Text size="xs" c="dimmed">
                        Renda: {money(p.input.monthly_income)} · Gastos: {money(p.input.monthly_expenses)} · Reserva: {money(p.input.initial_emergency_fund)}
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
                </Paper>
              ))}
            </Stack>
          )}
        </Box>
      </Paper>

      {result && (
        <Box mt="xl">
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg" mb="lg">
            <Paper p="lg" radius="xl" style={{ border: '1px solid var(--mantine-color-default-border)' }}>
              <Text size="sm" c="dimmed">Sobrevive por</Text>
              <Text fw={700} size="xl">{formatMonthsYears(result.months_survived)}</Text>
            </Paper>
            <Paper p="lg" radius="xl" style={{ border: '1px solid var(--mantine-color-default-border)' }}>
              <Text size="sm" c="dimmed">Depleta no mês</Text>
              <Text fw={700} size="xl">{result.depleted_at_month ?? '—'}</Text>
            </Paper>
            <Paper p="lg" radius="xl" style={{ border: '1px solid var(--mantine-color-default-border)' }}>
              <Text size="sm" c="dimmed">Déficit não coberto</Text>
              <Text fw={700} size="xl">{money(result.total_uncovered_deficit)}</Text>
            </Paper>
          </SimpleGrid>

          <Paper p="xl" radius="xl" style={{ border: '1px solid var(--mantine-color-default-border)' }}>
            <Text fw={600} size="lg" mb="sm">
              Evolução da reserva
            </Text>
            <LineChart
              h={320}
              data={chartData}
              dataKey="month"
              series={[
                { name: 'balance', color: 'ocean.6', label: 'Reserva' },
                { name: 'uncovered', color: 'rose.5', label: 'Déficit não coberto' },
              ]}
              curveType="monotone"
              gridAxis="xy"
              withLegend
              valueFormatter={(value) => money(value)}
              xAxisProps={{ tickMargin: 10 }}
              yAxisProps={{ tickMargin: 10, tickFormatter: (v) => moneyCompact(v as number) }}
              tooltipAnimationDuration={150}
            />
            <Text size="xs" c="dimmed" mt="sm">
              Dica: ajuste a queda e duração do choque para simular cenários.
            </Text>
            <Group justify="space-between" mt="md" gap="xs">
              <Text size="sm" c="dimmed">
                Saldo final: <Text component="span" fw={600} c="bright">{money(result.final_emergency_fund_balance)}</Text>
              </Text>
              <Text size="sm" c="dimmed">
                Mínimo: <Text component="span" fw={600} c="bright">{money(result.min_emergency_fund_balance)}</Text>
              </Text>
              <Text size="sm" c="dimmed">
                Queda configurada: <Text component="span" fw={600} c="bright">{percent(incomeDrop, 0)}</Text>
              </Text>
            </Group>
          </Paper>
        </Box>
      )}
    </Container>
  );
}
