const assert = require('node:assert/strict');
const { before, describe, test } = require('node:test');
const { readFile } = require('node:fs/promises');
const request = require('supertest');
const { createApp } = require('../src/app');
const { initializeDatabase } = require('../src/database/database');
const { JOB_CATEGORIES } = require('../src/domain/jobs');
const { readJobFields } = require('../src/domain/recruiterJobs');

let model;
let role;
let navigation;
let loadJobApplication;
let createRecruiterDashboard;
let html;
before(async () => {
  [model, role, navigation] = await Promise.all([
    import('../src/pages/assets/recruiter-form.mjs'), import('../src/pages/assets/workspace-role.mjs'),
    import('../src/pages/assets/job-context.mjs'),
  ]);
  ({ loadJobApplication } = await import('../src/pages/assets/job-application.mjs'));
  ({ createRecruiterDashboard } = await import('../src/pages/assets/recruiter-dashboard.mjs'));
  html = await readFile(require.resolve('../src/pages/recruiter/dashboard.html'), 'utf8');
});

// A small DOM test double, not a browser framework. IDs come from the actual
// page. HTML assignment throws so unsafe rendering cannot pass these tests.
class NodeFixture {
  constructor(tag, document) {
    this.tagName = tag.toUpperCase(); this.document = document; this.children = [];
    this.attributes = new Map(); this.listeners = new Map(); this.value = ''; this._text = '';
    this.hidden = false; this.disabled = false;
  }
  set innerHTML(value) { throw new Error('Unexpected innerHTML sink'); }
  set textContent(value) { this._text = String(value); this.replaceChildren(); }
  get textContent() { return this._text + this.children.map((node) => node.textContent).join(''); }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  replaceChildren(...nodes) { for (const node of this.children) node.parentNode = null; this.children = []; this.append(...nodes); }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((node) => node !== this); this.parentNode = null; }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  removeAttribute(key) { this.attributes.delete(key); }
  querySelectorAll(selector) {
    const match = (node) => selector.startsWith('[')
      ? node.attributes.has(selector.slice(1, -1)) : node.tagName === selector.toUpperCase();
    return this.children.flatMap((node) => [...(match(node) ? [node] : []), ...node.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(type, fn) { this.listeners.set(type, [...(this.listeners.get(type) || []), fn]); }
  async fire(type) { for (const fn of this.listeners.get(type) || []) await fn({ preventDefault() {}, currentTarget: this }); }
  focus() { this.document.activeElement = this; }
  showModal() { this.open = true; }
  close() { this.open = false; }
}
function page() {
  const roots = new Map();
  const document = {
    createElement: (tag) => new NodeFixture(tag, document),
    getElementById(id) {
      if (roots.has(id)) return roots.get(id);
      for (const root of roots.values()) {
        const walk = (node) => node.id === id ? node : node.children.map(walk).find(Boolean);
        const result = walk(root); if (result) return result;
      }
      return null;
    },
  };
  for (const match of html.matchAll(/<([a-z][a-z0-9]*)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const node = document.createElement(match[1]); node.id = match[2];
    node.hidden = /\bhidden\b/.test(match[0]); roots.set(node.id, node);
  }
  return document;
}
function fixture(api) {
  const document = page();
  const dashboard = createRecruiterDashboard({ document, request: api, formatDate: (value) => `Date ${value}` });
  return { document, dashboard, get: (id) => document.getElementById(id) };
}
function job(overrides = {}) {
  return {
    id: 1, title: 'Engineer', company: 'Team', location: 'Montreal', category: 'engineering',
    categoryName: 'Aerospace & Engineering', description: 'A complete description.',
    employmentType: 'Full-time', workplaceType: 'Hybrid', experienceLevel: 'Senior',
    details: { overview: 'Overview', responsibilities: ['Build things'], qualifications: ['JavaScript'], preferredSkills: ['SQLite'], benefits: ['Mentorship'], companyDescription: 'Independent team' },
    status: 'open', createdAt: '2026-10-25', applicationCount: 0, recruiterId: 7, ...overrides,
  };
}
function responses(items = []) {
  return async (path) => path === '/recruiter/overview'
    ? { overview: { totalPostings: items.length, openPostings: items.filter((item) => item.status === 'open').length, closedPostings: items.filter((item) => item.status === 'closed').length, totalApplications: items.reduce((sum, item) => sum + item.applicationCount, 0) } }
    : { items, total: items.length };
}

describe('Phase 03 role-aware workspace integration', () => {
  test('recruiter navigation excludes applicant actions and seeker navigation is preserved', () => {
    const recruiter = role.workspaceLinks('recruiter');
    assert.ok(recruiter.some((link) => link[3] === '/recruiter/dashboard'));
    assert.ok(!recruiter.some((link) => ['applications', 'resume'].includes(link[0])));
    assert.deepEqual(role.workspaceLinks('job_seeker').map((link) => link[0]), ['dashboard', 'jobs', 'applications', 'profile', 'resume']);
    assert.equal(role.workspaceHome('recruiter'), '/recruiter/dashboard');
    assert.equal(role.workspaceHome('job_seeker'), '/dashboard/index.html');
  });
  test('workspace gate uses server identity and redirects anonymous and non-recruiter visitors', async () => {
    for (const [user, expected] of [[null, '/auth/login.html?next=recruiter'], [{ role: 'job_seeker' }, '/dashboard/index.html'], [{ role: 'recruiter' }, null]]) {
      const result = await role.resolveWorkspaceAccess({
        pathname: '/recruiter/dashboard', signInUrl: () => '/auth/login.html?next=recruiter',
        resolveSession: async (options) => { assert.equal(options.force, true); return user ? { user } : null; },
      });
      assert.equal(result.redirect, expected);
    }
    for (const path of ['/dashboard', '/dashboard/', '/dashboard/index.html']) assert.equal(role.workspaceRedirect(path, 'recruiter'), '/recruiter/dashboard');
    assert.equal(role.workspaceRedirect('/Recruiter/Dashboard', 'job_seeker'), '/dashboard/index.html');
    assert.equal(role.workspaceRedirect('/workspace/jobs/1', 'recruiter'), null);
    await assert.rejects(role.resolveWorkspaceAccess({ resolveSession: async () => { throw new Error('Offline'); } }), /Offline/);
  });
  test('login return paths respect roles and reject external or unauthorized destinations', () => {
    const origin = 'https://careerconnect.example';
    assert.equal(navigation.workspaceReturnPath(null, origin, 'recruiter'), '/recruiter/dashboard');
    assert.equal(navigation.workspaceReturnPath('/recruiter/dashboard#postings', origin, 'recruiter'), '/recruiter/dashboard');
    assert.equal(navigation.workspaceReturnPath('/workspace/jobs/7?q=data', origin, 'recruiter'), '/workspace/jobs/7?q=data');
    for (const path of ['/applications/index.html', '//evil.example/recruiter/dashboard', 'javascript:alert(1)']) {
      assert.equal(navigation.workspaceReturnPath(path, origin, 'recruiter'), '/recruiter/dashboard');
    }
    assert.equal(navigation.workspaceReturnPath('/recruiter/dashboard', origin, 'job_seeker'), '/dashboard/index.html');
  });
  test('recruiters never load applicant data or receive a ready-to-apply state', async () => {
    const state = await loadJobApplication(7, {
      resolveSession: async () => ({ user: { role: 'recruiter' } }),
      request: async () => { assert.fail('Recruiters must not query applicant actions'); },
    });
    assert.deepEqual(state, { kind: 'recruiter' });
  });
  test('anonymous, job-seeker and failed session checks retain safe Apply behavior', async () => {
    assert.deepEqual(await loadJobApplication(7, { resolveSession: async () => null }), { kind: 'anonymous' });
    for (const application of [null, { id: 4, status: 'applied' }]) {
      const state = await loadJobApplication(7, {
        resolveSession: async () => ({ user: { role: 'job_seeker' } }),
        request: async (path, body, method) => { assert.equal(path, '/applications/job/7'); assert.equal(method, 'GET'); return { application }; },
      });
      assert.equal(state.kind, application ? 'applied' : 'ready');
    }
    await assert.rejects(loadJobApplication(7, { resolveSession: async () => { throw new Error('Offline'); } }), /Offline/);
    await assert.rejects(loadJobApplication(7, { resolveSession: async () => ({ user: { role: 'unknown' } }) }), /could not be verified/);
  });
});

describe('Phase 03 posting form contracts', () => {
  test('categories and complete form payload match the existing backend', () => {
    assert.deepEqual(model.CATEGORIES, JOB_CATEGORIES.map(({ id, name }) => [id, name]));
    const { payload, error } = model.postingPayload(model.postingDraft(job()));
    assert.equal(error, undefined);
    assert.equal(readJobFields(payload).error, undefined);
    for (const key of ['id', 'status', 'recruiterId', 'recruiter_id', 'demo_key', 'createdAt', 'created_at', 'applicationCount']) assert.equal(Object.hasOwn(payload, key), false);
  });
  test('an unchanged edit sends no PATCH and a changed title preserves optional sections', () => {
    const original = job();
    const draft = model.postingDraft(original);
    assert.deepEqual(model.postingPayload(draft, original).payload, {});
    draft.title = 'Updated title';
    assert.deepEqual(model.postingPayload(draft, original).payload, { title: 'Updated title' });
    assert.deepEqual(model.postingDraft(original).benefits, ['Mentorship']);
  });
  test('blank optional values can be intentionally cleared, including structured sections', () => {
    const original = job();
    const draft = model.postingDraft(original);
    draft.employmentType = '';
    draft.overview = ''; draft.companyDescription = '';
    for (const key of Object.keys(model.LISTS)) draft[key] = [];
    assert.deepEqual(model.postingPayload(draft, original).payload, { employmentType: null, details: null });
  });
  test('client validation catches required, enum, length, structured-list and request-size errors', () => {
    for (const patch of [{ title: '' }, { description: 'x'.repeat(5001) }, { category: 'unknown' }, { workplaceType: 'Office' },
      { overview: '', benefits: ['Benefit'] }, { title: '\0hidden' }, { responsibilities: Array(21).fill('Item') },
      { overview: 'x'.repeat(3001) }, { benefits: ['x'.repeat(1001)] }]) {
      assert.equal(typeof model.postingPayload({ ...model.postingDraft(job()), ...patch }).error, 'string');
    }
    const draft = model.postingDraft(job({ details: null }));
    draft.description = '漢'.repeat(4000);
    assert.match(model.postingPayload(draft).error, /10 KB/);
  });
});

describe('Phase 03 dashboard DOM behavior', () => {
  test('real overview values, owned list data and hostile text are rendered safely', async () => {
    const hostile = '<img src=x onerror=alert(1)> & "posting"';
    const item = job({ title: hostile, company: hostile });
    const { dashboard, get } = fixture(responses([item]));
    const pending = dashboard.load();
    assert.equal(get('recruiter-overview').getAttribute('aria-busy'), 'true');
    assert.equal(get('posting-retry').disabled, true);
    assert.match(get('posting-state').textContent, /Loading/);
    await pending;
    assert.equal(get('stat-total').textContent, '1');
    assert.equal(get('stat-open').textContent, '1');
    assert.equal(get('stat-applications').textContent, '0');
    assert.equal(get('posting-list').querySelector('h3').textContent, hostile);
    assert.equal(get('posting-list').querySelectorAll('img').length, 0);
    assert.equal(get('posting-list').getAttribute('aria-busy'), 'false');
  });
  test('empty state and independent API failures have retryable states', async () => {
    let fail = true;
    const { dashboard, get } = fixture(async (path) => {
      if (fail && path.endsWith('overview')) throw new Error('Service unavailable');
      return responses([])(path);
    });
    await dashboard.load();
    assert.match(get('overview-state').textContent, /unavailable/);
    assert.match(get('posting-list').textContent, /no job postings/);
    assert.equal(get('posting-retry').disabled, false);
    fail = false;
    await get('posting-retry').fire('click');
    assert.equal(get('stat-total').textContent, '0');
    assert.equal(get('overview-state').getAttribute('role'), 'status');
  });
  test('structured list entries are keyboard buttons that add and remove real input values', async () => {
    const { dashboard, get } = fixture(responses([]));
    dashboard.newPosting();
    const rows = get('posting-responsibilities');
    const add = rows.parentNode.querySelectorAll('button').find((button) => button.textContent === 'Add entry');
    await add.fire('click');
    assert.equal(rows.querySelectorAll('textarea').length, 1);
    rows.querySelector('textarea').value = 'New responsibility';
    await rows.querySelector('button').fire('click');
    assert.equal(rows.querySelectorAll('textarea').length, 0);
  });
  test('editing prepopulates every supported optional field and a cancelled edit sends nothing', async () => {
    const original = job({ title: '<script>literal</script>' });
    let calls = 0;
    const { dashboard, get } = fixture(async () => { calls++; return { job: original }; });
    await dashboard.edit(original.id);
    assert.equal(get('posting-title').value, original.title);
    assert.equal(get('posting-employmentType').value, 'Full-time');
    assert.equal(get('posting-benefits').querySelector('textarea').value, 'Mentorship');
    assert.equal(get('posting-companyDescription').value, 'Independent team');
    dashboard.cancelEdit();
    assert.equal(get('posting-editor').hidden, true);
    assert.equal(calls, 1);
  });
  test('failed saves preserve input, show API errors as text, and prevent duplicate pending requests', async () => {
    let release;
    let writes = 0;
    const { dashboard, get } = fixture(async () => { writes++; return new Promise((resolve, reject) => { release = reject; }); });
    dashboard.newPosting();
    for (const [key, value] of Object.entries(model.postingDraft(job({ details: null })))) {
      if (!Array.isArray(value)) get(`posting-${key}`).value = value;
    }
    const pending = dashboard.submit();
    assert.equal(get('save-posting').disabled, true);
    await dashboard.submit();
    assert.equal(writes, 1);
    release(Object.assign(new Error('<strong>Invalid title</strong>'), { status: 400 }));
    await pending;
    assert.equal(get('posting-title').value, 'Engineer');
    assert.equal(get('posting-editor').hidden, false);
    assert.equal(get('form-notice').textContent, '<strong>Invalid title</strong>');
    assert.equal(get('save-posting').disabled, false);
  });
  test('successful saves stay successful if the subsequent refresh fails', async () => {
    let writes = 0;
    const { dashboard, get } = fixture(async (path, body, method) => {
      if (method === 'POST') { writes++; return { job: job() }; }
      throw new Error('Refresh failed');
    });
    dashboard.newPosting();
    for (const [key, value] of Object.entries(model.postingDraft(job({ details: null })))) if (!Array.isArray(value)) get(`posting-${key}`).value = value;
    await dashboard.submit();
    assert.equal(writes, 1);
    assert.match(get('mutation-notice').textContent, /created successfully/);
    assert.match(get('posting-state').textContent, /Refresh failed/);
    assert.equal(get('posting-editor').hidden, true);
  });
  test('deletion requires confirmation, supports cancel, and explains a 409 conflict', async () => {
    let deletions = 0;
    const item = job();
    const { dashboard, get } = fixture(async (path, body, method) => {
      if (method === 'DELETE') { deletions++; throw Object.assign(new Error('Conflict'), { status: 409 }); }
      return responses([{ ...item, applicationCount: 1 }])(path);
    });
    dashboard.askDelete(item);
    assert.equal(get('delete-dialog').open, true);
    assert.equal(deletions, 0);
    dashboard.cancelDelete();
    await dashboard.confirmDelete();
    assert.equal(deletions, 0);
    dashboard.askDelete(item);
    await dashboard.confirmDelete();
    assert.equal(deletions, 1);
    assert.equal(get('delete-dialog').open, false);
    assert.match(get('mutation-notice').textContent, /Close it instead/);
    const remove = get('posting-list').querySelectorAll('button').find((button) => button.textContent === 'Delete');
    assert.equal(remove.disabled, true);
  });
  test('expired or forbidden API access is delegated to the existing authentication flow', async () => {
    for (const status of [401, 403]) {
      const document = page();
      const errors = [];
      const dashboard = createRecruiterDashboard({ document, formatDate: String,
        request: async () => { throw Object.assign(new Error('Access denied'), { status }); },
        onUnauthorized: (error) => errors.push(error.status),
      });
      await dashboard.load();
      assert.deepEqual(errors, [status, status]);
    }
  });
});

describe('Phase 03 page and real API integration', () => {
  test('dashboard aliases and native frontend assets are served by the existing Express app', async () => {
    const app = createApp({});
    for (const path of ['/recruiter/dashboard', '/recruiter/dashboard/', '/recruiter/dashboard.html']) {
      const response = await request(app).get(path).expect(200).expect('Content-Type', /html/);
      assert.equal(response.text, html);
      assert.match(response.text, /data-workspace hidden/);
      assert.match(response.text, /aria-labelledby="delete-heading"/);
    }
    for (const path of ['/assets/recruiter.js', '/assets/recruiter-dashboard.mjs', '/assets/workspace-role.mjs']) await request(app).get(path).expect(200).expect('Content-Type', /javascript/);
    await request(app).get('/assets/recruiter.css').expect(200).expect('Content-Type', /css/);
  });
  test('the actual UI controller creates, edits, closes, reopens and safely deletes through signed-cookie APIs', async () => {
    const database = await initializeDatabase(':memory:');
    try {
      const app = createApp(database, { sessionSecret: 'phase03-integration' });
      async function account(email, accountRole) {
        const agent = request.agent(app);
        await agent.post('/api/register').send({ name: 'UI QA', email, password: 'UiTest2026!', role: accountRole }).expect(201);
        await agent.post('/api/login').send({ email, password: 'UiTest2026!' }).expect(200);
        return agent;
      }
      const agent = await account('recruiter@example.test', 'recruiter');
      const seeker = await account('seeker@example.test', 'job_seeker');
      const access = await role.resolveWorkspaceAccess({ pathname: '/recruiter/dashboard', signInUrl: () => '/auth/login.html',
        resolveSession: async () => ({ user: (await agent.get('/api/session').expect(200)).body.user }),
      });
      assert.equal(access.redirect, null);
      const api = async (path, body, method) => {
        let pending = agent[method.toLowerCase()](`/api${path}`).set('Host', 'localhost:3000').set('Origin', 'http://localhost:3000');
        if (body !== undefined) pending = pending.send(body);
        const response = await pending;
        if (response.status >= 400) throw Object.assign(new Error(response.body.error), { status: response.status });
        return response.body;
      };
      const { dashboard, get } = fixture(api);
      await dashboard.load();
      assert.equal(get('stat-total').textContent, '0');
      dashboard.newPosting();
      for (const [key, value] of Object.entries(model.postingDraft(job({ details: null })))) if (!Array.isArray(value)) get(`posting-${key}`).value = value;
      get('posting-overview').value = 'Structured overview';
      await dashboard.submit();
      assert.equal(get('stat-total').textContent, '1');
      let saved = (await agent.get('/api/recruiter/jobs').expect(200)).body.items[0];
      await request(app).get(`/api/jobs/${saved.id}`).expect(200);
      await dashboard.edit(saved.id);
      get('posting-title').value = 'Updated from the UI';
      await dashboard.submit();
      saved = (await agent.get(`/api/recruiter/jobs/${saved.id}`).expect(200)).body.job;
      assert.equal(saved.title, 'Updated from the UI');
      assert.equal(saved.details.overview, 'Structured overview');
      assert.equal(saved.employmentType, 'Full-time');
      await dashboard.changeStatus(saved);
      assert.equal(get('stat-closed').textContent, '1');
      await request(app).get(`/api/jobs/${saved.id}`).expect(404);
      await dashboard.changeStatus({ ...saved, status: 'closed' });
      assert.equal(get('stat-open').textContent, '1');
      const application = await seeker.post('/api/applications').send({ jobId: saved.id }).expect(201);
      const before = await database.all('SELECT * FROM application_status_history');
      dashboard.askDelete(saved); // Stale count: the server must still protect applications.
      await dashboard.confirmDelete();
      assert.match(get('mutation-notice').textContent, /Close it instead/);
      assert.equal(get('stat-applications').textContent, '1');
      assert.deepEqual(await database.all('SELECT * FROM application_status_history'), before);
      await seeker.get(`/api/applications/${application.body.application.id}`).expect(200);
      dashboard.newPosting();
      for (const [key, value] of Object.entries(model.postingDraft(job({ details: null })))) if (!Array.isArray(value)) get(`posting-${key}`).value = value;
      await dashboard.submit();
      const empty = (await agent.get('/api/recruiter/jobs').expect(200)).body.items.find((item) => item.id !== saved.id);
      dashboard.askDelete(empty);
      await dashboard.confirmDelete();
      assert.equal(get('stat-total').textContent, '1');
      await agent.get(`/api/recruiter/jobs/${empty.id}`).expect(404);
      const applyState = await loadJobApplication(saved.id, { resolveSession: async () => access.session, request: () => assert.fail('Recruiter Apply request') });
      assert.equal(applyState.kind, 'recruiter');
    } finally { await database.close(); }
  });
});

describe('Sprint 3 posting-management improvements', () => {
  const GONE = 'This posting no longer exists. Your list has been refreshed.';
  // A fake recruiter API whose postings change like the real one, including the
  // 404 (worded by api.js as an outage) for a posting that no longer exists.
  function liveApi(initial) {
    let items = initial.map((item) => ({ ...item }));
    const missing = () => Object.assign(new Error('This service is not available right now. Please try again later.'), { status: 404 });
    const api = async (path, body, method) => {
      const [, id, status] = path.match(/^\/recruiter\/jobs\/(\d+)(\/status)?$/) || [];
      if (!id) return method === 'POST' ? { job: job({ id: 99 }) } : responses(items)(path);
      const posting = items.find((item) => item.id === Number(id));
      if (!posting) throw missing();
      if (status) posting.status = body.status;
      else if (method === 'DELETE') items = items.filter((item) => item !== posting);
      else if (method === 'PATCH') Object.assign(posting, body);
      return { job: posting };
    };
    return { api, remove: (id) => { items = items.filter((item) => item.id !== id); }, find: (id) => items.find((item) => item.id === id) };
  }
  const cards = (get) => get('posting-list').querySelectorAll('article');
  const card = (get, title) => cards(get).find((article) => article.querySelector('h3').textContent === title);

  test('a posting removed elsewhere is explained and refreshed instead of reported as an outage', async () => {
    // Status change: the list is refreshed and an unrelated draft is kept.
    let server = liveApi([job()]);
    let view = fixture(server.api);
    await view.dashboard.load();
    view.dashboard.newPosting();
    view.get('posting-title').value = 'Unsaved draft';
    server.remove(1);
    await view.dashboard.changeStatus(job());
    assert.equal(view.get('mutation-notice').textContent, GONE);
    assert.equal(view.get('mutation-notice').getAttribute('role'), 'alert');
    assert.equal(view.document.activeElement, view.get('mutation-notice'));
    assert.equal(cards(view.get).length, 0);
    assert.equal(view.get('posting-editor').hidden, false);
    assert.equal(view.get('posting-title').value, 'Unsaved draft');

    // Saving an edit of a removed posting closes its editor.
    server = liveApi([job({ id: 2 })]);
    view = fixture(server.api);
    await view.dashboard.load();
    await view.dashboard.edit(2);
    view.get('posting-title').value = 'Changed title';
    server.remove(2);
    await view.dashboard.submit();
    assert.equal(view.get('posting-editor').hidden, true);
    assert.equal(view.get('mutation-notice').textContent, GONE);
    assert.notEqual(view.get('form-notice').textContent, 'This service is not available right now. Please try again later.');

    // Deleting a posting that was already deleted is reported as done, not as a failure.
    server = liveApi([job({ id: 3 })]);
    view = fixture(server.api);
    await view.dashboard.load();
    view.dashboard.askDelete(server.find(3));
    server.remove(3);
    await view.dashboard.confirmDelete();
    assert.equal(view.get('delete-dialog').open, false);
    assert.equal(view.get('mutation-notice').textContent, 'This posting had already been deleted. Your list has been refreshed.');
    assert.equal(view.get('mutation-notice').getAttribute('role'), 'status');
  });

  test('closing and reopening keep focus on the posting and explain what each status means', async () => {
    const server = liveApi([job({ id: 1, title: 'First' }), job({ id: 2, title: 'Second', applicationCount: 2 })]);
    const { dashboard, document, get } = fixture(server.api);
    await dashboard.load();
    assert.match(card(get, 'Second').textContent, /can’t be deleted\. Close it instead to stop new applications/);

    await dashboard.changeStatus(server.find(2));
    const closed = card(get, 'Second');
    assert.equal(closed.className, 'panel recruiter-card recruiter-card-closed');
    assert.match(closed.textContent, /Hidden from job search and closed to new applications\. Existing applications are kept\./);
    assert.doesNotMatch(closed.textContent, /Close it instead/);
    assert.equal(document.activeElement.textContent, 'Reopen posting');
    assert.equal(document.activeElement.getAttribute('data-job-id'), '2');
    assert.match(get('mutation-notice').textContent, /“Second” is closed\. It is hidden from job search/);
    assert.equal(card(get, 'First').className, 'panel recruiter-card');

    await dashboard.changeStatus(server.find(2));
    assert.equal(card(get, 'Second').className, 'panel recruiter-card');
    assert.equal(document.activeElement.textContent, 'Close posting');
    assert.match(get('mutation-notice').textContent, /“Second” is open again and visible in job search/);

    // Editing a closed posting says its changes stay hidden until it is reopened.
    const edited = fixture(async () => ({ job: job({ status: 'closed' }) }));
    await edited.dashboard.edit(1);
    assert.match(edited.get('editor-help').textContent, /closed, so your changes stay hidden from job seekers until you reopen it/);
  });

  test('every invalid field is reported at once and nothing is sent until the form is valid', async () => {
    const empty = model.postingPayload(model.postingDraft(null));
    assert.deepEqual(empty.errors.map(({ field }) => field), ['title', 'company', 'location', 'category', 'description']);
    assert.equal(empty.error, 'Job title is required.');
    assert.equal(empty.field, 'title');
    assert.equal(model.postingPayload(model.postingDraft(job())).errors, undefined);

    let requests = 0;
    const { dashboard, document, get } = fixture(async () => { requests++; return {}; });
    dashboard.newPosting();
    await dashboard.submit();
    for (const key of ['title', 'company', 'location', 'category', 'description']) {
      assert.equal(get(`posting-${key}`).getAttribute('aria-invalid'), 'true', key);
    }
    assert.equal(get('posting-employmentType').getAttribute('aria-invalid'), null);
    assert.equal(get('form-notice').textContent,
      'Fix 5 fields: Job title is required. Company is required. Location is required. Category is required. Description is required.');
    assert.equal(document.activeElement, get('posting-title'));

    get('posting-title').value = 'Engineer';
    await dashboard.submit();
    assert.equal(get('posting-title').getAttribute('aria-invalid'), null);
    assert.match(get('form-notice').textContent, /^Fix 4 fields: Company is required\./);
    assert.equal(document.activeElement, get('posting-company'));
    assert.equal(requests, 0);
  });

  test('a closing date that has passed is flagged while the posting is still open', async () => {
    const document = page();
    const items = [
      job({ id: 1, title: 'Late', closingDate: '2026-11-14' }),
      job({ id: 2, title: 'Upcoming', closingDate: '2026-11-20' }),
      job({ id: 3, title: 'Closed late', status: 'closed', closingDate: '2026-11-14' }),
    ];
    const dashboard = createRecruiterDashboard({ document, request: responses(items), formatDate: String, now: () => new Date(2026, 10, 15, 9) });
    await dashboard.load();
    const get = (id) => document.getElementById(id);
    // A card is [heading row, facts row, actions, optional note].
    const closingFact = (title) => card(get, title).children[1].children.find((span) => /Clos/.test(span.textContent));
    assert.match(closingFact('Late').textContent, /^Closing date passed:/);
    assert.equal(closingFact('Late').className, 'recruiter-warning');
    assert.match(card(get, 'Late').textContent, /The closing date has passed, but job seekers can still apply until you close this posting\./);
    assert.match(closingFact('Upcoming').textContent, /^Closes /);
    assert.equal(card(get, 'Upcoming').querySelectorAll('p').length, 1); // company line only, no note
    assert.match(closingFact('Closed late').textContent, /^Closing date passed:/);
    assert.equal(closingFact('Closed late').className, undefined);
    assert.doesNotMatch(card(get, 'Closed late').textContent, /can still apply/);
  });

  test('confirmations appear beside the postings list and take focus after create and delete', async () => {
    const position = (id) => html.indexOf(`id="${id}"`);
    assert.ok(position('postings-heading') < position('mutation-notice') && position('mutation-notice') < position('posting-list'));

    const server = liveApi([job({ id: 4, title: 'Removable' })]);
    const { dashboard, document, get } = fixture(server.api);
    await dashboard.load();
    dashboard.newPosting();
    for (const [key, value] of Object.entries(model.postingDraft(job({ details: null })))) if (!Array.isArray(value)) get(`posting-${key}`).value = value;
    await dashboard.submit();
    assert.equal(get('mutation-notice').textContent, 'Posting created successfully. Job seekers can now find it in job search.');
    assert.equal(document.activeElement, get('mutation-notice'));

    dashboard.askDelete(server.find(4));
    await dashboard.confirmDelete();
    assert.equal(get('mutation-notice').textContent, '“Removable” was permanently deleted.');
    assert.equal(document.activeElement, get('mutation-notice'));
    assert.equal(server.find(4), undefined);
  });
});
