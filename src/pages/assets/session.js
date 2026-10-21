import { request } from './api.js';
import { createSessionResolver } from './session-state.mjs';

// Display metadata only. Identity is always resolved from the HttpOnly cookie
// through /api/session before presenting authenticated navigation or workspaces.
const KEY = 'careerconnect.display-session';
const DISPLAY_TTL = 23 * 60 * 60 * 1000;
const sessionResolver = createSessionResolver(() => request('/session', undefined, 'GET'));
const accountSource = Math.random().toString(36).slice(2);

export function readSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem(KEY));
    if (
      !session ||
      !Number.isFinite(session.signedInAt) ||
      Date.now() - session.signedInAt > DISPLAY_TTL ||
      !Array.isArray(session.receipts) ||
      typeof session.user?.name !== 'string' ||
      typeof session.user?.email !== 'string'
    )
      return null;
    session.receipts = session.receipts.filter(
      (receipt) =>
        receipt &&
        typeof receipt.originalName === 'string' &&
        typeof receipt.uploadedAt === 'string' &&
        Number.isFinite(receipt.size)
    );
    return session;
  } catch {
    return null;
  }
}

export function startSession(user) {
  const session = {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    },
    signedInAt: Date.now(),
    receipts: [],
  };
  saveDisplaySession(session);
  sessionResolver.reset();
  broadcastAccountChange('signed-in');
}

export function clearDisplaySession() {
  removeDisplaySession();
  sessionResolver.reset();
}

function removeDisplaySession() {
  try { sessionStorage.removeItem(KEY); } catch { /* Display storage is optional. */ }
}

function saveDisplaySession(session) {
  try { sessionStorage.setItem(KEY, JSON.stringify(session)); } catch { /* Cookie auth still works. */ }
}

function broadcastAccountChange(message) {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel('careerconnect.account');
  channel.postMessage({ type: message, source: accountSource });
  channel.close();
}

export function resolveSession(options) {
  return sessionResolver.resolve(options).then((user) => {
    if (!user) {
      removeDisplaySession();
      return null;
    }
    const cached = readSession();
    const session = {
      user,
      signedInAt: Date.now(),
      receipts: cached?.user.id === user.id ? cached.receipts : [],
    };
    saveDisplaySession(session);
    return session;
  });
}

export function signInUrl(reason = 'required') {
  const params = new URLSearchParams({ reason, next: location.pathname + location.search });
  return `/auth/login.html?${params}`;
}

export async function signOut(button) {
  const original = button.innerHTML;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try {
    await request('/logout');
    clearDisplaySession();
    broadcastAccountChange('signed-out');
    location.assign('/index.html');
  } catch (error) {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.innerHTML = original;
    let notice = document.querySelector('#signout-error');
    if (!notice) {
      notice = document.createElement('p');
      notice.id = 'signout-error';
      notice.className = 'notice notice-error signout-error';
      notice.setAttribute('role', 'alert');
      document.querySelector('header').insertAdjacentElement('afterend', notice);
    }
    notice.textContent = `We couldn’t sign you out. ${error.message}`;
  }
}

// Cookies are shared across tabs. Reload to verify the actual new identity,
// without inferring auth from the message or forcing another sign-in.
if (typeof BroadcastChannel !== 'undefined') {
  const accountChannel = new BroadcastChannel('careerconnect.account');
  accountChannel.addEventListener('message', (event) => {
    if (event.data?.source !== accountSource) location.reload();
  });
}
addEventListener('pageshow', (event) => { if (event.persisted) location.reload(); });

export function addReceipt(resume, size) {
  const session = readSession();
  if (!session) return;
  session.receipts.unshift({
    id: resume.id,
    originalName: resume.originalName,
    uploadedAt: resume.uploadedAt,
    size,
  });
  saveDisplaySession(session);
}
