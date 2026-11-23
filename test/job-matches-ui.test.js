const assert = require('node:assert/strict');
const { test } = require('node:test');

function element() {
  const attributes = new Map();
  const listeners = new Map();
  return {
    children: [], dataset: {}, textContent: '', classList: { add() {} },
    setAttribute(name, value) { attributes.set(name, value); },
    getAttribute(name) { return attributes.get(name); },
    addEventListener(name, listener) { listeners.set(name, listener); },
    click() { return listeners.get('click')(); },
    append(...nodes) { this.children.push(...nodes); },
    replaceChildren(...nodes) { this.children = nodes; },
  };
}

async function mount(request, open = true) {
  const { initJobMatches } = await import('../src/pages/assets/job-matches.mjs');
  const keys = ['resume', 'source-label', 'toggle', 'disclosure', 'action', 'action-label', 'status', 'browse', 'results'];
  const nodes = Object.fromEntries(keys.map((name) => [`#job-match-${name}`, element()]));
  const panel = { ...element(), querySelector: (selector) => nodes[selector] };
  const main = { classList: { add() {} } };
  const document = { querySelector: (selector) => selector === '#main' ? main : panel, createElement: element };
  await initJobMatches({ document, request, icon: () => '<svg></svg>', initials: (company) => company[0], open });
  return Object.fromEntries(keys.map((key) => [key, nodes[`#job-match-${key}`]]));
}

test('jobs panel loads the resume name without AI, waits for an explicit click and links matches to job details', async () => {
  const calls = [];
  let finish;
  const response = new Promise((resolve) => { finish = resolve; });
  const resume = { id: 42, originalName: 'Developer.pdf' };
  const ui = await mount((...args) => {
    calls.push(args);
    return args[0] === '/resumes/current' ? { resume } : response;
  });
  assert.deepEqual(calls, [['/resumes/current', undefined, 'GET']]);
  assert.equal(ui.resume.textContent, 'Developer.pdf');
  const match = ui.action.click();
  await ui.action.click();
  assert.deepEqual(calls[1], ['/job-matches', {}]);
  assert.equal(calls.length, 2);
  assert.match(ui.status.textContent, /Reviewing your default resume/);
  finish({ resume, matches: [{
    job: { id: 12, title: '<Developer>', company: 'Careers', location: 'Toronto', workplaceType: 'Hybrid' },
    alignment: 'strong', summary: 'API work aligns with the job’s backend focus.',
    strengths: ['Built APIs', 'Designed schemas', 'Automated tests'], consideration: 'The posting also asks for Go.',
  }] });
  await match;
  const card = ui.results.children[0];
  assert.equal(card.children[0].children[1].children[1].textContent, '<Developer>');
  assert.equal(card.children.at(-1).href, '/workspace/jobs/12');
  assert.match(card.children[1].textContent, /Toronto · Hybrid/);
  assert.match(card.children[3].textContent, /backend focus/);
  assert.equal(card.children[4].children.length, 3);
  assert.match(card.children[5].children[1].textContent, /asks for Go/);
  assert.match(ui.status.textContent, /1 role to explore/);
});

test('jobs panel offers resume setup without starting a match when none exists', async () => {
  const ui = await mount((path) => {
    assert.equal(path, '/resumes/current');
    return { resume: null };
  }, false);
  assert.equal(ui.toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(ui.disclosure.inert, true);
  ui.toggle.click();
  assert.equal(ui.toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(ui.disclosure.inert, false);
  ui.toggle.click();
  assert.equal(ui.disclosure.inert, true);
  assert.equal(ui.action.getAttribute('aria-disabled'), 'true');
  assert.match(ui.status.textContent, /Set a default resume/);
  await ui.action.click();
});

test('a changed default refreshes the source and waits for another explicit match request', async () => {
  const calls = [];
  let resume = { id: 1, originalName: 'First.pdf' };
  const ui = await mount(async (path) => {
    calls.push(path);
    if (path === '/resumes/current') return { resume };
    resume = { id: 2, originalName: 'Second.pdf' };
    throw { status: 409, code: 'resume_changed', message: 'Your default resume changed. Try matching again with the current default.' };
  });
  await ui.action.click();
  assert.deepEqual(calls, ['/resumes/current', '/job-matches', '/resumes/current']);
  assert.equal(ui.resume.textContent, 'Second.pdf');
  assert.match(ui.status.textContent, /default resume changed/);
  assert.equal(ui.action.getAttribute('aria-disabled'), 'false');
});

test('legacy matches render their evidence without a strengths array and broken cards do not hide valid results', async () => {
  const resume = { id: 2, originalName: 'Developer.pdf' };
  const ui = await mount(async (path) => path === '/resumes/current' ? { resume } : { resume, matches: [
    null,
    { job: { id: 8, title: 'Developer', company: 'North' }, alignment: 'strong', reasons: [
      { resumeEvidence: 'React interfaces', postingEvidence: 'accessible frontend development' },
      { resumeEvidence: 'browser tests', postingEvidence: 'end-to-end testing' },
    ] },
  ] });
  await ui.action.click();
  assert.match(ui.status.textContent, /1 role to explore/);
  const card = ui.results.children[0];
  assert.match(card.children[3].textContent, /^The role calls for.*accessible frontend development.*Your resume.*React interfaces/);
  assert.equal(card.children[4].children.length, 2);
  assert.equal(card.children.at(-1).href, '/workspace/jobs/8');
});

test('malformed recommendations show a retry message instead of a JavaScript exception', async () => {
  const resume = { id: 2, originalName: 'Developer.pdf' };
  let malformed = true;
  const ui = await mount(async (path) => {
    if (path === '/resumes/current') return { resume };
    if (malformed) return { resume, matches: [{ job: { id: 8, title: 'Developer', company: 'North' }, strengths: 42 }] };
    throw new TypeError('strengths is not iterable');
  });
  await ui.action.click();
  assert.match(ui.status.textContent, /couldn’t read these recommendations/);
  assert.equal(ui['action-label'].textContent, 'Try again');
  malformed = false;
  await ui.action.click();
  assert.doesNotMatch(ui.status.textContent, /iterable/);
});

test('job matching keeps recovery actions available for failure and empty results', async () => {
  const resume = { id: 1, originalName: 'First.pdf' };
  let fails = true;
  const ui = await mount(async (path) => {
    if (path === '/resumes/current') return { resume };
    if (fails) throw { code: 'ai_connection' };
    return { resume, matches: [], outcome: 'no_matches' };
  });
  await ui.action.click();
  assert.match(ui.status.textContent, /could not reach OpenAI/);
  assert.equal(ui['action-label'].textContent, 'Try again');
  fails = false;
  await ui.action.click();
  assert.match(ui.status.textContent, /No strong matches/);
  assert.equal(ui.browse.hidden, false);
});
