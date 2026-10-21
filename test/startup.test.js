const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const request = require('supertest');
const { startServer } = require('../src/server');

test('ordinary startup installs the catalog on a new computer and preserves data on restart', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'careerconnect-startup-'));
  const databasePath = path.join(directory, 'careerconnect.sqlite');
  let running;
  async function stop() {
    if (!running) return;
    await new Promise((resolve, reject) => running.server.close((error) => error ? reject(error) : resolve()));
    await running.database.close();
    running = null;
  }
  try {
    running = await startServer({ databasePath, port: 0 });
    const first = await request(running.server).get('/api/jobs').expect(200);
    assert.equal(first.body.total, 50);
    assert.ok(first.body.items.every(({ isDemo }) => isDemo));
    const editedId = first.body.items[0].id;
    const closedId = first.body.items[1].id;
    const { database } = running;
    await database.run("UPDATE jobs SET title = 'Locally edited job' WHERE id = ?", editedId);
    await database.run("UPDATE jobs SET status = 'closed' WHERE id = ?", closedId);
    const registration = await request(running.server).post('/api/register').send({
      name: 'Startup Test', email: 'startup@example.test', password: 'StartupTest2026!',
    }).expect(201);
    await database.run(
      "INSERT INTO resumes (user_id, original_name, stored_name, file_path) VALUES (?, 'resume.pdf', 'test.pdf', 'uploads/resumes/test.pdf')",
      registration.body.user.id
    );
    await database.run("INSERT INTO jobs (title, company, location, category, description) VALUES ('Independent job', 'Test team', 'Montreal', 'engineering', 'Unrelated posting.')");
    // A second machine starts with its own fresh database and gets the same catalog.
    const other = await startServer({ databasePath: path.join(directory, 'other.sqlite'), port: 0 });
    try {
      assert.equal((await request(other.server).get('/api/jobs').expect(200)).body.total, 50);
    } finally {
      await new Promise((resolve) => other.server.close(resolve));
      await other.database.close();
    }
    await stop();
    running = await startServer({ databasePath, port: 0 });
    const restarted = await request(running.server).get('/api/jobs').expect(200);
    assert.equal(restarted.body.total, 50); // 49 open demo jobs plus the independent job.
    assert.equal(restarted.body.items.find(({ id }) => id === editedId).title, 'Locally edited job');
    assert.ok(!restarted.body.items.some(({ id }) => id === closedId));
    assert.equal((await running.database.get('SELECT COUNT(*) AS total FROM jobs')).total, 51);
    assert.equal((await running.database.get('SELECT COUNT(*) AS total FROM users')).total, 1);
    assert.equal((await running.database.get('SELECT COUNT(*) AS total FROM resumes')).total, 1);
  } finally {
    await stop();
    await rm(directory, { recursive: true, force: true });
  }
});
