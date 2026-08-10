# Referência de Cálculos (Visão do Usuário)

Esta página explica de forma amigável como os números exibidos na interface são formados. Fórmulas originais e nomes técnicos ficam ao final (Seção Avançada) para quem quiser auditar.

## 1. Taxas de Juros e Retornos
Quando você informa uma taxa anual, o simulador converte para mês a mês automaticamente. O objetivo é mostrar a evolução mensal realista de parcelas, investimentos e custos.

Resumo prático:
- No financiamento, informe **exatamente uma** entre taxa anual e taxa mensal; informar ambas ou nenhuma é inválido.
- Retornos de investimento são informados em faixas anuais contíguas, iniciadas no mês 1 e com a última faixa aberta.
- O sistema gera a taxa mensal equivalente composta.

## 2. Inflação e Valorização do Imóvel
Valores como aluguel, condomínio, IPTU e preço do imóvel sobem conforme as taxas que você definiu. A cada mês aplicamos a inflação (ou valorização) acumulada até aquele ponto. Assim você enxerga custos futuros em moeda “corrente” projetada.

### Aluguel inicial

Informe **exatamente uma** forma: `rent_value` (R$ por mês) ou `rent_percentage` (**% ao mês** sobre o valor do imóvel). Não há divisão por 12:

```text
aluguel_mensal = property_value * rent_percentage / 100
```

Exemplo: `rent_percentage=0,5` e imóvel de R$ 500.000 produzem aluguel inicial de R$ 2.500/mês.

## 3. Parcelas do Financiamento
Existem dois sistemas comuns no Brasil:
- PRICE: Parcela total constante; no início muito juros, no fim mais amortização.
- SAC: Amortização (parte que abate a dívida) fixa; parcela inicia mais alta e vai caindo.

O simulador calcula mês a mês: saldo devedor restante, juros do mês e amortização. Se você programar amortizações extras (ex: a cada 12 meses, ou um percentual do saldo), o saldo cai mais rápido e diminui juros futuros.

## 4. Investimentos e Aportes
O saldo investido cresce com aportes explícitos e retornos, menos eventuais retiradas. A sobra da renda não é investida automaticamente: o ledger a mantém como caixa sem rendimento. Faixas de retorno permitem simular períodos com taxas diferentes (ex: 12% ao ano depois 8%).

Nota sobre capital inicial (comparação justa):
- Se você informar **Poupança Total (total_savings)**, o simulador trata isso como o seu **caixa total disponível no mês 1**.
- Desse caixa, ele “separa” o que seria gasto imediatamente numa compra: **Entrada (down_payment)** + **custos upfront (ITBI + escritura)**.
- O cenário de compra consome entrada e custos upfront; as alternativas preservam o caixa equivalente em seus ativos. `initial_investment` é sempre derivado internamente conforme o cenário.

Nota importante (API/contrato): você **não informa** `initial_investment` diretamente nas requisições. Para representar “capital extra além da entrada”, informe `total_savings` e o simulador deriva o investimento inicial automaticamente.

Em termos práticos:
```
caixa_investível_na_compra = total_savings - down_payment - custos_upfront
```
E existe validação: `total_savings` precisa ser **>= down_payment + custos_upfront**.

### Ledger comum e ranking

Para eleger um vencedor, o comparador precisa de `total_savings` e `monthly_net_income`. A cada mês, a mesma lógica reconcilia renda, caixa acumulado, custos de moradia e aportes para os três cenários:

```text
recursos = renda_do_mês + caixa_residual_anterior
necessidade = custo_de_moradia + aportes
financiado = min(recursos, necessidade)
caixa_residual = max(0, recursos - necessidade)
déficit = max(0, necessidade - recursos)
patrimônio_líquido_final = ativos_finais - passivos_finais
```

A sobra é mantida como caixa sem rendimento (`residual_cash_balance`). O déficit acumula em `total_unfunded_amount` e `final_liabilities`; portanto, parcela ou aporte não financiado não cria patrimônio fictício. No cenário de compra à vista, essa reserva pode ser convertida no imóvel e o valor usado no evento aparece em `cash_reserve_used_for_purchase`.

O resultado traz um estado explícito:

| `comparison_status` | Significado |
|---|---|
| `comparable` | Recursos comuns e pelo menos um cenário viável; pode haver vencedor. |
| `exploratory` | Falta `total_savings` ou renda mensal; os cenários são projeções, sem ranking autoritativo. |
| `incomparable` | Há recursos exclusivos de cenários (por exemplo, aporte direcionado ou bônus usado só na compra). |
| `no_feasible_scenario` | A renda/caixa informados não financiam nenhum cenário. |

