# Referência de Cálculos (Visão do Usuário)

Esta página explica de forma amigável como os números exibidos na interface são formados. Fórmulas originais e nomes técnicos ficam ao final (Seção Avançada) para quem quiser auditar.

## 1. Taxas de Juros e Retornos
Quando você informa uma taxa anual, o simulador converte para mês a mês automaticamente. O objetivo é mostrar a evolução mensal realista de parcelas, investimentos e custos.

Resumo prático:
- Informe só a taxa anual de financiamento ou de retorno do investimento (evite duplicar)
- O sistema gera a taxa mensal equivalente composta

## 2. Inflação e Valorização do Imóvel
Valores como aluguel, condomínio, IPTU e preço do imóvel sobem conforme as taxas que você definiu. A cada mês aplicamos a inflação (ou valorização) acumulada até aquele ponto. Assim você enxerga custos futuros em moeda “corrente” projetada.

## 3. Parcelas do Financiamento
Existem dois sistemas comuns no Brasil:
- PRICE: Parcela total constante; no início muito juros, no fim mais amortização.
- SAC: Amortização (parte que abate a dívida) fixa; parcela inicia mais alta e vai caindo.

O simulador calcula mês a mês: saldo devedor restante, juros do mês e amortização. Se você programar amortizações extras (ex: a cada 12 meses, ou um percentual do saldo), o saldo cai mais rápido e diminui juros futuros.

## 4. Investimentos e Aportes
O saldo investido cresce com: aportes mensais + retornos + reinvestimento de sobras (se configurado) – retiradas para pagar despesas (quando você escolhe “Viver de Renda”). Faixas de retorno permitem simular períodos com taxas diferentes (ex: 12% ao ano depois 8%).

## 5. Custos de Compra e Manutenção
Ao comprar: Entrada + ITBI + Escritura formam o custo inicial. Depois vêm custos mensais como condomínio e IPTU (corrigidos por inflação se informado). Esses valores entram no fluxo de caixa do cenário de compra.

## 6. Cenário Comprar Financiado
Mostra:
- Dinheiro imobilizado na entrada e custos iniciais
- Parcelas mensais + custos recorrentes
- Evolução do valor do imóvel (valorização) menos saldo devedor = seu patrimônio (equity)
- Investimentos paralelos (se sobrou capital ou você configurou aportes)

## 7. Cenário Alugar e Investir (Estratégia de Liberdade Financeira)
Você investe o capital inicial e paga aluguel. Se optar por “usar rendimento para pagar aluguel”, o simulador retira do investimento o que faltar após considerar uma renda externa mensal opcional. Indicadores de sustentabilidade mostram se os retornos já cobrem o aluguel.

Indicadores mostrados:
- Retirada para Aluguel (quanto saiu do investimento)
- Retorno Mensal do Investimento
- Relação Retorno / Retirada (>=1 é sustentável)
- Meses em que houve “queima de principal” (quando o retorno não foi suficiente)

## 8. Cenário Investir e Comprar à Vista
Você acumula até ter o valor do imóvel (corrigido) + custos iniciais. No mês da compra converte parte do investimento em patrimônio (o imóvel) e continua (se houver saldo) investindo o restante. É útil para comparar com financiar desde o início.

## 9. Métricas Resumidas na Comparação
Principais números exibidos:
- Custo Mensal Médio: média dos fluxos de saída (parcelas, aluguel, custos) no período
- Custo Líquido (Net Cost): tudo que saiu menos o patrimônio final (imóvel + investimentos)
- Patrimônio Final: valor do imóvel ajustado + saldo investido remanescente
- ROI: retorno percentual sobre o capital inicial efetivo
- Mês de Equilíbrio (Break-even aproximado): primeiro mês em que o acumulado dos fluxos deixa de ser negativo
- Sustentabilidade (quando aplicável): total retirado, meses insustentáveis, razão média retorno/retirada

## 10. Limitações e Simplificações
- Não considera impostos sobre ganhos de investimento ou venda do imóvel
- Não modela vacância de aluguel nem manutenção extraordinária
- Valor temporal do dinheiro (desconto a valor presente) não é aplicado nas métricas básicas
- ROI simplificado assume capital inicial como base única

## 11. Como Conferir (Auditabilidade Rápida)
Para validar: compare a parcela inicial com uma calculadora PRICE/SAC externa; confira que retiradas nunca excedem o saldo disponível; observe que valorização e inflação crescem de forma composta.

---
## Seção Avançada (Fórmulas Originais e Nomes Técnicos)

### Conversão de Taxas
```
monthly = (1 + annual/100) ** (1/12) - 1
annual = (1 + monthly/100) ** 12 - 1
```

### Inflação / Valorização
```
valor_ajustado = base * (1 + taxa_anual/100) ** (meses/12)
```

### Empréstimo PRICE
```
P = i * (1 + i)^n / ((1 + i)^n - 1) * principal
juros_mes = saldo * i
amortizacao_mes = P - juros_mes
saldo_novo = saldo - amortizacao_mes - amortizacao_extra
```
### Empréstimo SAC
```
amortizacao_fixa = principal / n
juros_mes = saldo * i
prestacao = amortizacao_fixa + juros_mes
saldo_novo = saldo - amortizacao_fixa - amortizacao_extra
```
Amortizações extras: únicas ou recorrentes (interval_months), limitadas por end_month ou occurrences; percentuais (`value_type='percentage'`) ou valor fixo (pode ser indexado por inflação com inflation_adjust).

### Investimentos
```
retorno = saldo * taxa_mensal
saldo_pos = saldo + aportes + retorno - retiradas
```

### Lógica de Retirada no Aluguel (quando ativa)
```
cover = min(monthly_external_savings, custo_total)
retirada_bruta = custo_total - cover
retirada = min(retirada_bruta, saldo_prev + aportes)
retorno = (saldo_prev + aportes - retirada) * taxa_mensal
saldo = saldo_prev + aportes - retirada + retorno (+ surplus_investido)
ratio = retorno / retirada (se retirada > 0)
burn = ratio < 1
```

### Critério de Compra à Vista
```
saldo >= valor_imovel_ajustado + custos_upfront
```

### Métricas
```
ROI = (final_equity - investimento_inicial) / investimento_inicial * 100
average_monthly_cost = media(cash_flow)
net_cost = total_outflows - final_equity
break_even ≈ primeiro mês cumulativo(cash_flow) >= 0
```
Sustentabilidade agregada:
- total_rent_withdrawn_from_investment = soma(retiradas)
- months_with_burn = contagem(burn)
- average_sustainable_withdrawal_ratio = média(ratio válidos)

### Onde o Código Mora
Implementações em `backend/app/finance.py`.

---
## Mapa de Termos (Interface ↔ Técnico)
| Interface (Português) | Campo Interno / Cálculo |
|-----------------------|-------------------------|
| Custo Mensal Médio | average_monthly_cost |
| Custo Líquido | net_cost |
| Patrimônio Final | final_equity |
| Retirada para Aluguel | rent_withdrawal_from_investment |
| Meses Insustentáveis | months_with_burn |
| Razão Retorno/Retirada | average_sustainable_withdrawal_ratio |
| Total Retirado | total_rent_withdrawn_from_investment |
| ROI | ROI |
| Mês de Equilíbrio | break_even |

