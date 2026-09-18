# Character Page — contrato de dados, limiares e quem manda em quê

Wireframe 9a. Rota `/pages/characters/<handle>` (ver a regra em `CLAUDE.md`: o URL
gera-se sempre por `system.url`, nunca a mao). Template `templates/metaobject/character.json`,
secoes `character-header` e `character-grid`.

## Quem escreve o quê

| Dado | Dono | Onde |
|---|---|---|
| Entrada `character` (title, universe, products, estado) | **Importer** (`alterpop-importer2`, ciclo B7, `characterPages.server.js`) | metaobject `character` |
| `alterpop.character` no produto | Importer | metafield do produto |
| `alterpop.characters` na colecao (so Characters `ACTIVE`, do maior para o menor n.o de produtos) | Importer | metafield da colecao |
| `image` do Character | Carlos, a mao. O importer nunca a escreve | metaobject `character` |
| Renderizacao | Tema | `sections/character-*.liquid`, `sections/shop-by-character.liquid` |

O tema so le. `shop-by-character` le `collection.metafields.alterpop.characters`; nao
percorre os metaobjects. Uma entrada `ACTIVE` que nao conste desse metafield tem URL
publico e nenhum caminho de navegacao: fica orfa e indexavel. O `scripts/qa-characters.mjs`
afirma que isso nao acontece.

## Definicao `character` (`gid://shopify/MetaobjectDefinition/47579070794`)

| Campo | Tipo | Regras no Admin |
|---|---|---|
| `title` | `single_line_text_field` | obrigatorio |
| `image` | `file_reference` | opcional, so imagem |
| `universe` | `list.collection_reference` | obrigatorio, `list.min` 1 |
| `products` | `list.product_reference` | obrigatorio, `list.min` 1, `list.max` 128 |

Capacidades: `publishable`, `onlineStore` (`urlHandle` `characters`, redirects ativos),
`renderable` (`metaTitleKey` `title`, dai o `<title>` da pagina ser o nome e nao o handle).
Nao existe campo de descricao, por isso nao ha meta description — nao se inventa.

## Dois limiares, de proposito diferentes

| Limiar | Valor | Onde vive | O que decide |
|---|---|---|---|
| Curadoria | **≥ 3** produtos `ACTIVE` publicados no Online Store | Importer (`CHARACTER_THRESHOLD`) | Se vale a pena abrir uma pagina para este Character |
| Integridade | **≥ 1** produto em `products` e ≥ 1 colecao em `universe` | Admin (`list.min`) | Que nao exista uma pagina sem nada |

O 3 e uma decisao editorial; o 1 e um chao tecnico. Nao se alinham um pelo outro.

Consequencia a conhecer: **o importer e o dono do ciclo de vida.** No ciclo seguinte
(de 45 em 45 minutos) `planCharacterMetaobjects` percorre a uniao dos Characters do
catalogo com os metaobjects que ja existem na loja. Uma entrada `ACTIVE` criada a mao
com menos de 3 produtos ativos passa a `DRAFT` (`set-draft`; `products` mantem-se). Uma
entrada `DRAFT` com menos de 3 fica como esta (`skip`). O Admin aceitar a entrada nao
quer dizer que ela sobreviva ao proximo ciclo.

## Regras de renderizacao

- Uma referencia em `products` pode desaparecer (produto apagado ou despublicado depois
  de escrita). O grid e o header ignoram entradas `blank`; a contagem "N figures" e a de
  cards renderizaveis, nunca `products.value.size`.
- Zero cards renderizaveis: o grid nao renderiza nada (sem wrapper, sem mensagem, sem
  placeholder). O header mantem-se, sem meta line; o breadcrumb ja liga ao universo.
- `metaobject.universe.value.first` (accessor) devolve `null` nesta drop; usar o filtro
  `| first`.
- Uma entrada `DRAFT` responde 404 no storefront (a doc do Shopify: com `publishable`,
  so o estado `active` e acessivel).

## Verificacao

`scripts/qa-characters.mjs --host staging|live` — ver `docs/DEPLOY.md`.
