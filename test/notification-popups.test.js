const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { before, describe, test } = require('node:test');

const assets = path.join(__dirname, '..', 'src', 'pages', 'assets');

describe('Notification popups and idle warning (pure logic)', () => {
  let format;
  let idle;
  let role;
  before(async () => {
    format = await import('../src/pages/assets/notification-format.mjs');
    idle = await import('../src/pages/assets/idle-watcher.mjs');
    role = await import('../src/pages/assets/workspace-role.mjs');
  });

  const now = Date.parse('2026-11-09T12:00:00Z');
  const item = (id, extra = {}) => ({ id, read: false, createdAt: '2026-11-09 11:59:30', ...extra });

  test('the bell icon exists so the notification button does not fall back to the document icon', () => {
    const source = fs.readFileSync(path.join(assets, 'ui.js'), 'utf8');
    assert.match(source, /^\s*bell:\s*'<path/m);
  });

  test('idle warning waits 67 seconds', () => {
    assert.equal(idle.IDLE_WARNING_MS, 67000);
  });

  test('idle watcher fires once after the timeout and re-arms after activity', () => {
    let pending = null;
    let fired = 0;
    const watcher = idle.createIdleWatcher({
      onIdle: () => { fired += 1; },
      setTimer: (callback, ms) => {
        const timer = { ms, callback: () => { if (pending === timer) pending = null; callback(); } };
        pending = timer;
        return timer;
      },
      clearTimer: (handle) => { if (handle && pending === handle) pending = null; },
    });
    watcher.activity(); // Not started yet: ignored.
    assert.equal(pending, null);
    watcher.start();
    assert.equal(pending.ms, 67000);
    pending.callback();
    assert.equal(fired, 1);
    assert.equal(pending, null, 'does not repeat without new activity');
    watcher.activity();
    assert.equal(pending.ms, 67000, 'activity starts a fresh countdown');
    const first = pending;
    watcher.activity();
    assert.notEqual(pending, first, 'each activity replaces the countdown');
    pending.callback();
    assert.equal(fired, 2);
    watcher.stop();
    watcher.activity();
    assert.equal(pending, null);
  });

  test('popups only announce unread items newer than the last one announced, oldest first', () => {
    const items = [item(5), item(4, { read: true }), item(3), item(2)];
    assert.deepEqual(format.selectToastItems(items, { lastId: 2, now }).map((n) => n.id), [3, 5]);
    assert.deepEqual(format.selectToastItems(items, { lastId: 5, now }), []);
    assert.deepEqual(format.selectToastItems(null), []);
  });

  test('the first check after a page opens skips old unread backlog but keeps a fresh welcome', () => {
    const items = [item(9, { createdAt: '2026-11-09 11:59:50' }), item(8, { createdAt: '2026-11-01 08:00:00' }), item(7, { createdAt: 'nope' })];
    assert.deepEqual(format.selectToastItems(items, { now, initial: true }).map((n) => n.id), [9]);
    assert.deepEqual(format.selectToastItems(items, { now, initial: false }).map((n) => n.id), [7, 8, 9]);
  });

  test('at most three popups appear at once, keeping the newest', () => {
    const items = [1, 2, 3, 4, 5].map((id) => item(id));
    assert.deepEqual(format.selectToastItems(items, { now }).map((n) => n.id), [3, 4, 5]);
  });

  test('the idle warning applies only on each role’s own home page', () => {
    for (const pathname of ['/dashboard', '/dashboard/', '/dashboard/index.html']) {
      assert.equal(role.isWorkspaceHome(pathname, 'job_seeker'), true, pathname);
    }
    for (const pathname of ['/resume/index.html', '/jobs/', '/applications/index.html', '/profile/index.html']) {
      assert.equal(role.isWorkspaceHome(pathname, 'job_seeker'), false, pathname);
    }
    assert.equal(role.isWorkspaceHome('/recruiter/dashboard', 'recruiter'), true);
    assert.equal(role.isWorkspaceHome('/recruiter/dashboard.html', 'recruiter'), true);
    assert.equal(role.isWorkspaceHome('/dashboard/index.html', 'recruiter'), false);
  });
});
