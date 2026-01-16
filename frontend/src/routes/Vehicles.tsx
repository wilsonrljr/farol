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
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { LineChart } from '@mantine/charts';
import { compareVehicleOptions } from '../api/toolsApi';
import type { VehicleComparisonInput, VehicleComparisonResult } from '../api/types';
import { money, moneyCompact } from '../utils/format';
import { loadPresets, newPresetId, savePresets, type Preset } from '../utils/presets';

type VehiclesPreset = Preset<VehicleComparisonInput>;
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

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VehicleComparisonResult | null>(null);

  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState<VehiclesPreset[]>(() => loadPresets(PRESETS_STORAGE_KEY));

  const chartData = useMemo(() => {
    if (!result) return [];
    // Plot net position for each scenario
    const months = Math.max(...result.scenarios.map((s) => s.monthly_data.length));
    const rows: any[] = [];
    for (let i = 0; i < months; i++) {
      const row: any = { month: i + 1 };
      for (const s of result.scenarios) {
        row[s.name] = s.monthly_data[i]?.net_position ?? null;
      }
      rows.push(row);
    }
    return rows;
  }, [result]);

  async function onSimulate() {
    setLoading(true);
    try {
      const data = await compareVehicleOptions(currentInput());
      setResult(data);
    } catch (e: any) {
      notifications.show({ color: 'red', title: 'Erro ao comparar', message: String(e) });
    } finally {
      setLoading(false);
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
      subscription: includeSub ? { enabled: true, monthly_fee: subFee } : { enabled: false, monthly_fee: 0 },
    };
  }

  function onSavePreset() {
    const name = presetName.trim();
    if (!name) {
      notifications.show({ color: 'yellow', title: 'Nome obrigatório', message: 'Informe um nome para o preset.' });
      return;
    }
    const next: VehiclesPreset[] = [
      { id: newPresetId(), name, createdAt: Date.now(), input: currentInput() },
      ...presets,
    ];
    setPresets(next);
    savePresets(PRESETS_STORAGE_KEY, next);
    setPresetName('');
    notifications.show({ color: 'green', title: 'Preset salvo', message: `“${name}”` });
  }

  function onLoadPreset(p: VehiclesPreset) {
    const i = p.input;
    setVehiclePrice(i.vehicle_price);
    setHorizonMonths(i.horizon_months ?? 60);
    setAnnualDep(i.annual_depreciation_rate ?? 12);
    setAnnualInflation(i.annual_inflation_rate == null ? undefined : i.annual_inflation_rate);

    setMonthlyInsurance(i.monthly_insurance ?? 0);
    setMonthlyMaintenance(i.monthly_maintenance ?? 0);
    setMonthlyFuel(i.monthly_fuel ?? 0);
    setAnnualIpvaPct(i.annual_ipva_percentage ?? 0);

    setIncludeCash(i.include_cash ?? true);

    const fin = i.financing;
    setIncludeFin(!!fin?.enabled);
    if (fin?.enabled) {
      setFinDown(fin.down_payment ?? 0);
      setFinTerm(fin.term_months ?? 48);
      setFinAnnualRate(fin.annual_interest_rate ?? 0);
    }

    const cons = i.consortium;
    setIncludeCons(!!cons?.enabled);
    if (cons?.enabled) {
      setConsTerm(cons.term_months ?? 60);
      setConsFeePct(cons.admin_fee_percentage ?? 18);
      setConsMonth(cons.contemplation_month ?? 24);
    }

    const sub = i.subscription;
    setIncludeSub(!!sub?.enabled);
    if (sub?.enabled) {
      setSubFee(sub.monthly_fee);
    }

    notifications.show({ color: 'blue', title: 'Preset carregado', message: p.name });
  }

  function onDeletePreset(id: string) {
    const next = presets.filter((p) => p.id !== id);
    setPresets(next);
    savePresets(PRESETS_STORAGE_KEY, next);
  }

  function onClearPresets() {
    const next: VehiclesPreset[] = [];
    setPresets(next);
    savePresets(PRESETS_STORAGE_KEY, next);
    notifications.show({ color: 'green', title: 'Presets removidos', message: 'Todos os presets foram apagados.' });
  }

  return (
    <Container size="lg" py="xl">
      <Box mb="lg">
        <Title order={2} fw={700} mb={6}>
          Veículos
        </Title>
        <Text c="dimmed">Compare modalidades (à vista, financiamento, consórcio, assinatura) em um horizonte fixo.</Text>
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
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
          <NumberInput
            label="Preço do veículo"
            value={vehiclePrice}
            onChange={(v) => setVehiclePrice(Number(v) || 0)}
            min={0}
            thousandSeparator="."
            decimalSeparator="," 
            prefix="R$ "
          />
          <NumberInput label="Horizonte (meses)" value={horizonMonths} onChange={(v) => setHorizonMonths(Number(v) || 1)} min={1} max={240} />
          <NumberInput label="Depreciação anual" value={annualDep} onChange={(v) => setAnnualDep(Number(v) || 0)} min={0} max={100} suffix="% a.a." />

          <NumberInput label="Inflação anual (custos)" value={annualInflation} onChange={(v) => setAnnualInflation(v === '' || v == null ? undefined : Number(v))} step={0.5} suffix="% a.a." />
          <NumberInput label="Seguro (mês)" value={monthlyInsurance} onChange={(v) => setMonthlyInsurance(Number(v) || 0)} min={0} prefix="R$ " thousandSeparator="." decimalSeparator="," />
          <NumberInput label="Manutenção (mês)" value={monthlyMaintenance} onChange={(v) => setMonthlyMaintenance(Number(v) || 0)} min={0} prefix="R$ " thousandSeparator="." decimalSeparator="," />
          <NumberInput label="Combustível (mês)" value={monthlyFuel} onChange={(v) => setMonthlyFuel(Number(v) || 0)} min={0} prefix="R$ " thousandSeparator="." decimalSeparator="," />
          <NumberInput label="IPVA (anual)" value={annualIpvaPct} onChange={(v) => setAnnualIpvaPct(Number(v) || 0)} min={0} max={50} suffix="%" />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" mt="lg">
          <Box
            p="md"
            style={{
              background: 'light-dark(rgba(255, 255, 255, 0.5), rgba(15, 23, 42, 0.5))',
              borderRadius: 'var(--mantine-radius-lg)',
              boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.08)',
            }}
          >
            <Group justify="space-between" mb="xs">
              <Text fw={600}>À vista</Text>
              <Switch checked={includeCash} onChange={(e) => setIncludeCash(e.currentTarget.checked)} />
            </Group>
            <Text size="sm" c="dimmed">Compra no mês 1 e assume custos/dep.</Text>
          </Box>

          <Box
            p="md"
            style={{
              background: 'light-dark(rgba(255, 255, 255, 0.5), rgba(15, 23, 42, 0.5))',
              borderRadius: 'var(--mantine-radius-lg)',
              boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.08)',
            }}
          >
            <Group justify="space-between" mb="xs">
              <Text fw={600}>Financiamento</Text>
              <Switch checked={includeFin} onChange={(e) => setIncludeFin(e.currentTarget.checked)} />
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <NumberInput label="Entrada" value={finDown} onChange={(v) => setFinDown(Number(v) || 0)} min={0} prefix="R$ " thousandSeparator="." decimalSeparator="," />
              <NumberInput label="Prazo" value={finTerm} onChange={(v) => setFinTerm(Number(v) || 1)} min={1} max={120} />
              <NumberInput label="Taxa anual" value={finAnnualRate} onChange={(v) => setFinAnnualRate(Number(v) || 0)} min={-100} suffix="% a.a." />
            </SimpleGrid>
          </Box>

          <Box
            p="md"
            style={{
              background: 'light-dark(rgba(255, 255, 255, 0.5), rgba(15, 23, 42, 0.5))',
              borderRadius: 'var(--mantine-radius-lg)',
              boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.08)',
            }}
          >
            <Group justify="space-between" mb="xs">
              <Text fw={600}>Consórcio</Text>
              <Switch checked={includeCons} onChange={(e) => setIncludeCons(e.currentTarget.checked)} />
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <NumberInput label="Prazo" value={consTerm} onChange={(v) => setConsTerm(Number(v) || 1)} min={1} max={120} />
              <NumberInput label="Taxa adm." value={consFeePct} onChange={(v) => setConsFeePct(Number(v) || 0)} min={0} max={200} suffix="%" />
              <NumberInput label="Contemplação" value={consMonth} onChange={(v) => setConsMonth(Number(v) || 1)} min={1} max={consTerm} />
            </SimpleGrid>
          </Box>

          <Box
            p="md"
            style={{
              background: 'light-dark(rgba(255, 255, 255, 0.5), rgba(15, 23, 42, 0.5))',
              borderRadius: 'var(--mantine-radius-lg)',
              boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.08)',
            }}
          >
            <Group justify="space-between" mb="xs">
              <Text fw={600}>Assinatura</Text>
              <Switch checked={includeSub} onChange={(e) => setIncludeSub(e.currentTarget.checked)} />
            </Group>
            <NumberInput label="Mensalidade" value={subFee} onChange={(v) => setSubFee(Number(v) || 0)} min={0} prefix="R$ " thousandSeparator="." decimalSeparator="," />
          </Box>
        </SimpleGrid>

        <Group justify="flex-end" mt="lg">
          <Button color="ocean" radius="xl" loading={loading} onClick={onSimulate}>
            Comparar
          </Button>
        </Group>

        <Box mt="lg">
          <Text fw={600} mb="xs">Presets</Text>
          <Group align="flex-end" wrap="wrap">
            <TextInput
              label="Nome do preset"
              placeholder="Ex.: Carro 80k (fin 48m, 22% a.a.)"
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
                        Preço: {money(p.input.vehicle_price)} · Horizonte: {p.input.horizon_months ?? 60} meses
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

      {result && (
        <Box mt="xl">
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg" mb="lg">
            {result.scenarios.map((s) => (
              <Box
                key={s.name}
                p="lg"
                style={{
                  background: 'var(--glass-bg)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  boxShadow: 'var(--glass-shadow), var(--glass-shadow-glow)',
                  borderRadius: 'var(--mantine-radius-xl)',
                }}
              >
                <Text size="sm" c="dimmed">{s.name}</Text>
                <Text fw={700} size="lg">Custo líquido</Text>
                <Text fw={700} size="xl">{money(s.net_cost)}</Text>
                <Text size="sm" c="dimmed" mt={6}>
                  Saídas: {money(s.total_outflows)} · Ativo final: {money(s.final_asset_value)}
                </Text>
              </Box>
            ))}
          </SimpleGrid>

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
            <Text fw={600} size="lg" mb="sm">Posição líquida ao longo do tempo</Text>
            <LineChart
              h={340}
              data={chartData}
              dataKey="month"
              series={result.scenarios.map((s, i) => ({
                name: s.name,
                color: ['ocean.6', 'teal.5', 'violet.5', 'rose.5'][i % 4],
              }))}
              curveType="monotone"
              gridAxis="xy"
              withLegend
              valueFormatter={(value) => money(value)}
              xAxisProps={{ tickMargin: 10 }}
              yAxisProps={{ tickMargin: 10, tickFormatter: (v) => moneyCompact(v as number) }}
              tooltipAnimationDuration={150}
            />
            <Text size="xs" c="dimmed" mt="sm">
              Posição líquida = valor do ativo − saídas acumuladas (simplificado).
            </Text>
          </Box>
        </Box>
      )}
    </Container>
  );
}
