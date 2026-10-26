const assert = require('node:assert/strict');
const { test } = require('node:test');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const { initializeDatabase } = require('../src/database/database');

async function verifyFoundation(database) {
  assert.equal((await database.get('PRAGMA foreign_keys')).foreign_keys, 1);
  const role = (await database.all('PRAGMA table_info(users)')).find(({ name }) => name === 'role');
  assert.equal(role.notnull, 1);
  assert.equal(role.dflt_value, "'job_seeker'");
  for (const value of ['admin', '', null]) {
    await assert.rejects(database.run(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      'Invalid Role', `invalid-${value}@example.test`, 'hash', value
    ), /CHECK|NOT NULL/);
  }
  const owner = await database.run(
    "INSERT INTO users (name, email, password_hash, role) VALUES ('Recruiter', 'owner@example.test', 'hash', 'recruiter')"
  );
  const job = await database.run(
    `INSERT INTO jobs (title, company, location, category, description, recruiter_id)
     VALUES ('Owned role', 'Company', 'Montreal', 'engineering', 'Description', ?)`, owner.lastID
  );
  await assert.rejects(database.run('UPDATE jobs SET recruiter_id = -1 WHERE id = ?', job.lastID), /FOREIGN KEY/);
  const foreignKeys = await database.all('PRAGMA foreign_key_list(jobs)');
  assert.ok(foreignKeys.some((key) => key.from === 'recruiter_id' && key.table === 'users' && key.to === 'id'));
  const columns = await database.all('PRAGMA index_info(idx_jobs_recruiter_created)');
  assert.deepEqual(columns.map(({ name }) => name), ['recruiter_id', 'created_at', 'id']);
  const snapshot = (await database.all('PRAGMA table_info(applications)')).find(({ name }) => name === 'job_snapshot_json');
  assert.equal(snapshot.type, 'TEXT');
  assert.equal(snapshot.notnull, 0);
}

test('fresh initialization supplies constrained roles, nullable ownership/snapshots and a recruiter index', async () => {
  const database = await initializeDatabase(':memory:');
  try {
    await verifyFoundation(database);
    await database.run("INSERT INTO users (name, email, password_hash) VALUES ('Default', 'default@example.test', 'hash')");
    assert.equal((await database.get("SELECT role FROM users WHERE email = 'default@example.test'")).role, 'job_seeker');
  } finally {
    await database.close();
  }
});

