# Glossário (Visão do Usuário)

Este glossário prioriza os termos que você vê na interface em português. No final há uma tabela de mapeamento para quem deseja relacionar com os campos técnicos internos.

## Entradas Principais
- Valor do Imóvel Inicial: preço usado no mês 1 para começar a simulação.
- Poupança Total (mês 1): caixa total disponível no início da simulação. Precisa cobrir **Entrada + custos upfront (ITBI + escritura)** e, junto da renda mensal, habilita o ranking autoritativo.
- Entrada (Down payment): parte da poupança destinada à compra no cenário de financiamento (sai do caixa no momento da compra).
- Investimento Inicial: capital que começa aplicado no mês 1 para fins de comparação (derivado de `total_savings` quando fornecido; não é um campo de entrada da API).
- Prazo do Financiamento (anos): duração do empréstimo (se houver).
- Horizonte da Decisão (anos): data do corte usada para comparar os três patrimônios; pode ser menor ou maior que o prazo do financiamento. Dívida ainda aberta permanece descontada do patrimônio.
- Sistema de Amortização: SAC ou PRICE.
- Taxa de Juros Anual (ou Mensal): quando restar principal financiado, informe exatamente uma; numa compra integralmente coberta por entrada + FGTS elegível, a taxa pode ser omitida.
- Aluguel Mensal: valor base inicial do aluguel; informe este campo ou o percentual, nunca ambos.
- Percentual de Aluguel (% a.m.): percentual **mensal** sobre o valor do imóvel, sem divisão por 12.
- Retornos de Investimento: períodos com taxa de retorno anual específica (permite cenários com mudança futura de taxa).
	- Regra: a primeira faixa deve começar no mês 1 (`start_month=1`), as faixas devem ser contíguas (sem gaps) e a última deve ser aberta (`end_month=null`).
- Amortizações Extras: pagamentos extras para reduzir o saldo do financiamento mais rápido (valor ou % do saldo, únicos ou recorrentes).
- Custos Iniciais: ITBI, Escritura (percentuais) aplicados sobre o valor do imóvel na compra.
- Custos Mensais de Moradia: condomínio, IPTU e `other`, separados entre proprietário e inquilino. `other` agrega manutenção, seguro e outros custos recorrentes exclusivos da ocupação; despesas comuns às estratégias ficam em gastos fora da moradia.
- Inflação Geral: reajusta valores que não têm taxa própria.
- Inflação do Aluguel: reajuste específico do aluguel (se diferente da geral).
- Valorização do Imóvel: crescimento estimado do preço do imóvel ao longo do tempo.
- Aportes Programados: aportes pontuais ou recorrentes. Por padrão aplicam-se às três estratégias; direcioná-los a apenas algumas torna o resultado `incomparable`.
- Renda Líquida Mensal: fonte recorrente comum usada para financiar moradia e aportes; necessária, junto da poupança total, para validar a viabilidade.
- Ajustar Renda pela Inflação: atualiza a renda pelo índice geral antes da reconciliação mensal.

## Campos Mensais (Exibidos ou Derivados)
- Mês: número sequencial da simulação.
- Fluxo de Caixa: saída líquida ou entrada (negativo significa saída de dinheiro).
- Patrimônio (Equity): valor do imóvel menos dívida remanescente mais parte investida relevante.
- Saldo Investido: total aplicado após aportes, retiradas e retorno do mês.
- Valor do Imóvel: preço projetado naquele mês.
- Outros Custos de Moradia: manutenção, seguro e demais custos recorrentes exclusivos do perfil de ocupação naquele mês.
- Juros / Amortização: componentes da parcela (quando financiado).
- Parcela Base: parcela do financiamento sem considerar amortizações extras do mês.
- Amortização Base: parte do principal amortizada pela parcela base (sem extras).
- Amortização Extra (Cash/FGTS/Bônus/13º): pagamentos adicionais que reduzem o saldo devedor além da parcela base, classificados por origem.
- Aluguel Devido: valor do aluguel previsto para aquele mês (já com reajuste, se houver).
- Aluguel Pago: valor efetivamente coberto pelas fontes modeladas.
- Shortfall do Aluguel: diferença quando o aluguel devido não conseguiu ser totalmente coberto pelas fontes modeladas (indica necessidade de caixa/crédito fora do modelo).
- Retirada para Aluguel: quanto saiu do investimento para pagar aluguel/custos.
- Saldo Antes do Retorno: quanto de capital ficou investido antes de aplicar o rendimento do mês.
- Razão Retorno/Retirada: quão perto você está da sustentabilidade (>=1 indica que o rendimento daquele mês cobriu a retirada).
	- Observação: a razão usa o **retorno líquido** (`investment_return_net`).
