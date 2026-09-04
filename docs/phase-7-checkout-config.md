# Phase 7 — Checkout & Order Confirmation: configuration notes

Wireframes 4a (checkout mobile), 4b (order confirmation), 4c (checkout desktop).

**Scope reminder.** On Shopify **Basic**, checkout is not a theme surface. There
is no `checkout.liquid`, no Checkout UI Extensions, no editable Thank-you /
Order-status page — those are **Shopify Plus**. Everything below is either
*checkout-editor branding*, *Shipping settings*, or a *Shopify Function*. The
only real theme pages in this phase are the **cart page** (`/cart`, built) and,
blocked, the customer order page (see §4).

---

## 1. Checkout editor — branding checklist

Admin → **Settings → Checkout → Customize** (Branding). Apply:

| Control | Value | Token |
|---|---|---|
| Logo | `lockup-horizontal-ink.svg`, **left-aligned**, ~120 px | — |
| Logo position | **Left** (not centered) | see divergence D1 |
| Accent / primary button | `#FFB800` | `--color-marigold` |
| Button label text | `#121014` | `--color-ink-900` |
| Background | `#F7F6F2` | `--color-canvas` |
| Form / section surface | `#FBFAF7` | `--color-surface` |
| Body text | `#121014` | `--color-ink-900` |
| Secondary / muted text | `#6E6A63` | `--color-text-muted` |
| Borders | `#D9D7D0` | `--color-border` |
| Error | `#8A5410` on `#F3E7D6` | `--color-fragile-ink` / `--color-fragile-bg` |
| Global corner radius | **4 px** | `--radius-sm` |
| Headings typeface | nearest available to **Hanken Grotesk** (see D2) | — |
| Body typeface | nearest available to **Inter** (see D2) | — |
| Favicon | existing store favicon | — |

Checkout-editor font picker offers a fixed Shopify list + any fonts already
uploaded to the store's theme/Branding. If Hanken Grotesk / Inter can be
uploaded there, use them; otherwise pick the closest grotesque (headings) and
the closest neutral sans (body) and record the choice here.

### Divergences from the wireframe — deliberate, not oversights

- **D1 — Logo centered (4a) → we use left.** Coherent with the site header
  (wireframe 6a). Confirmed by the user.
- **D2 — Hanken Grotesk / Inter may be unavailable in checkout.** The editor
  only serves its own font list + store-uploaded fonts. If neither can be
  uploaded, checkout runs on the nearest substitutes. Accept the small
  type mismatch vs. the rest of the site.
- **D3 — Asymmetric brand corner on the Checkout button is impossible.** The
  editor exposes **one global corner radius**, applied uniformly to every
  control. The `0 6px 6px 6px` corner (site primary-CTA family) cannot be
  reproduced; checkout buttons get the plain 4 px radius.
- **D4 — "Add Protective Shipping for the Fragile Item · €3.90" in-checkout
  checkbox is impossible.** A line-item add-on toggle inside checkout needs a
  Checkout UI Extension (Plus). Delivered instead as a conditional shipping
  rate — see §2.
- **D5 — Authenticity seal / "handled with care" notices have no slot.** Native
  checkout has no content block for editorial reassurance. Lives on the PDP and
  cart page only.
- **D6 — "Continue as Guest / Log In", "Cart Summary ⌄", the exact field set
  (name / zip / city), payment button order (Apple Pay / Google Pay / Pay by
  Card / Klarna·PayPal 3×)** are all **checkout-managed**. Shopify decides
  layout, field order, express-wallet placement and the accelerated-checkout
  set from the store's payment configuration. Treat 4a's form as
  *representative*, not spec.

---

## 2. Shipping settings + the Protective Shipping function

### 2a. Rates — Admin → Settings → Shipping and delivery

Domestic (Portugal) + EU zones, two rates whose **names carry the wireframe
copy verbatim** (the name is the only place this text can live in native
checkout):

- **`Standard · dispatched in 24–48h · arrives in 6–9 business days`** —
  price **Free** (flat €0), or free over €50 with a price-based condition to
  match the site's free-shipping bar threshold.
- **`Express · 3–4 business days`** — price **€6.90**.

Keep the Standard name in sync with `general.delivery_estimate` in
`locales/en.default.json` (`dispatched in 24–48h · arrives in 6–9 business
days`). If the estimate copy changes, change it in both places.

### 2b. Protective Shipping — Delivery Customization function (Basic-compatible)

Goal: an extra **€3.90** shipping option that appears **only when the cart
contains a fragile / collector's-piece item**.

