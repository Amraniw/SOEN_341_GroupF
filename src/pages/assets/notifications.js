import { request } from './api.js';
import { escapeHtml, icon } from './ui.js';
import { MAX_TOASTS, badgeText, buttonLabel, safeLink, selectToastItems, timeAgo } from './notification-format.mjs';
import { ACTIVITY_EVENTS, createIdleWatcher } from './idle-watcher.mjs';

const POLL_MS = 30000;
const TOAST_MS = 8000;
const TYPE_ICONS = {
  new_application: 'user',
  application_update: 'applications',
  interview_invitation: 'briefcase',
  deadline_reminder: 'bell',
  welcome: 'user',
};

// Adds the notification bell, its dropdown and popups to the workspace header.
// With `idleWarning`, also pops up a reminder after 67 seconds without activity.
export function initNotifications(header, { userId = null, idleWarning = false } = {}) {
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

  const toastRegion = document.createElement('div');
  toastRegion.className = 'toast-region';
  toastRegion.setAttribute('role', 'status');
  toastRegion.setAttribute('aria-live', 'polite');
  document.body.append(toastRegion);
  const activeToasts = [];
  const toastStorageKey = `careerconnect.last-toasted-notification:${userId ?? 'anonymous'}`;
  let lastToasted = 0;
  let firstCheck = true;
  try {
    const stored = Number(sessionStorage.getItem(toastStorageKey));
    if (Number.isInteger(stored) && stored > 0) lastToasted = stored;
  } catch { /* Popups still work without session storage. */ }

  // Shows a popup. Notification popups open their notification when clicked;
  // the idle reminder is informational only.
  function showToast({ title, message, iconName = 'bell', onOpen = null, autoDismiss = true, className = '' }) {
    const toast = document.createElement('div');
    toast.className = `toast ${className}`.trim();
    const bodyTag = onOpen ? 'button' : 'div';
    toast.innerHTML = `
      <${bodyTag} class="toast-body"${onOpen ? ' type="button"' : ''}>
        <span class="notification-icon">${icon(iconName)}</span>
        <span class="notification-copy"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span></span>
      </${bodyTag}>
      <button class="toast-close" type="button" aria-label="Dismiss notification"><span aria-hidden="true">×</span></button>`;
    let hideTimer = null;
    const handle = {
      dismiss() {
        clearTimeout(hideTimer);
        const index = activeToasts.indexOf(handle);
        if (index !== -1) activeToasts.splice(index, 1);
        toast.remove();
      },
    };
    const startTimer = () => {
      clearTimeout(hideTimer);
      if (autoDismiss) hideTimer = setTimeout(handle.dismiss, TOAST_MS);
    };
    toast.addEventListener('pointerenter', () => clearTimeout(hideTimer));
    toast.addEventListener('pointerleave', startTimer);
    toast.addEventListener('focusin', () => clearTimeout(hideTimer));
    toast.addEventListener('focusout', startTimer);
    toast.querySelector('.toast-close').addEventListener('click', handle.dismiss);
    if (onOpen) toast.querySelector('.toast-body').addEventListener('click', () => onOpen(handle));
    activeToasts.push(handle);
    toastRegion.append(toast);
    while (activeToasts.length > MAX_TOASTS) activeToasts[0].dismiss();
    startTimer();
    return handle;
  }

  function showNotificationToast(item) {
    const href = safeLink(item.link);
    showToast({
      title: item.title,
      message: item.message,
      iconName: TYPE_ICONS[item.type] || 'bell',
      onOpen: async (handle) => {
        try {
          await markRead(item.id);
        } catch { /* The link still works if marking as read fails. */ }
        handle.dismiss();
        if (href) location.assign(href);
      },
    });
  }

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

  // Updates the badge and pops up any unread notification this tab has not announced yet.
  async function refreshCount() {
    try {
      const data = await request('/notifications?unread=true&limit=5', undefined, 'GET');
      const initial = firstCheck;
      firstCheck = false;
      selectToastItems(data.items, { lastId: lastToasted, initial }).forEach(showNotificationToast);
      const newest = Math.max(lastToasted, ...data.items.map((item) => (Number.isInteger(item.id) ? item.id : 0)));
      if (newest > lastToasted) {
        lastToasted = newest;
        try { sessionStorage.setItem(toastStorageKey, String(newest)); } catch { /* Optional. */ }
      }
      const increased = data.unreadCount > unread;
      setUnread(data.unreadCount);
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

  if (idleWarning) {
    let idleToast = null;
    const watcher = createIdleWatcher({
      onIdle() {
        if (document.visibilityState !== 'visible') return;
        idleToast?.dismiss();
        idleToast = showToast({
          title: 'Are you still there?',
          message: 'You’ve been inactive for a little while. Move your mouse or press a key to keep going.',
          iconName: 'bell',
          autoDismiss: false,
          className: 'toast-idle',
        });
      },
    });
    const onActivity = () => {
      idleToast?.dismiss();
      idleToast = null;
      watcher.activity();
    };
    ACTIVITY_EVENTS.forEach((name) => addEventListener(name, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onActivity();
    });
    watcher.start();
  }

  refreshCount();
  startPolling();
  return { refresh: refreshCount };
}