- Mês de Queima (Burn): marcado quando o retorno não cobre a retirada e parte do principal é reduzido.
- Cobertura da Renda: quanto da renda líquida cobriu os custos.
- Sobra Disponível: renda e rendas extras menos gastos fora da moradia e custo da moradia.
- Renda Efetiva: salário líquido do mês após o ajuste de inflação configurado.
- Destino para Patrimônio: porcentagem da sobra usada para investir ou amortizar.
- Fora do Plano: parte da sobra não alocada; representa consumo ou imprevistos e não entra na simulação.
- Saída de Caixa Necessária: gastos fora da moradia, moradia e destinos da sobra reconciliados naquele mês.
- Recursos Utilizados: parte da necessidade coberta pela renda e pelas rendas extras do mês.
- Caixa Residual: zero no contrato atual; a parte não alocada não acumula implicitamente.
- Valor Não Financiado: necessidade mensal que a renda e o caixa não cobriram.
- Déficit Acumulado: soma dos valores não financiados até o mês; compõe os passivos finais.

## Métricas Resumidas
- Custo Líquido: métrica legada de saídas menos `final_equity`; o ranking autoritativo usa `final_wealth` e viabilidade.
- Custo Mensal Médio: média dos fluxos de saída.
- Ativos Finais: imóvel/equity e investimentos antes dos passivos.
- Passivos Finais: obrigações que não foram cobertas pelos recursos modelados.
- Patrimônio Líquido Final: ativos finais menos passivos finais.
- Total de Juros ou Aluguel Pago: soma total de juros (financiamento) ou de aluguel (cenários sem financiamento).
- Total Retirado para Custos: soma das retiradas feitas para pagar aluguel/custos.
- Meses Insustentáveis: quantidade de meses em que a retirada não foi totalmente coberta pelo retorno.
- Razão Média Retorno/Retirada: média das razões mensais onde houve retirada.
- ROI Agregado: atualmente indisponível (`null` na API e `N.D.` na interface). Não equivale a zero; depende de uma futura série de fluxos adequada para TWR/XIRR.
- ROI Incluindo Saques: também indisponível pelo mesmo motivo; não é estimado somando retiradas ao patrimônio final.
- Mês de Equilíbrio: indisponível no resumo individual; um crossover requer comparação pareada entre estratégias.
- Viável: indica se todos os custos e aportes foram financiados pelos recursos informados.

## Status da Comparação

- Comparable (`comparable`): premissas comuns e ao menos um cenário viável; `best_scenario` pode ser preenchido.
- Exploratório (`exploratory`): falta poupança total ou plano mensal; não há vencedor autoritativo.
- Incomparável (`incomparable`): estado reservado para entradas internas com recursos assimétricos.
- Nenhum Cenário Viável (`no_feasible_scenario`): todos acumulam déficit com os recursos informados.

## Progresso (Investir para Comprar à Vista)
- Custo Alvo de Compra: valor do imóvel projetado + custos iniciais necessários.
- Recursos Elegíveis: valor líquido do investimento + FGTS permitido pela configuração.
- Progresso (%): quanto do alvo já foi alcançado pelos recursos elegíveis.
- Falta para Comprar: diferença restante.
- Mês de Compra: quando o alvo foi atingido e a compra acontece.
- Preço na Compra: valor do imóvel naquele mês.
- Mês Projetado de Compra: estimativa de quando atingirá o alvo (enquanto não alcançado).
- Meses Restantes Estimados: projeção do tempo faltante.

## Conceitos de Sustentabilidade
- Sustentabilidade: situação em que o rendimento mensal cobre a retirada para custos sem reduzir o principal.
- Queima (Burn): mês em que parte do principal é usada porque o rendimento não foi suficiente.

