# Referência de Cálculos (Visão do Usuário)

Esta página explica de forma amigável como os números exibidos na interface são formados. Fórmulas originais e nomes técnicos ficam ao final (Seção Avançada) para quem quiser auditar.

## 1. Taxas de Juros e Retornos
Quando você informa juros ou retorno anual, o simulador converte para a taxa mensal equivalente. Custos indexados à inflação seguem reajuste em degraus anuais, conforme explicado abaixo.

Resumo prático:
- Quando existe principal financiado após entrada e FGTS elegível, informe **exatamente uma** entre taxa anual e taxa mensal, além de prazo e sistema. Na compra sem principal financiado, a taxa pode ser omitida (mas as duas representações juntas continuam inválidas).
- Retornos de investimento são informados em faixas anuais contíguas, iniciadas no mês 1 e com a última faixa aberta.
- O sistema gera a taxa mensal equivalente composta.

## 2. Inflação e Valorização do Imóvel
Aluguel, renda/plano mensal, condomínio, IPTU e outros custos de moradia são reajustados no início de cada novo bloco de 12 meses completos. O preço do imóvel, por sua vez, usa valorização composta mensal equivalente. Assim, a projeção distingue reajustes contratuais anuais de uma trajetória mensal de valorização.

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

### Prazo do financiamento × horizonte da comparação

`loan_term_years` define o contrato do empréstimo. `comparison_horizon_years` define o mês em que os três patrimônios são comparados. Portanto, um financiamento de 30 anos pode ser avaliado depois de 10 anos: o saldo devedor ainda existente é descontado do imóvel. Se o horizonte for posterior à quitação, a simulação continua com custos de proprietário e aportes até a data do corte. Quando `comparison_horizon_years` é omitido, ele assume o prazo do financiamento para compatibilidade com cenários antigos. Sem principal financiado, prazo e sistema podem ser omitidos desde que o horizonte explícito seja informado; valores neutros usados internamente pelo simulador não alteram o resultado econômico.

## 4. Investimentos e plano mensal
O usuário informa salário líquido, gastos fora da moradia e a porcentagem da sobra que deseja transformar em patrimônio. A mesma regra é aplicada às três estratégias; como cada moradia custa um valor diferente, a sobra e o investimento também mudam. Faixas de retorno permitem simular períodos com taxas diferentes (ex.: 12% ao ano e depois 8%).

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

Para eleger um vencedor, o comparador precisa de `total_savings` e `monthly_plan`. A cada mês, a mesma lógica é aplicada aos três cenários:

```text
recursos = salário_líquido + rendas_extras
obrigatórios = gastos_fora_da_moradia + custo_de_moradia
sobra = max(0, recursos - obrigatórios)
destino_para_patrimônio = sobra * percentual_escolhido
fora_do_plano = sobra - destino_para_patrimônio
déficit = max(0, obrigatórios - recursos)
patrimônio_líquido_final = ativos_finais - passivos_finais
```

O valor em `fora_do_plano` representa consumo, imprevistos ou despesas que o usuário preferiu não detalhar. Ele não é investido, não acumula em caixa e não entra no patrimônio. O déficit acumula em `total_unfunded_amount` e `final_liabilities`; portanto, gasto obrigatório não financiado não cria patrimônio fictício.

Na compra financiada, o destino patrimonial é dividido entre investimento e amortização. A amortização pode reduzir o prazo ou recalcular as parcelas futuras. Depois da quitação, toda a alocação patrimonial passa a ser investida.

O resultado traz um estado explícito:

| `comparison_status` | Significado |
|---|---|
| `comparable` | Recursos comuns e pelo menos um cenário viável; pode haver vencedor. |
| `exploratory` | Falta `total_savings` ou `monthly_plan`; os cenários são projeções, sem ranking autoritativo. |
| `incomparable` | Estado reservado para entradas internas com recursos assimétricos; a jornada atual não cria essas entradas. |
| `no_feasible_scenario` | A renda informada não cobre os gastos obrigatórios de nenhum cenário. |

