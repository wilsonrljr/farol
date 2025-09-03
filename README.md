# Farol

Farol é uma plataforma de simulação e planejamento financeiro focada inicialmente em cenários imobiliários no Brasil, com visão de expansão para outros objetivos (ex: veículo, reservas, grandes compras).

## Funcionalidades
- Simulação de financiamentos imobiliários nos sistemas SAC e PRICE.
- Comparação entre diferentes estratégias:
  - Comprar um imóvel com financiamento.
  - Alugar e investir o valor da entrada.
  - Investir até comprar à vista.
- Amortizações extraordinárias configuráveis ao longo do tempo.
 - Amortizações extraordinárias avançadas: eventos únicos, recorrentes, valores fixos ou % do saldo, ajuste opcional por inflação.
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

## Docker

### Ambiente de Desenvolvimento (hot reload)

Requisitos: Docker >= 24, Docker Compose Plugin.

Subir serviços (backend com reload + frontend Vite):

```bash
docker compose up --build
```

Endpoints:
- Backend API: http://localhost:8000/docs
- Frontend: http://localhost:5173

Parar:
```bash
docker compose down
```

### Ambiente de Produção (build otimizado)

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

Endpoints:
- App (frontend + assets): http://localhost:8080
- Backend (rede interna): http://backend:8000 (acessível via frontend e outros containers)

Logs:
```bash
docker compose logs -f
```

Derrubar produção:
```bash
docker compose -f docker-compose.prod.yml down
```

### Variáveis de Ambiente do Frontend
Use `VITE_API_BASE` para apontar para a API.

Exemplos:
```bash
# Build produção apontando para backend remoto
docker build -t farol-frontend --build-arg VITE_API_BASE=https://api.exemplo.com -f frontend/Dockerfile .
```

### Makefile (atalhos)
Se disponível:
```bash
make dev      # compose up (build) interativo
make prod     # produção detach
make down     # parar dev
make prod-down
make logs
```

### Limpeza / Rebuild
```bash
docker compose down -v
docker system prune -f
docker compose build --no-cache
```

### Estrutura de Imagens
- Backend: Python 3.13 slim, dependências instaladas via `pyproject.toml`.
- Frontend: build multi-stage (Node 20 -> Nginx 1.27) servindo arquivos estáticos.

### Ajustes Fututos Possíveis
- Adicionar scan de segurança (Trivy / Grype).
- Adicionar etapa de testes automatizados no build (multi-stage `test`).
- Usar um lockfile (ex: `uv` ou `pip-tools`) para reprodutibilidade estrita do backend.
- Ativar cache de dependências Node com `npm ci` + mount de cache de build se necessário.

---

Se encontrar problemas com porta em uso, verifique processos locais ou ajuste mapeamentos em `docker-compose.yml`.

## Testes

O projeto utiliza Pytest. Os antigos scripts de verificação manual na raiz foram migrados para testes automatizados.

Estrutura principal de testes:
```
backend/tests/
  test_additional_costs_calc.py          # custos adicionais (unit)
  test_api_additional_costs.py           # integração API custos adicionais
  test_additional_costs_scenarios.py     # variação de cenários com custos
  test_calculation_regressions.py        # regressões e sanity econômico
  test_inflation_params.py               # inflação + apreciação geral
  test_invest_then_buy_appreciation.py   # lógica invest-then-buy (compra + inflação)
  test_scenario_appreciation.py          # apreciação específica por cenário
  test_separate_inflation_params.py      # inflação separada (aluguel vs geral)
backend/app/tests/                       # métricas e ROI ajustado, savings externos
```

Configuração (`pytest.ini`):
```ini
[pytest]
testpaths = backend/tests backend/app/tests
python_files = test_*.py
addopts = -q
```

Executar toda a suíte:
```bash
pytest
```

Executar arquivo específico:
```bash
pytest backend/tests/test_additional_costs_calc.py
```

Executar teste específico:
```bash
pytest backend/tests/test_calculation_regressions.py::test_total_cost_positive_and_property_appreciates
```

Mais verboso:
```bash
pytest -vv
```

Cobertura (opcional se `pytest-cov` instalado):
```bash
pytest --cov=backend/app --cov-report=term-missing
```

Próximos passos sugeridos:
- Separar futuramente em `backend/tests/unit` e `backend/tests/integration` se crescer.
- Adicionar execução em pipeline CI antes do build de imagens.
- Incluir badge de status e/ou cobertura no topo do README.

