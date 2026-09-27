/**
 * Normalização de JSON de tema para o drift check (scripts/deploy-theme.mjs).
 *
 * O Shopify reescreve JSON de editor ao gravar: remove algumas chaves vazias.
 * Estas formas são equivalentes em Liquid e não são drift:
 *   - "settings": {}     ausente ≡ vazio  (caso conhecido, DEPLOY.md)
 *   - "blocks": {}       ausente ≡ vazio
 *   - "block_order": []  ausente ≡ vazio  (27/09/2026, bloco "Welcome" retirado)
 *
 * A remoção é por NOME de chave, nunca por tipo de valor, e NUNCA dentro de um
 * objeto `settings`: aí um valor vazio é uma decisão (ex.: universe_collections: []
 * = fonte automática) e a chave ausente cai no default do schema, que pode ser
 * outra coisa. Uma chave `settings.blocks` ou `settings.block_order` também
 * nunca é removida.
 */

/** Remove o bloco /* ... *\/ inicial que o `theme pull` acrescenta. */
export const parseThemeJson = (text) => JSON.parse(text.replace(/^\s*\/\*[\s\S]*?\*\//, ""));

const isEmptyObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length;
const isEmptyArray = (v) => Array.isArray(v) && v.length === 0;

const DROP_WHEN_EMPTY = {
  settings: isEmptyObject,
  blocks: isEmptyObject,
  block_order: isEmptyArray,
};

export function normalize(v, parentKey = null) {
  if (Array.isArray(v)) return v.map((x) => normalize(x, null));
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) {
      const n = normalize(v[k], k);
      const drop = parentKey !== "settings" && Object.hasOwn(DROP_WHEN_EMPTY, k) && DROP_WHEN_EMPTY[k](n);
      if (drop) continue;
      out[k] = n;
    }
    return out;
  }
  return v;
}

/** Duas árvores de JSON de tema são equivalentes para o drift check? */
export const sameThemeJson = (a, b) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
