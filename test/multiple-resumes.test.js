const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, beforeEach, describe, test } = require('node:test');
const bcrypt = require('bcrypt');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const request = require('supertest');
const { createApp } = require('../src/app');
const { initializeDatabase } = require('../src/database/database');

const SESSION_SECRET = 'multiple-resume-test-secret-with-at-least-32-bytes';
const PASSWORD = 'ResumeTest2026!';
const NOT_FOUND = { error: 'This resume could not be found.' };

// A minimal valid PDF whose body records which upload it was.
function pdf(label) {
  return Buffer.from(`%PDF-1.4\n% ${label}\n%%EOF\n`);
}

const names = (body) => body.items.map(({ originalName }) => originalName);
const defaultName = (body) =>
  body.items.find(({ isDefault }) => isDefault)?.originalName ?? null;

describe('Multiple resume management (US-04 enhancement, issue #104)', () => {
  let app;
  let database;
  let temporaryDirectory;
  let uploadDirectory;

  before(async () => {
    temporaryDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'careerconnect-multiple-resumes-')
    );
    uploadDirectory = path.join(temporaryDirectory, 'uploads', 'resumes');
    database = await initializeDatabase(':memory:');
    app = createApp(database, { sessionSecret: SESSION_SECRET, uploadDirectory });
  });

  beforeEach(async () => {
    await database.exec('DELETE FROM resumes; DELETE FROM users;');
    await fs.rm(uploadDirectory, { recursive: true, force: true });
  });

  after(async () => {
    await database.close();
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  });

  async function signIn(email) {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ email, password: PASSWORD }).expect(200);
    return agent;
  }

  async function register(email = 'seeker@example.test') {
    await request(app)
      .post('/api/register')
      .send({ name: 'Resume Seeker', email, password: PASSWORD })
      .expect(201);
    return signIn(email);
  }

  async function uploadResume(agent, filename) {
    const response = await agent
      .post('/api/resumes')
      .attach('resume', pdf(filename), { filename, contentType: 'application/pdf' })
      .expect(201);
    return response.body.resume;
  }

  async function listResumes(agent) {
    return (await agent.get('/api/resumes').expect(200)).body;
  }

  test('one job seeker uploads several PDFs; each is stored separately and the newest is the default', async () => {
    const agent = await register();
    const uploads = [];
    for (const filename of ['Software_Resume.pdf', 'Data_Resume.pdf', 'Design_Resume.pdf']) {
      uploads.push(await uploadResume(agent, filename));
    }
    assert.equal(uploads[2].isDefault, true);

    const body = await listResumes(agent);
    assert.equal(body.total, 3);
    assert.deepEqual(body.items.map(({ id }) => id), uploads.map(({ id }) => id).reverse());
    assert.deepEqual(body.items.map(({ isDefault }) => isDefault), [true, false, false]);
    for (const item of body.items) {
      // Storage names and paths stay private, as with /current.
      assert.deepEqual(Object.keys(item).sort(), ['id', 'isDefault', 'originalName', 'uploadedAt']);
      assert.ok(item.uploadedAt);
    }

    const stored = await database.all('SELECT original_name, stored_name FROM resumes ORDER BY id');
    assert.equal(new Set(stored.map(({ stored_name }) => stored_name)).size, 3);
    assert.deepEqual(
      (await fs.readdir(uploadDirectory)).sort(),
      stored.map(({ stored_name }) => stored_name).sort()
    );
    for (const { original_name, stored_name } of stored) {
      const content = await fs.readFile(path.join(uploadDirectory, stored_name), 'utf8');
      assert.ok(content.includes(original_name), `${original_name} keeps its own file`);
    }

    const current = await agent.get('/api/resumes/current').expect(200);
    assert.deepEqual(current.body.resume, body.items[0]);
  });

  test('the chosen default persists after signing out and back in, and /current returns it', async () => {
    const agent = await register();
    const older = await uploadResume(agent, 'Older.pdf');
    await uploadResume(agent, 'Newer.pdf');

    const response = await agent.put(`/api/resumes/${older.id}/default`).expect(200);
    assert.equal(response.body.message, 'Default resume updated.');
    assert.deepEqual(response.body.resume, { ...older, isDefault: true });

    await agent.post('/api/logout').expect(200);
    await agent.get('/api/resumes').expect(401);

    const nextSession = await signIn('seeker@example.test');
    const body = await listResumes(nextSession);
    assert.deepEqual(names(body), ['Newer.pdf', 'Older.pdf']);
    assert.equal(defaultName(body), 'Older.pdf');
    const current = await nextSession.get('/api/resumes/current').expect(200);
    assert.equal(current.body.resume.id, older.id);

    // Choosing the same default again changes nothing.
    await nextSession.put(`/api/resumes/${older.id}/default`).expect(200);
    assert.deepEqual(await database.all('SELECT resume_id FROM default_resumes'), [
      { resume_id: older.id },
    ]);
  });

  test('a new upload becomes the default, and an older resume can be chosen again', async () => {
    const agent = await register();
    const first = await uploadResume(agent, 'First.pdf');
    await uploadResume(agent, 'Second.pdf');
    await agent.put(`/api/resumes/${first.id}/default`).expect(200);

    await uploadResume(agent, 'Third.pdf');
    assert.equal(defaultName(await listResumes(agent)), 'Third.pdf');

    await agent.put(`/api/resumes/${first.id}/default`).expect(200);
    assert.equal(defaultName(await listResumes(agent)), 'First.pdf');
    assert.equal((await listResumes(agent)).total, 3);
  });

  test('deleting one resume keeps the other resumes, their files and the default', async () => {
    const agent = await register();
    const keep = await uploadResume(agent, 'Keep.pdf');
    const remove = await uploadResume(agent, 'Remove.pdf');
    await agent.put(`/api/resumes/${keep.id}/default`).expect(200);
    const fileOf = async (id) =>
      (await database.get('SELECT stored_name FROM resumes WHERE id = ?', id)).stored_name;
    const keptFile = await fileOf(keep.id);
    const removedFile = await fileOf(remove.id);

    const response = await agent.delete(`/api/resumes/${remove.id}`).expect(200);
    assert.equal(response.body.message, 'Resume deleted successfully.');
    assert.deepEqual(response.body.defaultResume, { ...keep, isDefault: true });

    const body = await listResumes(agent);
    assert.deepEqual(names(body), ['Keep.pdf']);
    assert.equal(defaultName(body), 'Keep.pdf');
    assert.deepEqual(await fs.readdir(uploadDirectory), [keptFile]);
    await assert.rejects(fs.stat(path.join(uploadDirectory, removedFile)), { code: 'ENOENT' });

    assert.deepEqual((await agent.delete(`/api/resumes/${remove.id}`).expect(404)).body, NOT_FOUND);
  });

  test('deleting the default makes the most recently uploaded remaining resume the default; deleting the last leaves none', async () => {
    const agent = await register();
    const a = await uploadResume(agent, 'A.pdf');
    const b = await uploadResume(agent, 'B.pdf');
    const c = await uploadResume(agent, 'C.pdf');
    await agent.put(`/api/resumes/${a.id}/default`).expect(200);

    let response = await agent.delete(`/api/resumes/${a.id}`).expect(200);
    assert.equal(response.body.defaultResume.id, c.id);
    assert.equal(defaultName(await listResumes(agent)), 'C.pdf');

    response = await agent.delete(`/api/resumes/${c.id}`).expect(200);
    assert.equal(response.body.defaultResume.id, b.id);

    response = await agent.delete(`/api/resumes/${b.id}`).expect(200);
    assert.equal(response.body.defaultResume, null);
    assert.deepEqual(await listResumes(agent), { items: [], total: 0 });
    assert.equal((await agent.get('/api/resumes/current').expect(200)).body.resume, null);
    assert.deepEqual(await fs.readdir(uploadDirectory), []);
    assert.equal((await database.get('SELECT COUNT(*) AS total FROM default_resumes')).total, 0);
  });

  test("users cannot list, choose or delete another account's resumes or files", async () => {
    const owner = await register('owner@example.test');
    const other = await register('other@example.test');
    const privateResume = await uploadResume(owner, 'Private.pdf');
    const otherResume = await uploadResume(other, 'Other.pdf');
    const rowsBefore = await database.all('SELECT * FROM resumes ORDER BY id');
    const filesBefore = (await fs.readdir(uploadDirectory)).sort();

    assert.deepEqual(names(await listResumes(other)), ['Other.pdf']);
    const choose = await other.put(`/api/resumes/${privateResume.id}/default`).expect(404);
    assert.deepEqual(choose.body, NOT_FOUND);
    const remove = await other.delete(`/api/resumes/${privateResume.id}`).expect(404);
    assert.deepEqual(remove.body, NOT_FOUND);

    assert.deepEqual(await database.all('SELECT * FROM resumes ORDER BY id'), rowsBefore);
    assert.deepEqual((await fs.readdir(uploadDirectory)).sort(), filesBefore);
    assert.equal((await owner.get('/api/resumes/current').expect(200)).body.resume.id, privateResume.id);
    assert.equal((await other.get('/api/resumes/current').expect(200)).body.resume.id, otherResume.id);
    // Every stored default belongs to the account that chose it.
    const defaults = await database.all(
      `SELECT d.user_id, r.user_id AS owner_id
       FROM default_resumes d JOIN resumes r ON r.id = d.resume_id`
    );
    assert.equal(defaults.length, 2);
    assert.ok(defaults.every(({ user_id, owner_id }) => user_id === owner_id));
  });

  test('collection endpoints require a signed-in user', async () => {
    for (const [method, url] of [
      ['get', '/api/resumes'],
      ['put', '/api/resumes/1/default'],
      ['delete', '/api/resumes/1'],
    ]) {
      const response = await request(app)[method](url).expect(401);
      assert.equal(response.body.error, 'Authentication required.');
    }
  });

  test('malformed or unknown resume IDs are reported as not found and change nothing', async () => {
    const agent = await register();
    const resume = await uploadResume(agent, 'Only.pdf');
    const rowsBefore = await database.all('SELECT * FROM resumes');

    for (const id of ['abc', '0', '-1', '1.5', '01', String(resume.id + 1000), '9007199254740993', '1%20OR%201%3D1']) {
      assert.deepEqual((await agent.put(`/api/resumes/${id}/default`).expect(404)).body, NOT_FOUND);
      assert.deepEqual((await agent.delete(`/api/resumes/${id}`).expect(404)).body, NOT_FOUND);
    }

    assert.deepEqual(await database.all('SELECT * FROM resumes'), rowsBefore);
    assert.equal(defaultName(await listResumes(agent)), 'Only.pdf');
  });

  test('uploads keep the existing PDF checks, and rejected files never join the collection', async () => {
    const agent = await register();
    await uploadResume(agent, 'Valid.pdf');

    const textResponse = await agent
      .post('/api/resumes')
      .attach('resume', Buffer.from('plain text'), { filename: 'notes.txt', contentType: 'text/plain' })
      .expect(415);
    assert.equal(textResponse.body.error, 'Only PDF resumes are accepted.');
    const fakeResponse = await agent
      .post('/api/resumes')
      .attach('resume', Buffer.from('not a pdf'), { filename: 'fake.pdf', contentType: 'application/pdf' })
      .expect(415);
    assert.equal(fakeResponse.body.error, 'The uploaded file is not a valid PDF.');

    // The rejected uploads left no row, no file, and no change to the default.
    const body = await listResumes(agent);
    assert.deepEqual(names(body), ['Valid.pdf']);
    assert.equal(defaultName(body), 'Valid.pdf');
    assert.equal((await fs.readdir(uploadDirectory)).length, 1);
  });

  test('the existing remove-all endpoint still clears every resume and the default', async () => {
    const agent = await register();
    const older = await uploadResume(agent, 'Older.pdf');
    await uploadResume(agent, 'Newer.pdf');
    await agent.put(`/api/resumes/${older.id}/default`).expect(200);

    const response = await agent.delete('/api/resumes/current').expect(200);
    assert.equal(response.body.message, 'Resume deleted successfully.');
    assert.deepEqual((await listResumes(agent)).items, []);
    assert.equal((await database.get('SELECT COUNT(*) AS total FROM default_resumes')).total, 0);
    assert.deepEqual(await fs.readdir(uploadDirectory), []);
  });

  test("the database allows one default per user, and only that user's own resume", async () => {
    // Direct SQL bypasses the API, so these are the schema's own guarantees.
    const addUser = (email) =>
      database.run(
        "INSERT INTO users (name, email, password_hash) VALUES ('Schema User', ?, 'hash')",
        email
      );
    const addResume = (userId, name) =>
      database.run(
        'INSERT INTO resumes (user_id, original_name, stored_name, file_path) VALUES (?, ?, ?, ?)',
        userId,
        `${name}.pdf`,
        `${name}-stored.pdf`,
        `uploads/resumes/${name}-stored.pdf`
      );
    const owner = (await addUser('schema-owner@example.test')).lastID;
    const other = (await addUser('schema-other@example.test')).lastID;
    const first = (await addResume(owner, 'first')).lastID;
    const second = (await addResume(owner, 'second')).lastID;
    const foreign = (await addResume(other, 'foreign')).lastID;

    await database.run('INSERT INTO default_resumes (user_id, resume_id) VALUES (?, ?)', owner, first);
    await assert.rejects(
      database.run('INSERT INTO default_resumes (user_id, resume_id) VALUES (?, ?)', owner, second),
      /UNIQUE/
    );
    await assert.rejects(
      database.run('INSERT INTO default_resumes (user_id, resume_id) VALUES (?, ?)', other, first),
      /FOREIGN KEY/
    );
    await assert.rejects(
      database.run('UPDATE default_resumes SET resume_id = ? WHERE user_id = ?', foreign, owner),
      /FOREIGN KEY/
    );

    await database.run('DELETE FROM resumes WHERE id = ?', first);
    assert.equal((await database.get('SELECT COUNT(*) AS total FROM default_resumes')).total, 0);
  });
});

