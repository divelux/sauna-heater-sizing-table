/*! Sauna Heater Size Table — print button. (c) 2026 DIVELUX Inc. MIT License. */
(function () {
  'use strict';
  var b = document.querySelector('[data-a="print"]');
  if (!b || typeof window.print !== 'function') return;
  b.hidden = false;
  b.addEventListener('click', function () { window.print(); });
})();
