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

---

## Milestone 1 — Slice 1 — Fundação SaaS e isolamento tenant

**Status:** PASS

**Data:** 2026-09-15

**Baseline pré-mudança:** `c320f20cfa00fc26be06a4d63a6fcadc55430da7` (`chore: establish reproducible pre-SaaS baseline`)

Esta fatia foi concluída como uma migração progressiva. Ela adiciona a fundação de
tenant sem remover o ownership legado, sem alterar IDs existentes e sem iniciar
funcionalidades do Milestone 2 ou posterior.

### Escopo entregue

- `Organization`, `Membership`, `MembershipRole` e `AuditLog` foram adicionados ao
  schema Prisma.
- `organizationId` nullable foi adicionado a `Product`, `Supplier`, `Analysis`,
  `Opportunity`, `DecisionLog` e `Alert`; `userId` legado permanece preservado onde já
  existia.
- O `TenantContext` server-side valida uma membership real antes de liberar rotas
  privadas e as consultas/mutações aplicáveis passaram a usar `organizationId`.
- O adaptador local exige simultaneamente ambiente `development` ou `test` e
  `ALLOW_LOCAL_IDENTITY=true`. `LOCAL_USER_EMAIL` não pode ser habilitado em
  `production`, mesmo que a flag seja informada.
- Mutações críticas de produtos, fornecedores, análises, settings e vínculo entre
  produto/fornecedor geram `AuditLog` tenant-scoped em transação, com remoção de campos
  sensíveis dos metadados.
- Catálogos e dados Amazon permanecem associados indiretamente ao tenant por entidades
  já proprietárias (`Supplier` e `Product`), sem expansão de escopo nesta fatia.

### Migration e backfill

Migration adicionada:

- `20260914030000_saas_tenant_foundation_expand`

A migration é somente expand/backfill: cria tabelas, enum, índices, foreign keys e
colunas nullable; cria uma organização de migração e uma membership `OWNER` por usuário
legado; preenche os seis tipos de entidade; e registra auditoria da migração. Não há
`DROP`, `DELETE`, `TRUNCATE`, alteração de ID ou limpeza de dados. As cláusulas
`ON DELETE` pertencem apenas às novas constraints e nenhuma exclusão foi executada.

Validações executadas:

| Cenário | Resultado | Evidência |
|---|---|---|
| Banco vazio | PASS | 6 migrations aplicadas, seed executado, 22 tabelas e zero drift |
| Fixture legada com 1 usuário | PASS | 1 organização, 1 OWNER, 6 entidades preenchidas, zero órfãos, IDs e timestamps preservados |
| Snapshot anterior com 2 usuários | PASS | 2 organizações, 2 OWNERs, 12 entidades preenchidas, zero órfãos/divergências, IDs e timestamps preservados |
| Banco de desenvolvimento | PASS | 1 usuário, 1 produto e 2 fornecedores preservados; 1 organização/1 membership; zero `organizationId` nulo em produto/fornecedores |

Os bancos temporários `easy_seller_m1_*_test` foram removidos pelo próprio teste; a
checagem final confirmou que nenhum permaneceu.

### Gates executados no fechamento

| Gate | Resultado |
|---|---|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 30 testes unitários |
| `npm run build` | PASS |
| `npm run test:db` | PASS — 6 migrations, 22 tabelas, seed tenant e zero drift |
| `npm run smoke` | PASS — 17 contratos HTTP |
| `npm run smoke:phase3` | PASS |
| `npm run test:worker` | PASS — persistência, processamento e recovery após restart |
| `npm run test:tenant-migrations` | PASS — banco vazio, fixture de 1 usuário e snapshot de 2 usuários |
| `npm run test:tenant` | PASS — 11 testes de integração tenant |
| `npm run test:baseline` | PASS — gate agregado completo |
| `git diff --check` | PASS |

O build manteve apenas os avisos já conhecidos e não bloqueantes do vinext sobre rotas
dinâmicas e `glob`. A primeira tentativa do gate após a retomada encontrou o PostgreSQL
portátil parado; ele foi religado na porta já configurada `55432` e o gate integral foi
reexecutado com sucesso, sem mudança de migration ou código para contornar o ambiente.

### Evidência de isolamento tenant

