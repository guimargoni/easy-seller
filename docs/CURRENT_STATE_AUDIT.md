# Auditoria do estado atual versus o MASTER SPEC

Data da auditoria: 14/09/2026  
Fonte principal: `docs/EASY_SELLER_MASTER_SPEC.md` v1.0  
Escopo observado: working tree atual (inclui alterações ainda não commitadas)

## 1. Resumo executivo

O Easy Seller atual é um MVP local funcional de pesquisa de produtos e Supplier Intelligence, não ainda o SaaS operacional descrito no MASTER SPEC. A direção técnica central é aproveitável: monorepo npm, TypeScript, Fastify, Prisma/PostgreSQL, clientes finos, cálculos compartilhados, adapters Amazon, snapshots com proveniência, catálogo versionado e um worker separado. Não há evidência que justifique reescrita do zero.

O maior desalinhamento é de centro de gravidade. O modelo atual tem `User` como owner direto e uma única identidade criada por `ensureLocalUser()`. O modelo alvo tem `Organization` como tenant raiz, `Membership`, autenticação, RBAC, auditoria e entitlements server-side. Sem essa fundação, qualquer expansão de pedidos, vendas, estoque, finanças, Ads ou billing ampliaria o custo e o risco da migração.

O segundo desalinhamento é funcional. O sistema implementa bem partes de pesquisa, cálculo preliminar, fornecedor, catálogo, snapshots Amazon e extensão, mas ainda não tem contas Amazon autenticadas, sync incremental, pedidos, vendas, posições/movimentos de estoque, lotes de custo, DRE, fluxo de caixa, Ads, compras, billing ou Easy AI. O dashboard existente resume capital configurado e cenários projetados; não é ainda o Command Center do MASTER SPEC.

O terceiro desalinhamento é de integridade semântica. `SupplierProduct.stock` é usado como se fosse estoque comprado para calcular capital comprometido; `SupplierProduct` mistura oferta, preço e disponibilidade; `Product` mistura identidade canônica com estado de pesquisa; e o update de produto recria `AmazonListing`, podendo apagar histórico ou falhar quando já há snapshots. Esses pontos precisam de migração progressiva, com compatibilidade temporária e reconciliação, não de simples renomeação.

Conclusão: preservar os módulos comprovadamente úteis, estabilizar o baseline, introduzir primeiro a fronteira de tenant e então migrar domínio por domínio. Procurement e inteligência Amazon existentes devem continuar operando durante a transformação, mas não devem ditar o novo modelo de ownership.

### Evidência executada nesta auditoria

| Verificação | Resultado atual | Observação |
|---|---|---|
| `npm run lint` | PASS | Cobre apenas workspaces que possuem script de lint; worker, db, types e catalog não têm cobertura uniforme. |
| `npm run typecheck` | PASS | Todos os workspaces com script passaram. |
| `npm test` | PASS | 30 testes: calculations 12, catalog 11, amazon 7. |
| `npm run build` | PASS | Packages, API, extensão e web; vinext ainda classifica a rota `/` como desconhecida. |
| `npm run db:generate` | PASS | Prisma Client 6.19.3 gerado. |
| `git diff --check` | PASS | Somente avisos LF/CRLF. |
| Prisma `migrate status` | FAIL | PostgreSQL local em `localhost:55432` indisponível; migrations não foram aplicadas nem smoke-testadas nesta auditoria. |
| Estado Git | DIRTY | Muitos arquivos modificados/adicionados e o antigo gitlink de `apps/web` em transição; esta auditoria descreve o working tree, não apenas `HEAD`. |

## 2. Mapa da arquitetura atual

```text
apps/web (React 19 + vinext, uma página cliente monolítica)
apps/extension (Chrome MV3; lê DOM Amazon e também recalcula localmente)
                         │ REST sem autenticação
                         ▼
apps/api (Fastify; app.ts concentra schemas, domínio, queries e rotas)
       │              │                    │
       ▼              ▼                    ▼
packages/        packages/amazon       packages/catalog
calculations     adapters HTTP/DOM      parsing/normalização
       │              │                    │
       └──────────────┴──────────┬─────────┘
                                 ▼
                     packages/db / Prisma / PostgreSQL
                                 ▲
                                 │ polling de CatalogImport
                         apps/worker

Redis existe no docker-compose, mas não é usado.
Object storage, auth, tenant context, RBAC, billing e observabilidade não existem.
```

### 2.1 Apps existentes

