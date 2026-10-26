const assert = require('node:assert/strict');
const { after, before, beforeEach, describe, test } = require('node:test');
const express = require('express');
const request = require('supertest');
const { createApp } = require('../src/app');
const { initializeDatabase } = require('../src/database/database');
const { createAuthorizeRecruiter } = require('../src/middleware/authorizeRecruiter');

describe('Feature 4 Phase 01: trusted identity and exclusive roles', () => {
  let database;
  let app;
  let jobId;
  const account = { name: 'Role QA', email: 'role@example.test', password: 'RoleTest2026!' };

  before(async () => {
    database = await initializeDatabase(':memory:');
    app = createApp(database, { sessionSecret: 'role-test-secret' });
  });
  beforeEach(async () => {
    await database.run('DELETE FROM users');
    await database.run('DELETE FROM jobs');
    const job = await database.run(
      "INSERT INTO jobs (title, company, location, category, description) VALUES ('Open role', 'Company', 'Montreal', 'engineering', 'Description')"
    );
    jobId = job.lastID;
  });
  after(async () => database.close());

  async function registerAndLogin(role) {
    const agent = request.agent(app);
    const registration = await agent.post('/api/register').send({ ...account, ...(role === undefined ? {} : { role }) }).expect(201);
    const login = await agent.post('/api/login').send(account).expect(200);
    return { agent, registration, login };
  }

  for (const role of [undefined, 'job_seeker', 'recruiter']) {
    test(`registration, login and restored sessions retain ${role || 'default job_seeker'}`, async () => {
      const expected = role || 'job_seeker';
      const { agent, registration, login } = await registerAndLogin(role);
      const session = await agent.get('/api/session').expect(200);
      for (const response of [registration, login, session]) {
        assert.equal(response.body.user.role, expected);
        assert.deepEqual(Object.keys(response.body.user).sort(), ['createdAt', 'email', 'id', 'name', 'role']);
      }
      assert.equal((await database.get('SELECT role FROM users WHERE id = ?', login.body.user.id)).role, expected);
      assert.equal(registration.headers['set-cookie'], undefined);
      const cookies = login.headers['set-cookie'];
      assert.match(cookies.join(';'), /httponly/i);
      assert.match(cookies.join(';'), /samesite=lax/i);
      const restored = await request(app).get('/api/session')
        .set('Cookie', cookies.map((cookie) => cookie.split(';')[0]).join('; ')).expect(200);
      assert.equal(restored.body.user.role, expected);
    });
  }

  test('unsupported role strings and non-string values are rejected without creating accounts', async () => {
    for (const role of ['admin', 'seeker', '', 'Recruiter', ' recruiter ', null, 1, true, [], {}, ['recruiter']]) {
      const response = await request(app).post('/api/register').send({ ...account, role }).expect(400);
      assert.equal(response.body.error, 'Choose a valid account role.');
    }
    assert.equal((await database.get('SELECT COUNT(*) AS total FROM users')).total, 0);
  });

  test('registration and login cannot elevate an existing account with a supplied role', async () => {
    const { agent, login } = await registerAndLogin();
    const stored = await database.get('SELECT * FROM users WHERE id = ?', login.body.user.id);
    await agent.post('/api/register').send({ ...account, role: 'recruiter' }).expect(409);
    const relogin = await agent.post('/api/login').send({ ...account, role: 'recruiter' }).expect(200);
    assert.equal(relogin.body.user.role, 'job_seeker');
    assert.equal((await agent.get('/api/session?role=recruiter').expect(200)).body.user.role, 'job_seeker');
    assert.deepEqual(await database.get('SELECT * FROM users WHERE id = ?', login.body.user.id), stored);
  });

  function recruiterProbe() {
    // Test-only mounting: no recruiter routes are added to the application.
    const probe = express();
    const authorizeRecruiter = createAuthorizeRecruiter(database);
    probe.use((req, res, next) => {
      req.session = req.headers['x-test-user-id'] ? { userId: Number(req.headers['x-test-user-id']) } : null;
      req.authenticatedUser = { role: 'recruiter' }; // Must not bypass real authentication.
      next();
    });
    probe.get('/', authorizeRecruiter, (req, res) => res.json({ role: req.authenticatedUser.role }));
    return probe;
  }

  test('recruiter middleware rejects anonymous, missing-account and forged-role access', async () => {
    const probe = recruiterProbe();
    await request(probe).get('/?role=recruiter').expect(401);
    await request(probe).get('/').set('x-test-user-id', '-1').expect(401);
    const { login } = await registerAndLogin();
    await request(probe).get('/?role=recruiter').set('x-test-user-id', String(login.body.user.id)).expect(403);
  });

  test('recruiter middleware reads current database role rather than cached or supplied roles', async () => {
    const { login } = await registerAndLogin('recruiter');
    const probe = recruiterProbe();
    const id = String(login.body.user.id);
    assert.equal((await request(probe).get('/?role=job_seeker').set('x-test-user-id', id).expect(200)).body.role, 'recruiter');
    await database.run("UPDATE users SET role = 'job_seeker' WHERE id = ?", Number(id));
    await request(probe).get('/?role=recruiter').set('x-test-user-id', id).expect(403);
  });

  test('recruiters cannot submit applications or generate history, even with a forged job-seeker role', async () => {
    const { agent } = await registerAndLogin('recruiter');
    await agent.post('/api/applications').send({ jobId }).expect(403);
    await agent.post('/api/applications').send({ jobId, role: 'job_seeker' }).expect(403);
    assert.equal((await database.get('SELECT COUNT(*) AS total FROM applications')).total, 0);
    assert.equal((await database.get('SELECT COUNT(*) AS total FROM application_status_history')).total, 0);
  });

  test('job seekers still submit with the original contract and no snapshot capture', async () => {
    const { agent } = await registerAndLogin();
    const response = await agent.post('/api/applications').send({ jobId }).expect(201);
    assert.equal(response.body.application.status, 'applied');
    assert.equal((await database.get('SELECT job_snapshot_json FROM applications WHERE id = ?', response.body.application.id)).job_snapshot_json, null);
    await agent.post('/api/applications').send({ jobId }).expect(409);
  });
});
