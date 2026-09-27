import { readSession, clearDisplaySession } from './session.js';
import { escapeHtml, initials, icon } from './ui.js';

export const session = readSession();
if (!session) {
  location.replace('/auth/login.html?reason=required');
} else {
  if (typeof BroadcastChannel !== 'undefined') {
    const accountChannel = new BroadcastChannel('careerconnect.account');
    accountChannel.addEventListener('message', () => {
      clearDisplaySession();
      location.replace('/auth/login.html?reason=changed');
    });
  }
  const page = document.body.dataset.page;
  const links = [
    ['dashboard', 'Overview', 'home'],
    ['profile', 'My account', 'user'],
    ['resume', 'Resume', 'file'],
  ];
  document.querySelector('#workspace-header').innerHTML = `
    <a class="brand" href="/dashboard/index.html"><img src="/assets/brand.svg" width="36" height="36" alt="">CareerConnect<span class="brand-dot">.</span></a>
    <span class="workspace-label">YOUR CAREER WORKSPACE</span>
    <a class="account-link" href="/profile/index.html" aria-label="View my account"><span class="avatar avatar-small">${escapeHtml(initials(session.user.name))}</span><span class="account-name">${escapeHtml(session.user.name)}</span></a>
    <button class="button button-quiet mobile-toggle" type="button" aria-expanded="false" aria-controls="workspace-sidebar" aria-label="Open navigation">${icon('menu')}</button>`;
  document.querySelector('#workspace-sidebar').innerHTML = `
    <div><p class="nav-label">WORKSPACE</p><nav aria-label="Workspace">${links.map(([key, label, symbol]) => `<a class="nav-link" href="/${key}/index.html" ${page === key ? 'aria-current="page"' : ''}>${icon(symbol)}${label}${page === key ? '<span class="active-dot"></span>' : ''}</a>`).join('')}</nav>
    <p class="nav-label nav-label-later">LOOKING AHEAD</p><div class="upcoming-nav"><span>${icon('briefcase')}Jobs</span><span>${icon('file')}Applications</span><span>${icon('building')}Companies</span><small>Coming in a future release</small></div></div>
    <div class="sidebar-note">A little preparation.<br>A clearer next step.<span>Your career starts with you.</span></div>`;
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