| App | Estado | Papel atual | Avaliação |
|---|---|---|---|
| `apps/web` | Funcional | Dashboard local, pesquisa, produtos, calculadora, fornecedores, catálogos e settings em uma única página de ~2 mil linhas. | **REFACTOR**: preservar UX útil, separar rotas/features, adicionar navegação e estados do MASTER; manter React/Next-compatible até decisão de hosting. |
| `apps/api` | Funcional | 31 rotas Fastify, validação Zod, Prisma, catálogo e inteligência Amazon, todas ligadas ao usuário local criado no startup. | **REFACTOR**: modularizar por bounded context e introduzir auth/tenant/RBAC antes de ampliar. |
| `apps/worker` | Parcial | Polling de `CatalogImport` em PostgreSQL e processamento serial. | **MIGRATE**: manter worker, migrar para infraestrutura idempotente com metadata, retries, backoff e DLQ; BullMQ/Redis quando necessário. |
| `apps/extension` | Parcial | Detecta ASIN, lê DOM, consulta API e salva análise. | **REFACTOR**: autenticar, parametrizar API e torná-la cliente fino. O cálculo/score local duplicado deve ser **REMOVE** após equivalência na API. |

### 2.2 Packages existentes

| Package | Estado | Avaliação |
|---|---|---|
| `packages/db` | Prisma schema, client e bootstrap local. | **MIGRATE** ownership `userId` para `organizationId`; preservar IDs e relações; remover bootstrap local do caminho de produção. |
| `packages/types` | Contratos manuais compartilhados. | **REFACTOR** por domínio/versionamento; hoje duplica enums de Prisma/amazon e não cobre erros/paginação/auth. |
| `packages/calculations` | Cálculo financeiro, score, ranking e quantidade sugerida. | **REFACTOR**: preservar fórmulas/testes, migrar o núcleo monetário de reais em `number` para centavos com arredondamento explícito; separar scoring. |
| `packages/amazon` | Ports por capability, adapters SP-API/DOM e fallback de fees. | **REFACTOR**: bom limite de adapter; falta conta, OAuth/LWA, token ref, rate limit, retry, cursor e providers de orders/listings/inventory/finances/reports. |
| `packages/catalog` | CSV/XLSX/PDF, OCR fallback, normalização, versionamento e persistência. | **MIGRATE**: preservar extratores puros; separar domínio de Prisma, ampliar estados e segurança, migrar `CatalogProduct` para `CatalogItem`/`SupplierOffer`. |
| Packages-alvo ausentes | scoring, auth, billing, amazon-ads, procurement, inventory, finance, capital, alerts, ai, observability. | **CREATE quando usados**, sem criar pacotes vazios. |

## 3. Funcionalidades existentes

- CRUD persistente de produtos e fornecedores, associado ao usuário local.
- Workflow de pesquisa com ranking, perfis, critérios, aprovações e checklist de `READY_TO_BUY` validado também na API.
- Calculadora de lucro, margem, ROI, markup, break-even e maximum buy price; análises são persistidas.
- Catálogos CSV/XLSX/PDF/manual e URL de referência; originais locais, hash, metadata, worker, confiança, revisão humana e comparação de versões.
- Criação/vínculo de produto após validação de catálogo e histórico de preço em `SupplierProductPrice`.
- Adapters Amazon para catálogo, preço, fees, competição e sales rank; fallback de DOM e fees estimadas com origem/confiança.
- Snapshots de preço, rank e competição e alertas simples de mudança.
- Extensão MV3 com overlay e salvamento de análise.
- Dashboard local de capital configurado, capital supostamente comprometido e projeções do último cenário.
- Seed demo, scripts smoke HTTP/DB históricos e 30 testes unitários correntes.

Não existem fluxos reais de autenticação, tenant, contas Amazon, sync, vendas, pedidos, inventário, contabilidade, Ads, purchase orders, billing ou AI assistant.

## 4. Classificação KEEP / REFACTOR / MIGRATE / CREATE / REMOVE / DEFER

Legenda: **KEEP** preserva como base; **REFACTOR** mantém o conceito/código, mas muda desenho; **MIGRATE** exige transição de modelo/dados; **CREATE** não existe; **REMOVE** deve sair após substituição segura; **DEFER** pertence ao blueprint, não às próximas fases.

### 4.1 Módulos, funcionalidades e infraestrutura

