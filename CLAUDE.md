# CLAUDE.md — Alterpop OS 2.0 theme

Working notes for Claude Code sessions on this repo. See `PLANO_IMPLEMENTACAO.md`
for the phase plan and scope.

## Dev server ↔ git (hard rule — learned the hard way)

`shopify theme dev` runs a file watcher that pushes **incremental** uploads and
deletes to the development theme as files change on disk. Git operations that
churn the working tree — **`git checkout` (branch switch), `git merge`,
`git branch -d`, `git push --delete`** — make the watcher emit spurious
`delete` events for files that then never get re-uploaded (a fast-forward merge
changes nothing on disk, so no `update` event fires to fix it). Symptom:
`Liquid error: Could not find asset snippets/<x>.liquid` on every page, even
though the file is present on disk and committed.

Therefore:

1. **Do git branch operations (checkout / merge / branch delete) with the dev
   server stopped.** Stop it, do the git work, start it again.
2. **If that is not possible**, after the git work: **restart `shopify theme dev`
   and re-verify against the served HTML** before reporting anything as done.
   A plain `git add` / `git commit` on the current branch is safe and does not
   need this.

## Source-of-truth precedence (hard rule)

1. **Wireframe** (`Wireframe_Alterpop_3_3.pdf`) — the site mockup; default source.
2. **Design system / designer handoff** — for tokens, motion, colour rules.
3. **The user's prompts** — if a prompt contradicts 1 or 2, flag it; the
   source wins (as with the hero Marigold CTA).

Exception: if you spot a real error in the wireframe (internal
inconsistency, technically impossible, an a11y problem) or a clear
improvement, you may propose it — but **report first**, with the deviation
named and justified. Never decide against the wireframe alone. Obvious
zero-design-impact fixes (typos, a wrong icon) you may just make, mentioning
them in the report.

**Before building or reworking any section, render its wireframe page(s) and
follow them pixel-by-pixel** — proportions, type hierarchy, spacing, element
order. Render with PyMuPDF (installed at `~/Library/Python/3.9`):

```
python3 - <<'EOF'
import fitz
d = fitz.open("Wireframe_Alterpop_3_3.pdf")
d[N].get_pixmap(matrix=fitz.Matrix(1.5,1.5)).save("/tmp/wf/pN.png")
EOF
```

Page map (index → wireframe label): 1-4 = 1a homepage mobile · 5-8 = 1b
homepage desktop · 9 = 2a hero A (mobile spec) · 10 = 1d cart drawer.
Sections are labelled with a black badge top-left of each page.

Known wireframe facts that override earlier prompt summaries:
- Hero CTA "Shop the Universe" IS Marigold + the asymmetric brand corner —
  the DS groups it with Add to Cart / Checkout as the primary purchase-CTA
  family. The hero eyebrow is also Marigold in the wireframe.
- **Asymmetric brand corner — only bottom-right is rounded, radius = height
  ÷ 3.** Confirmed two ways against wireframe 2a ("Shop the Universe") and
  3b (PDP "Add to Cart"): high-zoom visual read (top-left, top-right,
  bottom-left square; only bottom-right rounded), then confirmed by
  extracting the PDF's own vector path data (PyMuPDF `get_drawings`) and
  measuring the corner's bezier geometry directly. Both buttons: height
  28.58pt, corner radius 9.53pt — **exactly height / 3** (0.33333, checked
  to 5 decimals across 8 anchor points per curve, both instances agree to
  the point). That is much larger than `--radius-md` (6px on a 44-48px
  button is only ~13%) — the brand corner is proportional to the button's
  OWN height, not a fixed token from the radius scale.
  `.ap-btn--primary` in `assets/buttons.css` is
  `border-radius: 0 0 calc(var(--ap-btn-height) / 3) 0`; the three call
  sites that restate the button at higher specificity
  (`assets/cart-drawer.css` `#CartDrawer-Checkout`, `assets/cart-page.css`
  `#checkout`, `assets/pdp.css` `.ap-pdp .product-form__submit`) each set
  their own `--ap-btn-height: 48px` and reuse the same `calc()`. The
  written design-system spec said "0/md/md/md" (top-left square, fixed
  6px radius) — a **design-system/wireframe contradiction on both which
  corner and the radius size**; the wireframe wins per source-of-truth
  precedence, but flag it to the designer to reconcile the written spec.
- Homepage 1a/1b is much larger than Phase 2 as first built: hero, trust,
  Explore Universes (name overlaid on the doorway, not below), New Arrivals
  rail, **Bestsellers = a ranked numbered list with "N sold this month"**
  (not a card rail), full-height editorial + "[Franchise] Archive" split,
  Limited Editions rail (+ "Limited Run" pill), Gifts Under €25 grid
  (title + price only), "Real Customers, Real Collections" UGC + review,
  Collectors Club, footer.
- Product card in the rails shows NO CTA button — image, title, franchise,
  dimension, price. Franchise is a visible line (placeholder under v3).

