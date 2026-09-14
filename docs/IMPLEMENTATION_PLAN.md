# Plano incremental de implementação

Base: `EASY_SELLER_MASTER_SPEC.md` + `CURRENT_STATE_AUDIT.md`  
Princípio: expandir, backfill, validar, trocar leitura/escrita e somente então contrair. Nenhum milestone autoriza apagar dados históricos ou substituir módulos funcionais sem equivalência comprovada.

## Regras de execução do plano

- O MASTER SPEC prevalece sobre documentos de fase antigos.
- Cada milestone começa em baseline verde: lint, typecheck, unit, integration, migrations em banco limpo e upgrade a partir de snapshot do schema anterior.
- Toda entidade privada recebe `organizationId`; toda query privada é validada no backend.
- Dinheiro permanece inteiro em centavos; arredondamento é explícito e testado.
- Dados importados/externos preservam origem, confiança, fonte e timestamp.
- Features novas usam expand/contract e flags server-side. Histórico permanece legível em downgrade.
- APIs externas entram por ports/adapters e testes não fazem chamadas pagas.
- Não criar todos os packages-alvo antecipadamente; criar somente o necessário no milestone corrente.
- O working tree atual deve ser consolidado antes da primeira migration para que rollback e regressão sejam atribuíveis.

## Milestone 0 — Baseline reproduzível e guardrails de migração

**Objetivo:** transformar o working tree auditado em baseline verificável, sem mudar produto.

**Por que vem nesta ordem:** o checkout está dirty e o PostgreSQL local estava indisponível na auditoria. Iniciar mudança de ownership sem um baseline restaurável tornaria qualquer regressão ambígua.

**Arquivos/módulos afetados:** scripts raiz, configuração de testes/CI, README operacional e fixtures; nenhum domínio funcional.

**Entidades envolvidas:** todas apenas para validação; nenhuma entidade nova.

**Migrations necessárias:** nenhuma nova. Aplicar as quatro existentes em banco vazio e em cópia sanitizada do banco atual; comparar schema físico com Prisma, inclusive `CatalogProduct.fieldConfidence`.

**APIs necessárias:** nenhuma. Validar todas as rotas correntes e congelar contratos observados em testes.

**Páginas/telas:** nenhuma nova; smoke das seis views e overlay da extensão.

**Jobs:** processar import manual/CSV de fixture e confirmar retomada após restart.

**Testes:** adicionar ao gate os smokes existentes; registrar cobertura por workspace; teste de upgrade de migrations; snapshot dos contratos HTTP críticos.

**Critérios de aceite:** banco limpo sobe com migrations/seed; smoke atual passa; build/lint/typecheck/30 unit tests continuam verdes; working tree e versão auditada ficam identificáveis; nenhum dado real é criado como fixture.

**Dependências:** PostgreSQL 17 disponível; decisão operacional sobre CI local/remoto.

**Riscos:** confundir falha ambiental com drift; executar cleanup de smoke contra banco errado. Mitigar com database name exclusivo de teste e confirmação de ambiente.

## Milestone 1 — Fundação SaaS e multi-tenant compatível

**Objetivo:** tornar `Organization` a raiz de todos os dados privados, introduzir identidade, membership, tenant context, RBAC inicial, audit e entitlements básicos sem quebrar o usuário local nem os fluxos atuais.

**Por que vem nesta ordem:** todos os novos domínios dependem de ownership e autorização corretos. Adiar isso multiplicaria migrations e riscos de vazamento.

**Arquivos/módulos afetados:** `packages/db`, novo `packages/auth` quando houver código real, `packages/types`, módulos/middleware de identity em `apps/api`, shell/auth state de `apps/web`, worker e extensão. `ensureLocalUser` vira adapter exclusivo de dev/test.

**Entidades envolvidas:** User, Organization, Membership, Role/Permission, AuditLog, OrganizationSettings, Plan, FeatureEntitlement e uma Subscription/entitlement assignment mínima sem gateway.

**Migrations necessárias:**