## Notas Gerais
- Os simuladores gerais usam valores nominais, sem desconto a valor presente; o planejador FIRE é a exceção e trabalha em dinheiro de hoje.
- Inflação de renda/custos é aplicada em degraus a cada 12 meses completos; valorização do imóvel usa a taxa mensal composta equivalente.
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
| Horizonte da Decisão | comparison_horizon_years |
| Sistema de Amortização | loan_type |
| Taxa de Juros Anual | annual_interest_rate |
| Taxa de Juros Mensal | monthly_interest_rate |
| Aluguel Mensal | rent_value |
| Percentual de Aluguel | rent_percentage |
| Retornos de Investimento | investment_returns |
| Amortizações Extras | amortizations |
| Custos Iniciais / Mensais | additional_costs |
| Outros custos do proprietário | additional_costs.owner_monthly_costs.other |
| Outros custos do inquilino | additional_costs.renter_monthly_costs.other |
| Inflação Geral | inflation_rate |
| Inflação do Aluguel | rent_inflation_rate |
| Valorização do Imóvel | property_appreciation_rate |
| Plano Mensal | monthly_plan |
| Renda Líquida Mensal | monthly_plan.net_income |
| Gastos Fora da Moradia | monthly_plan.non_housing_expenses |
| Ajustar Valores pela Inflação | monthly_plan.adjust_for_inflation |
| Percentual da Sobra para Patrimônio | monthly_plan.wealth_allocation_percentage |
| Percentual para Amortização | monthly_plan.financed_purchase.amortization_percentage |
| Efeito da Amortização | monthly_plan.financed_purchase.amortization_effect |
| Rendas Extras | extra_income_events |
| Fluxo de Caixa | cash_flow |
| Patrimônio (Equity) | equity |
| Saldo Investido | investment_balance |
| Valor do Imóvel | property_value |
| Juros do Mês | interest_payment |
| Parcela (total) | installment |
| Parcela (base) | installment_base |
| Amortização do Mês (total) | principal_payment |
| Amortização do Mês (base) | principal_base |
| Amortização Extra (cash) | extra_amortization_cash |
| Amortização Extra (FGTS) | extra_amortization_fgts |
| Amortização Extra (Bônus) | extra_amortization_bonus |
| Amortização Extra (13º) | extra_amortization_13_salario |
| Aluguel Pago | rent_paid |
| Aluguel Devido | rent_due |
| Shortfall do Aluguel | rent_shortfall |
| Moradia Devida | housing_due |
| Moradia Paga | housing_paid |
| Shortfall da Moradia | housing_shortfall |
| Outros Custos de Moradia | monthly_other_costs |
| Retirada para Aluguel | rent_withdrawal_from_investment |
| Saldo Antes do Retorno | remaining_investment_before_return |
| Razão Retorno/Retirada | sustainable_withdrawal_ratio |
| Mês de Queima | burn_month |
| Renda Efetiva | effective_income |
| Necessidade Mensal | required_cash_outflow |
| Recursos Utilizados | funded_from_resources |
| Caixa Residual | residual_cash_balance |
| Sobra Disponível | disposable_surplus |
| Destino para Patrimônio | wealth_allocation |
| Investimento da Sobra | investment_allocation |
| Amortização da Sobra | extra_amortization_allocation |
| Fora do Plano | outside_plan_amount |
| Valor Não Financiado | unfunded_amount |
| Déficit Acumulado | cumulative_unfunded_amount |
| Retorno do Investimento (bruto) | investment_return_gross |
| Imposto pago (aprox.) | investment_tax_paid |
| Retorno do Investimento (líquido) | investment_return_net |
| Custo Líquido | net_cost |
| Saídas Totais | total_outflows |
| Equity/Ativos do Simulador (legado) | final_equity |
| Ativos Finais | final_assets |
| Passivos Finais | final_liabilities |
| Patrimônio Líquido Final | final_wealth |
| Variação Patrimonial | net_worth_change |
| Cenário Viável | is_feasible |
| Primeiro Mês sem Recursos | first_unfunded_month |
| Total sem Recursos | total_unfunded_amount |
| Tipo Estável do Cenário | scenario_type |
| Status da Comparação | comparison_status |
| Melhor Tipo de Cenário | best_scenario_type |
| Versão do Cálculo | calculation_version |
| Avisos | warnings / comparison_warnings |
| ROI Agregado (N.D.) | roi_percentage = null |
| ROI incl. Saques (N.D.) | roi_including_withdrawals_percentage = null |
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
