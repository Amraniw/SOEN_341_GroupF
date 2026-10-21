const assert = require('node:assert/strict');
const { after, before, beforeEach, describe, test } = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/app');
const { initializeDatabase } = require('../src/database/database');
const { APPLICATION_STATUSES } = require('../src/domain/applications');

describe('US-06 and US-07: job application submission and tracking', () => {
  let database;
  let app;
  let openJobId;
  let closedJobId;
  let userSequence = 0;

  before(async () => {
    database = await initializeDatabase(':memory:');
    app = createApp(database, { sessionSecret: 'careerconnect-applications-test-secret' });
  });

  after(async () => database.close());

  beforeEach(async () => {
    await database.run('DELETE FROM users');
    await database.run('DELETE FROM jobs');
    const open = await database.run(
      `INSERT INTO jobs (title, company, location, category, description, status, employment_type, workplace_type)
       VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`,
      'Frontend Developer', 'Northstar Studio', 'Montreal, QC',
      'software-engineering', 'Build thoughtful interfaces.', 'Full-time', 'Hybrid'
    );
    const closed = await database.run(
      `INSERT INTO jobs (title, company, location, category, description, status)
       VALUES (?, ?, ?, ?, ?, 'closed')`,
      'Archived Developer', 'Old Studio', 'Toronto, ON',
      'software-engineering', 'This role is closed.'
    );
    openJobId = open.lastID;
    closedJobId = closed.lastID;
  });

  async function signedInAgent(name = 'Taylor Applicant') {
    userSequence += 1;
    const email = `applicant-${userSequence}@example.com`;
    const agent = request.agent(app);
    await agent.post('/api/register').send({ name, email, password: 'DemoPass123' }).expect(201);
    await agent.post('/api/login').send({ email, password: 'DemoPass123' }).expect(200);
    return agent;
  }

  test('submission requires a signed-in user and a valid open job', async () => {
    await request(app).get('/api/applications').expect(401);
    await request(app).get(`/api/applications/job/${openJobId}`).expect(401);
    await request(app).post('/api/applications').send({ jobId: openJobId }).expect(401);

    const agent = await signedInAgent();
    for (const body of [{}, { jobId: 0 }, { jobId: '1' }, { jobId: openJobId, status: 'offered' }]) {
      const response = await agent.post('/api/applications').send(body).expect(400);
      assert.equal(typeof response.body.error, 'string');
    }
    assert.equal((await agent.post('/api/applications').send({ jobId: closedJobId }).expect(404)).body.error, 'This job posting is no longer available.');
    await agent.post('/api/applications').send({ jobId: 999999 }).expect(404);
  });

  test('a successful submission is persisted with Applied status and a confirmation', async () => {
    const agent = await signedInAgent();
    const response = await agent.post('/api/applications').send({ jobId: openJobId }).expect(201);

    assert.equal(response.body.message, 'Application submitted successfully.');
    assert.equal(response.body.application.jobId, openJobId);
    assert.equal(response.body.application.status, 'applied');
    assert.equal(response.body.application.statusLabel, 'Applied');
    assert.equal(response.body.application.job.title, 'Frontend Developer');
    assert.ok(response.body.application.appliedAt);

    const stored = await database.get('SELECT * FROM applications WHERE id = ?', response.body.application.id);
    assert.equal(stored.job_id, openJobId);
    assert.equal(stored.status, 'applied');
    const history = await database.all('SELECT status FROM application_status_history WHERE application_id = ?', stored.id);
    assert.deepEqual(history, [{ status: 'applied' }]);
  });

  test('the same user cannot submit a duplicate application', async () => {
    const agent = await signedInAgent();
    await agent.post('/api/applications').send({ jobId: openJobId }).expect(201);
    const duplicate = await agent.post('/api/applications').send({ jobId: openJobId }).expect(409);
    assert.equal(duplicate.body.error, 'You have already applied for this job.');
    assert.equal(duplicate.body.application.status, 'applied');
    assert.equal((await database.get('SELECT COUNT(*) AS total FROM applications')).total, 1);
  });

  test('applications are private to the authenticated user', async () => {
    const first = await signedInAgent('First Applicant');
    const second = await signedInAgent('Second Applicant');
    const submitted = await first.post('/api/applications').send({ jobId: openJobId }).expect(201);

    assert.equal((await first.get('/api/applications').expect(200)).body.total, 1);
    assert.equal((await second.get('/api/applications').expect(200)).body.total, 0);
    assert.equal((await second.get(`/api/applications/job/${openJobId}`).expect(200)).body.application, null);
    await second.get(`/api/applications/${submitted.body.application.id}`).expect(404);
  });

  test('the application list and job lookup restore persisted state after submission', async () => {
    const agent = await signedInAgent();
    const submitted = await agent.post('/api/applications').send({ jobId: openJobId }).expect(201);
    const lookup = await agent.get(`/api/applications/job/${openJobId}`).expect(200);
    const list = await agent.get('/api/applications').expect(200);

    assert.equal(lookup.body.application.id, submitted.body.application.id);
    assert.equal(list.body.total, 1);
    assert.deepEqual(list.body.statuses, APPLICATION_STATUSES);
    assert.equal(list.body.items[0].job.company, 'Northstar Studio');
    assert.equal(list.body.items[0].job.employmentType, 'Full-time');
    assert.equal(list.body.items[0].job.workplaceType, 'Hybrid');
  });

  test('all required status changes are validated, labelled and recorded in history', async () => {
    const agent = await signedInAgent();
    const submitted = await agent.post('/api/applications').send({ jobId: openJobId }).expect(201);
    const applicationId = submitted.body.application.id;

    for (const { id, name } of APPLICATION_STATUSES.slice(1)) {
      await database.run('UPDATE applications SET status = ? WHERE id = ?', id, applicationId);
      const detail = await agent.get(`/api/applications/${applicationId}`).expect(200);
      assert.equal(detail.body.application.status, id);
      assert.equal(detail.body.application.statusLabel, name);
    }

    const detail = await agent.get(`/api/applications/${applicationId}`).expect(200);
    assert.deepEqual(
      detail.body.application.history.map(({ status, statusLabel }) => [status, statusLabel]),
      APPLICATION_STATUSES.map(({ id, name }) => [id, name])
    );
    await assert.rejects(
      database.run("UPDATE applications SET status = 'unknown' WHERE id = ?", applicationId),
      /CHECK/
    );
  });

  test('database constraints enforce one application per user and clean up account data', async () => {
    const agent = await signedInAgent();
    const submitted = await agent.post('/api/applications').send({ jobId: openJobId }).expect(201);
    const row = await database.get('SELECT user_id, job_id FROM applications WHERE id = ?', submitted.body.application.id);
    await assert.rejects(
      database.run('INSERT INTO applications (user_id, job_id) VALUES (?, ?)', row.user_id, row.job_id),
      /UNIQUE/
    );
    await database.run('DELETE FROM users WHERE id = ?', row.user_id);
    assert.equal((await database.get('SELECT COUNT(*) AS total FROM applications')).total, 0);
    assert.equal((await database.get('SELECT COUNT(*) AS total FROM application_status_history')).total, 0);
  });

  test('closing a job preserves its submitted application and deleting it is restricted', async () => {
    const agent = await signedInAgent();
    const submitted = await agent.post('/api/applications').send({ jobId: openJobId }).expect(201);
    await database.run("UPDATE jobs SET status = 'closed' WHERE id = ?", openJobId);
    const tracked = await agent.get(`/api/applications/${submitted.body.application.id}`).expect(200);
    assert.equal(tracked.body.application.job.title, 'Frontend Developer');
    assert.equal(tracked.body.application.status, 'applied');
    await assert.rejects(database.run('DELETE FROM jobs WHERE id = ?', openJobId), /FOREIGN KEY/);
  });

  test('malformed identifiers fail safely without exposing internal data', async () => {
    const agent = await signedInAgent();
    for (const id of ['abc', '0', '-1', '1.5', '9007199254740992']) {
      const lookup = await agent.get(`/api/applications/job/${id}`).expect(400);
      assert.equal(lookup.body.stack, undefined);
      const detail = await agent.get(`/api/applications/${id}`).expect(404);
      assert.equal(detail.body.stack, undefined);
    }
  });

  test('the authenticated application dashboard is available as an HTML route', async () => {
    const page = await request(app).get('/applications/index.html').expect(200).expect('Content-Type', /html/);
    assert.match(page.text, /Your application journey/);
    assert.match(page.text, /application-list/);
  });
});
