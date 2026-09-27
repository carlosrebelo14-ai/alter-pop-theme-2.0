#!/usr/bin/env python3
"""Regenerate the Universe Room cover contact sheet.

All universe-room collections, desktop band only, cropped to the band,
4 per row, labelled with handle. Composited from the real uploaded logo
files + real cover photos + the actual CSS layout values this theme uses
(shape boxes, the mono filter, the scrim gradient, the marigold eyebrow,
the title-card suppression rule) -- not a live screenshot. The Browser
pane tool this theme is normally verified with has no way to save a
screenshot to disk in a Claude Code session, so this reproduces the same
render logic as sections/universe-room-header.liquid /
assets/universe-room.css directly instead. Requires PyMuPDF
(`pip install pymupdf`).

Two inputs, both required:

1. --manifest (default logos/manifest.json, committed in this repo).
   Supplies, per handle that has a real uploaded logo: shape
   (wide|normal|tall) and mono (bool). This is the durable audit trail
   from the import and does not need re-fetching.

2. --covers-data: a JSON file YOU build fresh each run, shaped
   { "<handle>": {"title": str, "cover_url": str|null,
                  "has_title": bool, "credit": str|null}, ... }
   Title, cover image, and custom.universe_cover_has_title all change
   independently of the logo import and aren't tracked in manifest.json
   -- there is no shortcut around re-fetching them live. One batched
   Admin GraphQL query, aliasing collectionByHandle per handle
   (alias = "h_" + handle.replace("-", "_")):

       query {
         h_attack_on_titan: collectionByHandle(handle: "attack-on-titan") {
           title
           image { url }
           metafield(namespace: "custom", key: "universe_cover_has_title") {
             value
           }
           credit: metafield(namespace: "custom", key: "universe_credit") {
             value
           }
         }
         ... one alias per handle ...
       }

   then reshape the response into the shape above (metafield value for
   a boolean comes back as the string "true"/"false" -- compare against
   "true", don't treat it as already-boolean).

--assets-dir must contain the actual files to draw:
  - "<handle>.<ext>" for every handle with a manifest entry -- the exact
    file uploaded to custom.universe_logo. Get its URL from
    `node(id: "<file_id from manifest.json>") { ... on GenericFile { url }
    ... on MediaImage { image { url } } }` and download it.
  - "cover_<handle>.png" for every handle whose covers-data has a
    cover_url -- just curl that URL.

Nothing here reaches Shopify itself; this script only draws. Data
collection is a separate step you run first (matching how the sheet was
actually built: batched GraphQL queries + curl, documented in CLAUDE.md
under "Universe Logos").

KNOWN LIMITATION (found 25/09/2026, unresolved): PyMuPDF's own SVG
rasterizer garbles some files that have many <clipPath>/<mask>/<filter>
elements -- confirmed on studio-ghibli's and pokemon-universe's logos
(both ~70 such elements), reproduced in isolation outside this script's
compositing code, at multiple dpi/matrix settings, so it's not something
tunable here. Both files are actually fine -- verified by navigating a
real browser straight to the file's own CDN URL. If a cell in the sheet
looks wrong (garbled text, a solid-colour box where a logo should be,
anything that doesn't match the live site), don't trust the sheet for
that cell -- open the logo file's URL directly in a browser instead
before concluding there's a real content problem. No known fix; a PR to
PyMuPDF or swapping the SVG for a lower-complexity export would both
work, neither attempted here.
"""
import argparse
import json
import math
import os
import sys

import fitz

CW, CH = 620, 210    # cell size (~2.95:1, approximating the real desktop band)
LABEL_H = 26          # handle label strip above each cell
PAD_X = 12            # scaled --space-xl (24px @ 1280px reference width)
PAD_TOP = 30          # scaled --space-4xl
PAD_BOTTOM = 15       # scaled --space-2xl
COLS = 4
GAP = 6

INK_900 = (0x12 / 255, 0x10 / 255, 0x14 / 255)
CANVAS = (247 / 255, 246 / 255, 242 / 255)
EYEBROW_OPACITY = 0.64  # matches .ap-uroom-header__eyebrow (25/09/2026: no
                         # longer marigold -- that token is purchase-CTA-only
                         # per the DS, same muted treatment as the credit line)

SCALE = CW / 1280.0
# desktop max box per shape bucket (universe-room.css @ >=990px), scaled to cell size
SHAPE_BOX = {
    "wide": (280 * SCALE, 48 * SCALE),
    "normal": (240 * SCALE, 64 * SCALE),
    "tall": (128 * SCALE, 96 * SCALE),
}


