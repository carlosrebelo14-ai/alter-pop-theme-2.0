/* Alterpop — Character Page "EXPLORE BY" cuts (Line / Height / Year).
   Source of truth: wireframe 9a + CLAUDE.md Phase 5 "EXPLORE BY cuts".

   Reads only from the DOM — no Liquid, no fetch, no storage, no deps.
   Wired here, inert until `sections/character-grid.liquid` renders the
   contract below with real per-card fields (BLOCKED on the `character`
   metaobject + its `products` list field). Tested against
   tests/fixtures/character-grid.html.

   DOM CONTRACT (per instance; multiple instances per page are supported —
   each [data-ap-cut-bar] pairs with the [data-ap-cut-grid] in its parent):

     [data-ap-cut-bar]
       button[data-ap-cut-chip="line"]   aria-pressed="false"
       button[data-ap-cut-chip="height"] aria-pressed="false"
       button[data-ap-cut-chip="year"]   aria-pressed="false"
     [data-ap-cut-grid] [data-ap-cut=""]
       > <card> [data-line] [data-height] [data-year]   (one per product)
     [data-ap-cut-loadmore] hidden        (optional; revealed past the ceiling)

   BEHAVIOUR
   - One cut active at a time. Re-clicking the active chip clears it.
   - A cut REORGANISES the grid: cards cluster by that field, groups in
     first-appearance order, a labelled "Unsorted" cluster last for cards
     whose field is empty. A cut NEVER hides a card (the >50 ceiling aside).
     No tier filter — Impulse + Premium always appear together.
   - Ceiling: with >50 cards, show the first 50 and reveal "Load more"
     (+50 per click). Re-applied after every reorder.
   - Active cut mirrored to the URL as ?cut=line via history.replaceState —
     no reload. Read back on load.
   - A cut with no card carrying that field is dead: its chip is
     `disabled` + `aria-disabled="true"` and never wires a listener.
   - Reorder motion: FLIP at --motion-transactional; skipped under
     prefers-reduced-motion.
*/
(function () {
  var CUTS = ['line', 'height', 'year'];
  var PAGE = 50;
  var UNSORTED = 'Unsorted';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var bars = document.querySelectorAll('[data-ap-cut-bar]');
  for (var i = 0; i < bars.length; i++) {
    var bar = bars[i];
    var scope = bar.parentElement || document;
    var grid = scope.querySelector('[data-ap-cut-grid]');
    if (grid) init(bar, grid, scope.querySelector('[data-ap-cut-loadmore]'));
  }

  function init(bar, grid, loadMoreBtn) {
    var chips = {};
    CUTS.forEach(function (c) {
      chips[c] = bar.querySelector('[data-ap-cut-chip="' + c + '"]');
    });

    var cards = toArray(grid.children).filter(function (el) {
      return !el.hasAttribute('data-ap-cut-group');
    });
    if (!cards.length) return;
    cards.forEach(function (el, idx) { el.dataset.apCutIndex = String(idx); });

    var activeCut = '';
    var shown = PAGE;

    // Dead cuts: disable the chip before anything else.
    CUTS.forEach(function (c) {
      var chip = chips[c];
      if (!chip) return;
      if (cards.some(function (el) { return valueFor(el, c) !== ''; })) {
        chip.addEventListener('click', function () { setCut(c); });
      } else {
        chip.disabled = true;
        chip.setAttribute('aria-disabled', 'true');
      }
    });

    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', function () {
        shown += PAGE;
        render();
      });
    }

    // Initial state from ?cut=
    var initial = param('cut');
    if (CUTS.indexOf(initial) !== -1 && chips[initial] && !chips[initial].disabled) {
      setCut(initial);
    } else {
      render();
    }

    function setCut(cut) {
      activeCut = cut === activeCut ? '' : cut;
      shown = PAGE;
      CUTS.forEach(function (c) {
        if (chips[c] && !chips[c].disabled) {
          chips[c].setAttribute('aria-pressed', String(c === activeCut));
        }
      });
      grid.setAttribute('data-ap-cut', activeCut);
      syncURL();
      render();
    }

    function render() {
      var first = reduceMotion ? null : recordPositions(cards);

      toArray(grid.querySelectorAll('[data-ap-cut-group]')).forEach(function (n) {
        n.remove();
      });

      var sequence = [];
      if (activeCut) {
        clusters(activeCut).forEach(function (group) {
          sequence.push(makeHeading(group.label));
          group.items.forEach(function (el) { sequence.push(el); });
        });
      } else {
        bySourceOrder().forEach(function (el) { sequence.push(el); });
      }
      sequence.forEach(function (node) { grid.appendChild(node); });

      // Ceiling — count cards only.
      var count = 0;
      sequence.forEach(function (node) {
        if (node.hasAttribute('data-ap-cut-group')) return;
        count += 1;
        node.hidden = count > shown;
      });
      // Hide a heading whose whole cluster is clipped.
      toArray(grid.querySelectorAll('[data-ap-cut-group]')).forEach(function (h) {
        var anyVisible = false;
        var n = h.nextElementSibling;
        while (n && !n.hasAttribute('data-ap-cut-group')) {
          if (!n.hidden) { anyVisible = true; break; }
          n = n.nextElementSibling;
        }
        h.hidden = !anyVisible;
      });

      if (loadMoreBtn) loadMoreBtn.hidden = cards.length <= shown;

      if (first) playFlip(cards, first);
    }

    function bySourceOrder() {
      return cards.slice().sort(function (a, b) {
        return Number(a.dataset.apCutIndex) - Number(b.dataset.apCutIndex);
      });
    }

    function clusters(cut) {
      var order = [];
      var groups = {};
      bySourceOrder().forEach(function (el) {
        var key = valueFor(el, cut) || UNSORTED;
        if (!groups[key]) {
          groups[key] = [];
          if (key !== UNSORTED) order.push(key);
        }
        groups[key].push(el);
      });
      if (groups[UNSORTED]) order.push(UNSORTED);
      return order.map(function (key) {
        return { label: key, items: groups[key] };
      });
    }

    function syncURL() {
      try {
        var url = new URL(window.location.href);
        if (activeCut) url.searchParams.set('cut', activeCut);
        else url.searchParams.delete('cut');
        history.replaceState(history.state, '', url);
      } catch (e) {
        /* file:// or blocked history — state still lives in the DOM */
      }
    }
  }

  /* ---- helpers ---- */

  function makeHeading(label) {
    var h = document.createElement('div');
    h.setAttribute('data-ap-cut-group', '');
    h.setAttribute('role', 'presentation');
    h.className = 'ap-cut-group type-label';
    h.textContent = label;
    return h;
  }

  function valueFor(el, cut) {
    var v = el.getAttribute('data-' + cut);
    return v == null ? '' : v.trim();
  }

  function param(name) {
    try {
      return new URL(window.location.href).searchParams.get(name) || '';
    } catch (e) {
      return '';
    }
  }

  function toArray(list) {
    return Array.prototype.slice.call(list);
  }

  function recordPositions(cards) {
    var m = new Map();
    cards.forEach(function (el) {
      if (!el.hidden) m.set(el, el.getBoundingClientRect());
    });
    return m;
  }

  function playFlip(cards, first) {
    cards.forEach(function (el) {
      if (el.hidden) return;
      var before = first.get(el);
      if (!before) return;
      var after = el.getBoundingClientRect();
      var dx = before.left - after.left;
      var dy = before.top - after.top;
      if (!dx && !dy) return;
      el.style.transition = 'none';
      el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      requestAnimationFrame(function () {
        el.style.transition = 'transform var(--motion-transactional, 120ms ease)';
        el.style.transform = '';
      });
      el.addEventListener('transitionend', function te() {
        el.style.transition = '';
        el.style.transform = '';
        el.removeEventListener('transitionend', te);
      });
    });
  }
})();
