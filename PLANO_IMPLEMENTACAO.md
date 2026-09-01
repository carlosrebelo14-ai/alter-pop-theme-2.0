# Alterpop.store — Plano de Implementação (v2)
### Tema novo Shopify OS 2.0, base Dawn — substitui o tema Crave

Documento de trabalho para o Claude Code.

**Fontes de verdade:** `Instruções para o Programador Frontend`, `Relatório de
Handoff do Designer`, `Wireframe Alterpop_3_3.pdf` (numerado por secção), e o
addendum "Character Page tier scope".

**Decisões de arranque (v2):**
- Base: **Dawn** (tema oficial Shopify, OS 2.0, neutro). Não o Crave.
- Tema anterior (Crave-based, `preview_theme_id=206656307530`): **arquivado**,
  mantido apenas como referência histórica. Não copiar código dele.
- Plano Shopify: **Basic**. Sem impacto no scope, exceto checkout (ver Fase 7).
- Organização do trabalho: **por componente, não por página** (ver secção
  "Porquê componente-primeiro").

---

## Princípio não-negociável

**Tudo o que é dado de catálogo vem da app própria de sincronização**
(`alterpop-importer2`/`alterpop-sync-clock`), nunca do frontend. Isto inclui,
sem exceção: a que Character ou Line um produto pertence, a classificação
Impulse/Premium, o manufacturer limpo, e o nome do fornecedor de licença.

Nunca escrever lógica no tema que infira, calcule ou agrupe estes dados. Se um
campo não existir ainda, **parar e reportar o gap** — não construir solução
alternativa.

O único cálculo permitido no cliente é estado de apresentação derivado de
números já fornecidos (ex: badge de rarity a partir de quantidade de stock
numérica). Formatação, layout, motion e responsividade também são
apresentação.

Não replicar nem usar como referência a estrutura antiga da loja (coleções
por Franquia/Fabricante, `custom.parent_collection`) — está a ser substituída.

---

## Regra já fechada (addendum) — Character Page tier scope

- Character Page grid inclui Impulse e Premium juntos, **sem filtro de
  tier**, sempre.
- Só cortes Line / Height / Year reorganizam o mesmo set completo.
- Product Card dentro da Character Page usa lógica condicional standard
  (badge Premium, estados de rarity) — nenhuma variante nova de componente.
- Relational Navigation entre Character Pages (`--motion-transactional`)
  ignora tier de ambos os lados.
- Curation por tier (Gifts Under €25, Limited Editions & Exclusives)
  mantém-se como entry point à parte — não replicada como filtro dentro do
  character browsing.
- Isto é regra de query/dados, não muda nada visual/estrutural.

---

## Porquê componente-primeiro (e não página-a-página)

Na tentativa anterior (sobre o Crave) as tarefas foram dadas por página
("Homepage → tirar manufacturer do card"). Resultado observado em auditoria:
o card da homepage foi corrigido e o da página de coleção ficou intacto —
dois Product Cards diferentes no mesmo site.

O Product Card não é uma secção. É um componente que vive na homepage, na
coleção, na Universe Room, na Character Page e nos resultados de pesquisa.
Tratá-lo como tarefa de página garante divergência.

**Regra:** uma tarefa de componente só está concluída quando **todas** as
instâncias no site usam o mesmo snippet. As páginas montam-se depois, a
partir de componentes já corretos.

**Uma sessão de Claude Code por componente.** Cada prompt abaixo é
autossuficiente e pode ser colado numa sessão nova.

---

## Regra de ouro para a base Dawn

**Ficar com a lógica do Dawn. Deitar fora o visual do Dawn.**

O `cart-drawer.js` fica (AJAX, estados de erro, focus trap). O CSS do cart
drawer vai fora e escreve-se de novo.

O Dawn traz infraestrutura que não está no wireframe mas que a loja precisa:
cart AJAX, variant picker com combinações indisponíveis, paginação, predictive
search, formulários de conta, acessibilidade (focus trap, screen reader
announcements, skip links), i18n, e hooks que apps de terceiros esperam
encontrar. Nada disto se reescreve.

Mas o Dawn **não é uma folha em branco**. Se o CSS base e as sections não
usadas não forem limpos logo no início, repete-se o problema do Crave em
escala menor. Daí a Fase 0 ter uma passagem de limpeza explícita.

---

# FASE 0 — Setup + Limpeza + Tokens

Pré-requisito de tudo. Nenhum bloqueio de dados.

### 0A — Setup e limpeza do Dawn

