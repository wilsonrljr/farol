# Guia Rápido

Entenda e compare rapidamente três estratégias:
1. Comprar financiado
2. Alugar e investir
3. Investir até comprar à vista

---
## 1. Campos Essenciais (interface)
| Rótulo | Exemplo | O que representa |
|--------|---------|------------------|
| Valor do Imóvel | 500.000 | Preço atual do imóvel que você avalia comprar |
| Entrada | 100.000 | Capital disponível hoje para iniciar |
| Prazo (anos) | 30 | Duração do financiamento (se comprar agora) |
| Juros (Anual ou Mensal) | 10% a.a. | Custo do financiamento |
| Sistema (SAC / PRICE) | PRICE | Forma de amortização das parcelas |
| Aluguel (R$) ou % a.m. | 2.500 ou 0,5% | Aluguel mensal estimado; 0,5% de R$ 500.000 = R$ 2.500/mês |
| Retornos de Investimento | 8% a.a. | Rentabilidade esperada do capital investido |
| Custos (ITBI/Escritura/Condomínio/IPTU) | 2% / 1% / 0 / 0 | Custos adicionais do imóvel (compra e mensais) |

Campos opcionais depois: Inflação, Valorização, Amortizações Extras, FGTS, tributação e aportes programados. Poupança total e renda líquida mensal são necessárias para um ranking autoritativo.

---
## 2. Como Rodar
1. Preencha os campos essenciais.
2. Ative “Mostrar avançado” se quiser ajustar inflação, valorização, amortizações, renda líquida etc.
3. Marque “Métricas avançadas” para ver patrimônio, sustentabilidade e diferenças mensais. O ROI agregado permanece `N.D.` enquanto não houver série de fluxos suficiente para TWR/XIRR.
4. Clique em “Comparar Cenários”.

---
## 2.1 Regras importantes (API / modelo)
- `additional_costs` é **obrigatório**. Se não souber, use uma aproximação inicial: ITBI=2%, escritura/registro=1%, condomínio/IPTU=0.
- Informe exatamente uma taxa do financiamento: `annual_interest_rate` ou `monthly_interest_rate`.
- Informe exatamente uma forma de aluguel: `rent_value` ou `rent_percentage`. O percentual é mensal (% a.m.).
- `investment_returns` precisa:
	- começar em `start_month=1`
	- ser contínuo (sem “buracos” entre faixas)
	- terminar com a última faixa aberta (`end_month=null`)
- `total_savings` precisa cobrir entrada + ITBI + escritura. Sem ele ou sem `monthly_net_income`, o resultado é exploratório e não declara vencedor.

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
| Patrimônio líquido final | Ativos (imóvel, investimentos e caixa residual) menos passivos por recursos não financiados. |
| Viabilidade | Confirma se renda e caixa financiaram todos os custos e aportes; mostra primeiro mês e total do déficit quando não. |
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
### Comprar Financiado
Pagamentos mensais (juros + amortização) + custos. Patrimônio cresce via amortização e valorização.

### Alugar e Investir
O caixa que não foi consumido por uma compra permanece aplicado. A simulação registra aluguel devido, valor efetivamente financiado pelas fontes modeladas e eventual déficit.

### Investir e Comprar à Vista
Acumula investimento e a sobra do orçamento em uma reserva de caixa sem rendimento. A compra acontece quando investimento líquido + caixa + FGTS elegível cobrem imóvel valorizado e custos; `cash_reserve_used_for_purchase` mostra quanto da reserva foi usado naquele mês.

---
## 5. Viabilidade e sustentabilidade

O ledger usa primeiro a renda do mês e o caixa residual. A sobra fica em caixa sem rendimento; o que faltar vira passivo e torna o cenário inviável. Nos cenários com retirada do investimento, os indicadores de sustentabilidade continuam mostrando quando o rendimento cobre a retirada e quando há queima de principal.

---
## 6. Dicas de Exploração
- Teste diferentes retornos (ex: 6%, 8%, 10%) para sensibilidade.
- Aplique amortizações extras anuais para ver impacto em juros.
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
| Juros Anual / Mensal | annual_interest_rate / monthly_interest_rate |
| Sistema | loan_type |
| Aluguel (R$ / %) | rent_value / rent_percentage |
| Retornos de Investimento | investment_returns |
| Aportes programados | contributions |
| Poupança total | total_savings |
| Renda líquida mensal | monthly_net_income |
| Ajustar renda pela inflação | monthly_net_income_adjust_inflation |
| Status da comparação | comparison_status |
| Caixa residual | residual_cash_balance |
| Caixa usado na compra à vista | cash_reserve_used_for_purchase |
| Passivos finais | final_liabilities |

Esse quadro é apenas para usuários avançados / integração.
