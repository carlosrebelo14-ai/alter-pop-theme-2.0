#!/usr/bin/env node
/**
 * Deploy do tema Alterpop com o registo escrito NO MESMO PASSO do push.
 *
 * Porquê: a 18/09/2026 o live foi encontrado dois commits à frente de
 * docs/DEPLOY.md (27183d6, 425a06f) — o registo dependia de alguém o escrever
 * a mão depois do push. Aqui o registo e o push são o mesmo comando: se o push
 * falha não se regista nada, e se o push passa o registo é commitado logo.
 *
 * Limite honesto: um `shopify theme push` feito a mão continua a ser possível
 * (o CLI não se deixa bloquear a partir do repo). O que este comando garante é
 * que esse desvio é APANHADO no deploy seguinte — o drift check compara o live
 * com o commit registado em LIVE_DEPLOYED_AT e recusa avançar se divergirem.
 *
 * Uso:
 *   node scripts/deploy-theme.mjs staging [--dry-run]
 *   node scripts/deploy-theme.mjs live --rollback <theme-id> [--dry-run]
 *
 * --dry-run corre todos os pré-requisitos, lista cada um com ✓/✗ e não empurra
 * nem regista nada. Sem --dry-run, pára na primeira falha.
 *
 * Sem dependências. Node >= 18, git e Shopify CLI no PATH.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const STORE = "jyr17t-wr.myshopify.com";
const TARGETS = {
  staging: { id: "207846408522", field: "STAGING_SYNCED_AT" },
  live: { id: "207355216202", field: "LIVE_DEPLOYED_AT" },
};
const THEME_DIRS = ["assets", "config", "layout", "locales", "sections", "snippets", "templates"];
const DEPLOY_MD = "docs/DEPLOY.md";

// ---------------------------------------------------------------- utilidades

const args = process.argv.slice(2);
const target = args[0];
const dryRun = args.includes("--dry-run");
const rollbackId = args.includes("--rollback") ? args[args.indexOf("--rollback") + 1] : null;

function die(msg) {
  console.error(`\nERRO: ${msg}`);
  process.exit(1);
}

if (!TARGETS[target]) die("uso: deploy-theme.mjs <staging|live> [--rollback <id>] [--dry-run]");
if (target === "live" && !rollbackId) die("live exige --rollback <id do rollback novo, duplicado do live atual>");

const run = (cmd, argv, opts = {}) =>
  execFileSync(cmd, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();

const root = run("git", ["rev-parse", "--show-toplevel"]);
process.chdir(root);

const deployMd = () => readFileSync(DEPLOY_MD, "utf8");
const readField = (name) => deployMd().match(new RegExp(`^${name}\\s*=\\s*(.*)$`, "m"))?.[1] ?? "";
const today = new Date().toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });

// Em --dry-run cada verificação regista ✓/✗ e segue; sem --dry-run a primeira falha aborta.
let failures = 0;
function check(name, fn) {
  try {
    const detail = fn();
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (err) {
    failures++;
    console.log(`  ✗ ${name}\n      ${String(err.message).split("\n").join("\n      ")}`);
    if (!dryRun) die(`pré-requisito falhou: ${name}`);
  }
}

// ---------------------------------------------- comparação normalizada (drift)

/** JSON de tema: remove o bloco /* ... *\/ inicial que o `theme pull` acrescenta. */
const parseThemeJson = (text) => JSON.parse(text.replace(/^\s*\/\*[\s\S]*?\*\//, ""));

/** `"settings": {}` ausente ≡ vazio — falso positivo conhecido (ver DEPLOY.md, drift check). */
function normalize(v) {
  if (Array.isArray(v)) return v.map(normalize);
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) {
      const n = normalize(v[k]);
      if (k === "settings" && n && typeof n === "object" && !Object.keys(n).length) continue;
      out[k] = n;
    }
    return out;
  }
  return v;
}

