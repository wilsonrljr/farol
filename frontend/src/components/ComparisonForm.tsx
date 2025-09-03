import { useState } from 'react';
import { Button, NumberInput, Select, Switch, Paper, Stack, Group, Divider, Checkbox, SimpleGrid, Text, SegmentedControl, Grid, Tooltip } from '@mantine/core';
import { useForm } from '@mantine/form';
import { compareScenarios } from '../api/financeApi';
import { ComparisonInput, ComparisonResult, EnhancedComparisonResult } from '../api/types';
import { useApi } from '../hooks/useApi';
import AmortizationsFieldArray from './AmortizationsFieldArray';
import InvestmentReturnsFieldArray from './InvestmentReturnsFieldArray';
import { notifications } from '@mantine/notifications';
import ComparisonResults from './ComparisonResults';
import EnhancedComparisonResults from './EnhancedComparisonResults';
import { BadgeCard } from './cards/BadgeCard';
import { CardWithStats } from './cards/CardWithStats';
import { FeaturesCard } from './cards/FeaturesCard';
import { IconBuildingBank, IconChartLine, IconArrowsShuffle } from '@tabler/icons-react';

export default function ComparisonForm() {
  const form = useForm<ComparisonInput>({
    initialValues: {
      property_value: 500000,
      down_payment: 100000,
      loan_term_years: 30,
      annual_interest_rate: 10,
      monthly_interest_rate: null,
      loan_type: 'PRICE',
      rent_value: 2000,
      rent_percentage: null,
      investment_returns: [{ start_month: 1, end_month: null, annual_rate: 8 }],
      amortizations: [],
      inflation_rate: 4,
      rent_inflation_rate: 5,
      property_appreciation_rate: 4,
      invest_loan_difference: false,
      fixed_monthly_investment: 0,
  fixed_investment_start_month: 1,
  rent_reduces_investment: false,
    }
  });

  const { data, loading, call } = useApi< [ComparisonInput, boolean], ComparisonResult | EnhancedComparisonResult>(async (input: ComparisonInput, enhanced: boolean) => compareScenarios(input, enhanced));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [enhanced, setEnhanced] = useState(true);

  async function onSubmit(values: ComparisonInput) {
    try {
      const res = await call(values, enhanced);
      notifications.show({ title: 'Comparação pronta', message: 'Resultados disponíveis', color: 'green' });
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
          <Group grow>
            <NumberInput label="Valor do Imóvel" min={0} required {...form.getInputProps('property_value')} thousandSeparator />
            <NumberInput label="Entrada" min={0} required {...form.getInputProps('down_payment')} thousandSeparator />
            <NumberInput label="Prazo (anos)" min={1} required {...form.getInputProps('loan_term_years')} />
          </Group>
          <Group grow>
            <NumberInput label="Aluguel (R$)" {...form.getInputProps('rent_value')} thousandSeparator />
            <NumberInput label="% Aluguel / Valor" {...form.getInputProps('rent_percentage')} />
            <Select label="Sistema" data={[{value:'SAC', label:'SAC'}, {value:'PRICE', label:'PRICE'}]} {...form.getInputProps('loan_type')} />
          </Group>
            <Group grow>
              <NumberInput label="Juros Anual %" {...form.getInputProps('annual_interest_rate')} />
              <NumberInput label="Juros Mensal %" {...form.getInputProps('monthly_interest_rate')} />
            </Group>
          <InvestmentReturnsFieldArray value={form.values.investment_returns} onChange={(v)=>form.setFieldValue('investment_returns', v)} />
          <Group justify="space-between" align="center">
            <Switch label="Mostrar avançado" checked={showAdvanced} onChange={(e)=>setShowAdvanced(e.currentTarget.checked)} />
            <Switch label="Métricas avançadas" checked={enhanced} onChange={(e)=>setEnhanced(e.currentTarget.checked)} />
          </Group>
          {showAdvanced && (
            <Stack gap="sm">
              <Divider label="Parâmetros adicionais" />
              <Group grow>
                <NumberInput label="Inflação % a.a." {...form.getInputProps('inflation_rate')} />
                <NumberInput label="Inflação Aluguel % a.a." {...form.getInputProps('rent_inflation_rate')} />
                <NumberInput label="Valorização % a.a." {...form.getInputProps('property_appreciation_rate')} />
              </Group>
              <Checkbox label="Investir diferença de parcela vs aluguel" {...form.getInputProps('invest_loan_difference', { type: 'checkbox' })} />
              <Tooltip label="Se marcado, o aluguel e custos mensais são pagos retirando do saldo investido antes do rendimento. Caso contrário assumimos que o aluguel vem de renda externa e o capital fica intacto." multiline w={260} position="top-start" withArrow>
                <Checkbox mt={4} label="Aluguel consome investimento" {...form.getInputProps('rent_reduces_investment', { type: 'checkbox' })} />
              </Tooltip>
              <Group grow>
                <NumberInput label="Aporte Mensal Fixo" {...form.getInputProps('fixed_monthly_investment')} thousandSeparator />
                <NumberInput label="Início Aporte (mês)" {...form.getInputProps('fixed_investment_start_month')} />
              </Group>
              <AmortizationsFieldArray
                value={form.values.amortizations || []}
                onChange={(v)=>form.setFieldValue('amortizations', v)}
                inflationRate={form.values.inflation_rate || undefined}
                termMonths={form.values.loan_term_years * 12}
              />
            </Stack>
          )}
          <Button type="submit" loading={loading}>Comparar Cenários</Button>
        </Stack>
      </form>
    </Paper>
  );

  const emptyState = (
    <Stack gap="md">
      <Text size="sm" c="dimmed">Configure os parâmetros e compare os três caminhos possíveis. Insights iniciais:</Text>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <BadgeCard icon={<IconBuildingBank size={18} />} color="indigo" title="Comprar" description="Construção de equity desde o primeiro mês." badges={["Equity", "Juros"]} />
        <BadgeCard icon={<IconChartLine size={18} />} color="teal" title="Alugar + Investir" description="Liquidez e potencial de retorno sobre o capital." badges={["Liquidez", "ROI"]} />
        <BadgeCard icon={<IconArrowsShuffle size={18} />} color="orange" title="Investir e Comprar" description="Sincronia entre valorização e acumulação de capital." badges={["Timing", "Aportes"]} />
      </SimpleGrid>
      <CardWithStats title="Exemplo (mock)" stats={[{ label: 'Comprar', value: 'R$ 820k' }, { label: 'Alugar', value: 'R$ 780k' }, { label: 'Investir', value: 'R$ 805k' }]} progress={{ value: 52, label: 'Melhor vs Médio %', color: 'teal' }} />
      <FeaturesCard title="Estratégias" features={["Aportes fixos", "Diferença de parcelas", "Valorização do imóvel", "Inflação diferenciada"]} />
    </Stack>
  );

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text fw={600}>Comparação</Text>
        <SegmentedControl size="xs" value={layout} onChange={(v)=>setLayout(v as any)} data={[{label:'Lado a lado', value:'split'},{label:'Empilhado', value:'stack'}]} />
      </Group>
      {layout === 'split' ? (
        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 5 }}>{formEl}</Grid.Col>
          <Grid.Col span={{ base: 12, md: 7 }}>
            {data ? (enhanced ? <EnhancedComparisonResults result={data as EnhancedComparisonResult} /> : <ComparisonResults result={data as ComparisonResult} />) : emptyState}
          </Grid.Col>
        </Grid>
      ) : (
        <Stack gap="xl">
          {formEl}
          {data ? (enhanced ? <EnhancedComparisonResults result={data as EnhancedComparisonResult} /> : <ComparisonResults result={data as ComparisonResult} />) : emptyState}
        </Stack>
      )}
    </Stack>
  );
}
