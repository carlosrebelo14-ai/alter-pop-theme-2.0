/* Alterpop — Character Page "EXPLORE BY" cuts.
   Toggle behaviour: one panel open at a time (Line / Height / Year); the
   others collapse. A cut REORGANISES the grid (chosen bucket's members move
   to the front, stable order otherwise) — it never removes items. Re-sort
   uses --motion-transactional.

   BLOCKED: Line / Year fields, and a clean single-axis Height, do not exist
   yet, so no buckets render and `reorder()` has nothing to key on. The
   wiring below is complete and inert until `[data-cut-bucket]` elements
   appear inside the panels. */
(function () {
  const root = document.querySelector('.ap-explore');
  if (!root) return;

  const toggles = root.querySelectorAll('.ap-explore__toggle');
  const panels = root.querySelectorAll('[data-cut-panel]');
  const grid = document.querySelector('.ap-catalogue__grid');

  const collapseAll = () => {
    toggles.forEach((t) => t.setAttribute('aria-expanded', 'false'));
    panels.forEach((p) => (p.hidden = true));
  };

  toggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const cut = toggle.dataset.cut;
      const open = toggle.getAttribute('aria-expanded') === 'true';
      collapseAll();
      if (!open) {
        toggle.setAttribute('aria-expanded', 'true');
        const panel = root.querySelector(`[data-cut-panel="${cut}"]`);
        if (panel) panel.hidden = false;
      }
    });
  });

  // A bucket click reorganises — never gates.
  root.addEventListener('click', (e) => {
    const bucket = e.target.closest('[data-cut-bucket]');
    if (!bucket || !grid) return;
    const cut = bucket.closest('[data-cut-panel]')?.dataset.cutPanel;
    reorder(cut, bucket.dataset.cutBucket);
    bucket.parentElement
      .querySelectorAll('[data-cut-bucket]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b === bucket)));
  });

  function reorder(cut, value) {
    const items = Array.from(grid.children);
    const key = 'data-' + cut; // data-line / data-height / data-year
    const inBucket = (el) => (el.getAttribute(key) || '') === value;
    items
      .slice()
      .sort((a, b) => (inBucket(b) ? 1 : 0) - (inBucket(a) ? 1 : 0))
      .forEach((el) => grid.appendChild(el));
  }
})();
