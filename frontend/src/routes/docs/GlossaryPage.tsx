import { Title, Accordion, Text, Badge, Group } from '@mantine/core';

type Term = { label: string; desc: string; tech?: string };

const userTerms: Term[] = [
  { label: 'Valor do Imóvel Inicial', desc: 'Preço usado como base no primeiro mês.', tech: 'property_value' },
  { label: 'Entrada / Capital Inicial', desc: 'Dinheiro aplicado no início (entrada ou aporte inicial).', tech: 'down_payment' },
  { label: 'Custo Líquido', desc: 'Tudo que saiu menos o patrimônio final (imóvel + investimentos).', tech: 'net_cost' },
  { label: 'Patrimônio Final', desc: 'Valor do imóvel atualizado somado ao saldo investido remanescente.', tech: 'final_equity' },
  { label: 'Fluxo de Caixa', desc: 'Entradas (+) e saídas (-) do mês consideradas na comparação.', tech: 'cash_flow' },
  { label: 'Custo Mensal Médio', desc: 'Média dos fluxos de saída ao longo do período.', tech: 'average_monthly_cost' },
  { label: 'ROI', desc: 'Retorno percentual sobre o capital inicial.', tech: 'roi_percentage' },
  { label: 'Retirada para Aluguel', desc: 'Quanto foi retirado do investimento para cobrir aluguel/custos.', tech: 'rent_withdrawal_from_investment' },
  { label: 'Razão Retorno/Retirada', desc: 'Se >= 1, rendimento do mês cobriu a retirada.', tech: 'sustainable_withdrawal_ratio' },
  { label: 'Meses Insustentáveis', desc: 'Meses em que a retirada não foi totalmente coberta pelo retorno.', tech: 'months_with_burn' },
  { label: 'Renda Externa Mensal', desc: 'Valor usado primeiro para pagar custos antes de mexer no investimento.', tech: 'monthly_external_savings' },
  { label: 'Sobra Externa Reinvestida', desc: 'Parte da renda externa não usada que volta para o investimento.', tech: 'external_surplus_invested' },
  { label: 'Compra à Vista - Progresso', desc: 'Percentual alcançado rumo ao valor necessário para comprar sem financiamento.', tech: 'progress_percent' },
];

export function GlossaryPage() {
  return (
    <div>
      <Title order={2}>Glossário</Title>
      <Text size="sm" mt="xs">Termos exibidos na interface. Abra cada item para ver a explicação e o campo técnico interno (quando existir).</Text>
      <Accordion mt="md" variant="separated">
        {userTerms.map(t => (
          <Accordion.Item key={t.label} value={t.label}>
            <Accordion.Control>{t.label}</Accordion.Control>
            <Accordion.Panel>
              <Text size="sm" mb={4}>{t.desc}</Text>
              {t.tech && (
                <Group gap="xs">
                  <Text size="xs" c="dimmed">Campo técnico:</Text>
                  <Badge size="xs" variant="light" color="gray">{t.tech}</Badge>
                </Group>
              )}
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </div>
  );
}

export default GlossaryPage;
