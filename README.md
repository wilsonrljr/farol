# Farol

Farol é uma plataforma de simulação e planejamento financeiro focada inicialmente em cenários imobiliários no Brasil, com visão de expansão para outros objetivos (ex: veículo, reservas, grandes compras).

## Funcionalidades
- Simulação de financiamentos imobiliários nos sistemas SAC e PRICE.
- Comparação entre diferentes estratégias:
  - Comprar um imóvel com financiamento.
  - Alugar e investir o valor da entrada.
  - Investir até comprar à vista.
- Amortizações extraordinárias configuráveis ao longo do tempo.
- Múltiplas faixas de retorno de investimento (variação temporal).
- Considera inflação, valorização do imóvel, custos adicionais (ITBI, escritura, condomínio, IPTU).
- Resultados detalhados: fluxo de caixa mensal, patrimônio, saldo investido, equity, valor do imóvel.
- Interface web responsiva (React + Mantine).
- Página "Sobre" com explicações de uso e conceitos.
- Estrutura preparada para expansão futura (ex: metas adicionais não imobiliárias).

## Tecnologias
Backend: Python (FastAPI, Pydantic, NumPy, Pandas, Matplotlib)
Frontend: React + Vite + TypeScript + Mantine UI

## Instalação (Dev)

### Backend
Instale dependências:
```bash
pip install -e .
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

O aplicativo frontend estará disponível em `http://localhost:5173`.

## Uso
1. Acesse `http://localhost:5173`.
2. Explore:
  - Início: visão geral.
  - Simulação de Financiamento.
  - Comparação de Cenários.
  - Sobre: conceitos e metodologia.

## Estrutura Simplificada
```
backend/app/
  main.py       # FastAPI app (Farol API)
  models.py     # Pydantic models
  finance.py    # Lógica de simulação
frontend/       # React + Vite + Mantine
```

## Novos Campos e Métricas (Comparação de Cenários)
Para cada cenário retornado pela API de comparação (`/api/compare-scenarios` e `/api/compare-scenarios-enhanced`):

- `total_outflows`: Soma bruta de todos os desembolsos (entrada, parcelas, aluguel, custos mensais, investimentos adicionais, compra à vista se ocorrer).
- `final_equity`: Patrimônio ao final (valor do imóvel possuído + saldo investido). Em cenários sem compra é apenas o saldo investido.
- `net_cost` (alias de `total_cost`): Custo líquido = `total_outflows - final_equity`. Mantido `total_cost` por retrocompatibilidade.
- `cash_flow` (mensal, assinado): Valores negativos representam saída de caixa; positivos (se surgirem no futuro) seriam economias / entradas.

### Métricas Avançadas (`/api/compare-scenarios-enhanced`)
- `total_cost_difference` / `total_cost_percentage_difference`: Diferença do custo líquido em relação ao melhor cenário.
- `break_even_month`: Mês em que a trajetória acumulada de fluxo de caixa atinge ou cruza zero (paridade aproximada). Pode ser `null` se não ocorre dentro do horizonte.
- `roi_percentage`: (final_equity - investimento_inicial) / investimento_inicial. O investimento inicial inclui entrada + custos iniciais (quando compra financiada).
- `average_monthly_cost`: Média aritmética dos fluxos de caixa mensais assinados (útil para ver ritmo de queima de caixa). Pode ser negativo (desembolso médio).
- `total_interest_or_rent_paid`: Soma dos juros pagos (compra) ou aluguel pago (alugar/investir).
- `wealth_accumulation`: Igual a `final_equity` (evita dupla contagem de investimentos).

### Campos de Progresso (Cenário "Investir e comprar à vista")
- `target_purchase_cost`: Custo alvo no mês (imóvel ajustado + custos iniciais estimados naquele mês).
- `progress_percent`: Percentual do alvo já acumulado (saldo investido / alvo).
- `shortfall`: Valor ainda faltante para compra naquele mês.
- `is_milestone`: Linha marcada como ponto relevante (primeiros 12 meses, múltiplos de 12, ou ao cruzar 25/50/75/90/100%).
- `purchase_month` / `purchase_price`: Presentes quando a compra ocorreu.
- `projected_purchase_month` / `estimated_months_remaining`: Projeção simples baseada na média de crescimento recente (janela de até 6 marcos) quando ainda não comprado.

O frontend avançado usa estes campos para um modo condensado que mostra apenas marcos, badges de progresso e estimativa de compra.

### Mudanças de Comportamento Importantes
- Removido uso de `abs()` nos fluxos de caixa comparativos para não perder o sinal econômico.
- Ajustado cálculo de ROI para considerar custos iniciais de compra.
- Introduzida validação quando taxas anual e mensal são fornecidas e inconsistentes (> 0.05 p.p. de diferença).
- Cenário "Investir e comprar à vista" agora separa explicitamente `total_outflows` e `net_cost`, evitando confusões quando patrimônio cresce mais que gastos.

### Retrocompatibilidade
- `total_cost` continua presente; agora é semanticamente o custo líquido (igual a `net_cost`). Clientes existentes não precisam mudar imediatamente.
- Novos campos podem ser adotados gradualmente no frontend.


## Variáveis de Ambiente
Ver `.env.example` para chaves como `APP_NAME`, `API_TITLE`, `API_DESCRIPTION`.

## Roadmap (ideias futuras)
- Simulações para outros tipos de bens (ex: veículo).
- Metas múltiplas em paralelo.
- Perfis de risco e classes de ativos.
- Exportação CSV/JSON interativa.
- Autenticação e persistência de cenários.

## Licença
Definir licença (MIT / Apache 2.0, etc.).