function listFiles(base) {
  const out = new Map();
  for (const d of THEME_DIRS) {
    const walk = (dir) => {
      let entries = [];
      try {
        entries = readdirSync(join(base, dir), { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const rel = join(dir, e.name);
        if (e.isDirectory()) walk(rel);
        else out.set(rel, join(base, rel));
      }
    };
    walk(d);
  }
  return out;
}

function themeDiff(baseA, baseB) {
  const A = listFiles(baseA);
  const B = listFiles(baseB);
  const diffs = [];
  for (const k of new Set([...A.keys(), ...B.keys()])) {
    if (!A.has(k)) diffs.push(`só no live: ${k}`);
    else if (!B.has(k)) diffs.push(`só no git: ${k}`);
    else if (k.endsWith(".json")) {
      const a = JSON.stringify(normalize(parseThemeJson(readFileSync(A.get(k), "utf8"))));
      const b = JSON.stringify(normalize(parseThemeJson(readFileSync(B.get(k), "utf8"))));
      if (a !== b) diffs.push(`JSON diferente: ${k}`);
    } else if (!readFileSync(A.get(k)).equals(readFileSync(B.get(k)))) diffs.push(`conteúdo diferente: ${k}`);
  }
  return diffs.sort();
}

// --------------------------------------------------------- pré-requisitos

const sha = run("git", ["rev-parse", "--short", "HEAD"]);
console.log(`Deploy ${target} — HEAD ${sha}${dryRun ? "  (dry-run: nada é empurrado nem registado)" : ""}\n`);

check("working tree limpa (ficheiros seguidos)", () => {
  const dirty = run("git", ["status", "--porcelain", "--untracked-files=no"]);
  if (dirty) throw new Error(`alterações por commitar:\n${dirty}`);
});

if (target === "live") {
  check("branch main, igual a origin/main", () => {
    const branch = run("git", ["branch", "--show-current"]);
    if (branch !== "main") throw new Error(`estás em "${branch}", o live só recebe main`);
    run("git", ["fetch", "origin"]);
    const [h, o] = [run("git", ["rev-parse", "HEAD"]), run("git", ["rev-parse", "origin/main"])];
    if (h !== o) throw new Error(`HEAD ${h.slice(0, 7)} ≠ origin/main ${o.slice(0, 7)} — faz push primeiro`);
  });

  check("tema em HEAD igual ao que foi para o staging", () => {
    const staged = readField("STAGING_SYNCED_AT").match(/^[0-9a-f]{7,40}/)?.[0];
    if (!staged) throw new Error("STAGING_SYNCED_AT ilegível em docs/DEPLOY.md");
    try {
      run("git", ["diff", "--quiet", staged, "HEAD", "--", ...THEME_DIRS]);
    } catch {
      throw new Error(`os ficheiros de tema em HEAD diferem de ${staged} (STAGING_SYNCED_AT) — empurra e valida o staging primeiro`);
    }
    return `staging em ${staged}`;
  });

  let rollbackName = "";
  check(`rollback ${rollbackId} existe, é novo e não é o registado`, () => {
    const themes = JSON.parse(run("shopify", ["theme", "list", "--store", STORE, "--json"]));
    const t = themes.find((x) => String(x.id) === String(rollbackId));
    if (!t) throw new Error(`tema ${rollbackId} não existe na loja`);
    if (t.role !== "unpublished" || !/^ROLLBACK/i.test(t.name)) throw new Error(`"${t.name}" (${t.role}) não é um tema ROLLBACK não publicado`);
    const previous = readField("ROLLBACK_ACTIVE").match(/^\d+/)?.[0];
    if (previous === String(rollbackId)) throw new Error(`${rollbackId} é o rollback já registado — duplica o live atual para um novo`);
    rollbackName = t.name;
    return t.name;
  });

  check("drift: live igual ao commit registado em LIVE_DEPLOYED_AT", () => {
    const recorded = readField("LIVE_DEPLOYED_AT").match(/^[0-9a-f]{7,40}/)?.[0];
    if (!recorded) throw new Error("LIVE_DEPLOYED_AT ilegível em docs/DEPLOY.md");
    const tmp = mkdtempSync(join(tmpdir(), "ap-drift-"));
    try {
      const livePath = join(tmp, "live");
      const gitPath = join(tmp, "git");
      run("mkdir", ["-p", livePath, gitPath]);
      run("shopify", ["theme", "pull", "--store", STORE, "--theme", TARGETS.live.id, "--path", livePath]);
      execFileSync("sh", ["-c", `git archive ${recorded} ${THEME_DIRS.join(" ")} | tar -x -C "${gitPath}"`]);
      const diffs = themeDiff(gitPath, livePath);
      if (diffs.length) throw new Error(`o live diverge de ${recorded} — push feito fora do registo?\n${diffs.join("\n")}`);
      return `live == ${recorded}`;
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  check("QA de personagens contra o staging (scripts/qa-characters.mjs)", () => {
    if (dryRun) return "não corrido em dry-run";
    const r = spawnSync("node", ["scripts/qa-characters.mjs", "--host", "staging"], { stdio: "inherit" });
    if (r.status !== 0) throw new Error("o QA de staging não saiu verde");
  });
}

if (dryRun) {
  console.log(failures ? `\n${failures} pré-requisito(s) em falta. Nada foi empurrado.` : "\nTodos os pré-requisitos cumpridos. Nada foi empurrado.");
  process.exit(failures ? 1 : 0);
}

// ---------------------------------------------------------- push + registo

const { id, field } = TARGETS[target];
console.log(`\nPush de ${sha} para o tema ${id}…`);
const pushArgs = ["theme", "push", "--store", STORE, "--theme", id, ...(target === "live" ? ["--allow-live"] : [])];
const push = spawnSync("shopify", pushArgs, { stdio: "inherit" });
if (push.status !== 0) die("shopify theme push falhou — NADA foi registado.");

const lines = [`${field.padEnd(19)} = ${sha} (${today})`];
let md = deployMd().replace(new RegExp(`^${field}\\s*=.*$`, "m"), lines[0]);
if (target === "live") {
  const name = JSON.parse(run("shopify", ["theme", "list", "--store", STORE, "--json"])).find((x) => String(x.id) === String(rollbackId))?.name;
  const rollbackLine = `ROLLBACK_ACTIVE     = ${rollbackId}   ${name} (snapshot do live pre-deploy)`;
  md = md.replace(/^ROLLBACK_ACTIVE\s*=.*$/m, rollbackLine);
  lines.push(rollbackLine);
}
try {
  writeFileSync(DEPLOY_MD, md);
  run("git", ["add", DEPLOY_MD]);
  run("git", ["commit", "-m", `docs: registar deploy ${sha} em ${target}`]);
} catch (err) {
  die(`push feito mas o registo falhou (${err.message.split("\n")[0]}). Escreve à mão em ${DEPLOY_MD}:\n${lines.join("\n")}`);
}
console.log(`\nRegistado em ${DEPLOY_MD} e commitado:\n  ${lines.join("\n  ")}`);
console.log(target === "live" ? "\nFalta: git push origin main (o próximo deploy exige HEAD == origin/main)." : "");
