# Roadmap

## Fase 1 — Fundação e decisão local

Documentação, monorepo, schema, API mock, painel, CRUD, calculadora, score, recomendação e extensão básica. Saída: produto demonstrável sem credenciais externas.

## Fase 2 — Catálogo e acompanhamento

Uploads CSV/XLSX, storage, catálogo/versões, histórico de custo, snapshots, filtros, dashboard persistido e alertas simples. Introduzir BullMQ e revisão de import.

## Fase 3 — Amazon oficial

Adapters SP-API para catálogo, pricing, fees, rank e competição; quotas, cache, auditoria de origem e degradação segura.

## Fase 4 — Inteligência em escala

Pipeline PDF layout-aware, OCR seletivo, QR/link detection, matching, análise em massa, estoque sugerido, preço máximo e comparação de versões/fornecedores.

## Fase 5 — SaaS

Multi-tenant, autenticação, planos, billing, limites, observabilidade, backup, LGPD e operações de suporte.

## Próximas três iterações

1. Persistir CRUD da Fase 1 no PostgreSQL e adicionar migrations/seed executáveis.
2. Implementar CSV/XLSX com revisão humana e histórico de preço do fornecedor.
3. Conectar um provider Amazon sandbox e medir qualidade por categoria.
