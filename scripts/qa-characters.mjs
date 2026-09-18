#!/usr/bin/env node
/**
 * Alterpop — QA gate for Character Pages.
 *
 * Cross-checks what the Admin says exists against what the storefront serves.
 * Exits 1 on the first failed assertion, printing progress N/M up to that point.
 *
 * Auth: client credentials grant (Dev Dashboard app "Alterpop QA Read").
 * Legacy admin-created custom apps — and their static Admin API tokens — can no
 * longer be created, so there is no SHOPIFY_ADMIN_TOKEN. The app exchanges its
 * client id/secret for a 24h token at request time; nothing long-lived on disk.
 *
 * Usage: node scripts/qa-characters.mjs --host staging|live
 */

import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const API_VERSION = "2026-07";
const STORE_HOST = "www.alterpop.store";
const THEMES = { staging: "207846408522", live: "207355216202" };
const URL_HANDLE = "characters"; // metaobject definition onlineStore urlHandle
const SCAN_DIRS = ["sections", "snippets", "templates", "layout", "assets"];

// ---------------------------------------------------------------- plumbing

let passed = 0;
let total = 0;
const plan = [];

function assert(label, fn) {
  plan.push({ label, fn });
}

function fail(label, detail) {
  console.error(`\n  \u2717 ${label}`);
  console.error(`    ${detail}`);
  console.error(`\n${passed}/${total} asserções passaram antes da falha.`);
  process.exit(1);
}

function loadEnv() {
  const path = join(REPO, ".env");
  if (!existsSync(path)) {
    console.error(".env em falta — QA de personagens não corre.");
    process.exit(1);
  }
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
  for (const key of ["SHOPIFY_CLIENT_ID", "SHOPIFY_CLIENT_SECRET", "SHOPIFY_SHOP_DOMAIN"]) {
    if (!process.env[key]) {
      console.error(`${key} em falta — QA de personagens não corre.`);
      console.error("Nunca degrada para modo público: um gate que passa por falta de credencial é pior do que gate nenhum.");
      process.exit(1);
    }
  }
}

async function getToken() {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`Client credentials grant falhou (HTTP ${res.status}). Resposta: ${body.slice(0, 200)}`);
    process.exit(1);
  }
  const token = JSON.parse(body).access_token;
  if (!token) {
    console.error("Client credentials grant não devolveu access_token.");
    process.exit(1);
  }
  return token;
}

async function admin(token, query, variables = {}) {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    console.error(`Admin API devolveu erros: ${JSON.stringify(json.errors).slice(0, 400)}`);
    process.exit(1);
  }
  return json.data;
}

// ------------------------------------------------------------------ fetch

async function fetchAllCharacters(token) {
  const query = `
    query($cursor: String) {
      metaobjects(type: "character", first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          handle
          capabilities { publishable { status } }
          fields { key value }
        }
      }
    }`;
  const out = [];
  let cursor = null;
  do {
    const data = await admin(token, query, { cursor });
    out.push(...data.metaobjects.nodes);
    cursor = data.metaobjects.pageInfo.hasNextPage ? data.metaobjects.pageInfo.endCursor : null;
  } while (cursor);
  return out.map((n) => {
    const f = Object.fromEntries(n.fields.map((x) => [x.key, x.value]));
    const list = (v) => { try { return JSON.parse(v || "[]"); } catch { return []; } };
    return {
      id: n.id,
      handle: n.handle,
      status: n.capabilities.publishable.status,
      title: f.title || "",
      universe: list(f.universe),
      products: list(f.products),
    };
  });
}

async function fetchProductVisibility(token, ids) {
  if (!ids.length) return new Map();
  const query = `
    query($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product { id status publishedOnCurrentPublication }
      }
    }`;
  const map = new Map();
  for (let i = 0; i < ids.length; i += 200) {
    const data = await admin(token, query, { ids: ids.slice(i, i + 200) });
    for (const n of data.nodes) {
      if (n && n.id) map.set(n.id, n.status === "ACTIVE" && n.publishedOnCurrentPublication);
    }
  }
  return map;
}