```
Contexto: novo tema Shopify OS 2.0 para Alterpop.store (colecionáveis de
cultura pop, dropshipping). Base: Dawn limpo. O tema anterior (Crave) está
arquivado e NÃO deve ser consultado nem copiado.

Tarefa:
1. Instalar Dawn como tema de desenvolvimento (Shopify CLI).
2. Inventariar sections/, snippets/ e assets/ e listar-me o que existe,
   agrupado por: (a) lógica essencial a manter, (b) visual a substituir,
   (c) não usado neste projeto.
3. NÃO apagar nada ainda — apresenta a lista e espera confirmação.

Princípio: ficar com a lógica do Dawn, deitar fora o visual do Dawn.
```

Depois de confirmares a lista, segunda sessão para executar a limpeza.

#### Estado da Fase 0A (concluída)

Baseline: Dawn 16.0.0 em `alter-pop-theme-2.0`, commit `a717245`.
Limpeza: branch `chore/phase-0a-cleanup`, commit `25bf2de`.

**Removido:** blog/artigos (10 ficheiros) + `.github/workflows` do Dawn.
Patch em `main-search.liquid` (removido o ramo `when 'article'`).

**Adiado — o Dawn 16 costura estas features em ficheiros a manter, e
removê-las agora obrigaria a editar a mesma infra duas vezes:**

| Alvo | Onde está costurado | Remover na |
|---|---|---|
| pickup-availability | `buy-buttons.liquid`, `main-product.liquid`, `product-info.js`, `quick-add.js` | Fases 4 e 6 |
| disclosures | `product.json`, `main-product`, `featured-product`, `main-cart-items`, `cart-notification-product`, `cart-drawer`, `theme.liquid` | Fases 4 e 6 |
| quick-order / bulk | `featured-collection`, `main-collection-product-grid`, **`card-product.liquid`** (usa `<quick-add-bulk>`), `global.js`, i18n | Fase 1A (card) + 4/6 |
| decorativos (`sparkle.gif`, `mask-blobs.css`, `mask-arch.svg`) | `base.css`, `featured-collection`, `main-search`, `main-collection-product-grid`, `related-products` | Fase 0B |
| ~40 ícones highlight | opções `select` no schema de `main-product`, `featured-product`, `collapsible-content`, `icon-with-text` + labels em 50 ficheiros i18n | limpeza de schema, Fase 1 |

`square.svg` **fica** — usado por `gift-card-recipient-form` e
`facets.liquid`, ambos a manter.

### 0B — Design tokens

```
Tarefa: criar assets/tokens.css com as custom properties do design system
Alterpop e garantir que são carregadas em theme.liquid antes de qualquer
outro CSS.

Tokens obrigatórios:
- Cor: paleta completa do design system. Accent = Marigold #FFB800.
  IMPORTANTE: #FFB800 é exclusivo a CTAs de compra. Nunca em cookie banner,
  nunca em links de navegação genéricos.
- Emerald-600: exclusivo ao selo de autenticidade. Não reutilizar.
- Tipografia: Hanken Grotesk 800/900 (display/headlines), Inter 400-600
  (body/UI).
- Espaçamento e radius conforme design system.
- Motion, exatamente dois tokens:
  --motion-transactional: ~120ms, easing rápido
  --motion-editorial: ~400ms, cubic-bezier(0.22,1,0.36,1), fade + scale
    1.02 para 1.00

Também: esvaziar/neutralizar o CSS base do Dawn que define cor e tipografia,
para não haver valores a competir com os tokens.

Verificação de sucesso: nenhuma cor roxa/púrpura em lado nenhum do site.
```

---

# FASE 1 — Componentes globais

Construir antes de qualquer página. Cada um usado em todo o site.

### 1A — Product Card ⚠️ componente mais crítico

```
Tarefa: criar snippets/product-card.liquid como ÚNICO product card do site.

Wireframe: secções 8a e 8b.

Estados (calculados a partir de stock numérico — cálculo permitido):
- Available (>10): standard
- Limited (1-10): +8% área de imagem, contador de stock visível
- Sold Out (0): 70% opacidade, CTA outline "Notify Me"

Hover: --motion-transactional em todas as instâncias.

Metadata line: Franchise/Universe > Line (se aplicável) > Height/Dimension
- Franchise nunca trunca. Se algo cair por falta de espaço, cai a Line.
- Franchise omitido dentro da Universe Room (redundante nesse contexto).

REGRA CRÍTICA: Manufacturer e Year NUNCA aparecem no card. Só no PDP.

BLOQUEADO (não implementar, deixar comentário "BLOQUEADO: aguarda app"):
- Badge "Premium Piece" — depende da flag Impulse/Premium vinda da app
- Line na metadata line — depende da entidade Line vinda da app

Conclusão da tarefa: substituir TODAS as instâncias de card no tema por este
snippet (homepage, coleção, pesquisa, related products). Listar-me os
ficheiros alterados. A tarefa não está feita enquanto existir mais do que um
card no site.
```

