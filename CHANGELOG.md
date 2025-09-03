# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog (https://keepachangelog.com/en/1.0.0/) and this project adheres (for now informally) to Semantic Versioning.

## [0.1.0] - 2025-09-02
### Added
- Primeira versão pública (MVP) da plataforma Farol focada em cenários imobiliários no Brasil.
- Simulação de financiamento imobiliário nos sistemas SAC e PRICE (`/api/simulate-loan`).
- Comparação de três estratégias habitacionais: comprar financiado, alugar e investir, investir até comprar à vista (`/api/compare-scenarios`).
- Versão aprimorada de comparação com métricas avançadas e resumo mês a mês (`/api/compare-scenarios-enhanced`).
- Estrutura de amortizações extraordinárias avançadas:
  - Eventos únicos ou recorrentes (`interval_months`, `occurrences`/`end_month`).
  - Valor fixo ou percentual do saldo (`value_type = fixed | percentage`).
  - Ajuste inflacionário opcional por série (`inflation_adjust`).
  - Soma de múltiplas amortizações no mesmo mês.
- Suporte a múltiplas faixas de retorno de investimento (variação temporal de taxa) via `investment_returns`.
- Modelagem de custos adicionais: ITBI, escritura, condomínio, IPTU (upfront + mensais) com ajuste por inflação.
- Taxas de inflação diferenciadas: geral, aluguel, valorização do imóvel.
- Cenário "Investir e comprar à vista" com tracking de progresso, marcos (25/50/75/90/100%), projeção de compra e distinção pré/pós compra.
- Novos campos de resultado: `total_outflows`, `net_cost`, `cash_flow` assinado, `wealth_accumulation`, métricas comparativas (ROI, break-even, etc.).
- Frontend (React + Vite + Mantine): formulários de simulação, comparação, página Sobre, componentes de UI (cards, métricas, grids) e preview de amortizações recorrentes.
- Testes automatizados abrangendo: juros, inflação, amortizações extras (incl. recorrentes e percentuais), valorização específica e cenários combinados.

### Changed
- Semântica de `total_cost`: agora tratado como custo líquido (mantido alias `net_cost`).
- Fluxo de caixa mensal preserva sinal (não mais uso de `abs()`), permitindo análises econômicas coerentes.
- Validação de consistência para taxa anual vs mensal de juros (tolerância 0.05 p.p.).

### Fixed
- Pagamentos finais agora respeitam limite de saldo remanescente ao aplicar amortizações combinadas.
- Cálculo de ROI ajustado para incluir custos iniciais na compra financiada.

### Internal
- Função utilitária `preprocess_amortizations` centraliza expansão e classificação (fixo vs percentual).
- Código preparado para futuras extensões (ex: exportações, multi-metas, perfis de risco).

### Pending / Próximos Passos (não incluídos nesta versão)
- Exportação CSV/JSON dos resultados.
- Persistência / autenticação de usuários / cenários salvos.
- Relatórios de redução estimada de prazo explicitados na API (atualmente apenas inferência visual no frontend).
- Estratégias de investimentos multi-classe.

## [Unreleased]
- Entradas futuras serão registradas aqui antes da próxima versão.

---

[0.1.0]: https://example.com/farol/releases/tag/v0.1.0
