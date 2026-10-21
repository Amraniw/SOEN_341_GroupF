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


  // Workspace pages (dashboard, profile, resume) build their header with JavaScript,
  // so the toggle is added to #workspace-header here, and re-added if the header re-renders.
  var TOGGLE_ICONS =
    '<svg class="icon icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>' +
    '<svg class="icon icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

  function ensureWorkspaceToggle(header) {
    if (header.querySelector('[data-theme-toggle]')) return;
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-toggle';
    button.setAttribute('data-theme-toggle', '');
    button.setAttribute('aria-label', 'Dark mode');
    button.setAttribute('aria-pressed', 'false');
    button.title = 'Toggle dark mode';
    button.innerHTML = TOGGLE_ICONS;
    var account = header.querySelector('.account-link');
    if (account) header.insertBefore(button, account);
    else header.appendChild(button);
    syncButtons();
  }

  function watchWorkspaceHeader() {
    var header = document.getElementById('workspace-header');
    if (!header) return;
    ensureWorkspaceToggle(header);
    if (window.MutationObserver) {
      new MutationObserver(function () {
        ensureWorkspaceToggle(header);
      }).observe(header, { childList: true });
    }
  }

  // 2. Button state once the DOM exists.
  document.addEventListener('DOMContentLoaded', function () {
    watchWorkspaceHeader();
    syncButtons();
  });

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