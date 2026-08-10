import type { ReactNode } from 'react';
import { Alert, Box, Button, Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconInfoCircle, IconScale } from '@tabler/icons-react';
import { money } from '../../utils/format';
import { FormSection } from '../ui/FormWizard';
import { useComparisonFormContext } from './ComparisonFormContext';
import { comparisonDerivedValues, comparisonReadiness } from './comparisonFormModel';
import {
  calculateMonthlyBudgetSnapshot,
  extraIncomeInFirstMonth,
} from './monthlyBudgetPresentation';

interface ReviewStepProps {
  loading: boolean;
  onEdit: (step: number) => void;
}

function ReviewDetail({ title, summary, onEdit, children }: { title: string; summary: string; onEdit: () => void; children?: ReactNode }) {
  return (
    <Paper component="section" withBorder radius="lg" p="md">
      <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
        <Box style={{ flex: 1 }}><Text component="h4" fw={700} size="sm" m={0}>{title}</Text><Text size="sm" c="dimmed" mt={3}>{summary}</Text></Box>
        <Button variant="subtle" size="sm" mih={44} aria-label={`Editar ${title.toLocaleLowerCase('pt-BR')}`} onClick={onEdit}>Editar</Button>
      </Group>
      {children}
    </Paper>
  );
}

function DetailList({ children }: { children: ReactNode }) {
  return <Box component="ul" mt="sm" mb={0} pl="lg">{children}</Box>;
}

function MonthlyEquation({ title, housing, plan, financed = false, extraIncome = 0, outstandingBalance }: { title: string; housing: number; plan: NonNullable<ReturnType<typeof comparisonDerivedValues>['input']['monthly_plan']>; financed?: boolean; extraIncome?: number; outstandingBalance?: number }) {
  const snapshot = calculateMonthlyBudgetSnapshot(plan, housing, {
    financed,
    extraIncome,
    maxAmortization: outstandingBalance,
  });
  return (
    <Paper withBorder p="md" radius="lg">
      <Text fw={700}>{title}</Text>
      <Stack gap={5} mt="sm">
        <Text size="sm">
          {money(plan.net_income)}{extraIncome > 0 ? ` + ${money(extraIncome)}` : ''}
          {' '}− {money(plan.non_housing_expenses)} − {money(housing)}
        </Text>
        {extraIncome > 0 && <Text size="xs" c="dimmed">Inclui renda extra no primeiro mês.</Text>}
        <Group justify="space-between"><Text size="sm" c="dimmed">Sobra</Text><Text size="sm" fw={700}>{money(snapshot.surplus)}</Text></Group>
        <Group justify="space-between"><Text size="sm">Investimento</Text><Text size="sm" fw={700}>{money(snapshot.investmentAllocation)}</Text></Group>
        {financed && <Group justify="space-between"><Text size="sm">Amortização extra</Text><Text size="sm" fw={700}>{money(snapshot.amortizationAllocation)}</Text></Group>}
        <Group justify="space-between"><Text size="sm" c="dimmed">Fora do plano</Text><Text size="sm">{money(snapshot.outsidePlan)}</Text></Group>
        {snapshot.deficit > 0 && <Text size="xs" c="red">Déficit obrigatório: {money(snapshot.deficit)}</Text>}
      </Stack>
    </Paper>
  );
}