def render_svg(path, target_w_px):
    doc = fitz.open(path)
    page = doc[0]
    rect = page.rect
    zoom = target_w_px / rect.width if rect.width else 1
    return page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=True)


def load_logo_pixmap(path):
    if path.endswith(".svg"):
        # render at a fixed working resolution; final placement rescales via insert_image
        return render_svg(path, target_w_px=600)
    pix = fitz.Pixmap(path)
    if pix.alpha == 0:
        pix = fitz.Pixmap(pix, 1)
    return pix


def make_mono_white(pix):
    """Emulate the CSS filter: brightness(0) invert(1) -- every opaque pixel
    becomes white, alpha untouched. Matches .ap-uroom-header__logo--mono."""
    if pix.alpha == 0:
        pix = fitz.Pixmap(pix, 1)
    n = pix.n
    samples = bytearray(pix.samples)
    stride = pix.stride
    for y in range(pix.height):
        row = y * stride
        for x in range(pix.width):
            off = row + x * n
            samples[off] = 255
            samples[off + 1] = 255
            samples[off + 2] = 255
    return fitz.Pixmap(pix.colorspace, pix.width, pix.height, bytes(samples), pix.alpha)


def draw_gradient_scrim(page, rect):
    """Approximate universe-room.css's desktop scrim:
    linear-gradient(90deg, rgba(18,16,20,.84) 0%, .4 44%, 0 70%)."""
    steps = 24
    x0, y0, x1, y1 = rect
    w = x1 - x0
    stops = [(0.0, 0.84), (0.44, 0.4), (0.70, 0.0), (1.0, 0.0)]

    def opacity_at(f):
        for j in range(len(stops) - 1):
            a, oa = stops[j]
            b, ob = stops[j + 1]
            if a <= f <= b:
                t = (f - a) / (b - a) if b > a else 0
                return oa + (ob - oa) * t
        return stops[-1][1]

    for i in range(steps):
        f0, f1 = i / steps, (i + 1) / steps
        op = opacity_at((f0 + f1) / 2)
        if op <= 0.01:
            continue
        band = fitz.Rect(x0 + w * f0, y0, x0 + w * f1, y1)
        page.draw_rect(band, color=None, fill=INK_900, fill_opacity=op, overlay=True)


def draw_cover_background(page, band, cover_path):
    """object-fit: cover, via an isolated sub-page sized exactly to the
    band: overflow the image past all four edges of THAT page and let its
    own boundary clip it, then drop the rendered result into the cell.
    (Pixmap.copy()-based manual cropping corrupted output on the PyMuPDF
    build this was built against -- this sidesteps pixel copying entirely.
    A sub-page, not the cell page, guarantees vertical overflow can never
    bleed into the label strip above the band.)"""
    pix = fitz.Pixmap(cover_path)
    if pix.alpha == 0:
        pix = fitz.Pixmap(pix, 1)
    crop_doc = fitz.open()
    crop_page = crop_doc.new_page(width=band.width, height=band.height)
    band_ratio = band.width / band.height
    img_ratio = pix.width / pix.height
    if img_ratio > band_ratio:
        draw_h = band.height
        draw_w = draw_h * img_ratio
        x0, y0 = -(draw_w - band.width) / 2, 0
    else:
        draw_w = band.width
        draw_h = draw_w / img_ratio
        x0, y0 = 0, -(draw_h - band.height) / 2
    crop_page.insert_image(fitz.Rect(x0, y0, x0 + draw_w, y0 + draw_h), pixmap=pix)
    cropped_pix = crop_page.get_pixmap(matrix=fitz.Matrix(2, 2))
    page.insert_image(band, pixmap=cropped_pix)
    crop_doc.close()


