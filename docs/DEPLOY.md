LIVE_THEME_ID       = 207355216202   ALTERPOP 2.0
STAGING_THEME_ID    = 207846408522   ALTERPOP 2.0 - Tema de Testes
ROLLBACK_ACTIVE     = 207885467978   ROLLBACK pre-character-hardening — 18/09/2026 (snapshot do live pre-deploy)
STAGING_SYNCED_AT   = cfb1993 (24/09/2026)
LIVE_DEPLOYED_AT    = cfb1993 (24/09/2026)

Regras
- Nenhum push direto ao live.
- Live recebe git, nunca uma copia de tema.
- Um rollback ativo, sempre o mais recente.
- Todo o push ao staging e ao live passa por scripts/deploy-theme.mjs. O comando
  escreve o registo (STAGING_SYNCED_AT / LIVE_DEPLOYED_AT / ROLLBACK_ACTIVE) no
  mesmo passo do push e commita-o: se o push falha nao se regista nada, se passa
  o registo fica logo feito. O registo deixa de depender de ninguem se lembrar.
- Limite: um `shopify theme push` feito a mao continua tecnicamente possivel. E
  um desvio, e o deploy seguinte apanha-o — o drift check do comando compara o
  live com o commit em LIVE_DEPLOYED_AT e recusa avancar se divergirem.

Sequencia de deploy
1. commit num ramo, registar SHA (main so recebe depois do QA de staging verde)
2. node scripts/deploy-theme.mjs staging
      push ao staging + regista STAGING_SYNCED_AT + commit do registo
3. verificar HTML servido do staging com ?preview_theme_id=207846408522&nocache=1
3b. QA de personagens contra o staging (gate — tem de sair verde):
      node scripts/qa-characters.mjs --host staging
4. fast-forward do ramo para main, git push origin main
5. duplicar live no admin como ROLLBACK - <data>; verificar o rollback (ver
   CLAUDE.md, "theme duplicate is not atomic"); so depois apagar o anterior
6. node scripts/deploy-theme.mjs live --rollback <id do rollback novo> --dry-run
      lista os pre-requisitos com ✓/✗ e nao empurra nada. Com tudo ✓, repetir
      sem --dry-run. Pre-requisitos: main == origin/main, tema em HEAD igual ao
      do staging, rollback novo (nao o ja registado), drift live == LIVE_DEPLOYED_AT,
      QA de staging verde. Depois do push regista LIVE_DEPLOYED_AT e ROLLBACK_ACTIVE.
7. git push origin main (o registo commitado) e QA contra o live, colar a saida:
      node scripts/qa-characters.mjs --host live

Registo de drift — 24/09/2026
- Push direto ao live (5 ficheiros: sections/main-product.liquid,
  assets/header.css, assets/predictive-search.js,
  assets/universe-room.css, sections/header.liquid) via
  `shopify theme push --allow-live`, fora da sequencia de
  scripts/deploy-theme.mjs — feito por um agente Claude Code a pedido
  do Carlos, sem duplicar um rollback novo antes do push e sem correr
  scripts/qa-characters.mjs --host live antes ou depois.
- Verificado por browser real (nao so grep ao DOM servido) em live: PDP
  zoom, fecho da menu-drawer mobile, submit da pesquisa (Enter +
  "Search for"), scrim do universe-room-header, chip "Frozen" no
  popular_searches — todos confirmados a funcionar em
  https://alterpop.store apos o push.
- Live == cfb1993. Staging tambem == cfb1993 (mesmos ficheiros ja
  tinham sido testados la primeiro, mesma sequencia de pushes).
- Consequencia: o rollback ativo (207885467978, pre-character-
  hardening, 18/09/2026) e anterior a estas correcoes — repor esse tema
  desfaria tambem estas 5 correcoes. Nao invalidado (serve para
  reverter tudo desde 18/09 se necessario), mas o proximo rollback
  antes do proximo deploy deve duplicar o live atual (cfb1993), nao o
  207885467978.