`best_scenario` e `best_scenario_type` são preenchidos somente em `comparable`. Leia também `warnings`, `is_feasible`, `first_unfunded_month` e `total_unfunded_amount`.

## 5. Custos de Compra e Manutenção
Ao comprar: Entrada + ITBI + Escritura formam o custo inicial. Depois vêm os custos mensais informados para o **proprietário**: condomínio, IPTU e `other` (manutenção rotineira, seguro e outros recorrentes exclusivos). Nos meses de aluguel entram apenas os custos atribuídos ao **inquilino**, que possui seu próprio `other`. Todos são corrigidos pela inflação quando configurado. Gastos comuns às alternativas pertencem a `monthly_plan.non_housing_expenses`; repeti-los em `other` contaria o mesmo custo duas vezes.

Em “investir e comprar”, o mês da aquisição é tratado de forma conservadora como uma transição: o aluguel e os custos do inquilino já devidos naquele mês permanecem no fluxo, e os custos do proprietário passam a valer no fechamento da compra. Nesse mês, `monthly_hoa`, `monthly_property_tax`, `monthly_other_costs` e `monthly_additional_costs` são a soma dos dois perfis, e:

```text
housing_due = rent_due + renter_monthly_costs + owner_monthly_costs
total_monthly_cost = housing_due + initial_allocation + wealth_allocation
```

Do mês seguinte em diante, não há aluguel nem custos do inquilino; restam apenas os custos do proprietário. O ledger comum usa o mesmo `housing_due` agregado no mês de transição, evitando que o breakdown mostre uma obrigação e a validação de recursos considere outra.

Importante: custos upfront (ITBI + escritura) são custos de transação e não são “investidos”. Na comparação, eles entram como saída de caixa quando a compra acontece.

## 6. Cenário Comprar Financiado
Mostra:
- Dinheiro imobilizado na entrada e custos iniciais
- Parcelas mensais + custos recorrentes
- Evolução do valor do imóvel (valorização) menos saldo devedor = seu patrimônio (equity)
- Investimentos paralelos (se sobrou capital ou você configurou aportes)

## 7. Cenário Alugar e Investir
Você preserva o capital inicial equivalente, paga aluguel e demais gastos e investe a porcentagem escolhida da sobra mensal. O comparador distingue aluguel devido, valor pago e déficit; qualquer falta acumula como passivo em vez de ser presumida como dinheiro externo.

Indicadores mostrados:
- Retirada para Aluguel (quanto saiu do investimento)
- Retorno Mensal do Investimento
- Relação Retorno / Retirada (>=1 é sustentável)
- Meses em que houve “queima de principal” (quando o retorno não foi suficiente)

## 8. Cenário Investir e Comprar à Vista
Você investe a porcentagem escolhida da sobra mensal enquanto aluga. O progresso usa o valor líquido resgatável do investimento + FGTS elegível. A compra só ocorre com recursos disponíveis no início do mês; assim, a sobra provisória de um mês de aluguel não pode financiar uma aquisição que adiciona custos de proprietário no mesmo mês. Quando o alvo cobre o imóvel corrigido e os custos iniciais, o investimento é convertido no imóvel e eventual saldo remanescente continua aplicado.

## 9. Métricas Resumidas na Comparação
Principais números exibidos:
- Custo Mensal Médio: média dos fluxos de saída (parcelas, aluguel, custos) no período
- Custo Líquido (Net Cost): métrica legada de saídas menos `final_equity`; o ranking usa `final_wealth`
- Patrimônio Final: ativos (imóvel e investimentos) menos passivos por gastos obrigatórios não financiados
- ROI agregado: atualmente `null` (`N.D.` na interface), pois ainda não há série de fluxos suficiente para calcular TWR/XIRR de forma defensável
- ROI incluindo saques: também `null`; retiradas não são somadas de volta para fabricar uma taxa aproximada
- Mês de Equilíbrio: fica indisponível no resumo individual; um crossover válido exige comparação pareada entre estratégias
- Sustentabilidade (quando aplicável): total retirado, meses insustentáveis, razão média retorno/retirada

