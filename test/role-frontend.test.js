const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { test } = require('node:test');

const moduleUrl = (source) => `data:text/javascript,${encodeURIComponent(source)}`;

test('browser display sessions retain both roles across login, reload and server restoration', async (context) => {
  const [apiSource, resolverSource, sessionSource] = await Promise.all([
    readFile(require.resolve('../src/pages/assets/api.js'), 'utf8'),
    readFile(require.resolve('../src/pages/assets/session-state.mjs'), 'utf8'),
    readFile(require.resolve('../src/pages/assets/session.js'), 'utf8'),
  ]);
  let sequence = 0;
  const loadPageSession = () => import(moduleUrl(sessionSource
    .replace("'./api.js'", JSON.stringify(moduleUrl(apiSource)))
    .replace("'./session-state.mjs'", JSON.stringify(moduleUrl(resolverSource))) + `\n// page ${sequence++}`));
  const storage = new Map();
  let serverUser;
  const globals = {
    sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    addEventListener() {},
    BroadcastChannel: class {
      postMessage() {}
      addEventListener() {}
      close() {}
    },
    fetch: async (url, options) => {
      assert.equal(url, '/api/session');
      assert.equal(options.credentials, 'same-origin');
      return { ok: true, json: async () => ({ user: serverUser }) };
    },
  };
  for (const [name, value] of Object.entries(globals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    context.after(() => {
      if (original) Object.defineProperty(globalThis, name, original);
      else delete globalThis[name];
    });
  }

  for (const role of ['job_seeker', 'recruiter']) {
    storage.clear();
    serverUser = { id: 7, name: 'Role QA', email: 'role@example.test', createdAt: '2026-10-01', role };
    const loginPage = await loadPageSession();
    loginPage.startSession(serverUser);
    assert.equal(loginPage.readSession().user.role, role);
    assert.equal((await loginPage.resolveSession()).user.role, role);

    const restoredPage = await loadPageSession();
    assert.equal(restoredPage.readSession().user.role, role);
    // Cached frontend metadata cannot override the role from the session API.
    const key = 'careerconnect.display-session';
    const cached = JSON.parse(storage.get(key));
    cached.user.role = role === 'recruiter' ? 'job_seeker' : 'recruiter';
    storage.set(key, JSON.stringify(cached));
    assert.equal((await restoredPage.resolveSession({ force: true })).user.role, role);
    assert.equal(restoredPage.readSession().user.role, role);
  }
});