1. expandir com novas tabelas e colunas `organizationId` nullable;
2. criar uma Organization padrão por User legado e Membership OWNER;
3. backfill direto e transitivo de Product, Supplier, Catalog, Analysis, Opportunity, DecisionLog, Alert e jobs;
4. criar índices/uniques tenant-scoped;
5. validar ausência de órfãos/divergência;
6. tornar `organizationId` obrigatório em nova migration;
7. manter `userId` legado durante dual-read/rollback; remoção somente em milestone posterior.

**APIs necessárias:** sessão/current user, listar/selecionar organizações, organization settings, membros, convite básico se o auth adapter suportar, endpoint de entitlements; tenant context obrigatório em todas as rotas existentes.

**Páginas/telas:** login/criar conta, criar/selecionar empresa, membros/permissões e settings organizacionais mínimos; modo local continua somente em desenvolvimento.

**Jobs:** todo payload/job ganha organizationId, actor/system context, versão e idempotency key.

**Testes:** integração de auth/session; matriz RBAC; testes negativos A→B em toda família de rota; backfill com dois usuários e dados sobrepostos; owner não removível; audit em mutações críticas; dev bootstrap impossível em production.

**Critérios de aceite:** usuário A nunca lê/altera B; todas as queries privadas recebem tenant no servidor; dados legados aparecem na organização backfilled; fluxos atuais permanecem funcionais; OWNER não é removido sem transferência; feature gate é backend-first; AuditLog não contém segredo/payload sensível.

**Dependências:** baseline M0; escolha de mecanismo de sessão pode ser adapter-based e não precisa fixar social login/gateway.

**Riscos:** ownership divergente durante dual-write, lock em tabelas grandes, cascade indevida e bypass em rotas antigas. Mitigar com migrations pequenas, validação online e deny-by-default.

## Milestone 2 — Plataforma de integrações, jobs e observabilidade

**Objetivo:** criar a base operacional comum para sync Amazon, catálogo, Ads e reconciliação.

**Por que vem nesta ordem:** Amazon Connect e dados operacionais exigem jobs idempotentes, credenciais seguras e diagnóstico antes de gerar volume.

**Arquivos/módulos afetados:** `apps/worker`, módulos `integrations/jobs` da API, `packages/amazon`, novo `packages/observability`; `packages/catalog` passa a consumir job contract.

**Entidades envolvidas:** MarketplaceAccount skeleton, IntegrationTokenRef, SyncCursor, JobRun/JobAttempt ou representação equivalente, outbox/event record quando necessário.

**Migrations necessárias:** contas, token refs sem segredo em claro, cursor por capability, job metadata (`jobId`, organizationId, version, attempt, status, timestamps, erro sanitizado), idempotency keys e índices de claim.

**APIs necessárias:** status de integrações/jobs, retry autorizado, health/readiness separados; nenhuma credencial sensível retornada.

**Páginas/telas:** indicador de sincronização e página de integração/job failure mínima para admin autorizado.

**Jobs:** migrar CatalogImport polling para o envelope comum; introduzir retries/backoff, timeout, heartbeat e inspeção de failed/DLQ. Adotar BullMQ/Redis se o desenho aprovado exigir; manter DB como fonte de estado/auditoria.

**Testes:** concorrência de claim, retry sem duplicação, erro sanitizado, restart, DLQ, autorização de retry, logs com requestId/organizationId/jobId.

**Critérios de aceite:** execução repetida não duplica efeitos; falhas são inspecionáveis; queue lag e duração são medidos; nenhum token aparece em banco comum/log/resposta.

**Dependências:** M1 e Redis 7 quando BullMQ for ativado.

**Riscos:** dual queue, job perdido entre DB e Redis, retry de efeito não idempotente. Mitigar com outbox/idempotency e reconciliação.

## Milestone 3 — Amazon Connect e sincronização de leitura

**Objetivo:** conectar contas Amazon Brasil por organização e sincronizar listings, pedidos, fees, inventário e finanças por capability.

**Por que vem nesta ordem:** Parity Core, lucro, estoque e dashboard precisam de dados reais por conta.

