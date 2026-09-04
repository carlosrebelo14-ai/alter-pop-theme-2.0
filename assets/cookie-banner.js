/* ============================================================================
   Alterpop — Cookie Consent Banner. Wired to Shopify's Customer Privacy API
   (consent-tracking-api). The banner is only shown when Shopify says the
   visitor's region requires consent AND no choice has been recorded yet.
   Accept and Decline are treated identically here — same code path, same
   result shape, only the boolean differs.
   ============================================================================ */
(function () {
  var banner = document.getElementById('ap-cookie-banner');
  if (!banner) return;

  var STORE_KEY = 'ap-cookie-consent'; // local mirror, belt-and-braces only

  function show() {
    banner.hidden = false;
    // next frame so the transform transition runs
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        banner.classList.add('is-visible');
      });
    });
  }

  function hide() {
    banner.classList.remove('is-visible');
    var done = function () {
      banner.hidden = true;
      banner.removeEventListener('transitionend', done);
    };
    banner.addEventListener('transitionend', done);
    // fallback if no transition fires
    setTimeout(done, 400);
  }

  function persist(choice) {
    try {
      localStorage.setItem(STORE_KEY, choice);
    } catch (e) {
      /* private mode / disabled storage — the Shopify API still holds the record */
    }
  }

  function applyConsent(granted) {
    var value = {
      analytics: granted,
      marketing: granted,
      preferences: granted,
      sale_of_data: granted,
    };
    persist(granted ? 'accepted' : 'declined');

    if (
      window.Shopify &&
      window.Shopify.customerPrivacy &&
      typeof window.Shopify.customerPrivacy.setTrackingConsent === 'function'
    ) {
      window.Shopify.customerPrivacy.setTrackingConsent(value, hide);
    } else {
      hide();
    }
  }

  banner.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-ap-cookie]');
    if (!trigger) return;
    applyConsent(trigger.getAttribute('data-ap-cookie') === 'accept');
  });

  function decideVisibility() {
    var cp = window.Shopify && window.Shopify.customerPrivacy;
    if (cp && typeof cp.shouldShowBanner === 'function') {
      if (cp.shouldShowBanner()) show();
      return;
    }
    if (cp && typeof cp.shouldShowGDPRBanner === 'function') {
      if (cp.shouldShowGDPRBanner()) show();
      return;
    }
    // API not present (e.g. consent collection disabled for the store) —
    // fall back to the local mirror so we don't nag on every page.
    var recorded;
    try {
      recorded = localStorage.getItem(STORE_KEY);
    } catch (e) {
      recorded = null;
    }
    if (!recorded) show();
  }

  if (window.Shopify && typeof window.Shopify.loadFeatures === 'function') {
    window.Shopify.loadFeatures(
      [{ name: 'consent-tracking-api', version: '0.1' }],
      function (error) {
        if (error) {
          decideVisibility();
          return;
        }
        decideVisibility();
      }
    );
  } else {
    decideVisibility();
  }
})();
