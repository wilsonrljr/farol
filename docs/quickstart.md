# Guia Rápido

Entenda e compare rapidamente três estratégias:
1. Comprar (à vista ou financiado)
2. Alugar e investir
3. Investir até comprar à vista

---
## 1. Campos Essenciais (interface)
| Rótulo | Exemplo | O que representa |
|--------|---------|------------------|
| Valor do Imóvel | 500.000 | Preço atual do imóvel que você avalia comprar |
| Aluguel inicial | 2.500 | Primeiro mês de uma moradia equivalente, sem os demais custos mensais de moradia |
| Horizonte da decisão | 10 anos | Momento em que os patrimônios das três estratégias serão comparados |
| Dinheiro destinado à decisão | 150.000 | Caixa líquido, fora do FGTS e da reserva de emergência |
| Entrada em dinheiro | 100.000 | Parcela do caixa usada na compra financiada |
| Salário líquido | 10.000 | Renda recorrente disponível antes dos gastos mensais informados |
| Gastos fora da moradia | 4.000 | Alimentação, transporte e demais gastos mensais agregados sem duplicar moradia |
| Sobra destinada a patrimônio | 70% | Parte do que restar após gastos e moradia usada para investir ou amortizar |
| Prazo do financiamento | 30 anos | Duração do empréstimo; não precisa ser igual ao horizonte |
| Juros (Anual ou Mensal) | 10% a.a. | Custo do financiamento |
| Sistema (SAC / PRICE) | PRICE | Forma de amortização das parcelas |
| Aluguel (R$) ou % a.m. | 2.500 ou 0,5% | Define o aluguel inicial; os meses seguintes usam o reajuste configurado |
| Retornos de Investimento | 8% a.a. | Rentabilidade esperada do capital investido |
| Custos de compra e moradia | 2% / 1% / 500 | ITBI/escritura e custos mensais separados entre proprietário e inquilino: condomínio, IPTU, manutenção, seguro e outros exclusivos |

Opções adicionadas somente quando necessárias: custos mensais de proprietário/inquilino, FGTS, retornos por período, tributação e rendas extras. O dinheiro inicial e o plano mensal são necessários para um ranking autoritativo.

---
## 2. Como Rodar
1. Em **Moradia**, informe preço, aluguel equivalente, horizonte e os custos mensais que realmente mudam entre ser proprietário e inquilino. Não repita aqui gastos comuns já incluídos fora da moradia.
2. Em **Compra**, separe o dinheiro disponível, a entrada e o FGTS. Se ainda houver saldo a financiar, informe prazo, sistema e uma taxa; se entrada + FGTS elegível cobrirem o imóvel, esses dados de financiamento não afetam o cálculo.
3. Em **Seu mês**, informe salário líquido e gastos fora da moradia. Escolha quanto da sobra vira patrimônio e, na compra financiada, como essa parcela se divide entre investimento e amortização. Os cartões mostram a conta do primeiro mês para cada estratégia.
4. Em **Premissas**, revise retornos, inflação, valorização, tributação e rendas extras somente quando fizerem parte do plano.
5. Em **Revisão**, confirme recursos, custos, taxas e a conta do primeiro mês, além do status de comparabilidade, antes de clicar em **Comparar as 3 estratégias**.

O ROI agregado permanece `N.D.` enquanto não houver série de fluxos suficiente para TWR/XIRR.

---
## 2.1 Regras importantes (API / modelo)
- `additional_costs` é **obrigatório**. Se não souber, use uma aproximação inicial: ITBI=2%, escritura/registro=1% e custos mensais iguais a zero. Use `owner_monthly_costs` para despesas exclusivas do proprietário e `renter_monthly_costs` para as atribuídas ao inquilino. Em cada perfil, `other` representa manutenção, seguro e outros recorrentes exclusivos; não use esse campo para gastos comuns já presentes em `monthly_plan.non_housing_expenses`. Payloads antigos com `monthly_hoa`/`monthly_property_tax` continuam aceitos e são migrados para os dois lados; não misture os dois formatos.
- Se houver principal financiado após entrada e FGTS elegível, `loan_term_years`, `loan_type` e exatamente uma taxa (`annual_interest_rate` ou `monthly_interest_rate`) são obrigatórios. Na compra sem principal financiado, prazo e sistema são opcionais quando há `comparison_horizon_years`, a taxa pode ser omitida e nunca se aceitam as duas representações juntas.
- Informe exatamente uma forma de aluguel: `rent_value` ou `rent_percentage`. O percentual é mensal (% a.m.).
- `comparison_horizon_years` define a data do corte patrimonial.
- `investment_returns` precisa:
	- começar em `start_month=1`
	- ser contínuo (sem “buracos” entre faixas)
	- terminar com a última faixa aberta (`end_month=null`)
- `total_savings` precisa cobrir entrada + ITBI + escritura. Sem ele ou sem `monthly_plan`, o resultado é exploratório e não declara vencedor.

### Status da comparação

