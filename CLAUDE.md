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

- **Header curation collection handles** (Phase 1B) are best-guess and NOT yet
  verified against the store: `new-arrivals`, `limited-editions-exclusives`,
  `gifts-under-25`, `outlet` (used in `sections/header.liquid` +
  `snippets/mobile-drawer.liquid`). Confirm the real handles later; they do
  not come from the admin menu (shared with the live theme).
- **Footer link handles** (Phase 1D) not yet verified: `/pages/cookie-policy`
  and `/pages/contact` in `sections/footer.liquid` (no native Shopify policy
  for cookies; contact page handle assumed). Terms/Privacy use the standard
  `/policies/*` URLs (exist only if filled in admin).
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
  Height is live (`ociostock.dimensions`). Character falls back to
  `product.title` (honest, not inference). Line only shows with 3+ pieces of
  that line — not computable, so shown when the field is present; the Line
  slot collapses when absent, Universe/Franchise is never a substitute.
  Spec sheet License row uses `metafields.alterpop.license` -> raw
  `metafields.ociostock.licence`. Reviews read the Shopify Product Reviews
  app metafields (`metafields.reviews.rating` / `.rating_count`) — no app
  installed, marked empty state.
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
