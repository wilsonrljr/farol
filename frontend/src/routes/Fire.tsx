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
  Progress,
  RingProgress,
  SegmentedControl,
  SimpleGrid,
  Text,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { LineChart } from '@mantine/charts';
import {
  IconAdjustments,
  IconFlame,
  IconInfoCircle,
  IconLeaf,
  IconRocket,
} from '@tabler/icons-react';
import { planFire } from '../api/toolsApi';
import type { FIREPlanInput, FIREMode } from '../api/types';
import { money, moneyCompact, percent } from '../utils/format';
import { toApiError } from '../api/client';
import { usePresets } from '../hooks/usePresets';
import { useToolSimulation } from '../hooks/useToolSimulation';
import { firstInputError, isFireInput, validateFireInput } from '../utils/toolInputs';
import { MAX_PRESET_NAME_LENGTH } from '../utils/presets';
import {
  ToolMetricCard,
  ToolPageShell,
  ToolPanel,
  ToolPresetsPanel,
  ToolResults,
} from '../components/ToolPageShell';

const PRESETS_STORAGE_KEY = 'farol.tools.fire.presets.v1';

function formatYearsMonths(months: number): string {
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years === 0) return `${remainingMonths} meses`;
  if (remainingMonths === 0) return `${years} anos`;
  return `${years} anos e ${remainingMonths} meses`;
}

