import { useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  Alert,
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
import { IconAdjustments, IconChartLine, IconShieldCheck } from '@tabler/icons-react';
import { planEmergencyFund } from '../api/toolsApi';
import type { EmergencyFundPlanInput } from '../api/types';
import { money, moneyCompact, formatMonthsYears } from '../utils/format';
import { toApiError } from '../api/client';
import { usePresets } from '../hooks/usePresets';
import { useToolSimulation } from '../hooks/useToolSimulation';
import {
  firstInputError,
  isEmergencyFundInput,
  validateEmergencyFundInput,
} from '../utils/toolInputs';
import { MAX_PRESET_NAME_LENGTH } from '../utils/presets';
import {
  ToolMetricCard,
  ToolPageShell,
  ToolPanel,
  ToolPresetsPanel,
  ToolResults,
} from '../components/ToolPageShell';
const PRESETS_STORAGE_KEY = 'farol.tools.emergencyFund.presets.v1';

export default function EmergencyFund() {
  const [monthlyExpenses, setMonthlyExpenses] = useState<number>(5500);
  const [initialFund, setInitialFund] = useState<number>(10000);
  const [targetMonths, setTargetMonths] = useState<number>(6);
  const [monthlyContribution, setMonthlyContribution] = useState<number>(1200);
  const [horizonMonths, setHorizonMonths] = useState<number>(60);
  const [annualInflation, setAnnualInflation] = useState<number | undefined>(4);
  const [annualYield, setAnnualYield] = useState<number | undefined>(10);

  const [presetName, setPresetName] = useState('');
  const presetsManager = usePresets<EmergencyFundPlanInput>({
    storageKey: PRESETS_STORAGE_KEY,
    validateInput: isEmergencyFundInput,
  });
  const currentInputValue = currentInput();
  const { result, loading, simulate } = useToolSimulation(
    currentInputValue,
    planEmergencyFund
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
      target: m.target_amount,
    }));
  }, [result]);

  async function onSimulate() {
    const validationError = firstInputError(validateEmergencyFundInput(currentInputValue));
    if (validationError) {
      notifications.show({ color: 'red', title: 'Revise os dados', message: validationError });
      return;
    }
    try {
      await simulate();
    } catch (caught: unknown) {
      const error = await toApiError(caught);
      notifications.show({ color: 'red', title: 'Erro ao calcular', message: error.message });
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

    const validationError = firstInputError(validateEmergencyFundInput(currentInputValue));
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
    presetsManager.removePreset(id);
  }

  function onClearPresets() {
    if (!presetsManager.clearAllPresets()) return;
    notifications.show({ color: 'green', title: 'Presets removidos', message: 'Todos os presets foram apagados.' });
  }

  return (
    <ToolPageShell
      title="Reserva de emergência"
      description="Defina sua meta de proteção e descubra quanto tempo falta para alcançá-la, com inflação e rendimento tratados de forma explícita."
      icon={<IconShieldCheck size={24} />}
    >
      <ToolPanel
        title="Monte seu plano"
        description="Comece pelos quatro valores essenciais. As premissas de longo prazo ficam separadas para você ajustar apenas quando fizer sentido."
      >
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          <NumberInput
            label="Gastos mensais"
            description="Despesas essenciais que a reserva precisa cobrir"
            value={monthlyExpenses}
            onChange={(v) => setMonthlyExpenses(Number(v) || 0)}
            min={0}
            thousandSeparator="."
            decimalSeparator="," 
            prefix="R$ "
          />
          <NumberInput
            label="Reserva atual"
            description="Saldo disponível hoje para emergências"
            value={initialFund}
            onChange={(v) => setInitialFund(Number(v) || 0)}
            min={0}
            thousandSeparator="."
            decimalSeparator="," 
            prefix="R$ "
          />
          <NumberInput
            label="Meta (meses de gastos)"
            description="Em geral, de 3 a 12 meses conforme sua estabilidade"
            value={targetMonths}
            onChange={(v) => setTargetMonths(Number(v) || 1)}
            min={1}
            max={60}
            step={1}
          />

          <NumberInput
            label="Aporte mensal"
            description="Valor que você pretende guardar todos os meses"
            value={monthlyContribution}
            onChange={(v) => setMonthlyContribution(Number(v) || 0)}
            min={0}
            thousandSeparator="."
            decimalSeparator="," 
            prefix="R$ "
          />
        </SimpleGrid>

        <Accordion variant="separated" radius="lg" mt="lg">
          <Accordion.Item value="advanced">
            <Accordion.Control icon={<IconAdjustments size={18} />}>
              <Text fw={650}>Premissas avançadas</Text>
              <Text size="sm" c="dimmed">
                Inflação, rendimento da reserva e horizonte da projeção
              </Text>
            </Accordion.Control>
            <Accordion.Panel>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
                <NumberInput
                  label="Inflação anual dos gastos"
                  description="Reajusta a meta ao longo do tempo"
                  value={annualInflation}
                  onChange={(v) => setAnnualInflation(v === '' || v == null ? undefined : Number(v))}
                  min={-100}
                  max={1000}
                  step={0.5}
                  suffix="% a.a."
                />
                <NumberInput
                  label="Rendimento anual da reserva"
                  description="Retorno nominal estimado"
                  value={annualYield}
                  onChange={(v) => setAnnualYield(v === '' || v == null ? undefined : Number(v))}
                  min={-99.99}
                  max={1000}
                  step={0.5}
                  suffix="% a.a."
                />
                <NumberInput
                  label="Horizonte da projeção"
                  description="Prazo máximo que será analisado"
                  value={horizonMonths}
                  onChange={(v) => setHorizonMonths(Number(v) || 1)}
                  min={1}
                  max={600}
                  step={1}
                  suffix=" meses"
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
            Calcular meu plano
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
        placeholder="Ex.: Meta de 6 meses"
        maxNameLength={MAX_PRESET_NAME_LENGTH}
        renderSummary={(preset) => (
          <>
            Gastos: {money(preset.input.monthly_expenses)} · Meta:{' '}
            {preset.input.target_months_of_expenses ?? 6} meses · Aporte:{' '}
            {money(preset.input.monthly_contribution ?? 0)}
          </>
        )}
      />

      {result && (
        <ToolResults
          title="Leia seu caminho até a meta"
          description="O status responde se a reserva já protege você hoje; o prazo mostra quando o saldo projetado alcança a meta atualizada."
        >
          <Alert color={result.currently_achieved ? 'teal' : 'blue'} variant="light">
            {result.currently_achieved
              ? 'Sua reserva atual já cobre a meta informada. Continue acompanhando gastos e liquidez.'
              : result.months_to_goal == null
                ? 'Com estas premissas, a meta não é alcançada dentro do horizonte. Teste um aporte maior ou um prazo mais longo.'
                : `Mantendo o aporte, a meta é alcançada em ${formatMonthsYears(result.months_to_goal)}.`}
          </Alert>
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg" mb="lg">
            <ToolMetricCard
              label="Status da meta hoje"
              value={result.currently_achieved ? 'Já atingida' : 'Em construção'}
              tone={result.currently_achieved ? 'positive' : 'accent'}
              detail="Compara sua reserva atual à meta de gastos de hoje."
            />
            <ToolMetricCard
              label="Tempo até a meta"
              value={
                result.months_to_goal == null
                  ? 'Fora do horizonte'
                  : result.months_to_goal === 0
                    ? 'Meta já atingida'
                    : formatMonthsYears(result.months_to_goal)
              }
              detail={
                !result.currently_achieved && result.achieved_at_month != null
                  ? `Primeiro fechamento em que a meta é alcançada: mês ${result.achieved_at_month}.`
                  : 'Considera aportes, rendimento e atualização dos gastos.'
              }
              tone={result.months_to_goal == null ? 'warning' : 'positive'}
            />
            <ToolMetricCard
              label="Meta no fim do horizonte"
              value={money(result.target_amount_end)}
              detail="Valor da meta após o reajuste dos gastos ao longo da projeção."
            />
          </SimpleGrid>

          <Paper withBorder radius="xl" p={{ base: 'md', sm: 'xl' }}>
            <Text fw={650} size="lg">Evolução da reserva e da meta</Text>
            <Text size="sm" c="dimmed" mt={4} mb="lg">
              O encontro das linhas mostra quando o saldo passa a cobrir a meta reajustada.
            </Text>
            <Box role="img" aria-label="Gráfico da evolução da reserva em comparação com a meta">
              <LineChart
                h={320}
                data={chartData}
                dataKey="month"
                series={[
                  { name: 'balance', color: 'ocean.6', label: 'Reserva' },
                  { name: 'target', color: 'teal.5', label: 'Meta' },
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
            <Group justify="space-between" mt="md" gap="xs">
              <Text size="sm" c="dimmed">
                Saldo final: <Text component="span" fw={600} c="bright">{money(result.final_emergency_fund_balance)}</Text>
              </Text>
            </Group>
          </Paper>
        </ToolResults>
      )}
    </ToolPageShell>
  );
}