| Área do MASTER SPEC | Classe | Estado e decisão | Dependências principais |
|---|---|---|---|
| 1. Monorepo modular npm/TypeScript | **KEEP** | Workspaces e separação apps/packages estão alinhados. | Consolidar `apps/web` como diretório normal no Git e CI. |
| Bounded contexts | **REFACTOR** | API e web ainda são arquivos monolíticos; catalog acopla extração, Prisma e fluxo. | Tenant context e contratos de domínio. |
| 2. Web | **REFACTOR** | UI funcional de MVP, mas não tem rotas, paginação, filtros em URL nem navegação alvo. | APIs por contexto, auth, entitlements. |
| API Fastify/Zod | **KEEP** | Stack e validação de entrada são adequadas. | Modularização, auth/RBAC/rate limit. |
| Worker separado | **KEEP** | Processo separado é correto. | Job framework e observabilidade. |
| Extensão MV3 | **REFACTOR** | Pode permanecer como cliente fino. | Auth da extensão e API por ambiente. |
| App mobile nativo | **DEFER** | MASTER prioriza web responsiva. | Validação do produto e APIs estáveis. |
| 3. `db`, `types`, `calculations`, `amazon`, `catalog` | **KEEP** | Todos possuem partes reaproveitáveis. | Refactors específicos abaixo. |
| Packages-alvo adicionais | **CREATE** | Criar apenas quando o milestone correspondente começar. | Evitar scaffolding vazio. |
| 4. Prisma e migrations | **MIGRATE** | Modelo é user-owned e cobre apenas pesquisa/catálogo/snapshots. | Backfill Organization e migrations expand/contract. |
| Dinheiro em centavos no banco | **KEEP** | `Int` cents e basis points predominam. | Definir limites e arredondamento; avaliar `BigInt` para agregados de alto volume. |
| Dinheiro em `number`/reais no motor | **REFACTOR** | Há risco de ponto flutuante antes do arredondamento. | Contrato cents-first e testes de borda. |
| Proveniência atual | **MIGRATE** | `REAL/ESTIMATED/INFERRED` é parcial; faltam `OBSERVED`, `CALCULATED`, `USER_ENTERED`. | Estratégia compatível para enum e backfill. |
| 5. Autenticação | **CREATE** | Nenhum login/sessão; `ensureLocalUser()` concede acesso global. | Identity models e escolha reversível de adapter. |
| Bootstrap `LOCAL_USER_EMAIL` em produção | **REMOVE** | Só pode sobreviver atrás de flag explícita de desenvolvimento/teste. | Auth e seed/dev fixture. |
| 6. Organization/multi-tenancy | **CREATE** | `Organization` e `Membership` ausentes; o ownership legado por `userId` será backfilled para a estrutura nova. | Primeira milestone; backfill e testes de isolamento. |
| Agência/multiempresa | **DEFER** | Arquitetura deve permitir, sem UX inicial. | Membership e seletor de organização. |
| 7. User | **REFACTOR** | Identidade é reaproveitável, mas hoje também é tenant/owner. | Auth, Membership e lifecycle. |
| RBAC e permissões | **CREATE** | Papéis e checks server-side ausentes. | Membership, tenant context. |
| AuditLog | **CREATE** | Não há trilha genérica; `DecisionLog` não substitui auditoria. | Actor, organização e requestId. |
| 8. Product canônico | **MIGRATE** | Entidade é reaproveitável, mas contém pesquisa, preço, demanda e aprovação que pertencem a listing/opportunity/evidência. | Organization, identifiers, listings e opportunity model. |
| ProductIdentifier/Image/Alias/Category | **CREATE** | Hoje são colunas soltas e insuficientes. | Migração progressiva de `ean`, `imageUrl`, `category`. |
| MarketplaceListing | **MIGRATE** | `AmazonListing` é embrião útil, mas não possui conta, SKU, status ou unicidade por tenant/conta. | MarketplaceAccount. |
| CRUD/lista/detalhe de produtos | **REFACTOR** | CRUD existe; tela alvo e filtros não. Update atual recria listing. | Novo modelo e rotas paginadas. |
| 9. Supplier | **MIGRATE** | Cadastro útil; ownership e status ativo faltam. Contato/termos estão achatados. | Organization e modelos SupplierContact/Terms. |
| Tela completa do fornecedor | **CREATE** | Há cards e modal, não tabs, pedidos, históricos ou CTA WhatsApp. | Procurement foundation. |
| 10. Catalog | **KEEP** | Versionamento por fornecedor e preservação de versões estão alinhados. | Tenant scope e storage privado. |
| CatalogProduct | **MIGRATE** | Representa `CatalogItem`; não deve ser confundido com Product/SupplierOffer. | CatalogItem, ExtractionField e offer projection. |
| Comparação de versões | **REFACTOR** | Sete mudanças são detectadas por chave simples. | Dedupe robusto e tenant indexes. |
| 11. Importação CSV/XLSX/PDF/manual | **REFACTOR** | Pipeline determinístico existe e preserva ausência. Estados, segurança e resumability são incompletos. | Job framework, object storage, MIME/scan. |
| Imagem como entrada | **CREATE** | Formato está no MASTER e não é aceito. | Storage e OCR. |
| Catalog AI interpretation | **CREATE** | Não há LLM, prompt version, JSON schema ou usage. | Pipeline seguro e billing de uso. |
| Busca local de ofertas | **CREATE** | Não há full-text/trigram nem página marketplace privada. | SupplierOffer normalizada. |
| 12. Amazon adapters de catálogo/pricing/fees | **KEEP** | Ports por capability e proveniência são boa base. | Conta/credencial por tenant. |
| Amazon Connect/OAuth/LWA | **CREATE** | Token único por env/gateway não representa integração SaaS. | MarketplaceAccount, TokenRef e secret manager. |
| Sync Amazon incremental | **CREATE** | Sem cursor, quota, retries, backoff ou freshness. | Jobs e adapters de orders/listings/inventory/finance. |
| Fallback DOM da extensão | **REFACTOR** | Útil como observação explícita, mas não substitui sync oficial. | Consentimento, auth e dedupe. |
| 13. Price/Rank/Competition snapshots | **REFACTOR** | Imutabilidade e proveniência existem. Faltam account/organization scope explícito e políticas de retenção. | Listing migrada e tenant indexes. |
| Snapshots financeiros/Ads/DRE | **CREATE** | Ausentes. | Sales, finance e Ads. |
| 14. Cálculos fundamentais | **REFACTOR** | Fórmulas e testes são reaproveitáveis; base monetária e convenções precisam endurecimento. | Cents-first, rounding policy e contextos de receita. |
| CMV/landed cost/lotes | **CREATE** | Custo atual é uma oferta de fornecedor, não custo contábil de estoque. | Purchase receipt e InventoryLot. |
| 15. Opportunity scoring | **MIGRATE** | Score explicável existe, mas thresholds são hardcoded, confidence/missing data incompletos e `Opportunity` quase não é usado. | `packages/scoring`, OpportunityScore e versões. |
| Ranking de pesquisa legado | **KEEP** | Preservar como fluxo de descoberta durante migração. | Mapear para Opportunity/DecisionLog. |
| 16. Dashboard/Command Center | **MIGRATE** | Dashboard atual é de pesquisa e projeção, sem vendas reais, período, conta, alertas ou ações. | Sales, profit, inventory, Ads e alerts. |
| 17. Vendas | **CREATE** | Nenhuma entidade/API/tela. | Amazon orders/fees e cost snapshots. |
| 18. Pedidos | **CREATE** | Nenhuma entidade/API/tela. | MarketplaceAccount e sync idempotente. |
| Operações de escrita em pedidos | **DEFER** | Depois de leitura, audit, confirmação e idempotência. | Amazon approval/capability. |
| 19. Estoque | **CREATE** | O módulo real não existe; `SupplierProduct.stock` é disponibilidade da oferta, não inventário do seller. | InventoryPosition/Movement, inbound e lots. |
| Uso de `SupplierProduct.stock` como estoque/capital | **REMOVE** | A derivação atual é semanticamente inválida para operação real. | Substituir por InventoryPosition/Lot antes de retirar. |
| Reposição/cobertura/ROP/parado | **CREATE** | Ausentes. | Sales velocity, inventory e supplier lead time. |
| 20. Financeiro/DRE | **CREATE** | Apenas cenário por produto; sem transações, despesas, recebíveis ou DRE. | Orders, fees, payouts, lots. |
| 21. Capital | **MIGRATE** | Dois campos de settings e derivação incorreta de “estoque”. | CapitalAccount/Movement e reconciliação. |
| Simulador de compra | **MIGRATE** | Calculadora cobre um cenário, mas faltam landed cost, três cenários, prazo e fornecedor formal. | Profit Engine e SupplierOffer. |
| Alocador de capital | **CREATE** | Ausente. | Estoque, capital e Opportunity confiáveis. |
| 22. Procurement foundation | **MIGRATE** | Supplier/Catalog/SupplierProduct existem; carts, POs, receipts e commercial conditions não. | Tenant + novo modelo de offers. |
| WhatsApp/pedido rápido | **CREATE** | Campo WhatsApp existe; não há template, CTA ou `CONTACT_INITIATED`. | Supplier e audit. |
| PurchaseCart/PurchaseOrder/GoodsReceipt | **CREATE** | Ausentes. | Lots, inventory e capital transacionais. |
| 23. Ads analytics | **CREATE** | Nenhuma credencial, entidade, sync, tela ou cálculo ACOS/TACOS. | Amazon Ads approval e sales. |
| Ads writes/automação | **DEFER** | MASTER exige analytics read-only primeiro. | Logs, rollback, limits e flags. |
| 24. Alertas | **MIGRATE** | `Alert` e criação pontual existem; sem fingerprint, estado, regra, ação, inbox ou preferências. | Alert engine e eventos. |
| 25. Easy AI | **CREATE** | Ausente. | Dados estruturados confiáveis, allowlist e tenant isolation. |
| 26. Planos/entitlements | **CREATE** | Ausentes; não há feature gating. | Foundation server-side. |
| Gateway billing/trial/preços | **DEFER** | Decisões comerciais/provedor são TBD; schema extensível pode vir antes. | Entitlements e usage. |
| Billing comercial | **CREATE** | Necessário antes do SaaS público, em milestone tardio. | Gateway escolhido e backoffice. |
| 27. Jobs/filas | **MIGRATE** | Fila em tabela funciona para catálogo, mas não há job envelope, retries, backoff, DLQ ou prioridade. | organizationId e observability. |
| Redis/BullMQ | **MIGRATE** | Redis é provisionado, mas não consumido. Adotar quando o framework de jobs for criado. | Operação e idempotência. |
| Eventos de domínio | **CREATE** | Não há event contract/outbox; efeitos são chamados inline. | Bounded contexts e transações. |
| 28. Segurança | **REFACTOR** | Zod/CORS/ORM existem; faltam auth, tenant, RBAC, rate limit, CSRF strategy, secrets manager, scan e redaction consistente. | Milestone 1. |
| Upload atual por extensão e buffer de 256 MB | **REMOVE** | Deve ser substituído por detecção real de MIME, streaming/quarentena e limite por plano; não remover antes da nova rota. | Storage privado e scan. |
| Token Amazon global em env | **REMOVE** | Incompatível com multicontas/multi-tenant. | IntegrationTokenRef/secret manager. |
| 29. Testes unitários | **KEEP** | 30 passam e são uma boa base; novas suítes devem ampliar, não substituir, essa cobertura. | Cents-first e fixtures reais anonimizadas. |
| Testes de integração/contrato/E2E | **CREATE** | Smokes não integram `npm test`; não há API isolada, tenant, jobs, browser ou contract suite. | Ambiente PostgreSQL/Redis reprodutível. |
| CI | **CREATE** | Nenhum workflow/configuração encontrado. | Gates determinísticos e migrations. |
| 30. Documentação | **REFACTOR** | MASTER é fonte correta; docs antigas descrevem fases e limitações já superadas ou conflitantes. | ADRs, API docs e matriz de status. |
| Relatórios/exportação | **CREATE** | Ausentes. | APIs filtradas/RBAC. PDF executivo é **DEFER**. |
| LGPD e backoffice mínimo | **CREATE** | Retenção/export/delete e administração segura são necessários antes do SaaS público. | Tenant, audit, billing e decisão jurídica. |
| Suporte inicial | **CREATE** | Central de ajuda, contato e ticket/link ainda não existem. | Operação comercial. |
| Chat interno e política final de suporte | **DEFER** | O próprio MASTER os coloca depois/TBD. | Validação de necessidade e decisão comercial. |
| Outros marketplaces | **DEFER** | Adapter-friendly, mas Amazon Brasil permanece prioridade. | Estabilização do core. |

