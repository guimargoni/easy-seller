# EASY SELLER — MASTER PRODUCT & ARCHITECTURE SPEC

> **Status:** Documento-mestre de produto, UX, arquitetura e regras de negócio  
> **Versão:** 1.0  
> **Data-base:** 14/09/2026  
> **Produto:** Easy Seller  
> **Escopo inicial:** Amazon Brasil  
> **Objetivo deste documento:** ser a principal fonte de verdade para desenvolvimento por Codex e demais agentes/engenheiros. Quando houver conflito entre uma implementação antiga e este documento, este documento deve ser tratado como a intenção de produto mais recente, salvo decisão registrada posteriormente em ADR/DECISIONS.

---

# 0. COMO USAR ESTE DOCUMENTO

Este arquivo existe para evitar que o Codex, outro agente ou um desenvolvedor precise "descobrir" o produto durante a implementação.

Antes de criar, alterar ou remover funcionalidade relevante, o implementador deve:

1. Ler este documento.
2. Identificar o módulo, fluxo e regra de negócio correspondente.
3. Verificar o schema e código existentes antes de criar estruturas paralelas.
4. Preservar compatibilidade com o que já funciona, quando isso não conflitar com esta especificação.
5. Não inventar regra de negócio não documentada quando ela afetar dinheiro, estoque, anúncios, faturamento, impostos, compras, recomendações ou cobrança.
6. Quando um ponto estiver explicitamente marcado como `TBD`, implementar a infraestrutura de forma extensível, mas não fixar comportamento irreversível.
7. Todo cálculo financeiro deve ser determinístico, testável e reproduzível.
8. IA nunca pode ser a fonte primária de um valor financeiro calculável deterministicamente.
9. Toda informação estimada deve ser rotulada como estimada.
10. Todo dado privado deve ser isolado por organização/tenant.

Este documento contém decisões de:
- visão de produto;
- posicionamento;
- paridade competitiva;
- planos comerciais;
- UX;
- navegação;
- telas;
- botões;
- estados;
- cálculos;
- importação;
- IA;
- fornecedores;
- compras;
- capital;
- estoque;
- Ads;
- Amazon;
- permissões;
- billing;
- banco;
- serviços;
- jobs;
- observabilidade;
- segurança;
- roadmap;
- testes;
- critérios de aceite.

---

# 1. VISÃO DO PRODUTO

## 1.1 Definição

**Easy Seller é o sistema operacional financeiro, comercial e decisório do vendedor de marketplace.**

Ele deve responder três perguntas progressivamente:

1. **O que aconteceu?**
2. **Por que aconteceu?**
3. **O que eu deveria fazer agora?**

A maior parte dos sistemas de seller concentra-se nos dois primeiros níveis. O diferencial estratégico do Easy Seller deve ser o terceiro.

## 1.2 Objetivo de migração

Regra de produto **ES-001**:

> Um vendedor que utiliza profissionalmente uma plataforma como Gestor Seller deve conseguir migrar sua rotina principal para o Easy Seller sem perder funcionalidades essenciais de gestão da Amazon.

Isso não significa copiar identidade visual, textos ou código de concorrentes. Significa preservar padrões mentais familiares:
- Dashboard;
- Vendas;
- Produtos;
- Estoque;
- Ads;
- Analítico;
- Financeiro;
- DRE;
- Reembolsos;
- integrações;
- multicontas;
- Amazon avançado/operações;
- equipe e usuários.

O Easy Seller deve parecer familiar para um seller experiente, porém mais orientado a decisão.

## 1.3 Diferenciação

O Easy Seller deve ir além da paridade principalmente em:

- Capital Map;
- alocação inteligente de capital;
- simulador de compra;
- recomendação de reposição;
- custo real por lote;
- comparação entre fornecedores;
- histórico de preço de fornecedor;
- importação inteligente de catálogos;
- Procurement / Compras;
- oportunidades de compra;
- alertas priorizados;
- explicação de causa de variações;
- Easy AI consultando dados estruturados da empresa;
- distinção clara entre observado, calculado, inferido e estimado.

## 1.4 Princípios

### ES-002 — ação além da métrica

Sempre que o Easy Seller apresentar uma métrica importante, deve tentar responder:
- isso está bom, neutro ou ruim?
- por quê?
- existe uma ação recomendada?

### ES-003 — simples por padrão

Nenhuma funcionalidade avançada deve exigir configuração inicial quando um padrão seguro e explicável puder ser usado.

### ES-004 — configurável para avançados

Todo parâmetro de decisão importante deve poder ser sobrescrito por usuários autorizados.

### ES-005 — determinismo financeiro

IA não calcula margem, lucro, ROI, DRE, estoque disponível ou capital contábil quando esses valores puderem ser derivados deterministicamente.

### ES-006 — explicabilidade

Recomendação sem motivo é incompleta. Scores e sugestões devem exibir fatores positivos, negativos, confiança e dados utilizados.

### ES-007 — fonte e confiança

Dados externos e importados devem preservar origem e classificação:
- REAL / OBSERVED;
- CALCULATED;
- ESTIMATED;
- INFERRED;
- USER_ENTERED.

### ES-008 — isolamento

Dados comerciais privados de uma empresa nunca podem compor a base privada de outra empresa.

---

# 2. BENCHMARK DE PARIDADE

Pesquisa de referência realizada em setembro/2026 indica como funcionalidades publicamente divulgadas pelo Gestor Seller:

- Dashboard com desempenho e lucro;
- vendas detalhadas;
- lucro em tempo real;
- produtos mais vendidos;
- Curva ABC;
- Ads;
- analítico;
- gerenciamento de produtos;
- inventário FBA/Full;
- reembolso por produto;
- DRE / resumo financeiro;
- multicontas;
- Amazon Avançado;
- gestão de envios DBA/EasyShip;
- fiscal / notas fiscais;
- criação/listagem de produtos Amazon;
- inventário e conversão DBA → FBA;
- precificação automática;
- app/mobile;
- suporte interno.

Referências públicas:
- https://gestorseller.com.br/funcionalidades/
- https://gestorseller.com.br/map-2026/
- https://gestorseller.com.br/inventario/
- https://gestorseller.com.br/publish-amazon/
- https://gestorseller.com.br/integracao-ads/

## 2.1 Regra de paridade

O roadmap do Easy Seller deve considerar:
- **Parity Core:** funcionalidades mínimas para um usuário não sentir regressão operacional.
- **Easy Advantage:** funcionalidades diferenciais.
- **Future Expansion:** recursos que exigem maturidade, aprovação externa ou alto risco operacional.

Nenhum recurso de concorrente deve ser copiado cegamente. A implementação deve obedecer à arquitetura Easy Seller.

---

# 3. PÚBLICOS E PERSONAS

## 3.1 Iniciante

Características:
- ainda não domina ACOS/TACOS/ROI/CMV;
- possui pouco histórico;
- precisa de orientação;
- não sabe configurar estoque de segurança;
- não sabe interpretar todos os relatórios.

UX:
- modo simples;
- explicações;
- Smart Defaults;
- recomendações conservadoras;
- alertas acionáveis;
- menos campos obrigatórios.

## 3.2 Seller em crescimento

Características:
- já compra estoque regularmente;
- múltiplos SKUs;
- utiliza Ads;
- precisa controlar caixa;
- possui mais de um fornecedor;
- quer reposição e análise.

UX:
- visão consolidada;
- automações;
- compras;
- fornecedores;
- capital;
- margem pós-Ads;
- relatórios.

## 3.3 Seller profissional

Características:
- alto volume;
- equipe;
- multicontas;
- FBA/DBA/Self Ship;
- várias integrações;
- necessidade de permissões;
- processos financeiros e fiscais mais rigorosos.

UX:
- filtros avançados;
- exportações;
- RBAC;
- auditoria;
- multiempresa;
- API/webhooks futuros;
- jobs robustos;
- operação em lote.

