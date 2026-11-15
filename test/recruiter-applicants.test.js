const assert = require('node:assert/strict');
const { before, describe, test } = require('node:test');
const { readFile } = require('node:fs/promises');

let createApplicantsPanel;
let html;
before(async () => {
  ({ createApplicantsPanel } = await import('../src/pages/assets/recruiter-applicants.mjs'));
  html = await readFile(require.resolve('../src/pages/recruiter/dashboard.html'), 'utf8');
});

// A small DOM test double. Assigning HTML throws, so applicant-supplied text can only
// ever reach the page through textContent.
class NodeFixture {
  constructor(tag, document) {
    this.tagName = tag.toUpperCase(); this.document = document; this.children = [];
    this.attributes = new Map(); this.listeners = new Map(); this.value = ''; this._text = '';
    this.hidden = false; this.disabled = false; this.className = ''; this.parentNode = null;
  }
  set innerHTML(value) { throw new Error('Unexpected innerHTML sink'); }
  set textContent(value) { this._text = String(value); this.replaceChildren(); }
  get textContent() { return this._text + this.children.map((node) => node.textContent).join(''); }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  replaceChildren(...nodes) { for (const node of this.children) node.parentNode = null; this.children = []; this.append(...nodes); }
  replaceWith(next) {
    const siblings = this.parentNode.children;
    siblings[siblings.indexOf(this)] = next;
    next.parentNode = this.parentNode; this.parentNode = null;
  }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  querySelectorAll(selector) {
    return this.children.flatMap((node) => [...(node.tagName === selector.toUpperCase() ? [node] : []), ...node.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(type, fn) { this.listeners.set(type, [...(this.listeners.get(type) || []), fn]); }
  async fire(type) { for (const fn of this.listeners.get(type) || []) await fn({ preventDefault() {}, currentTarget: this }); }
  focus() { this.document.activeElement = this; }
  showModal() { this.open = true; }
  close() { this.open = false; }
}

function setup(handler) {
  const roots = new Map();
  const document = {
    activeElement: null,
    createElement: (tag) => new NodeFixture(tag, document),
    getElementById: (id) => roots.get(id) || null,
  };
  for (const match of html.matchAll(/\bid="([^"]+)"/g)) {
    const node = document.createElement('div'); node.id = match[1]; roots.set(match[1], node);
  }
  const calls = [];
  const unauthorized = [];
  const request = async (path, body, method) => {
    calls.push({ path, body, method });
    return handler({ path, body, method });
  };
  const panel = createApplicantsPanel({
    document, request, formatDate: (value) => `Date ${value}`, onUnauthorized: (error) => unauthorized.push(error.status),
  });
  const card = document.createElement('article');
  const button = document.createElement('button');
  card.append(button);
  panel.attach({ id: 1, title: 'Backend Developer' }, card, button);
  return { document, calls, unauthorized, card, button, get: (id) => roots.get(id) };
}

const STATUSES = ['applied', 'under_review', 'interview', 'offered', 'rejected'].map((id) => ({
  id, name: { applied: 'Applied', under_review: 'Under Review', interview: 'Interview', offered: 'Offered', rejected: 'Rejected' }[id],
}));
function applicant(id, name, status = 'applied') {
  return {
    id, jobId: 1, status, statusLabel: STATUSES.find((item) => item.id === status).name,
    appliedAt: '2026-11-10', updatedAt: '2026-11-10', applicant: { id: id + 10, name, email: `${name.split(' ')[0].toLowerCase()}@example.test` },
  };
}
function api(initial) {
  let items = initial;
  return ({ path, body, method }) => {
    if (method === 'GET') return { job: { id: 1 }, items, total: items.length, statuses: STATUSES };
    const id = Number(path.match(/applications\/(\d+)\/status/)[1]);
    const current = items.find((item) => item.id === id);
    const changed = current.status !== body.status;
    const updated = { ...current, status: body.status, statusLabel: STATUSES.find((item) => item.id === body.status).name };
    items = items.map((item) => (item.id === id ? updated : item));
    return { message: 'ok', changed, application: updated };
  };
}
const rows = (card) => card.querySelector('section').querySelector('ul').children;
const pick = async (row, status) => {
  const select = row.querySelector('select'); select.value = status; await select.fire('change');
  return row.querySelector('button');
};

describe('Recruiter applicant review panel', () => {
  test('the dashboard page ships the decision dialog the panel relies on', () => {
    for (const id of ['decision-dialog', 'decision-heading', 'decision-copy', 'decision-notice', 'cancel-decision', 'confirm-decision']) {
      assert.match(html, new RegExp(`id="${id}"`));
    }
  });

  test('opens lazily, lists applicants with a summary, and toggles without refetching', async () => {
    const view = setup(api([applicant(2, 'Alex Applicant', 'interview'), applicant(1, 'Sam Seeker')]));
    assert.equal(view.card.querySelector('section'), null, 'nothing loads until the button is used');

    await view.button.fire('click');
    assert.equal(view.button.getAttribute('aria-expanded'), 'true');
    assert.deepEqual(view.calls, [{ path: '/recruiter/jobs/1/applications', body: undefined, method: 'GET' }]);
    const section = view.card.querySelector('section');
    assert.equal(section.getAttribute('aria-label'), 'Applicants for Backend Developer');
    assert.match(section.textContent, /2 applicants · 1 applied · 1 interview/);
    assert.match(section.textContent, /Alex Applicant/);
    assert.match(section.textContent, /sam@example\.test/);
    assert.equal(rows(view.card).length, 2);

    await view.button.fire('click');
    assert.equal(section.hidden, true);
    assert.equal(view.button.getAttribute('aria-expanded'), 'false');
    await view.button.fire('click');
    assert.equal(section.hidden, false);
    assert.equal(view.calls.length, 1, 'reopening does not fetch again');
  });

  test('moving to review or interview saves immediately and confirms who was notified', async () => {
    const view = setup(api([applicant(1, 'Sam Seeker')]));
    await view.button.fire('click');
    const row = rows(view.card)[0];
    const save = await pick(row, 'interview');
    assert.equal(save.disabled, false);

    await save.fire('click');
    assert.deepEqual(view.calls[1], { path: '/recruiter/applications/1/status', body: { status: 'interview' }, method: 'PATCH' });
    assert.equal(view.get('decision-dialog').open, undefined, 'no confirmation for routine steps');

    const updated = rows(view.card)[0];
    assert.match(updated.textContent, /Interview/);
    assert.match(updated.textContent, /Moved to Interview\. Sam Seeker was notified\./);
    assert.match(view.card.querySelector('section').textContent, /1 applicant · 1 interview/);
    assert.equal(view.document.activeElement, updated.querySelector('select'), 'focus stays on the row');
  });

  test('offers and declines ask for confirmation before anything is sent', async () => {
    const view = setup(api([applicant(1, 'Sam Seeker')]));
    await view.button.fire('click');

    const save = await pick(rows(view.card)[0], 'offered');
    await save.fire('click');
    assert.equal(view.calls.length, 1, 'nothing is sent while the dialog is open');
    assert.equal(view.get('decision-dialog').open, true);
    assert.equal(view.get('decision-heading').textContent, 'Send a job offer?');
    assert.match(view.get('decision-copy').textContent, /Sam Seeker will be offered the Backend Developer position and notified right away\./);
    assert.equal(view.get('confirm-decision').textContent, 'Send offer');

    await view.get('confirm-decision').fire('click');
    assert.equal(view.get('decision-dialog').open, false);
    assert.deepEqual(view.calls[1].body, { status: 'offered' });
    assert.match(rows(view.card)[0].textContent, /Moved to Offered\. Sam Seeker was notified\./);
  });

  test('going back from a decline sends nothing and returns focus to the update button', async () => {
    const view = setup(api([applicant(1, 'Sam Seeker')]));
    await view.button.fire('click');
    const save = await pick(rows(view.card)[0], 'rejected');
    await save.fire('click');
    assert.equal(view.get('decision-heading').textContent, 'Decline this application?');
    assert.equal(view.get('confirm-decision').textContent, 'Decline application');

    await view.get('cancel-decision').fire('click');
    assert.equal(view.get('decision-dialog').open, false);
    assert.equal(view.calls.length, 1);
    assert.equal(view.document.activeElement, save);
    assert.equal(rows(view.card)[0].querySelector('select').value, 'rejected', 'the choice is kept so it can be changed');
  });

  test('picking the current status disables saving, and failures are shown without losing the row', async () => {
    const failing = setup(({ method }) => {
      if (method === 'GET') return { items: [applicant(1, 'Sam Seeker')], statuses: STATUSES };
      throw Object.assign(new Error('The server is unavailable.'), { status: 500 });
    });
    await failing.button.fire('click');
    const row = rows(failing.card)[0];
    const save = row.querySelector('button');
    assert.equal(save.disabled, true);
    await pick(row, 'under_review');
    await save.fire('click');
    assert.match(row.textContent, /The server is unavailable\./);
    assert.equal(row.querySelector('select').disabled, false);
    assert.equal(save.disabled, false);
    assert.deepEqual(failing.unauthorized, []);

    const expired = setup(({ method }) => {
      if (method === 'GET') return { items: [applicant(1, 'Sam Seeker')], statuses: STATUSES };
      throw Object.assign(new Error('Authentication required.'), { status: 401 });
    });
    await expired.button.fire('click');
    await (await pick(rows(expired.card)[0], 'under_review')).fire('click');
    assert.deepEqual(expired.unauthorized, [401]);
  });

  test('applicant text is rendered as text, never as markup, and load errors are reported', async () => {
    const hostile = setup(api([applicant(1, '<img src=x onerror=alert(1)>')]));
    await hostile.button.fire('click');
    assert.match(rows(hostile.card)[0].textContent, /<img src=x onerror=alert\(1\)>/);

    const broken = setup(() => { throw Object.assign(new Error('Could not load.'), { status: 500 }); });
    await broken.button.fire('click');
    assert.match(broken.card.querySelector('section').textContent, /Could not load\./);
    await broken.button.fire('click');
    await broken.button.fire('click');
    assert.equal(broken.calls.length, 2, 'a failed load is retried when the panel is opened again');
  });

  test('an empty posting says so', async () => {
    const view = setup(api([]));
    await view.button.fire('click');
    assert.match(view.card.querySelector('section').textContent, /No applications yet\./);
  });
});