### 4.2 Entidades alvo

| Contexto | Entidade do MASTER | Classe | Reaproveitamento/migração |
|---|---|---|---|
| Identity | User | **REFACTOR** | Preservar IDs/e-mail; separar identidade de ownership. |
| Identity | Organization | **CREATE** | Nova raiz de tenant. |
| Identity | Membership | **CREATE** | Relação User↔Organization e role. |
| Identity | Role/Permission | **CREATE** | Papéis iniciais e capabilities server-side. |
| Identity | AuditLog | **CREATE** | Imutável; não substituir por `DecisionLog`. |
| Billing | Subscription, Plan, FeatureEntitlement, UsageCounter, InvoiceRef | **CREATE** | Começar por capabilities/usage; gateway continua TBD. |
| Marketplace | MarketplaceAccount | **CREATE** | Conta Amazon por organização. |
| Marketplace | SyncCursor | **CREATE** | Por account/capability. |
| Marketplace | IntegrationTokenRef | **CREATE** | Referência opaca, segredo fora do banco comum. |
| Marketplace | MarketplaceOrder, MarketplaceOrderItem | **CREATE** | Chaves externas idempotentes compostas por conta. |
| Marketplace | MarketplaceListing | **MIGRATE** | Evoluir `AmazonListing`, preservando snapshots. |
| Marketplace | FeeTransaction | **CREATE** | Base da lucratividade real. |
| Marketplace | Payout/Receivable | **CREATE** | Base de caixa/conciliação. |
| Product | Product | **MIGRATE** | Manter identidade; retirar sinais e estados de pesquisa. |
| Product | ProductIdentifier, ProductImage, ProductAlias, ProductCategory | **CREATE** | As entidades não existem; backfill de EAN, imagem e categoria atuais preservará os dados. |
| Cost | InventoryLot, CostComponent, CostSnapshot | **CREATE** | Não derivar de `SupplierProduct.stock`. |
| Inventory | InventoryPosition, InventoryMovement, InboundShipment, ReplenishmentRecommendation | **CREATE** | Modelo novo alimentado por sync e recebimento. |
| Ads | AdAccount e cinco níveis de snapshots | **CREATE** | Somente read-only inicialmente. |
| Finance | Expense, ExpenseAllocation, FinancialSnapshot, DREPeriodSnapshot | **CREATE** | Separar DRE de fluxo de caixa. |
| Capital | CapitalAccount, CapitalMovement, CapitalAllocation, CapitalPlan | **CREATE** | As entidades não existem; backfill apenas do capital informado, sem inventar movimentos históricos. |
| Supplier | Supplier | **MIGRATE** | Ownership e status; preservar IDs. |
| Supplier | SupplierContact, SupplierTerms | **CREATE** | As entidades não existem; normalizar campos atuais progressivamente. |
| Catalog | Catalog | **MIGRATE** | Manter versões; adicionar organization e storage ref. |
| Catalog | CatalogFile, CatalogPage, ExtractionField | **CREATE** | Migrar metadata/sourceFile/fieldConfidence. |
| Catalog | CatalogImport | **MIGRATE** | Estados e job envelope ampliados. |
| Catalog | CatalogItem | **MIGRATE** | Renome conceitual de `CatalogProduct`, com compatibilidade. |
| Catalog | ProductMatch | **REFACTOR** | Hoje só ASIN/status/score; falta product candidate, evidence e estados alvo. |
| Procurement | SupplierOffer | **MIGRATE** | Evoluir `SupplierProduct`; separar offer de inventário. |
| Procurement | SupplierOfferTier | **CREATE** | MOQ/tier/combo. |
| Procurement | SupplierPriceSnapshot | **MIGRATE** | `SupplierProductPrice` é boa base; ajustar vínculo à offer. |
| Procurement | PurchaseCart, PurchaseCartItem | **CREATE** | Carrinho por fornecedor. |
| Procurement | PurchaseOrder, PurchaseOrderItem, GoodsReceipt | **CREATE** | Recebimento deve ser transacional com lotes/estoque/capital. |
| Opportunity | Opportunity | **MIGRATE** | Tabela existe, mas quase não é usada e não guarda recomendação/confiança/evidência completas. |
| Opportunity | OpportunityScore | **CREATE** | A entidade não existe; extrair/backfill snapshots de score de `Analysis`/JSON. |
| Opportunity | DecisionLog | **REFACTOR** | Entidade existe, mas não é utilizada pelas rotas atuais. |
| Alerts | Alert | **MIGRATE** | Adicionar organização, estado, fingerprint, entidade e ação. |
| Alerts | AlertRule, AlertEvent | **CREATE** | Regras configuráveis e avaliação deduplicada. |
| AI | AiUsage, AiConversation, AiToolInvocation | **CREATE** | Somente após tools internas autorizadas. |
| Legado | UserSettings | **MIGRATE** | Separar OrganizationSettings/Strategy/Inventory/Ads/Procurement; manter ponte temporária. |
| Legado | Analysis | **MIGRATE** | Preservar histórico como cenário/snapshot; não tratá-lo como venda real. |

