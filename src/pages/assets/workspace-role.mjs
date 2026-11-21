export const RECRUITER_HOME = '/recruiter/overview.html';

export function workspaceAccount(role) {
  return role === 'recruiter' ? '/recruiter/account.html' : '/profile/index.html';
}

export function workspaceHome(role) {
  return role === 'recruiter' ? RECRUITER_HOME : '/dashboard/index.html';
}

// True on the signed-in home page for this role (where the idle warning applies).
export function isWorkspaceHome(pathname, role) {
  return role === 'recruiter'
    ? pathname === RECRUITER_HOME || /^\/recruiter\/dashboard(?:\.html)?\/?$/i.test(pathname)
    : /^\/dashboard(?:\/(?:index\.html)?)?$/i.test(pathname);
}

export function workspaceRedirect(pathname, role) {
  if (/^\/recruiter(?:\/|$)/i.test(pathname) && role !== 'recruiter') return '/dashboard/index.html';
  if (/^\/(?:dashboard|applications|resume)(?:\/(?:index\.html)?)?$/i.test(pathname) && role === 'recruiter') return RECRUITER_HOME;
  if (/^\/profile(?:\/(?:index\.html)?)?$/i.test(pathname) && role === 'recruiter') return workspaceAccount(role);
  return null;
}

export async function resolveWorkspaceAccess({ resolveSession, pathname, signInUrl }) {
  const session = await resolveSession({ force: true });
  return { session, redirect: session ? workspaceRedirect(pathname, session.user.role) : signInUrl() };
}

export function workspaceLinks(role) {
  if (role === 'recruiter') return [
    ['recruiter-overview', 'Overview', 'home', RECRUITER_HOME],
    ['recruiter', 'Manage postings', 'applications', '/recruiter/dashboard'],
    ['jobs', 'Browse jobs', 'briefcase', '/workspace/jobs/'],
    ['recruiter-account', 'My account', 'user', workspaceAccount(role)],
  ];
  return [
    ['dashboard', 'Overview', 'home', '/dashboard/index.html'],
    ['resume', 'Resume', 'file', '/resume/index.html'],
    ['jobs', 'Find jobs', 'briefcase', '/workspace/jobs/'],
    ['applications', 'Applications', 'applications', '/applications/index.html'],
    ['profile', 'My account', 'user', '/profile/index.html'],
  ];
}