Registo de drift — 18/09/2026
- O live estava dois commits a frente do registo: 27183d6 (feat: hero_image
  fallback no Universe Room, 15:29) e 425a06f (fix: sizes do hero, 15:48) ja
  estavam no live, com LIVE_DEPLOYED_AT ainda em bc87ace.
- Verificacao: pull do live inteiro (393 ficheiros) contra git@425a06f, JSON
  normalizado. Unica diferenca: "settings": {} em trust_badges no index.json, o
  falso positivo ja documentado abaixo. Live == 425a06f.
- Causa: push ao live fora da sequencia registada; o registo era escrito a mao
  e nao foi. Correcao: o comando de deploy escreve o registo (regra acima).
- Consequencia: o rollback 207859253578 e anterior a essa alteracao. Repor esse
  tema desfaria tambem o hero do Universe Room. Fica invalidado; o proximo
  rollback duplica o live atual.

QA de personagens — pre-requisitos (scripts/qa-characters.mjs)
- App "Alterpop QA Read" no Dev Dashboard (org Alterpop), so de leitura, criada
  e instalada em 18/09/2026. Versao ativa alterpop-qa-read-2. Scopes:
  read_metaobjects, read_products, read_online_store_pages.
- NAO existe token estatico de Admin API. A Shopify fechou a criacao de
  admin-created custom apps; apps novas autenticam por client credentials
  grant. O script troca client id/secret por um token de 24h em
  POST https://<shop>/admin/oauth/access_token (grant_type=client_credentials)
  e so depois chama a Admin API. Nada de longa duracao fica em disco.
  A loja tem de estar na mesma organizacao que a app — alterpop.store esta.
- Ficheiro `.env` local na raiz do repo, nunca commitado (`.env*` esta no .gitignore):
      SHOPIFY_CLIENT_ID=<client id da app>
      SHOPIFY_CLIENT_SECRET=<chave secreta da app>
      SHOPIFY_SHOP_DOMAIN=jyr17t-wr.myshopify.com
  O dominio permanente e jyr17t-wr.myshopify.com; alterpop.myshopify.com
  devolve 404 e nao e esta loja.
- Falta qualquer uma das tres chaves e o script sai com 1. Nunca degrada para
  modo publico: um gate que passa por falta de credencial e pior do que nenhum.
- Revogar o acesso e desinstalar a app da loja, ou rodar a chave secreta em
  Dev Dashboard > Alterpop QA Read > Definicoes da app.