## 5. Lacunas contra o MASTER SPEC

### P0 — bloqueiam a arquitetura alvo

1. Ausência de `Organization`, `Membership`, auth, RBAC e audit.
2. Nenhuma fronteira de tenant na API; o usuário é capturado uma vez no startup.
3. Ausência de MarketplaceAccount e credencial por tenant/conta.
4. Modelo de estoque/capital semanticamente incorreto para operação real.
5. Motor monetário recebe reais em ponto flutuante e não documenta arredondamento por componente.
6. Não há idempotência sistêmica, job envelope, DLQ nem observabilidade suficiente.
7. Upload não atende aos requisitos de segurança/privacidade para SaaS.

### Parity Core ausente

- onboarding;
- Amazon Connect e sincronização;
- pedidos, vendas e detalhe financeiro;
- inventário FBA/DBA/próprio/inbound;
- Curva ABC, reembolsos e rentabilidade;
- DRE, despesas, recebíveis e fluxo de caixa;
- dashboard por período/conta com dados realizados;
- usuários/equipe, multicontas e permissões;
- exportações;
- Ads read-only;
- operações/fiscal/listagens, que permanecem posteriores ao core de leitura.

### Easy Advantage incompleto

- Capital Map real, movimentos, concentração e alocador;
- simulador pessimista/base/otimista;
- SupplierOffer/tier e comparador multi-critério;
- carrinho, purchase order e recebimento;
- busca local de catálogo;
- interpretação por IA e prompts versionados;
- opportunity score completo com confiança/dados ausentes;
- alert engine e Easy AI.

