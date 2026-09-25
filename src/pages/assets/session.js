// Display metadata only. This is not proof of authentication; the server
// authorizes every upload. Never store passwords or session tokens here.
const KEY = 'careerconnect.display-session';
const DISPLAY_TTL = 23 * 60 * 60 * 1000;

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
  sessionStorage.setItem(KEY, JSON.stringify(session));
  // Cookies are shared between tabs. Tell other open workspaces to reauthenticate
  // rather than displaying one account while uploading to another account.
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('careerconnect.account');
    channel.postMessage('signed-in');
    channel.close();
  }
}

export function clearDisplaySession() {
  sessionStorage.removeItem(KEY);
}

export function addReceipt(resume, size) {
  const session = readSession();
  if (!session) return;
  session.receipts.unshift({
    id: resume.id,
    originalName: resume.originalName,
    uploadedAt: resume.uploadedAt,
    size,
  });
  sessionStorage.setItem(KEY, JSON.stringify(session));
}