async function fetchUniverseCharacterMetafields(token, ids) {
  if (!ids.length) return new Map();
  const query = `
    query($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Collection {
          id
          handle
          metafield(namespace: "alterpop", key: "characters") { value }
        }
      }
    }`;
  const map = new Map();
  for (let i = 0; i < ids.length; i += 200) {
    const data = await admin(token, query, { ids: ids.slice(i, i + 200) });
    for (const n of data.nodes) {
      if (!n || !n.id) continue;
      let refs = [];
      try { refs = JSON.parse(n.metafield?.value || "[]"); } catch { refs = []; }
      map.set(n.id, { handle: n.handle, characters: refs });
    }
  }
  return map;
}

// -------------------------------------------------------------- storefront

function curlHtml(path, themeId) {
  const jar = `/tmp/qa-characters-${process.pid}.txt`;
  const args = ["-sL", "-c", jar, "-b", jar, "-D", "-", "-w", "\\nHTTP_CODE:%{http_code}"];
  return execFileSync("curl", [...args, `https://${STORE_HOST}${path}${path.includes("?") ? "&" : "?"}nocache=${Date.now()}`], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

function primePreview(themeId) {
  const jar = `/tmp/qa-characters-${process.pid}.txt`;
  execFileSync("curl", ["-sL", "-c", jar, "-b", jar, "-o", "/dev/null",
    `https://alterpop.store/?preview_theme_id=${themeId}`], { encoding: "utf8" });
}

function parseResponse(raw) {
  const code = Number((raw.match(/HTTP_CODE:(\d+)\s*$/) || [])[1]);
  const split = raw.lastIndexOf("\r\n\r\n") >= 0 ? raw.lastIndexOf("\r\n\r\n") : raw.lastIndexOf("\n\n");
  const headers = raw.slice(0, split);
  const html = raw.slice(split).replace(/\nHTTP_CODE:\d+\s*$/, "");
  const timing = [...headers.matchAll(/server-timing:([^\r\n]*)/gi)].map((m) => m[1]).join(" ");
  return { code, html, timing };
}

function countCards(html) {
  return (html.match(/class="grid__item" data-line=/g) || []).length;
}

function metaLineCount(html) {
  const m = html.match(/data-ap-slot="figures-count"[^>]*>\s*([\d.,]+)\s+figure/);
  return m ? Number(m[1].replace(/[.,]/g, "")) : null;
}

function docTitle(html) {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m ? m[1].trim() : "";
}

function h1(html) {
  const m = html.match(/<h1[^>]*class="ap-character-header__title[^"]*"[^>]*>([^<]*)<\/h1>/i);
  return m ? m[1].trim() : "";
}

// ------------------------------------------------------------------- main

const hostArg = (() => {
  const i = process.argv.indexOf("--host");
  return i === -1 ? null : process.argv[i + 1];
})();

if (!hostArg || !THEMES[hostArg]) {
  console.error("--host é obrigatório: staging ou live. Sem valor por defeito.");
  process.exit(1);
}

loadEnv();

const themeId = THEMES[hostArg];
console.log(`QA de personagens — host ${hostArg} (tema ${themeId})\n`);

const token = await getToken();
const characters = await fetchAllCharacters(token);
const active = characters.filter((c) => c.status === "ACTIVE");
console.log(`  ${characters.length} entradas 'character' no Admin, ${active.length} ACTIVE.\n`);

const productIds = [...new Set(active.flatMap((c) => c.products))];
const visibility = await fetchProductVisibility(token, productIds);
const universeIds = [...new Set(active.flatMap((c) => c.universe))];
const universes = await fetchUniverseCharacterMetafields(token, universeIds);

primePreview(themeId);

// --- per-entry assertions
for (const c of active) {
  const tag = `[${c.handle}]`;
  const visibleProducts = c.products.filter((id) => visibility.get(id) === true);

  assert(`${tag} title preenchido`, () => {
    if (!c.title.trim()) throw new Error("title vazio na entrada ACTIVE");
  });

  assert(`${tag} universe com pelo menos uma coleção`, () => {
    if (!c.universe.length) throw new Error("campo universe vazio");
    for (const id of c.universe) {
      if (!universes.has(id)) throw new Error(`coleção ${id} não resolve no Admin`);
    }
  });

  assert(`${tag} products com pelo menos um produto`, () => {
    if (!c.products.length) throw new Error("campo products vazio — página pública sem nada para mostrar");
  });

  assert(`${tag} não é órfã no alterpop.characters do universo`, () => {
    const hit = c.universe.find((uid) => (universes.get(uid)?.characters || []).includes(c.id));
    if (!hit) {
      const list = c.universe.map((uid) => universes.get(uid)?.handle || uid).join(", ");
      throw new Error(`entrada ACTIVE ausente do metafield alterpop.characters de todas as suas coleções (${list}) — URL público sem caminho de navegação`);
    }
  });

  assert(`${tag} rota /pages/${URL_HANDLE}/${c.handle} serve o tema pedido`, () => {
    const r = parseResponse(curlHtml(`/pages/${URL_HANDLE}/${c.handle}`, themeId));
    if (r.code !== 200) throw new Error(`HTTP ${r.code}, esperado 200`);
    if (r.timing && !r.timing.includes(themeId)) {
      throw new Error(`server-timing não refere o tema ${themeId}: ${r.timing.slice(0, 160)}`);
    }
    c._html = r.html;
  });

  assert(`${tag} H1 com o título`, () => {
    const got = h1(c._html);
    if (got.toUpperCase() !== c.title.toUpperCase()) {
      throw new Error(`H1 "${got}" != title "${c.title}"`);
    }
  });

  assert(`${tag} <title> com o nome, não o handle`, () => {
    const t = docTitle(c._html);
    if (!t.toLowerCase().includes(c.title.toLowerCase())) {
      throw new Error(`<title> "${t}" não contém "${c.title}"`);
    }
    if (t.includes(c.handle) && c.handle !== c.title) {
      throw new Error(`<title> "${t}" ainda mostra o handle — renderable/metaTitleKey partido`);
    }
  });

  assert(`${tag} zero Liquid error`, () => {
    if (/Liquid error/i.test(c._html)) throw new Error("HTML contém 'Liquid error'");
  });

  assert(`${tag} cards servidos == produtos visíveis no Admin`, () => {
    const cards = countCards(c._html);
    if (cards !== visibleProducts.length) {
      throw new Error(`${cards} cards no HTML, ${visibleProducts.length} produtos visíveis no Admin`);
    }
  });

  assert(`${tag} meta line == cards`, () => {
    const cards = countCards(c._html);
    const meta = metaLineCount(c._html);
    if (cards === 0) {
      if (meta !== null) throw new Error("zero cards mas a meta line renderizou");
      return;
    }
    if (meta !== cards) throw new Error(`meta line diz ${meta}, grelha tem ${cards} cards`);
  });
}

// --- global assertions
assert("entrada de teste qa-dead-ref não está ACTIVE", () => {
  const t = characters.find((c) => c.handle === "qa-dead-ref");
  if (t && t.status === "ACTIVE") {
    throw new Error("qa-dead-ref voltou a ACTIVE — dado de teste exposto ao público");
  }
});

assert("rota /characters/<handle> continua 404", () => {
  const sample = active[0];
  if (!sample) return;
  const r = parseResponse(curlHtml(`/${URL_HANDLE}/${sample.handle}`, themeId));
  if (r.code !== 404) throw new Error(`HTTP ${r.code}, esperado 404`);
});

assert("nenhum href /characters/ sem /pages/ no tema", () => {
  let hits = "";
  try {
    hits = execFileSync("grep", ["-rn", "-E", "[\"'(]/characters/", ...SCAN_DIRS], {
      cwd: REPO, encoding: "utf8",
    });
  } catch (e) {
    if (e.status === 1) return; // grep: no match
    throw e;
  }
  const bad = hits.split("\n").filter((l) => l.trim() && !l.includes("/pages/characters/"));
  if (bad.length) {
    throw new Error(`URL de metaobject escrito à mão:\n    ${bad.join("\n    ")}`);
  }
});

// --- run
total = plan.length;
for (const { label, fn } of plan) {
  try {
    await fn();
  } catch (e) {
    fail(label, e.message);
  }
  passed += 1;
  process.stdout.write(`  \u2713 ${String(passed).padStart(String(total).length)}/${total}  ${label}\n`);
}

console.log(`\n${passed}/${total} asserções passaram. QA verde contra ${hostArg}.`);
