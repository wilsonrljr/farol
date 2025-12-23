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
| Aluguel (R$) ou % | 2.500 ou 0,5% | Aluguel mensal estimado (ou % do valor dividido por 12) |
| Retornos de Investimento | 8% a.a. | Rentabilidade esperada do capital investido |

Campos opcionais depois: Inflação, Valorização, Amortizações Extras, “Aluguel consome investimento”, Renda externa para custos, Aporte fixo.

---
## 2. Como Rodar
1. Preencha os campos essenciais.
2. Ative “Mostrar avançado” se quiser ajustar inflação, valorização, amortizações, renda externa etc.
3. Marque “Métricas avançadas” para ver indicadores adicionais (ROI, sustentabilidade, diferenças mensais).
4. Clique em “Comparar Cenários”.

---
## 3. O que Observar Primeiro
| Métrica na tela | Interpretação simples |
|-----------------|-----------------------|
| Custo Líquido | Quanto de dinheiro efetivamente “foi embora” após considerar o patrimônio final. Quanto menor, melhor. |
| Patrimônio | Soma do valor do imóvel (se comprado) + saldo investido final. |
| Equidade | Parte do patrimônio ligada ao imóvel (valor – dívida) + saldo investido residual. |
| ROI | Retorno percentual sobre o capital inicial comprometido. |
| Custo Médio Mensal | Ritmo médio de desembolso. Ajuda a sentir a “pressão” mensal. |

Quando há retiradas (pagando aluguel do investimento):
| Indicador | Significado |
|-----------|-------------|
| Retirada de Aluguel | Quanto foi sacado do investimento para pagar aluguel/custos |
| Meses com Queima | Quantos meses os rendimentos não cobriram a retirada (capital foi consumido) |
| Rend/Ret (x) | Relação rendimento do mês / retirada. >1 significa sustentável naquele mês |

---
## 4. Resumo dos Cenários
### Comprar Financiado
Pagamentos mensais (juros + amortização) + custos. Patrimônio cresce via amortização e valorização.

### Alugar e Investir
Entrada aplicada em investimento. Pode ou não consumir investimento para pagar aluguel (conforme opção). Permite observar sustentabilidade de “viver de renda”.

### Investir e Comprar à Vista
Acumula até ter o valor total necessário (imóvel valorizado + custos). Converte parte do investimento em imóvel no mês da compra.

---
## 5. Sustentabilidade (opcional)
Se “Aluguel consome investimento” estiver ativo:
- Retirada = aluguel + custos não cobertos por renda externa.
- Rendimentos > Retirada → preserva principal.
- Rendimentos < Retirada → “Queima” (reduz capital). Muitos meses de queima = estratégia menos sustentável.

---
## 6. Dicas de Exploração
- Teste diferentes retornos (ex: 6%, 8%, 10%) para sensibilidade.
- Aplique amortizações extras anuais para ver impacto em juros.
- Varie inflação do aluguel separada da geral.
- Simule renda externa alta + investir sobra para ver aceleração de acumulação.

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
| Aporte Mensal Fixo | fixed_monthly_investment |
| Aluguel consome investimento | rent_reduces_investment |
| Renda Externa p/ Custos | monthly_external_savings |
| Investir sobra externa | invest_external_surplus |
Nota: a sobra da renda externa só é investida quando o aluguel/custos são pagos a partir do investimento (rent_reduces_investment=true). Se você paga aluguel totalmente por fora e quer investir um valor mensal, prefira um aporte fixo.

Esse quadro é apenas para usuários avançados / integração.

