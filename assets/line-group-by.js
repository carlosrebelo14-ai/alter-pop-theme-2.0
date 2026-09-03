/* Alterpop — Line Page "BY CHARACTER / BY UNIVERSE" grouping.
   One toggle active at a time; the other's panel collapses. A grouping
   REORGANISES the grid (chosen key's members clustered, stable otherwise) —
   it never removes items. Re-sort uses --motion-transactional.

   BLOCKED: Character / Universe fields do not exist, so no grouped sections
   render and reorder() has nothing to key on. Wiring is complete and inert
   until `data-character` / `data-universe` carry values on the grid items. */
(function () {
  const root = document.querySelector('.ap-groupby');
  if (!root) return;

  const toggles = root.querySelectorAll('.ap-groupby__toggle');
  const panels = root.querySelectorAll('[data-group-panel]');
  const grid = document.querySelector('.ap-catalogue__grid');

  const reset = () => {
    toggles.forEach((t) => t.setAttribute('aria-pressed', 'false'));
    panels.forEach((p) => (p.hidden = true));
  };

  toggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const key = toggle.dataset.group;
      const active = toggle.getAttribute('aria-pressed') === 'true';
      reset();
      if (!active) {
        toggle.setAttribute('aria-pressed', 'true');
        const panel = root.querySelector(`[data-group-panel="${key}"]`);
        if (panel) panel.hidden = false;
        regroup(key);
      } else {
        restore();
      }
    });
  });

  function regroup(key) {
    if (!grid) return;
    const attr = 'data-' + key; // data-character / data-universe
    const items = Array.from(grid.children);
    items
      .slice()
      .sort((a, b) =>
        (a.getAttribute(attr) || '').localeCompare(b.getAttribute(attr) || '')
      )
      .forEach((el) => grid.appendChild(el));
  }

  function restore() {
    if (!grid) return;
    Array.from(grid.children)
      .sort(
        (a, b) =>
          Number(a.dataset.originalIndex || 0) - Number(b.dataset.originalIndex || 0)
      )
      .forEach((el) => grid.appendChild(el));
  }

  // remember the source order once
  if (grid) {
    Array.from(grid.children).forEach((el, i) => (el.dataset.originalIndex = i));
  }
})();