Os testes usam nomes intencionalmente semelhantes e dois contextos independentes:
User A / Organization A e User B / Organization B. Cada cenário abaixo é exercitado nos
dois sentidos (A contra B e B contra A):

- `Product`: listagem contém somente o registro próprio; leitura e atualização de ID
  estrangeiro retornam `404`.
- `Supplier`: listagem contém somente o registro próprio; leitura e atualização de ID
  estrangeiro retornam `404`.
- `Analysis`: listagem exclui análises estrangeiras; criação usando produto estrangeiro
  retorna `404`.
- `Opportunity`: a recomendação própria aparece apenas no produto próprio e o produto
  que exporia a oportunidade estrangeira não é listado nem acessível.
- `Alert`: cada listagem contém somente alertas da organização corrente.
- `DecisionLog`: ainda não existe rota HTTP aplicável; a persistência foi consultada com
  o `organizationId` obtido do `TenantContext`, comprovando separação nos dois sentidos.
- Usuário sem `Membership` recebe `TENANT_MEMBERSHIP_REQUIRED`/`403`.
- Organização inexistente ou não vinculada ao usuário recebe
  `TENANT_MEMBERSHIP_REQUIRED`/`403`.
- Uma mutação crítica confirma que o `AuditLog` recebe `organizationId` e actor corretos
  e não persiste password, token ou secret nos metadados.

### Compatibilidade preservada

- Todos os campos `userId` legados continuam no schema e nos registros aplicáveis.
- Os testes de migration conferem explicitamente IDs e timestamps anteriores.
- As contagens antes/depois do banco de desenvolvimento confirmam que nenhum produto,
  fornecedor ou usuário foi apagado.
- Nenhuma migration destrutiva foi criada ou executada.
- Os gates anteriores de produtos, fornecedores, análises, cálculos, catálogo,
  importação, Amazon, extensão, dashboard e worker continuam verdes.
- Nenhuma página nova, billing/plano, Amazon Connect, convite, matriz completa de RBAC,
  contract migration ou outra feature de Milestone 2+ foi iniciada.

### Arquivos modificados nesta fatia

- Ambiente e scripts raiz: `.env.example`, `.env.test.example`, `package.json`.
- API: `apps/api/package.json`, `apps/api/src/app.ts`,
  `apps/api/src/tenant-context.ts`, `apps/api/src/tenant-isolation.test.ts`.
- Catálogo/worker: `packages/catalog/src/catalog-import.ts`.
- Banco: `packages/db/prisma/schema.prisma`, `packages/db/prisma/seed.ts`,
  `packages/db/src/index.ts` e
  `packages/db/prisma/migrations/20260914030000_saas_tenant_foundation_expand/migration.sql`.
- Gates: `scripts/db-baseline-check.mjs`, `scripts/phase3-smoke.mjs`,
  `scripts/run-baseline-gate.mjs`, `scripts/test-environment-guard.mjs`,
  `scripts/tenant-migration-test.mjs`, `scripts/worker-smoke.mjs`.
- Documentação: `docs/IMPLEMENTATION_STATUS.md`.

### Riscos restantes e decisões pendentes

- `organizationId` permanece nullable por desenho de expand/contract. Torná-lo
  obrigatório e remover ou reinterpretar ownership legado exige uma futura contract
  migration, somente após validação operacional.
- `UserSettings` continua user-scoped durante a ponte; o comportamento de settings para
  um usuário com múltiplas organizações precisa ser decidido antes dessa expansão.
- Catálogo e snapshots Amazon têm isolamento indireto por `Supplier`/`Product`; ownership
  direto só deve ser considerado se o MASTER SPEC e a próxima fatia o exigirem.
- Não há rota de `DecisionLog`; nesta fatia só foi possível provar o isolamento da camada
  de persistência.
- Autenticação real, convites, transferência de owner e enforcement completo da matriz
  RBAC não fazem parte desta fatia e continuam pendentes conforme o plano aprovado.
- O PostgreSQL portátil é uma dependência operacional local; Docker continua não
  exercitado neste host.

Nenhuma dessas pendências invalida a fatia expand/backfill atual. O avanço para a
próxima fatia depende de aprovação humana explícita.

## MILESTONE 1 — SLICE 1 STATUS

PASS