- `--host` e obrigatorio, sem valor por defeito. `staging` e o mesmo dominio
  publico com o cookie preview_theme_id=207846408522 (ver "Verificacao de HTML
  servido" abaixo); o script confirma pelo header server-timing que o tema
  servido e mesmo o pedido, para um teste a staging nunca passar a bater no live.
- Corre antes de cada push ao live e depois de cada sync de catalogo que crie
  ou ative Characters (o importer escreve os metaobjects; o tema nao os valida).
- Rota de metaobject: /pages/<urlHandle>/<handle>. O URL gera-se sempre por
  `system.url`, nunca a mao. Regra completa e historico em CLAUDE.md.
- Assercoes: por entrada ACTIVE — title/universe/products preenchidos, entrada
  presente no alterpop.characters de pelo menos um dos seus universos (orfa),
  200 na rota, H1 e <title> com o nome, zero Liquid error, cards servidos iguais
  aos produtos visiveis no Admin, meta line igual aos cards. Globais — qa-dead-ref
  nunca ACTIVE, /characters/<handle> a 404, e varrimento estatico do repo por
  hrefs /characters/ sem /pages/. O 404 sozinho nao prova nada (a Shopify devolve
  404 nessa rota de qualquer forma); o varrimento e que apanha a regressao.
- Sai com 1 a primeira assercao falhada, imprimindo o progresso N/M ate ai.

Drift check (repo vs. live, via staging logo apos duplicar)
- shopify theme pull --theme=207846408522 --path=/tmp/staging-snapshot
- diff -rq templates sections snippets config /tmp/staging-snapshot/{templates,sections,snippets,config}
- `theme pull` reindenta e acrescenta um comentario automatico a todos os
  JSON — isto gera falsos positivos em quase todos os ficheiros. A
  comparacao valida ignora formatacao: parsear ambos os lados como JSON
  (depois de remover o bloco /* ... */ inicial) e comparar as arvores,
  nao o texto. Exemplo:

  python3 - <<'EOF'
  import json, re
  def load(p):
      with open(p) as f:
          return json.loads(re.sub(r'/\*.*?\*/', '', f.read(), flags=re.S))
  a, b = load("templates/index.json"), load("/tmp/staging-snapshot/templates/index.json")
  print("IDENTICAL" if a == b else "REAL DIFFERENCE")
  EOF

  Sem este passo, o proximo drift check da ~12 falsos positivos e a
  divergencia real fica escondida no meio deles.

Verificacao de HTML servido (preview de tema nao-live precisa de cookie)
- curl sozinho nao chega: o preview_theme_id funciona por cookie de
  sessao definido no redirect 301 do myshopify.com para o dominio
  primario. Sem cookie jar, o curl -L perde a sessao a meio do redirect
  e a segunda pedida serve o tema live, nao o preview.
- Verificar sempre contra uma pagina do template que se quer testar, nao
  a homepage — `universe-header`/`shop-by-character`/`shop-by-brand`/
  `shop-by-type`/`product-grid` so existem em collection.universe-room,
  nunca em index.

  rm -f /tmp/staging-cookies.txt
  curl -sL -c /tmp/staging-cookies.txt -b /tmp/staging-cookies.txt -o /dev/null \
    "https://alterpop.store/?preview_theme_id=207846408522"
  curl -sL -c /tmp/staging-cookies.txt -b /tmp/staging-cookies.txt \
    "https://www.alterpop.store/collections/one-piece?nocache=1" \
    | grep -o 'id="shopify-section-[^"]*"' | sort -u

Reconciliacao inicial (18/09/2026)
- 404.json / index.json / password.json / footer-group.json tinham
  settings de customizer aplicadas so no live, nunca commitadas. Live
  venceu nesses ficheiros.
- header-group.json tinha commit legitimo pos-deploy (58683f9,
  universe_collections) alem de duas chaves orfas em announcement-bar-0
  (text_alignment, color_scheme) que nao existem no schema atual de
  sections/announcement-bar.liquid (so define text e link). As chaves
  orfas foram removidas, o resto do ficheiro manteve-se com o repo.
- index.json: a unica "diferenca" restante e settings: {} (live) vs.
  chave settings ausente (repo) em trust_badges — equivalentes em
  Liquid, nao mexer.
- Regra usada so nesta reconciliacao inicial: live ganha em JSON de
  customizer, exceto quando o repo tem commit posterior ao ultimo
  deploy (35d3976) a tocar o mesmo ficheiro — nesse caso repo ganha, e
  as chaves especificas divergentes sao verificadas uma a uma antes de
  decidir, porque um ficheiro pode ter uma parte legitimamente a frente
  e outra parte drift de admin ao mesmo tempo (foi o caso do
  header-group.json). A partir daqui git e o unico escritor e esta
  excecao deixa de ser necessaria.

Nota — validacao de settings
Settings de seccao validam contra {% schema %} da seccao.
Settings de bloco validam contra o schema do bloco do seu proprio type.
Blocos nao herdam o schema da seccao-mae.
Ao diagnosticar chaves orfas, verificar o escopo certo antes de remover.

Nota — drift check
A comparacao valida e sobre JSON normalizado.
shopify theme pull reindenta e acrescenta comentario, gerando falsos positivos.
Caso conhecido e inofensivo — "settings": {} no live vs. chave ausente no repo.
