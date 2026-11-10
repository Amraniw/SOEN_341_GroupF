const assert = require('node:assert/strict');
const { after, before, beforeEach, describe, test } = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/app');
const { initializeDatabase } = require('../src/database/database');
const { idleWarningNotification } = require('../src/domain/notifications');

const account = { name: 'Jordan Davis', email: 'jordan@example.test', password: 'DemoPass123' };

describe('Idle warning notification', () => {
  let app;
  let database;
  before(async () => {
    database = await initializeDatabase(':memory:');
    app = createApp(database);
  });
  beforeEach(async () => {
    await database.run('DELETE FROM notifications');
    await database.run('DELETE FROM users');
  });
  after(async () => database.close());

  async function signIn(extra = {}) {
    const agent = request.agent(app);
    await agent.post('/api/register').send({ ...account, employmentStatus: 'employed', ...extra }).expect(201);
    await agent.post('/api/login').send(account).expect(200);
    return agent;
  }

  test('requires a signed-in user', async () => {
    await request(app).post('/api/notifications/idle-warning').send({}).expect(401);
    assert.equal((await database.get('SELECT COUNT(*) AS n FROM notifications')).n, 0);
  });

  test('records the idle warning so it appears in the notification list', async () => {
    const agent = await signIn();
    const response = await agent.post('/api/notifications/idle-warning').send({}).expect(201);
    assert.equal(response.body.created, true);
    assert.equal(response.body.notification.type, 'idle_warning');
    assert.equal(response.body.notification.title, idleWarningNotification().title);
    assert.equal(response.body.notification.link, null);
    assert.equal(response.body.unreadCount, 1);
    const list = await agent.get('/api/notifications').expect(200);
    assert.deepEqual(list.body.items.map((item) => item.type), ['idle_warning']);
  });

  test('does not add another while the latest idle warning is unread', async () => {
    const agent = await signIn();
    const first = await agent.post('/api/notifications/idle-warning').send({}).expect(201);
    const second = await agent.post('/api/notifications/idle-warning').send({}).expect(200);
    assert.equal(second.body.created, false);
    assert.equal(second.body.notification.id, first.body.notification.id);
    assert.equal((await database.get('SELECT COUNT(*) AS n FROM notifications')).n, 1);
  });

  test('creates a new one once the previous idle warning has been read', async () => {
    const agent = await signIn();
    const first = await agent.post('/api/notifications/idle-warning').send({}).expect(201);
    await agent.patch(`/api/notifications/${first.body.notification.id}/read`).send({}).expect(200);
    const again = await agent.post('/api/notifications/idle-warning').send({}).expect(201);
    assert.notEqual(again.body.notification.id, first.body.notification.id);
    assert.equal((await database.get('SELECT COUNT(*) AS n FROM notifications')).n, 2);
  });

  test('works for recruiters and keeps each account’s warnings separate', async () => {
    const recruiter = request.agent(app);
    await recruiter.post('/api/register').send({ ...account, role: 'recruiter' }).expect(201);
    await recruiter.post('/api/login').send(account).expect(200);
    await recruiter.post('/api/notifications/idle-warning').send({}).expect(201);

    const other = request.agent(app);
    const second = { ...account, email: 'other@example.test' };
    await other.post('/api/register').send({ ...second, employmentStatus: 'employed' }).expect(201);
    await other.post('/api/login').send(second).expect(200);
    assert.equal((await other.get('/api/notifications').expect(200)).body.items.length, 0);
    assert.equal((await recruiter.get('/api/notifications').expect(200)).body.items.length, 1);
  });

  test('rejects request fields', async () => {
    const agent = await signIn();
    const response = await agent.post('/api/notifications/idle-warning').send({ userId: 2 }).expect(400);
    assert.equal(response.body.error, 'This request does not accept any fields.');
    assert.equal((await database.get('SELECT COUNT(*) AS n FROM notifications')).n, 0);
  });
});
