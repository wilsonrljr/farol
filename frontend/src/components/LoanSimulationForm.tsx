import { useState } from 'react';
import { Button, NumberInput, Select, Switch, Paper, Stack, Group, Divider, SimpleGrid, Text, SegmentedControl, Grid } from '@mantine/core';
import { useForm } from '@mantine/form';
import { simulateLoan } from '../api/financeApi';
import { LoanSimulationInput, LoanSimulationResult } from '../api/types';
import { useApi } from '../hooks/useApi';
import AmortizationsFieldArray from './AmortizationsFieldArray';
import { notifications } from '@mantine/notifications';
import LoanResults from './LoanResults';
import { BadgeCard } from './cards/BadgeCard';
import { FeaturesCard } from './cards/FeaturesCard';
import { CardWithStats } from './cards/CardWithStats';
// Removed pie/ring usage
import { IconArrowsShuffle, IconCash, IconBolt } from '@tabler/icons-react';

export default function LoanSimulationForm() {
  const form = useForm<LoanSimulationInput>({
    initialValues: {
      property_value: 500000,
      down_payment: 100000,
      loan_term_years: 30,
      annual_interest_rate: 10,
      monthly_interest_rate: null,
      loan_type: 'PRICE',
      amortizations: [],
      inflation_rate: 4,
      rent_inflation_rate: null,
      property_appreciation_rate: null,
      additional_costs: { itbi_percentage: 2, deed_percentage: 1, monthly_hoa: 0, monthly_property_tax: 0 }
    }
  });

  const { data, loading, call } = useApi(simulateLoan);
  const [showAdvanced, setShowAdvanced] = useState(false);

  async function onSubmit(values: LoanSimulationInput) {
    try {
      const res = await call(values);
      notifications.show({ title: 'Simulação concluída', message: 'Resultados disponíveis', color: 'green' });
      return res;
    } catch (e: any) {
      notifications.show({ title: 'Erro', message: e.toString(), color: 'red' });
    }
  }

  const [layout, setLayout] = useState<'split' | 'stack'>('split');

  const formEl = (
    <Paper withBorder p="md" radius="md" shadow="sm" style={layout==='split'?{position:'sticky', top:70}:{}}>
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack gap="sm">
              <NumberInput label="Valor do Imóvel" min={0} required {...form.getInputProps('property_value')} thousandSeparator />
              <NumberInput label="Entrada" min={0} required {...form.getInputProps('down_payment')} thousandSeparator />
              <NumberInput label="Prazo (anos)" min={1} required {...form.getInputProps('loan_term_years')} />
              <Select label="Sistema" data={[{value:'SAC', label:'SAC'}, {value:'PRICE', label:'PRICE'}]} {...form.getInputProps('loan_type')} />
              <Group grow>
                <NumberInput label="Juros Anual %" {...form.getInputProps('annual_interest_rate')} />
                <NumberInput label="Juros Mensal %" {...form.getInputProps('monthly_interest_rate')} />
              </Group>
              <Switch label="Mostrar opções avançadas" checked={showAdvanced} onChange={(e)=>setShowAdvanced(e.currentTarget.checked)} />
              {showAdvanced && (
                <Stack gap="sm">
                  <Divider label="Custos Adicionais" />
                  <Group grow>
                    <NumberInput label="ITBI %" {...form.getInputProps('additional_costs.itbi_percentage')} />
                    <NumberInput label="Escritura %" {...form.getInputProps('additional_costs.deed_percentage')} />
                  </Group>
                  <Group grow>
                    <NumberInput label="Condomínio (R$)" {...form.getInputProps('additional_costs.monthly_hoa')} thousandSeparator />
                    <NumberInput label="IPTU (R$)" {...form.getInputProps('additional_costs.monthly_property_tax')} thousandSeparator />
                  </Group>
                  <Divider label="Inflação / Valorização" />
                  <Group grow>
                    <NumberInput label="Inflação % a.a." {...form.getInputProps('inflation_rate')} />
                    <NumberInput label="Inflação Aluguel % a.a." {...form.getInputProps('rent_inflation_rate')} />
                    <NumberInput label="Valorização % a.a." {...form.getInputProps('property_appreciation_rate')} />
                  </Group>
                  <AmortizationsFieldArray termMonths={(form.values.loan_term_years||0)*12} value={form.values.amortizations || []} onChange={(v)=>form.setFieldValue('amortizations', v)} />
                </Stack>
              )}
              <Button type="submit" loading={loading}>Simular</Button>
        </Stack>
      </form>
    </Paper>
  );

  const emptyState = (
    <Stack gap="md">
      <Text size="sm" c="dimmed">Preencha os parâmetros e clique em Simular para ver resultados detalhados. Enquanto isso, alguns destaques:</Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <BadgeCard icon={<IconArrowsShuffle size={18} />} color="indigo" title="SAC vs PRICE" description="Compare parcelas decrescentes (SAC) com fixas (PRICE)." badges={["Amortização", "Juros"]} />
        <BadgeCard icon={<IconBolt size={18} />} color="teal" title="Amortizações Extra" description="Reduza o prazo ou juros totais adicionando aportes estratégicos." badges={["Aportes", "Redução"]} />
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <CardWithStats title="Exemplo (mock)" subtitle="Parcela inicial" stats={[{ label: 'Parcela', value: 'R$ 4.500' }, { label: 'Juros', value: 'R$ 3.000' }, { label: 'Amort.', value: 'R$ 1.500' }]} progress={{ value: 66, label: 'Juros %', color: 'red' }} />
        <CardWithStats title="Meta" subtitle="Redução de juros" stats={[{ label: 'Aporte anual', value: 'R$ 10k' }, { label: 'Prazo -', value: '3 anos' }, { label: 'Juros -', value: 'R$ 40k' }]} />
      </SimpleGrid>
      <FeaturesCard title="Dicas" features={["Teste diferentes taxas", "Aumente entrada", "Use amortizações", "Avalie inflação"]} />
    </Stack>
  );

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text fw={600}>Simulação</Text>
        <SegmentedControl size="xs" value={layout} onChange={(v)=>setLayout(v as any)} data={[{label:'Lado a lado', value:'split'},{label:'Empilhado', value:'stack'}]} />
      </Group>
      {layout === 'split' ? (
        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 5 }}>{formEl}</Grid.Col>
          <Grid.Col span={{ base: 12, md: 7 }}>
            {data ? <LoanResults result={data as LoanSimulationResult} /> : emptyState}
          </Grid.Col>
        </Grid>
      ) : (
        <Stack gap="xl">
          {formEl}
          {data ? <LoanResults result={data as LoanSimulationResult} /> : emptyState}
        </Stack>
      )}
    </Stack>
  );
}
