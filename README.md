# Farol

Farol é uma plataforma de simulação e planejamento financeiro focada inicialmente em cenários imobiliários no Brasil, com visão de expansão para outros objetivos (ex: veículo, reservas, grandes compras).

## Funcionalidades
- Simulação de financiamentos imobiliários nos sistemas SAC e PRICE.
- Comparação entre diferentes estratégias:
  - Comprar um imóvel com financiamento.
  - Alugar e investir o valor da entrada.
  - Investir até comprar à vista.
- Amortizações extraordinárias configuráveis ao longo do tempo.
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

## Uso
1. Acesse `http://localhost:5173`.
2. Explore:
  - Início: visão geral.
  - Simulação de Financiamento.
  - Comparação de Cenários.
  - Sobre: conceitos e metodologia.

## Estrutura Simplificada
```
backend/app/
  main.py       # FastAPI app (Farol API)
  models.py     # Pydantic models
  finance.py    # Lógica de simulação
frontend/       # React + Vite + Mantine
```

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
