# Farol

Farol é uma plataforma de simulação e planejamento financeiro focada inicialmente em cenários imobiliários no Brasil, com visão de expansão para outros objetivos (ex: veículo, reservas, grandes compras).

<details open>
<summary><strong>Comparação de cenários</strong></summary>

&nbsp;
![Comparação de cenários](docs/assets/comparacao.gif)

</details>

<details>
<summary><strong>Simular financiamento</strong></summary>

&nbsp;
![Simular financiamento](docs/assets/simulacao.gif)

</details>

## Autor
Wilson Rocha Lacerda Junior – desenvolvedor da biblioteca open source de Aprendizado de Máquina [SysIdentPy](https://github.com/wilsonrljr/sysidentpy).

Redes e contato:
- GitHub: https://github.com/wilsonrljr
- LinkedIn: https://www.linkedin.com/in/wilsonrljr
- ORCID: https://orcid.org/0000-0002-3263-1152

Para conversar: abra uma discussão, issue ou mande um PR. Ideias e feedback são bem-vindos.

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

## Tutorial para quem não sabe programação

Obs.: por enquanto é a opção mais fácil que consegui disponibilizar. Vou tentar publicar a aplicação em algum serviço web gratuito em breve (atualizarei aqui quando estiver online).

Se você só quer USAR o Farol no seu computador (sem aprender programação), siga um dos passo a passo abaixo. Eles usam o Docker para evitar instalações complicadas.

O que você vai fazer? (1) Instalar Docker Desktop, (2) rodar o “cérebro” (backend), (3) rodar a interface (frontend) e (4) abrir o navegador.

<details open>
<summary><strong>Windows (passo a passo)</strong></summary>

&nbsp;

1. (Só uma vez) Ativar o WSL
  - Abra o menu Iniciar, digite: powershell
  - Clique com botão direito: “Executar como administrador”.
  - Digite o comando abaixo e aperte Enter:
    ```bash
    wsl --install
    ```
  - Reinicie o computador se aparecer uma mensagem dizendo que deve reiniciar. Se não aparecer nada, pode fechar.

2. Instalar o Docker Desktop
  - Baixe em: https://www.docker.com/products/docker-desktop/
  - Instale aceitando as opções padrão. Se não quiser cadastrar uma conta, pode clicar na opção "skip" que fica no canto superior direito na tela de cadastro.
  - Abra o Docker Desktop e espere o ícone na barra de tarefas ficar estável (rodando).

3. Abrir um PowerShell normal (não precisa ser admin)
  - Dica: você pode copiar e colar os comandos abaixo.

4. Rodar o backend (cérebro da simulação)
  ```bash
  docker run -d --name farol-backend -p 8000:8000 "wilsonrljr/farol-backend:0.1.0"
  ```

5. Testar se o backend respondeu
  - Abra: http://localhost:8000/docs — se abrir a página interativa, está ok.

6. Rodar o frontend (interface web)
  ```bash
  docker run -d --name farol-frontend -p 8080:80 ^
    -e VITE_API_BASE=http://localhost:8000 ^
    "wilsonrljr/farol-frontend:0.1.1"
  ```
  (No PowerShell o `^` quebra linha. Se preferir, pode colocar tudo em uma linha.)

7. Usar o Farol
  - Acesse: http://localhost:8080

8. Encerrar quando não estiver usando
  ```bash
  docker stop farol-frontend farol-backend
  ```

9. Atualizar para nova versão (quando anunciado)
  Substitua as tags e force baixar de novo:
  ```bash
  docker pull wilsonrljr/farol-backend:0.1.2
  docker pull wilsonrljr/farol-frontend:0.1.2
  docker stop farol-frontend farol-backend 2>$null
  docker rm farol-frontend farol-backend 2>$null
  ```
  Depois repita os passos 4 e 6 com as novas tags.

10. Problemas comuns

| Problema | O que significa | Como resolver |
|----------|-----------------|----------------|
| Página não abre | Frontend ainda iniciando | Aguarde 5–10s e recarregue |
| http://localhost:8000/docs não abre | Backend não subiu | Veja se o Docker Desktop está aberto / tente `docker logs farol-backend` |
| Porta em uso | Já tem algo nas portas 8000/8080 | Troque mapeamento: `-p 8001:8000` e `-p 8081:80` (e use a nova URL) |
| Versão antiga | Imagem cache local | Rode `docker pull ...` das duas imagens e reinicie |
| Erro de rede na simulação | Frontend não acha backend | Confirme a variável `VITE_API_BASE` |
| Mensagem sobre CORS | Navegador bloqueou origem | Abra issue (backend libera origens) |

Pronto: esses são os passos mínimos no Windows.

</details>

<details>
<summary><strong>macOS (passo a passo)</strong></summary>

&nbsp;

Funciona em Intel e Apple Silicon (M1/M2/M3). Versões exemplo:

1. Instalar Docker Desktop
  - Baixe: https://www.docker.com/products/docker-desktop/
  - Arraste para Aplicativos e abra. Conceda permissões se solicitar.

2. Confirmar que o Docker está rodando
  - Ícone da baleia deve aparecer na barra de menus (topo). Espere “Docker is running”.

3. Abrir o Terminal (Spotlight: ⌘ + Espaço → “Terminal”)

4. Rodar backend
  ```bash
  docker run -d --name farol-backend -p 8000:8000 wilsonrljr/farol-backend:0.1.0
  ```

5. Testar backend: abra http://localhost:8000/docs

6. Rodar frontend
  ```bash
  docker run -d --name farol-frontend -p 8080:80 \
    -e VITE_API_BASE=http://localhost:8000 \
    wilsonrljr/farol-frontend:0.1.1
  ```

7. Usar: http://localhost:8080

8. Parar quando terminar
  ```bash
  docker stop farol-frontend farol-backend
  ```

9. Atualizar versões
  ```bash
  docker pull wilsonrljr/farol-backend:0.1.2
  docker pull wilsonrljr/farol-frontend:0.1.2
  docker stop farol-frontend farol-backend 2>/dev/null || true
  docker rm farol-frontend farol-backend 2>/dev/null || true
  ```
  Refaça os passos 4 e 6 com as novas tags.

10. Problemas comuns

| Problema | Significado | Ação |
|----------|-------------|------|
| Página vazia | Frontend iniciando | Aguarde e recarregue |
| Não abre /docs | Backend não subiu | `docker ps` / `docker logs farol-backend` |
| Porta já usada | Outra app usa 8000/8080 | Troque para 8001 / 8081 |
| Versão antiga | Cache local | `docker pull` das imagens |
| Erro rede simulação | Variável API errada | Confirme `VITE_API_BASE` |

Pronto: usando o Farol no macOS.

</details>

---

---

### (Opcional) Uso com Docker Compose
Se preferir orquestrar tudo com Compose (dev com hot reload ou modo produção), as seções abaixo permanecem disponíveis.

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
Este projeto está licenciado sob a **GNU Affero General Public License v3 (AGPL-3.0)**.

Em resumo (não substitui o texto completo em `LICENSE`):
- Você pode usar, estudar, modificar e redistribuir.
- Se disponibilizar uma **versão modificada** acessível por rede (ex: aplicação web / API SaaS), deve oferecer o **código fonte completo** (incluindo suas modificações) aos usuários que interagem com o serviço.
- Deve manter avisos de copyright e a mesma licença nas redistribuições.
- Não há garantias ( software fornecido “no estado em que se encontra” ).

Racional da escolha: garantir que melhorias em versões hospedadas publicamente retornem à comunidade e evitar o "SaaS loophole" existente em licenças como MIT ou GPL simples.

Se você deseja discutir um acordo de uso diferente (ex: licença comercial dual), abra uma discussão.

Copyright © 2025 Wilson Rocha Lacerda Junior.