## 3.4 Agência / gestor multiempresa — futuro

Gerencia operações de terceiros.
Arquitetura deve suportar sem ser foco inicial.

---

# 4. ESTRATÉGIA DE PLANOS

## 4.1 Benchmark comercial

Em setembro/2026, páginas públicas do Gestor Seller exibiam planos mensais aproximadamente nas faixas:
- Start: R$ 97;
- Pro: R$ 197;
- Advanced: R$ 397;
- Business: R$ 697;
com limites de vendas, integrações e usuários; faixas Enterprise acima disso.

O Easy Seller deve usar isso somente como benchmark de mercado, não como tabela copiada.

## 4.2 Estrutura proposta

Os preços abaixo são **SUGESTÃO DE LANÇAMENTO / TBD COMERCIAL**. A aplicação não deve hardcodar preços; preços e limites vêm do sistema de billing/configuração.

### START
Público: seller iniciante.

Sugestão:
- até 300 pedidos/mês;
- 1 organização;
- 1 integração Amazon;
- 1 usuário;
- Dashboard;
- Vendas;
- Pedidos;
- Produtos;
- custos;
- lucro/margem;
- Curva ABC básica;
- inventário básico;
- financeiro resumido;
- alertas básicos;
- importação manual CSV simples;
- sem Procurement IA.

Faixa sugerida inicial: **R$ 79–99/mês**.

### PRO
Público: seller em crescimento.

Sugestão:
- até 1.500 pedidos/mês;
- até 3 integrações;
- até 3 usuários;
- tudo do Start;
- Ads;
- DRE;
- reembolsos;
- relatórios avançados;
- estoque inteligente;
- reposição;
- fluxo de caixa;
- histórico;
- Capital Map;
- simulador de compra;
- alertas avançados.

Faixa sugerida: **R$ 169–199/mês**.

### ADVANCED
Público: operação profissional.

Sugestão:
- até 5.000 pedidos/mês;
- até 5 integrações;
- usuários ampliados/ilimitados conforme política;
- tudo do Pro;
- alocador de capital;
- automações;
- multicontas;
- Amazon Avançado progressivo;
- operações em lote;
- maior retenção de histórico;
- Easy AI com cota;
- Procurement básico incluído ou com créditos.

Faixa sugerida: **R$ 329–399/mês**.

### BUSINESS
Público: operação de alto volume.

Sugestão:
- até 10.000 pedidos/mês;
- até 10 integrações;
- usuários ilimitados;
- tudo do Advanced;
- permissões avançadas;
- auditoria ampliada;
- maior volume de IA;
- prioridade de processamento;
- relatórios e exportações avançadas;
- recursos operacionais avançados;
- suporte prioritário.

Faixa sugerida: **R$ 599–699/mês**.

### ENTERPRISE
- limites customizados;
- SLA;
- usuários e integrações customizados;
- onboarding assistido;
- API/exportações;
- políticas especiais;
- faturamento negociado.

## 4.3 Add-on: PROCUREMENT AI

O módulo Compras/Procurement deve poder existir como add-on em planos inferiores e ser parcial/totalmente incluído nos superiores.

Cobrança deve considerar uso de importação:
- páginas processadas;
- documentos processados;
- créditos de processamento;
- ou combinação dos três.

**Não vender "tokens de IA" ao usuário.**
O usuário compra capacidade de processamento de catálogo.

Exemplo:
- Procurement 1K: 1.000 páginas/mês;
- Procurement 5K;
- Procurement 20K;
- excedente opcional.

## 4.4 Feature gating

Nunca esconder dado histórico do usuário ao fazer downgrade.
Ao perder recurso:
- leitura histórica permanece quando seguro;
- novas execuções ficam bloqueadas;
- CTA explica upgrade;
- não apagar registros.

Feature flags por plano devem ser server-side.

---

# 5. ONBOARDING

## 5.1 Objetivo

Levar novo usuário a uma dashboard útil com o menor atrito possível.

## 5.2 Fluxo

### Tela 1 — Criar conta
Campos mínimos:
- nome;
- e-mail;
- senha/social login futuro.

### Tela 2 — Criar empresa
Campos:
- nome da empresa;
- nome fantasia opcional;
- CNPJ opcional inicialmente;
- regime tributário opcional / "não sei";
- moeda BRL;
- timezone America/Sao_Paulo por padrão Brasil.

### Tela 3 — Conectar Amazon
CTA:
`Conectar Amazon`

Estados:
- não conectado;
- autorização iniciada;
- sincronizando;
- conectado;
- erro;
- autorização expirada.

### Tela 4 — Objetivo
Opções:
- estou começando;
- crescer faturamento;
- maximizar lucro;
- girar capital rapidamente;
- equilibrar crescimento e risco.

### Tela 5 — Capital
Perguntas:
- capital operacional disponível;
- inclui estoque atual? Sim / Não / Não sei;
- reserva mínima desejada opcional.

### Tela 6 — Smart Profile
Perfis:
- Conservador;
- Equilibrado (default);
- Crescimento;
- Giro rápido;
- Personalizado.

### Tela 7 — Sincronização
Checklist visual:
- conta;
- produtos;
- pedidos;
- estoque;
- taxas;
- Ads quando autorizado.

### Tela 8 — Primeira recomendação
Mostrar:
- resumo;
- pendências de custo;
- produtos sem custo cadastrado;
- próxima melhor ação.

---

# 6. NAVEGAÇÃO PRINCIPAL

Menu desktop recomendado:

```text
🏠 Início

💰 Vendas
📦 Pedidos
🏷 Produtos

📊 Analítico
   ├─ Visão geral
   ├─ Produtos
   ├─ Curva ABC
   ├─ Margens
   ├─ Reembolsos
   └─ Rentabilidade

📦 Estoque
   ├─ Visão geral
   ├─ Reposição
   ├─ Em trânsito
   └─ Estoque parado

📢 Ads

💳 Financeiro
   ├─ Visão geral
   ├─ DRE
   ├─ Fluxo de caixa
   ├─ Recebíveis
   └─ Despesas

💰 Capital
   ├─ Capital Map
   ├─ Reinvestimento
   ├─ Simulador
   └─ Planejamento

🛒 Compras
   ├─ Buscar produtos
   ├─ Fornecedores
   ├─ Catálogos
   ├─ Comparador
   ├─ Oportunidades
   ├─ Carrinhos
   ├─ Pedidos de compra
   └─ Histórico

🚚 Operação
   ├─ Envios
   ├─ FBA
   ├─ DBA / EasyShip
   ├─ Listagens
   └─ Fiscal / Notas

🔔 Alertas

✨ Easy AI

⚙ Configurações
```

Em planos sem um módulo:
- mostrar item com cadeado apenas quando comercialmente útil;
- evitar menu poluído com dezenas de recursos inacessíveis;
- botão informa claramente o plano necessário.

Mobile:
- navegação reduzida;
- foco em Início, Vendas, Estoque, Alertas e Mais.

---

# 7. INÍCIO / COMMAND CENTER

## 7.1 Objetivo

A Home não é apenas um dashboard. É a central de comando.

## 7.2 Header

Contém:
- seletor de empresa;
- seletor de conta Amazon;
- período;
- indicador de sincronização;
- notificações;
- avatar.

Períodos:
- hoje;
- ontem;
- 7 dias;
- 30 dias;
- mês atual;
- mês anterior;
- personalizado.

## 7.3 KPI cards

Primeira linha:
- faturamento;
- lucro líquido;
- margem líquida;
- pedidos;
- unidades;
- Ads;
- ACOS;
- TACOS;
- ROI quando aplicável.

Cada card:
- valor;
- variação contra período comparável;
- tooltip;
- origem;
- timestamp de atualização.

## 7.4 "Precisa da sua atenção"