## 6. Riscos técnicos

| Severidade | Risco | Evidência/efeito | Mitigação |
|---|---|---|---|
| Crítica | Isolamento inexistente | Todas as rotas usam um `user` criado no startup. | Tenant context obrigatório e testes negativos antes de novos domínios. |
| Alta | Perda/falha no update de listing | `PUT /products/:id` executa `amazonListing.deleteMany`; snapshots têm FK restritiva e o histórico pode ser apagado ou bloquear a operação. | Corrigir com update/upsert preservando listing e snapshots antes da migração ampla. |
| Alta | Capital incorreto | `SupplierProduct.stock * cost` é somado como estoque do seller. | Não usar em decisões reais; migrar para InventoryLot/Position e CapitalMovement. |
| Alta | Upload inseguro/oneroso | Validação por extensão, `toBuffer()` até 256 MB e storage local absoluto. | Streaming/quarentena, MIME real, limits, scan e object storage privado. |
| Alta | Token global e falhas silenciosas Amazon | Credencial em env; `safely()` engole exceções. | TokenRef por account, logs sanitizados, retries/rate limit/circuit telemetry. |
| Alta | API e UI monolíticas | `app.ts` ~1.100 linhas; `page.tsx` ~2.000. | Modularizar por contexto em fatias, sem big bang. |
| Média | Enum/origem insuficiente | Manual e calculado são representados como inferred/real. | Expandir provenance com backfill explícito. |
| Média | Score parece mais preciso que os dados | Heurística de sales rank e defaults 50 alimentam score; confidence não faz parte da saída completa. | Versionar modelo, penalizar missingness e expor confiança. |
| Média | Worker não escala com segurança operacional | Polling serial, sem retry/DLQ/heartbeat. | Job envelope, idempotency keys e inspeção de falhas. |
| Média | Web carrega tudo | O primeiro render chama oito endpoints completos; sem paginação. | Rotas por página, cache/query layer e server-side filters. |
| Média | Contratos duplicados | Enums/interfaces repetidos em Prisma, types, amazon e UI. | Contratos por domínio e mapeadores explícitos. |
| Média | Tecnologia web beta | `vinext` beta e hosting Cloudflare estão no working tree; build passa, mas risco de mudança de runtime. | ADR antes de aprofundar dependência; não migrar sem evidência. |