**Arquivos/módulos afetados:** `packages/amazon`, integrations/jobs da API/worker, `packages/db`, tela de onboarding/integrações.

**Entidades envolvidas:** MarketplaceAccount, IntegrationTokenRef, SyncCursor, MarketplaceListing (migração de AmazonListing), MarketplaceOrder, MarketplaceOrderItem, FeeTransaction, InventoryPosition inicial e Payout/Receivable inicial.

**Migrations necessárias:** account-scoped external keys; link de AmazonListing legado a conta/organização; backfill sem inventar conta real (marcar legacy/manual); uniques `(organizationId, accountId, externalId)`; freshness/status.

**APIs necessárias:** iniciar/finalizar autorização, listar/desconectar conta, sync status, trigger sync autorizado; leitura inicial de listings/orders/inventory/fees/receivables.

**Páginas/telas:** onboarding Conectar Amazon, estados não conectado/autorizando/sync/conectado/erro/expirado, seletor de conta e checklist de primeira sincronização.

**Jobs:** orders, listings, inventory, finances/reports sync incremental; rate limit, cursor, retry/backoff e reconciliation.

**Testes:** contract tests por provider, fixtures Amazon, token expiry, pagination/cursor, quota, retry sem duplicar, multi-account/tenant, dado ausente permanece null/indisponível.

**Critérios de aceite:** uma conta autorizada sincroniza incrementalmente; retry não duplica pedido/transação; lastSuccessfulSyncAt é confiável; extensão/rotas legadas continuam operando como fallback rotulado.

**Dependências:** M2; aprovação/credenciais Amazon externas.

**Riscos:** mudança de contratos Amazon, quota, dados atrasados e reconciliação parcial. Mitigar por adapters, fixtures versionadas e freshness visível.

## Milestone 4 — Gestor Core: pedidos, vendas, produtos e Command Center

**Objetivo:** entregar a camada operacional de leitura e a navegação de paridade básica.

**Por que vem nesta ordem:** transforma sync em valor visível antes de aprofundar modelos financeiros.

**Arquivos/módulos afetados:** módulos sales/orders/products/dashboard da API; decomposição de `apps/web/app/page.tsx` em rotas/features; `packages/types` por contexto.

**Entidades envolvidas:** MarketplaceOrder, MarketplaceOrderItem, MarketplaceListing, Product, ProductIdentifier/Image/Alias/Category e snapshots existentes.

**Migrations necessárias:** separar campos canônicos de pesquisa/listing; backfill de EAN/imagem/categoria; preservar IDs e snapshots; corrigir update de listing para upsert sem delete; status/freshness por item.

**APIs necessárias:** listas paginadas/filtradas e detalhes de pedidos, vendas, produtos/listings; export CSV inicial; dashboard agregado por período/conta; response provenance.

**Páginas/telas:** navegação alvo reduzida; Início, Vendas, Pedidos, Produtos e detalhes; header com organização/conta/período/sync; loading/empty/error; filtros na URL.

**Jobs:** rebuild de agregados básicos após sync; sem métricas financeiras que ainda dependam de custo faltante.

**Testes:** integration/API pagination e filtros, E2E dashboard→sale→order, mobile básico, acessibilidade de estados, export respeita filtro/RBAC.

**Critérios de aceite:** dados observados e estimados são distinguíveis; usuário encontra pedido/venda/listing por SKU/ASIN; dashboard nunca mostra projeção como realizado; update de produto preserva snapshots.

**Dependências:** M3.

**Riscos:** Product/Listing conflation e consultas agregadas lentas. Mitigar com dual-read, índices e snapshots/rebuilds versionados.

## Milestone 5 — Profit Engine, lotes e Financeiro/DRE

**Objetivo:** produzir lucro reproduzível por venda e período, com custo rastreável, despesas e DRE separada de caixa.

**Por que vem nesta ordem:** estoque inteligente e capital dependem de CMV/landed cost corretos.