Prioridade:
1. risco financeiro;
2. ruptura;
3. margem crítica;
4. Ads desperdiçado;
5. problema fiscal/operacional;
6. capital parado;
7. oportunidade.

Card de alerta:
- severidade;
- entidade;
- descrição curta;
- impacto;
- CTA.

Exemplo:
`Produto X ficará sem estoque em ~4 dias. [Ver reposição]`

## 7.5 "Oportunidades"

Exemplos:
- produto com aceleração de demanda;
- reposição com alto retorno;
- fornecedor mais barato detectado;
- custo abaixo da média;
- Ads com espaço de escala;
- capital disponível não alocado.

## 7.6 Gráficos

- faturamento;
- lucro;
- margem;
- pedidos;
- Ads;
- capital.

Nunca usar gráfico sem unidade, legenda e período.

## 7.7 Top produtos

Alternar:
- faturamento;
- lucro;
- unidades;
- ROI;
- contribuição.

---

# 8. VENDAS

## 8.1 Lista

Colunas configuráveis:
- data;
- pedido;
- marketplace;
- conta;
- produto;
- SKU;
- ASIN;
- quantidade;
- preço unitário;
- receita;
- líquido marketplace;
- comissão;
- logística;
- imposto;
- Ads atribuído;
- custo;
- lucro;
- margem;
- status.

Filtros:
- período;
- conta;
- SKU;
- ASIN;
- produto;
- fulfillment;
- lucrativa/prejuízo;
- faixa de margem;
- status.

Ações:
- abrir venda;
- exportar;
- copiar ID;
- abrir pedido.

## 8.2 Detalhe da venda

Bloco financeiro:

```text
Receita bruta                  + R$ X
Descontos/promos               - R$ X
Comissão marketplace           - R$ X
Taxas logísticas               - R$ X
Impostos                       - R$ X
Ads atribuídos                 - R$ X
CMV                            - R$ X
Outros custos                  - R$ X
-------------------------------------
Lucro líquido                    R$ X
Margem                           X%
```

Deve exibir:
- origem de cada componente;
- custo utilizado e lote/método;
- dados ainda pendentes;
- estimativas claramente marcadas.

---

# 9. PEDIDOS

## 9.1 Objetivo

Camada operacional, separada da análise de venda.

Lista:
- order ID;
- status;
- data;
- itens;
- fulfillment;
- valor;
- status fiscal;
- status envio;
- tracking;
- ações.

Ações futuras por disponibilidade de API:
- gerar/baixar etiqueta;
- agendar coleta;
- anexar XML;
- baixar DANFE/NFe;
- atualizar status;
- abrir Seller Central quando operação não puder ser feita pelo Easy Seller.

Toda ação externa deve:
- solicitar confirmação quando irreversível;
- registrar AuditLog;
- idempotência.

---

# 10. PRODUTOS

## 10.1 Conceito

`Product` = identidade interna canônica.
`MarketplaceListing` = anúncio/oferta em marketplace.
`SupplierOffer` = condição de compra em fornecedor.

Nunca misturar os três conceitos.

## 10.2 Lista

Campos:
- imagem;
- nome;
- SKU;
- ASIN;
- preço atual;
- custo atual;
- margem;
- estoque;
- cobertura;
- vendas 30d;
- lucro 30d;
- Ads;
- status;
- alertas.

Busca:
- nome;
- SKU;
- ASIN;
- EAN/GTIN;
- marca.

## 10.3 Detalhe do produto

Abas:
1. Visão geral
2. Vendas
3. Custos
4. Estoque
5. Ads
6. Fornecedores
7. Histórico
8. Alertas
9. Configurações

Visão geral:
- KPIs;
- preço;
- custo;
- margem;
- lucro;
- ROI;
- venda diária;
- estoque;
- cobertura;
- reembolso;
- Ads;
- tendência.

## 10.4 Custos por lote

Lotes:
- fornecedor;
- data;
- quantidade;
- custo unitário;
- frete rateado;
- imposto de entrada;
- preparação;
- outros custos;
- custo landed;
- saldo do lote.

Métodos configuráveis:
- custo médio ponderado — padrão;
- FIFO futuro;
- custo manual.

Alteração retroativa de custo deve gerar audit trail.

---

# 11. ANALÍTICO

## 11.1 Visão geral

Análise por:
- produto;
- marca;
- categoria;
- conta;
- fulfillment;
- período.

## 11.2 Curva ABC

Modos:
- por faturamento;
- por lucro;
- por unidades;
- por capital investido;
- por contribuição.

Default tradicional:
- A ≈ 80%;
- B ≈ 15%;
- C ≈ 5%;
- Z = sem faturamento / somente despesas.

Limites devem ser configuráveis.

## 11.3 Margens

Distribuição:
- negativa;
- abaixo do mínimo;
- aceitável;
- alvo;
- acima do alvo.

## 11.4 Reembolsos

Por SKU:
- vendas;
- devoluções;
- taxa;
- valor reembolsado;
- impacto de lucro;
- margem antes/depois.

## 11.5 Rentabilidade

Permitir comparar:
- lucro absoluto;
- margem;
- ROI;
- retorno por dia de capital;
- giro;
- contribuição total.

---

# 12. ESTOQUE

## 12.1 Visão geral

Por produto:
- disponível;
- reservado;
- FBA;
- DBA;
- próprio;
- em trânsito;
- inbound;
- total;
- custo;
- valor potencial de venda;
- cobertura.

## 12.2 Velocidade

Métricas:
- média 7d;
- 30d;
- 60d;
- ponderada;
- sazonalidade futura.

Configuração:
`velocityWindow`.

## 12.3 Cobertura

`daysOfCover = availableInventory / avgDailySales`

Tratar divisão por zero.

## 12.4 Reorder Point

Base inicial:
`ROP = demanda durante lead time + safety stock`

Componentes:
- lead time fornecedor;
- preparação;
- trânsito;
- inbound Amazon;
- safety stock.

## 12.5 Reposição

Status:
- urgente;
- comprar agora;
- planejar;
- saudável;
- excesso.

Quantidade recomendada deve considerar:
- cobertura alvo;
- MOQ;
- caixa;
- concentração;
- demanda;
- estoque em trânsito.

## 12.6 Estoque parado

Faixas configuráveis:
- 30;
- 60;
- 90;
- 180 dias sem giro.

Mostrar:
- capital imobilizado;
- última venda;
- custo;
- quantidade;
- sugestão.

---

# 13. ADS

## 13.1 Integração

Amazon Ads é integração separada do SP-API e pode depender de aprovação externa.

Referência:
https://advertising.amazon.com/pt-br/about-api

## 13.2 KPIs

- spend;
- attributed sales;
- clicks;
- impressions;
- CPC;
- CTR;
- CVR;
- ACOS;
- TACOS;
- ROAS;
- lucro pós-Ads.

Fórmulas:
- `ACOS = adSpend / attributedAdSales`
- `ROAS = attributedAdSales / adSpend`
- `TACOS = adSpend / totalSales`

## 13.3 Níveis

- conta;
- campanha;
- grupo;
- anúncio;
- produto;
- keyword/search term quando disponível.

## 13.4 Ads Advisor

Primeira fase somente recomendações:
- gasto sem venda;
- ACOS acima do break-even;
- campanha escalável;
- keyword ineficiente;
- orçamento limitado.

Fase posterior:
`[Aplicar recomendação]`

Automação total somente após:
- logs;
- rollback quando possível;
- limites;
- confirmação;
- período de aprendizado;
- feature flag.

---

# 14. FINANCEIRO

## 14.1 Visão geral

Cards:
- faturamento;
- receita líquida;
- CMV;
- lucro bruto;
- Ads;
- despesas;
- lucro operacional;
- margem;
- impostos.

## 14.2 DRE

Estrutura:

