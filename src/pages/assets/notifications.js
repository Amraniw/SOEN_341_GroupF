import { request } from './api.js';
import { escapeHtml, icon } from './ui.js';
import { badgeText, buttonLabel, safeLink, timeAgo } from './notification-format.mjs';

const POLL_MS = 30000;
const TYPE_ICONS = {
  new_application: 'user',
  application_update: 'applications',
  interview_invitation: 'briefcase',
  deadline_reminder: 'bell',
};

// Adds the notification bell and its dropdown to the workspace header.
export function initNotifications(header) {
  const root = document.createElement('div');
  root.className = 'notifications';
  root.innerHTML = `
    <button class="notification-button" type="button" aria-expanded="false" aria-controls="notification-panel" aria-label="Notifications">
      ${icon('bell')}<span class="notification-badge" aria-hidden="true" hidden></span>
    </button>
    <section class="notification-panel" id="notification-panel" aria-label="Notifications" hidden>
      <div class="notification-panel-header">
        <h2>Notifications</h2>
        <button class="text-link notification-mark-all" type="button" disabled>Mark all as read</button>
      </div>
      <p class="notification-status" role="status" aria-live="polite"></p>
      <ul class="notification-list"></ul>
    </section>`;
  header.insertBefore(root, header.querySelector('.account-link'));

  const button = root.querySelector('.notification-button');
  const badge = root.querySelector('.notification-badge');
  const panel = root.querySelector('.notification-panel');
  const markAll = root.querySelector('.notification-mark-all');
  const status = root.querySelector('.notification-status');
  const list = root.querySelector('.notification-list');
  let unread = 0;
  let timer = null;

  function setUnread(count) {
    unread = Number.isInteger(count) && count > 0 ? count : 0;
    const text = badgeText(unread);
    badge.textContent = text;
    badge.hidden = !text;
    button.setAttribute('aria-label', buttonLabel(unread));
    markAll.disabled = unread === 0;
  }

  function stopPolling() {
    clearInterval(timer);
    timer = null;
  }

  function onError(error, message) {
    if (error.status === 401) {
      stopPolling();
      return;
    }
    status.textContent = message;
  }

  function renderItem(item) {
    const href = safeLink(item.link);
    const tag = href ? 'a' : 'button';
    const attributes = href ? `href="${escapeHtml(href)}"` : 'type="button"';
    return `<li><${tag} class="notification-item${item.read ? '' : ' is-unread'}" ${attributes} data-id="${escapeHtml(item.id)}">
      <span class="notification-icon">${icon(TYPE_ICONS[item.type] || 'bell')}</span>
      <span class="notification-copy">
        <strong>${escapeHtml(item.title)}${item.read ? '' : '<span class="sr-only"> (unread)</span>'}</strong>
        <span>${escapeHtml(item.message)}</span>
        <small>${escapeHtml(timeAgo(item.createdAt))}</small>
      </span>
    </${tag}></li>`;
  }

  async function loadList() {
    try {
      const data = await request('/notifications?limit=20', undefined, 'GET');
      list.innerHTML = data.items.map(renderItem).join('');
      status.textContent = data.items.length ? '' : 'You’re all caught up. New updates will appear here.';
      setUnread(data.unreadCount);
    } catch (error) {
      onError(error, 'We couldn’t load your notifications. Close this panel and try again.');
    }
  }

  async function refreshCount() {
    try {
      const { unreadCount } = await request('/notifications/unread-count', undefined, 'GET');
      const increased = unreadCount > unread;
      setUnread(unreadCount);
      if (increased && !panel.hidden) loadList();
    } catch (error) {
      onError(error, '');
    }
  }

  async function markRead(id) {
    const data = await request(`/notifications/${encodeURIComponent(id)}/read`, {}, 'PATCH');
    setUnread(data.unreadCount);
  }

  function setOpen(open) {
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) {
      status.textContent = 'Loading notifications…';
      loadList();
    }
  }

  button.addEventListener('click', () => setOpen(panel.hidden));

  markAll.addEventListener('click', async () => {
    markAll.disabled = true;
    try {
      await request('/notifications/read-all', {}, 'POST');
      await loadList();
    } catch (error) {
      markAll.disabled = false;
      onError(error, 'We couldn’t mark your notifications as read. Please try again.');
    }
  });

  list.addEventListener('click', async (event) => {
    const item = event.target.closest('.notification-item');
    if (!item) return;
    const href = item.getAttribute('href');
    const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0;
    if (!item.classList.contains('is-unread')) return; // Read links navigate normally.
    if (href && modified) {
      markRead(item.dataset.id).catch(() => {});
      return;
    }
    event.preventDefault();
    try {
      await markRead(item.dataset.id);
    } catch (error) {
      if (!href) onError(error, 'We couldn’t update this notification. Please try again.');
    }
    if (href) location.assign(href);
    else loadList();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) {
      setOpen(false);
      button.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (!panel.hidden && !root.contains(event.target)) setOpen(false);
  });

  function startPolling() {
    stopPolling();
    timer = setInterval(() => {
      if (document.visibilityState === 'visible') refreshCount();
    }, POLL_MS);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshCount();
  });

  refreshCount();
  startPolling();
  return { refresh: refreshCount };
}