## Shared primitives (hard rule)

**No section defines its own button or its own font-size. Always use the
primitive and the scale.**

- **Buttons** → `.ap-btn` + a variant (`--primary` / `--secondary` / `--ghost`
  / `--chip`) in `assets/buttons.css`. Height, weight (600 / `letter-spacing:
  var(--tracking-button)`), `:active { transform: scale(.96) }` and hover all
  come from the primitive. `--primary` carries the Marigold + asymmetric brand
  corner so Add to Cart (F4) and Checkout (F6) inherit it. `.ap-nav__link`
  (header nav) is deliberately not a button.
- **Type** → a `.type-*` class or a `--text-*` / `--tracking-*` / `--leading-*`
  token from `assets/tokens.css`. The DS scale is the only set of sizes:
  11 12 13 14 15 16 18 19 20 22 26 34 64 px. Four roles (`--text-display`,
  `--text-h2`, `--text-h3`, `--text-product-title`) step up at `min-width:
  750px`; the rest are fixed. Every uppercase label/eyebrow/metadata uses
  `--tracking-label` (0.04em). No `clamp()` fluid headings.

## Dawn `.grid` inside an Alterpop layout (hard rule — hit three times)

Dawn's `.grid` is a **flexbox**. `.grid__item` carries
`width: calc(N% - spacing)` + `max-width: calc(50% - spacing)` +
`flex-grow: 1`, and `product-media-gallery`'s `.product__media-list` adds
`grid grid--peek`. Those numbers assume a flex parent with `gap` and an item
free to grow. Put that markup inside **your own CSS grid** (or any non-Dawn
layout) and the `%` widths resolve against the wrong box — the grid track,
a differently-sized flex container — and the item **collapses to a fraction
of its cell**.

Symptoms seen: Universe Room cards at 1/3 of their track; PDP gallery slide
at 146px; PDP cross-sell nearly (that one was actually `skip_styles`).

**Recipe:**
1. Add `data-ap-grid` to the Alterpop wrapper that contains the reused Dawn
   `.grid` / `.product__media-list` markup. `assets/ap-grid-reset.css`
   (loaded globally, after `base.css`) then strips
   `width` / `max-width` / `min-width` / `flex` off `.grid__item` and
   `.product__media-list > .product__media-item` — but **only** under that
   attribute, so Dawn's own pages (`/collections/all`, cart, search, blog,
   `related-products`) are untouched.
2. The section then owns sizing through its **own `grid-template-columns`**
   (or `display:block` + one visible item, as the PDP gallery does).
3. Verify the DOM item width on the served page — before and after — and
   confirm `/collections/all` is byte-for-byte unchanged.

Current users: `sections/main-collection-product-grid.liquid` (the
`data-ap-grid` is gated on `template.suffix == 'universe-room'`) and
`sections/main-product.liquid` (`.ap-pdp__media`).

**`grid--peek` is two different Dawn rules wearing one class name — don't
assume which one applies (hit 2026-09-13).** The bare selector
`.grid--peek .grid__item { width: calc(50% - spacing - 3rem) }` in
`base.css` is Dawn's default: a **3-card peek carousel** width, meant for
card rails (related products, collection sliders) where you want the next
card sliver visible at the edge. It only steps aside for a narrower or
fuller width when the markup *also* carries a `grid--N-col-tablet-down` /
`grid--N-col-desktop` modifier class. `product-media-gallery.liquid`'s
`.product__media-list` carries `grid grid--peek` but **no column modifier**
— so on a first pass at restoring its width math (the gallery-collapse fix
above), it's easy to reach for that bare selector and get a genuinely
correct, byte-identical Dawn 16.0.0 rule that is nonetheless the *wrong*
Dawn rule for this markup: a single-image PDP hero rendered at ~36% width
with neighbors peeking on both sides, sized like a card-rail item because
that's the only unscoped rule available. Verified against the `a717245`
baseline that this is unmodified stock Dawn CSS, not an Alterpop mistake —
the mistake was reapplying it to markup that never asked for peek
behavior.

