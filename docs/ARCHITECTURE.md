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
6. **Fila persistida para processos longos.** `CatalogImport` é a fila no PostgreSQL e o worker reivindica jobs de forma atômica; importação nunca bloqueia requests e sobrevive a reinícios.
7. **Valores monetários persistidos em centavos.** Evita arredondamento binário. Funções aceitam reais no MVP e arredondam nas saídas.
8. **Single-user sem autenticação na Fase 1.** Toda entidade já possui caminho para `userId`/tenant na evolução SaaS.
9. **Estimativas rotuladas.** Todo sinal Amazon carrega `REAL`, `ESTIMATED` ou `INFERRED`, além de confiança.

## Fluxos da Fase 1

- Calculadora: formulário → pacote compartilhado → resultado e interpretação.
- Produto: CRUD REST → cálculo/score → oportunidade persistível.
- Extensão: identifica ASIN → consulta API/mock → mostra overlay → salva produto.
- Fornecedor: CRUD REST com cadastro essencial.

## Fluxos da Fase 2

- Pesquisa: cadastro persistente → análise financeira preliminar → sinais específicos da estratégia → restrições explícitas → ranking.
- `GENERIC_LISTING`: pondera ranqueamento, espaço para publicidade, avaliações, maturidade do anúncio e risco de entrada.
- `BRANDED_RESELL`: pondera Buy Box, concorrentes, preço, giro e presença da Amazon; autorização de marca/produto limita a recomendação fora do score.
- A API bloqueia `READY_TO_BUY` enquanto o checklist ou uma autorização obrigatória estiver pendente. A interface também desabilita esse estado.
- `GET /research/candidates` usa as configurações do usuário e devolve colocação, recomendação, explicação comparativa, sinais e restrições.

PDF automático, SP-API e automação de compra permanecem fora desta fase.

## Catálogos (arquitetura preparada)

O pipeline separa `CatalogImport`, `PdfTextExtractor`, `PdfLayoutExtractor`, `ProductBlockDetector` e `CatalogNormalizer`. A ordem é texto nativo, layout, detecção de imagens e OCR como fallback. Texto bruto, página, método e confiança são preservados; ausência de evidência produz `null`, nunca um campo inventado. URLs externas são armazenadas apenas como referência.

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
- SP-API e autorização Seller Central permanecem fora da Fase 3.
- O armazenamento local de originais usa `CATALOG_STORAGE_DIR`; produção deve trocar por object storage com a mesma política imutável.
- O fallback OCR usa Tesseract local somente após texto/layout e deve ter idiomas e threshold calibrados com catálogos escaneados reais.
