const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function requireSameOrigin(request, response, next) {
  if (!MUTATIONS.has(request.method)) return next();
  const reject = () => response.status(403).json({ error: 'A same-origin request is required.' });
  try {
    // Express does not trust proxies by default. Do not trust forwarded host or
    // protocol headers here, or hard-code a development/production origin.
    const expected = new URL(`${request.protocol}://${request.get('host')}`).origin;
    const site = request.get('sec-fetch-site');
    if (site && site !== 'same-origin') return reject();
    const origin = request.get('origin');
    if (origin !== undefined) {
      const supplied = new URL(origin);
      if (!['http:', 'https:'].includes(supplied.protocol) || supplied.origin !== origin || supplied.origin !== expected) return reject();
    } else if (request.get('referer') !== undefined) {
      if (new URL(request.get('referer')).origin !== expected) return reject();
    }
  } catch {
    return reject();
  }

  // Missing Origin/Fetch Metadata is supported for non-browser clients. JSON
  // bodies and non-simple PATCH/DELETE methods require a browser CORS preflight;
  // this application grants no cross-origin access. Simple form posts fail.
  const hasBody = Number(request.get('content-length')) > 0 || Boolean(request.get('transfer-encoding'));
  if ((request.method !== 'DELETE' || hasBody) && !request.is('application/json')) {
    return response.status(400).json({ error: 'Recruiter request bodies must use application/json.' });
  }
  return next();
}

module.exports = { requireSameOrigin };
