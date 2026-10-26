const assert = require('node:assert/strict');
const { after, before, beforeEach, describe, test } = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/app');
const { initializeDatabase } = require('../src/database/database');

const HOST = 'localhost:3000';
const ORIGIN = `http://${HOST}`;
const completeJob = {
  title: '  Software   Engineer  ', company: 'Example Company', location: 'Montreal, QC',
  category: ' SOFTWARE-ENGINEERING ', description: 'Build thoughtful interfaces.\nWork with a team.',
  employmentType: ' Full-time ', workplaceType: 'Hybrid', experienceLevel: 'Entry-level',
  details: {
    overview: ' Build thoughtful interfaces. ', responsibilities: [' Build APIs. ', 'Review code.'],
    qualifications: ['JavaScript'], preferredSkills: ['SQLite'], benefits: ['Mentorship'],
    companyDescription: ' An independent team. ',
  },
};
const requiredJob = { title: 'Engineer', company: 'Company', location: 'Montreal', category: 'engineering', description: 'A complete description.' };

describe('Feature 4 Phase 02: secure recruiter posting API', () => {
  let database;
  let app;
  let recruiter;
  let other;
  let seeker;

  before(async () => {
    database = await initializeDatabase(':memory:');
    app = createApp(database, { sessionSecret: 'recruiter-posting-test-secret' });
    async function account(email, role) {
      const agent = request.agent(app);
      const body = { name: 'Posting QA', email, password: 'PostingTest2026!', role };
      const registration = await agent.post('/api/register').send(body).expect(201);
      await agent.post('/api/login').send(body).expect(200);
      return { agent, id: registration.body.user.id };
    }
    recruiter = await account('first@example.test', 'recruiter');
    other = await account('second@example.test', 'recruiter');
    seeker = await account('seeker@example.test', 'job_seeker');
  });
  beforeEach(async () => {
    await database.run('DELETE FROM applications');
    await database.run('DELETE FROM jobs');
  });
  after(async () => database.close());

  function mutation(account, method, path, body) {
    const pending = account.agent[method](path).set('Host', HOST).set('Origin', ORIGIN);
    return body === undefined ? pending : pending.send(body);
  }
  async function create(account = recruiter, body = completeJob) {
    return (await mutation(account, 'post', '/api/recruiter/jobs', body).expect(201)).body.job;
  }
  async function apply(jobId) {
    return (await seeker.agent.post('/api/applications').send({ jobId }).expect(201)).body.application;
  }
  async function applicationState() {
    return {
      applications: await database.all('SELECT * FROM applications ORDER BY id'),
      history: await database.all('SELECT * FROM application_status_history ORDER BY id'),
    };
  }
  const endpoints = [
    ['get', '/overview'], ['get', '/jobs'], ['post', '/jobs', requiredJob],
    ['get', '/jobs/1'], ['patch', '/jobs/1', { title: 'Updated' }],
    ['patch', '/jobs/1/status', { status: 'closed' }], ['delete', '/jobs/1'],
  ];

  test('all seven endpoints require a real recruiter session', async () => {
    for (const [method, path, body] of endpoints) {
      const anonymous = { agent: request(app) };
      await mutation(anonymous, method, `/api/recruiter${path}`, body).expect(401);
      await mutation(seeker, method, `/api/recruiter${path}`, body).expect(403);
    }
    await request(app).get('/api/recruiter/jobs')
      .set('Cookie', 'careerconnect_session=eyJ1c2VySWQiOjF9; careerconnect_session.sig=invalid').expect(401);
  });

  test('a complete posting is normalized, owned by its recruiter, and publicly searchable', async () => {
    const job = await create();
    assert.equal(job.recruiterId, recruiter.id);
    assert.equal(job.status, 'open');
    assert.equal(job.title, 'Software Engineer');
    assert.equal(job.category, 'software-engineering');
    assert.equal(job.employmentType, 'Full-time');
    assert.equal(job.workplaceType, 'Hybrid');
    assert.equal(job.experienceLevel, 'Entry-level');
    assert.equal(job.applicationCount, 0);
    assert.deepEqual(job.details, {
      ...completeJob.details, overview: 'Build thoughtful interfaces.',
      responsibilities: ['Build APIs.', 'Review code.'], companyDescription: 'An independent team.',
    });
    const stored = await database.get('SELECT * FROM jobs WHERE id = ?', job.id);
    assert.equal(stored.demo_key, null);
    assert.equal(stored.recruiter_id, recruiter.id);
    assert.deepEqual(JSON.parse(stored.details_json), job.details);
    assert.ok(job.createdAt);
    const search = await request(app).get('/api/jobs').query({ q: 'thoughtful', location: 'montreal', category: 'software-engineering' }).expect(200);
    assert.equal(search.body.total, 1);
    assert.equal(search.body.items[0].id, job.id);
    assert.equal(search.body.items[0].isDemo, false);
    assert.equal(search.body.items[0].recruiterId, undefined);
    assert.equal(search.body.items[0].recruiter_id, undefined);
    const detail = await request(app).get(`/api/jobs/${job.id}`).expect(200);
    assert.deepEqual(detail.body.job.details, job.details);
  });

  test('required-only creation supports null optional fields and defaults to open', async () => {
    const job = await create(recruiter, requiredJob);
    for (const field of ['employmentType', 'workplaceType', 'experienceLevel', 'details']) assert.equal(job[field], null);
    assert.equal(job.status, 'open');
    const publicJob = (await request(app).get(`/api/jobs/${job.id}`).expect(200)).body.job;
    assert.equal(publicJob.description, requiredJob.description);
    assert.equal(publicJob.details, null);
  });

  test('owned listings include open and closed postings, counts, and stable newest-first ordering', async () => {
    const first = await create();
    const second = await create();
    const third = await create();
    await create(other);
    await apply(first.id);
    await mutation(recruiter, 'patch', `/api/recruiter/jobs/${second.id}/status`, { status: 'closed' }).expect(200);
    await database.run("UPDATE jobs SET created_at = '2026-10-02 09:00:00' WHERE id = ?", first.id);
    await database.run("UPDATE jobs SET created_at = '2026-10-03 09:00:00' WHERE id = ?", second.id);
    await database.run("UPDATE jobs SET created_at = '2026-10-03T09:00:00.000Z' WHERE id = ?", third.id);
    const result = await recruiter.agent.get('/api/recruiter/jobs').expect(200);
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.equal(result.body.total, 3);
    assert.deepEqual(result.body.items.map(({ id }) => id), [third.id, second.id, first.id]);
    assert.deepEqual(result.body.items.map(({ status }) => status), ['open', 'closed', 'open']);
    assert.equal(result.body.items[2].applicationCount, 1);
    assert.ok(result.body.items.every(({ recruiterId }) => recruiterId === recruiter.id));
  });

  test('owned details and PATCH preserve omitted fields, identity, creation time, and applications', async () => {
    const original = await create();
    await apply(original.id);
    const applicationBefore = await applicationState();
    const response = await mutation(recruiter, 'patch', `/api/recruiter/jobs/${original.id}`, { title: ' Updated   title ', workplaceType: 'Remote' }).expect(200);
    const expected = { ...original, title: 'Updated title', workplaceType: 'Remote', applicationCount: 1 };
    assert.deepEqual(response.body.job, expected);
    assert.deepEqual((await recruiter.agent.get(`/api/recruiter/jobs/${original.id}`).expect(200)).body.job, expected);
    assert.deepEqual(await applicationState(), applicationBefore);
    assert.equal((await request(app).get(`/api/jobs/${original.id}`).expect(200)).body.job.title, 'Updated title');
  });

  test('optional fields can be cleared and structured details can be replaced without clearing description', async () => {
    const original = await create();
    const cleared = await mutation(recruiter, 'patch', `/api/recruiter/jobs/${original.id}`, {
      employmentType: null, workplaceType: ' ', experienceLevel: null, details: null,
    }).expect(200);
    for (const key of ['employmentType', 'workplaceType', 'experienceLevel', 'details']) assert.equal(cleared.body.job[key], null);
    const replacement = { overview: 'New overview', benefits: [], qualifications: ['New skill'] };
    const replaced = await mutation(recruiter, 'patch', `/api/recruiter/jobs/${original.id}`, { details: replacement }).expect(200);
    assert.deepEqual(replaced.body.job.details, replacement);
    assert.equal(replaced.body.job.description, original.description);
  });

  test('another recruiter and an ownerless demo are indistinguishable from missing jobs', async () => {
    const foreign = await create(other);
    const demo = await database.run(
      "INSERT INTO jobs (title, company, location, category, description, demo_key) VALUES ('Demo', 'Team', 'Montreal', 'engineering', 'Demo description', 'us05-demo-1')"
    );
    const before = await database.all('SELECT * FROM jobs ORDER BY id');
    for (const id of [foreign.id, demo.lastID, 999999]) {
      for (const [method, suffix, body] of [
        ['get', '', undefined], ['patch', '', { title: 'Stolen' }],
        ['patch', '/status', { status: 'closed' }], ['delete', '', undefined],
      ]) {
        const response = await mutation(recruiter, method, `/api/recruiter/jobs/${id}${suffix}`, body).expect(404);
        assert.deepEqual(response.body, { error: 'This job posting could not be found.' });
      }
    }
    assert.deepEqual(await database.all('SELECT * FROM jobs ORDER BY id'), before);
    assert.deepEqual((await recruiter.agent.get('/api/recruiter/jobs').expect(200)).body, { items: [], total: 0 });
  });

  test('creation rejects missing, invalid, oversized, and unsupported fields without inserting', async () => {
    const invalid = [
      {}, [], { ...requiredJob, title: ' ' }, { ...requiredJob, company: null },
      { ...requiredJob, location: 42 }, { ...requiredJob, category: 'unknown' },
      { ...requiredJob, description: '' }, { ...requiredJob, title: 'x'.repeat(201) },
      { ...requiredJob, company: 'x'.repeat(201) }, { ...requiredJob, location: 'x'.repeat(201) },
      { ...requiredJob, description: 'x'.repeat(5001) },
      { ...requiredJob, employmentType: 'Part-time' }, { ...requiredJob, workplaceType: 'remote' },
      { ...requiredJob, experienceLevel: 'Expert' }, { ...requiredJob, employmentType: [] },
      { ...requiredJob, title: '\0hidden' }, { ...requiredJob, description: '\0hidden' },
    ];
    for (const key of ['recruiterId', 'recruiter_id', 'demo_key', 'demoKey', 'createdAt', 'created_at', 'id', 'status', 'details_json', 'applicationCount', 'role']) {
      invalid.push({ ...requiredJob, [key]: 'forged' });
    }
    for (const body of invalid) {
      const response = await mutation(recruiter, 'post', '/api/recruiter/jobs', body).expect(400);
      assert.equal(typeof response.body.error, 'string');
      assert.equal(response.body.stack, undefined);
    }
    assert.equal((await database.get('SELECT COUNT(*) AS total FROM jobs')).total, 0);
  });

  test('structured details reject invalid sections, lists, lengths and serialized JSON strings', async () => {
    const invalid = [
      'not an object', [], {}, { overview: '' }, { overview: 'x'.repeat(3001) },
      { overview: 'Valid', extra: 'unknown' }, { overview: 'Valid', responsibilities: 'text' },
      { overview: 'Valid', responsibilities: [' '] }, { overview: 'Valid', benefits: [1] },
      { overview: 'Valid', qualifications: ['x'.repeat(1001)] },
      { overview: 'Valid', preferredSkills: Array(21).fill('skill') },
      { overview: 'Valid', companyDescription: null }, { overview: 'Valid', companyDescription: 'x'.repeat(2001) },
      { overview: 'Valid', benefits: Array(7).fill('x'.repeat(900)) },
      { overview: '\0hidden' }, { overview: 'Valid', benefits: ['\0hidden'] },
      { overview: 'Valid', companyDescription: '\0hidden' },
    ];
    for (const details of invalid) {
      await mutation(recruiter, 'post', '/api/recruiter/jobs', { ...requiredJob, details }).expect(400);
    }
    const job = await create();
    for (const details of invalid) {
      await mutation(recruiter, 'patch', `/api/recruiter/jobs/${job.id}`, { details }).expect(400);
    }
    assert.deepEqual((await recruiter.agent.get(`/api/recruiter/jobs/${job.id}`).expect(200)).body.job, job);
  });

  test('PATCH rejects empty bodies, invalid fields, and attempts to change system data', async () => {
    const job = await create();
    for (const body of [{}, [], { title: null }, { title: '\0hidden' }, { category: 'unknown' }, { workplaceType: 'Office' },
      { recruiterId: other.id }, { recruiter_id: other.id }, { demo_key: 'key' },
      { created_at: '2000-01-01' }, { status: 'closed' }, { applications: [] },
      JSON.parse('{"__proto__":{"role":"recruiter"}}')]) {
      await mutation(recruiter, 'patch', `/api/recruiter/jobs/${job.id}`, body).expect(400);
    }
    assert.deepEqual((await recruiter.agent.get(`/api/recruiter/jobs/${job.id}`).expect(200)).body.job, job);
  });

  test('malformed posting IDs return safe validation errors for every ID-based endpoint', async () => {
    for (const id of ['abc', '0', '-1', '01', '1.5', '9007199254740992', encodeURIComponent("1 OR 1=1")]) {
      for (const [method, suffix, body] of [
        ['get', '', undefined], ['patch', '', { title: 'Updated' }],
        ['patch', '/status', { status: 'closed' }], ['delete', '', undefined],
      ]) {
        const response = await mutation(recruiter, method, `/api/recruiter/jobs/${id}${suffix}`, body).expect(400);
        assert.equal(typeof response.body.error, 'string');
        assert.equal(response.body.stack, undefined);
      }
    }
  });

  test('closing and reopening control public availability without changing application records or history', async () => {
    const job = await create();
    const application = await apply(job.id);
    const before = await applicationState();
    await mutation(recruiter, 'patch', `/api/recruiter/jobs/${job.id}/status`, { status: 'closed' }).expect(200);
    assert.equal((await request(app).get('/api/jobs').expect(200)).body.total, 0);
    await request(app).get(`/api/jobs/${job.id}`).expect(404);
    // A second seeker has not applied, so this exercises the closed-job check.
    const fresh = request.agent(app);
    await fresh.post('/api/register').send({ name: 'Second Seeker', email: 'second-seeker@example.test', password: 'PostingTest2026!' }).expect(201);
    await fresh.post('/api/login').send({ email: 'second-seeker@example.test', password: 'PostingTest2026!' }).expect(200);
    await fresh.post('/api/applications').send({ jobId: job.id }).expect(404);
    assert.equal((await seeker.agent.get(`/api/applications/${application.id}`).expect(200)).body.application.status, 'applied');
    assert.deepEqual(await applicationState(), before);
    await mutation(recruiter, 'patch', `/api/recruiter/jobs/${job.id}/status`, { status: 'open' }).expect(200);
    await request(app).get(`/api/jobs/${job.id}`).expect(200);
    assert.equal((await request(app).get('/api/jobs').expect(200)).body.total, 1);
    assert.deepEqual(await applicationState(), before);
    await fresh.post('/api/applications').send({ jobId: job.id }).expect(201);
  });

  test('status updates accept only a single open/closed value and are idempotent', async () => {
    const job = await create();
    for (const body of [{}, { status: 'draft' }, { status: 'archived' }, { status: null },
      { status: ' open ' }, { status: 'Open' }, { status: 'closed', title: 'Hidden edit' }, []]) {
      await mutation(recruiter, 'patch', `/api/recruiter/jobs/${job.id}/status`, body).expect(400);
    }
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await mutation(recruiter, 'patch', `/api/recruiter/jobs/${job.id}/status`, { status: 'closed' }).expect(200);
      assert.equal(response.body.job.status, 'closed');
    }
  });

  test('permanent deletion succeeds for an empty posting and later access is 404', async () => {
    const job = await create();
    await mutation(recruiter, 'delete', `/api/recruiter/jobs/${job.id}`).expect(200);
    await recruiter.agent.get(`/api/recruiter/jobs/${job.id}`).expect(404);
    await mutation(recruiter, 'delete', `/api/recruiter/jobs/${job.id}`).expect(404);
    await request(app).get(`/api/jobs/${job.id}`).expect(404);
  });

  test('deletion with applications returns 409 and preserves every record and status-history entry', async () => {
    const job = await create();
    const application = await apply(job.id);
    await database.run("UPDATE applications SET status = 'under_review' WHERE id = ?", application.id);
    const before = await applicationState();
    const response = await mutation(recruiter, 'delete', `/api/recruiter/jobs/${job.id}`).expect(409);
    assert.match(response.body.error, /Close it instead/);
    assert.deepEqual(await applicationState(), before);
    assert.ok(await database.get('SELECT id FROM jobs WHERE id = ?', job.id));
    await mutation(recruiter, 'patch', `/api/recruiter/jobs/${job.id}/status`, { status: 'closed' }).expect(200);
    await mutation(recruiter, 'delete', `/api/recruiter/jobs/${job.id}`).expect(409);
    assert.deepEqual(await applicationState(), before);
  });

  test('deletion rejects request fields instead of accepting an ownership override', async () => {
    const job = await create();
    await mutation(recruiter, 'delete', `/api/recruiter/jobs/${job.id}`, { recruiterId: other.id }).expect(400);
    assert.ok(await database.get('SELECT id FROM jobs WHERE id = ?', job.id));
  });

  test('overview counts owned open/closed postings and applications without join multiplication', async () => {
    assert.deepEqual((await recruiter.agent.get('/api/recruiter/overview').expect(200)).body.overview,
      { totalPostings: 0, openPostings: 0, closedPostings: 0, totalApplications: 0 });
    const first = await create();
    const second = await create();
    const foreign = await create(other);
    await apply(first.id);
    await apply(second.id);
    await apply(foreign.id);
    await database.run('INSERT INTO applications (user_id, job_id) VALUES (?, ?)', other.id, first.id);
    await mutation(recruiter, 'patch', `/api/recruiter/jobs/${second.id}/status`, { status: 'closed' }).expect(200);
    assert.deepEqual((await recruiter.agent.get('/api/recruiter/overview').expect(200)).body.overview,
      { totalPostings: 2, openPostings: 1, closedPostings: 1, totalApplications: 3 });
    assert.deepEqual((await other.agent.get('/api/recruiter/overview').expect(200)).body.overview,
      { totalPostings: 1, openPostings: 1, closedPostings: 0, totalApplications: 1 });
    const list = (await recruiter.agent.get('/api/recruiter/jobs').expect(200)).body.items;
    assert.equal(list.find(({ id }) => id === first.id).applicationCount, 2);
  });

  test('untrusted or malformed origins and cross-site metadata block every mutation method', async () => {
    const job = await create();
    for (const origin of ['https://attacker.example', 'http://localhost:3001', 'https://localhost:3000', 'null', 'not-an-origin', `${ORIGIN}/path`, `${ORIGIN}, https://attacker.example`]) {
      for (const [method, suffix, body] of [
        ['post', '', requiredJob], ['patch', `/${job.id}`, { title: 'Blocked' }],
        ['patch', `/${job.id}/status`, { status: 'closed' }], ['delete', `/${job.id}`, undefined],
      ]) {
        const pending = recruiter.agent[method](`/api/recruiter/jobs${suffix}`).set('Host', HOST).set('Origin', origin);
        await (body === undefined ? pending : pending.send(body)).expect(403);
      }
    }
    for (const site of ['cross-site', 'same-site', 'none', 'unknown']) {
      await recruiter.agent.patch(`/api/recruiter/jobs/${job.id}`).set('Host', HOST)
        .set('Sec-Fetch-Site', site).send({ title: 'Blocked' }).expect(403);
    }
    assert.deepEqual((await recruiter.agent.get(`/api/recruiter/jobs/${job.id}`).expect(200)).body.job, job);
  });

  test('same-origin mutations work on different local hosts and ports without forwarded-header trust', async () => {
    const job = await create();
    await recruiter.agent.patch(`/api/recruiter/jobs/${job.id}`).set('Host', '127.0.0.1:3410')
      .set('Origin', 'http://127.0.0.1:3410').set('Sec-Fetch-Site', 'same-origin').send({ title: 'Local update' }).expect(200);
    await recruiter.agent.patch(`/api/recruiter/jobs/${job.id}`).set('Host', HOST)
      .set('X-Forwarded-Host', 'attacker.example').set('X-Forwarded-Proto', 'https')
      .set('Origin', 'https://attacker.example').send({ title: 'Blocked' }).expect(403);
    await recruiter.agent.patch(`/api/recruiter/jobs/${job.id}`).set('Host', HOST)
      .set('Origin', ORIGIN).set('X-Forwarded-Host', 'attacker.example').send({ title: 'Trusted host' }).expect(200);
  });

  test('missing Origin supports JSON API clients and checks Referer/Fetch Metadata when provided', async () => {
    const created = await recruiter.agent.post('/api/recruiter/jobs').send(requiredJob).expect(201);
    const id = created.body.job.id;
    await recruiter.agent.patch(`/api/recruiter/jobs/${id}`).set('Host', HOST)
      .set('Referer', `${ORIGIN}/dashboard/`).send({ title: 'Referer update' }).expect(200);
    await recruiter.agent.patch(`/api/recruiter/jobs/${id}`).set('Host', HOST)
      .set('Referer', 'https://attacker.example/page').send({ title: 'Blocked' }).expect(403);
    await recruiter.agent.patch(`/api/recruiter/jobs/${id}`).set('Host', HOST)
      .set('Referer', 'malformed').send({ title: 'Blocked' }).expect(403);
    await recruiter.agent.patch(`/api/recruiter/jobs/${id}`).set('Sec-Fetch-Site', 'same-origin')
      .send({ title: 'Metadata update' }).expect(200);
    await recruiter.agent.post('/api/recruiter/jobs').type('form').send(requiredJob).expect(400);
    await recruiter.agent.post('/api/recruiter/jobs').type('text/plain').send(JSON.stringify(requiredJob)).expect(400);
    await recruiter.agent.delete(`/api/recruiter/jobs/${id}`).expect(200);
  });

  test('oversized and malformed JSON return safe 400 responses without changing existing APIs', async () => {
    const response = await mutation(recruiter, 'post', '/api/recruiter/jobs', { ...requiredJob, description: 'x'.repeat(12000) }).expect(400);
    assert.match(response.body.error, /10 KB/);
    await recruiter.agent.post('/api/recruiter/jobs').type('json').send('{broken').expect(400);
    assert.equal((await database.get('SELECT COUNT(*) AS total FROM jobs')).total, 0);
    await request(app).get('/api/jobs').expect(200);
  });

  test('simultaneous deletions have a single winner', async () => {
    const job = await create();
    const responses = await Promise.all([
      mutation(recruiter, 'delete', `/api/recruiter/jobs/${job.id}`),
      mutation(recruiter, 'delete', `/api/recruiter/jobs/${job.id}`),
    ]);
    assert.deepEqual(responses.map(({ status }) => status).sort(), [200, 404]);
    assert.deepEqual(await database.all('PRAGMA foreign_key_check'), []);
  });

  test('concurrent submission and deletion cannot orphan an application or delete a received application', async () => {
    const job = await create();
    const [deletion, submission] = await Promise.all([
      mutation(recruiter, 'delete', `/api/recruiter/jobs/${job.id}`),
      seeker.agent.post('/api/applications').send({ jobId: job.id }),
    ]);
    assert.ok([200, 409].includes(deletion.status));
    assert.ok([201, 404, 409].includes(submission.status));
    if (submission.status === 201) {
      assert.equal(deletion.status, 409);
      assert.ok(await database.get('SELECT id FROM jobs WHERE id = ?', job.id));
      assert.ok(await database.get('SELECT id FROM applications WHERE id = ?', submission.body.application.id));
    } else {
      assert.equal(deletion.status, 200);
    }
    assert.deepEqual(await database.all('PRAGMA foreign_key_check'), []);
    assert.equal((await database.get('SELECT COUNT(*) AS total FROM application_status_history')).total,
      (await database.get('SELECT COUNT(*) AS total FROM applications')).total);
  });

  test('a last-moment ownership change prevents edit, status change, and deletion', async (context) => {
    const jobs = [await create(), await create(), await create()];
    const originalRun = database.run.bind(database);
    let target;
    context.mock.method(database, 'run', async (sql, ...args) => {
      if (target && /^(UPDATE jobs SET|DELETE FROM jobs WHERE)/.test(sql)) {
        const id = target;
        target = null;
        await originalRun('UPDATE jobs SET recruiter_id = ? WHERE id = ?', other.id, id);
      }
      return originalRun(sql, ...args);
    });
    const operations = [
      ['patch', '', { title: 'Stolen' }], ['patch', '/status', { status: 'closed' }], ['delete', '', undefined],
    ];
    for (const [index, [method, suffix, body]] of operations.entries()) {
      target = jobs[index].id;
      await mutation(recruiter, method, `/api/recruiter/jobs/${target}${suffix}`, body).expect(404);
      const row = await database.get('SELECT * FROM jobs WHERE id = ?', jobs[index].id);
      assert.equal(row.recruiter_id, other.id);
      assert.equal(row.title, jobs[index].title);
      assert.equal(row.status, 'open');
    }
  });

  test('foreign-key deletion conflicts are safely mapped to 409', async (context) => {
    const job = await create();
    const originalRun = database.run.bind(database);
    context.mock.method(database, 'run', async (sql, ...args) => {
      if (sql.startsWith('DELETE FROM jobs WHERE')) {
        throw Object.assign(new Error('SQLITE_CONSTRAINT: FOREIGN KEY constraint failed'), { code: 'SQLITE_CONSTRAINT' });
      }
      return originalRun(sql, ...args);
    });
    const response = await mutation(recruiter, 'delete', `/api/recruiter/jobs/${job.id}`).expect(409);
    assert.match(response.body.error, /cannot be deleted/);
    assert.ok(await database.get('SELECT id FROM jobs WHERE id = ?', job.id));
  });

  test('unexpected database failures use the existing generic error response', async (context) => {
    context.mock.method(console, 'error', () => {});
    const originalAll = database.all.bind(database);
    context.mock.method(database, 'all', async (sql, ...args) => {
      if (sql.includes('applicationCount')) throw new Error('Private database internals');
      return originalAll(sql, ...args);
    });
    const response = await recruiter.agent.get('/api/recruiter/jobs').expect(500);
    assert.deepEqual(response.body, { error: 'An unexpected server error occurred.' });
  });
});
