# Relatório de conclusão — Fase 3

Data: 3 de setembro de 2026

## Escopo entregue

- ingestão de CSV, XLSX e PDF, cadastro manual e URL externa como referência;
- preservação do arquivo original em `CATALOG_STORAGE_DIR`, com nome, MIME type, tamanho e SHA-256;
- fila persistida em `CatalogImport` e worker separado para arquivos grandes ou pequenos;
- arquitetura `CatalogImport`, `PdfTextExtractor`, `PdfLayoutExtractor`, `ProductBlockDetector` e `CatalogNormalizer`;
- precedência PDF: texto nativo → layout → imagens → OCR fallback;
- normalização de SKU fornecedor, EAN/GTIN, nome, marca, modelo, variante, preço, unidades por caixa, pedido mínimo e investimento mínimo;
- confiança por campo, `overallConfidence` e threshold configurável;
- revisão humana com CONFIRMAR, EDITAR, IGNORAR e MESCLAR;
- cálculo de `minimumInvestment` e `capitalExposurePercentage` a partir do capital persistido do usuário, com alertas de exposição;
- versionamento imutável por fornecedor e comparação de produto novo/removido, aumento/queda de preço, mudança de caixa, volta/ruptura de estoque;
- histórico de preço do fornecedor ligado à versão do catálogo;
- pipeline pós-validação que cria ou vincula candidatos e gera uma shortlist sem dados Amazon fabricados.

## Decisões de segurança de dados

- Campos ausentes continuam `null`.
- GTIN malformado não é aceito como identificador confiável.
- PDFs sem evidência textual/layout utilizável não produzem produtos fictícios e ficam em revisão.
- O OCR local (Tesseract) só é acionado quando texto nativo e layout não produzem blocos; falhas não geram campos fictícios.
- A URL externa é apenas referência e não dispara coleta automática.
- Catálogos anteriores e seus preços não são sobrescritos.

## API

- `POST /catalogs/upload`
- `POST /catalogs/manual`
- `POST /catalogs/reference`
- `GET /catalogs` e `GET /catalogs/:id`
- `PATCH /catalog-products/:id/review`
- `GET /catalog-opportunities`
- `GET /supplier-products/:id/prices`
- `GET /alerts`

## Testes e validação

- normalização, investimento mínimo, ausência de campos e GTIN inválido;
- detecção de blocos tabulares com evidência de página;
- todos os sete tipos de alteração entre versões;
- suíte financeira e de pesquisa das fases anteriores mantida.

## Limites preservados

- SP-API não foi implementada.
- Nenhum dado real da Amazon é buscado automaticamente.
- A Fase 4 não foi iniciada.