## 7. Riscos de dados e migrations

1. **Backfill de tenant:** criar uma organização por usuário atual é seguro como default, mas usuários duplicados/compartilhados devem ser detectados antes. Dados derivados por relações (catálogos via supplier, snapshots via listing) precisam de verificação de consistência.
2. **Duplo ownership temporário:** durante expand/contract, `userId` e `organizationId` podem divergir. A migration deve adicionar constraints/validadores e telemetria antes de remover colunas antigas.
3. **Cascades:** muitos registros privados usam `onDelete: Cascade`; auditoria, billing, imports e históricos exigirão retenção diferente. Não copiar cascades automaticamente.
4. **Unicidade documentada, mas não implementada:** `DATABASE_SCHEMA.md` afirma user+ASIN e supplier+SKU; o schema tem apenas `@@unique([productId, asin])` e índice não único em supplier+SKU. Há risco de duplicatas já existentes.
5. **ASIN ambíguo:** o mesmo ASIN pode existir em vários Products do mesmo usuário; `findFirst` torna o resultado não determinístico.
6. **Drift schema/migration:** a migration inicial criou `CatalogProduct.fieldConfidence` nullable, enquanto o Prisma atual declara `Json` obrigatório. O banco deve ser auditado por nulls antes de constraint.
7. **Separação Product/Listing/Offer:** mover colunas não pode perder snapshots, análises ou vínculos de catálogo. Exige tabelas novas, backfill, dual-read e só depois contract.
8. **Custo versus oferta:** `SupplierProduct.costCents` não pode virar CMV retroativo. Deve migrar como SupplierOffer/price snapshot; lotes só nascem de entrada/recebimento conhecido.
9. **Capital sem histórico:** `capitalTotalCents` pode originar saldo inicial, mas não movimentos históricos fictícios. Marcar como `USER_ENTERED` em uma data de corte.
10. **Valores monetários:** PostgreSQL `INTEGER` pode ser insuficiente em agregações/tenants de grande volume; decidir antes das tabelas de pedidos/financeiro, preservando a regra de inteiro em centavos.
11. **Enums PostgreSQL:** expansão é simples; remoção/renome é destrutiva. Usar estados novos, mapear legados e remover apenas após telemetria.
12. **Arquivos locais:** `sourceFile` contém caminhos locais; migração para object storage precisa checksum, copy verification e rollback antes de trocar referências.

