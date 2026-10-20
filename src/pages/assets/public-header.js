import { escapeHtml, icon } from './ui.js';
import { resolveSession, signOut } from './session.js';

const NAVIGATION = [
  ['jobs', 'Find jobs', '/jobs/'],
  ['how-it-works', 'How it works', '/index.html#how-it-works'],
  ['looking-ahead', 'Looking ahead', '/index.html#looking-ahead'],
];

export function initPublicHeader() {
  const header = document.querySelector('[data-public-header]');
  if (!header) return;
  header.innerHTML = `<div class="container">
    <a class="brand" href="/index.html"><img src="/assets/brand.svg" width="36" height="36" alt="">CareerConnect<span class="brand-dot">.</span></a>
    <nav class="public-nav" aria-label="Main navigation">${NAVIGATION.map(([key, label, href]) => `<a href="${href}" data-nav="${key}">${label}</a>`).join('')}</nav>
    <div class="header-actions" aria-busy="true"><span class="account-placeholder" role="status">Checking account…</span></div>
  </div>`;
  const actions = header.querySelector('.header-actions');
  function updateActiveLink() {
    const active = location.pathname.startsWith('/jobs') ? 'jobs' : location.hash.slice(1);
    header.querySelectorAll('[data-nav]').forEach((link) => {
      if (link.dataset.nav === active) link.setAttribute('aria-current', active === 'jobs' ? 'page' : 'location');
      else link.removeAttribute('aria-current');
    });
  }
  let checkingAccount = false;
  async function updateAccount(force = false) {
    if (checkingAccount) return;
    checkingAccount = true;
    actions.setAttribute('aria-busy', 'true');
    const retry = actions.querySelector('button');
    if (retry) {
      retry.disabled = true;
      retry.textContent = 'Checking account…';
      const message = actions.querySelector('[role="alert"]');
      if (message) {
        message.setAttribute('role', 'status');
        message.textContent = 'Checking your account…';
      }
    }
    try {
      const session = await resolveSession({ force });
      actions.innerHTML = session
        ? `<a class="button button-secondary workspace-entry" href="/dashboard/index.html"><span><span class="workspace-entry-prefix">Your </span>workspace</span></a><button class="button button-quiet signout-button" type="button" aria-label="Sign out">${icon('logout')}<span class="signout-label">Sign out</span></button>`
        : '<a class="button button-quiet" href="/auth/login.html">Sign in</a><a class="button header-create-account" href="/auth/signup.html">Create account</a>';
      actions.querySelector('.signout-button')?.addEventListener('click', (event) => signOut(event.currentTarget));
    } catch (error) {
      // A failed session lookup is unknown state, not evidence of logout.
      actions.innerHTML = `<div class="account-status-error"><p role="alert">Account status unavailable.</p><div class="account-status-actions"><button class="button button-secondary" type="button" title="${escapeHtml(error.message)}">Retry account status</button><a class="text-link" href="/auth/login.html">Sign in</a></div></div>`;
      actions.querySelector('button').addEventListener('click', () => updateAccount(true));
    } finally {
      checkingAccount = false;
      actions.setAttribute('aria-busy', 'false');
    }
  }
  updateActiveLink();
  addEventListener('hashchange', updateActiveLink);
  updateAccount();
}
