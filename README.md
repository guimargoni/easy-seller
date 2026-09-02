# Easy Seller

Inteligência comercial para compra e revenda na Amazon Brasil. Este repositório contém a primeira fase: painel web, API REST local, regras de cálculo compartilhadas, schema PostgreSQL e extensão Chrome MV3 com dados mockados.

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
npm run dev:extension
```

Testes e builds:

```bash
npm test
npm run build
```

Para infraestrutura local, depois de instalar Docker Desktop:

```bash
docker compose up -d postgres redis
```

Não há login no MVP. Os dados iniciais são fictícios e o painel funciona sem a API para facilitar a demonstração.

## Estrutura

- `apps/web`: painel decisório
- `apps/api`: API Fastify e armazenamento mock em memória
- `apps/extension`: extensão Chrome MV3
- `apps/worker`: ponto de entrada dos jobs futuros
- `packages/calculations`: regras financeiras puras e testadas
- `packages/types`: contratos compartilhados
- `packages/amazon`: interfaces de providers e adapters mock
- `packages/db`: schema Prisma
- `docs`: decisões e especificações

Veja [ARCHITECTURE.md](docs/ARCHITECTURE.md), [PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md), [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) e [ROADMAP.md](docs/ROADMAP.md).
