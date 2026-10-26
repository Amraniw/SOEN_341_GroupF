export const RECRUITER_HOME = '/recruiter/dashboard';

export function workspaceHome(role) {
  return role === 'recruiter' ? RECRUITER_HOME : '/dashboard/index.html';
}

export function workspaceRedirect(pathname, role) {
  if (/^\/recruiter(?:\/|$)/i.test(pathname) && role !== 'recruiter') return '/dashboard/index.html';
  if (/^\/dashboard(?:\/(?:index\.html)?)?$/i.test(pathname) && role === 'recruiter') return RECRUITER_HOME;
  return null;
}

export async function resolveWorkspaceAccess({ resolveSession, pathname, signInUrl }) {
  const session = await resolveSession({ force: true });
  return { session, redirect: session ? workspaceRedirect(pathname, session.user.role) : signInUrl() };
}

export function workspaceLinks(role) {
  if (role === 'recruiter') return [
    ['recruiter', 'Recruiter dashboard', 'home', RECRUITER_HOME],
    ['postings', 'My job postings', 'briefcase', `${RECRUITER_HOME}#postings`],
    ['jobs', 'Browse jobs', 'briefcase', '/workspace/jobs/'],
    ['profile', 'My account', 'user', '/profile/index.html'],
  ];
  return [
    ['dashboard', 'Overview', 'home', '/dashboard/index.html'],
    ['jobs', 'Find jobs', 'briefcase', '/workspace/jobs/'],
    ['applications', 'Applications', 'applications', '/applications/index.html'],
    ['profile', 'My account', 'user', '/profile/index.html'],
    ['resume', 'Resume', 'file', '/resume/index.html'],
  ];
}