**When Dawn CSS and the markup's own sizing hints disagree, the markup
usually knows something the bare CSS rule doesn't.** An `<img>`'s `sizes`
attribute is a `desktop_columns` / `mobile_columns` calculation baked in
at render time from the *same* section settings that produced the
surrounding class list — it's a second, independent expression of layout
intent, computed by different Liquid than the CSS was written against. If
`sizes` says one slide per viewport (`calc(100vw / N - Xrem)` with `N: 1`)
while the applied CSS says ~36% width, that mismatch is the tell: go
compare against the wireframe (source-of-truth #1) rather than trusting
whichever Dawn selector happens to match. Here, `sizes` and wireframe 3a/3b
(PDP mobile, single full-width hero + dot progress indicator, no peek, no
visible thumbnail grid) agreed with each other and disagreed with the
`.grid--peek .grid__item` fallback — that 2-vs-1 agreement is what settled
it. Fixed by re-declaring `width`/`min-width: 100%` scoped to
`.ap-pdp__media[data-ap-grid] .product__media-item` in `pdp.css`, not by
editing the shared Liquid snippet (also referenced, if unused, by Dawn's
stock `featured-product.liquid` — neutralizing at the point of use in CSS
stays consistent with how `ap-grid-reset.css` already treats this same
snippet).

**Dots-vs-thumbnail-grid is a known, approved wireframe deviation, not yet
built.** Wireframe 3a/3b show a 3-dot progress indicator under the mobile
hero; the current build renders Dawn's stock 64px thumbnail grid instead
(wraps to 3 rows on a 9-media product, ~220-238px tall — with the hero
now correctly full-width, that pushes price/Add to Cart below the fold on
a 375×812 viewport). Approved to build, but as its own branch with its
own visual verification — it's a JS/motion change (dot-swap interaction),
not a CSS-only fix, and shouldn't ship bundled with a hero-width hotfix.

## z-index bands (hard rule — found by a QA pass, 2026-09-13)

The theme has several independent fixed/absolute overlays that can be open
at the same time (cookie banner + cart drawer + menu drawer + search dialog),
so their z-indexes are a single coordinated stack, not per-component
choices. Bumping one in isolation to beat another (done twice in the same
QA pass — first the search dialog was raised to fix the hamburger icon
overlapping it without checking it against the cookie banner; then the
menu drawer was left at 60/59 when the cookie banner was moved to 75,
so an unaccepted banner drew over the OPEN menu drawer) just moves the
same overlap bug to a different pair of layers. Reserved bands, low to high:

- **0-40** — in-page/local stacking (cards, badges, sticky header row).
  Not globally coordinated; only matters within its own component.
- **70/71** — `.menu-drawer-container`'s hamburger/X toggle, local
  stacking among header siblings only (not a modal-band participant —
  the drawer panel itself moved out of this range, see below).
- **75** — `.ap-cookie` (cookie consent banner). Persistent bottom bar;
  must stay BELOW every modal/drawer overlay so an unaccepted banner never
  blocks a control inside whatever is open on top of it.
- **80-99** — modal/drawer overlay band, reserved for full-viewport
  dialogs and drawers: `.ap-search__dialog` (82), `.menu-drawer__overlay`
  (94) + `.menu-drawer` (95, its open-state X-close icon at 96 to stay
  above its own panel), cart `.drawer` (95).

When adding a new fixed overlay, or changing an existing z-index, place it
in the right band and check it against every OTHER layer that can be open
at the same time — not just the one bug report is about. Verify with the
layer you're not currently fixing still visible (e.g. test the search
dialog with the cookie banner un-accepted, not after dismissing it) —
**and verify by screenshot on a real preview theme, not by grepping the
served DOM.** `.menu-drawer__overlay` existed, had the right CSS, and
still rendered `display: none` because base.css hides every empty `<div>`
(`div:empty`) at higher specificity than a single-class rule — the same
collision `.cart-drawer__overlay:empty` in component-cart-drawer.css
already had to patch. A missing/wrong z-index can also hide behind a
STUB — `.header__icon--menu[aria-expanded='true']::before` is Dawn's
original full-viewport drawer scrim, `content:''`/`width:100%`, harmless
in stock Dawn where that button spans the header; restyled here to a
fixed 40x40 icon, the same rule collapses into a ~40px near-full-height
dark stripe drawn over both the drawer and the new scrim. Neutralized
with `content: none`. Before trusting a fixed/absolute overlay is doing
nothing, check computed `::before`/`::after` on its ancestors too — grep
for other Dawn pseudo-elements combining `position: absolute` with
`width: 100%` before assuming a "decorative" stripe is cosmetic.

## Verification (also a hard rule)

**Render verification is always against the served HTML from the dev server,
never `shopify theme check` alone.** `theme check` is a linter — it does not
catch a broken upload, a missing synced asset, or a runtime Liquid error on a
real page.

Minimum check after any theme change, per affected page type
(home `/`, collection `/collections/all`, product, search `/search?q=…`):

```
curl -s http://127.0.0.1:9292/<path> \
  | grep -iE "Could not find asset|Liquid error|Liquid syntax|Translation missing"
```

Expect **no matches**. Then confirm the changed markup is actually present in
the response (grep for the new class / snippet output), and take a screenshot
for anything visual. Run `theme check --fail-level error` as well, but it is
necessary, not sufficient.

If the dev server has been through git branch churn this session, assume its
uploaded copy is stale until a restart + re-verify says otherwise.

## Store / CLI

- Store handle: **`jyr17t-wr.myshopify.com`** (permanent domain). `alterpop-store`
  does not resolve. Set in `shopify.theme.toml`.
- Development theme id: `206791704906`. Dev server: `http://127.0.0.1:9292`.

## Branch workflow