**Arquivos/módulos afetados:** `packages/calculations` cents-first; novo `packages/finance` quando necessário; sales/finance APIs; UI de custos e financeiro.

**Entidades envolvidas:** InventoryLot, CostComponent, CostSnapshot, Expense, ExpenseAllocation, FinancialSnapshot, DREPeriodSnapshot, FeeTransaction, Receivable e Analysis legado.

**Migrations necessárias:** lotes/componentes/vigência/origem; despesas/alocação; snapshots; mapear Analysis como cenário histórico, sem convertê-lo em venda; política para `Int` versus `BigInt` antes de alto volume.

**APIs necessárias:** custo/lotes, despesas, detalhe financeiro da venda, financeiro overview, DRE e recebíveis; recalcular com versão explícita.

**Páginas/telas:** aba Custos do produto, detalhe de venda com waterfall, Financeiro, DRE, despesas e recebíveis.

**Jobs:** financial reconciliation e rebuild de snapshots por versão; reprocessamento controlado quando custo é alterado retroativamente.

**Testes:** rounding/property/boundary tests em cents; mesmo input=mesmo output; weighted average; custo faltante; devoluções; alocação; reconciliação; audit de alteração retroativa.

**Critérios de aceite:** cada componente financeiro mostra origem; margem usa convenção documentada; CMV aponta lote/método; DRE fecha para fixtures; fluxo de caixa não é confundido com DRE; IA não calcula valores.

**Dependências:** M4; decisões fiscais específicas podem permanecer configuráveis/TBD.

**Riscos:** recálculo retroativo alterar números fechados e dupla contagem de fees/despesas. Mitigar com snapshots versionados e períodos fechados.

## Milestone 6 — Inventory Intelligence

**Objetivo:** modelar estoque real e gerar cobertura, ROP e reposição explicáveis.

**Por que vem nesta ordem:** usa vendas e custos confiáveis; elimina o uso indevido de `SupplierProduct.stock`.

**Arquivos/módulos afetados:** novo `packages/inventory`, inventory APIs/jobs/UI, adapters Amazon inventory.

**Entidades envolvidas:** InventoryPosition, InventoryMovement, InventoryLot, InboundShipment, ReplenishmentRecommendation e settings de estoque.

**Migrations necessárias:** posições por location/fulfillment/account, movimentos idempotentes, inbound e recommendations versionadas; migrar `SupplierProduct.stock` somente como disponibilidade da oferta, nunca como seller inventory.

**APIs necessárias:** overview, movements, inbound, coverage, replenishment e dead stock; settings safety stock/target/velocity/lead-time.

**Páginas/telas:** Estoque overview, Reposição, Em trânsito e Estoque parado; aba Estoque do produto.

**Jobs:** inventory sync, velocity 7/30/60, coverage, ROP, recommendation rebuild e alert hooks.

**Testes:** divisão por zero, ausência de vendas, múltiplos fulfillments, inbound, late events, idempotência e recommendations com MOQ/caixa.

**Critérios de aceite:** total não duplica locations; daysOfCover é rastreável; recomendação considera demanda, target, safety, lead time, inbound e MOQ; estados urgente/comprar/planejar/saudável/excesso são explicados.

**Dependências:** M3–M5.

**Riscos:** snapshots Amazon representam momentos, não movimentos completos. Mitigar com reconciliação e distinção position versus movement.

## Milestone 7 — Capital Intelligence e simulador

**Objetivo:** substituir os dois campos de capital por ledger/mapa reconciliável e evoluir a calculadora para simulador de compra.

**Por que vem nesta ordem:** capital exige estoque, custos, recebíveis e compras sem dupla contagem.

**Arquivos/módulos afetados:** novo `packages/capital`, calculations, capital APIs/UI; settings strategy.

**Entidades envolvidas:** CapitalAccount, CapitalMovement, CapitalAllocation, CapitalPlan e OrganizationSettings.

**Migrations necessárias:** saldo inicial `USER_ENTERED` a partir de `capitalTotalCents`; reserva; movimentos por referência; não inventar histórico; ponte para UserSettings até corte.

