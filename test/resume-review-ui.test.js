const assert = require('node:assert/strict');
const { test } = require('node:test');

function element(children = {}) {
  const events = {};
  return {
    textContent: '',
    dataset: {},
    attributes: {},
    querySelector: (selector) => children[selector],
    addEventListener(name, listener) { events[name] = listener; },
    dispatch: (name) => events[name]({ preventDefault() {} }),
    replaceChildren(...nodes) { this.options = nodes; },
    classList: { toggle() {} },
    setAttribute(name, value) { this.attributes[name] = value; },
  };
}

async function setup(request) {
  const { createResumeReview } = await import('../src/pages/assets/resume-review.mjs');
  const form = element();
  const select = { ...element(), value: '', options: [{ value: '' }] };
  const label = element();
  const activity = element();
  const button = element({ '#review-action-label': label, '.review-activity': activity });
  const message = element();
  const statusFile = element();
  const status = element({ '#review-status-message': message, '#review-status-file': statusFile });
  const profile = element();
  const result = element({ p: profile, '#review-roles': element(), '#review-strengths': element(), '#review-improvements': element() });
  const loading = element();
  const content = element({ '#review-loading': loading });
  const output = element({ '#review-content': content });
  const panel = element({ form, select, button, '[role="status"]': status, '#review-output': output, '#resume-review-result': result });
  const document = { querySelector: () => panel, createElement: () => element() };
  const review = createResumeReview({ document, request, formatDateTime: String });
  review.setResumes([{ id: 1, originalName: 'First.pdf' }, { id: 2, originalName: 'Second.pdf', isDefault: true }]);
  function choose(id) {
    select.value = String(id);
    select.dispatch('change');
  }
  return { review, form, select, button, label, loading, status, message, statusFile, profile, result, choose };
}

const valid = {
  isResume: true, candidateProfile: 'Software candidate.', alignedRoles: ['Firmware Intern'],
  strengths: ['C experience'], improvements: ['Add results'], nonResumeMessage: null,
};

test('review uses the explicit selection, blocks duplicates, and reuses feedback after switching', async () => {
  const calls = [];
  let finish;
  const response = new Promise((resolve) => { finish = resolve; });
  const ui = await setup((path, body) => { calls.push({ path, body }); return response; });
  assert.equal(ui.button.disabled, true);
  ui.choose(1);
  const review = ui.form.dispatch('submit');
  await ui.form.dispatch('submit');
  assert.equal(ui.button.attributes['aria-disabled'], 'true');
  assert.equal(ui.button.disabled, false);
  assert.equal(ui.message.textContent, 'Reviewing');
  assert.match(ui.statusFile.textContent, /First\.pdf/);
  assert.equal(ui.loading.hidden, false);
  assert.deepEqual(calls, [{ path: '/resumes/1/ai-feedback', body: {} }]);
  finish({ resumeId: 1, feedback: valid });
  await review;
  assert.equal(ui.loading.hidden, true);
  assert.equal(ui.button.attributes['aria-disabled'], 'false');
  assert.equal(ui.status.dataset.state, 'complete');
  assert.equal(ui.profile.textContent, valid.candidateProfile);
  ui.choose(2);
  assert.equal(ui.result.hidden, true);
  ui.choose(1);
  assert.equal(ui.profile.textContent, valid.candidateProfile);
  assert.equal(ui.label.textContent, 'Analyze again');
  assert.equal(calls.length, 1);
});

test('review supports retry and discards a response if the selected resume was deleted', async () => {
  const responses = [() => Promise.reject({ status: 504 })];
  let finish;
  const delayed = new Promise((resolve) => { finish = resolve; });
  responses.push(() => delayed);
  const ui = await setup(() => responses.shift()());
  ui.choose(1);
  await ui.form.dispatch('submit');
  assert.match(ui.message.textContent, /took too long/);
  assert.equal(ui.label.textContent, 'Retry analysis');
  const retry = ui.form.dispatch('submit');
  ui.review.setResumes([{ id: 2, originalName: 'Second.pdf' }]);
  finish({ resumeId: 1, feedback: valid });
  await retry;
  assert.equal(ui.select.value, '');
  assert.equal(ui.result.hidden, true);
  assert.equal(ui.profile.textContent, '');
});