def make_cell(cell_doc, handle, entry, assets_dir):
    page = cell_doc.new_page(width=CW, height=CH + LABEL_H)
    page.insert_text((4, 16), handle, fontsize=11, color=(0.7, 0, 0), fontname="hebo")

    band = fitz.Rect(0, LABEL_H, CW, LABEL_H + CH)
    cover_path = os.path.join(assets_dir, f"cover_{handle}.png")
    if entry["cover_url"] and os.path.exists(cover_path):
        draw_cover_background(page, band, cover_path)
    else:
        page.draw_rect(band, color=None, fill=INK_900, fill_opacity=1, overlay=True)

    draw_gradient_scrim(page, (band.x0, band.y0, band.x1, band.y1))

    left = band.x0 + PAD_X
    top = band.y0 + PAD_TOP

    # Mirror sections/universe-room-header.liquid exactly: the corner logo
    # is suppressed when the cover already bakes the title in (and a photo
    # is actually bound) -- the H1 stays hidden either way, since either
    # the logo or the cover art itself is "the visible name" in that case.
    suppress_logo = bool(entry["has_title"]) and bool(entry["cover_url"])
    render_logo = bool(entry["has_logo"]) and not suppress_logo
    hide_heading = render_logo or suppress_logo

    page.insert_text((left, top + 4), "UNIVERSE", fontsize=7, color=CANVAS, fill_opacity=EYEBROW_OPACITY, fontname="hebo")

    if render_logo:
        bw, bh = SHAPE_BOX[entry["shape"]]
        logo_path = os.path.join(assets_dir, entry["logo_file"])
        try:
            pix = load_logo_pixmap(logo_path)
            if entry["mono"]:
                pix = make_mono_white(pix)
            img_ratio = pix.width / pix.height
            box_ratio = bw / bh
            if img_ratio > box_ratio:
                w, h = bw, bw / img_ratio
            else:
                h, w = bh, bh * img_ratio
            logo_rect = fitz.Rect(left, band.y1 - PAD_BOTTOM - h, left + w, band.y1 - PAD_BOTTOM)
            page.insert_image(logo_rect, pixmap=pix)
        except Exception as ex:  # keep going -- one bad asset shouldn't kill the whole sheet
            page.insert_text((left, band.y1 - PAD_BOTTOM - 10), f"[logo err: {ex}]", fontsize=6, color=(1, 0, 0))
    elif not hide_heading:
        page.insert_text((left, top + 30), entry["title"], fontsize=16, color=CANVAS, fontname="hebo")

    if entry.get("credit"):
        page.insert_text((left, band.y1 - 4), entry["credit"], fontsize=5, color=CANVAS, fontname="helv")

    return page


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--manifest", default="logos/manifest.json")
    ap.add_argument("--covers-data", required=True, help="see module docstring for the shape/how-to-fetch")
    ap.add_argument("--assets-dir", required=True, help="dir with cover_<handle>.png and <handle>.<ext> logo files")
    ap.add_argument("--out", default="contact_sheet.png")
    args = ap.parse_args()

    with open(args.manifest) as f:
        manifest = json.load(f)
    logos_by_handle = {e["handle"]: e for e in manifest["logos"]}

    with open(args.covers_data) as f:
        covers_data = json.load(f)

    handles = sorted(covers_data.keys())
    if not handles:
        sys.exit("--covers-data has no handles")

    entries = {}
    for h in handles:
        cd = covers_data[h]
        logo = logos_by_handle.get(h)
        entries[h] = {
            "title": cd.get("title", h),
            "cover_url": cd.get("cover_url"),
            "has_title": cd.get("has_title", False),
            "credit": cd.get("credit"),
            "has_logo": logo is not None,
            "shape": logo["shape"] if logo else "normal",
            "mono": logo["mono"] if logo else False,
            "logo_file": None,
        }
        if logo:
            for ext in ("svg", "png"):
                cand = f"{h}.{ext}"
                if os.path.exists(os.path.join(args.assets_dir, cand)):
                    entries[h]["logo_file"] = cand
                    break
            if not entries[h]["logo_file"]:
                print(f"warning: {h} has a manifest logo entry but no asset file found", file=sys.stderr)
                entries[h]["has_logo"] = False

    cell_doc = fitz.open()
    rows_needed = math.ceil(len(handles) / COLS)
    sheet_doc = fitz.open()
    sheet_page = sheet_doc.new_page(
        width=COLS * (CW + GAP),
        height=rows_needed * (CH + LABEL_H + GAP),
    )

    for i, h in enumerate(handles):
        cell_page = make_cell(cell_doc, h, entries[h], args.assets_dir)
        pix = cell_page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        r, c = divmod(i, COLS)
        x0, y0 = c * (CW + GAP), r * (CH + LABEL_H + GAP)
        sheet_page.insert_image(fitz.Rect(x0, y0, x0 + CW, y0 + CH + LABEL_H), pixmap=pix)

    final = sheet_page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5))
    final.save(args.out)
    print(f"saved {args.out} ({final.width}x{final.height}, {len(handles)} handles)")


if __name__ == "__main__":
    main()