Resumo comparativo (tabela “Comprar − Alugar”): o campo de percentual pode ficar **indisponível** quando o custo do aluguel no ponto analisado é 0. Nesse caso, o sistema retorna “sem valor” (e a interface pode mostrar “—”) para não mascarar o caso com 0%.

## 10. Limitações e Simplificações
- Imposto sobre investimentos pode ser considerado se configurado. No modo mensal, a alíquota efetiva reduz cada rendimento; no modo de resgate, ela só incide quando a simulação efetivamente retira recursos, de modo que saldos não resgatados permanecem brutos. Imposto sobre venda do imóvel não é modelado.
- Não modela vacância de aluguel nem eventos extraordinários de manutenção. Manutenção/seguro recorrentes estimados podem ser agregados em `owner_monthly_costs.other` ou `renter_monthly_costs.other`, conforme quem paga.
- Valor temporal do dinheiro (desconto a valor presente) não é aplicado nas métricas básicas
- Valores fora do plano são excluídos da simulação; não são uma reserva de caixa implícita

FGTS (cronologia simplificada usada no simulador):
- Quando há **amortização via FGTS** no financiamento, o FGTS é **atualizado no início do mês** (contribuição mensal + rendimento) e só depois pode ser sacado naquele mês.
- Quando há **uso de FGTS na compra** no cenário de compra financiada, a compra é tratada como evento no **início do mês 1**, então o saque de FGTS na compra não “pega” o rendimento do próprio mês 1.
- Em **investir e comprar à vista**, a elegibilidade usa apenas o saldo de FGTS disponível no início do mês. O depósito e o rendimento daquele mês aparecem no saldo ao fim do mês e só podem viabilizar uma compra a partir do mês seguinte.
- Após qualquer saque, existe janela de **carência (cooldown) de 24 meses** para novos saques com finalidade de amortização.
- Se o FGTS foi usado na compra do mês 1, uma política bienal de amortização começa no primeiro mês permitido pela carência (mês 25), sem desperdiçar a primeira oportunidade em uma tentativa bloqueada no mês 24.

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
anos_completos = floor((mes_atual - mes_base) / 12)
custo_ajustado = base * (1 + inflacao_anual/100) ** anos_completos
valor_imovel = base * (1 + valorizacao_anual/100) ** ((mes_atual - mes_base)/12)
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

### Lógica do plano mensal no aluguel

```text
obrigatorios = non_housing_expenses + housing_due
recursos = max(0, net_income + extra_income)
disposable_surplus = max(0, recursos - obrigatorios)
investment_allocation = disposable_surplus * wealth_allocation_percentage / 100
outside_plan_amount = disposable_surplus - investment_allocation
budget_deficit = max(0, obrigatorios - recursos)
income_after_non_housing = max(0, recursos - non_housing_expenses)
housing_paid = min(housing_due, income_after_non_housing)
housing_shortfall = max(0, housing_due - housing_paid)
rent_paid = min(rent_due, housing_paid)
rent_shortfall = max(0, rent_due - rent_paid)
```

`budget_deficit` mede toda a falta do orçamento obrigatório; `housing_shortfall` mede somente a parte da moradia não coberta depois de priorizar os gastos fora da moradia. Eles podem ser diferentes quando a renda não cobre nem os gastos não habitacionais.

Sem plano mensal, o cenário permanece exploratório e não participa de um ranking autoritativo.

### Critério de Compra à Vista
```text
recursos_elegiveis = investimento_liquido + fgts_elegivel
recursos_elegiveis >= valor_imovel_ajustado + custos_upfront
```

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
| Valor Fora do Plano | total_outside_plan |
| Déficit Acumulado | total_unfunded_amount |
| Status da Comparação | comparison_status |
| Retirada para Aluguel | rent_withdrawal_from_investment |
| Meses Insustentáveis | months_with_burn |
| Razão Retorno/Retirada | average_sustainable_withdrawal_ratio |
| Total Retirado | total_rent_withdrawn_from_investment |
| ROI Agregado (N.D.) | roi_percentage = null |
| ROI incl. Saques (N.D.) | roi_including_withdrawals_percentage = null |
| Mês de Equilíbrio | break_even |
