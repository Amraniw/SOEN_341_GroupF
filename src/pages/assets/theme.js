/* CareerConnect theme switcher.
   Load in <head> WITHOUT defer/async so the theme is set before first paint. */
(function () {
  var KEY = 'theme';
  var root = document.documentElement;

  function getSaved() {
    try {
      var value = localStorage.getItem(KEY);
      return value === 'dark' || value === 'light' ? value : null;
    } catch (e) {
      return null;
    }
  }

  function save(theme) {
    try {
      localStorage.setItem(KEY, theme);
    } catch (e) {
      /* storage blocked: theme still applies for this page view */
    }
  }

  function syncButtons() {
    var isDark = root.getAttribute('data-theme') === 'dark';
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-pressed', String(isDark));
    }
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    syncButtons();
  }

  // 1. Apply immediately: the visitor's saved choice, otherwise light mode.
  apply(getSaved() || 'light');

  // 2. Button state once the DOM exists.
  document.addEventListener('DOMContentLoaded', syncButtons);

  // 3. Click handling by delegation, so it works on every page and for late-rendered buttons.
  document.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('[data-theme-toggle]');
    if (!button) return;
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    save(next);
    apply(next);
  });

  // 4. Keep other open tabs in sync.
  window.addEventListener('storage', function (event) {
    if (event.key === KEY && (event.newValue === 'dark' || event.newValue === 'light')) {
      apply(event.newValue);
    }
  });
})();