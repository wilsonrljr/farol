import { useState } from 'react';
import { Button, NumberInput, Select, Switch, Paper, Stack, Group, Divider, Checkbox, SimpleGrid, Text, SegmentedControl, Grid, Tooltip, Title, Accordion } from '@mantine/core';
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
import { LabelWithHelp } from './LabelWithHelp';

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
      monthly_external_savings: 0,
      invest_external_surplus: false,

      fgts: {
        initial_balance: 0,
        monthly_contribution: 0,
        annual_yield_rate: 0,
        use_at_purchase: true,
        max_withdrawal_at_purchase: null,
      },
      investment_tax: {
        enabled: false,
        effective_tax_rate: 15,
      },
    }
  });

  const { data, loading, call } = useApi< [ComparisonInput, boolean], ComparisonResult | EnhancedComparisonResult>(async (input: ComparisonInput, enhanced: boolean) => compareScenarios(input, enhanced));
  const [lastInput, setLastInput] = useState<ComparisonInput | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [enhanced, setEnhanced] = useState(true);

  async function onSubmit(values: ComparisonInput) {
    try {
      setLastInput(values);
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
        <Stack gap="md">
          <div>
            <Title order={4}>Premissas</Title>
            <Text size="xs" c="dimmed">Base do imóvel e do financiamento. Mantém o resto consistente.</Text>
          </div>

          <Grid gutter="sm">
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <NumberInput label="Valor do Imóvel" min={0} required {...form.getInputProps('property_value')} thousandSeparator />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <NumberInput label="Entrada" min={0} required {...form.getInputProps('down_payment')} thousandSeparator />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <NumberInput label="Prazo (anos)" min={1} required {...form.getInputProps('loan_term_years')} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select label="Sistema" data={[{value:'SAC', label:'SAC'}, {value:'PRICE', label:'PRICE'}]} {...form.getInputProps('loan_type')} />
            </Grid.Col>
          </Grid>

          <Divider label="Juros" />
          <Grid gutter="sm">
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <NumberInput label="Juros Anual (%)" {...form.getInputProps('annual_interest_rate')} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <NumberInput label="Juros Mensal (%)" {...form.getInputProps('monthly_interest_rate')} />
            </Grid.Col>
          </Grid>

          <Divider label="Aluguel e Investimento" />
          <Grid gutter="sm">
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <NumberInput label="Aluguel (R$)" {...form.getInputProps('rent_value')} thousandSeparator />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <NumberInput label="Aluguel / Valor (%)" {...form.getInputProps('rent_percentage')} />
            </Grid.Col>
          </Grid>
          <InvestmentReturnsFieldArray value={form.values.investment_returns} onChange={(v)=>form.setFieldValue('investment_returns', v)} />

          <Group justify="space-between" align="center" wrap="wrap" gap="sm">
            <Switch label="Opções avançadas" checked={showAdvanced} onChange={(e)=>setShowAdvanced(e.currentTarget.checked)} />
            <Switch label="Métricas avançadas" checked={enhanced} onChange={(e)=>setEnhanced(e.currentTarget.checked)} />
          </Group>

          {showAdvanced && (
            <Stack gap="sm">
              <Divider label="Avançado" />

              <Accordion variant="separated" radius="md">
                <Accordion.Item value="macro">
                  <Accordion.Control>Inflação e valorização</Accordion.Control>
                  <Accordion.Panel>
                    <Grid gutter="sm" align="flex-end">
                      <Grid.Col span={{ base: 12, sm: 4 }}>
                        <LabelWithHelp
                          label="Inflação Geral (% a.a.)"
                          help="Taxa anual média usada para atualizar custos ao longo do tempo (composta mês a mês)."
                        />
                        <NumberInput mt={4} {...form.getInputProps('inflation_rate')} />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 4 }}>
                        <LabelWithHelp
                          label="Inflação do Aluguel (% a.a.)"
                          help="Reajuste do aluguel. Use se for diferente da inflação geral."
                        />
                        <NumberInput mt={4} {...form.getInputProps('rent_inflation_rate')} />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 4 }}>
                        <LabelWithHelp
                          label="Valorização do Imóvel (% a.a.)"
                          help="Estimativa anual de valorização do imóvel (impacta o cenário de comprar depois)."
                        />
                        <NumberInput mt={4} {...form.getInputProps('property_appreciation_rate')} />
                      </Grid.Col>
                    </Grid>
                  </Accordion.Panel>
                </Accordion.Item>

                <Accordion.Item value="strategy">
                  <Accordion.Control>Estratégia de investimento (diferença, aportes e renda externa)</Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="xs">
                      <Checkbox label="Investir diferença de parcela vs aluguel" {...form.getInputProps('invest_loan_difference', { type: 'checkbox' })} />
                      <Tooltip
                        label="Se marcado, o aluguel e custos mensais são pagos retirando do saldo investido antes do rendimento. Caso contrário assumimos que o aluguel vem de renda externa e o capital fica intacto."
                        multiline
                        w={300}
                        position="top-start"
                        withArrow
                      >
                        <Checkbox label="Aluguel consome investimento" {...form.getInputProps('rent_reduces_investment', { type: 'checkbox' })} />
                      </Tooltip>

                      <Grid gutter="sm" align="flex-end">
                        <Grid.Col span={{ base: 12, sm: 8 }}>
                          <LabelWithHelp
                            label="Renda Externa p/ Custos (R$/mês)"
                            help={`Valor mensal externo usado primeiro para pagar aluguel e custos (condomínio/IPTU).
Se 0:
 - Se 'Aluguel consome investimento' estiver DESMARCADO: aluguel é pago fora e não reduz investimentos.
 - Se MARCADO: aluguel/custos saem do saldo investido.
Se maior que custos, a sobra pode ser investida se marcado 'Investir sobra externa'.`}
                          />
                          <NumberInput mt={4} {...form.getInputProps('monthly_external_savings')} thousandSeparator min={0} />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 4 }}>
                          <LabelWithHelp
                            label="Investir sobra externa"
                            help="Se houver sobra da renda externa após pagar custos, investe automaticamente esse excedente no mês."
                          />
                          <Checkbox mt={6} {...form.getInputProps('invest_external_surplus', { type: 'checkbox' })} />
                        </Grid.Col>
                      </Grid>

                      <Grid gutter="sm">
                        <Grid.Col span={{ base: 12, sm: 6 }}>
                          <NumberInput label="Aporte Mensal Fixo" {...form.getInputProps('fixed_monthly_investment')} thousandSeparator />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 6 }}>
                          <NumberInput label="Início do Aporte (mês)" {...form.getInputProps('fixed_investment_start_month')} />
                        </Grid.Col>
                      </Grid>
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>

                <Accordion.Item value="fgts">
                  <Accordion.Control>FGTS</Accordion.Control>
                  <Accordion.Panel>
                    <Grid gutter="sm" align="flex-end">
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <LabelWithHelp
                          label="Saldo FGTS (R$)"
                          help={`Saldo disponível de FGTS. Neste MVP, o FGTS é usado apenas no momento da compra (entrada/abatimento do valor necessário).
Para simular amortizações recorrentes com dinheiro, use a seção de Amortizações.`}
                        />
                        <NumberInput mt={4} {...form.getInputProps('fgts.initial_balance')} min={0} thousandSeparator />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <LabelWithHelp
                          label="Aporte FGTS mensal (R$)"
                          help="Opcional. Simula aportes mensais ao saldo de FGTS."
                        />
                        <NumberInput mt={4} {...form.getInputProps('fgts.monthly_contribution')} min={0} thousandSeparator />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <LabelWithHelp
                          label="Rendimento FGTS (% a.a.)"
                          help="Opcional. Se informado, o saldo FGTS cresce mensalmente por esta taxa anual (aproximação)."
                        />
                        <NumberInput mt={4} {...form.getInputProps('fgts.annual_yield_rate')} min={0} />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <LabelWithHelp
                          label="Limite saque FGTS na compra (R$)"
                          help="Opcional. Se definido, limita quanto do FGTS pode ser usado no evento de compra."
                        />
                        <NumberInput mt={4} {...form.getInputProps('fgts.max_withdrawal_at_purchase')} min={0} thousandSeparator />
                      </Grid.Col>
                    </Grid>

                    <Checkbox
                      mt="sm"
                      label="Usar FGTS na compra"
                      {...form.getInputProps('fgts.use_at_purchase', { type: 'checkbox' })}
                    />
                  </Accordion.Panel>
                </Accordion.Item>

                <Accordion.Item value="tax">
                  <Accordion.Control>Tributação (aproximação)</Accordion.Control>
                  <Accordion.Panel>
                    <Grid gutter="sm" align="flex-end">
                      <Grid.Col span={{ base: 12, sm: 8 }}>
                        <LabelWithHelp
                          label="Tributação sobre rendimentos"
                          help={`Aproximação simples: aplica uma alíquota efetiva sobre o rendimento positivo de cada mês e reinveste o retorno líquido.
Na prática, o IR costuma ser cobrado no resgate e depende do produto/prazo.`}
                        />
                        <Checkbox
                          mt={6}
                          label="Aplicar imposto (aproximação)"
                          {...form.getInputProps('investment_tax.enabled', { type: 'checkbox' })}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 4 }}>
                        <LabelWithHelp
                          label="Alíquota efetiva (%)"
                          help="Percentual aplicado sobre o rendimento mensal positivo (não é uma simulação tributária completa)."
                        />
                        <NumberInput
                          mt={4}
                          {...form.getInputProps('investment_tax.effective_tax_rate')}
                          min={0}
                          max={100}
                          disabled={!form.values.investment_tax?.enabled}
                        />
                      </Grid.Col>
                    </Grid>
                  </Accordion.Panel>
                </Accordion.Item>

                <Accordion.Item value="amort">
                  <Accordion.Control>Amortizações extras</Accordion.Control>
                  <Accordion.Panel>
                    <AmortizationsFieldArray
                      value={form.values.amortizations || []}
                      onChange={(v)=>form.setFieldValue('amortizations', v)}
                      inflationRate={form.values.inflation_rate || undefined}
                      termMonths={form.values.loan_term_years * 12}
                    />
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </Stack>
          )}

          <Button type="submit" loading={loading} fullWidth size="md">Comparar Cenários</Button>
        </Stack>
      </form>
    </Paper>
  );

  const emptyState = (
    <Stack gap="md">
      <Text size="sm" c="dimmed">Configure os parâmetros e compare os três caminhos possíveis. Insights iniciais:</Text>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <BadgeCard icon={<IconBuildingBank size={18} />} color="moss" title="Comprar" description="Construção de equity desde o primeiro mês." badges={["Equity", "Juros"]} />
        <BadgeCard icon={<IconChartLine size={18} />} color="ember" title="Alugar + Investir" description="Liquidez e potencial de retorno sobre o capital." badges={["Liquidez", "ROI"]} />
        <BadgeCard icon={<IconArrowsShuffle size={18} />} color="orange" title="Investir e Comprar" description="Sincronia entre valorização e acumulação de capital." badges={["Timing", "Aportes"]} />
      </SimpleGrid>
      <CardWithStats title="Exemplo (mock)" stats={[{ label: 'Comprar', value: 'R$ 820k' }, { label: 'Alugar', value: 'R$ 780k' }, { label: 'Investir', value: 'R$ 805k' }]} progress={{ value: 52, label: 'Melhor vs Médio %', color: 'moss' }} />
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
            {data ? (enhanced ? <EnhancedComparisonResults result={data as EnhancedComparisonResult} inputPayload={lastInput || undefined} /> : <ComparisonResults result={data as ComparisonResult} inputPayload={lastInput || undefined} />) : emptyState}
          </Grid.Col>
        </Grid>
      ) : (
        <Stack gap="xl">
          {formEl}
          {data ? (enhanced ? <EnhancedComparisonResults result={data as EnhancedComparisonResult} inputPayload={lastInput || undefined} /> : <ComparisonResults result={data as ComparisonResult} inputPayload={lastInput || undefined} />) : emptyState}
        </Stack>
      )}
    </Stack>
  );
}
