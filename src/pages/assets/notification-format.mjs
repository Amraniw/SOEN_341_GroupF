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