- One branch per phase/component: `feat/phase-<n><x>-<slug>` or `chore/…`.
- Fast-forward merge to `main`, push, delete the branch. No PRs.
- `a717245` is the untouched Dawn 16.0.0 baseline — keep it as the reference
  point for the cumulative diff.

## Open TODOs / unverified assumptions

- **Header curation collection handles** (Phase 1B) — verified against the
  store via the Admin API:
  - `/collections/new-arrivals` **EXISTS** — 805 products, rule tag =
    "new-arrival", sorted `CREATED_DESC`. Real curation, live.
  - `/collections/limited-editions-exclusives` and `/collections/gifts-under-25`
    **DO NOT EXIST** — dead links in `sections/header.liquid` +
    `snippets/mobile-drawer.liquid` today. **App dependency, not an admin
    task**: both are tier curation (Limited Editions = Premium-tier
    exclusives; Gifts Under €25 = price-appropriate Impulse pieces) and
    correctly depend on the BLOCKED `alterpop.tier` flag (Phase 4). Creating
    them today with title-keyword or price-only rules would be **inference**
    — forbidden by the v3 non-negotiable principle (no inference from
    tags/titles/prices/collections). They stay unbuilt until the tier field
    exists; then the merchant builds the smart-collection rule on it.
  - `outlet` — locale key `sections.header.outlet` exists but is not
    currently rendered as its own link (folded into the combined "Gifts
    Under €25 / Outlet" header/drawer label, which points at
    `gifts-under-25`). `/collections/outlet` does not exist in the store.
    Not tier-dependent — simple **merchant admin task** whenever a
    standalone Outlet link is wanted.
- **Footer link handles** (Phase 1D) — verified against the store:
  - `/pages/contact` (title "Contacto") **EXISTS**.
  - `/pages/faq` **EXISTS** (linked via the footer's `faq_url` setting, a
    merchant-set URL field, not a hardcoded handle — no action needed).
  - `/pages/cookie-policy` **DOES NOT EXIST** — dead link in
    `sections/footer.liquid` (and the Phase 8 cookie-banner fallback).
    Not tier-dependent — **merchant admin task**: create the page, assign
    the "Legal page" template (`templates/page.legal.json`, Phase 8).
  - Terms/Privacy use the standard `/policies/*` URLs — confirmed to exist
    with PT sample copy already in Settings → Policies (see the Phase 8
    entry below).
- **Bestsellers / Trending / "premium-collectibles" — none are usable
  curation sources**, verified via the Admin API:
  - `best-sellers` and `all-products` both return **5575 products** — the
    saved rule is `tag != "__alterpop-nonexistent-tag-zzz__"`, which
    excludes nothing. Both ARE the entire catalog, not curation. The
    homepage Bestsellers rail (`sections/bestsellers.liquid`, collection
    setting defaults to `all` in `templates/index.json` as a marked dev
    fallback) will show the whole catalog, not real bestsellers, until a
    merchant points it at a genuinely curated collection.
  - `trending` has **0 products** — no product carries a "trending" tag.
  - `premium-collectibles` (49 products) is ruled on **title keywords**
    (Statue, Figuarts, Replica, Limited Edition, Diorama) — this is title
    inference, same problem as everywhere else in this doc: it must NOT be
    substituted as a tier source for the Identity Block / Premium regime
    / Limited Editions collection, even though the name is tempting.
- **Footer legal fine print** (Phase 1D) is placeholder — legal company name,
  NIF and fiscal address were not provided; rendered as clearly-marked
  `[ … — a confirmar ]` boxes in `sections/footer.liquid`. Full legal copy is
  a marked placeholder pending lawyer review. Replace, do not invent.
- **Franchise/Universe field** from the sync app does not exist yet — blocks
  the Product Card metadata line, the Universes Panel list, Universe Room,
  PDP Identity Block, Character/Line pages. Only raw
  `metafields.ociostock.licence` exists. Never infer from tags / collections /
  `custom.parent_collection`.
- **Asset cleanup** deferred: `component-card.css` + `quick-add*` /
  `quick-order-list*` loads (Phase 1A follow-up); `component-menu-drawer.css` /
  `component-list-menu.css` / `component-mega-menu.css` (Phase 1B follow-up).
- **`vendor` vs. "clean manufacturer"** (Phase 3). These are two different
  things and must not be conflated:
  - `product.vendor` (e.g. `"BANPRESTO"`) is real data. Fine for grouping by
    brand in navigation chips — Shop by Brand reads it via the
    `filter.p.vendor` Search & Discovery filter.
  - The **normalised "clean manufacturer"** used in the PDP Identity Block
    (F4: `Line · Manufacturer · Year`), where editorial precision matters, is
    BLOCKED — it does not exist yet. Never substitute `vendor` there.
