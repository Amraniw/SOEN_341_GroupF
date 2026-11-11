// Pure helpers for the notification bell, kept free of DOM access so they can be unit tested.

function parseTimestamp(value) {
  if (typeof value !== 'string' || !value) return null;
  // SQLite CURRENT_TIMESTAMP is UTC without a zone marker.
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function timeAgo(value, now = Date.now()) {
  const date = parseTimestamp(value);
  if (!date) return '';
  const seconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Only same-site paths are used as links; anything else falls back to no link.
export function safeLink(link) {
  return typeof link === 'string' && /^\/(?![/\\])/.test(link) ? link : null;
}

export function badgeText(count) {
  if (!Number.isInteger(count) || count <= 0) return '';
  return count > 9 ? '9+' : String(count);
}

export function buttonLabel(count) {
  if (!Number.isInteger(count) || count <= 0) return 'Notifications';
  return `Notifications, ${count} unread`;
}

// Popups (toasts) for notifications that arrive while a page is open.
export const TOAST_MAX_AGE_MS = 5 * 60 * 1000;
export const MAX_TOASTS = 3;

// Picks which unread notifications should pop up. `lastId` is the newest id this
// tab has already announced, so each notification pops up once. On the first
// check after a page opens (`initial`), only recent items qualify, so an old
// backlog of unread items does not pop up all at once.
export function selectToastItems(items, { lastId = 0, now = Date.now(), initial = false } = {}) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && !item.read && Number.isInteger(item.id) && item.id > lastId)
    .filter((item) => {
      if (!initial) return true;
      const date = parseTimestamp(item.createdAt);
      return Boolean(date) && now - date.getTime() <= TOAST_MAX_AGE_MS;
    })
    .sort((a, b) => a.id - b.id)
    .slice(-MAX_TOASTS);
}