- **Mechanism:** a **Shopify Function** of type *Delivery Customization* (or a
  *Shipping Discount / Delivery Option Generator* depending on the current
  Functions API). Functions run on **all plans**, Basic included. It is **not**
  an in-checkout checkbox (D4) — it conditionally **adds or renames a delivery
  option** at checkout: e.g. surface a
  `Standard + Protective Packaging · €3.90` option (and/or hide plain Standard)
  when the condition is met.
- **Condition input — the per-SKU `alterpop.fragile` field (BLOCKED, see
  CLAUDE.md).** The function reads each cart line's
  `merchandise.product.metafield(namespace:"alterpop", key:"fragile")`; if any
  line is `true`, the protective option is offered. Until that metafield
  exists the function has nothing to key on — **do not ship the function
  before the field exists**, or it will offer protective shipping on
  everything or nothing.
- **Same flag drives the PDP fragile notice.** As of Phase 7 the PDP notice is
  `{% if ap_fragile %}` only (decoupled from the Premium tier). One field, two
  consumers: PDP notice + this function.
- **Fallback until the field lands:** ship only the flat Standard/Express
  rates. No protective option. The PDP notice stays hidden. Document the gap;
  don't fake it from tier or tags.

### 2c. Delivery estimates — Admin → Settings → Shipping → *Show estimated
delivery dates* (optional)

If enabled, set processing time **1–2 business days** and transit **6–9
business days** for Standard so Shopify's own estimate matches the rate name.

---

## 3. Payments (context, no build)

Enable in Settings → Payments: Shopify Payments (cards) + Apple Pay + Google
Pay (accelerated), PayPal, and Klarna if contracted (the "pay in 3×" line in
4a). Button order and the "or" divider are checkout-rendered — not
configurable.

---

## 4. Order confirmation (4b) — BLOCKED

**This theme has no customer-account templates at all.** `templates/customers/`
is absent — verified at the Dawn baseline `a717245` and at HEAD. Missing:
`order`, `account`, `login`, `register`, `addresses`, `reset_password`,
`activate_account`, plus their `main-*` sections.

Consequences:

- There is no `templates/customers/order.liquid` to restyle into 4b.
- There is no `/account` area, so even a standalone order template would only
  be reachable via the order-status page's "View order details" link and the
  confirmation-email link.
- The native **Thank-you / Order-status page** itself is **not theme-editable
  on Basic** (Plus-only). So the 4b extras — estimated-delivery line
  ("between Oct 12 and Oct 16"), "Keep Exploring [franchise]" thumbnails,
  "Create an Account & Join the Collectors Club →" CTA — have **no host**
  on the current plan without the customer order template.

**Decision needed before 4b proceeds** (its own phase):

1. **Standalone order template.** Add `templates/customers/order.liquid` +
   `sections/main-order.liquid` only, styled per 4b, reachable via the
   order-status "View order" link + email. Leave `/account` unbuilt (Shopify
   serves its generic fallback). Smallest surface; the 4b content lives here.
2. **Full customer-account set.** Restore + style `login`, `register`,
   `account`, `order`, `addresses`, `reset_password`, `activate_account`.
   Larger; gives a coherent logged-in area and a real path to orders.
3. **Defer entirely** until the store is on Plus and the Thank-you page
   becomes editable.

Recommendation: **(1)** — it delivers the wireframe's post-purchase artifact
with the least scope, and (2) can layer on later.

---

## 5. What was built in Phase 7

- **`/cart` page** — `sections/main-cart-items.liquid` +
  `sections/main-cart-footer.liquid` restyled to the wireframe 1d cart-drawer
  language; new `assets/cart-page.css`; Dawn `cart.js` contract kept intact.
  Free-shipping line + bar, franchise · dimension meta line, delivery-estimate
  caption, Marigold Checkout (`.ap-btn--primary`, plain radius), empty state.
- **`general.delivery_estimate`** — single locale key for the unified copy;
  PDP (`sections/main-product.liquid`) and the cart page both read it; the old
  `sections.pdp.dispatch` key was removed.
- **PDP fragile notice decoupled** — `{% if ap_fragile %}` only; hidden while
  `alterpop.fragile` (own field, distinct from `alterpop.tier`) does not
  exist. Added to the app backlog in CLAUDE.md.

## 6. App-side backlog surfaced by this phase

- **`metafields.alterpop.fragile`** — per-SKU boolean. Distinct from
  `alterpop.tier`. Drives: PDP fragile notice + the Protective Shipping
  Delivery Customization function. Blocks §2b.
- Confirm whether **Hanken Grotesk / Inter** can be uploaded to the checkout
  Branding font store (resolves D2).
- Plan decision on the **customer order template** (§4).