```text
Receita Bruta
(-) descontos
(-) devoluções
(-) comissões
(-) taxas marketplace
(-) logística
(-) impostos sobre venda
= Receita Líquida

(-) CMV
= Lucro Bruto

(-) Ads
(-) despesas operacionais
(-) software
(-) contabilidade
(-) equipe
(-) embalagem
(-) outras despesas
= Lucro Operacional
```

Permitir:
- período;
- conta;
- SKU;
- categoria;
- centro de custo futuro.

## 14.3 Fluxo de caixa

Separado de DRE.

Categorias:
- saldo;
- recebíveis Amazon;
- contas a pagar;
- fornecedores;
- impostos;
- Ads;
- despesas;
- compras em trânsito;
- projeção.

## 14.4 Recebíveis

Quando possível:
- valores;
- data estimada;
- origem;
- status;
- conciliação.

## 14.5 Despesas

Tipos:
- fixa;
- variável;
- recorrente;
- pontual.

Rateio:
- não rateado;
- por receita;
- por unidades;
- customizado.

---

# 15. CAPITAL INTELLIGENCE

## 15.1 Definição

Capital não é apenas um campo de configuração. É um sub-sistema.

Estados:
- disponível;
- estoque;
- em trânsito;
- comprometido;
- recebível;
- reserva;
- bloqueado;
- outros.

## 15.2 Capital Map

Exemplo:

```text
Capital total             R$ 20.000
Disponível                R$  6.840
Estoque                   R$  9.320
Em trânsito               R$  2.100
A receber                 R$  1.740
Reserva                   R$      0
```

Não somar estados incompatíveis de forma a duplicar capital.

## 15.3 Concentração

Por:
- SKU;
- marca;
- categoria;
- fornecedor.

Alertar quando limite configurado exceder.

## 15.4 Perfis

### Conservador
- maior reserva;
- menor concentração;
- maior exigência de margem;
- lotes menores.

### Equilibrado
Default.

### Crescimento
- maior reinvestimento;
- cobertura maior em vencedores;
- tolerância moderada.

### Giro rápido
- prioridade em retorno por dia;
- lotes menores;
- penaliza capital parado.

## 15.5 Alocador

Entrada:
- capital disponível;
- reserva;
- produtos elegíveis;
- MOQ;
- estoque;
- demanda;
- margem;
- ROI;
- risco;
- lead time;
- concentração.

Saída:
- lista sugerida;
- quantidade;
- capital;
- motivo;
- risco;
- caixa restante.

Primeira versão pode usar heurística determinística, não otimização matemática complexa.

---

# 16. SIMULADOR DE COMPRA

Entrada:
- produto;
- fornecedor;
- custo;
- quantidade;
- frete;
- imposto;
- preparação;
- preço de venda;
- taxas;
- Ads esperado;
- prazo/giro.

Saída:
- capital necessário;
- landed cost;
- receita estimada;
- lucro;
- margem;
- ROI;
- break-even;
- prazo de retorno;
- estoque em dias.

Cenários:
- pessimista;
- base;
- otimista.

Variáveis de cenário:
- preço;
- demanda;
- Ads;
- custo;
- devolução.

---

# 17. COMPRAS / PROCUREMENT

## 17.1 Objetivo

Criar um marketplace privado do próprio vendedor, alimentado pelos seus fornecedores e catálogos.

## 17.2 Regra central

**ES-BUY-001**

> IA é usada na ingestão/interpretação/normalização/reconciliação de catálogo. A busca comum de produtos não chama IA.

## 17.3 Isolamento

**ES-BUY-002**
Produtos e ofertas de fornecedor são privados ao tenant.

No futuro pode existir uma base global apenas de identidade canônica:
- GTIN/EAN;
- marca;
- nome;
- atributos;
- possíveis ASINs.

Nunca compartilhar:
- preço privado;
- contato;
- catálogo privado;
- histórico de compra;
- condição comercial.

## 17.4 Modelo conceitual

### Product
Identidade canônica.

### Supplier
Fornecedor/revendedor/distribuidor.

### SupplierOffer
A oferta específica do fornecedor.

### Catalog
Documento/versionamento.

### CatalogItem
Extração original.

### CommercialCondition
MOQ, tiers, combos, regras.

### PurchaseCart
Carrinho por fornecedor.

### PurchaseOrder
Pedido de compra.

### SupplierPriceSnapshot
Histórico.

---

# 18. FORNECEDORES

## 18.1 Cadastro simples

Campos mínimos:
- nome;
- WhatsApp/telefone opcional;
- e-mail opcional.

Avançados:
- CNPJ;
- site;
- prazo médio;
- pedido mínimo em valor;
- frete;
- condições de pagamento;
- contato;
- observações;
- ativo/inativo.

UX:
não exigir CNPJ para começar.

## 18.2 Tela de fornecedor

Header:
- nome;
- contatos;
- status;
- último catálogo;
- último pedido.

Tabs:
- visão geral;
- produtos;
- catálogos;
- pedidos;
- histórico de preços;
- configurações.

Botões:
- Importar catálogo;
- Novo pedido;
- Abrir WhatsApp;
- Editar.

---

# 19. CATÁLOGOS

## 19.1 Formatos

- PDF;
- XLSX;
- CSV;
- imagem;
- formatos adicionais via adapter.

## 19.2 Versionamento

Nunca sobrescrever catálogo anterior.

Dados:
- fornecedor;
- nome;
- período;
- data de upload;
- hash;
- páginas;
- status;
- origem;
- import version.

## 19.3 Status

- UPLOADED
- PREPROCESSING
- EXTRACTING
- AI_INTERPRETING
- VALIDATING
- NEEDS_REVIEW
- IMPORTING
- COMPLETED
- PARTIAL
- FAILED

## 19.4 Pipeline

```text
Upload
 ↓
Segurança / MIME / hash
 ↓
Extração determinística
 ↓
Texto / tabelas / imagens / layout
 ↓
Reconhecimento de template conhecido
 ↓
IA somente onde necessário
 ↓
JSON normalizado
 ↓
Validadores
 ↓
Deduplicação / matching
 ↓
Revisão humana quando necessário
 ↓
Persistência
 ↓
Indexação de busca local
```

## 19.5 Estratégia de custo

Prioridade:
1. parser conhecido;
2. extração convencional;
3. regras;
4. IA para ambiguidade;
5. OCR apenas quando necessário.

Não reprocessar catálogo sem necessidade.
Persistir resultado estruturado.

---

# 20. CONTRATO DE EXTRAÇÃO DE CATÁLOGO

Exemplo conceitual:

```json
{
  "source": {
    "catalogId": "...",
    "page": 14
  },
  "product": {
    "rawName": "Creme X 400ML",
    "normalizedName": "Creme X 400 ml",
    "brand": "Marca",
    "supplierSku": "94815",
    "gtin": null
  },
  "offer": {
    "listPriceCents": 5999,
    "priceCents": 3233,
    "currency": "BRL",
    "minimumQuantity": 3,
    "validUntil": null
  },
  "confidence": {
    "name": 0.99,
    "price": 0.98,
    "minimumQuantity": 0.94
  }
}
```

Nunca inventar campo ausente.
Ausência = `null`.

## 20.1 Imagens

Quando catálogo contém imagem:
- extrair se tecnicamente permitido;
- associar ao `CatalogItem`;
- registrar página/origem;
- gerar thumbnail;
- não gerar imagem por IA.

---

# 21. REVISÃO DA IMPORTAÇÃO

Resumo:
- total detectados;
- alta confiança;
- revisão;
- erros;
- duplicados possíveis.

Lista:
- imagem;
- nome;
- código;
- preço;
- MOQ;
- confiança;
- match.

Ações:
- aprovar;
- editar;
- vincular produto existente;
- criar novo;
- ignorar;
- aprovar lote de alta confiança.

Limiar de auto-aprovação configurado server-side por versão de extractor.

