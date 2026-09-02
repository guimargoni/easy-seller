# Arquitetura

## Direção

O Easy Seller é um monorepo modular. Web e extensão são clientes finos: exibem resultados e coletam entradas, mas não reimplementam cálculo financeiro ou score. Regras determinísticas ficam em `packages/calculations`; contratos ficam em `packages/types`; a API orquestra persistência e providers externos.

```text
Web / Chrome Extension
          │ REST
          ▼
      Fastify API ───── packages/calculations
          │             packages/scoring (evolução)
          ├──────────── packages/amazon (ports/adapters)
          │
   PostgreSQL/Prisma ── Redis/BullMQ workers
```

## Decisões técnicas

1. **Monorepo npm workspaces.** Baixa barreira no MVP; pode migrar para Turborepo quando o grafo crescer.
2. **Regras puras e compartilhadas.** Resultados idênticos em API, jobs e testes, sem dependência de UI.
3. **Fastify + Zod.** API pequena, validada nas fronteiras e com logging estruturado nativo.
4. **PostgreSQL + Prisma.** Integridade relacional e migrations legíveis; JSON apenas para evidências variáveis como confiança por campo.
5. **Providers Amazon isolados.** SP-API e qualquer fonte futura implementam interfaces; mocks suportam desenvolvimento sem credenciais.
6. **BullMQ para processos longos.** Importação de catálogo e snapshots nunca bloqueiam requests.
7. **Valores monetários persistidos em centavos.** Evita arredondamento binário. Funções aceitam reais no MVP e arredondam nas saídas.
8. **Single-user sem autenticação na Fase 1.** Toda entidade já possui caminho para `userId`/tenant na evolução SaaS.
9. **Estimativas rotuladas.** Todo sinal Amazon carrega `REAL`, `ESTIMATED` ou `INFERRED`, além de confiança.

## Fluxos da Fase 1

- Calculadora: formulário → pacote compartilhado → resultado e interpretação.
- Produto: CRUD REST → cálculo/score → oportunidade persistível.
- Extensão: identifica ASIN → consulta API/mock → mostra overlay → salva produto.
- Fornecedor: CRUD REST com cadastro essencial.

## Catálogos (arquitetura preparada)

O pipeline futuro separa `PdfTextExtractor`, `PdfLayoutExtractor`, `ProductBlockDetector` e `CatalogNormalizer`. Cada bloco preserva página, bounding boxes, imagem e texto bruto. OCR é fallback por página. Imports viram jobs idempotentes, versionados e retomáveis; QR/links são apenas apresentados até ação explícita.

## Segurança e observabilidade

- Zod em entrada/saída; limite de tamanho e MIME em uploads futuros.
- Logs estruturados com `requestId`, sem documentos ou credenciais.
- Segredos apenas por ambiente; CORS restrito.
- Jobs idempotentes, retries com backoff e dead-letter monitoring.
- Métricas-chave: duração de import, taxa de revisão, erro de provider, defasagem de snapshot.

## Riscos

- Estimativa de vendas por rank varia por categoria e pode induzir excesso de estoque.
- Dados Amazon podem ser incompletos, defasados ou limitados por quota.
- Matching falso positivo liga custo ao ASIN errado; auto-confirmação exige limiar alto.
- PDFs visuais e escaneados exigem revisão humana e custos de OCR.
- Taxas/impostos dependem de categoria, regime e contrato; precisam de vigência e origem.
- Buy Box e guerra de preços mudam rapidamente; score é fotografia, não garantia.
- Uploads demandarão antivírus, storage privado e políticas de retenção.

## Dependências operacionais

- Node.js 22+, PostgreSQL 17, Redis 7.
- Credenciais SP-API e autorização Seller Central somente na Fase 3.
- Storage de objetos para catálogos na Fase 2.
- OCR/decoder QR selecionados após benchmark com catálogos reais.
