import { resolveSession, signInUrl, signOut } from './session.js';
import { escapeHtml, initials, icon } from './ui.js';

async function loadWorkspaceSession() {
  const notice = document.createElement('main');
  notice.className = 'container workspace-session-status';
  notice.innerHTML = '<h1>Opening your workspace…</h1><p id="workspace-session-message" role="status">Checking your account…</p><div class="session-recovery-actions"><button class="button" type="button" disabled>Checking account…</button><a class="button button-secondary" href="/index.html">Back to home</a><a class="text-link" href="' + escapeHtml(signInUrl()) + '">Sign in</a></div>';
  document.body.append(notice);
  const button = notice.querySelector('button');
  const message = notice.querySelector('#workspace-session-message');

  // Keep dependent page modules waiting during recovery. A successful retry
  // continues their normal initialization instead of leaving session=null forever.
  while (true) {
    notice.querySelector('h1').textContent = 'Opening your workspace…';
    notice.setAttribute('aria-busy', 'true');
    button.disabled = true;
    button.textContent = 'Checking account…';
    message.setAttribute('role', 'status');
    message.textContent = 'Checking your account…';
    try {
      const current = await resolveSession({ force: true });
      if (!current) {
        location.replace(signInUrl());
        return null;
      }
      notice.remove();
      return current;
    } catch (error) {
      notice.querySelector('h1').textContent = 'We couldn’t open your workspace.';
      message.setAttribute('role', 'alert');
      message.textContent = error.message || 'Your account status could not be checked. Please try again.';
      notice.setAttribute('aria-busy', 'false');
      button.disabled = false;
      button.textContent = 'Try again';
      await new Promise((resolve) => button.addEventListener('click', resolve, { once: true }));
    }
  }
}

export const session = await loadWorkspaceSession();
if (session) {
  const page = document.body.dataset.page;
  const links = [
    ['dashboard', 'Overview', 'home'],
    ['jobs', 'Find jobs', 'briefcase'],
    ['applications', 'Applications', 'applications'],
    ['profile', 'My account', 'user'],
    ['resume', 'Resume', 'file'],
  ];
  document.querySelector('#workspace-header').innerHTML = `
    <a class="brand" href="/dashboard/index.html"><img src="/assets/brand.svg" width="36" height="36" alt="">CareerConnect<span class="brand-dot">.</span></a>
    <span class="workspace-label">YOUR CAREER WORKSPACE</span>
    <a class="account-link" href="/profile/index.html" aria-label="View my account"><span class="avatar avatar-small">${escapeHtml(initials(session.user.name))}</span><span class="account-name">${escapeHtml(session.user.name)}</span></a>
    <button class="button button-quiet signout-button" type="button" aria-label="Sign out">${icon('logout')}<span class="signout-label">Sign out</span></button>
    <button class="button button-quiet mobile-toggle" type="button" aria-expanded="false" aria-controls="workspace-sidebar" aria-label="Open navigation">${icon('menu')}</button>`;
  document.querySelector('#workspace-sidebar').innerHTML = `
    <div><p class="nav-label">WORKSPACE</p><nav aria-label="Workspace">${links.map(([key, label, symbol]) => `<a class="nav-link" href="${key === 'jobs' ? '/workspace/jobs/' : `/${key}/index.html`}" ${page === key ? 'aria-current="page"' : ''}>${icon(symbol)}${label}${page === key ? '<span class="active-dot"></span>' : ''}</a>`).join('')}</nav>
    <p class="nav-label nav-label-later">LOOKING AHEAD</p><div class="upcoming-nav"><span>${icon('building')}Companies</span><small>Coming in a future release</small></div><a class="text-link workspace-public-link" href="/index.html">Visit public site ${icon('arrow')}</a></div>
    <div class="sidebar-note">A little preparation.<br>A clearer next step.<span>Your career starts with you.</span></div>`;
  document.querySelector('.signout-button').addEventListener('click', (event) => signOut(event.currentTarget));
  const toggle = document.querySelector('.mobile-toggle');
  const sidebar = document.querySelector('#workspace-sidebar');
  function closeNavigation() {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
    sidebar.classList.remove('is-open');
  }
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute(
      'aria-label',
      open ? 'Close navigation' : 'Open navigation'
    );
    sidebar.classList.toggle('is-open', open);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sidebar.classList.contains('is-open')) {
      closeNavigation();
      toggle.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (!sidebar.contains(event.target) && !toggle.contains(event.target))
      closeNavigation();
  });
  document.querySelector('[data-workspace]').hidden = false;
}