| Status | Como interpretar |
|---|---|
| `comparable` | Premissas comuns e cenário viável; o ranking pode ser usado. |
| `exploratory` | Falta capital inicial ou renda; use para explorar, não para decidir pelo “melhor”. |
| `incomparable` | Algum recurso foi dado apenas a uma alternativa; compare depois de equalizar as premissas. |
| `no_feasible_scenario` | Nenhuma alternativa cabe nos recursos informados. |

Fora de `comparable`, `best_scenario` é nulo. Leia os avisos exibidos antes de interpretar gráficos ou custos.

---
## 3. O que Observar Primeiro
| Métrica na tela | Interpretação simples |
|-----------------|-----------------------|
| Custo Líquido | Métrica legada de saídas menos `final_equity`; use patrimônio líquido e viabilidade para a decisão. |
| Patrimônio líquido final | Ativos (imóvel e investimentos) menos passivos por gastos obrigatórios não financiados. |
| Viabilidade | Confirma se a renda financiou os gastos obrigatórios; mostra primeiro mês e total do déficit quando não. |
| ROI agregado | `N.D.` por enquanto; não interprete `roi_percentage` nem ROI incluindo saques como zero. |
| Custo Médio Mensal | Ritmo médio de desembolso. Ajuda a sentir a “pressão” mensal. |

Quando há retiradas (pagando aluguel do investimento):
| Indicador | Significado |
|-----------|-------------|
| Retirada de Aluguel | Quanto foi sacado do investimento para pagar aluguel/custos |
| Meses com Queima | Quantos meses os rendimentos não cobriram a retirada (capital foi consumido) |
| Rend/Ret (x) | Relação **retorno líquido do mês** (`investment_return_net`) / retirada. >1 significa sustentável naquele mês |

---
## 4. Resumo dos Cenários
### Comprar
Quando há financiamento, entram parcela (juros + amortização) e custos de proprietário; sem principal financiado, o cenário é apresentado honestamente como **Comprar à vista** e não inventa taxa ou parcela. O patrimônio acompanha o imóvel, investimentos paralelos e eventual saldo devedor.

### Alugar e Investir
O capital inicial equivalente permanece investido. Depois de salário, demais gastos e aluguel, a porcentagem escolhida da sobra também é investida. A simulação registra aluguel devido, valor pago e eventual déficit.

### Investir e Comprar à Vista
Investe a porcentagem escolhida da sobra enquanto o usuário aluga. A compra acontece quando investimento líquido + FGTS elegível cobrem imóvel valorizado e custos. Recursos novos de um mês só podem viabilizar a compra a partir do mês seguinte.

---
## 5. Viabilidade e sustentabilidade

O ledger desconta da renda os gastos fora da moradia e o custo de moradia. A porcentagem escolhida da sobra constrói patrimônio; o restante fica fora da simulação. O que faltar para gastos obrigatórios vira passivo e torna o cenário inviável.

---
## 6. Dicas de Exploração
- Teste diferentes retornos (ex: 6%, 8%, 10%) para sensibilidade.
- Varie a divisão entre investimento e amortização e compare reduzir prazo versus reduzir parcela.
- Varie inflação do aluguel separada da geral.
- Varie a renda mensal para identificar o primeiro déficit e a margem de caixa de cada cenário.

---
## 7. Se Quiser se Aprofundar
Consulte:
- Cálculos detalhados: `docs/calculations.md`
- Glossário de termos: `docs/glossary.md`

---
## 8. (Opcional) Mapeamento Técnico
| Rótulo (UI) | Nome técnico backend |
|-------------|----------------------|
| Valor do Imóvel | property_value |
| Entrada | down_payment |
| Horizonte da decisão | comparison_horizon_years |
| Prazo do financiamento | loan_term_years |
| Juros Anual / Mensal | annual_interest_rate / monthly_interest_rate |
| Sistema | loan_type |
| Aluguel (R$ / %) | rent_value / rent_percentage |
| Retornos de Investimento | investment_returns |
| Poupança total | total_savings |
| Plano mensal | monthly_plan |
| Renda líquida mensal | monthly_plan.net_income |
| Gastos fora da moradia | monthly_plan.non_housing_expenses |
| Percentual da sobra para patrimônio | monthly_plan.wealth_allocation_percentage |
| Percentual destinado a amortização | monthly_plan.financed_purchase.amortization_percentage |
| Reduzir prazo ou parcela | monthly_plan.financed_purchase.amortization_effect |
| Outros custos mensais do proprietário | additional_costs.owner_monthly_costs.other |
| Outros custos mensais do inquilino | additional_costs.renter_monthly_costs.other |
| Outros custos mensais no resultado | monthly_other_costs |
| Rendas extras | extra_income_events |
| Status da comparação | comparison_status |
| Valor fora do plano | outside_plan_amount |
| Investimento vindo da renda | investment_allocation |
| Amortização vinda da renda | extra_amortization_allocation |
| Passivos finais | final_liabilities |

Esse quadro é apenas para usuários avançados / integração.
