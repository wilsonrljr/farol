# Glossário (Visão do Usuário)

Este glossário prioriza os termos que você vê na interface em português. No final há uma tabela de mapeamento para quem deseja relacionar com os campos técnicos internos.

## Entradas Principais
- Valor do Imóvel Inicial: preço usado no mês 1 para começar a simulação.
- Poupança Total (mês 1): caixa total disponível no início da simulação. Quando informada, precisa cobrir **Entrada + custos upfront (ITBI + escritura)**; o restante vira **Investimento Inicial**.
- Entrada (Down payment): parte da poupança destinada à compra no cenário de financiamento (sai do caixa no momento da compra).
- Investimento Inicial: capital que começa aplicado no mês 1 para fins de comparação (derivado de `total_savings` quando fornecido; não é um campo de entrada da API).
- Prazo do Financiamento (anos): duração do empréstimo (se houver).
- Sistema de Amortização: SAC ou PRICE.
- Taxa de Juros Anual (ou Mensal): informe apenas uma; a outra é calculada.
- Aluguel Mensal: valor base inicial do aluguel (ou use Percentual do Imóvel).
- Percentual de Aluguel (% a.a.): percentual anual sobre o valor do imóvel (dividido por 12 para o mês).
- Retornos de Investimento: períodos com taxa de retorno anual específica (permite cenários com mudança futura de taxa).
	- Regra: a primeira faixa deve começar no mês 1 (`start_month=1`), as faixas devem ser contíguas (sem gaps) e a última deve ser aberta (`end_month=null`).
- Amortizações Extras: pagamentos extras para reduzir o saldo do financiamento mais rápido (valor ou % do saldo, únicos ou recorrentes).
- Custos Iniciais: ITBI, Escritura (percentuais) aplicados sobre o valor do imóvel na compra.
- Custos Mensais: Condomínio, IPTU e similares.
- Inflação Geral: reajusta valores que não têm taxa própria.
- Inflação do Aluguel: reajuste específico do aluguel (se diferente da geral).
- Valorização do Imóvel: crescimento estimado do preço do imóvel ao longo do tempo.
- Investir Diferença Parcela x Aluguel: se ativado, quando o aluguel é menor que a parcela, a diferença é investida.
- Aporte Mensal Fixo: valor que você adiciona todo mês aos investimentos a partir de um mês escolhido.
- Usar Investimento para Pagar Aluguel: ativa retiradas para cobrir aluguel/custos (estratégia de viver de renda).
- Renda Externa Mensal: valor que cobre custos antes de tocar no investimento; a sobra só é investida quando o aluguel/custos são efetivamente pagos a partir do investimento (rent_reduces_investment=true).
- Investir Sobra da Renda Externa: reinveste automaticamente o que não foi usado da renda externa; se você paga o aluguel totalmente fora do investimento, use um aporte fixo em vez dessa combinação para evitar dupla contagem.

## Campos Mensais (Exibidos ou Derivados)
- Mês: número sequencial da simulação.
- Fluxo de Caixa: saída líquida ou entrada (negativo significa saída de dinheiro).
- Patrimônio (Equity): valor do imóvel menos dívida remanescente mais parte investida relevante.
- Saldo Investido: total aplicado após aportes, retiradas e retorno do mês.
- Valor do Imóvel: preço projetado naquele mês.
- Juros / Amortização: componentes da parcela (quando financiado).
- Aluguel Devido: valor do aluguel previsto para aquele mês (já com reajuste, se houver).
- Aluguel Pago: valor efetivamente pago a partir das fontes modeladas (renda externa + retiradas do investimento, quando habilitado).
- Shortfall do Aluguel: diferença quando o aluguel devido não conseguiu ser totalmente coberto pelas fontes modeladas (indica necessidade de caixa/crédito fora do modelo).
- Retirada para Aluguel: quanto saiu do investimento para pagar aluguel/custos.
- Saldo Antes do Retorno: quanto de capital ficou investido antes de aplicar o rendimento do mês.
- Razão Retorno/Retirada: quão perto você está da sustentabilidade (>=1 indica que o rendimento daquele mês cobriu a retirada).
	- Observação: a razão usa o **retorno líquido** (`investment_return_net`).
- Mês de Queima (Burn): marcado quando o retorno não cobre a retirada e parte do principal é reduzido.
- Cobertura Externa: quanto da renda externa cobriu os custos.
- Sobra Externa Reinvestida: parte não utilizada da renda externa adicionada ao investimento.