**APIs necessárias:** Capital Map, movimentos, concentração, planejamento, simulador pessimista/base/otimista e alocador determinístico v1.

**Páginas/telas:** Capital Map, Reinvestimento, Simulador e Planejamento.

**Jobs:** rebuild/reconciliation do mapa e concentração; alert hooks.

**Testes:** invariantes de ledger, estados mutuamente exclusivos, caixa restante, concentração por SKU/marca/categoria/fornecedor, cenários e determinismo.

**Critérios de aceite:** mapa não duplica capital; cada valor reconcilia a movimentos/fontes; simulador mostra landed cost, lucro, ROI, break-even, prazo e cobertura em três cenários; alocador explica quantidade/risco/caixa restante.

**Dependências:** M5–M6.

**Riscos:** interpretar capital total legado como caixa atual. Mitigar com confirmação do usuário/data de corte e badge manual.

## Milestone 8 — Procurement Foundation e migração do módulo existente

**Objetivo:** consolidar Supplier/Catalog em um domínio oficial de compras, preservando tudo que funciona e adicionando oferta, busca, comparação, carrinho e purchase order.

**Por que vem nesta ordem:** a base existente pode ser migrada com custo, estoque e capital já corretos.

**Arquivos/módulos afetados:** `packages/catalog` refatorado, novo `packages/procurement`, suppliers/catalog/procurement APIs e UI.

**Entidades envolvidas:** Supplier, SupplierContact, SupplierTerms, SupplierOffer (de SupplierProduct), SupplierOfferTier, SupplierPriceSnapshot, PurchaseCart/Item, PurchaseOrder/Item, GoodsReceipt e DecisionLog.

**Migrations necessárias:** organization scope; offers/tiers; backfill de SupplierProduct e SupplierProductPrice; normalização gradual de contacts/terms; carts/POs/receipts; preservar tabelas legadas até dual-read validado.

**APIs necessárias:** supplier detail, offer search PostgreSQL FTS/trigram, comparator, WhatsApp preview/contact initiated, cart, PO lifecycle e goods receipt transacional.

**Páginas/telas:** fornecedor com tabs; Buscar produtos, Comparador, Carrinhos, Pedidos de compra e Histórico; CTA WhatsApp.

**Jobs:** indexação local de ofertas e atualização de comparativos; nenhum LLM por busca.

**Testes:** tenant search, dedupe, MOQ/tier/minimum order, template deterministic greeting, AuditLog/CONTACT_INITIATED, PO state machine e recebimento atômico atualizando lote/estoque/capital/preço.

**Critérios de aceite:** Product != SupplierOffer != MarketplaceListing em código/schema/UI; busca não chama IA; carrinho é por fornecedor; MOQ respeitado; recebimento é transacional e retry-safe.

**Dependências:** M1, M5–M7.

**Riscos:** converter custo legado em lote real e duplicar offers. Mitigar com origem `LEGACY`/manual, reconciliation report e unique keys tenant-scoped.

## Milestone 9 — Catalog Ingestion v2 e Procurement AI

**Objetivo:** endurecer o pipeline atual e adicionar interpretação por IA somente para ambiguidades, com storage privado e uso mensurável.

**Por que vem nesta ordem:** SupplierOffer e procurement já oferecem destino semântico correto; usage/entitlements já existem.

**Arquivos/módulos afetados:** `packages/catalog`, worker/jobs, storage port, prompts versionados, catalog APIs/UI.

**Entidades envolvidas:** Catalog, CatalogFile, CatalogImport, CatalogPage, CatalogItem, ExtractionField, ProductMatch, AiUsage e UsageCounter.

**Migrations necessárias:** novos estados completos, file/page/field evidence, prompt/extraction version, attempts/cost/usage; migrar `sourceFile`, metadata e `fieldConfidence`; manter checksums.

**APIs necessárias:** upload seguro, progress, review batch, reprocess autorizado, usage; image input; signed download quando autorizado.

**Páginas/telas:** import progress real, resumo/revisão, batch approve, erros parciais e consumo de páginas.

