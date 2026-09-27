// node --test scripts/lib/theme-json.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { sameThemeJson } from "./theme-json.mjs";

const section = (extra) => ({ sections: { bar: { type: "announcement-bar", settings: { a: 1 }, ...extra } }, order: ["bar"] });

test("block_order: [] vs ausente -> igual", () => {
  assert.equal(sameThemeJson(section({ block_order: [] }), section({})), true);
});

test("blocks: {} vs ausente -> igual", () => {
  assert.equal(sameThemeJson(section({ blocks: {} }), section({})), true);
});

test("settings.universe_collections: [] vs ausente -> diferente", () => {
  const withEmpty = { sections: { header: { type: "header", settings: { universe_collections: [] } } } };
  const without = { sections: { header: { type: "header", settings: {} } } };
  assert.equal(sameThemeJson(withEmpty, without), false);
});

test('block_order: ["a"] vs ausente -> diferente', () => {
  assert.equal(sameThemeJson(section({ block_order: ["a"] }), section({})), false);
});

// Guardas extra da regra "por nome, nunca dentro de settings"
test("settings: {} vs ausente -> igual (caso já existente)", () => {
  assert.equal(sameThemeJson({ s: { type: "x", settings: {} } }, { s: { type: "x" } }), true);
});

test("settings.block_order: [] / settings.blocks: {} nunca são removidos", () => {
  assert.equal(sameThemeJson({ s: { settings: { block_order: [] } } }, { s: { settings: {} } }), false);
  assert.equal(sameThemeJson({ s: { settings: { blocks: {} } } }, { s: { settings: {} } }), false);
});

test("outros arrays/objetos vazios não são removidos", () => {
  assert.equal(sameThemeJson({ order: [] }, {}), false);
  assert.equal(sameThemeJson({ s: { other: {} } }, { s: {} }), false);
});
