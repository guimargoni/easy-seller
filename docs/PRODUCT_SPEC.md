# Especificação do produto

## Problema e princípio

Vendedores iniciantes precisam converter preço, custos, demanda e competição em uma decisão rápida. O Easy Seller otimiza retorno do capital ao longo do tempo com risco controlado — não apenas margem.

## Usuário inicial

Vendedor Amazon Brasil, capital aproximado de R$ 20 mil, operação ainda em validação e preferência por pequenos lotes. Perfil padrão: **Fast Cash**.

## Fase 1 entregue

- Visão geral com capital, retorno projetado, giro e shortlist.
- CRUD mock de produtos e fornecedores via API.
- Calculadora de lucro, margem, ROI, markup, equilíbrio e preço máximo de compra.
- Score explicável com componentes, pontos positivos e alertas.
- Recomendação `BUY_TEST`, `WATCH` ou `AVOID` e lote conservador.
- Extensão MV3 básica para páginas de produto, com overlay e ação de salvar.
- Modo simples/avançado no painel.

## Fase 2 entregue

- Registro dos dez candidatos do exercício da mentoria e acompanhamento do progresso `x/10`.
- Fluxo `CANDIDATO → PESQUISA → VALIDAÇÃO → TESTE → APROVADO/DESCARTADO`.
- Comparação ranqueada com motivo da colocação e recomendação `BUY_TEST`, `WATCH` ou `AVOID`.
- Análise distinta para `GENERIC_LISTING` e `BRANDED_RESELL`.
- Critérios configuráveis: margens mínima/ideal, ROI mínimo, giro máximo, vendedores máximos e exposição máxima.
- Autorização de marca e Amazon visíveis, com justificativas fora do número do score.
- Checklist humano obrigatório antes de `READY_TO_BUY`; nenhuma compra é automatizada.

## Regras iniciais

- Meta de margem líquida: 15%; ROI: 25%; vendas: 30/mês.
- Giro desejado: até 45 dias; excelente até 30.
- Concorrência preferencial: até 8 vendedores.
- Amazon como vendedora e queda recente de preço elevam risco.
- Resultados financeiros são projeções; vendas nunca são apresentadas como exatas quando inferidas.

## Jornadas prioritárias

1. Usuário abre dashboard e vê a melhor ação, não uma parede de métricas.
2. Digita preço/custo/despesas e descobre o teto de compra.
3. Avalia produto mockado, entende score e salva para análise.
4. Cadastra fornecedor e associa contexto de sourcing.
5. Na Amazon, abre o painel lateral da extensão e leva o ASIN ao sistema.

## Estados e linguagem

Verde = boa oportunidade, amarelo = atenção, vermelho = risco; todos incluem texto e ícone. Termos técnicos têm explicação. Usar “estimado”, “projetado” e “provável”, nunca “garantido”.

## Critérios de aceite

- Exemplo financeiro fecha em R$ 7,36 de lucro quando inclui R$ 0,65 em outras despesas.
- Margem usa lucro/preço; ROI usa lucro/capital investido.
- Score sempre retorna componentes, positivos e warnings.
- Produto novo recebe lote de teste limitado pela exposição de capital.
- API rejeita payload inválido e não depende de integração Amazon real.

## Fora da Fase 2

Ingestão automática de PDF, SP-API, compra automatizada, matching real, jobs BullMQ ativos, autenticação multiusuário, billing e modelos calibrados.

## Métricas de produto futuras

Tempo até decisão, proporção shortlist/revisados, acerto de giro, erro de lucro projetado, retorno de capital realizado por dia e capital parado.