`best_scenario` e `best_scenario_type` são preenchidos somente em `comparable`. Leia também `warnings`, `is_feasible`, `first_unfunded_month` e `total_unfunded_amount`.

## 5. Custos de Compra e Manutenção
Ao comprar: Entrada + ITBI + Escritura formam o custo inicial. Depois vêm custos mensais como condomínio e IPTU (corrigidos por inflação se informado). Esses valores entram no fluxo de caixa do cenário de compra.

Importante: custos upfront (ITBI + escritura) são custos de transação e não são “investidos”. Na comparação, eles entram como saída de caixa quando a compra acontece.

## 6. Cenário Comprar Financiado
Mostra:
- Dinheiro imobilizado na entrada e custos iniciais
- Parcelas mensais + custos recorrentes
- Evolução do valor do imóvel (valorização) menos saldo devedor = seu patrimônio (equity)
- Investimentos paralelos (se sobrou capital ou você configurou aportes)

## 7. Cenário Alugar e Investir (Estratégia de Liberdade Financeira)
Você preserva o capital inicial que não foi consumido por uma compra e paga o aluguel com os recursos modelados. O comparador distingue aluguel devido, valor pago e shortfall; qualquer falta acumula como passivo em vez de ser presumida como dinheiro externo.

Indicadores mostrados:
- Retirada para Aluguel (quanto saiu do investimento)
- Retorno Mensal do Investimento
- Relação Retorno / Retirada (>=1 é sustentável)
- Meses em que houve “queima de principal” (quando o retorno não foi suficiente)

## 8. Cenário Investir e Comprar à Vista
Você acumula dois recursos antes da compra: o investimento, sujeito a retorno e tributação configurados, e a sobra do orçamento, mantida em caixa sem rendimento. O progresso usa o valor líquido resgatável do investimento + reserva de caixa + FGTS elegível. Quando essa soma cobre o imóvel corrigido e os custos iniciais, os recursos são convertidos no imóvel; `cash_reserve_used_for_purchase` explicita a parte proveniente da reserva. Eventual saldo remanescente continua no respectivo ativo.

## 9. Métricas Resumidas na Comparação
Principais números exibidos:
- Custo Mensal Médio: média dos fluxos de saída (parcelas, aluguel, custos) no período
- Custo Líquido (Net Cost): métrica legada de saídas menos `final_equity`; o ranking usa `final_wealth`
- Patrimônio Final: ativos (imóvel, investimentos e caixa residual) menos passivos por recursos não financiados
- ROI agregado: atualmente `null` (`N.D.` na interface), pois ainda não há série de fluxos suficiente para calcular TWR/XIRR de forma defensável
- ROI incluindo saques: também `null`; retiradas não são somadas de volta para fabricar uma taxa aproximada
- Mês de Equilíbrio: fica indisponível no resumo individual; um crossover válido exige comparação pareada entre estratégias
- Sustentabilidade (quando aplicável): total retirado, meses insustentáveis, razão média retorno/retirada

Resumo comparativo (tabela “Comprar − Alugar”): o campo de percentual pode ficar **indisponível** quando o custo do aluguel no ponto analisado é 0. Nesse caso, o sistema retorna “sem valor” (e a interface pode mostrar “—”) para não mascarar o caso com 0%.

## 10. Limitações e Simplificações
- Imposto sobre investimentos pode ser considerado se configurado (por padrão pode estar desativado); imposto sobre venda do imóvel não é modelado
- Não modela vacância de aluguel nem manutenção extraordinária
- Valor temporal do dinheiro (desconto a valor presente) não é aplicado nas métricas básicas
- Caixa residual do ledger não rende; aportes e fontes direcionados podem tornar a comparação `incomparable`

FGTS (cronologia simplificada usada no simulador):
- Quando há **amortização via FGTS** no financiamento, o FGTS é **atualizado no início do mês** (contribuição mensal + rendimento) e só depois pode ser sacado naquele mês.
- Quando há **uso de FGTS na compra** no cenário de compra financiada, a compra é tratada como evento no **início do mês 1**, então o saque de FGTS na compra não “pega” o rendimento do próprio mês 1.
- Após qualquer saque, existe janela de **carência (cooldown) de 24 meses** para novos saques com finalidade de amortização.