## Uso
1. Acesse `http://localhost:5173`.
2. Explore:
  - Início: visão geral.
  - Simulação de Financiamento.
  - Comparação de Cenários.
  - Sobre: conceitos e metodologia.
    - Docs: documentação detalhada (Quickstart, Cálculos, Glossário).

## Estrutura Simplificada
```
backend/app/
  main.py       # FastAPI app (Farol API)
  models.py     # Pydantic models
  finance.py    # Lógica de simulação
frontend/       # React + Vite + Mantine
docs/           # quickstart.md, calculations.md, glossary.md
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
## Documentação Detalhada
Rotas no frontend em `/docs/*`:

| Página | URL | Conteúdo |
|--------|-----|----------|
| Quickstart | `/docs/quickstart` | Passo a passo mínimo de uso e leitura rápida das métricas. |
| Cálculos | `/docs/calculos` | Fórmulas e decisões de modelagem (PRICE/SAC, inflação, ROI, sustentabilidade). |
| Glossário | `/docs/glossario` | Definições de campos de entrada, saídas mensais e métricas agregadas. |

Arquivos fonte correspondentes em `docs/quickstart.md`, `docs/calculations.md`, `docs/glossary.md`.

- `total_cost` continua presente; agora é semanticamente o custo líquido (igual a `net_cost`). Clientes existentes não precisam mudar imediatamente.
- Novos campos podem ser adotados gradualmente no frontend.

## Amortizações Extra Avançadas

Agora é possível modelar aportes de redução de saldo de forma muito mais flexível:

### Formato (Backend `AmortizationInput`)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `month` | int? | Mês do primeiro evento (ou único). Default 1 se recorrente sem especificação. |
| `value` | float | Valor fixo em moeda ou percentual (quando `value_type=percentage`). |
| `value_type` | `"fixed" | "percentage"` | Interpretação do `value`. Default `fixed`. |
| `interval_months` | int? | Intervalo entre ocorrências (ex: 12 para anual). Ausente => evento único. |
| `occurrences` | int? | Número de repetições. Alternativa a `end_month`. |
| `end_month` | int? | Último mês (inclusivo) da recorrência. Ignorado se `occurrences` informado. |
| `inflation_adjust` | bool | Se `true`, valores fixos são corrigidos pela inflação a partir do mês inicial da série. |

### Regras de Expansão
1. Se apenas `month` e `value` forem informados, comportamento antigo (evento único) permanece.
2. Se `interval_months` > 0, gera-se a sequência: `month`, `month + interval`, ... até atingir `occurrences` ou `end_month` (ou o prazo do financiamento).
3. Para `value_type=percentage`, o valor aplicado em cada ocorrência é: `saldo_outstanding_do_mês * (value/100)` no momento da parcela.
4. Para `inflation_adjust=True` com `value_type=fixed`, cada ocorrência é ajustada por inflação acumulada desde o mês base (primeiro da série) usando a mesma taxa anual de inflação da simulação.
5. Múltiplas amortizações (fixas e/ou percentuais) no mesmo mês são somadas antes de limitar pelo saldo restante.

### Exemplo JSON
```json
[
  { "month": 12, "value": 10000, "interval_months": 12, "occurrences": 5, "value_type": "fixed", "inflation_adjust": true },
  { "month": 6, "value": 2.0, "interval_months": 6, "end_month": 36, "value_type": "percentage" },
  { "month": 18, "value": 5000 }
]
```

### Estratégias Possíveis
- Bônus anual de fim de ano: `interval_months=12`.
- Aporte semestral variável ao saldo: `%` a cada 6 meses.
- Combinação de aporte fixo + percentual no mesmo mês.
- Série limitada por número de ocorrências (ex: 3 bônus) ou até um mês limite (ex: até mês 60).

### Efeito na Simulação
Os aportes extras reduzem o saldo devedor, encurtando prazo (SAC/PRICE) e diminuindo juros totais. Percentuais se adaptam ao saldo residual, mantendo estratégia proporcional ao tempo. Valores inflacionados preservam poder real do aporte.

### Limitações Atuais / Próximos Passos
- Percentuais aplicam-se antes do cap do saldo (proporcional exato). Não há hoje teto combinado configurável (poderá ser adicionado se necessário).
- Visualização de estimativa de redução de prazo está apenas no frontend (preview simples). Poderá ser exposta via API futuramente.


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