**Jobs:** security/MIME/hash, preprocess, extract, AI interpret, validate, dedupe/match, persist e index; OCR seletivo.

**Testes:** fixtures licenciadas/anônimas simples, visual, scanned, tier, combo e multi-column; JSON schema inválido; partial failure; resumability; checksum/storage; nenhum campo inventado.

**Critérios de aceite:** versão antiga nunca é sobrescrita; falha parcial não corrompe; threshold é server-side e versionado; busca posterior não chama IA; custo/páginas são contabilizados; originais não são públicos.

**Dependências:** M2, M8, object storage e provider LLM TBD atrás de port.

**Riscos:** custo variável, prompt drift, OCR intensivo e prompt injection documental. Mitigar com budgets, schemas, sandboxing e human review.

## Milestone 10 — Opportunity Engine completo

**Objetivo:** unificar pesquisa legada, matching Amazon, catálogo→oportunidade, scoring versionado e decisões.

**Por que vem nesta ordem:** score confiável depende de vendas, lucro, estoque, capital, offers e matching.

**Arquivos/módulos afetados:** novo `packages/scoring`, opportunity APIs/jobs/UI; migração gradual do ranking em calculations.

**Entidades envolvidas:** Opportunity, OpportunityScore, ProductMatch, DecisionLog e ReplenishmentRecommendation.

**Migrations necessárias:** recommendation, confidence, positives/risks/missing data, input snapshot/model version; relacionar Analysis/Opportunity legados sem apagar histórico.

**APIs necessárias:** opportunities list/detail, recalculate, decision/status; explanation e evidence.

**Páginas/telas:** Oportunidades, comparação e detalhe; manter workflow CANDIDATE→... durante transição.

**Jobs:** matching, batch score, score invalidation/rebuild e calibration metrics.

**Testes:** unit por componente/strategy; missingness/confidence; blockers fora do score; thresholds versionados; fixtures de decisões e regressão do ranking atual.

**Critérios de aceite:** score 0–100 com modelo/confiança/evidência; recomendações BUY_TEST/BUY/REPLENISH/WATCH/AVOID; nenhum guarantee; mesma entrada/versão produz mesma saída.

**Dependências:** M4–M9.

**Riscos:** falsa precisão e matching errado ligar custo a ASIN. Mitigar com confidence gates e revisão humana.

## Milestone 11 — Amazon Ads analytics e lucro pós-Ads

**Objetivo:** integrar Amazon Ads em modo read-only e incorporar Ads à análise financeira.

**Por que vem nesta ordem:** precisa de vendas/profit engine e autorização externa; writes não são pré-requisito.

**Arquivos/módulos afetados:** novo `packages/amazon-ads`, finance/calculations, ads APIs/jobs/UI.

**Entidades envolvidas:** AdAccount, CampaignSnapshot, AdGroupSnapshot, AdProductSnapshot, SearchTermSnapshot e settings Ads.

**Migrations necessárias:** credencial separada, snapshots por níveis, attribution window/source e indexes.

**APIs necessárias:** connect/status, KPIs/filtros e advisor read-only.

**Páginas/telas:** Ads overview/detail e aba Ads do produto.

**Jobs:** reporting sync, attribution/reconciliation e advisor evaluation.

**Testes:** formulas ACOS/ROAS/TACOS/divisão por zero, contract fixtures, tenant/account isolation, late attribution e lucro pós-Ads.

**Critérios de aceite:** KPIs por conta/campanha/grupo/anúncio/produto e keyword quando disponível; advisor explica gasto sem venda, break-even e escala; nenhuma write é executada.

**Dependências:** M2, M4–M5 e aprovação Amazon Ads.

**Riscos:** attribution tardia e diferença de timezone/moeda. Mitigar com janelas explícitas e snapshots reprocessáveis.

## Milestone 12 — Alert Engine e notificações in-app

**Objetivo:** substituir alertas pontuais por regras, eventos deduplicados e inbox acionável.

