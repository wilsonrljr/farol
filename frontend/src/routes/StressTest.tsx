import { useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  Alert,
  Badge,
  Box,
  Button,
  Group,
  NumberInput,
  Paper,
  SimpleGrid,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { LineChart } from '@mantine/charts';
import { IconAdjustments, IconBolt, IconChartLine } from '@tabler/icons-react';
import { runStressTest } from '../api/toolsApi';
import type { StressTestInput } from '../api/types';
import { money, moneyCompact, percent, formatMonthsYears } from '../utils/format';
import { toApiError } from '../api/client';
import { usePresets } from '../hooks/usePresets';
import { useToolSimulation } from '../hooks/useToolSimulation';
import {
  firstInputError,
  isStressTestInput,
  validateStressTestInput,
} from '../utils/toolInputs';
import { MAX_PRESET_NAME_LENGTH } from '../utils/presets';
import {
  ToolMetricCard,
  ToolPageShell,
  ToolPanel,
  ToolPresetsPanel,
  ToolResults,
} from '../components/ToolPageShell';

const PRESETS_STORAGE_KEY = 'farol.tools.stressTest.presets.v1';

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

  const [presetName, setPresetName] = useState('');
  const presetsManager = usePresets<StressTestInput>({
    storageKey: PRESETS_STORAGE_KEY,
    validateInput: isStressTestInput,
  });
  const currentInputValue = currentInput();
  const { result, loading, lastInput, simulate } = useToolSimulation(
    currentInputValue,
    runStressTest
  );

  useEffect(() => {
    if (!presetsManager.storageError) return;
    notifications.show({
      color: 'red',
      title: 'Presets não puderam ser persistidos',
      message: presetsManager.storageError,
    });
  }, [presetsManager.storageError]);

  const chartData = useMemo(() => {
    if (!result) return [];
    return result.monthly_data.map((m) => ({
      month: m.month,
      balance: m.emergency_fund_balance,
      uncovered: m.uncovered_deficit,
      income: m.income,
      baselineIncome: m.baseline_income ?? m.income,
    }));
  }, [result]);

  async function onSimulate() {
    const validationError = firstInputError(validateStressTestInput(currentInputValue));
    if (validationError) {
      notifications.show({ color: 'red', title: 'Revise os dados', message: validationError });
      return;
    }
    try {
      await simulate();
    } catch (caught: unknown) {
      const error = await toApiError(caught);
      notifications.show({
        color: 'red',
        title: 'Erro ao simular',
        message: error.message,
      });
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
    const validationError = firstInputError(validateStressTestInput(currentInputValue));
    if (validationError) {
      notifications.show({ color: 'red', title: 'Preset inválido', message: validationError });
      return;
    }

    if (!presetsManager.addPreset(name, currentInputValue)) return;
    setPresetName('');
    notifications.show({ color: 'green', title: 'Preset salvo', message: `“${name}”` });
  }

  function onLoadPreset(p: (typeof presetsManager.presets)[number]) {
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
    presetsManager.removePreset(id);
  }

  function onClearPresets() {
    if (!presetsManager.clearAllPresets()) return;
    notifications.show({ color: 'green', title: 'Presets removidos', message: 'Todos os presets foram apagados.' });
  }

  return (
    <ToolPageShell
      title="Teste de estresse"
      description="Simule uma queda temporária de renda e entenda quando sua reserva absorve o impacto — e quando o orçamento passa a ficar descoberto."
      icon={<IconBolt size={24} />}
    >
      <ToolPanel
        title="Desenhe o choque"
        description="Informe sua base financeira e depois defina intensidade, início e duração do evento."
      >
        <Text fw={650} mb="sm">Sua base hoje</Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
          <NumberInput
            label="Renda mensal (líquida)"
            description="Renda antes do choque"
            value={monthlyIncome}
            onChange={(v) => setMonthlyIncome(Number(v) || 0)}
            min={0}
            thousandSeparator="."
            decimalSeparator="," 
            prefix="R$ "
          />
          <NumberInput
            label="Gastos mensais"
            description="Despesas cobertas todo mês"
            value={monthlyExpenses}
            onChange={(v) => setMonthlyExpenses(Number(v) || 0)}
            min={0}
            thousandSeparator="."
            decimalSeparator="," 
            prefix="R$ "
          />
          <NumberInput
            label="Reserva atual"
            description="Saldo disponível no início"
            value={initialEmergencyFund}
            onChange={(v) => setInitialEmergencyFund(Number(v) || 0)}
            min={0}
            thousandSeparator="."
            decimalSeparator="," 
            prefix="R$ "
          />

        </SimpleGrid>

        <Text fw={650} mt="xl" mb="sm">Cenário de queda de renda</Text>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
          <NumberInput
            label="Queda da renda"
            description="Percentual reduzido durante o choque"
            value={incomeDrop}
            onChange={(v) => setIncomeDrop(Number(v) || 0)}
            min={0}
            max={100}
            step={1}
            suffix="%"
          />
          <NumberInput
            label="Duração"
            description="Use zero para desativar o choque"
            value={shockDuration}
            onChange={(v) => setShockDuration(Number(v) || 0)}
            min={0}
            max={Math.max(0, horizonMonths - shockStartMonth + 1)}
            step={1}
            suffix=" meses"
          />
          <NumberInput
            label="Mês de início"
            description="Primeiro mês com renda reduzida"
            value={shockStartMonth}
            onChange={(v) => setShockStartMonth(Number(v) || 1)}
            min={1}
            max={horizonMonths}
            step={1}
          />
          <NumberInput
            label="Horizonte"
            description="Período total analisado"
            value={horizonMonths}
            onChange={(v) => setHorizonMonths(Number(v) || 1)}
            min={1}
            max={600}
            step={1}
            suffix=" meses"
          />
        </SimpleGrid>

        <Accordion variant="separated" radius="lg" mt="lg">
          <Accordion.Item value="advanced">
            <Accordion.Control icon={<IconAdjustments size={18} />}>
              <Text fw={650}>Premissas avançadas</Text>
              <Text size="sm" c="dimmed">Inflação dos gastos e rendimento da reserva</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                <NumberInput
                  label="Inflação anual dos gastos"
                  description="Reajusta as despesas durante a projeção"
                  value={annualInflation}
                  onChange={(v) => setAnnualInflation(v === '' || v == null ? undefined : Number(v))}
                  min={-100}
                  max={1000}
                  step={0.5}
                  suffix="% a.a."
                />
                <NumberInput
                  label="Rendimento anual da reserva"
                  description="Retorno estimado do saldo disponível"
                  value={annualFundYield}
                  onChange={(v) => setAnnualFundYield(v === '' || v == null ? undefined : Number(v))}
                  min={-99.99}
                  max={1000}
                  step={0.5}
                  suffix="% a.a."
                />
              </SimpleGrid>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>

        <Group justify="flex-end" mt="xl">
          <Button
            color="ocean"
            size="md"
            mih={44}
            w={{ base: '100%', sm: 'auto' }}
            loading={loading}
            onClick={onSimulate}
            leftSection={<IconChartLine size={18} />}
          >
            Simular impacto
          </Button>
        </Group>
      </ToolPanel>

      <ToolPresetsPanel
        presets={presetsManager.presets}
        name={presetName}
        onNameChange={setPresetName}
        onSave={onSavePreset}
        onLoad={onLoadPreset}
        onDelete={onDeletePreset}
        onClear={onClearPresets}
        placeholder="Ex.: Queda de 40% por 6 meses"
        maxNameLength={MAX_PRESET_NAME_LENGTH}
        renderSummary={(preset) => (
          <>
            Renda: {money(preset.input.monthly_income)} · Gastos:{' '}
            {money(preset.input.monthly_expenses)} · Reserva:{' '}
            {money(preset.input.initial_emergency_fund)}
          </>
        )}
      />

      {result && (
        <ToolResults
          title="Entenda sua margem de segurança"
          description="Os indicadores separam a duração da cobertura do valor que ficaria sem fonte de pagamento."
        >
          <Alert
            color={result.total_uncovered_deficit > 0 ? 'orange' : 'teal'}
            variant="light"
            title="Janela de choque simulada"
          >
            {(lastInput?.shock_duration_months ?? 0) > 0 ? (
              <Group gap="xs" wrap="wrap">
                <Badge color="blue" variant="light">
                  mês {lastInput?.shock_start_month} ao{' '}
                  {(lastInput?.shock_start_month ?? 1) + (lastInput?.shock_duration_months ?? 0) - 1}
                </Badge>
                <Text size="sm">
                  Queda de {percent(lastInput?.income_drop_percentage ?? 0, 0)} aplicada apenas nesse intervalo inclusivo.
                </Text>
              </Group>
            ) : (
              <Text size="sm">Choque desativado: duração igual a zero.</Text>
            )}
          </Alert>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
            <ToolMetricCard
              label="Cobertura completa"
              value={formatMonthsYears(result.months_survived)}
              detail="Meses fechados sem a reserva ficar negativa."
              tone={result.depleted_at_month == null ? 'positive' : 'warning'}
            />
            <ToolMetricCard
              label="Reserva se esgota no mês"
              value={result.depleted_at_month ?? 'Não se esgota'}
              detail="Primeiro mês em que o saldo não cobre todo o déficit."
              tone={result.depleted_at_month == null ? 'positive' : 'danger'}
            />
            <ToolMetricCard
              label="Déficit sem cobertura"
              value={money(result.total_uncovered_deficit)}
              detail="Soma do valor que faltaria após o esgotamento da reserva."
              tone={result.total_uncovered_deficit > 0 ? 'danger' : 'positive'}
            />
          </SimpleGrid>

          <Paper withBorder radius="xl" p={{ base: 'md', sm: 'xl' }}>
            <Text fw={650} size="lg">Evolução da reserva</Text>
            <Text size="sm" c="dimmed" mt={4} mb="lg">
              Compare a renda normal à renda sob choque e acompanhe o saldo disponível mês a mês.
            </Text>
            <Box role="img" aria-label="Gráfico da evolução da reserva durante o choque de renda">
              <LineChart
                h={320}
                data={chartData}
                dataKey="month"
                series={[
                  { name: 'balance', color: 'ocean.6', label: 'Reserva' },
                  { name: 'uncovered', color: 'rose.5', label: 'Déficit não coberto' },
                  { name: 'income', color: 'teal.5', label: 'Renda efetiva' },
                  { name: 'baselineIncome', color: 'gray.5', label: 'Renda sem choque' },
                ]}
                curveType="monotone"
                gridAxis="xy"
                withLegend
                valueFormatter={(value) => money(value)}
                xAxisProps={{ tickMargin: 10 }}
                yAxisProps={{ tickMargin: 10, tickFormatter: (v) => moneyCompact(v as number) }}
                tooltipAnimationDuration={150}
              />
            </Box>
            <Text size="xs" c="dimmed" mt="sm">
              A queda de renda é aplicada somente na janela destacada pelos valores acima; fora dela, a renda retorna ao patamar informado.
            </Text>
            <Group justify="space-between" mt="md" gap="xs">
              <Text size="sm" c="dimmed">
                Saldo final: <Text component="span" fw={600} c="bright">{money(result.final_emergency_fund_balance)}</Text>
              </Text>
              <Text size="sm" c="dimmed">
                Mínimo: <Text component="span" fw={600} c="bright">{money(result.min_emergency_fund_balance)}</Text>
              </Text>
              <Text size="sm" c="dimmed">
                Queda simulada: <Text component="span" fw={600} c="bright">{percent(lastInput?.income_drop_percentage ?? 0, 0)}</Text>
              </Text>
            </Group>
          </Paper>
        </ToolResults>
      )}
    </ToolPageShell>
  );
}
