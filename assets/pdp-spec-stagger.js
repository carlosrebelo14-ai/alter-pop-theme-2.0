/* Alterpop PDP — premium spec sheet reveals row-by-row on viewport entry.
   The +40ms per-row stagger + editorial easing live in pdp.css; this only
   flips `.is-in` when the table scrolls into view. The system's ONLY stagger. */
(function () {
  var tables = document.querySelectorAll('.ap-pdp__spec-table');
  if (!tables.length) return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    tables.forEach(function (t) { t.classList.add('is-in'); });
    return;
  }

  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  tables.forEach(function (t) { io.observe(t); });
})();
