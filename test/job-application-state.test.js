const assert = require('node:assert/strict');
const { before, describe, test } = require('node:test');

describe('Job page application state', () => {
  let loadJobApplication;
  before(async () => {
    ({ loadJobApplication } = await import('../src/pages/assets/job-application.mjs'));
  });

  const load = (application) =>
    loadJobApplication(7, {
      resolveSession: async () => ({ user: { role: 'job_seeker' } }),
      request: async () => ({ application }),
    });

  test('an active application means the job was already applied for', async () => {
    const application = { id: 1, status: 'applied', quitAt: null };
    assert.deepEqual(await load(application), { kind: 'applied', application });
  });

  test('no application, or a job the person left, offers Apply again', async () => {
    assert.deepEqual(await load(null), { kind: 'ready' });
    assert.deepEqual(await load({ id: 1, status: 'offered', quitAt: '2026-11-16 10:00:00' }), { kind: 'ready' });
  });
});