---

# 22. DEDUPLICAÇÃO

Hierarquia:

1. GTIN/EAN exato.
2. fornecedor + SKU.
3. marca + modelo + atributos.
4. similaridade textual.
5. similaridade de imagem, se futuramente necessário.
6. revisão humana.

Estados:
- CONFIRMED;
- PROBABLE;
- REVIEW;
- REJECTED.

IA pode sugerir; regras e revisão confirmam.

---

# 23. BUSCA DE PRODUTOS DE FORNECEDOR

## 23.1 Sem IA por consulta

Busca em índice/banco do tenant.

Tecnologia sugerida inicial:
- PostgreSQL full-text + trigram;
- evoluir para Meilisearch/OpenSearch apenas se necessário.

## 23.2 Layout estilo marketplace

Cada card:
- imagem;
- nome;
- marca;
- supplier SKU;
- fornecedor;
- preço;
- MOQ;
- data de atualização;
- CTA.

## 23.3 Busca

Campos:
- nome;
- marca;
- EAN;
- SKU;
- código fornecedor;
- atributos.

## 23.4 Filtros

- fornecedor;
- marca;
- preço;
- MOQ;
- atualizado recentemente;
- promoção;
- tem imagem;
- tem EAN;
- elegível Amazon;
- margem mínima futura.

## 23.5 Ordenação

- relevância;
- menor preço;
- maior margem;
- menor MOQ;
- mais recente;
- fornecedor;
- melhor oportunidade.

---

# 24. COMPARADOR DE FORNECEDORES

Um Product pode ter N SupplierOffers.

Tela:
- produto;
- preço Amazon quando disponível;
- fornecedores;
- preço;
- MOQ;
- prazo;
- frete;
- custo efetivo;
- histórico.

A recomendação "melhor oferta" não deve considerar somente menor preço.

Score de compra pode considerar:
- capital exigido;
- MOQ;
- lead time;
- frete;
- confiabilidade;
- giro;
- custo unitário;
- risco de excesso.

---

# 25. WHATSAPP / PEDIDO RÁPIDO

## 25.1 Pré-condição

Supplier possui WhatsApp válido.

## 25.2 CTA

`Pedir`
ou
`Consultar estoque`

## 25.3 Modal

- produto;
- fornecedor;
- preço catálogo;
- quantidade;
- total estimado;
- mensagem preview.

Botão:
`Abrir WhatsApp`

## 25.4 Template

Default:

```text
{saudacao}! Tudo bem?
Gostaria de verificar a disponibilidade de {quantidade} unidade(s) de {produto}, código {codigo}.
Conseguem confirmar estoque e valor atual?
```

`{saudacao}` calculada deterministicamente:
- manhã → Bom dia;
- tarde → Boa tarde;
- noite → Boa noite.

Configurações permitem editar template.

Variáveis:
- `{produto}`
- `{codigo}`
- `{ean}`
- `{quantidade}`
- `{preco_catalogo}`
- `{fornecedor}`
- `{saudacao}`

Não usar IA para cada mensagem.

## 25.5 Auditoria leve

Ao abrir WhatsApp:
- registrar `CONTACT_INITIATED`;
- não afirmar que mensagem foi enviada;
- usuário pode atualizar status.

---

# 26. CARRINHO DE COMPRA

Carrinho é por fornecedor.

Campos:
- produto;
- quantidade;
- MOQ;
- preço;
- total;
- alerta de condição.

Ações:
- editar quantidade;
- remover;
- salvar;
- gerar mensagem;
- converter em PurchaseOrder.

Validação:
- MOQ;
- tier de preço;
- pedido mínimo global do fornecedor.

---

# 27. PEDIDO DE COMPRA

Estados:
- DRAFT;
- QUOTE_REQUESTED;
- QUOTED;
- CONFIRMED;
- PAID;
- IN_TRANSIT;
- PARTIALLY_RECEIVED;
- RECEIVED;
- CANCELLED.

Dados:
- fornecedor;
- itens;
- preço combinado;
- frete;
- descontos;
- total;
- data;
- pagamento;
- previsão;
- notas.

Ao confirmar:
- capital → comprometido/em trânsito conforme regra.

Ao receber:
- gerar lote de estoque;
- custo landed;
- baixar em trânsito;
- atualizar estoque;
- salvar preço real.

---

# 28. HISTÓRICO DE PREÇOS DE FORNECEDOR

Cada importação gera `SupplierPriceSnapshot`.

Mostrar:
- atual;
- média 30/90 dias;
- mínimo;
- máximo;
- gráfico;
- variação.

Alertas:
- queda relevante;
- aumento;
- promoção abaixo de média;
- catálogo chama promoção mas preço não é excepcional — apresentar somente se dados suficientes.

---

# 29. OPORTUNIDADES

## 29.1 Opportunity Score

Score explicável, versionado.

Componentes possíveis:
- demanda;
- margem;
- ROI;
- giro;
- estabilidade de preço;
- competição;
- presença Amazon;
- devolução;
- capital necessário;
- concentração;
- MOQ;
- fornecedor;
- risco.

## 29.2 Saída

- score 0–100;
- recomendação;
- confiança;
- positivos;
- riscos;
- dados ausentes.

Recomendações:
- BUY_TEST;
- BUY;
- REPLENISH;
- WATCH;
- AVOID.

Nunca apresentar garantia.

---

# 30. PREÇO E PRECIFICAÇÃO

## 30.1 Preço mínimo

Calcular preço mínimo que mantém:
- break-even;
- margem mínima;
- margem alvo.

## 30.2 Histórico

- atual;
- média;
- mínimo;
- máximo;
- estabilidade.

## 30.3 Repricer futuro

Somente quando integração suportar e após controles:

Config:
- min price;
- max price;
- target;
- Buy Box strategy;
- margem mínima absoluta;
- cooldown;
- limite diário.

Nunca permitir preço abaixo do piso configurado.

---

# 31. ALERT ENGINE

## 31.1 Tipos

FINANCE:
- margem baixa;
- prejuízo;
- gasto inesperado.

STOCK:
- ruptura;
- excesso;
- parado.

ADS:
- ACOS alto;
- gasto sem venda.

SUPPLIER:
- custo subiu;
- oferta expirando.

CAPITAL:
- concentração;
- caixa abaixo da reserva;
- capital ocioso.

OPERATION:
- fiscal pendente;
- integração quebrada;
- sync atrasado.

OPPORTUNITY:
- reposição;
- custo caiu;
- demanda acelerou.

## 31.2 Severidade

- INFO;
- OPPORTUNITY;
- WARNING;
- CRITICAL.

## 31.3 Deduplicação

Não criar alertas idênticos a cada sync.
Usar fingerprint + estado.

## 31.4 Ações

- abrir entidade;
- resolver;
- silenciar;
- snooze;
- configurar regra.

---

# 32. EASY AI

## 32.1 Papel

Easy AI explica e navega dados.
Não substitui cálculo.

Perguntas:
- "Por que meu lucro caiu?"
- "Quais produtos estão com margem ruim?"
- "Tenho R$ 5 mil; quais reposições devo avaliar?"
- "Qual fornecedor está mais barato?"
- "O que mudou esta semana?"

## 32.2 Arquitetura

```text
Pergunta
  ↓
Intent
  ↓
Ferramentas internas autorizadas
  ↓
Queries estruturadas
  ↓
Cálculos determinísticos
  ↓
LLM sintetiza
  ↓
Resposta com evidências
```

## 32.3 Guardrails

- isolamento tenant;
- tool allowlist;
- sem SQL livre do modelo em produção;
- mascarar segredos;
- limitar intervalo/volume;
- citar dados internos na UI;
- avisar quando dado insuficiente.

---

# 33. CONFIGURAÇÕES

## 33.1 Organização
- nome;
- CNPJ;
- timezone;
- moeda;
- regime;
- fiscal.

