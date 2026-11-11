const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { after, before, beforeEach, describe, test } = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/app');
const { initializeDatabase } = require('../src/database/database');

const account = { name: 'Jordan Davis', email: 'jordan@example.test', password: 'DemoPass123' };

describe('Welcome notification on sign-in', () => {
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
    await agent.post('/api/register').send({ ...account, ...extra }).expect(201);
    const login = await agent.post('/api/login').send(account).expect(200);
    return { agent, login };
  }

  test('an unemployed job seeker gets a welcome notification each time they sign in', async () => {
    const { agent, login } = await signIn({ role: 'job_seeker', employmentStatus: 'unemployed' });
    assert.equal(login.body.user.employmentStatus, 'unemployed');
    const first = await agent.get('/api/notifications').expect(200);
    assert.equal(first.body.items.length, 1);
    assert.equal(first.body.items[0].type, 'welcome');
    assert.equal(first.body.items[0].title, '🫩🥀');
    assert.equal(first.body.items[0].link, '/workspace/jobs/');
    assert.equal(first.body.unreadCount, 1);
    await agent.post('/api/login').send(account).expect(200);
    assert.equal((await agent.get('/api/notifications').expect(200)).body.items.length, 2);
  });

  test('registering without an employment status defaults job seekers to unemployed', async () => {
    const { login } = await signIn();
    assert.equal(login.body.user.employmentStatus, 'unemployed');
    assert.equal((await database.get('SELECT COUNT(*) AS n FROM notifications')).n, 1);
  });

  test('employed job seekers and recruiters do not get the welcome', async () => {
    await signIn({ employmentStatus: 'employed' });
    assert.equal((await database.get('SELECT COUNT(*) AS n FROM notifications')).n, 0);
    await database.run('DELETE FROM users');
    const { login } = await signIn({ role: 'recruiter' });
    assert.equal(login.body.user.employmentStatus, null);
    assert.equal((await database.get('SELECT COUNT(*) AS n FROM notifications')).n, 0);
  });

  test('an invalid employment status is rejected', async () => {
    for (const employmentStatus of ['retired', '', null, 1, [], {}]) {
      const response = await request(app).post('/api/register').send({ ...account, employmentStatus }).expect(400);
      assert.equal(response.body.error, 'Choose a valid employment status.');
    }
    assert.equal((await database.get('SELECT COUNT(*) AS n FROM users')).n, 0);
  });

  test('a failure creating the welcome never blocks sign-in', async () => {
    const { agent } = await signIn();
    await database.run('DROP TABLE notifications');
    const login = await agent.post('/api/login').send(account).expect(200);
    assert.equal(login.body.message, 'Login successful.');
    await database.exec(`CREATE TABLE notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, type TEXT, title TEXT, message TEXT, link TEXT, read_at TEXT, created_at TEXT)`);
  });
});

test('an existing notifications table is rebuilt to allow welcome, keeping its rows and triggers', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'careerconnect-welcome-'));
  const filename = path.join(directory, 'older.sqlite');
  let database;
  try {
    database = await initializeDatabase(filename);
    await database.run("INSERT INTO users (name, email, password_hash, role) VALUES ('Old', 'old@example.test', 'x', 'job_seeker')");
    // Recreate the table as an older build had it: without the 'welcome' type.
    await database.exec(`
      DROP TRIGGER applications_notify_recruiter;
      DROP TRIGGER applications_notify_applicant;
      DROP TABLE notifications;
      CREATE TABLE notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('new_application', 'application_update', 'interview_invitation', 'deadline_reminder')),
        title TEXT NOT NULL CHECK (length(trim(title)) > 0),
        message TEXT NOT NULL CHECK (length(trim(message)) > 0),
        link TEXT,
        application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL,
        job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
        dedupe_key TEXT UNIQUE,
        read_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      INSERT INTO notifications (id, user_id, type, title, message, read_at, created_at)
      VALUES (41, 1, 'application_update', 'Kept', 'Kept message', '2026-11-01 10:00:00', '2026-11-01 09:00:00');
    `);
    await assert.rejects(database.run("INSERT INTO notifications (user_id, type, title, message) VALUES (1, 'welcome', 'a', 'b')"), /CHECK/);
    await database.close();

    database = await initializeDatabase(filename);
    const rows = await database.all('SELECT * FROM notifications');
    assert.equal(rows.length, 1);
    assert.deepEqual(
      { id: rows[0].id, title: rows[0].title, read_at: rows[0].read_at, created_at: rows[0].created_at },
      { id: 41, title: 'Kept', read_at: '2026-11-01 10:00:00', created_at: '2026-11-01 09:00:00' }
    );
    await database.run("INSERT INTO notifications (user_id, type, title, message) VALUES (1, 'welcome', 'a', 'b')");
    const objects = await database.all("SELECT name FROM sqlite_master WHERE name LIKE '%notif%' OR name = 'notifications_previous'");
    const names = objects.map(({ name }) => name);
    assert.ok(names.includes('applications_notify_recruiter') && names.includes('applications_notify_applicant'));
    assert.ok(!names.includes('notifications_previous'));
    await database.close();
    database = await initializeDatabase(filename); // A second start changes nothing.
    assert.equal((await database.get('SELECT COUNT(*) AS n FROM notifications')).n, 2);
  } finally {
    await database?.close().catch(() => {});
    await rm(directory, { recursive: true, force: true });
  }
});
