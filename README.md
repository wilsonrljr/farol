# Farol

Farol é uma plataforma de simulação e planejamento financeiro focada inicialmente em cenários imobiliários no Brasil, com visão de expansão para outros objetivos (ex: veículo, reservas, grandes compras).

## Autor
Wilson Rocha Lacerda Junior – desenvolvedor da biblioteca open source [SysIdentPy](https://github.com/wilsonrljr/sysidentpy). Entusiasta de modelagem matemática, identificação de sistemas, simulação financeira e engenharia de software. O Farol nasce do mesmo princípio de transparência e reprodutibilidade presente no trabalho com SysIdentPy: tornar cálculos, premissas e trade-offs claros para apoiar decisões informadas.

Redes e contato:
- GitHub: https://github.com/wilsonrljr
- LinkedIn: https://www.linkedin.com/in/wilsonrljr
- Twitter/X: https://twitter.com/wilsonrljr
- ORCID: https://orcid.org/0000-0002-3263-1152

Para conversar: abra uma issue ou mande um PR. Ideias e feedback são bem-vindos.

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

## Tecnologias
Backend: Python (FastAPI, Pydantic, NumPy, Pandas, Matplotlib)
Frontend: React + Vite + TypeScript + Mantine UI

## Instalação (Dev)
Você pode usar `uv` (recomendado) ou `pip`.

Backend com `uv`:
```bash
uv sync --extra dev
uv run pytest        # opcional
uv run uvicorn backend.app.main:app --reload
```

Backend com `pip`:
```bash
pip install -e .[dev]
pytest -q            # opcional
uvicorn backend.app.main:app --reload
```

Gerar/atualizar lock (cria `uv.lock`):
```bash
uv lock
```

Frontend (em outro terminal):
```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173

## Docker

### Guia Super Simples (Usuário sem conhecimento técnico)
Objetivo: abrir o Farol no navegador sem instalar nada além de Docker.
Tempo estimado (primeira vez): 5–10 min (download de imagens).

#### Passo 1. Instalar Docker
Windows / macOS: https://www.docker.com/products/docker-desktop/ (instale, abra e deixe rodando).
Linux: busque "Instalar Docker Engine <sua distro>" (Ubuntu, Fedora, etc.).

#### Passo 2. Baixar o projeto
Método fácil (ZIP):
1. Vá em https://github.com/wilsonrljr/farol
2. Botão verde "Code" → "Download ZIP"
3. Extraia para uma pasta simples (ex: Desktop/farol)

Método alternativo (Git opcional):
```bash
git clone https://github.com/wilsonrljr/farol.git
```

#### Passo 3. Abrir o terminal (linha de comando)
Terminal é um programa para digitar comandos:
- Windows: Abra o menu Iniciar, digite "PowerShell" ou "CMD" e Enter. OU na pasta extraída clique na barra de endereço, digite `powershell` e Enter.
- macOS: Pressione ⌘ + Espaço, digite "Terminal" e Enter.
- Linux: Geralmente Ctrl + Alt + T abre. Caso contrário procure por "Terminal".

#### Passo 4. Ir até a pasta do projeto
Use o comando `cd` (change directory) (copie e cole o comando abaixo):
```bash
# Windows (PowerShell) – ajuste Desktop para o caminho que você escolheu se necessário
cd "$env:USERPROFILE\Desktop\farol"

# macOS / Linux
cd ~/Desktop/farol
```

Verifique se está certo listando arquivos:
```bash
ls
```
Você deve ver coisas como: `docker-compose.yml`, `backend`, `frontend`, `README.md`.

Se NÃO aparecer, revise o caminho (talvez a pasta tenha nome `farol-main`).

#### Passo 5. Subir a aplicação
Com Docker Desktop aberto:
```bash
docker compose up --build
```
Fique aguardando; a primeira execução faz download. Ao ver mensagens do backend e uma linha do Vite com "ready in", prossiga.

#### Passo 6. Abrir no navegador
- Interface principal: http://localhost:5173
- (Opcional) Documentação da API: http://localhost:8000/docs

#### Passo 7. Parar
No mesmo terminal: CTRL + C.
Limpar containers (opcional):
```bash
docker compose down
```

#### Passo 8. (Opcional) Usar modo produção local (tudo em uma porta)
```bash
docker compose -f docker-compose.prod.yml up --build
```
Acesse: http://localhost:8080
Parar: CTRL + C e (opcional):
```bash
docker compose -f docker-compose.prod.yml down
```

#### Passo 9. Atualizar para nova versão (sem Git)
1. Pare (CTRL + C)
2. Apague a pasta antiga
3. Baixe novo ZIP e repita passos 2–8

#### Passo 10. Problemas comuns
| Sintoma | Causa provável | Como resolver |
|---------|----------------|----------------|
| Porta 5173 ou 8000 em uso | Outro app ocupando porta | Feche app ou reinicie Docker Desktop |
| Página não abre | Ainda construindo dependências | Aguarde até ver "ready in" |
| Comando não encontrado | Docker não instalado / digitado errado | Verifique instalação / use `docker compose` com espaço |
| Muito lento | Primeiro download de imagens | Normal; próximas vezes serão rápidas |
| Ficou travado | Cache local inconsistente | CTRL + C e rode: `docker compose down` depois `docker compose up --build` |

Pronto. Você não precisa saber programar: só seguir esses 10 passos.

### Ambiente de Desenvolvimento (hot reload)
Requisitos: Docker >= 24, Docker Compose Plugin.

Subir (backend com reload + frontend Vite):
```bash
docker compose up --build
```
Endpoints:
- Backend: http://localhost:8000/docs
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
- App: http://localhost:8080
- Backend (rede interna): http://backend:8000

Logs:
```bash
docker compose logs -f
```

Derrubar:
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

## Uso
1. Acesse `http://localhost:5173`.
2. Explore:
  - Início: visão geral.
  - Simulação de Financiamento.
  - Comparação de Cenários.
  - Sobre: conceitos e metodologia.
    - Docs: documentação detalhada (Quickstart, Cálculos, Glossário).


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

## Exportação de Resultados
É possível exportar dados das simulações e comparações em CSV ou XLSX.

## Documentação Detalhada
Rotas no frontend em `/docs/*`:

| Página | URL | Conteúdo |
|--------|-----|----------|
| Quickstart | `/docs/quickstart` | Passo a passo mínimo de uso e leitura rápida das métricas. |
| Cálculos | `/docs/calculos` | Fórmulas e decisões de modelagem (PRICE/SAC, inflação, ROI, sustentabilidade). |
| Glossário | `/docs/glossario` | Definições de campos de entrada, saídas mensais e métricas agregadas. |

Arquivos fonte correspondentes em `docs/quickstart.md`, `docs/calculations.md`, `docs/glossary.md`.

## Amortizações Extra Avançadas

É possível modelar aportes de redução de saldo de forma muito mais flexível:

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

## Variáveis de Ambiente
Ver `.env.example` para chaves como `APP_NAME`, `API_TITLE`, `API_DESCRIPTION`.

## Licença
Definir licença (MIT / Apache 2.0, etc.).
