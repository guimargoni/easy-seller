# Auditoria da Fase 1

Data da auditoria: 02/09/2026.

Escopo: somente a Fase 1. Catálogos, SP-API, scraping, análise em massa, SaaS, billing e demais fases permanecem fora desta correção.

| Funcionalidade | Status atual | Problema | Impacto | Correção necessária | Arquivo(s) |
|---|---|---|---|---|---|
| Estrutura do monorepo | BROKEN | `apps/web` está versionado como gitlink `160000` e contém `.git` próprio; também não participa dos workspaces raiz | Um clone do repositório raiz não contém o frontend | Remover o Git interno, substituir o gitlink por arquivos normais e incluir `apps/web` no workspace | `.git/index`, `apps/web/.git`, `package.json` |
| Instalação única | BROKEN | Há lockfile raiz e lockfile isolado do frontend | `npm install` na raiz não garante uma instalação coerente do frontend | Consolidar dependências e scripts no workspace raiz | `package.json`, `package-lock.json`, `apps/web/package.json` |
| Persistência da API | MOCKED | Produtos e fornecedores são arrays em memória | Dados desaparecem ao reiniciar API | Conectar Fastify ao Prisma/PostgreSQL | `apps/api/src/server.ts`, `packages/db` |
| Usuário local | PARTIAL | Schema possui `User`, mas API não resolve usuário local | Registros não possuem ownership em runtime | Criar bootstrap idempotente do usuário local e configuração | `packages/db/prisma/schema.prisma`, API |
| Configuração de capital | NOT_IMPLEMENTED | Capital e metas estão hardcoded na UI/API | Dashboard e sugestão de estoque não refletem o usuário | Persistir `UserSettings` e criar endpoints/tela de edição | Schema, API, web |
| Perfil estratégico | NOT_IMPLEMENTED | Apenas pesos `FAST_CASH` existem; perfil não é persistido | Score não muda conforme estratégia | Implementar pesos centralizados e configuração persistente | `packages/calculations`, schema, API, web |
| Preferência simples/avançado | PARTIAL | Toggle altera apenas estado React e some no reload | Preferência não persiste | Persistir em `UserSettings` | Web, API, schema |
| Listagem de produtos | MOCKED | Tabela usa constante local com quatro produtos | Não representa banco nem mutações | Consumir `GET /products` e estados de loading/error/empty | `apps/web/app/page.tsx` |
| Criação de produto | NOT_IMPLEMENTED | Botão não possui ação | Usuário não cadastra produto | Formulário validado e `POST /products` | Web, API |
| Edição de produto | NOT_IMPLEMENTED | Não há formulário/ação | Dados não podem ser corrigidos | Detalhe/edit e `PUT /products/:id` | Web, API |
| Exclusão de produto | NOT_IMPLEMENTED | Não há ação | Cadastro não pode ser removido | Confirmação e `DELETE /products/:id` | Web, API |
| Detalhe do produto | NOT_IMPLEMENTED | Linha/botão não abre produto | Não há análise individual | View de detalhe consumindo API | Web, API |
| Associação produto-fornecedor | NOT_IMPLEMENTED | Schema possui relação, porém API/UI não expõem | Custo não possui fonte rastreável | CRUD de `SupplierProduct` integrado ao produto | Schema, API, web |
| Listagem de fornecedores | MOCKED | Cards usam constante React | Reload perde mudanças | Consumir banco via API | Web |
| Criação de fornecedor | PARTIAL | Modal cria item genérico apenas no estado local | Campos digitados não são salvos | Formulário completo e mutation real | Web, API |
| Edição/exclusão de fornecedor | NOT_IMPLEMENTED | Botão “Ver fornecedor” não faz nada | CRM é somente visual | Formulário e endpoints persistentes | Web, API |
| Campos de fornecedor | PARTIAL | Faltam WhatsApp e `hasCatalog` no schema/contratos | Cadastro não atende requisitos mínimos | Adicionar campos e migration | Schema, tipos, API, web |
| Calculadora financeira | PARTIAL | Entradas calculam dinamicamente, mas score usa demanda/concorrência hardcoded e não salva análise | Resultado financeiro funciona, decisão não representa o produto | Manter cálculo puro; separar sinais opcionais e salvar snapshot pela API | Calculations, API, web |
| Cenário financeiro obrigatório | BROKEN | O teste adiciona R$ 0,65 para atingir lucro de R$ 7,36, mas então despesas viram R$ 40,62, contrariando R$ 39,97 | Teste mascara inconsistência do enunciado | Testar os números aritméticos honestamente e documentar a divergência: R$ 39,97 implica lucro R$ 8,01; R$ 7,36 exige despesas R$ 40,62 | Testes, relatório |
| Opportunity Score | PARTIAL | Função é pura, mas frontend e API misturam sinais fixos e aceitam score visual no dataset | Score exibido pode ser fictício | Calcular exclusivamente no backend/package; parametrizar perfil e marcar origem | Calculations, API, web, extensão |
| Preço máximo de compra | WORKING | Fórmula pura e teste básico existem | Falta validação integrada com configuração persistente | Reutilizar motor com margem alvo do usuário e ampliar testes | Calculations, API, web |
| Dashboard | MOCKED | Capital, lucro, ROI, estoque, produtos e alertas são strings estáticas | Decisão pode ser enganosa | Criar endpoint agregado derivado do banco/configuração; mostrar “Dados insuficientes” | API, web |
| Navegação principal | PARTIAL | Quatro views alternam, mas ações “Analisar”, “Ver todas”, “Revisar”, filtros e detalhes não funcionam | Jornada interrompida | Ligar todas as ações principais ou removê-las | Web |
| Feedback de formulários | BROKEN | Não há loading/erro e sucesso é implícito | Falhas silenciosas | Estados explícitos e mensagens acessíveis | Web, extensão |
| Migrations | PARTIAL | Há SQL inicial, mas não inclui novas configurações/análises e nunca foi aplicado nesta auditoria | Schema runtime não comprovado | Criar migration da Fase 1, aplicar em PostgreSQL e validar | `packages/db/prisma/migrations` |
| Seed | PARTIAL | Seed cria demo, porém duplica registros a cada execução e mistura bootstrap com demonstração | Reset/seed não é confiável | Seed idempotente e claramente identificada como demo; bootstrap local separado | `packages/db/prisma/seed.ts`, API |
| API de produtos | PARTIAL | Rotas básicas existem, sem GET por id, relação de fornecedor ou persistência | Não atende CRUD real | Reescrever sobre Prisma, completar contratos/status codes | API |
| API de fornecedores | PARTIAL | Rotas básicas existem em memória e campos incompletos | Não atende persistência/relacionamento | Reescrever sobre Prisma | API |
| API de configurações/dashboard | NOT_IMPLEMENTED | Endpoints inexistentes | Frontend depende de hardcode | Implementar settings e dashboard | API |
| Análises salvas | NOT_IMPLEMENTED | `Opportunity` não guarda snapshot completo e API não oferece CRUD de análise | Extensão não entrega análise ao painel | Criar `AnalysisSnapshot` e endpoints | Schema, API, web, extensão |
| Extensão: detecção de página | PARTIAL | Content script roda em qualquer URL Amazon e usa ASIN fake como fallback | Página de busca pode mostrar análise falsa | Montar apenas em `/dp/`/`/gp/product/`; ausência vira “não disponível” | Extensão |
| Extensão: valores/cálculos | MOCKED | Score, margem, ROI, preço e giro são constantes | Métricas falsas são apresentadas como reais | Formulário manual e chamada à API/motor compartilhado | Extensão, API |
| Extensão: salvar | BROKEN | Salva somente no `chrome.storage.local`, não no backend | Análise não aparece no painel | `POST /analyses` com feedback e link para painel | Extensão, API, web |
| Documentação da API | NOT_IMPLEMENTED | `docs/API.md` não existe | Integração e teste não têm contrato explícito | Documentar endpoints, payloads e status codes | `docs/API.md` |
| Smoke test persistente | NOT_IMPLEMENTED | Não existe script; smoke anterior usou arrays | Persistência e relações não comprovadas | Criar script que exerce banco e HTTP ponta a ponta | `scripts/smoke-test.ts` |
| Lint/typecheck completos | PARTIAL | Scripts cobrem apenas partes; frontend exclui componentes do lint e não há typecheck raiz | Regressões podem passar | Criar comandos raiz para todos os workspaces | Configuração raiz |
| Execução do PostgreSQL | BROKEN | Docker não estava disponível na verificação anterior; migrations não foram executadas | Definition of Done não foi comprovada | Subir Postgres real disponível no host, aplicar migration e executar smoke | Docker/ambiente |

## Conclusão da auditoria

A versão existente é um protótipo visual compilável, não um MVP persistente. As únicas peças substancialmente funcionais são parte do motor financeiro, o build dos clientes e a navegação local entre quatro views. A correção deve trocar o centro de gravidade do sistema: PostgreSQL como fonte de verdade, API como única fronteira de negócio e web/extensão como clientes do mesmo motor.