### 1B — Header + Universes Panel + Mobile Drawer

```
Wireframe: 1a, 6b, 6c.

- sections/header.liquid, snippets/universes-panel.liquid,
  snippets/mobile-drawer.liquid
- Universes panel: trigger (NÃO mega-menu), 6-8 franquias, nome + thumbnail
  quadrado, sem colunas nem subcategorias
- Manter a lógica de acessibilidade do Dawn (focus trap, escape, aria)
- Navegação: Universes / New Arrivals / Limited Editions & Exclusives /
  Gifts Under 25 euros e Outlet
```

### 1C — Search Overlay

```
Wireframe: 5c.
Mobile full-width + desktop. Manter predictive search do Dawn, substituir
visual. Atenção a filtros Liquid dentro de strings (erro conhecido na
tentativa anterior: pipe dentro de string literal partiu a página inteira).
```

### 1D — Footer

```
- Footer "Legal": Terms & Conditions, Privacy Policy, Cookie Policy,
  Complaints Book (link externo www.livroreclamacoes.pt), Contact
- Fine print SEMPRE visível, nunca atrás de link: nome legal, NIF, morada
- Logo em tokens do design system (não roxo)
- Copy legal ainda pendente de advogado: usar placeholder claramente marcado
```

---

# FASE 2 — Homepage
*Wireframe: 1a, 1b*

```
- sections/hero.liquid: single fixed franchise, full-bleed, sem carousel
  dots, entrada com --motion-editorial
- Trust badges: Ships Across Europe / Real, Synced Stock / 14-Day Returns
- "Explore Universes": grid de doorways (imagem 1:1, NÃO logos de marca).
  Abre com --motion-editorial.
- New Arrivals / Bestsellers: vitrine CURADA e limitada. Não é o catálogo
  completo com filtros e paginação.

Copy: não usar texto de anotação do wireframe como copy real. (Erro conhecido
da tentativa anterior: "Not a product card — a doorway into each franchise's
Universe Room" apareceu literalmente em produção como subtítulo.)

Usa o snippet product-card.liquid da Fase 1A. Não criar variantes.
```

---

# FASE 3 — Universe Room
*Wireframe: 7a, 7b* — **PARCIALMENTE BLOQUEADO**

```
- templates/collection.universe-room.json
- sections/universe-room-header.liquid (fade + scale na entrada)
- sections/shop-by-brand.liquid, sections/shop-by-type.liquid
- Filtros laterais: Rarity, Box Condition, Price, Franchise, Availability

BLOQUEADO: sections/shop-by-character.liquid exige o campo Character
resolvido pela app. Implementar a shell com estado vazio explícito; não
inferir personagens a partir de títulos de produto.
```

---

# FASE 4 — PDP Impulse / Premium
*Wireframe: 3a, 3b, 3c* — **PARCIALMENTE BLOQUEADO**

```
- templates/product.impulse.json e product.premium.json (ou secção
  condicional única)

Product Identity Block, ordem fixa:
  Character Name
  Line · Manufacturer · Year
  Type · Height
Line só aparece com 3+ peças. Sem Line aplicável, o slot COLAPSA — nunca
mostrar Universe/Franchise como substituto.

Impulse: specs colapsadas por defeito, sem badge, --motion-transactional na
entrada, reviews simples.

Premium: specs sempre visíveis (tabela estruturada, stagger row-by-row +40ms
com easing editorial — ÚNICO caso staggered do sistema), badge "Premium
Piece", aviso de fragilidade quando aplicável, --motion-editorial na entrada
da imagem still-life, reviews com contador.

Overshoot de escala (1.00 para 1.03 para 1.00, 260ms): EXCLUSIVO ao botão
Add to Cart.

BLOQUEADO: Line, Manufacturer limpo, Year, flag tier, fornecedor de licença
por SKU. Praticamente todo o Identity Block e o selo "Officially Licensed by
[Supplier]" dependem da app. Construir a shell, marcar os slots, não inventar
valores.
```

---

# FASE 5 — Character Page + Line Page
*Wireframe: 9a, 9b* — **BLOQUEADO POR INTEIRO**

Não iniciar até Character e Line chegarem da app.

```
- templates/page.character.json, templates/page.line.json
- Character Page: grelha completa sempre visível, sem escolher filtro
  primeiro. Cortes Line/Height/Year reorganizam, nunca bloqueiam.
  SEM FILTRO DE TIER, nunca (ver addendum).
- Line Page: parágrafo curto de contexto editorial (nunca copy de
  marketing) antes da grelha. Só existe com 3+ peças (regra vinda da app).
- Compare Drawer: máximo 2 produtos, sem persistência entre sessões, tabela
  única (Manufacturer, Weight, Dimensions, Official Seal, Price,
  Availability). Entry point EXCLUSIVO desta página.
```

