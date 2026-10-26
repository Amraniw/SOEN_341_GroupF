const assert = require('node:assert/strict');
const { after, before, beforeEach, describe, test } = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/app');
const { initializeDatabase } = require('../src/database/database');

describe('Application-wide cookie session', () => {
  let database;
  let app;
  const user = { name: 'Session QA', email: 'session@example.test', password: 'SessionReview2026!' };
  before(async () => {
    database = await initializeDatabase(':memory:');
    app = createApp(database, { sessionSecret: 'session-integration-test-secret' });
  });
  beforeEach(async () => database.run('DELETE FROM users'));
  after(async () => database.close());

  async function signedIn() {
    const agent = request.agent(app);
    await agent.post('/api/register').send(user).expect(201);
    const login = await agent.post('/api/login').send(user).expect(200);
    return { agent, login };
  }

  test('anonymous lookup returns null without creating a session, and is not cached', async () => {
    const response = await request(app).get('/api/session').expect(200);
    assert.deepEqual(response.body, { user: null });
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers['set-cookie'], undefined);
  });

  test('identity is retrieved using the signed cookie, without display storage or password fields', async () => {
    const { login } = await signedIn();
    const cookies = login.headers['set-cookie'].map((cookie) => cookie.split(';')[0]).join('; ');
    assert.ok(login.headers['set-cookie'].every((cookie) => /path=\//i.test(cookie)));
    const response = await request(app).get('/api/session').set('Cookie', cookies).expect(200);
    assert.equal(response.body.user.name, user.name);
    assert.equal(response.body.user.email, user.email);
    assert.ok(response.body.user.createdAt);
    assert.deepEqual(Object.keys(response.body.user).sort(), ['createdAt', 'email', 'id', 'name', 'role']);
    assert.equal(response.body.user.role, 'job_seeker');
  });

  test('public/workspace navigation and refresh preserve the server session', async () => {
    const { agent, login } = await signedIn();
    for (const path of ['/', '/index.html', '/jobs/', '/jobs/1', '/workspace/jobs/', '/workspace/jobs/1', '/dashboard/index.html', '/profile/index.html', '/resume/index.html', '/jobs/']) {
      await agent.get(path).expect(200).expect('Content-Type', /html/);
      const session = await agent.get('/api/session').expect(200);
      assert.equal(session.body.user.id, login.body.user.id);
      assert.equal(session.headers['set-cookie'], undefined, path);
    }
    await agent.get('/api/resumes/current').expect(200);
  });

  test('logout clears the real cookie, protects private APIs and retains public browsing', async () => {
    const { agent } = await signedIn();
    const logout = await agent.post('/api/logout').expect(200);
    assert.match(logout.headers['set-cookie'].join(';'), /careerconnect_session=;/);
    const session = await agent.get('/api/session').expect(200);
    assert.equal(session.body.user, null);
    await agent.get('/api/resumes/current').expect(401);
    await agent.get('/api/jobs').expect(200);
  });

  test('logout is idempotent and GET cannot log a user out', async () => {
    const { agent } = await signedIn();
    await agent.get('/api/logout').expect(404);
    assert.ok((await agent.get('/api/session')).body.user);
    await agent.post('/api/logout').expect(200);
    await agent.post('/api/logout').expect(200);
    assert.equal((await agent.get('/api/session')).body.user, null);
  });

  test('a deleted account is not represented as a signed-in user', async () => {
    const { agent } = await signedIn();
    await database.run('DELETE FROM users');
    const response = await agent.get('/api/session').expect(200);
    assert.equal(response.body.user, null);
    await agent.get('/api/resumes/current').expect(401);
  });

  test('unsigned or tampered cookies cannot establish identity', async () => {
    const response = await request(app).get('/api/session')
      .set('Cookie', 'careerconnect_session=eyJ1c2VySWQiOjF9; careerconnect_session.sig=invalid').expect(200);
    assert.equal(response.body.user, null);
  });

  test('public and workspace list/detail routes reuse the same feature documents', async () => {
    const publicList = await request(app).get('/jobs/?q=software').expect(200);
    for (const path of ['/workspace/jobs', '/workspace/jobs/', '/workspace/jobs/index.html?q=software']) {
      const workspace = await request(app).get(path).expect(200);
      assert.equal(workspace.text, publicList.text);
    }
    const publicDetail = await request(app).get('/jobs/123?q=software').expect(200);
    const workspaceDetail = await request(app).get('/workspace/jobs/123?q=software').expect(200);
    assert.equal(workspaceDetail.text, publicDetail.text);
  });

  test('new-account login survives a failed workspace session check and recovers on retry', async (context) => {
    context.mock.method(console, 'error', () => {});
    let failSession = false;
    const wrapped = {
      run: (...args) => database.run(...args),
      get: async (sql, ...args) => {
        if (failSession && sql.includes('SELECT id, name, email, created_at, role FROM users')) {
          failSession = false;
          throw new Error('Temporary session database failure');
        }
        return database.get(sql, ...args);
      },
    };
    const recoveryApp = createApp(wrapped, { sessionSecret: 'recovery-test-cookie-secret' });
    const agent = request.agent(recoveryApp);
    await agent.post('/api/register').send(user).expect(201);
    const login = await agent.post('/api/login').send(user).expect(200);
    failSession = true;
    const failed = await agent.get('/api/session').expect(500);
    assert.equal(failed.headers['set-cookie'], undefined);
    const recovered = await agent.get('/api/session').expect(200);
    assert.equal(recovered.body.user.id, login.body.user.id);
    await agent.get('/api/resumes/current').expect(200);
  });
});