- **Universe Room filters not configured on the store** (Phase 3). The store
  exposes no Search & Discovery filters, so the sidebar (Rarity & Exclusivity,
  Box Condition, Franchise/Universe, Availability) and the mobile filter drawer
  render only the groups the admin config exposes — currently none but Price.
  The UI (`assets/universe-room.css`) is built against Dawn's facet markup;
  it fills in when filters are enabled by metafield in admin. Shop by Type
  additionally has no clean source (`product.type` is a genre, tags are
  unstructured) — its chips fall back to a marked manual list.
- **`templates/collection.universe-room.json`** is not wired to any collection.
  No clean Franchise/Universe exists to auto-assign it; assign per collection
  in admin (Online Store → collection → Theme template). Sections:
  `universe-room-header`, `shop-by-character`, `shop-by-brand`, `shop-by-type`,
  then the shared `main-collection-product-grid` (vertical facets).
- **Character field** (Phase 3) blocks Shop by Character. `shop-by-character`
  reads `collection.metafields.alterpop.characters` (list of character
  metaobjects: title / image / url) and shows a marked empty state until it
  exists. The character avatars link to the Character Page (wireframe 9a/9b),
  a separate Catalogue Experience pattern — NOT built in Phase 3.
- **PDP regime + Identity Block fields** (Phase 4). `sections/main-product.liquid`
  reads `product.metafields.alterpop.tier` ('impulse' | 'premium') — BLOCKED,
  defaults to impulse. Dev override: the `force_tier` section setting;
  `templates/product.premium.json` bakes `force_tier: premium` so
  `/products/x?view=premium` previews it. The Identity Block
  (Character / Line · Manufacturer · Year / Type · Height) reads
  `metafields.alterpop.character` / `.line` / `.manufacturer` / `.year` /
  `.collectible_type` — ALL BLOCKED, rendered as marked placeholders. Only
  Height is live (`ociostock.dimensions`). **Character does NOT fall back to
  `product.title`** (`4a7a599` — a blocked field never substitutes the raw
  supplier title; it shows `[ character ]` until the metafield exists).
  `product.title` is a separate, always-real field: it is the page's actual
  `<h1>` and renders as its own visible identification line right under the
  Character slot (`.ap-pdp__title`, `type-product-title`, clamp 2 lines,
  subordinate to Character's `type-h2`) — a PDP must say what product it is
  even before Character ships. Do not conflate the two: Character is the
  BLOCKED display title, `product.title` is the unblocked identification
  line. Line only shows with 3+ pieces of that line — not computable, so
  shown when the field is present; the Line slot collapses when absent,
  Universe/Franchise is never a substitute.
  Spec sheet License row uses `metafields.alterpop.license` -> raw
  `metafields.ociostock.licence`. Reviews read the Shopify Product Reviews
  app metafields (`metafields.reviews.rating` / `.rating_count`) — no app
  installed, marked empty state.
- **OcioStock supplier descriptions arrive raw + multi-language** (app
  backlog). `product.description` from the sync app is unedited supplier
  copy — running-text blocks like "Brand / Manufacturer …", "License /
  Universe …", licensor names in Spanish (e.g. "El Señor De Los Anillos").
  It renders **verbatim** on the PDP body. Needs a **curated description
  field on the app side**; the theme must NOT sanitise / regex supplier
  text. Separate from the Identity Block + seal (those already read the
  BLOCKED `alterpop.*` fields, not the description).
- **`alterpop.fragile`** (Phase 7) — a per-SKU boolean, **its own field, not
  derivable from `alterpop.tier`**: not every Premium piece is fragile, and an
  Impulse piece can be. `sections/main-product.liquid` reads
  `product.metafields.alterpop.fragile.value` into `ap_fragile`; the PDP
  fragile notice renders on `{% if ap_fragile %}` ALONE (decoupled from
  `is_premium` in Phase 7). BLOCKED — field does not exist, so `ap_fragile` is
  always blank and the notice stays hidden (no placeholder — it's a prominent
  warm box between price and ATC). Same flag is the trigger for the Protective
  Shipping delivery-customisation function (see the Phase 7 checkout doc).
- **Delivery estimate copy is ONE key** (Phase 7): `general.delivery_estimate`
  = "dispatched in 24–48h · arrives in 6–9 business days". Used by the PDP
  (stock line + below ATC), the cart page footer, and — as plain rate-name
  text typed in admin — the checkout Standard shipping method. The old
  `sections.pdp.dispatch` key was removed.
- **PDP keeps Dawn's mechanics**: `<product-info>` + product-info.js,
  `product-media-gallery` snippet + media-gallery.js + product-modal.js
  (the `.ap-pdp__media` wrapper carries `product product--thumbnail
  product--large` so Dawn's gallery CSS engages; pdp.css neutralises the
  `.product` grid), inline `<variant-selects>` (Dawn's global.js element,
  `product-variant-options` snippet with `picker_type: 'button'`),
  `{% render 'buy-buttons' %}` (`<product-form>` + product-form.js),
  `{% render 'quantity-input' %}`. `assets/section-main-product.css` is
  loaded for gallery/price sizing; `pdp.css` (loaded first, scoped `.ap-pdp`)
  restyles on top.
- **Add to Cart overshoot** (1.00 -> 1.03 -> 1.00, 260ms) is in
  `assets/pdp-atc.js` + `pdp.css` `@keyframes ap-atc-overshoot`. DS
  microinteraction reserved EXCLUSIVELY to this button. The premium spec
  sheet's row-by-row +40ms stagger (`pdp-spec-stagger.js` + pdp.css) is the
  system's ONLY stagger.
- **Character / Line pages** (Phase 5, wireframe 9a/9b). `templates/page.character.json`
  + `page.line.json`; sections `catalogue-header`, `character-explore`
  (character only), `catalogue-grid`, `character-relational-nav` (character
  only). Not wired to real data — a Shopify `page` has no products. The grid
  reads `page.metafields.alterpop.products` (BLOCKED); the `collection`
  section setting is a **marked** dev fallback (currently `all`). Assign a
  real product source per page in admin. Header name = `page.title` (honest
  — the page IS the entity); universe / manufacturer / year-range / height-
  range = `page.metafields.alterpop.*`, BLOCKED, marked. Line editorial
  paragraph = `page.content`. The grid uses `data-ap-grid` (Dawn `.grid`
  reset). Card gets `hide_franchise` on the character page, `compare: true`
  on both.
- **EXPLORE BY cuts** (`character-explore` + `character-cuts.js`): Line /
  Height / Year toggles, one panel open at a time, a bucket click
  REORGANISES the grid (bucket members lead), never gates it. All three
  cuts are BLOCKED (no Line/Year field, no clean single-axis Height) — the
  toggles render, the panels show a marked empty state, and `reorder()` is
  wired to `data-line` / `data-height` / `data-year` on the grid items but
  inert until `[data-cut-bucket]` elements exist. NO tier filter, ever
  (addendum) — Impulse + Premium always appear together.
- **Compare Drawer** (`snippets/compare-drawer.liquid` + `compare-drawer.js`):
  entry point is the card `compare` toggle, rendered ONLY on Character/Line
  pages. Max 2, in-memory only (no storage, no cross-session persistence).
  One table: Manufacturer (BLOCKED -> `[ pending ]`), Weight (live variant),
  Dimensions (live `ociostock.dimensions`), Official Seal (raw
  `ociostock.licence`), Price, Availability. All values come off the card's
  `data-compare-*` attributes — never a fetch.
- **Line "BY CHARACTER / BY UNIVERSE"** (`line-group-by` section +
  `line-group-by.js`, wireframe 9b/p42): one toggle active at a time, the
  grouping reorganises the grid (`data-character` / `data-universe` on the
  items), never gates it. Both fields BLOCKED -> marked empty state; the
  reorder is wired and inert until values exist.
- **Cart Drawer** (Phase 6, wireframe 1d). `settings.cart_type` is now
  `drawer`. `snippets/cart-drawer.liquid` keeps Dawn's whole markup contract
  (`<cart-drawer class="drawer">`, `.active` toggle, `cart-drawer-items`,
  `#CartDrawer-*`, `quantity-input`, `cart-remove-button`, `.totals`,
  `#CartDrawer-Checkout`) — cart.js / cart-drawer.js untouched. Alterpop
  additions: free-shipping line + fill bar (reuses `free-shipping-line`),
  a FRANCHISE (BLOCKED) · dimension (live) meta line per item, the
  "COMPLETE THE [X] COLLECTION" cross-sell (from `settings.cart_drawer_collection`,
  `all` as a dev value), and the empty state (symbol + "Your Cart Is Empty"
  + "Back to the Catalog"). `assets/cart-drawer.css` restyles on top
  (loaded after `component-cart-drawer.css`); it must beat Dawn's
  `.cart-drawer .cart-item { display:grid; grid-template: … repeat(4,1fr) }`
  and the per-cell `grid-column: 2/4` / `2/5` — so the row grid + cell
  placement are re-declared at `.cart-drawer .cart-item*` specificity, and
  the table flatten must NOT include `tr` (that selector is `(0,2,1)` and
  would beat `.cart-item { display:grid }`).
- **Cart page** (Phase 7, `/cart`). Page-width sibling of the drawer — same
  visual language, no separate wireframe (1d is the only cart mock).
  `sections/main-cart-items.liquid` + `main-cart-footer.liquid` keep Dawn's
  `<cart-items>` markup + cart.js contract; `assets/cart-page.css` (loaded
  last, in place of the dropped `component-cart*.css`) owns the layout.
  Additions mirror the drawer: `free-shipping-line` + fill bar, FRANCHISE
  (BLOCKED) · dimension meta line, `general.delivery_estimate` caption under
  the subtotal, empty state (symbol + "Your Cart Is Empty" + "Back to the
  Catalog"), Checkout as `.ap-btn--primary` (a lone `#checkout` selector
  outranks base.css `.button`). `#main-cart-footer.is-empty { display:none }`
  hides the footer whole when the cart empties (Dawn tags that wrapper).
- **Checkout is native Shopify + Basic-plan-limited** (Phase 7). No
  `checkout.liquid`, no Checkout UI Extensions (Plus-only). Wireframe 4a/4c is
  read as "what the checkout editor + Shipping settings can configure", not a
  page to build — see `docs/phase-7-checkout-config.md` for the branding
  checklist, the marked wireframe divergences (asymmetric button corner,
  Hanken/Inter fonts, in-checkout Protective-Shipping checkbox, authenticity
  seal — all impossible on Basic / native checkout), and the Protective
  Shipping delivery-customisation approach.
- **Order confirmation page (4b) — built as a STANDALONE order template.**
  `templates/customers/order.liquid` (`{% section 'main-order' %}`) +
  `sections/main-order.liquid` + `assets/customer-order.css`. Wireframe 4b:
  emerald seal + "Order {name} Confirmed", "we sent the details to {email}",
  line items (Character · Franchise · Height), Estimated Delivery window,
  "Keep Exploring [franchise]", "Create an Account & Join the Collectors Club".
  `order.name` / `.email` / `.created_at` and Height (`ociostock.dimensions`)
  are live. Character (`alterpop.character`) BLOCKED -> falls back to the
  line item's product title (honest, not inference) — this is a *different*
  rule from the PDP: the order page has no separate Character slot, so its
  one Character field takes the fallback the PDP's Character slot doesn't.
  The PDP shows a blocked-placeholder Character slot (never falling back to
  `product.title`) plus `product.title` as its own always-visible line —
  see the Phase 4 PDP entry above. Franchise (`alterpop.franchise`) BLOCKED ->
  the meta slot is omitted and "Keep Exploring" shows a `[ franchise ]`
  placeholder + marked empty state (no product grid — can't pick the set
  without the field). Delivery window = `created_at + 8..13 calendar days`,
  a calendar approximation of `general.delivery_estimate` (24-48h dispatch +
  6-9 business days), with the canonical copy shown under it as the anchor.
  Club CTA -> `routes.account_register_url` (forward link — see the account
  pending item), hidden when `customer` is set. Reachable via the
  order-status "View order details" link + the confirmation email `?key=`
  token; no `/account` needed. **`a717245` is a faithful, complete copy of
  Dawn 16.0.0** — Dawn 16 itself ships NO `templates/customers/` and no
  `main-account`/`main-login`/`main-order` sections (Shopify dropped the
  classic Liquid customer templates once new customer accounts became the
  default; only `assets/customer.js` and the `customer.*` locale strings
  remain). So `main-order.liquid` + `order.liquid` here are net-new Alterpop
  files, not a restore.
- **Native "Thank you" / Order status page is not theme-editable** on Basic
  (Plus-only structural control; only the deprecated Additional Scripts box).
  The 4b page above is the order *detail* view (reached after the fact); the
  immediate post-purchase "Thank you" screen keeps Shopify's default until the
  store moves to Plus.
- **Customer-account area — NOT a build item (resolved).** The store runs
  `NEW_CUSTOMER_ACCOUNTS` (`customerAccounts=OPTIONAL`), hosted by Shopify at
  `account.alterpop.store`. That surface is not themeable and needs no theme
  files — login / register / profile / order history / addresses are all
  Shopify-hosted (branded only via checkout branding). Nothing to build, no
  pre-launch phase.
  - Header (`sections/header.liquid`) already uses the `<shopify-account>`
    web component when `shop.customer_accounts_enabled`, with an
    `href="{{ routes.account_url }}"` fallback. Mobile drawer uses
    `routes.account_url`. Footer has no account links. No hardcoded
    `/account` paths anywhere; `/account` 302s to the hosted portal.
  - `templates/customers/order.liquid` (the Phase 7 4b page) does NOT
    conflict: new accounts own `/account`, `/account/login`,
    `/account/register`, `/account/orders` (list), `/account/addresses`; the
    theme's classic template only ever renders the tokenised order-status URL
    `/account/orders/{id}?key={token}` from the order-status page and the
    confirmation email. If Shopify routes that URL to the hosted portal, the
    template just isn't hit — it intercepts no hosted route, so it can't
    break anything.
  - Dawn 16 ships no classic customer templates regardless (dropped upstream
    when new accounts became default); `customer.*` locale strings remain.
- **Primary market is Espanha (ES) — ADMIN pending, not code.** The store is
  Portuguese (billing address PT, currency EUR) but Settings -> Markets has
  **"España" as the primary market**; Portugal is only a secondary market.
  Shopify therefore defaults `localization.country` to Spain, so the mobile
  drawer country selector opens on "Spain | EUR €". The theme renders
  Shopify's value faithfully — nothing to fix in Liquid. Merchant decision
  in **Settings -> Markets** (set Portugal primary); affects hreflang, SEO
  and tax logic.
- **Mobile filter drawer** (Phase 6, wireframe 5b). The `.mobile-facets__*`
  restyle moved out of `universe-room.css` into shared
  `assets/facets-drawer.css`, loaded from `main-collection-product-grid.liquid`
  after `component-facets.css` — applies to the default collection template
  AND the Universe Room. `products.facets.clear_all` / `.apply` locales are
  now "Clear Filters" / "View Results" per 5b. Store has no Search &
  Discovery filters (same C1 caveat as Phase 3) — the drawer shows only
  Sort until they are configured in admin.
- **Legal pages** (Phase 8, wireframes 10a/10b/10c). One structure, three
  entry points: `sections/legal-page.liquid` + `templates/page.legal.json`
  for `page.*` legal pages (Cookie Policy, Shipping/Returns — assign the
  "Legal page" template per page in admin); `sections/main-policy.liquid` +
  `templates/policy.liquid` for native `/policies/*` (Terms, Privacy — the
  `policy` type does NOT support JSON templates, hence `.liquid`; `policy`
  is a valid global there, `theme-check-disable UndefinedObject` silences a
  false warning); `templates/page.contact.json` = `legal-page` header +
  `sections/legal-contact.liquid` (10c). All share `assets/legal-page.css`.
  Breadcrumb "Legal" is a plain label, not a link (no legal index page).
  "Last updated" is a section setting -> marked `DD Month YYYY` placeholder
  when unset; on `/policies/*` it is one shared value for all policies.
  Empty body -> marked placeholder. Legal copy itself is a marked
  placeholder pending lawyer review. Contact keeps Dawn's `{% form
  'contact' %}` contract; "Send Message" is `.ap-btn--secondary`. Company
  Identification repeats the footer's marked `[ … — a confirmar ]` fine
  print. Complaints Book is an external link to `livroreclamacoes.pt`
  (one click away, per PT law), never an internal page.
- **Cookie Consent Banner** (Phase 8). `snippets/cookie-banner.liquid` +
  `assets/cookie-banner.{css,js}`, rendered from `layout/theme.liquid`
  after `footer-group`, gated on `settings.cookie_banner_enabled` (new
  "Cookie consent" group in `settings_schema.json`, default on; also a
  `cookie_banner_policy_page` picker, falls back to `/pages/cookie-policy`).
  **Accept and Reject are STRICTLY equal weight — both `.ap-btn--secondary`,
  no Marigold anywhere** (that colour is purchase-CTA-only; asymmetry here
  is auditable under GDPR). Wired to Shopify's Customer Privacy API
  (`consent-tracking-api`): loads the feature, shows only when
  `shouldShowBanner()` / `shouldShowGDPRBanner()` is true, calls
  `setTrackingConsent({analytics,marketing,preferences,sale_of_data})` on
  choice, `localStorage['ap-cookie-consent']` mirror as fallback when the
  API is absent. Renders `hidden`; JS reveals with a bottom slide
  (`--motion-transactional`, `z-index: 90`).
- **OPEN QUESTION for the app side — how is the Character (and Line) field
  modelled?** A Shopify `page` has no product association, so the Character /
  Line page's product source hangs on this choice: a list-of-products
  metafield on the page? an auto-collection per character (then these become
  `collection.*` templates, not `page.*`)? a metaobject with a product
  reference list? The answer decides how much of Phase 5 wires up untouched:
  `catalogue-grid` / `catalogue-header` already read
  `page.metafields.alterpop.products` and fall back to a `collection`
  setting, so a list metafield or a per-page collection setting is a
  near-zero-change path; an auto-collection model means moving the templates
  to `collection.character.json` / `collection.line.json` and swapping
  `page.*` for `collection.*` in the two sections.

## Decisions taken in the absence of a wireframe page

- **Predictive-search results = a compact list** (thumbnail + title + price
  rows), NOT the full product card grid. The wireframe search pages (5c
  no-results, 5d empty/popular) never show a results-with-products state, and
  card spec 8a lists the card as used in "New Arrivals, Bestsellers, Universe
  Room, Gifts Under €25" — not search. `sections/predictive-search.liquid`.
- **Country / currency selector is NOT in the header.** Wireframe 6a ("nav
  restructure — universes-first, desktop") and 1b show the header actions as
  exactly: search icon · Account · Cart. No selector at any width. It was
  briefly kept in the desktop actions cluster, then removed to conform to 6a
  (the fixed-width control was also pushing the nav to wrap). It still lives
  in the mobile drawer. If desktop country switching is needed, the footer is
  the place — flagged for the designer.
- **Card status line height is reserved on every product card** (Available
  included) so the grid stays flush; the "N In Stock" pill / "Sold Out"
  label just fills the reserved slot. 8a shows the pill pushing the title
  down per-card; reserving the slot is the "clear improvement" the user
  approved for grid rhythm.
