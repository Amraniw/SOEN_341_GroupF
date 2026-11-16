const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { initializeDatabase } = require('../src/database/database');
const { createApp } = require('../src/app');

test('profile picture upload, retrieval, account isolation and removal', async () => {
  const database = await initializeDatabase(':memory:');
  try {
    const app = createApp(database, { sessionSecret: 'picture-test-secret' });
    await request(app).post('/api/profile/picture').expect(401);
    const first = request.agent(app);
    const second = request.agent(app);
    for (const [index, agent] of [first, second].entries()) {
      const email = `picture-${index}@example.test`;
      await agent.post('/api/register').send({ name: 'Picture User', email, password: 'Password123' }).expect(201);
      await agent.post('/api/login').send({ email, password: 'Password123' }).expect(200);
    }
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
    await first.post('/api/profile/picture').set('X-Profile-Picture', '1').attach('picture', png, 'avatar.png').expect(200);
    const saved = await first.get('/api/profile/picture').expect(200).expect('Content-Type', /image\/png/);
    assert.deepEqual(saved.body, png);
    await second.get('/api/profile/picture').expect(404);
    await first.post('/api/profile/picture').set('X-Profile-Picture', '1').attach('picture', Buffer.from('fake'), 'fake.png').expect(400);
    await first.delete('/api/profile/picture').expect(200);
    await first.get('/api/profile/picture').expect(404);
  } finally { await database.close(); }
});