## 33.2 Estratégia
- perfil;
- margem mínima;
- margem alvo;
- ROI mínimo;
- giro desejado;
- risco;
- reserva de caixa;
- concentração.

Cada configuração:
- Automático;
- Recomendado;
- Personalizado
quando aplicável.

## 33.3 Estoque
- safety stock;
- cobertura alvo;
- velocity window;
- lead time defaults.

## 33.4 Ads
- ACOS alvo;
- TACOS alvo;
- orçamento;
- break-even.

## 33.5 Compras
- mensagem WhatsApp;
- default MOQ behavior;
- aprovação de importação;
- unidades/moeda.

## 33.6 Usuários
- membros;
- funções;
- permissões.

## 33.7 Integrações
- Amazon Seller;
- Amazon Ads;
- storage/import;
- futuro marketplaces.

## 33.8 Billing
- plano;
- consumo;
- invoices;
- upgrade;
- downgrade;
- cancelamento.

---

# 34. RBAC / PERMISSÕES

Papéis iniciais:
- OWNER;
- ADMIN;
- FINANCE;
- OPERATIONS;
- ADS_MANAGER;
- ANALYST;
- VIEWER.

Permissões granulares:
- view_revenue;
- view_profit;
- manage_costs;
- manage_products;
- manage_orders;
- manage_ads;
- manage_suppliers;
- manage_purchases;
- manage_finance;
- manage_users;
- manage_integrations;
- manage_billing.

Regra:
Owner nunca pode ser removido sem transferência.

---

# 35. MULTI-TENANCY

Entidade raiz: `Organization`.

Hierarquia:

```text
User
  ↕ Membership
Organization
  ├─ MarketplaceAccounts
  ├─ Products
  ├─ Suppliers
  ├─ Catalogs
  ├─ Orders
  ├─ Purchases
  ├─ Settings
  └─ Billing
```

Toda query privada deve filtrar `organizationId`.

Não depender apenas do frontend.

Índices compostos devem incluir `organizationId` quando apropriado.

---

# 36. ARQUITETURA TÉCNICA

## 36.1 Direção atual preservada

Monorepo modular.

```text
Web / Future Mobile / Extension
              │
              ▼
            API
              │
   ┌──────────┼──────────┐
   ▼          ▼          ▼
Domain     Integrations  Jobs
   │          │          │
   └──────────┼──────────┘
              ▼
      PostgreSQL / Redis
              │
              ▼
         Object Storage
```

## 36.2 Stack alvo

Preservar quando possível:
- Node.js 22+;
- TypeScript;
- npm workspaces;
- Fastify;
- Zod;
- Prisma;
- PostgreSQL;
- Redis;
- BullMQ;
- React/Next conforme app atual;
- object storage S3-compatible.

## 36.3 Pacotes recomendados

```text
apps/
  web/
  api/
  worker/
  extension/          # se mantida
packages/
  db/
  types/
  calculations/
  scoring/
  auth/
  billing/
  amazon/
  amazon-ads/
  catalog-ingestion/
  procurement/
  inventory/
  finance/
  capital/
  alerts/
  ai/
  observability/
```

Não criar pacote sem necessidade. Estrutura é alvo lógico.

---

# 37. DOMAIN-DRIVEN BOUNDARIES

Bounded contexts:
- Identity & Access;
- Marketplace Integration;
- Sales;
- Catalog/Product;
- Inventory;
- Finance;
- Advertising;
- Capital;
- Procurement;
- Opportunity;
- Alerts;
- Billing;
- AI Assistant.

Evitar serviço "god object".

---

# 38. MODELO DE DADOS ALVO

Entidades principais:

## Identity
- User
- Organization
- Membership
- Role/Permission
- AuditLog

## Billing
- Subscription
- Plan
- FeatureEntitlement
- UsageCounter
- InvoiceRef

## Marketplace
- MarketplaceAccount
- SyncCursor
- IntegrationTokenRef
- MarketplaceOrder
- MarketplaceOrderItem
- MarketplaceListing
- FeeTransaction
- Payout/Receivable

## Product
- Product
- ProductIdentifier
- ProductImage
- ProductAlias
- ProductCategory

## Cost
- InventoryLot
- CostComponent
- CostSnapshot

## Inventory
- InventoryPosition
- InventoryMovement
- InboundShipment
- ReplenishmentRecommendation

## Ads
- AdAccount
- CampaignSnapshot
- AdGroupSnapshot
- AdProductSnapshot
- SearchTermSnapshot

## Finance
- Expense
- ExpenseAllocation
- FinancialSnapshot
- DREPeriodSnapshot

## Capital
- CapitalAccount
- CapitalMovement
- CapitalAllocation
- CapitalPlan

## Supplier
- Supplier
- SupplierContact
- SupplierTerms

## Catalog
- Catalog
- CatalogFile
- CatalogImport
- CatalogPage
- CatalogItem
- ExtractionField
- ProductMatch

## Procurement
- SupplierOffer
- SupplierOfferTier
- SupplierPriceSnapshot
- PurchaseCart
- PurchaseCartItem
- PurchaseOrder
- PurchaseOrderItem
- GoodsReceipt

## Opportunity
- Opportunity
- OpportunityScore
- DecisionLog

## Alerts
- Alert
- AlertRule
- AlertEvent

## AI
- AiUsage
- AiConversation
- AiToolInvocation — metadata sanitizada

---

# 39. DINHEIRO E PRECISÃO

Persistência:
- moeda em inteiros (centavos);
- currency ISO;
- percentuais em basis points quando persistidos se útil.

Nunca usar float para dinheiro persistente.

Funções financeiras devem especificar arredondamento.

---

# 40. EVENTOS DE DOMÍNIO

Eventos internos úteis:
- order.synced
- sale.finalized
- product.cost.updated
- inventory.changed
- inventory.low
- supplier.catalog.imported
- supplier.offer.updated
- purchase_order.confirmed
- purchase_order.received
- ads.snapshot.received
- capital.changed
- alert.triggered

Inicialmente podem usar fila/event bus simples.
Não exigir arquitetura distribuída prematuramente.

---

# 41. JOBS

Jobs idempotentes:
- Amazon sync;
- Ads sync;
- catalog preprocess;
- catalog extract;
- catalog AI interpret;
- catalog validate;
- catalog persist;
- rebuild metrics;
- alert evaluation;
- financial reconciliation.

Cada job:
- jobId;
- organizationId;
- version;
- attempt;
- status;
- error sanitizado;
- startedAt;
- finishedAt.

DLQ/failed inspection obrigatório.

---

# 42. AMAZON INTEGRATION

## 42.1 Adapter

Criar interfaces por capability, não um único client gigante.

Exemplos:
- OrdersProvider;
- ListingsProvider;
- InventoryProvider;
- FinancesProvider;
- ReportsProvider;
- FulfillmentProvider.

## 42.2 Sync

- incremental quando suportado;
- cursor;
- rate limit;
- retry;
- backoff;
- idempotência;
- lastSuccessfulSyncAt.

## 42.3 Dados faltantes

Não inventar.
Exibir `pendente`, `indisponível` ou `estimado`.

## 42.4 Operações de escrita

Separadas de leitura.
Requer:
- permissão;
- confirmação;
- audit;
- idempotency key.

---

# 43. AMAZON ADS INTEGRATION

Separar credenciais e autorização.

Provider:
- reporting;
- campaigns;
- budgets;
- bids;
- keywords.

Fase 1:
read-only analytics.

Fase 2:
user-triggered writes.

Fase 3:
guarded automation.

---

# 44. CATALOG AI SERVICE

Interface sugerida:

```ts
interface CatalogInterpreter {
  interpret(input: ExtractedCatalogChunk): Promise<InterpretedCatalogChunk>
}
```

Implementação não deve acoplar domínio a um fornecedor de LLM específico.

