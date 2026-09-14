# Modelo de dados

O schema executável está em `packages/db/prisma/schema.prisma`. Valores monetários são `Int` em centavos; percentuais calculados não são a fonte primária.

## Núcleo

- `User` possui produtos, fornecedores, decisões e alertas.
- `Product` representa identidade canônica; `AmazonListing` representa ASIN/oferta.
- `SupplierProduct` relaciona fornecedor e produto, com SKU e condições.
- `PriceSnapshot`, `RankSnapshot` e `CompetitionSnapshot` são séries temporais imutáveis.
- `Opportunity` guarda fotografia do cálculo com versão/configuração.
- `DecisionLog` preserva contexto de compra e permite calibração posterior.

## Pesquisa de produtos

- `Product` guarda origem da oportunidade, preço Amazon, demanda, vendedores, avaliação, volume de avaliações, disponibilidade de histórico, giro e observações.
- `brandApprovalStatus` e `amazonApprovalStatus` são enums independentes; notas, data de verificação, quantidade e documento exigidos preservam o contexto humano.
- Os cinco campos booleanos do checklist persistem a validação anterior à compra.
- `OpportunityStatus` cobre `CANDIDATE`, `RESEARCH`, `VALIDATION`, `TEST`, `READY_TO_BUY`, `APPROVED` e `DISCARDED`, preservando estados legados para compatibilidade.
- `UserSettings.maximumSellerCount` completa os critérios configuráveis; exposição máxima continua armazenada em basis points.

## Catálogo

- `Catalog` é versionado, nunca sobrescrito.
- `CatalogImport` registra progresso e erro do job.
- `CatalogProduct` preserva texto bruto, página, recorte e confiança por campo.
- `CatalogChange` registra diferenças entre versões sem alterar snapshots anteriores.
- `ProductMatch` exige estado explícito e método de correspondência.
- `SupplierProductPrice` cria histórico de custo por catálogo.
- `CatalogProduct.linkedProductId` e `opportunityQueuedAt` registram a passagem auditável para o pipeline após confirmação.

## Integridade

- Unicidade por usuário+ASIN e fornecedor+SKU quando disponível.
- Snapshots indexados por entidade+timestamp.
- Exclusão de catálogo não deve apagar arquivo/auditoria sem política de retenção.
- `null` representa ausência; valores extraídos nunca são inventados.

## Evolução SaaS

Adicionar `organizationId`, políticas de acesso por tenant e trilha de auditoria. Arquivos devem usar storage privado com URLs assinadas.