test('legacy data and relationships survive repeated additive initialization without table rebuilds', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'careerconnect-foundation-'));
  const filename = path.join(directory, 'legacy.sqlite');
  let database;
  try {
    database = await open({ filename, driver: sqlite3.Database });
    // Pre-Feature-4 tables, with existing account, demo, resume and application data.
    await database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        email TEXT NOT NULL COLLATE NOCASE UNIQUE,
        password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE resumes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
        original_name TEXT NOT NULL, stored_name TEXT NOT NULL UNIQUE,
        file_path TEXT NOT NULL UNIQUE, uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE TABLE job_categories (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
      CREATE TABLE jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL CHECK (length(trim(title)) > 0),
        company TEXT NOT NULL CHECK (length(trim(company)) > 0),
        location TEXT NOT NULL CHECK (length(trim(location)) > 0),
        category TEXT NOT NULL REFERENCES job_categories(id),
        description TEXT NOT NULL CHECK (length(trim(description)) > 0),
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, demo_key TEXT UNIQUE
      );
      CREATE TABLE applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, job_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'applied'
          CHECK (status IN ('applied', 'under_review', 'interview', 'offered', 'rejected')),
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE RESTRICT,
        UNIQUE (user_id, job_id)
      );
      CREATE TABLE application_status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT, application_id INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('applied', 'under_review', 'interview', 'offered', 'rejected')),
        changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
      );
      INSERT INTO users VALUES (7, 'Legacy User', 'legacy@example.test', 'existing-hash', '2026-10-01');
      INSERT INTO resumes VALUES (8, 7, 'resume.pdf', 'saved.pdf', 'uploads/resumes/saved.pdf', '2026-10-02');
      INSERT INTO job_categories VALUES ('engineering', 'Aerospace & Engineering');
      INSERT INTO jobs VALUES (9, 'Legacy Demo', 'Company', 'Montreal', 'engineering', 'Original description', 'closed', '2026-10-01', 'us05-demo-1');
      INSERT INTO applications VALUES (10, 7, 9, 'under_review', '2026-10-02', '2026-10-03');
      INSERT INTO application_status_history VALUES (11, 10, 'applied', '2026-10-02');
      INSERT INTO application_status_history VALUES (12, 10, 'under_review', '2026-10-03');
    `);
    const tables = ['users', 'resumes', 'jobs', 'applications', 'application_status_history'];
    const before = {};
    for (const table of tables) before[table] = await database.all(`SELECT * FROM ${table} ORDER BY id`);
    const roots = await database.all("SELECT name, rootpage FROM sqlite_master WHERE type = 'table' ORDER BY name");
    await database.close();
    database = null;

    for (let pass = 0; pass < 2; pass += 1) {
      database = await initializeDatabase(filename);
      for (const table of tables) {
        const expected = before[table].map((row) => ({ ...row }));
        if (table === 'users') expected[0].role = 'job_seeker';
        if (table === 'jobs') Object.assign(expected[0], {
          employment_type: null, workplace_type: null, experience_level: null, details_json: null, recruiter_id: null,
        });
        if (table === 'applications') expected[0].job_snapshot_json = null;
        assert.deepEqual(await database.all(`SELECT * FROM ${table} ORDER BY id`), expected);
      }
      const initializedRoots = await database.all(
        "SELECT name, rootpage FROM sqlite_master WHERE type = 'table' ORDER BY name"
      );
      for (const legacyTable of roots) {
        assert.deepEqual(
          initializedRoots.find(({ name }) => name === legacyTable.name),
          legacyTable,
          `legacy table ${legacyTable.name} should not be rebuilt`
        );
      }
      assert.ok(
        initializedRoots.some(({ name }) => name === 'profiles'),
        'additive initialization should install the profiles table from main'
      );
      assert.deepEqual(await database.all('PRAGMA foreign_key_check'), []);
      await assert.rejects(database.run('DELETE FROM jobs WHERE id = 9'), /FOREIGN KEY/);
      await assert.rejects(database.run('INSERT INTO applications (user_id, job_id) VALUES (7, 9)'), /UNIQUE/);
      await database.close();
      database = null;
    }

    database = await initializeDatabase(filename);
    await verifyFoundation(database);
    const snapshot = '{"title":"Preserved snapshot"}';
    await database.run('UPDATE applications SET job_snapshot_json = ? WHERE id = 10', snapshot);
    await database.close();
    database = await initializeDatabase(filename);
    assert.equal((await database.get('SELECT role FROM users WHERE email = ?', 'owner@example.test')).role, 'recruiter');
    assert.ok((await database.get("SELECT recruiter_id FROM jobs WHERE title = 'Owned role'")).recruiter_id);
    assert.equal((await database.get('SELECT job_snapshot_json FROM applications WHERE id = 10')).job_snapshot_json, snapshot);
    await database.run("UPDATE applications SET status = 'interview' WHERE id = 10");
    assert.equal((await database.get('SELECT COUNT(*) AS total FROM application_status_history WHERE application_id = 10')).total, 3);
    // Owner data is unrelated; legacy applicant deletion still cascades as before.
    await database.run('DELETE FROM users WHERE id = 7');
    assert.equal((await database.get('SELECT COUNT(*) AS total FROM resumes')).total, 0);
    assert.equal((await database.get('SELECT COUNT(*) AS total FROM applications')).total, 0);
    assert.equal((await database.get('SELECT COUNT(*) AS total FROM application_status_history')).total, 0);
  } finally {
    if (database) await database.close();
    await rm(directory, { recursive: true, force: true });
  }
});
