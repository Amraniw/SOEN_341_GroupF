export const FILTER_KEYS = ['q', 'location', 'category'];

export function isWorkspaceJobs(pathname = globalThis.location?.pathname || '') {
  return /^\/workspace\/jobs(?:\/|$)/i.test(pathname);
}

export function jobsBasePath(pathname = globalThis.location?.pathname || '') {
  return isWorkspaceJobs(pathname) ? '/workspace/jobs/' : '/jobs/';
}

export function searchState(search = globalThis.location?.search || '') {
  const params = new URLSearchParams(search);
  const state = Object.fromEntries(FILTER_KEYS.map((key) => [key, (params.get(key) || '').trim().replace(/\s+/g, ' ')]));
  state.category = state.category.toLowerCase();
  return state;
}

export function searchParams(filters) {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) if (filters[key]) params.set(key, filters[key]);
  return params.toString();
}

export function jobsUrl(filters, pathname) {
  const query = searchParams(filters);
  return `${jobsBasePath(pathname)}${query ? `?${query}` : ''}`;
}

export function jobUrl(id, filters, pathname) {
  const query = searchParams(filters);
  return `${jobsBasePath(pathname)}${encodeURIComponent(id)}${query ? `?${query}` : ''}`;
}

export function workspaceReturnPath(next, origin) {
  try {
    const destination = new URL(next || '/dashboard/index.html', origin);
    const allowed = destination.origin === origin && (
      /^\/workspace\/jobs(?:\/|$)/i.test(destination.pathname) ||
      ['/dashboard/index.html', '/profile/index.html', '/resume/index.html'].includes(destination.pathname)
    );
    if (allowed) return destination.pathname + destination.search;
  } catch { /* Invalid return URLs use the ordinary workspace entry. */ }
  return '/dashboard/index.html';
}