function shareOfPortfolio(value: number, portfolio: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(portfolio) || portfolio <= 0) return '0,0%';
  return `${((value / portfolio) * 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

export default function Fire() {
  const [monthlyExpenses, setMonthlyExpenses] = useState<number>(5000);
  const [currentPortfolio, setCurrentPortfolio] = useState<number>(100000);
  const [monthlyContribution, setMonthlyContribution] = useState<number>(3000);
  const [horizonMonths, setHorizonMonths] = useState<number>(360);

  const [annualReturn, setAnnualReturn] = useState<number>(8);
  const [annualInflation, setAnnualInflation] = useState<number | undefined>(4);
  const [safeWithdrawalRate, setSafeWithdrawalRate] = useState<number>(4);

  const [fireMode, setFireMode] = useState<FIREMode>('traditional');
  const [currentAge, setCurrentAge] = useState<number | undefined>(30);
  const [targetRetirementAge, setTargetRetirementAge] = useState<number | undefined>(65);
  const [coastFireAge, setCoastFireAge] = useState<number | undefined>(45);
  const [baristaIncome, setBaristaIncome] = useState<number | undefined>(2000);

  const [presetName, setPresetName] = useState('');
  const presetsManager = usePresets<FIREPlanInput>({
    storageKey: PRESETS_STORAGE_KEY,
    validateInput: isFireInput,
  });
  const currentInputValue = currentInput();
  const { result, loading, simulate } = useToolSimulation(currentInputValue, planFire);

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
    return result.monthly_data.map((month) => ({
      month: month.month,
      portfolio: month.portfolio_balance,
      fireNumber: month.fire_number,
      coastFireNumber: month.coast_fire_number ?? null,
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
    const validationError = firstInputError(validateFireInput(currentInputValue));
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

  function onSavePreset() {
    const name = presetName.trim();
    if (!name) {
      notifications.show({ color: 'yellow', title: 'Nome obrigatório', message: 'Informe um nome para o preset.' });
      return;
    }

    const validationError = firstInputError(validateFireInput(currentInputValue));
    if (validationError) {
      notifications.show({ color: 'red', title: 'Preset inválido', message: validationError });
      return;
    }
    if (!presetsManager.addPreset(name, currentInputValue)) return;
    setPresetName('');
    notifications.show({ color: 'green', title: 'Preset salvo', message: `“${name}”` });
  }

  function onLoadPreset(preset: (typeof presetsManager.presets)[number]) {
    const input = preset.input;
    setMonthlyExpenses(input.monthly_expenses);
    setCurrentPortfolio(input.current_portfolio);
    setMonthlyContribution(input.monthly_contribution ?? 0);
    setHorizonMonths(input.horizon_months ?? 360);
    setAnnualReturn(input.annual_return_rate ?? 8);
    setAnnualInflation(input.annual_inflation_rate == null ? undefined : input.annual_inflation_rate);
    setSafeWithdrawalRate(input.safe_withdrawal_rate ?? 4);
    setFireMode(input.fire_mode ?? 'traditional');
    setCurrentAge(input.current_age == null ? undefined : input.current_age);
    setTargetRetirementAge(input.target_retirement_age == null ? undefined : input.target_retirement_age);
    setCoastFireAge(input.coast_fire_age == null ? undefined : input.coast_fire_age);
    setBaristaIncome(input.barista_monthly_income == null ? undefined : input.barista_monthly_income);
    notifications.show({ color: 'blue', title: 'Preset carregado', message: preset.name });
  }

  function onDeletePreset(id: string) {
    presetsManager.removePreset(id);
  }

  function onClearPresets() {
    if (!presetsManager.clearAllPresets()) return;
    notifications.show({ color: 'green', title: 'Presets removidos', message: 'Todos os presets foram apagados.' });
  }

  const previewRequiredExpenses =
    fireMode === 'barista'
      ? Math.max(0, monthlyExpenses - (baristaIncome ?? 0))
      : monthlyExpenses;
  const previewFireNumber = (previewRequiredExpenses * 12) / (safeWithdrawalRate / 100);
  const previewProgress = previewFireNumber > 0 ? (currentPortfolio / previewFireNumber) * 100 : 0;

  return (
    <ToolPageShell
      title="Independência financeira (FIRE)"
      description="Projete quando seu patrimônio pode sustentar seus gastos em valores reais de hoje. Compare o plano tradicional com Coast FIRE e Barista FIRE."
      icon={<IconFlame size={24} />}
    >
      <ToolPanel
        title="Construa seu plano de independência"
        description="Escolha a estratégia, informe sua realidade atual e refine as premissas somente se precisar."
      >
        <Text fw={650} mb="xs">Estratégia</Text>
        <SegmentedControl
          value={fireMode}
          onChange={(value) => setFireMode(value as FIREMode)}
          data={[
            { label: 'Tradicional', value: 'traditional' },
            { label: 'Coast FIRE', value: 'coast' },
            { label: 'Barista FIRE', value: 'barista' },
          ]}
          fullWidth
          size="md"
          aria-label="Estratégia FIRE"
        />
        <Text size="sm" c="dimmed" mt="xs" mb="xl">
          {fireMode === 'traditional' &&
            'Acumule patrimônio para cobrir integralmente seus gastos com retiradas da carteira.'}
          {fireMode === 'coast' &&
            'Descubra quando o patrimônio pode crescer sozinho até a aposentadoria, sem novos aportes.'}
          {fireMode === 'barista' &&
            'Considere uma renda parcial futura para reduzir a parcela dos gastos coberta pela carteira.'}
        </Text>

        <Text fw={650} mb="sm">Sua realidade hoje</Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
          <NumberInput
            label="Gastos mensais"
            description="Custo de vida que deseja sustentar"
            value={monthlyExpenses}
            onChange={(value) => setMonthlyExpenses(Number(value) || 0)}
            min={0}
            thousandSeparator="."
            decimalSeparator=","
            prefix="R$ "
          />
          <NumberInput
            label="Patrimônio investido"
            description="Carteira disponível hoje"
            value={currentPortfolio}
            onChange={(value) => setCurrentPortfolio(Number(value) || 0)}
            min={0}
            thousandSeparator="."
            decimalSeparator=","
            prefix="R$ "
          />
          <NumberInput
            label="Aporte mensal"
            description="Valor investido todos os meses"
            value={monthlyContribution}
            onChange={(value) => setMonthlyContribution(Number(value) || 0)}
            min={0}
            thousandSeparator="."
            decimalSeparator=","
            prefix="R$ "
          />
        </SimpleGrid>

        {fireMode !== 'traditional' && (
          <Paper withBorder radius="lg" p="md" mt="lg">
            <Text fw={650} mb="sm">
              Dados da estratégia {fireMode === 'coast' ? 'Coast FIRE' : 'Barista FIRE'}
            </Text>
            <SimpleGrid cols={{ base: 1, sm: fireMode === 'coast' ? 3 : 2 }} spacing="lg">
              <NumberInput
                label="Sua idade atual"
                description="Usada para localizar os marcos do plano"
                value={currentAge}
                onChange={(value) => setCurrentAge(value === '' || value == null ? undefined : Number(value))}
                min={18}
                max={100}
                suffix=" anos"
              />
              {fireMode === 'coast' ? (
                <>
                  <NumberInput
                    label="Idade para parar de aportar"
                    description="Início da fase Coast"
                    value={coastFireAge}
                    onChange={(value) => setCoastFireAge(value === '' || value == null ? undefined : Number(value))}
                    min={18}
                    max={100}
                    suffix=" anos"
                  />
                  <NumberInput
                    label="Idade-alvo de aposentadoria"
                    description="Quando a carteira deve cobrir os gastos"
                    value={targetRetirementAge}
                    onChange={(value) => setTargetRetirementAge(value === '' || value == null ? undefined : Number(value))}
                    min={18}
                    max={100}
                    suffix=" anos"
                  />
                </>
              ) : (
                <NumberInput
                  label="Renda parcial futura"
                  description="Parcela mensal coberta por trabalho"
                  value={baristaIncome}
                  onChange={(value) => setBaristaIncome(value === '' || value == null ? undefined : Number(value))}
                  min={0}
                  thousandSeparator="."
                  decimalSeparator=","
                  prefix="R$ "
                />
              )}
            </SimpleGrid>
          </Paper>
        )}

        <Paper withBorder radius="lg" p={{ base: 'md', sm: 'lg' }} mt="lg">
          <Group justify="space-between" align="center" wrap="wrap" gap="lg">
            <Box>
              <Text size="sm" c="dimmed">Meta estimada com os dados atuais</Text>
              <Text fw={720} size="xl">{money(previewFireNumber)}</Text>
              <Text size="xs" c="dimmed" mt={4}>
                {previewRequiredExpenses * 12 > 0 ? (100 / safeWithdrawalRate).toFixed(0) : 25}× os
                gastos anuais que a carteira precisará cobrir.
              </Text>
            </Box>
            <RingProgress
              size={96}
              thickness={9}
              roundCaps
              sections={[
                {
                  value: Math.min(previewProgress, 100),
                  color: previewProgress >= 100 ? 'teal' : 'ocean',
                },
              ]}
              label={
                <Text ta="center" fw={700} size="sm">
                  {percent(Math.min(previewProgress, 999))}
                </Text>
              }
            />
          </Group>
        </Paper>

        <Accordion variant="separated" radius="lg" mt="lg">
          <Accordion.Item value="advanced">
            <Accordion.Control icon={<IconAdjustments size={18} />}>
              <Text fw={650}>Premissas e prazo</Text>
              <Text size="sm" c="dimmed">
                Retorno real, retirada segura, idade e horizonte da projeção
              </Text>
            </Accordion.Control>
            <Accordion.Panel>
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
                <NumberInput
                  label={
                    <Group gap={4}>
                      <span>Retorno real anual</span>
                      <Tooltip label="Retorno acima da inflação, não a taxa nominal do investimento.">
                        <IconInfoCircle size={14} />
                      </Tooltip>
                    </Group>
                  }
                  description="Rendimento já descontado da inflação"
                  value={annualReturn}
                  onChange={(value) => setAnnualReturn(Number(value) || 0)}
                  min={-50}
                  max={100}
                  step={0.5}
                  suffix="% a.a."
                />
                <NumberInput
                  label="Taxa de retirada segura"
                  description="Percentual anual usado para calcular a meta"
                  value={safeWithdrawalRate}
                  onChange={(value) => setSafeWithdrawalRate(Number(value) || 4)}
                  min={1}
                  max={20}
                  step={0.5}
                  suffix="%"
                />
                <NumberInput
                  label="Horizonte"
                  description="Período máximo simulado"
                  value={horizonMonths}
                  onChange={(value) => setHorizonMonths(Number(value) || 360)}
                  min={12}
                  max={600}
                  step={12}
                  suffix=" meses"
                />
                <NumberInput
                  label="Inflação anual de referência"
                  description="Informativa: a projeção usa valores reais"
                  value={annualInflation}
                  onChange={(value) => setAnnualInflation(value === '' || value == null ? undefined : Number(value))}
                  min={-100}
                  max={1000}
                  step={0.5}
                  suffix="% a.a."
                />
                {fireMode === 'traditional' && (
                  <>
                    <NumberInput
                      label="Sua idade atual"
                      description="Permite mostrar sua idade na IF"
                      value={currentAge}
                      onChange={(value) => setCurrentAge(value === '' || value == null ? undefined : Number(value))}
                      min={18}
                      max={100}
                      suffix=" anos"
                    />
                    <NumberInput
                      label="Idade-alvo de aposentadoria"
                      description="Referência opcional"
                      value={targetRetirementAge}
                      onChange={(value) => setTargetRetirementAge(value === '' || value == null ? undefined : Number(value))}
                      min={18}
                      max={100}
                      suffix=" anos"
                    />
                  </>
                )}
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
            leftSection={<IconRocket size={18} />}
          >
            Projetar independência
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
        placeholder="Ex.: Plano conservador de 4%"
        maxNameLength={MAX_PRESET_NAME_LENGTH}
        renderSummary={(preset) => (
          <>
            Gastos: {money(preset.input.monthly_expenses)} · Patrimônio:{' '}
            {money(preset.input.current_portfolio)} · Aporte:{' '}
            {money(preset.input.monthly_contribution ?? 0)}
          </>
        )}
      />

      {result && (
        <ToolResults
          title="Interprete seu caminho até a IF"
          description="A meta é expressa em dinheiro de hoje. O prazo considera os aportes e o retorno real informados."
        >
          <Alert color={result.fi_achieved ? 'teal' : 'blue'} variant="light">
            {result.fi_achieved
              ? `A projeção atinge a independência financeira${result.fi_age != null ? ` aos ${result.fi_age} anos` : ''}.`
              : 'A meta não é atingida dentro do horizonte informado. Ajuste prazo, aporte, gastos ou premissas para explorar alternativas.'}
          </Alert>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
            <ToolMetricCard
              label="Status"
              value={result.fi_achieved ? 'IF atingida' : 'Em progresso'}
              tone={result.fi_achieved ? 'positive' : 'accent'}
              detail="Indica se a carteira cruza a meta durante a projeção."
            />
            <ToolMetricCard
              label="Tempo até a IF"
              value={result.months_to_fi != null ? formatYearsMonths(result.months_to_fi) : 'Fora do horizonte'}
              tone={result.months_to_fi != null ? 'positive' : 'warning'}
              detail={result.fi_age != null ? `Idade projetada: ${result.fi_age} anos.` : 'Amplie o horizonte para testar um prazo maior.'}
            />
            <ToolMetricCard
              label="Patrimônio necessário"
              value={money(result.fire_number)}
              detail="FIRE Number em poder de compra de hoje."
            />
            <ToolMetricCard
              label="Renda passiva hoje"
              value={`${money(result.monthly_data[0]?.monthly_passive_income ?? 0)}/mês`}
              detail="Estimativa pela taxa de retirada informada."
            />
          </SimpleGrid>

          <Paper withBorder radius="xl" p={{ base: 'md', sm: 'xl' }}>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
              <Box>
                <Text size="sm" c="dimmed">Patrimônio no fim do horizonte</Text>
                <Text fw={700} size="lg" mt={4}>{money(result.final_portfolio)}</Text>
                <Progress
                  value={result.fire_number > 0 ? Math.min((result.final_portfolio / result.fire_number) * 100, 100) : 0}
                  color="ocean"
                  size="sm"
                  mt="xs"
                />
              </Box>
              <Box>
                <Text size="sm" c="dimmed">Total aportado</Text>
                <Text fw={700} size="lg" mt={4}>{money(result.total_contributions)}</Text>
                <Text size="xs" c="dimmed" mt={4}>
                  {shareOfPortfolio(result.total_contributions, result.final_portfolio)} do patrimônio final
                </Text>
              </Box>
              <Box>
                <Text size="sm" c="dimmed">Rendimentos acumulados</Text>
                <Text fw={700} size="lg" mt={4}>{money(result.total_investment_returns)}</Text>
                <Text size="xs" c="dimmed" mt={4}>
                  {shareOfPortfolio(result.total_investment_returns, result.final_portfolio)} do patrimônio final
                </Text>
              </Box>
            </SimpleGrid>
          </Paper>

          {result.coast_fire_number != null && (
            <Paper withBorder radius="xl" p={{ base: 'md', sm: 'xl' }}>
              <Group gap="xs" mb="md">
                <IconLeaf size={20} color="var(--mantine-color-teal-6)" />
                <Text fw={650}>Marco Coast FIRE</Text>
                <Badge color={result.coast_fire_achieved ? 'teal' : 'gray'} variant="light">
                  {result.coast_fire_achieved ? 'Atingido' : 'Ainda não atingido'}
                </Badge>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Box>
                  <Text size="sm" c="dimmed">Valor necessário hoje</Text>
                  <Text fw={700} size="lg">{money(result.coast_fire_number)}</Text>
                </Box>
                <Text size="sm" c="dimmed" lh={1.55}>
                  A curva recalcula o patrimônio necessário conforme a aposentadoria se aproxima; não é uma meta fixa ao longo do tempo.
                </Text>
              </SimpleGrid>
            </Paper>
          )}

          <Paper withBorder radius="xl" p={{ base: 'md', sm: 'xl' }}>
            <Text fw={650} size="lg">Patrimônio versus meta</Text>
            <Text size="sm" c="dimmed" mt={4} mb="lg">
              O cruzamento das linhas marca o primeiro mês de independência financeira na projeção.
            </Text>
            <Box role="img" aria-label="Gráfico da evolução do patrimônio e do FIRE Number">
              <LineChart
                h={350}
                data={chartData}
                dataKey="month"
                series={[
                  { name: 'portfolio', color: 'ocean.6', label: 'Patrimônio' },
                  { name: 'fireNumber', color: 'amber.5', label: 'FIRE Number' },
                  ...(fireMode === 'coast'
                    ? [{ name: 'coastFireNumber', color: 'teal.5', label: 'Coast FIRE dinâmico' }]
                    : []),
                ]}
                curveType="monotone"
                gridAxis="xy"
                withLegend
                valueFormatter={(value) => money(value)}
                xAxisProps={{
                  tickMargin: 10,
                  tickFormatter: (value) => `${Math.floor(Number(value) / 12)}a`,
                }}
                yAxisProps={{ tickMargin: 10, tickFormatter: (value) => moneyCompact(value as number) }}
                tooltipAnimationDuration={150}
                referenceLines={
                  result.fi_month
                    ? [{ x: result.fi_month, label: 'IF', color: 'emerald.6' }]
                    : undefined
                }
              />
            </Box>
            <Group justify="space-between" mt="md" gap="xs" wrap="wrap">
              <Text size="sm" c="dimmed">
                Renda passiva final:{' '}
                <Text component="span" fw={600} c="bright">
                  {money(result.final_monthly_passive_income)}/mês
                </Text>
              </Text>
              {result.fi_month && (
                <Text size="sm" c="dimmed">
                  IF no mês {result.fi_month} ({formatYearsMonths(result.fi_month)})
                </Text>
              )}
            </Group>
          </Paper>
        </ToolResults>
      )}
    </ToolPageShell>
  );
}
