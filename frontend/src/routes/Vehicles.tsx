import { useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  Alert,
  Box,
  Button,
  Collapse,
  Group,
  NumberInput,
  Paper,
  SimpleGrid,
  Switch,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { LineChart } from '@mantine/charts';
import { IconAdjustments, IconCar, IconChartLine } from '@tabler/icons-react';
import { compareVehicleOptions } from '../api/toolsApi';
import type { VehicleComparisonInput } from '../api/types';
import { money, moneyCompact } from '../utils/format';
import { toApiError } from '../api/client';
import { usePresets } from '../hooks/usePresets';
import { useToolSimulation } from '../hooks/useToolSimulation';
import {
  firstInputError,
  isVehicleInput,
  validateVehicleInput,
} from '../utils/toolInputs';
import { MAX_PRESET_NAME_LENGTH } from '../utils/presets';
import {
  ToolMetricCard,
  ToolPageShell,
  ToolPanel,
  ToolPresetsPanel,
  ToolResults,
} from '../components/ToolPageShell';

const PRESETS_STORAGE_KEY = 'farol.tools.vehicles.presets.v1';

export default function Vehicles() {
  const [vehiclePrice, setVehiclePrice] = useState<number>(80000);
  const [horizonMonths, setHorizonMonths] = useState<number>(60);
  const [annualDep, setAnnualDep] = useState<number>(12);
  const [annualInflation, setAnnualInflation] = useState<number | undefined>(4);

  const [monthlyInsurance, setMonthlyInsurance] = useState<number>(250);
  const [monthlyMaintenance, setMonthlyMaintenance] = useState<number>(200);
  const [monthlyFuel, setMonthlyFuel] = useState<number>(900);
  const [annualIpvaPct, setAnnualIpvaPct] = useState<number>(4);

  const [includeCash, setIncludeCash] = useState(true);

  const [includeFin, setIncludeFin] = useState(true);
  const [finDown, setFinDown] = useState<number>(20000);
  const [finTerm, setFinTerm] = useState<number>(48);
  const [finAnnualRate, setFinAnnualRate] = useState<number>(22);

  const [includeCons, setIncludeCons] = useState(false);
  const [consTerm, setConsTerm] = useState<number>(60);
  const [consFeePct, setConsFeePct] = useState<number>(18);
  const [consMonth, setConsMonth] = useState<number>(24);

  const [includeSub, setIncludeSub] = useState(false);
  const [subFee, setSubFee] = useState<number>(2500);

  const [presetName, setPresetName] = useState('');
  const presetsManager = usePresets<VehicleComparisonInput>({
    storageKey: PRESETS_STORAGE_KEY,
    validateInput: isVehicleInput,
  });
  const currentInputValue = currentInput();
  const { result, loading, simulate } = useToolSimulation(
    currentInputValue,
    compareVehicleOptions
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
    if (!result || result.scenarios.length === 0) return [];
    const months = Math.max(...result.scenarios.map((scenario) => scenario.monthly_data.length));
    const rows: Array<Record<string, number | null>> = [];
    for (let index = 0; index < months; index += 1) {
      const row: Record<string, number | null> = { month: index + 1 };
      for (const scenario of result.scenarios) {
        row[scenario.name] = scenario.monthly_data[index]?.net_position ?? null;
      }
      rows.push(row);
    }
    return rows;
  }, [result]);

  const bestScenarioName = useMemo(() => {
    if (!result || result.scenarios.length === 0) return null;
    return result.scenarios.reduce((best, scenario) =>
      scenario.net_cost < best.net_cost ? scenario : best
    ).name;
  }, [result]);

  async function onSimulate() {
    const validationError = firstInputError(validateVehicleInput(currentInputValue));
    if (validationError) {
      notifications.show({ color: 'red', title: 'Revise os dados', message: validationError });
      return;
    }
    try {
      await simulate();
    } catch (caught: unknown) {
      const error = await toApiError(caught);
      notifications.show({ color: 'red', title: 'Erro ao comparar', message: error.message });
    }
  }

  function currentInput(): VehicleComparisonInput {
    return {
      vehicle_price: vehiclePrice,
      horizon_months: horizonMonths,
      annual_depreciation_rate: annualDep,
      annual_inflation_rate: annualInflation ?? null,
      monthly_insurance: monthlyInsurance,
      monthly_maintenance: monthlyMaintenance,
      monthly_fuel: monthlyFuel,
      annual_ipva_percentage: annualIpvaPct,
      include_cash: includeCash,
      financing: includeFin
        ? {
            enabled: true,
            down_payment: finDown,
            term_months: finTerm,
            annual_interest_rate: finAnnualRate,
            loan_type: 'PRICE',
          }
        : { enabled: false },
      consortium: includeCons
        ? {
            enabled: true,
            term_months: consTerm,
            admin_fee_percentage: consFeePct,
            contemplation_month: consMonth,
          }
        : { enabled: false },
      subscription: includeSub
        ? { enabled: true, monthly_fee: subFee }
        : { enabled: false, monthly_fee: 0 },
    };
  }

  function onSavePreset() {
    const name = presetName.trim();
    if (!name) {
      notifications.show({ color: 'yellow', title: 'Nome obrigatório', message: 'Informe um nome para o preset.' });
      return;
    }
    const validationError = firstInputError(validateVehicleInput(currentInputValue));
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
    setVehiclePrice(input.vehicle_price);
    setHorizonMonths(input.horizon_months ?? 60);
    setAnnualDep(input.annual_depreciation_rate ?? 12);
    setAnnualInflation(input.annual_inflation_rate == null ? undefined : input.annual_inflation_rate);

    setMonthlyInsurance(input.monthly_insurance ?? 0);
    setMonthlyMaintenance(input.monthly_maintenance ?? 0);
    setMonthlyFuel(input.monthly_fuel ?? 0);
    setAnnualIpvaPct(input.annual_ipva_percentage ?? 0);

    setIncludeCash(input.include_cash ?? true);

    const financing = input.financing;
    setIncludeFin(!!financing?.enabled);
    if (financing?.enabled) {
      setFinDown(financing.down_payment ?? 0);
      setFinTerm(financing.term_months ?? 48);
      setFinAnnualRate(financing.annual_interest_rate ?? 0);
    }

    const consortium = input.consortium;
    setIncludeCons(!!consortium?.enabled);
    if (consortium?.enabled) {
      setConsTerm(consortium.term_months ?? 60);
      setConsFeePct(consortium.admin_fee_percentage ?? 18);
      setConsMonth(consortium.contemplation_month ?? 24);
    }

    const subscription = input.subscription;
    setIncludeSub(!!subscription?.enabled);
    if (subscription?.enabled) setSubFee(subscription.monthly_fee);

    notifications.show({ color: 'blue', title: 'Preset carregado', message: preset.name });
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
      title="Comparador de veículos"
      description="Compare compra à vista, financiamento, consórcio e assinatura considerando custos de uso, depreciação e obrigações ainda abertas no fim do prazo."
      icon={<IconCar size={24} />}
    >
      <ToolPanel
        title="Configure o veículo e as alternativas"
        description="Os custos comuns valem para as modalidades de compra. Ative somente as opções que você realmente considera."
      >
        <Text fw={650} mb="sm">Veículo e período</Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          <NumberInput
            label="Preço do veículo"
            description="Valor de referência no início da análise"
            value={vehiclePrice}
            onChange={(value) => setVehiclePrice(Number(value) || 0)}
            min={0}
            thousandSeparator="."
            decimalSeparator=","
            prefix="R$ "
          />
          <NumberInput
            label="Horizonte da comparação"
            description="Prazo comum usado em todas as modalidades"
            value={horizonMonths}
            onChange={(value) => setHorizonMonths(Number(value) || 1)}
            min={1}
            max={240}
            suffix=" meses"
          />
        </SimpleGrid>

        <Text fw={650} mt="xl" mb="sm">Custos de uso</Text>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
          <NumberInput
            label="Seguro mensal"
            description="Média mensal do seguro"
            value={monthlyInsurance}
            onChange={(value) => setMonthlyInsurance(Number(value) || 0)}
            min={0}
            prefix="R$ "
            thousandSeparator="."
            decimalSeparator=","
          />
          <NumberInput
            label="Manutenção mensal"
            description="Revisões, pneus e reparos"
            value={monthlyMaintenance}
            onChange={(value) => setMonthlyMaintenance(Number(value) || 0)}
            min={0}
            prefix="R$ "
            thousandSeparator="."
            decimalSeparator=","
          />
          <NumberInput
            label="Combustível mensal"
            description="Uso estimado por mês"
            value={monthlyFuel}
            onChange={(value) => setMonthlyFuel(Number(value) || 0)}
            min={0}
            prefix="R$ "
            thousandSeparator="."
            decimalSeparator=","
          />
          <NumberInput
            label="IPVA anual"
            description="Percentual sobre o valor do veículo"
            value={annualIpvaPct}
            onChange={(value) => setAnnualIpvaPct(Number(value) || 0)}
            min={0}
            max={50}
            suffix="%"
          />
        </SimpleGrid>

        <Accordion variant="separated" radius="lg" mt="lg">
          <Accordion.Item value="assumptions">
            <Accordion.Control icon={<IconAdjustments size={18} />}>
              <Text fw={650}>Premissas de valor</Text>
              <Text size="sm" c="dimmed">Depreciação do veículo e inflação dos custos</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                <NumberInput
                  label="Depreciação anual"
                  description="Redução estimada do valor de revenda"
                  value={annualDep}
                  onChange={(value) => setAnnualDep(Number(value) || 0)}
                  min={0}
                  max={100}
                  suffix="% a.a."
                />
                <NumberInput
                  label="Inflação anual dos custos"
                  description="Reajusta seguro, manutenção e combustível"
                  value={annualInflation}
                  onChange={(value) => setAnnualInflation(value === '' || value == null ? undefined : Number(value))}
                  min={-100}
                  max={1000}
                  step={0.5}
                  suffix="% a.a."
                />
              </SimpleGrid>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>

        <Text fw={650} mt="xl" mb="sm">Modalidades comparadas</Text>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <Paper withBorder radius="lg" p="md">
            <Switch
              label="Compra à vista"
              description="Pagamento integral no primeiro mês"
              checked={includeCash}
              onChange={(event) => setIncludeCash(event.currentTarget.checked)}
              size="md"
              styles={{ body: { minHeight: 44 } }}
            />
          </Paper>

          <Paper withBorder radius="lg" p="md">
            <Switch
              label="Financiamento"
              description="Entrada e parcelas pelo sistema PRICE"
              checked={includeFin}
              onChange={(event) => setIncludeFin(event.currentTarget.checked)}
              size="md"
              styles={{ body: { minHeight: 44 } }}
            />
            <Collapse in={includeFin}>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" mt="md">
                <NumberInput
                  label="Entrada"
                  value={finDown}
                  onChange={(value) => setFinDown(Number(value) || 0)}
                  min={0}
                  max={vehiclePrice}
                  prefix="R$ "
                  thousandSeparator="."
                  decimalSeparator=","
                />
                <NumberInput
                  label="Prazo"
                  value={finTerm}
                  onChange={(value) => setFinTerm(Number(value) || 1)}
                  min={1}
                  max={120}
                  suffix=" meses"
                />
                <NumberInput
                  label="Juros anuais"
                  value={finAnnualRate}
                  onChange={(value) => setFinAnnualRate(Number(value) || 0)}
                  min={0}
                  max={1000}
                  suffix="% a.a."
                />
              </SimpleGrid>
            </Collapse>
          </Paper>

          <Paper withBorder radius="lg" p="md">
            <Switch
              label="Consórcio"
              description="Parcelas, taxa administrativa e contemplação estimada"
              checked={includeCons}
              onChange={(event) => setIncludeCons(event.currentTarget.checked)}
              size="md"
              styles={{ body: { minHeight: 44 } }}
            />
            <Collapse in={includeCons}>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" mt="md">
                <NumberInput
                  label="Prazo"
                  value={consTerm}
                  onChange={(value) => setConsTerm(Number(value) || 1)}
                  min={1}
                  max={120}
                  suffix=" meses"
                />
                <NumberInput
                  label="Taxa administrativa"
                  value={consFeePct}
                  onChange={(value) => setConsFeePct(Number(value) || 0)}
                  min={0}
                  max={200}
                  suffix="%"
                />
                <NumberInput
                  label="Mês da contemplação"
                  value={consMonth}
                  onChange={(value) => setConsMonth(Number(value) || 1)}
                  min={1}
                  max={consTerm}
                />
              </SimpleGrid>
            </Collapse>
          </Paper>

          <Paper withBorder radius="lg" p="md">
            <Switch
              label="Assinatura"
              description="Mensalidade com seguro, manutenção e tributos incluídos"
              checked={includeSub}
              onChange={(event) => setIncludeSub(event.currentTarget.checked)}
              size="md"
              styles={{ body: { minHeight: 44 } }}
            />
            <Collapse in={includeSub}>
              <NumberInput
                label="Mensalidade"
                description="O combustível é somado à mensalidade"
                value={subFee}
                onChange={(value) => setSubFee(Number(value) || 0)}
                min={0}
                prefix="R$ "
                thousandSeparator="."
                decimalSeparator=","
                mt="md"
              />
            </Collapse>
          </Paper>
        </SimpleGrid>

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
            Comparar modalidades
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
        placeholder="Ex.: Hatch de R$ 80 mil"
        maxNameLength={MAX_PRESET_NAME_LENGTH}
        renderSummary={(preset) => (
          <>
            Preço: {money(preset.input.vehicle_price)} · Horizonte:{' '}
            {preset.input.horizon_months ?? 60} meses
          </>
        )}
      />

      {result && (
        <ToolResults
          title="Compare o custo econômico completo"
          description="Menor custo líquido não significa necessariamente a melhor escolha pessoal, mas mostra o efeito financeiro de cada modalidade no mesmo horizonte."
        >
          {bestScenarioName && (
            <Alert color="teal" variant="light">
              <Text fw={650}>{bestScenarioName} apresenta o menor custo líquido nesta simulação.</Text>
              <Text size="sm" mt={3}>
                Considere também liquidez, previsibilidade, risco de crédito e sua necessidade de uso imediato.
              </Text>
            </Alert>
          )}

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            {result.scenarios.map((scenario) => {
              const isBest = scenario.name === bestScenarioName;
              return (
                <ToolMetricCard
                  key={scenario.name}
                  label={`${scenario.name}${isBest ? ' · menor custo' : ''}`}
                  value={money(scenario.net_cost)}
                  tone={isBest ? 'positive' : 'default'}
                  detail={
                    <>
                      Saídas: {money(scenario.total_outflows)} · Ativo final:{' '}
                      {money(scenario.final_asset_value)} · Saldo devedor:{' '}
                      {money(scenario.final_outstanding_liability ?? 0)}
                    </>
                  }
                />
              );
            })}
          </SimpleGrid>

          <Paper withBorder radius="xl" p={{ base: 'md', sm: 'xl' }}>
            <Text fw={650} size="lg">Posição líquida ao longo do tempo</Text>
            <Text size="sm" c="dimmed" mt={4} mb="lg">
              Valor do ativo menos saldo devedor e saídas acumuladas. Quanto mais alta a linha, melhor a posição líquida naquele mês.
            </Text>
            <Box role="img" aria-label="Gráfico da posição líquida das modalidades de veículo">
              <LineChart
                h={340}
                data={chartData}
                dataKey="month"
                series={result.scenarios.map((scenario, index) => ({
                  name: scenario.name,
                  color: ['ocean.6', 'teal.5', 'violet.5', 'rose.5'][index % 4],
                }))}
                curveType="monotone"
                gridAxis="xy"
                withLegend
                valueFormatter={(value) => money(value)}
                xAxisProps={{ tickMargin: 10 }}
                yAxisProps={{ tickMargin: 10, tickFormatter: (value) => moneyCompact(value as number) }}
                tooltipAnimationDuration={150}
              />
            </Box>
            <Text size="xs" c="dimmed" mt="sm">
              O custo líquido final incorpora obrigações ainda não quitadas; por isso, prazos maiores que o horizonte não desaparecem da comparação.
            </Text>
          </Paper>
        </ToolResults>
      )}
    </ToolPageShell>
  );
}