## Métricas Resumidas
- Custo Líquido: tudo que saiu menos o patrimônio final (imóvel + saldo investido).
- Custo Mensal Médio: média dos fluxos de saída.
- Patrimônio Final: valor atualizado do imóvel + investimentos remanescentes.
- Total de Juros ou Aluguel Pago: soma total de juros (financiamento) ou de aluguel (cenários sem financiamento).
- Total Retirado para Custos: soma das retiradas feitas para pagar aluguel/custos.
- Meses Insustentáveis: quantidade de meses em que a retirada não foi totalmente coberta pelo retorno.
- Razão Média Retorno/Retirada: média das razões mensais onde houve retirada.
- ROI: retorno percentual sobre as saídas totais do período (total_outflows).
- ROI (incl. saques): ROI que soma de volta retiradas feitas para pagar aluguel/custos quando o cenário usa o investimento para pagar despesas.
- Mês de Equilíbrio: primeiro mês em que o acumulado de fluxos deixa de ser negativo.

## Progresso (Investir para Comprar à Vista)
- Custo Alvo de Compra: valor do imóvel projetado + custos iniciais necessários.
- Progresso (%): quanto do alvo já foi alcançado pelo saldo investido.
- Falta para Comprar: diferença restante.
- Mês de Compra: quando o alvo foi atingido e a compra acontece.
- Preço na Compra: valor do imóvel naquele mês.
- Mês Projetado de Compra: estimativa de quando atingirá o alvo (enquanto não alcançado).
- Meses Restantes Estimados: projeção do tempo faltante.

## Conceitos de Sustentabilidade
- Sustentabilidade: situação em que o rendimento mensal cobre a retirada para custos sem reduzir o principal.
- Queima (Burn): mês em que parte do principal é usada porque o rendimento não foi suficiente.

## Notas Gerais
- Todos os valores são nominais (sem desconto a valor presente).
- Inflação e valorização são aplicadas de forma composta (juros sobre juros) mês a mês.
- Retornos de investimento presumem liquidez e reinvestimento imediato.
- Imposto sobre investimento (quando configurado) pode reduzir o retorno líquido mostrado.

---
## Mapeamento Técnico (Interface ↔ Campos Internos)
| Interface | Campo Interno |
|-----------|---------------|
| Valor do Imóvel Inicial | property_value |
| Poupança Total (mês 1) | total_savings |
| Entrada (Down payment) | down_payment |
| Investimento Inicial (derivado) | initial_investment |
| Prazo do Financiamento | loan_term_years |
| Sistema de Amortização | loan_type |
| Taxa de Juros Anual | annual_interest_rate |
| Taxa de Juros Mensal | monthly_interest_rate |
| Aluguel Mensal | rent_value |
| Percentual de Aluguel | rent_percentage |
| Retornos de Investimento | investment_returns |
| Amortizações Extras | amortizations |
| Custos Iniciais / Mensais | additional_costs |
| Inflação Geral | inflation_rate |
| Inflação do Aluguel | rent_inflation_rate |
| Valorização do Imóvel | property_appreciation_rate |
| Investir Diferença Parcela x Aluguel | invest_loan_difference |
| Aporte Mensal Fixo | fixed_monthly_investment |
| Início do Aporte Fixo | fixed_investment_start_month |
| Usar Investimento p/ Aluguel | rent_reduces_investment |
| Renda Externa Mensal | monthly_external_savings |
| Investir Sobra Externa | invest_external_surplus |
| Fluxo de Caixa | cash_flow |
| Patrimônio (Equity) | equity |
| Saldo Investido | investment_balance |
| Valor do Imóvel | property_value |
| Juros do Mês | interest_payment |
| Amortização do Mês | amortization |
| Aluguel Pago | rent_paid |
| Aluguel Devido | rent_due |
| Shortfall do Aluguel | rent_shortfall |
| Retirada para Aluguel | rent_withdrawal_from_investment |
| Saldo Antes do Retorno | remaining_investment_before_return |
| Razão Retorno/Retirada | sustainable_withdrawal_ratio |
| Mês de Queima | burn_month |
| Cobertura Externa | external_cover |
| Sobra Externa Reinvestida | external_surplus_invested |
| Retorno do Investimento (bruto) | investment_return_gross |
| Imposto pago (aprox.) | investment_tax_paid |
| Retorno do Investimento (líquido) | investment_return_net |
| Custo Líquido | net_cost |
| Saídas Totais | total_outflows |
| Patrimônio Final | final_equity |
| ROI | roi_percentage |
| ROI (incl. saques) | roi_including_withdrawals_percentage |
| Custo Mensal Médio | average_monthly_cost |
| Total Juros ou Aluguel | total_interest_or_rent_paid |
| Total Retirado para Custos | total_rent_withdrawn_from_investment |
| Meses Insustentáveis | months_with_burn |
| Razão Média Retorno/Retirada | average_sustainable_withdrawal_ratio |
| Custo Alvo de Compra | target_purchase_cost |
| Progresso (%) | progress_percent |
| Falta para Comprar | shortfall |
| Mês de Compra | purchase_month |
| Preço na Compra | purchase_price |
| Mês Projetado de Compra | projected_purchase_month |
| Meses Restantes Estimados | estimated_months_remaining |

---
## Observação de Auditoria
Esses campos técnicos podem ser inspecionados na resposta JSON da API caso você deseje validar cálculos detalhadamente.