**Por que vem nesta ordem:** fontes de vendas, estoque, capital, supplier e Ads já existem para evitar regras vazias.

**Arquivos/módulos afetados:** novo `packages/alerts`, events/jobs, alerts APIs/UI; migração dos creates inline.

**Entidades envolvidas:** Alert, AlertRule, AlertEvent e notification preferences.

**Migrations necessárias:** organization, fingerprint, entity ref, severity enum, lifecycle, snooze/resolution e channels; backfill de alerts legados.

**APIs necessárias:** inbox/list/filter, read/resolve/snooze/mute/configure; alert count para header.

**Páginas/telas:** Alertas e bloco “Precisa da sua atenção” no Command Center.

**Jobs:** evaluation por eventos/schedule e delivery in-app; e-mail/WhatsApp push continuam posteriores.

**Testes:** fingerprint/dedupe, severity priority, snooze, re-open em mudança, RBAC e no-spam.

**Critérios de aceite:** sync repetido não cria alerta idêntico; cada alerta tem impacto/entidade/CTA; categorias e severidades do MASTER são cobertas.

**Dependências:** M4–M11 conforme categoria.

**Riscos:** fadiga de alertas e eventos fora de ordem. Mitigar com stateful fingerprints e defaults conservadores.

## Milestone 13 — Easy AI com tools autorizadas

**Objetivo:** permitir explicação e navegação dos dados estruturados sem delegar cálculos financeiros ao modelo.

**Por que vem nesta ordem:** somente dados confiáveis e APIs autorizadas permitem respostas evidenciadas e tenant-safe.

**Arquivos/módulos afetados:** novo `packages/ai`, tool facade por contexto, AI APIs/UI e observability/usage.

**Entidades envolvidas:** AiUsage, AiConversation, AiToolInvocation sanitizada e UsageCounter.

**Migrations necessárias:** conversas, usage, invocation metadata e retention controls; nenhum segredo/payload integral desnecessário.

**APIs necessárias:** conversation/query/stream opcional, allowlisted tools e feedback.

**Páginas/telas:** Easy AI e entradas contextuais em dashboard/produto.

**Jobs:** resumos assíncronos apenas quando justificados; sem SQL livre.

**Testes:** tenant isolation, tool allowlist, prompt injection, volume/date limits, insufficient data, citations internas e deterministic tool outputs.

**Critérios de aceite:** respostas citam evidências internas; valores financeiros vêm de tools determinísticas; dado insuficiente é declarado; uso respeita entitlement.

**Dependências:** M1, M5–M12 e provider LLM TBD atrás de port.

**Riscos:** vazamento cross-tenant, alucinação e custo. Mitigar com auth context imutável, allowlist, schemas, quotas e redaction.

## Milestone 14 — Amazon Operations progressivas

**Objetivo:** adicionar listagens, envios, FBA/DBA/EasyShip, etiquetas/fiscal e depois repricing somente onde APIs e controles permitirem.

**Por que vem nesta ordem:** writes externas exigem leitura estabilizada, RBAC, audit, idempotência e suporte operacional.

**Arquivos/módulos afetados:** capabilities separadas em `packages/amazon`, operations APIs/jobs/UI.

**Entidades envolvidas:** operation requests/results, fulfillment/inbound, fiscal refs e repricing policy quando aprovado.

**Migrations necessárias:** idempotency key, confirmation/audit, status/result e policy bounds.

**APIs necessárias:** uma capability por vez; abrir Seller Central quando a ação não for suportada.

**Páginas/telas:** Operação, Envios, FBA, DBA, Listagens e Fiscal.

**Jobs:** writes separadas de read sync, reconciliation e rollback quando suportado.

**Testes:** contract/sandbox, confirmação, RBAC, duplicate request, partial failure e price floor.

**Critérios de aceite:** nenhuma ação irreversível sem confirmação/audit; retry não duplica; repricer nunca cruza piso; cada capability possui feature flag.

**Dependências:** M1–M5 e aprovações externas.

**Riscos:** impacto financeiro/operacional externo. Liberar gradualmente por allowlist de tenants.

