# Modelo de dados

O schema executável está em `packages/db/prisma/schema.prisma`. Valores monetários são `Int` em centavos; percentuais calculados não são a fonte primária.

## Núcleo

- `User` possui produtos, fornecedores, decisões e alertas.
- `Product` representa identidade canônica; `AmazonListing` representa ASIN/oferta.
- `SupplierProduct` relaciona fornecedor e produto, com SKU e condições.
- `PriceSnapshot`, `RankSnapshot` e `CompetitionSnapshot` são séries temporais imutáveis.
- `Opportunity` guarda fotografia do cálculo com versão/configuração.
- `DecisionLog` preserva contexto de compra e permite calibração posterior.

## Catálogo

- `Catalog` é versionado, nunca sobrescrito.
- `CatalogImport` registra progresso e erro do job.
- `CatalogProduct` preserva texto bruto, página, recorte e confiança por campo.
- `ProductMatch` exige estado explícito e método de correspondência.
- `SupplierProductPrice` cria histórico de custo por catálogo.

## Integridade

- Unicidade por usuário+ASIN e fornecedor+SKU quando disponível.
- Snapshots indexados por entidade+timestamp.
- Exclusão de catálogo não deve apagar arquivo/auditoria sem política de retenção.
- `null` representa ausência; valores extraídos nunca são inventados.

## Evolução SaaS

Adicionar `organizationId`, políticas de acesso por tenant e trilha de auditoria. Arquivos devem usar storage privado com URLs assinadas.