export function ReviewStep({ loading, onEdit }: ReviewStepProps) {
  const form = useComparisonFormContext();
  const derived = comparisonDerivedValues(form.values);
  const input = derived.input;
  const plan = input.monthly_plan;
  const modules = form.values.ui.modules;
  const readiness = comparisonReadiness(form.values);
  const ownerCosts = input.additional_costs.owner_monthly_costs;
  const renterCosts = input.additional_costs.renter_monthly_costs;
  const ownerMonthly = (ownerCosts?.hoa ?? 0) + (ownerCosts?.property_tax ?? 0) + (ownerCosts?.other ?? 0);
  const renterMonthly = (renterCosts?.hoa ?? 0) + (renterCosts?.property_tax ?? 0) + (renterCosts?.other ?? 0);
  const firstMonthExtraIncome = extraIncomeInFirstMonth(
    input.extra_income_events
  );

  return (
    <FormSection title="Confira como o plano usa seu dinheiro" description="A mesma porcentagem da sobra vale para as três estratégias." icon={<IconScale size={20} />}>
      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <ReviewDetail title="Moradia" summary={`${money(derived.propertyValue)} · aluguel ${money(derived.rentAmount)}`} onEdit={() => onEdit(0)}><DetailList><Text component="li" size="sm">Horizonte: {input.comparison_horizon_years} anos</Text><Text component="li" size="sm">ITBI + registro se comprar hoje: {money(derived.upfrontCosts)}</Text><Text component="li" size="sm">Na compra futura, esses percentuais são recalculados sobre o preço projetado.</Text></DetailList></ReviewDetail>
        <ReviewDetail title="Compra" summary={derived.financedAmount > 0 ? `Entrada em dinheiro ${money(derived.downPayment)} · ${input.loan_type} por ${input.loan_term_years} anos` : `À vista · entrada em dinheiro ${money(derived.downPayment)}`} onEdit={() => onEdit(1)}><DetailList><Text component="li" size="sm">Dinheiro disponível hoje: {input.total_savings == null ? 'não informado' : money(input.total_savings)}</Text>{modules.fgts && <Text component="li" size="sm">FGTS na compra: {money(derived.fgtsAtPurchase)}</Text>}{derived.financedAmount > 0 ? <><Text component="li" size="sm">Valor financiado: {money(derived.financedAmount)}</Text><Text component="li" size="sm">Juros: {input.annual_interest_rate ?? input.monthly_interest_rate}% {input.annual_interest_rate != null ? 'a.a.' : 'a.m.'}</Text></> : <Text component="li" size="sm">Sem financiamento, juros ou parcela.</Text>}</DetailList></ReviewDetail>
        <ReviewDetail title="Plano mensal" summary={plan ? `${money(plan.net_income)} de renda · ${plan.wealth_allocation_percentage}% da sobra para patrimônio` : 'não informado'} onEdit={() => onEdit(2)}>{plan && <DetailList><Text component="li" size="sm">Gastos fora da moradia: {money(plan.non_housing_expenses)}</Text>{derived.financedAmount > 0 ? plan.financed_purchase.amortization_percentage > 0 ? <><Text component="li" size="sm">Na compra: {plan.financed_purchase.amortization_percentage}% amortizar · {100 - plan.financed_purchase.amortization_percentage}% investir</Text><Text component="li" size="sm">Amortização: {plan.financed_purchase.amortization_effect === 'reduce_term' ? 'reduzir prazo' : 'reduzir parcela'}</Text></> : <Text component="li" size="sm">Na compra financiada, 100% do valor destinado a patrimônio vai para investimentos.</Text> : <Text component="li" size="sm">Na compra à vista, 100% do valor destinado a patrimônio vai para investimentos.</Text>}<Text component="li" size="sm">Renda e gastos: {plan.adjust_for_inflation ? 'corrigidos pela inflação' : 'nominais fixos'}</Text></DetailList>}</ReviewDetail>
      </SimpleGrid>

      {plan && <Box><Text fw={700}>Orçamento mensal no início</Text><Text size="sm" c="dimmed" mb="sm">Entrada em dinheiro e custos de compra saem dos recursos iniciais, não da sobra salarial mostrada abaixo.</Text><SimpleGrid cols={{ base: 1, md: 3 }}><MonthlyEquation title={derived.financedAmount > 0 ? 'Comprar financiado' : 'Comprar à vista'} housing={derived.initialPayment + ownerMonthly} plan={plan} financed={derived.financedAmount > 0} extraIncome={firstMonthExtraIncome} outstandingBalance={derived.financedAmount} /><MonthlyEquation title="Alugar e investir" housing={derived.rentAmount + renterMonthly} plan={plan} extraIncome={firstMonthExtraIncome} /><MonthlyEquation title="Investir para comprar" housing={derived.rentAmount + renterMonthly} plan={plan} extraIncome={firstMonthExtraIncome} /></SimpleGrid></Box>}

      <Stack gap="sm">
        <ReviewDetail title="Premissas econômicas" summary={`Retorno nominal ${input.investment_returns[0]?.annual_rate ?? 0}% a.a. · inflação ${input.inflation_rate == null ? 'sem correção' : `${input.inflation_rate}% a.a.`}`} onEdit={() => onEdit(3)}><DetailList><Text component="li" size="sm">Reajuste do aluguel: {input.rent_inflation_rate == null ? 'igual à inflação geral' : `${input.rent_inflation_rate}% a.a.`}</Text><Text component="li" size="sm">Valorização do imóvel: {input.property_appreciation_rate == null ? 'igual à inflação geral' : `${input.property_appreciation_rate}% a.a.`}</Text></DetailList></ReviewDetail>
        {modules.housingCosts && <ReviewDetail title="Custos mensais da moradia" summary={`Proprietário ${money(ownerMonthly)}/mês · inquilino ${money(renterMonthly)}/mês`} onEdit={() => onEdit(0)} />}
        {modules.fgts && input.fgts && <ReviewDetail title="FGTS" summary={`Saldo ${money(input.fgts.initial_balance ?? 0)} · depósitos ${money(input.fgts.monthly_contribution ?? 0)}/mês`} onEdit={() => onEdit(1)}><DetailList><Text component="li" size="sm">Uso na compra: {input.fgts.use_at_purchase ? 'sim' : 'não'}</Text>{derived.financedAmount > 0 && <Text component="li" size="sm">Amortizações futuras: {input.fgts.financed_amortization?.enabled ? `a partir do mês ${input.fgts.financed_amortization.first_month}, a cada ${input.fgts.financed_amortization.interval_months} meses` : 'não'}</Text>}</DetailList></ReviewDetail>}
        {modules.variableReturns && <ReviewDetail title="Retornos por período" summary={`${input.investment_returns.length} períodos nominais antes da inflação`} onEdit={() => onEdit(3)} />}
        {modules.investmentTax && input.investment_tax && <ReviewDetail title="Imposto sobre investimentos" summary={`${input.investment_tax.effective_tax_rate}% · ${input.investment_tax.mode === 'monthly' ? 'mensal' : 'nos resgates'}`} onEdit={() => onEdit(3)} />}
        {modules.extraIncome && <ReviewDetail title="Rendas extras" summary={`${input.extra_income_events?.length ?? 0} ${(input.extra_income_events?.length ?? 0) === 1 ? 'evento comum' : 'eventos comuns'} às três estratégias`} onEdit={() => onEdit(3)}><DetailList>{input.extra_income_events?.map((event, index) => <Text component="li" size="sm" key={`${event.kind}-${index}`}>{event.kind === 'thirteenth_salary' ? '13º salário' : event.kind === 'bonus' ? 'Bônus' : event.label || 'Outra renda'}: {money(event.amount)} no mês {event.month}{event.interval_months ? `, a cada ${event.interval_months} meses` : ''}</Text>)}</DetailList></ReviewDetail>}
      </Stack>

      <Alert color="blue" icon={<IconInfoCircle size={18} />} title="A parte fora do plano não vira patrimônio">Ela representa consumo, imprevistos ou gastos que você preferiu não detalhar. O simulador não a guarda em caixa nem a investe.</Alert>
      <Alert color={readiness.status === 'comparable' ? 'teal' : 'yellow'} icon={<IconInfoCircle size={18} />} title={readiness.status === 'comparable' ? 'Pronto para comparar' : 'Análise sem ranking'}>{readiness.message}</Alert>
      <Button type="submit" size="lg" fullWidth loading={loading}>Comparar as 3 estratégias</Button>
    </FormSection>
  );
}
