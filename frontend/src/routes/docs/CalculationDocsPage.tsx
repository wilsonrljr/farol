import { Title, Text, Code, Stack, List, Divider } from '@mantine/core';

export function CalculationDocsPage() {
  return (
    <Stack>
      <Title order={2}>Como Calculamos</Title>
      <Text size="sm">Visão amigável das principais etapas. Fórmulas completas estão na documentação avançada em Markdown.</Text>
      <Divider label="Etapas Principais" my="sm" />
      <List size="sm" spacing={4} withPadding>
        <List.Item><b>Taxas</b>: convertemos taxa anual em mensal composta para aplicar mês a mês.</List.Item>
        <List.Item><b>Inflação & Valorização</b>: cada mês usa o fator acumulado até aquele ponto.</List.Item>
        <List.Item><b>Financiamento</b>: simulamos PRICE ou SAC calculando juros e amortização mensais e aplicando amortizações extras quando definidas.</List.Item>
        <List.Item><b>Investimentos</b>: saldo anterior + aportes + retorno - retiradas (quando estratégia de viver de renda ativa).</List.Item>
        <List.Item><b>Retiradas para Aluguel</b>: primeiro cobre com Renda Externa; falta vem do investimento limitado ao saldo disponível.</List.Item>
        <List.Item><b>Sustentabilidade</b>: comparamos Retorno do Mês vs Retirada. Se retorno ≥ retirada, mês sustentável.</List.Item>
        <List.Item><b>Compra à Vista</b>: ocorre quando saldo investido alcança custo alvo (imóvel ajustado + custos iniciais).</List.Item>
        <List.Item><b>Métricas</b>: Custo Líquido, Patrimônio Final, ROI, Mês de Equilíbrio, Razão Média Retorno/Retirada.</List.Item>
      </List>
      <Divider label="Fórmulas Chave" my="md" />
      <Code block>taxa_mensal = (1 + taxa_anual)^(1/12) - 1</Code>
      <Code block>valor_ajustado = base * (1 + taxa_anual)^(meses/12)</Code>
      <Code block>Parcela PRICE ≈ i*(1+i)^n / ((1+i)^n - 1) * principal</Code>
      <Code block>Saldo Investido = saldo_prev + aportes - retiradas + retorno</Code>
      <Code block>Custo Líquido = Saídas Totais - Patrimônio Final</Code>
      <Code block>Razão Sustentabilidade = Retorno do Mês / Retirada</Code>
    </Stack>
  );
}

export default CalculationDocsPage;
