import { Title, Text, List, Code, Alert } from '@mantine/core';

export function QuickstartPage() {
  return (
    <div>
      <Title order={2}>Guia Rápido</Title>
      <Text mt="sm">Passos essenciais para comparar “Comprar Financiado”, “Alugar e Investir” e “Investir para Comprar à Vista”.</Text>
      <List mt="md" spacing="xs" size="sm" withPadding>
        <List.Item>Informe o Valor do Imóvel e a Entrada / Capital Inicial.</List.Item>
        <List.Item>Defina Sistema (SAC ou PRICE) e Taxa de Juros (apenas anual ou apenas mensal).</List.Item>
        <List.Item>Digite o Aluguel ou use o Percentual (%) do Imóvel.</List.Item>
        <List.Item>Adicione Retornos de Investimento (pode ter períodos diferentes de taxa).</List.Item>
        <List.Item>(Opcional) Configure Inflação, Valorização e Amortizações Extras.</List.Item>
        <List.Item>(Opcional) Aporte Mensal Fixo e Estratégia de Viver de Renda (retiradas + renda externa).</List.Item>
        <List.Item>Execute a simulação e compare Custo Líquido, Patrimônio Final e Sustentabilidade.</List.Item>
      </List>
      <Alert mt="lg" variant="light" title="Dica" color="blue">
        Use a estratégia de viver de renda apenas se quiser saber quando os retornos passam a cobrir aluguel/custos sem consumir o principal.
      </Alert>
      <Text mt="lg" size="sm" fw={500}>Fórmula chave de Custo Líquido</Text>
      <Code block mt="xs">Custo Líquido = Saídas Totais - Patrimônio Final</Code>
    </div>
  );
}

export default QuickstartPage;
