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

## Wireframe is the pixel source of truth

`Wireframe_Alterpop_3_3.pdf` is in the repo root (ignored from the theme
upload). **Before building or reworking any section, render its wireframe
page(s) and follow them pixel-by-pixel** — proportions, type hierarchy,
spacing, element order. The phase prompts are summaries; the wireframe is
the source. Render with PyMuPDF (installed at `~/Library/Python/3.9`):

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
