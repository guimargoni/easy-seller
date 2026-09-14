# Fase 4 — Amazon Intelligence

## Implementado

- contratos dos cinco providers Amazon preservados e enriquecidos com origem (`REAL`, `ESTIMATED`, `INFERRED`), confiança (`HIGH`, `MEDIUM`, `LOW`), fonte e horário;
- adapter oficial para Catalog Items, Product Pricing e Product Fees da Selling Partner API;
- adapter secundário limitado aos dados visíveis na página de produto aberta pelo usuário, sem crawler ou scraping em massa;
- fallback conservador de taxas configuráveis, sempre rotulado como estimativa;
- persistência de `PriceSnapshot`, `RankSnapshot` e `CompetitionSnapshot`, agora com proveniência completa;
- alertas para queda de preço, aumento de vendedores, entrada da Amazon e queda de margem;
- extensão integrada ao endpoint de inteligência, com preço, Buy Box, taxas, logística, rank, concorrência, Amazon vendedora, reviews/rating quando disponíveis e cálculos derivados;
- tooltips e selos de origem/confiança em todos os sinais automáticos;
- testes unitários dos adapters oficial, de página e de taxas estimadas.

## Limites explícitos

- reviews e rating não são fabricados quando a SP-API não os fornece; só aparecem quando observados na página aberta;
- giro/vendas mensais derivados de Sales Rank são `INFERRED/LOW`;
- ausência de credenciais SP-API degrada para observação local da página e taxas estimadas;
- nenhuma automação de scraping agressivo foi adicionada.

Fase 5 não foi iniciada.

## Fechamento e gates — 2026-09-04

O PostgreSQL portátil adotado pelo projeto estava parado e foi iniciado por
`.runtime/postgresql/pgsql/bin/pg_ctl.exe` em `localhost:55432`. O
`pg_isready` confirmou `accepting connections`.

| Comando/verificação | Resultado | Evidência |
|---|---|---|
| `npm run db:migrate` | PASS | 4 migrations encontradas; nenhuma pendente. A migration `20260904010000_phase_4_amazon_intelligence` já está aplicada. |
| `npm run lint` | PASS | API, extensão, web, Amazon e calculations sem erros. |
| `npm run typecheck` | PASS | Todos os workspaces sem erros. |
| `npm test` | PASS | 27 testes passaram, incluindo 4 testes dos adapters Amazon. |
| `npm run build` | PASS | Packages, API, extensão e frontend gerados com sucesso. |
| `npm run smoke` | PASS | Fluxo completo de persistência, cálculo, ranking e limpeza das fixtures passou. |
| `GET /health` | PASS | HTTP 200 e `database=connected`. |
| Inicialização da API | PASS | Fastify iniciou em `localhost:3333`. |
| Inicialização do worker | PASS | Worker permaneceu ativo em múltiplos ciclos, sem `PrismaClientInitializationError`. |
| Inicialização do frontend | PASS | Servidor local iniciou em `localhost:3000` e respondeu HTTP 200 com HTML. |
| `POST /amazon/intelligence` | PASS | HTTP 200. Sem fonte ou observação, `catalog`, `pricing`, `fees`, `competition`, `rank`, `monthlySales` e `turnoverDays` retornaram `null`. |
| Dados DEV/demo | PASS | Seed permanece marcado com `isDemo=true`; o produto de demonstração usa `dataOrigin=INFERRED`, sem se apresentar como dado real. |
| Ausência de dados | PASS | Campos indisponíveis retornam `null`; nenhum valor sintético foi preenchido como `REAL`. |

Fase 4 concluída: **SIM**. Nenhuma funcionalidade da Fase 5 foi iniciada e nada foi publicado.