## 8. Dívida técnica

- API sem módulos, service layer, repository boundary ou schemas de resposta.
- Frontend sem roteamento por módulo, query/cache layer, paginação e componentes de domínio.
- Uso amplo de `any` na serialização de catálogo.
- Package `catalog` depende diretamente de Prisma, dificultando testes puros e workers alternativos.
- `queueOpportunity` não enfileira um job: cria/vincula Product/offer dentro de transação; o nome oculta o efeito.
- `Opportunity` e `DecisionLog` praticamente não participam dos fluxos; `Analysis` acumula papéis.
- Alertas são strings livres, duplicáveis e sem lifecycle.
- Imports não têm prompt/extraction version, attempt, retry policy ou erro sanitizado por tipo.
- `sourceFile` é caminho absoluto local e a API guarda o arquivo antes de confirmar criação do catálogo; falha pode deixar órfão.
- Não há versionamento de API, OpenAPI, error contract unificado ou idempotency key.
- Não há testes automatizados de API/web/worker/extension no gate padrão, nem CI encontrada.
- Lint não é uniforme entre workspaces.
- README, ARCHITECTURE, DATABASE_SCHEMA e ROADMAP ainda refletem a sequência antiga e contêm afirmações desatualizadas.
- Working tree muito extensa e sem baseline limpo aumenta risco de atribuir regressões ao milestone errado.

## 9. Dependências externas

| Dependência | Estado | Risco/decisão |
|---|---|---|
| PostgreSQL 17 | Configurado; indisponível nesta auditoria | Tornar ambiente de teste reprodutível e executar migrations/smokes antes do primeiro change. |
| Redis 7 | Docker compose apenas | Necessário quando BullMQ/job framework entrar; hoje é custo sem uso. |
| Object storage S3-compatible | Ausente; provider TBD | Criar port e usar implementação local/dev, sem hardcode de vendor. |
| Amazon SP-API | Gateway opcional por env | OAuth/app approval, quotas e secrets por account ainda necessários. |
| Amazon Ads API | Ausente e sujeita a aprovação | Não bloquear core; usar adapter e fixtures. |
| Tesseract/pdfjs/canvas | Presentes | Custo/CPU, idiomas e segurança de documentos precisam métricas e isolamento. |
| Provedor LLM | TBD | Port `CatalogInterpreter`, JSON schema e prompts versionados antes de escolher vendor. |
| Gateway de pagamento | TBD | Entitlements não devem depender da escolha. |
| Fiscal/NFe | TBD/futuro | Não inventar provider; manter boundary. |
| E-mail/WhatsApp push | Futuro | In-app primeiro; WhatsApp inicial é deep link auditado. |
| Jurídico/LGPD | Não implementado | Necessário antes de comercialização: políticas, retenção, export/delete e subprocessadores. |

## 10. Recomendação de sequência de transformação

1. **Congelar e provar o baseline:** consolidar o working tree, restaurar PostgreSQL reproduzível, aplicar migrations e rodar smoke atual sem alterar comportamento.
2. **Fundação SaaS/multi-tenant:** Organization, Membership, tenant context, auth seam, RBAC inicial, AuditLog, settings/entitlements base e backfill expand/contract.
3. **Amazon Connect e job platform:** MarketplaceAccount, tokens seguros, cursors, providers por capability, idempotência, retries e observabilidade.
4. **Parity de leitura:** pedidos, vendas, fees, recebíveis, listings e estoque sincronizados; Command Center e páginas operacionais.
5. **Profit Engine:** lotes, componentes de custo, CMV, despesas, reconciliação e DRE determinísticos em centavos.
6. **Inventory Intelligence:** posições/movimentos, inbound, velocity, coverage, ROP e reposição.
7. **Capital Intelligence:** contas/movimentos, mapa sem dupla contagem, simulador e alocação.
8. **Migrar Procurement existente:** SupplierOffer, tiers, busca, comparação, WhatsApp, carrinho, purchase order e recebimento transacional.
9. **Completar Catalog AI e Opportunity:** storage seguro, pipeline versionado/IA seletiva, dedupe, matching e score confiável.
10. **Ads e alertas:** analytics read-only, lucro pós-Ads e inbox deduplicada.
11. **Easy AI:** somente sobre tools internas autorizadas e dados já confiáveis.
12. **Amazon Operations e SaaS comercial:** writes guardadas; depois billing, trial, admin, LGPD e go-live gates.

Esta ordem preserva pesquisa, fornecedores, catálogos, cálculos e extensão durante a migração e impede que novos módulos sejam construídos sobre ownership single-user ou semântica incorreta de estoque/capital.
