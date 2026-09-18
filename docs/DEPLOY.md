LIVE_THEME_ID       = 207355216202   ALTERPOP 2.0
STAGING_THEME_ID    = 207846408522   ALTERPOP 2.0 - Tema de Testes
ROLLBACK_ACTIVE     = 207854633290   ROLLBACK — 18/09/2026 (snapshot do live pre-deploy)
STAGING_SYNCED_AT   = 3441b14 (18/09/2026)
LIVE_DEPLOYED_AT    = 3441b14 (18/09/2026)

Regras
- Nenhum push direto ao live.
- Live recebe git, nunca uma copia de tema.
- Um rollback ativo, sempre o mais recente.

Sequencia de deploy
1. commit em origin/main, registar SHA
2. shopify theme push --theme=207846408522
3. duplicar live no admin como ROLLBACK - <data>, apagar o anterior
4. verificar HTML servido do staging com ?preview_theme_id=207846408522&nocache=1
5. shopify theme push --theme=207355216202 do mesmo SHA do passo 2

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