---

# FASE 6 — Cart Drawer + Filter Drawer

```
Manter cart-drawer.js do Dawn (AJAX, erros, focus trap). Substituir só o
visual. Empty state conforme wireframe. Filter drawer mobile.
```

---

# FASE 7 — Checkout / Order Confirmation

⚠️ **Limite do plano Basic:** checkout profundamente customizado é exclusivo
do Shopify Plus. O wireframe de checkout deve ser lido como *"o que é
possível configurar"*, não *"o que vamos programar"*. Não tentar reconstruir
o checkout.

```
Configurável no Basic: branding (logo, cores, tipografia) via checkout
editor; Apple Pay / Google Pay / card; Shopify Functions para lógica de
shipping.

- Protective Shipping (3,90 euros): só quando o carrinho contém item marcado
  fragile/collector's piece
- Prazo unificado em toda a jornada:
  "dispatched in 24-48h · arrives in 6-9 business days" (Standard)

CONFIRMAR: a flag fragile/collector's piece já existe no produto, ou é campo
novo a pedir à app?
```

---

# FASE 8 — Legal + Cookie Consent Banner

```
- Template genérico reutilizável: breadcrumb "Legal > [Page Name]", H1,
  "last updated", corpo simples, footer padrão
- Cookie Consent Banner (componente novo, mesma família dos overlays de
  estado): Accept e Reject com peso visual ESTRITAMENTE igual.
  NENHUM dos dois usa Gold/Marigold — é exclusivo a CTAs de compra, e usá-lo
  aqui cria assimetria fiscalizável em RGPD.
- Copy legal pendente de advogado: placeholder claramente marcado
```

---

## Bloqueios transversais (campos que a app ainda não fornece)

| Campo/Entidade | Necessário para |
|---|---|
| **Character** | Shop by Character (F3), Character Page (F5), Identity Block (F4) |
| **Line** (+ regra 3+ peças) | Line Page (F5), metadata do card (F1A), Identity Block (F4) |
| **Flag Impulse/Premium** | Badge Premium (F1A), regime PDP completo (F4) |
| **Manufacturer limpo** | Identity Block (F4) |
| **Fornecedor de licença por SKU** | "Officially Licensed by [Supplier]" (F4) |
| **Flag fragile/collector's piece** | Protective Shipping (F7) — confirmar se já existe |

Se algum destes aparecer disponível mas em formato diferente do esperado
(metafield vs. tag vs. coleção), confirmar a forma exata antes de escrever os
Liquid objects/schemas. Não assumir.

---

## Ordem de trabalho

```
FASE 0  Setup Dawn + limpeza + tokens
   |
FASE 1  Componentes globais (Card > Header > Search > Footer)
   |
FASE 2  Homepage
   |
FASE 3  Universe Room (shell; Shop by Character bloqueado)
   |
FASE 4  PDP (shell; Identity Block bloqueado)
   |
FASE 6  Cart + Filter Drawer
   |
FASE 7  Checkout (configuração, não programação)
   |
FASE 8  Legal + Cookie Banner
   |
FASE 5  Character/Line Page — quando os dados da app chegarem
```

---

## Riscos e gaps em aberto (não bloqueiam arranque)

1. Estados de erro/vazio para Character Page e Line Page quando um corte
   (Line/Height/Year) não devolve resultados — não desenhados.
2. Contraste WCAG AA do Marigold `#FFB800` com texto ink-900 — validado em
   teoria, não confirmado em build real.
3. Acessibilidade além de contraste — aria-labels em ícones, focus order em
   drawers/overlays. Herdar do Dawn onde possível e verificar.
4. "A Minha Coleção" (gamificação pós-compra) — fase posterior do projeto,
   depende de modelo de dados de encomendas ainda não existente. Estados
   Available/Limited/Sold Out **não podem** ser reaproveitados para
   Possuído/Em Falta/A Caminho.
5. Copy legal em falta — estrutura pronta, texto ainda não fornecido.

---

## Metodologia

- **Uma sessão de Claude Code por componente**, com prompt fechado. Não
  arrastar uma sessão longa entre componentes diferentes.
- **Sessão nova** para arrancar (a anterior tem o Crave em contexto).
- Confirmação visual (screenshot) antes de avançar para o próximo
  componente — sempre antes de publicar.
- Nunca inferir dado de catálogo no tema. Se faltar, parar e reportar.
- Design tokens fechados. Não reabrir decisões já tomadas sem motivo
  explícito.
- Ao concluir um componente, verificar que **não existe mais do que uma
  versão dele** no tema.