Campos:
- model provider;
- model;
- prompt version;
- extraction version;
- cost;
- tokens/usage;
- confidence.

Guardar somente o necessário.

---

# 45. PROMPTS VERSIONADOS

Prompts de produção devem:
- viver versionados;
- ter testes com fixtures;
- saída JSON schema;
- não ser strings gigantes espalhadas no código.

Mudança de prompt que altera extração deve atualizar `promptVersion`.

---

# 46. STORAGE

Catálogos:
- bucket privado;
- path tenant-scoped;
- URL assinada;
- retenção configurável;
- hash;
- MIME;
- tamanho.

Imagens extraídas:
- thumbnails;
- origem;
- sem exposição pública padrão.

---

# 47. SEGURANÇA

Obrigatório:
- secrets fora do repo;
- criptografia em trânsito;
- tokens externos criptografados/secret manager;
- RBAC server-side;
- tenant isolation;
- audit logs;
- rate limiting;
- upload limits;
- MIME validation;
- antivírus/scan quando infraestrutura permitir;
- CSRF conforme arquitetura;
- XSS sanitization;
- SQL via ORM/queries parametrizadas.

Não logar:
- tokens;
- arquivos;
- dados sensíveis completos;
- cartões.

---

# 48. PRIVACIDADE / LGPD

Necessário antes de comercialização:
- política de privacidade;
- base legal;
- retenção;
- exportação;
- exclusão;
- sub-processadores;
- contrato/DPA quando aplicável.

Dados de fornecedor e catálogos pertencem ao tenant.

Uma base global futura deve usar apenas dados permitidos/licenciados.

---

# 49. OBSERVABILIDADE

Logs:
- structured JSON;
- requestId;
- organizationId interno;
- jobId;
- integration.

Métricas:
- API latency;
- error rate;
- queue lag;
- sync delay;
- catalog duration;
- AI cost per import;
- review rate;
- match accuracy;
- Amazon quota errors.

Sentry/OpenTelemetry ou equivalente futuro.

---

# 50. UX / DESIGN SYSTEM

## 50.1 Direção

Profissional, limpo, confiável, não "dashboard gamer".

Características:
- densidade moderada;
- sidebar;
- cards objetivos;
- tabelas fortes;
- espaço para operação;
- dark mode futuro;
- responsivo.

## 50.2 Semântica de estado

Nunca depender somente de cor.

- Success + ícone/texto;
- Warning;
- Danger;
- Info;
- Opportunity.

## 50.3 Loading

Tabelas:
- skeleton;
- paginação;
- empty state.

Jobs:
- progresso real quando disponível;
- nunca fake progress enganoso.

## 50.4 Empty states

Explicar:
- por que está vazio;
- o que fazer;
- CTA.

---

# 51. BOTÕES E PADRÕES

Primário:
ação principal.

Secundário:
ação reversível.

Danger:
exige confirmação.

Ações comuns:
- Salvar;
- Cancelar;
- Importar;
- Exportar;
- Ver detalhes;
- Editar;
- Arquivar;
- Excluir;
- Reprocessar;
- Abrir WhatsApp;
- Criar pedido;
- Aplicar recomendação.

Toda ação async deve:
- prevenir double submit;
- feedback;
- estado de erro;
- retry quando seguro.

---

# 52. FILTROS E TABELAS

Padrão:
- filtros persistem na URL quando apropriado;
- ordenação server-side em grandes datasets;
- paginação;
- colunas configuráveis;
- exportação respeita filtro;
- busca debounce.

---

# 53. SMART DEFAULTS

Configurações iniciais não são "verdades".
Devem ser versionadas e explicáveis.

Exemplos iniciais:
- margem alvo;
- margem alerta;
- reserva;
- cobertura;
- risco;
- concentração.

Mostrar:
`Recomendado pelo Easy Seller`

Usuário pode customizar.

---

# 54. CÁLCULOS FUNDAMENTAIS

## 54.1 Lucro

`profit = netRevenue - COGS - attributableExpenses`

Definir precisamente componentes por contexto.

## 54.2 Margem

`margin = profit / grossOrNetSalesBase`

O sistema deve escolher uma convenção única na UI principal e documentá-la.
Recomendação: margem sobre receita de venda do item.

## 54.3 ROI

`ROI = profit / capitalInvested`

## 54.4 Markup

Separar de margem.

## 54.5 Break-even

Preço mínimo para lucro zero considerando custos.

## 54.6 Maximum Buy Price

Preço máximo de compra para atingir margem/ROI alvo.

Todos em `packages/calculations` com testes.

---

# 55. DADOS ESTIMADOS

Nunca rotular venda estimada como venda real.

Exibir badges:
- Real;
- Calculado;
- Estimado;
- Inferido;
- Manual.

Tooltip:
- fonte;
- data;
- metodologia.

---

# 56. RELATÓRIOS / EXPORTAÇÃO

CSV/XLSX:
- vendas;
- produtos;
- estoque;
- DRE;
- despesas;
- compras;
- fornecedores;
- oportunidades.

PDF futuro para relatórios executivos.

Exportação respeita RBAC.

---

# 57. NOTIFICAÇÕES

In-app obrigatório.
E-mail/WhatsApp push futuro.

Preferências:
- categoria;
- severidade;
- canal;
- frequência.

Evitar spam.

---

# 58. BILLING

## 58.1 Entitlements

Não usar checks hardcoded tipo:
`if plan === "PRO"`.

Usar capabilities:
- `ads.analytics`;
- `capital.map`;
- `procurement.catalog_ai`;
- `easy_ai`;
- etc.

## 58.2 Usage

Contadores:
- pedidos/mês;
- integrações;
- usuários;
- páginas IA;
- AI queries;
- storage futuro.

## 58.3 Upgrade

Imediato.

## 58.4 Downgrade

No próximo ciclo; preservar dados.

## 58.5 Trial

TBD comercial:
- 15 ou 30 dias.
Arquitetura suporta ambos.

---

# 59. ADMIN / BACKOFFICE

Necessário antes de SaaS público.

Admin interno:
- tenants;
- planos;
- consumo;
- falhas de sync;
- jobs;
- suporte;
- feature flags;
- billing state;
- imports;
- custo IA.

Sem acesso casual a dados de clientes.

---

# 60. SUPORTE

Primeira versão:
- Central de ajuda;
- contato;
- ticket/link.

Chat interno pode ser posterior.
Não é diferencial prioritário frente a capital/procurement.

---

# 61. MOBILE

Web responsiva primeiro.

Prioridade mobile:
- KPIs;
- vendas;
- alertas;
- estoque;
- produtos;
- aprovar recomendação;
- consultar fornecedor.

App nativo somente após validação.

---

# 62. EXTENSÃO DE NAVEGADOR

Se mantida:
- identifica ASIN;
- consulta Easy Seller;
- exibe dados da conta;
- salva para análise;
- nunca duplica cálculo.

É cliente fino.

---

# 63. ROADMAP DE IMPLEMENTAÇÃO

## Fase 0 — Product Foundation
- este spec;
- SaaS multi-tenant;
- auth;
- Organization/Membership;
- settings;
- entitlements;
- audit;
- adapters.

## Fase 1 — Amazon Connect
- autorização;
- contas;
- produtos;
- pedidos;
- vendas;
- fees;
- estoque;
- sync.

## Fase 2 — Gestor Core / Parity
- Home;
- vendas;
- pedidos;
- produtos;
- inventário;
- Curva ABC;
- reembolsos;
- DRE.

## Fase 3 — Profit Engine
- landed cost;
- lotes;
- CMV;
- margem;
- ROI;
- break-even;
- despesas.

## Fase 4 — Inventory Intelligence
- velocity;
- coverage;
- safety stock;
- ROP;
- reposição;
- parado.

