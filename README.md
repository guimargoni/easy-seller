# Easy Seller

Inteligência comercial para compra e revenda na Amazon Brasil. A Fase 4 adiciona providers Amazon rastreáveis, integração opcional com SP-API, snapshots históricos, alertas de mudança e extensão com origem/confiança por dado.

## Começar

Requisitos: Node.js 22+. Docker é opcional para PostgreSQL/Redis.

```bash
npm install
npm run dev
```

O painel abre em `http://localhost:3000` e a API em `http://localhost:3333`. Para executar separadamente:

```bash
npm run dev:web
npm run dev:api
npm run dev:worker
npm run dev:extension
```

Testes e builds:

```bash
npm test
npm run smoke:phase3
npm run build
```

Para infraestrutura local, depois de instalar Docker Desktop:

```bash
docker compose up -d postgres redis
```

### Baseline reproduzível de teste

O gate destrutivo só aceita um banco local cujo nome contenha `test`, além de exigir
`NODE_ENV=test` e `ALLOW_TEST_DATABASE=true`. Para usar o PostgreSQL isolado:

```bash
docker compose -f docker-compose.test.yml up -d postgres-test
cp .env.test.example .env.test
npm run test:baseline
```

O gate executa lint, typecheck, testes unitários, build, Prisma generate, reset e seed
do banco de teste, verificação de drift, contratos HTTP, importação de catálogo e
recovery do worker. `npm run db:reset` usa o mesmo guard e recusa bancos sem
identificação explícita de teste.

Não há login no MVP. Os dados iniciais são fictícios. O painel, a API e o PostgreSQL precisam estar ativos para manter a pesquisa persistente.

## Estrutura

- `apps/web`: painel decisório
- `apps/api`: API Fastify com persistência PostgreSQL/Prisma
- `apps/extension`: extensão Chrome MV3
- `apps/worker`: processamento assíncrono persistido de catálogos
- `packages/catalog`: extração, detecção, normalização e comparação de versões
- `packages/calculations`: regras financeiras puras e testadas
- `packages/types`: contratos compartilhados
- `packages/amazon`: interfaces de providers e adapters mock
- `packages/db`: schema Prisma
- `docs`: decisões e especificações

O módulo **Catálogos** aceita CSV, XLSX, PDF, entrada manual e URL de referência. Itens validados seguem para `CANDIDATO → PESQUISA → VALIDAÇÃO → TESTE → APROVADO/DESCARTADO`. O sistema não compra produtos, não consulta dados Amazon automaticamente e não usa SP-API.

Veja [ARCHITECTURE.md](docs/ARCHITECTURE.md), [PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md), [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) e [ROADMAP.md](docs/ROADMAP.md).