## Milestone 15 — SaaS comercial, backoffice e go-live

**Objetivo:** ativar planos, billing, trial, usage, admin seguro, LGPD e operação de suporte para comercialização.

**Por que vem nesta ordem:** preço/gateway/trial são TBD e não devem bloquear o core; go-live só ocorre após segurança e valor comprovados.

**Arquivos/módulos afetados:** novo `packages/billing`, billing/admin APIs/jobs/UI, policies/docs e observability.

**Entidades envolvidas:** Subscription, Plan, FeatureEntitlement, UsageCounter, InvoiceRef, admin/support audit e retention/export/delete requests.

**Migrations necessárias:** provider refs e lifecycle; nunca dados de cartão; retention/legal state; compatibilidade de histórico em downgrade.

**APIs necessárias:** checkout/portal webhooks idempotentes após escolha do gateway, plan/usage/invoices/upgrade/downgrade/cancel; admin tenant/job/import/support com acesso justificado.

**Páginas/telas:** billing/settings, paywall/upgrade CTA, usage, invoices, admin/backoffice e central de ajuda/contato.

**Jobs:** usage rollup, renewal state reconciliation, webhook retry, retention/export/delete e backup verification.

**Testes:** entitlement matrix, forged frontend plan, webhook replay/order, downgrade preserves history, trial 15/30 configurable, export/delete, privileged access audit e restore drill.

**Critérios de aceite:** capabilities, não nomes de plano, protegem backend; upgrade imediato/downgrade próximo ciclo; dados históricos permanecem; LGPD e backup/restore têm procedimento comprovado; métricas/SLOs e suporte estão operáveis.

**Dependências:** milestones anteriores; decisões TBD de gateway, preço, trial, retenção e jurídico.

**Riscos:** cobrança incorreta, perda de acesso/dados e admin excessivo. Mitigar com reconciliation, least privilege e rollout controlado.

## Escopo explicitamente adiado

- Outros marketplaces, até o core Amazon estar estável.
- App mobile nativo; web responsiva primeiro.
- Base global de identidade de produtos e similaridade de imagem.
- Ads writes e automação total; read-only primeiro.
- Repricer, até haver piso, cooldown, limites, audit e rollback.
- API/webhooks públicos, centro de custo avançado e relatórios executivos PDF.
- E-mail/WhatsApp push e chat interno de suporte.
- Qualquer decisão final sobre preços, trial, gateway, LLM, storage, fiscal e retenção marcada TBD no MASTER SPEC.

## Estratégia de retirada do legado

Componentes classificados como REMOVE não são apagados de imediato. A ordem é: instrumentar uso, criar substituto, dual-write quando seguro, backfill, comparar resultados, trocar leitura, manter rollback por uma janela definida e só então remover. Isso se aplica especialmente a `userId` como ownership, `LOCAL_USER_EMAIL`, `SupplierProduct.stock` como capital, cálculo na extensão, token Amazon global, upload bufferizado e tabelas/colunas antigas.

## NEXT CODEX TASK

Após aprovação humana do Milestone 0, implementar exclusivamente a primeira fatia da fundação multi-tenant: adicionar `Organization`, `Membership` com papéis iniciais e `AuditLog` ao schema Prisma; criar uma migration expand/backfill que gere uma organização padrão e Membership `OWNER` para cada `User` existente, adicione `organizationId` inicialmente nullable a `Product`, `Supplier`, `Analysis`, `Opportunity`, `DecisionLog` e `Alert`, preencha esses campos sem alterar IDs nem apagar dados e crie os índices tenant-scoped; introduzir um `TenantContext` server-side nas rotas atuais, mantendo `LOCAL_USER_EMAIL` somente sob modo explícito de desenvolvimento; e adicionar testes de integração com dois usuários/duas organizações provando que leitura e mutação cross-tenant retornam 404/403. Não remover ainda os `userId` legados, não implementar billing, Amazon Connect ou novas telas de produto e não iniciar nenhuma migration de contrato/destrutiva.