## Fase 5 — Capital Intelligence
- Capital Map;
- movimentos;
- concentração;
- simulador;
- alocador.

## Fase 6 — Procurement Foundation
- Supplier;
- Catalog;
- SupplierOffer;
- busca;
- comparação;
- carrinhos;
- WhatsApp;
- purchase orders.

## Fase 7 — Procurement AI
- pipeline;
- OCR fallback;
- LLM interpretation;
- revisão;
- dedupe;
- históricos;
- usage billing.

## Fase 8 — Opportunity Engine
- matching Amazon;
- scoring;
- catálogo → oportunidade;
- decisões.

## Fase 9 — Ads
- integração;
- analytics;
- lucro pós-Ads;
- advisor.

## Fase 10 — Alerts
- engine;
- regras;
- inbox;
- severity.

## Fase 11 — Easy AI
- internal tools;
- explain;
- query;
- summaries.

## Fase 12 — Amazon Operations
- listagens;
- inventário;
- DBA;
- FBA;
- etiquetas;
- fiscal;
- repricer progressivo.

## Fase 13 — SaaS Commercial
- billing;
- trial;
- plans;
- usage;
- admin;
- onboarding comercial.

## Fase 14 — Other Marketplaces
- Mercado Livre;
- Shopee;
- outros via adapters.

---

# 64. ORDEM DE PRIORIDADE

P0:
- segurança;
- tenant;
- dados corretos;
- cálculos;
- Amazon sync;
- lucro;
- estoque.

P1:
- capital;
- compras;
- catálogo;
- fornecedores;
- oportunidades.

P2:
- AI assistant;
- automações;
- repricing;
- operações avançadas.

Não sacrificar confiabilidade financeira para acelerar feature visual.

---

# 65. TEST STRATEGY

## Unit
- calculations;
- scoring;
- tier pricing;
- allocation;
- reorder;
- normalization.

## Integration
- DB;
- API;
- jobs;
- providers mock;
- entitlement.

## Contract
- Amazon adapters;
- Ads adapters;
- AI JSON schema.

## E2E
- onboarding;
- import catálogo;
- product search;
- WhatsApp CTA;
- purchase order;
- sale detail;
- dashboard.

## Fixtures
Catálogos reais anonimizados/licenciados:
- tabela simples;
- visual;
- escaneado;
- promo tier;
- combo;
- múltiplas colunas.

---

# 66. CRITÉRIOS DE QUALIDADE

Antes de marcar uma feature como concluída:
- teste;
- empty state;
- loading;
- error;
- RBAC;
- tenant isolation;
- mobile básico;
- audit se mutação crítica;
- observabilidade;
- documentação;
- sem dados mock em produção.

---

# 67. CRITÉRIOS DE ACEITE GLOBAIS

### Financeiro
Mesmo input deve produzir mesmo output.

### Tenant
Usuário A nunca acessa dado B.

### Catálogo
Falha parcial não corrompe registros anteriores.

### IA
JSON inválido não entra no banco sem validação.

### Compras
MOQ respeitado.

### Estoque
Recebimento de pedido atualiza lote e capital de forma transacional.

### Billing
Feature protegida também no backend.

### Amazon
Retry não duplica pedidos/transações.

---

# 68. MIGRAÇÃO DE USUÁRIO DE OUTRO GESTOR

Objetivo:
reduzir switching cost.

Ferramentas futuras:
- importar custos via CSV;
- importar produtos;
- importar fornecedores;
- reconciliação SKU/ASIN;
- wizard de configuração;
- checklist de migração.

Não depender de export proprietário de concorrente.

---

# 69. MÉTRICAS DO PRODUTO EASY SELLER

Produto:
- tempo até primeira integração;
- tempo até lucro confiável;
- % produtos com custo;
- alert → action conversion;
- retenção;
- feature adoption.

Procurement:
- páginas/import;
- review rate;
- extraction accuracy;
- dedupe accuracy;
- compras iniciadas;
- economia observada.

Capital:
- capital parado;
- cobertura;
- ruptura;
- ROI realizado;
- forecast error.

Infra:
- sync freshness;
- import failure;
- cost/tenant;
- AI cost/import.

---

# 70. DECISÕES QUE NÃO DEVEM SER REABERTAS SEM MOTIVO

1. IA não é usada a cada busca de fornecedor.
2. Pesquisa opera em base estruturada do tenant.
3. Product != SupplierOffer != MarketplaceListing.
4. Catálogo é versionado.
5. Dinheiro é centavos.
6. Cálculos financeiros são determinísticos.
7. Dados privados não são cruzados entre tenants.
8. Procurement é módulo oficial, não feature lateral.
9. Capital é módulo central.
10. Amazon Brasil é prioridade inicial.
11. Multi-marketplace é arquitetura futura, não escopo simultâneo inicial.
12. Recursos externos entram por adapters/providers.
13. Planos usam entitlements, não condicionais espalhados.

---

# 71. DECISÕES TBD

- gateway de pagamento;
- preços finais;
- duração de trial;
- provedor LLM;
- storage provider;
- search engine além de PostgreSQL;
- provedor fiscal se necessário;
- mobile nativo;
- políticas exatas de retenção;
- thresholds de score após dados reais;
- política final de suporte.

Esses pontos não devem impedir a arquitetura modular.

---

# 72. INSTRUÇÕES ESPECÍFICAS PARA CODEX

Ao receber tarefa neste repositório:

1. Leia este arquivo.
2. Leia docs técnicos relacionados.
3. Inspecione implementação atual.
4. Identifique migrações necessárias.
5. Não duplique conceitos.
6. Prefira evolução incremental.
7. Escreva testes.
8. Atualize docs quando decisão mudar.
9. Não faça chamadas reais pagas em testes.
10. Use mocks/fixtures.
11. Não exponha segredos.
12. Não use IA como substituto de lógica determinística.
13. Não crie "placeholder funcional" que pareça dado real.
14. Marque estimativas.
15. Preserve auditabilidade.
16. Para ação financeira/operacional destrutiva, implemente confirmação.
17. Se requisito conflitar com este documento, registre explicitamente a divergência antes da mudança.

---

# 73. FONTES EXTERNAS DE REFERÊNCIA

Estas fontes servem para entendimento de capacidades e benchmark. O Codex não deve precisar pesquisá-las para implementar o produto descrito aqui.

## Gestor Seller
- Funcionalidades: https://gestorseller.com.br/funcionalidades/
- Visão e planos/evento: https://gestorseller.com.br/map-2026/
- Inventário Amazon: https://gestorseller.com.br/inventario/
- Listagem Amazon: https://gestorseller.com.br/publish-amazon/
- Integração Ads: https://gestorseller.com.br/integracao-ads/
- FBA: https://gestorseller.com.br/help-page-fba/

## Amazon
- Selling Partner API docs: https://developer-docs.amazon.com/sp-api/
- Amazon Ads API: https://advertising.amazon.com/pt-br/about-api

---

# 74. CONCLUSÃO DE PRODUTO

O Easy Seller não deve ser apenas um dashboard de marketplace.

O ciclo completo é:

```text
DESCOBRIR
   ↓
ANALISAR
   ↓
COMPRAR
   ↓
ESTOCAR
   ↓
VENDER
   ↓
MEDIR
   ↓
ENTENDER
   ↓
DECIDIR
   ↓
REINVESTIR
   ↺
```

O produto deve unir:

**SELL**
vendas, pedidos, operação.

**PROFIT**
custos, lucro, margem, DRE.

**STOCK**
estoque, giro, reposição.

**CAPITAL**
caixa, concentração, alocação.

**BUY**
fornecedores, catálogos, compras.

**DISCOVER**
oportunidades.

**AI**
interpretação, explicação e assistência onde realmente agrega valor.

O norte é simples:

> **O vendedor entra no Easy Seller para saber o que está acontecendo e sai sabendo o que fazer.**