## 11. FIRE em dinheiro de hoje

O planejador FIRE trabalha integralmente em valores reais. `monthly_expenses`, carteira, aportes e meta permanecem no poder de compra de hoje, e `annual_return_rate` deve ser a rentabilidade **real, já descontada a inflação**:

```text
meta_FIRE = despesas_mensais * 12 / taxa_de_retirada_segura
```

`annual_inflation_rate` continua aceito por compatibilidade, mas não altera o cálculo. Inflar a meta e usar retorno real ao mesmo tempo contaria a inflação duas vezes. O estado atual é o mês zero; se a carteira já cobrir a meta, `fi_month` e `months_to_fi` retornam `0`.

## 12. Como Conferir (Auditabilidade Rápida)
Para validar: compare a parcela inicial com uma calculadora PRICE/SAC externa; confira que retiradas nunca excedem o saldo disponível; observe que valorização e inflação crescem de forma composta.

---
## Seção Avançada (Fórmulas Originais e Nomes Técnicos)

### Conversão de Taxas
```
monthly = (1 + annual/100) ** (1/12) - 1
annual = (1 + monthly/100) ** 12 - 1
```

No contrato do aluguel, o percentual já é mensal:
```text
rent_value = property_value * (rent_percentage / 100)
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

### Lógica de Caixa no Aluguel

Quando há `monthly_net_income`, ela cobre primeiro a moradia; a sobra não é investida automaticamente. Os aportes precisam ser explícitos e também passam pelo ledger comum:

```text
income_cover = min(monthly_net_income, housing_due)
income_surplus_available = max(0, monthly_net_income - housing_due)
housing_shortfall = max(0, housing_due - income_cover)
rent_paid = min(rent_due, housing_paid)
rent_shortfall = max(0, rent_due - rent_paid)
```

Sem renda informada, o cenário permanece exploratório e assume pagamento externo para projetar os ativos, mas não participa de um ranking autoritativo.

### Critério de Compra à Vista
```text
recursos_elegiveis = investimento_liquido + caixa_residual + fgts_elegivel
recursos_elegiveis >= valor_imovel_ajustado + custos_upfront
```

No evento, `cash_reserve_used_for_purchase` registra a parcela do caixa residual aplicada à compra.

### Métricas
```
final_wealth = final_assets - final_liabilities
average_monthly_cost = media(cash_flow)
net_cost = total_outflows - final_equity
break_even = null  # crossover só é significativo em comparação pareada
roi_percentage = null
roi_including_withdrawals_percentage = null
```

Os campos de ROI não representam 0%. Eles ficam indisponíveis até o modelo preservar uma série de fluxos com valores e datas suficientes para um cálculo TWR/XIRR auditável.
Sustentabilidade agregada:
- total_rent_withdrawn_from_investment = soma(retiradas)
- months_with_burn = contagem(burn)
- average_sustainable_withdrawal_ratio = média(ratio válidos)

### Onde o Código Mora
Implementações principais ficam em:
- Cenários: `backend/app/scenarios/` (comparação em `backend/app/scenarios/comparison.py`)
- Empréstimos (SAC/PRICE): `backend/app/loans/`
- Núcleo (taxas/inflação/investimentos/FGTS/custos): `backend/app/core/`

---
## Mapa de Termos (Interface ↔ Técnico)
| Interface (Português) | Campo Interno / Cálculo |
|-----------------------|-------------------------|
| Custo Mensal Médio | average_monthly_cost |
| Custo Líquido | net_cost |
| Equity/Ativos do Simulador (legado) | final_equity |
| Patrimônio Líquido Final | final_wealth |
| Ativos Finais | final_assets |
| Passivos Finais | final_liabilities |
| Caixa Residual | residual_cash_balance |
| Caixa Usado na Compra à Vista | cash_reserve_used_for_purchase |
| Déficit Acumulado | total_unfunded_amount |
| Status da Comparação | comparison_status |
| Retirada para Aluguel | rent_withdrawal_from_investment |
| Meses Insustentáveis | months_with_burn |
| Razão Retorno/Retirada | average_sustainable_withdrawal_ratio |
| Total Retirado | total_rent_withdrawn_from_investment |
| ROI Agregado (N.D.) | roi_percentage = null |
| ROI incl. Saques (N.D.) | roi_including_withdrawals_percentage = null |
| Mês de Equilíbrio | break_even |