test('an existing database keeps every resume, and the newest upload stays the default until the user chooses another', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'careerconnect-resume-migration-'));
  const filename = path.join(directory, 'before-multiple-resumes.sqlite');
  let database;
  try {
    // The schema and data of a database created before resume collections.
    database = await open({ filename, driver: sqlite3.Database });
    await database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        email TEXT NOT NULL COLLATE NOCASE UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE resumes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL UNIQUE,
        file_path TEXT NOT NULL UNIQUE,
        uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX idx_resumes_user_id ON resumes(user_id);
    `);
    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    for (const [id, email] of [[4, 'legacy@example.test'], [5, 'other-legacy@example.test']]) {
      await database.run(
        "INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, 'Legacy Seeker', ?, ?, '2026-09-20 10:00:00')",
        id,
        email,
        passwordHash
      );
    }
    for (const [id, userId, name, uploadedAt] of [
      [11, 4, 'Older.pdf', '2026-09-21 09:00:00'],
      [12, 4, 'Newest.pdf', '2026-10-05 09:00:00'],
      [13, 5, 'Other.pdf', '2026-09-30 09:00:00'],
    ]) {
      await database.run(
        'INSERT INTO resumes (id, user_id, original_name, stored_name, file_path, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)',
        id,
        userId,
        name,
        `stored-${id}.pdf`,
        `uploads/resumes/stored-${id}.pdf`,
        uploadedAt
      );
    }
    const resumesBefore = await database.all('SELECT * FROM resumes ORDER BY id');
    await database.close();
    database = null;

    // The migration is safe to repeat and never rewrites existing resume rows.
    for (let pass = 0; pass < 2; pass += 1) {
      database = await initializeDatabase(filename);
      assert.deepEqual(await database.all('SELECT * FROM resumes ORDER BY id'), resumesBefore);
      assert.deepEqual(await database.all('SELECT * FROM default_resumes'), []);
      await database.close();
      database = null;
    }

    database = await initializeDatabase(filename);
    const app = createApp(database, {
      sessionSecret: SESSION_SECRET,
      uploadDirectory: path.join(directory, 'uploads'),
    });
    const agent = request.agent(app);
    await agent.post('/api/login').send({ email: 'legacy@example.test', password: PASSWORD }).expect(200);

    const current = await agent.get('/api/resumes/current').expect(200);
    assert.deepEqual(current.body.resume, {
      id: 12,
      originalName: 'Newest.pdf',
      uploadedAt: '2026-10-05 09:00:00',
      isDefault: true,
    });
    const list = await agent.get('/api/resumes').expect(200);
    assert.deepEqual(
      list.body.items.map(({ id, isDefault }) => ({ id, isDefault })),
      [{ id: 12, isDefault: true }, { id: 11, isDefault: false }]
    );

    await agent.put('/api/resumes/11/default').expect(200);
    assert.equal((await agent.get('/api/resumes/current').expect(200)).body.resume.id, 11);
    assert.equal((await database.get('SELECT COUNT(*) AS total FROM resumes')).total, 3);
  } finally {
    await database?.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});
