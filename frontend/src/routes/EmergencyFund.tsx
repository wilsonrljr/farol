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
import { planEmergencyFund } from '../api/toolsApi';
import type { EmergencyFundPlanInput, EmergencyFundPlanResult } from '../api/types';
import { money, moneyCompact, formatMonthsYears } from '../utils/format';
import { loadPresets, newPresetId, savePresets, type Preset } from '../utils/presets';

type EmergencyFundPreset = Preset<EmergencyFundPlanInput>;
const PRESETS_STORAGE_KEY = 'farol.tools.emergencyFund.presets.v1';

export default function EmergencyFund() {
  const [monthlyExpenses, setMonthlyExpenses] = useState<number>(5500);
  const [initialFund, setInitialFund] = useState<number>(10000);
  const [targetMonths, setTargetMonths] = useState<number>(6);
  const [monthlyContribution, setMonthlyContribution] = useState<number>(1200);
  const [horizonMonths, setHorizonMonths] = useState<number>(60);
  const [annualInflation, setAnnualInflation] = useState<number | undefined>(4);
  const [annualYield, setAnnualYield] = useState<number | undefined>(10);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EmergencyFundPlanResult | null>(null);

  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState<EmergencyFundPreset[]>(() => loadPresets(PRESETS_STORAGE_KEY));

  const chartData = useMemo(() => {
    if (!result) return [];
    return result.monthly_data.map((m) => ({
      month: m.month,
      balance: m.emergency_fund_balance,
      target: m.target_amount,
    }));
  }, [result]);

  async function onSimulate() {
    setLoading(true);
    try {
      const data = await planEmergencyFund({
        monthly_expenses: monthlyExpenses,
        initial_emergency_fund: initialFund,
        target_months_of_expenses: targetMonths,
        monthly_contribution: monthlyContribution,
        horizon_months: horizonMonths,
        annual_inflation_rate: annualInflation ?? null,
        annual_emergency_fund_yield_rate: annualYield ?? null,
      });
      setResult(data);
    } catch (e: any) {
      notifications.show({ color: 'red', title: 'Erro ao calcular', message: String(e) });
    } finally {
      setLoading(false);
    }
  }

  function currentInput(): EmergencyFundPlanInput {
    return {
      monthly_expenses: monthlyExpenses,
      initial_emergency_fund: initialFund,
      target_months_of_expenses: targetMonths,
      monthly_contribution: monthlyContribution,
      horizon_months: horizonMonths,
      annual_inflation_rate: annualInflation ?? null,
      annual_emergency_fund_yield_rate: annualYield ?? null,
    };
  }

  function onSavePreset() {
    const name = presetName.trim();
    if (!name) {
      notifications.show({ color: 'yellow', title: 'Nome obrigatório', message: 'Informe um nome para o preset.' });
      return;
    }

    const next: EmergencyFundPreset[] = [
      { id: newPresetId(), name, createdAt: Date.now(), input: currentInput() },
      ...presets,
    ];
    setPresets(next);
    savePresets(PRESETS_STORAGE_KEY, next);
    setPresetName('');
    notifications.show({ color: 'green', title: 'Preset salvo', message: `“${name}”` });
  }

  function onLoadPreset(p: EmergencyFundPreset) {
    const i = p.input;
    setMonthlyExpenses(i.monthly_expenses);
    setInitialFund(i.initial_emergency_fund);
    setTargetMonths(i.target_months_of_expenses ?? 6);
    setMonthlyContribution(i.monthly_contribution ?? 0);
    setHorizonMonths(i.horizon_months ?? 60);
    setAnnualInflation(i.annual_inflation_rate == null ? undefined : i.annual_inflation_rate);
    setAnnualYield(i.annual_emergency_fund_yield_rate == null ? undefined : i.annual_emergency_fund_yield_rate);
    notifications.show({ color: 'blue', title: 'Preset carregado', message: p.name });
  }

  function onDeletePreset(id: string) {
    const next = presets.filter((p) => p.id !== id);
    setPresets(next);
    savePresets(PRESETS_STORAGE_KEY, next);
  }

  function onClearPresets() {
    const next: EmergencyFundPreset[] = [];
    setPresets(next);
    savePresets(PRESETS_STORAGE_KEY, next);
    notifications.show({ color: 'green', title: 'Presets removidos', message: 'Todos os presets foram apagados.' });
  }

  return (
    <Container size="lg" py="xl">
      <Box mb="lg">
        <Title order={2} fw={700} mb={6}>
          Reserva de emergência
        </Title>
        <Text c="dimmed">
          Planeje quanto tempo falta para atingir uma meta (ex.: 6 meses de gastos), considerando inflação e rendimento.
        </Text>
      </Box>

      <Paper p="xl" radius="xl" style={{ border: '1px solid var(--mantine-color-default-border)' }}>
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
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
            value={initialFund}
            onChange={(v) => setInitialFund(Number(v) || 0)}
            min={0}
            thousandSeparator="."
            decimalSeparator="," 
            prefix="R$ "
          />
          <NumberInput
            label="Meta (meses de gastos)"
            value={targetMonths}
            onChange={(v) => setTargetMonths(Number(v) || 1)}
            min={1}
            max={60}
            step={1}
          />

          <NumberInput
            label="Aporte mensal"
            value={monthlyContribution}
            onChange={(v) => setMonthlyContribution(Number(v) || 0)}
            min={0}
            thousandSeparator="."
            decimalSeparator="," 
            prefix="R$ "
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
            value={annualYield}
            onChange={(v) => setAnnualYield(v === '' || v == null ? undefined : Number(v))}
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
          <Button color="sage" radius="xl" loading={loading} onClick={onSimulate}>
            Calcular
          </Button>
        </Group>

        <Box mt="lg">
          <Text fw={600} mb="xs">Presets</Text>
          <Group align="flex-end" wrap="wrap">
            <TextInput
              label="Nome do preset"
              placeholder="Ex.: Meta 6 meses (aporte R$ 1.200)"
              value={presetName}
              onChange={(e) => setPresetName(e.currentTarget.value)}
              style={{ flex: 1, minWidth: 260 }}
            />
            <Button variant="light" color="sage" radius="xl" onClick={onSavePreset}>
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
                        Gastos: {money(p.input.monthly_expenses)} · Meta: {p.input.target_months_of_expenses ?? 6} meses · Aporte: {money(p.input.monthly_contribution ?? 0)}
                      </Text>
                    </Box>
                    <Group gap="xs">
                      <Button size="xs" radius="xl" variant="light" color="sage" onClick={() => onLoadPreset(p)}>
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
              <Text size="sm" c="dimmed">Atinge a meta no mês</Text>
              <Text fw={700} size="xl">{result.achieved_at_month ?? '—'}</Text>
            </Paper>
            <Paper p="lg" radius="xl" style={{ border: '1px solid var(--mantine-color-default-border)' }}>
              <Text size="sm" c="dimmed">Tempo até a meta</Text>
              <Text fw={700} size="xl">{result.months_to_goal == null ? '—' : formatMonthsYears(result.months_to_goal + 1)}</Text>
            </Paper>
            <Paper p="lg" radius="xl" style={{ border: '1px solid var(--mantine-color-default-border)' }}>
              <Text size="sm" c="dimmed">Meta no final do horizonte</Text>
              <Text fw={700} size="xl">{money(result.target_amount_end)}</Text>
            </Paper>
          </SimpleGrid>

          <Paper p="xl" radius="xl" style={{ border: '1px solid var(--mantine-color-default-border)' }}>
            <Text fw={600} size="lg" mb="sm">Evolução da reserva vs meta</Text>
            <LineChart
              h={320}
              data={chartData}
              dataKey="month"
              series={[
                { name: 'balance', color: 'sage.7', label: 'Reserva' },
                { name: 'target', color: 'info.6', label: 'Meta' },
              ]}
              curveType="monotone"
              gridAxis="xy"
              withLegend
              valueFormatter={(value) => money(value)}
              xAxisProps={{ tickMargin: 10 }}
              yAxisProps={{ tickMargin: 10, tickFormatter: (v) => moneyCompact(v as number) }}
              tooltipAnimationDuration={150}
            />
            <Group justify="space-between" mt="md" gap="xs">
              <Text size="sm" c="dimmed">
                Saldo final: <Text component="span" fw={600} c="bright">{money(result.final_emergency_fund_balance)}</Text>
              </Text>
            </Group>
          </Paper>
        </Box>
      )}
    </Container>
  );
}
