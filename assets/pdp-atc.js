/* Alterpop PDP — Add to Cart overshoot (1.00 -> 1.03 -> 1.00, 260ms).
   DS microinteraction reserved EXCLUSIVELY to this button. Dawn's
   product-form.js still owns the actual add-to-cart. */
(function () {
  var buttons = document.querySelectorAll('.ap-pdp .product-form__submit');
  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (btn.hasAttribute('disabled')) return;
      btn.classList.remove('ap-atc-bounce');
      void btn.offsetWidth; /* restart the animation */
      btn.classList.add('ap-atc-bounce');
    });
    btn.addEventListener('animationend', function () {
      btn.classList.remove('ap-atc-bounce');
    });
  });
})();
