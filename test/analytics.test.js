const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { initializeDatabase } = require('../src/database/database');
const { createApp } = require('../src/app');

test('analytics enforces identity, validates ranges and keeps accounts isolated', async () => {
  const db = await initializeDatabase(':memory:');
  try {
    const app = createApp(db, { sessionSecret: 'analytics-test-secret' });
    await request(app).get('/api/applications/analytics').expect(401);
    const agent = request.agent(app);
    await agent.post('/api/register').send({ name: 'Analytics', email: 'analytics@example.test', password: 'Password123' }).expect(201);
    await agent.post('/api/login').send({ email: 'analytics@example.test', password: 'Password123' }).expect(200);
    await agent.get('/api/applications/analytics?range=invalid').expect(400);
    await agent.get('/api/applications/analytics?userId=99').expect(400);
    const user = await db.get('SELECT id FROM users WHERE email = ?', 'analytics@example.test');
    await db.run("INSERT INTO jobs (title, company, location, category, description) VALUES ('Role', 'Company', 'City', 'engineering', 'Description')");
    const job = await db.get('SELECT id FROM jobs LIMIT 1');
    await db.run("INSERT INTO applications (user_id, job_id, applied_at) VALUES (?, ?, '2020-01-01 12:00:00')", user.id, job.id);
    assert.equal((await agent.get('/api/applications/analytics?range=30').expect(200)).body.total, 0);
    const all = (await agent.get('/api/applications/analytics?range=all').expect(200)).body;
    assert.equal(all.total, 1);
    assert.equal(all.active, 1);
    assert.deepEqual(all.activity, [{ month: '2020-01', count: 1 }]);
    assert.equal(all.statuses.reduce((sum, item) => sum + item.count, 0), 1);
    await db.run("UPDATE applications SET status = 'rejected' WHERE user_id = ?", user.id);
    const updated = (await agent.get('/api/applications/analytics?range=all').expect(200)).body;
    assert.equal(updated.active, 0);
    assert.equal(updated.history.length, 2);
  } finally { await db.close(); }
});
