# Implementation Status

## Milestone 0 — Baseline reproduzível e guardrails de migração

**Status:** PASS  
**Data:** 2026-09-14  
**Branch:** `main`  
**HEAD de referência:** `7403b7acea6114e0ddaa412aa1b312b1109d3e26`

O baseline validado é o HEAD acima somado ao working tree local existente em
2026-09-14. O repositório já estava amplamente modificado e continha arquivos tracked,
staged, unstaged e untracked de fases anteriores; nenhuma dessas alterações foi
descartada ou sobrescrita. `apps/web` está consolidado como diretório normal do
monorepo: não possui `.git` interno nem submodule configurado, e seus arquivos aparecem
individualmente no índice. A remoção staged do gitlink antigo e a adição dos arquivos
normais foram preservadas como encontradas.

### Fontes lidas

- `docs/EASY_SELLER_MASTER_SPEC.md` — SHA-256 `CFE4B5378FDC306205B0D0A37B7F4F3939597A4BADB6655EF2E5B4C558D404B1`.
- `docs/CURRENT_STATE_AUDIT.md` — SHA-256 `CCFE0D01CCE2ED0E00C05F4F6C1A66155A9088EAA48FF42DD6A1CD297F7F79FC`.
- `docs/IMPLEMENTATION_PLAN.md` antes desta atualização — SHA-256 `C115853F59B109E57CD645B888B1E0F4BEC393D0217B4B509FCE6B11C7DCC246`.

### Gates executados

| Gate | Comando/cobertura | Resultado |
|---|---|---|
| Lint | `npm run lint` | PASS |
| Typecheck | `npm run typecheck` | PASS |
| Unit tests | `npm test` | PASS — 30 testes |
| Build | `npm run build` | PASS — packages, API, extensão e web |
| Prisma Client | `npm run db:generate` | PASS |
| Banco vazio | `npm run db:reset` sob guard de teste | PASS |
| Seed | `npm run db:seed` | PASS |
| Schema físico | `npm run test:db` | PASS — 5 migrations, 19 tabelas, seed e zero drift |
| Contratos HTTP | `npm run smoke` | PASS — 17 verificações |
| Catálogo/importação | `npm run smoke:phase3` | PASS — importação manual, fila, threshold, revisão, versões, comparação e shortlist |
| Worker | `npm run test:worker` | PASS — fila persistida, processamento e recovery após restart |
| Gate agregado | `npm run test:baseline` | PASS |
| Proteção destrutiva | tentativa controlada de `db:reset` contra `easy_seller` | PASS — recusada antes do Prisma |

O build web emitiu somente o aviso conhecido do vinext sobre classificação estática de
rotas dinâmicas e o aviso experimental de `glob`; ambos são não bloqueantes.

### PostgreSQL e migrations

- Docker não está instalado neste host. Para a validação foi usado PostgreSQL portátil,
  ativo em `localhost:55432` e confirmado por `pg_isready`.
- O banco isolado `easy_seller_milestone0_test` foi apagado/recriado pelo gate e recebeu
  as cinco migrations e o seed com `baseline-test@easyseller.local`.
- `docker-compose.test.yml` e `.env.test.example` oferecem uma alternativa reproduzível
  e isolada em `localhost:55433` para hosts com Docker.
- O banco de desenvolvimento `easy_seller` recebeu somente a migration técnica
  `20260914010000_baseline_schema_alignment`; terminou com cinco migrations, um usuário
  preservado e `prisma migrate diff` sem diferenças.
- Migrations validadas: `20260902110000_init`,
  `20260903010000_phase_2_product_research`,
  `20260903030000_phase_3_supplier_intelligence`,
  `20260904010000_phase_4_amazon_intelligence` e
  `20260914010000_baseline_schema_alignment`.

### Problemas encontrados e correções

1. O reset Prisma não executava automaticamente o seed no contexto do script raiz. O
   gate agora chama o seed explicitamente após o reset.
2. O primeiro runner tentava iniciar `npm.cmd` diretamente e falhava com `EINVAL` no
   Windows. Ele agora usa o Node com o CLI npm indicado por `npm_execpath`.
3. Havia defaults físicos residuais em colunas de `CatalogImport`, `PriceSnapshot`,
   `RankSnapshot` e `CompetitionSnapshot` que não existem no schema Prisma. A migration
   técnica remove somente esses defaults; nenhum registro é apagado ou reescrito.
4. A suspeita da auditoria sobre `CatalogProduct.fieldConfidence` foi investigada. O
   schema Prisma vigente declara `Json?` e a migration inicial criou `JSONB` nullable;
   portanto, essa coluna já estava alinhada. A checagem passou a afirmar explicitamente
   a nulabilidade correta e nenhuma confiança ausente foi inventada.
5. Smokes destrutivos não tinham uma barreira comum. O novo guard exige simultaneamente
   `NODE_ENV=test`, `ALLOW_TEST_DATABASE=true`, host local, nome de database contendo
   `test`, URL local da API e storage de catálogo identificado como teste.
6. Os contratos de settings e da extensão não estavam no smoke HTTP principal. Foram
   adicionados sem alterar o comportamento das rotas.
7. O recovery do worker não estava validado de ponta a ponta. A fixture agora comprova
   persistência da fila durante indisponibilidade e processamento após reinício.

### Arquivos do Milestone 0

- Segurança/ambiente: `.gitignore`, `.env.test.example`, `docker-compose.test.yml`,
  `scripts/test-environment-guard.mjs`, `scripts/safe-db-reset.mjs`.
- Gate e validação: `package.json`, `scripts/run-baseline-gate.mjs`,
  `scripts/db-baseline-check.mjs`, `scripts/smoke-test.mjs`,
  `scripts/phase3-smoke.mjs`, `scripts/worker-smoke.mjs`.
- Banco: `packages/db/prisma/migrations/20260914010000_baseline_schema_alignment/migration.sql`.
- Documentação: `README.md`, `docs/IMPLEMENTATION_STATUS.md` e a seção
  `NEXT CODEX TASK` de `docs/IMPLEMENTATION_PLAN.md`.

### Comportamento preservado

Não houve remoção de funcionalidade, alteração deliberada de domínio, mudança de IDs ou
limpeza de dados de desenvolvimento. Produtos, fornecedores, pesquisa, cálculos,
análises, dashboard, extensão, catálogo/importação e worker foram exercitados nos
contratos atuais. Organization, Membership, multi-tenancy, Amazon Connect, billing,
Procurement v2 e demais milestones não foram iniciados.

### Problemas adiados e riscos restantes

- O baseline ainda é um working tree não commitado e extenso; a rastreabilidade melhora
  quando o proprietário revisar e criar um commit de referência.
- Docker não pôde ser exercitado neste host; o compose de teste foi revisado, enquanto a
  execução real usou PostgreSQL portátil.
- O worker continua sendo polling persistido no PostgreSQL, sem BullMQ, conforme escopo.
- O vinext ainda não classifica todas as rotas estaticamente no build.
- Autenticação real, isolamento tenant-scoped, RBAC, observabilidade e hardening de
  produção permanecem riscos conhecidos e pertencem aos milestones posteriores.
- A alteração futura de ownership é de alto risco para dados e deve seguir expand,
  backfill, validação e contract migration, mantendo rollback.

### Decisões pendentes de aprovação

Nenhuma decisão adicional é necessária para considerar o Milestone 0 concluído. O
início da primeira fatia do Milestone 1 depende de aprovação humana explícita.
