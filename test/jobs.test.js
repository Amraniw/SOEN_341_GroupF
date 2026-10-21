const assert = require('node:assert/strict');
const { after, before, beforeEach, describe, test } = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/app');
const { initializeDatabase } = require('../src/database/database');
const { seedDemoJobs } = require('../src/database/seedJobs');

describe('US-05: job discovery', () => {
  let database;
  let app;
  let softwareId;

  before(async () => {
    database = await initializeDatabase(':memory:');
    app = createApp(database, { sessionSecret: 'careerconnect-jobs-test-secret' });
  });
  after(async () => database.close());
  beforeEach(async () => {
    await database.run('DELETE FROM jobs');
    const fixtures = [
      ['Software Engineer', 'Orchard Labs', 'Montreal, QC', 'software-engineering', 'Build accessible web tools.', 'open', '2026-10-02 09:00:00'],
      ['Software Intern', 'Orchard Labs', 'Toronto, ON', 'software-engineering', 'Learn to build web tools.', 'open', '2026-10-03T09:00:00.000Z'],
      ['Data Engineer', 'Blue Harbor', 'Montreal, QC', 'data-analytics', 'Maintain robotics data pipelines.', 'open', '2026-10-01 09:00:00'],
      ['Business Analyst', 'Software Collective', 'Montreal, QC', 'business-operations', 'Analyze operations with 100% accuracy and a_b identifiers.', 'open', '2026-10-03 09:00:00'],
      ['Software Architect', 'Orchard Labs', 'Montreal, QC', 'software-engineering', 'An unavailable posting.', 'closed', '2026-10-04 09:00:00'],
    ];
    for (const fixture of fixtures) {
      const result = await database.run(
        'INSERT INTO jobs (title, company, location, category, description, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        fixture
      );
      if (fixture[0] === 'Software Engineer') softwareId = result.lastID;
    }
  });

  async function search(query = {}) {
    const response = await request(app).get('/api/jobs').query(query).expect(200);
    assert.equal(response.body.total, response.body.items.length);
    return response.body;
  }

  test('public browsing returns only available jobs, newest first with a stable ID tie-break', async () => {
    const result = await search();
    assert.equal(result.total, 4);
    assert.deepEqual(result.items.map(({ title }) => title), ['Business Analyst', 'Software Intern', 'Software Engineer', 'Data Engineer']);
    assert.equal(result.demoOnly, false);
    assert.equal(result.categories.length, 5);
    assert.equal(result.items[0].demo_key, undefined);
    assert.equal(result.items[0].description, undefined);
    assert.ok(result.items[0].createdAt);
  });

  test('keywords match title, employer, and description without case sensitivity', async () => {
    assert.equal((await search({ q: '  SOFTWARE  ' })).total, 3);
    assert.equal((await search({ q: 'software' })).total, 3);
    assert.equal((await search({ q: 'ORCHARD' })).total, 2);
    assert.equal((await search({ q: 'robotics' })).items[0].title, 'Data Engineer');
  });

  test('location is a trimmed, case-insensitive substring', async () => {
    assert.equal((await search({ location: '  MONTREAL ' })).total, 3);
    assert.equal((await search({ location: 'onto' })).total, 1);
  });

  test('category is an exact canonical ID, normalized for case and whitespace', async () => {
    const result = await search({ category: ' SOFTWARE-ENGINEERING ' });
    assert.equal(result.total, 2);
    assert.ok(result.items.every(({ category }) => category === 'software-engineering'));
  });

  test('keyword, location and category combine with AND semantics', async () => {
    const result = await search({ q: 'software', location: 'Montreal', category: 'software-engineering' });
    assert.equal(result.total, 1);
    assert.equal(result.items[0].id, softwareId);
  });

  test('blank filters do not restrict results and zero matches is successful', async () => {
    assert.equal((await search({ q: '   ', location: '', category: '' })).total, 4);
    assert.deepEqual((await search({ q: 'no such vacancy' })).items, []);
    assert.equal((await search({ location: 'Toronto', category: 'data-analytics' })).total, 0);
  });

  test('SQL metacharacters and LIKE wildcards are literal search text', async () => {
    assert.equal((await search({ q: "' OR 1=1 --" })).total, 0);
    assert.equal((await search({ q: '100%' })).total, 1);
    assert.equal((await search({ q: 'a_b' })).total, 1);
    assert.equal((await search({ q: '\\' })).total, 0);
    assert.equal((await search({ location: '%' })).total, 0);
  });

  test('malformed, repeated, unknown and overlong parameters return safe validation errors', async () => {
    for (const query of ['q=one&q=two', 'q[x]=x', 'category=unknown', `q=${'x'.repeat(121)}`, `location=${'x'.repeat(101)}`, 'sort=sql']) {
      const response = await request(app).get(`/api/jobs?${query}`).expect(400);
      assert.equal(typeof response.body.error, 'string');
      assert.equal(response.body.stack, undefined);
    }
  });

  test('detail is retrievable directly by ID and contains the full stored description', async () => {
    const response = await request(app).get(`/api/jobs/${softwareId}`).expect(200);
    assert.equal(response.body.job.title, 'Software Engineer');
    assert.equal(response.body.job.description, 'Build accessible web tools.');
    assert.equal(response.body.job.categoryName, 'Software Engineering');
    assert.equal(response.body.job.isDemo, false);
    assert.equal(response.body.job.demo_key, undefined);
  });

  test('unknown, closed and malformed IDs are not found', async () => {
    const closed = await database.get("SELECT id FROM jobs WHERE status = 'closed'");
    for (const id of ['99999', 'abc', '-1', '0', '1.5', '9007199254740992', String(closed.id)]) {
      const response = await request(app).get(`/api/jobs/${id}`).expect(404);
      assert.equal(response.body.error, 'This job posting could not be found.');
    }
  });

  test('listing and direct detail pages are public HTML routes', async () => {
    await request(app).get('/jobs/').expect(200).expect('Content-Type', /html/);
    const listing = await request(app).get('/jobs/index.html?q=software').expect(200);
    assert.match(listing.text, /id="job-search"/);
    const detail = await request(app).get(`/jobs/${softwareId}?q=software`).expect(200);
    assert.match(detail.text, /job-detail/);
    await request(app).get('/jobs/invalid').expect(200).expect('Content-Type', /html/);
  });

  test('database constraints reject unsupported categories and statuses', async () => {
    await assert.rejects(database.run(
      "INSERT INTO jobs (title, company, location, category, description) VALUES ('Role', 'Team', 'City', 'unknown', 'Description')"
    ), /FOREIGN KEY/);
    await assert.rejects(database.run("UPDATE jobs SET status = 'draft' WHERE id = ?", softwareId), /CHECK/);
  });

  test('empty database returns a successful zero-results response', async () => {
    await database.run('DELETE FROM jobs');
    const result = await search();
    assert.equal(result.total, 0);
    assert.equal(result.demoOnly, false);
  });

  test('database failures return safe API errors without leaking internal details', async (context) => {
    context.mock.method(console, 'error', () => {});
    const unavailable = async () => { throw new Error('Private database details'); };
    const failedApp = createApp({ all: unavailable, get: unavailable });
    for (const path of ['/api/jobs', '/api/jobs/1']) {
      const response = await request(failedApp).get(path).expect(500);
      assert.deepEqual(response.body, { error: 'An unexpected server error occurred.' });
    }
  });
});

describe('US-05: explicit demonstration seed', () => {
  test('seed is repeatable, preserves existing/edited records, identifies samples, and refuses production', async () => {
    const database = await initializeDatabase(':memory:');
    try {
      assert.equal(await seedDemoJobs(database, 'development'), 50);
      await database.run("UPDATE jobs SET title = 'Edited demo role' WHERE demo_key = 'us05-demo-1'");
      await database.run("INSERT INTO jobs (title, company, location, category, description) VALUES ('Real role', 'Team', 'City', 'engineering', 'Real description')");
      assert.equal(await seedDemoJobs(database, 'development'), 0);
      assert.equal((await database.get('SELECT COUNT(*) AS total FROM jobs')).total, 51);
      assert.equal((await database.get("SELECT title FROM jobs WHERE demo_key = 'us05-demo-1'")).title, 'Edited demo role');
      await assert.rejects(seedDemoJobs(database, 'production'), /cannot be seeded/);
      const app = createApp(database);
      const all = await request(app).get('/api/jobs').expect(200);
      assert.equal(all.body.demoOnly, false);
      assert.equal(all.body.items.filter(({ isDemo }) => isDemo).length, 50);
      assert.equal(all.body.hasDemo, true);
      await database.run('DELETE FROM jobs WHERE demo_key IS NULL');
      const samples = await request(app).get('/api/jobs').expect(200);
      assert.equal(samples.body.demoOnly, true);
    } finally {
      await database.close();
    }
  });

  test('explicit refresh upgrades managed demo content while preserving IDs, status and unrelated postings', async () => {
    const database = await initializeDatabase(':memory:');
    try {
      await seedDemoJobs(database, 'development');
      const original = await database.get("SELECT id FROM jobs WHERE demo_key = 'us05-demo-1'");
      await database.run("UPDATE jobs SET company = 'Old demo company', details_json = NULL, status = 'closed' WHERE id = ?", original.id);
      await database.run("INSERT INTO jobs (title, company, location, category, description) VALUES ('Independent role', 'Team', 'City', 'engineering', 'Independent description')");
      assert.equal(await seedDemoJobs(database, 'development', { refreshExisting: true }), 0);
      const refreshed = await database.get('SELECT * FROM jobs WHERE id = ?', original.id);
      assert.equal(refreshed.company, 'Amazon');
      assert.equal(refreshed.status, 'closed');
      assert.ok(JSON.parse(refreshed.details_json).responsibilities.length >= 4);
      assert.equal((await database.get('SELECT COUNT(*) AS total FROM jobs')).total, 51);
      assert.equal((await database.get('SELECT description FROM jobs WHERE demo_key IS NULL')).description, 'Independent description');
    } finally { await database.close(); }
  });

  test('all 50 persisted postings have distinct substantive content and lightweight list responses', async () => {
    const database = await initializeDatabase(':memory:');
    try {
      await seedDemoJobs(database, 'test');
      const app = createApp(database);
      const { body } = await request(app).get('/api/jobs').expect(200);
      assert.equal(body.total, 50);
      assert.equal(new Set(body.items.map(({ id }) => id)).size, 50);
      const overviews = new Set();
      const levels = new Set();
      const workplaces = new Set();
      const employment = new Set();
      for (const item of body.items) {
        assert.equal(item.description, undefined);
        assert.equal(item.details, undefined);
        assert.equal(item.details_json, undefined);
        assert.ok(item.summary.length <= 200);
        assert.ok(item.isDemo);
        levels.add(item.experienceLevel); workplaces.add(item.workplaceType); employment.add(item.employmentType);
        const { body: { job } } = await request(app).get(`/api/jobs/${item.id}`).expect(200);
        const details = job.details;
        overviews.add(details.overview);
        assert.ok(details.overview.length >= 140);
        assert.ok(details.responsibilities.length >= 4 && details.responsibilities.length <= 7);
        assert.ok(details.qualifications.length >= 4 && details.qualifications.length <= 7);
        assert.ok(details.preferredSkills.length >= 2 && details.preferredSkills.length <= 5);
        assert.match(details.companyDescription, /fictional/);
        for (const field of ['responsibilities', 'qualifications', 'preferredSkills']) {
          assert.equal(new Set(details[field]).size, details[field].length);
          assert.ok(details[field].every((text) => job.description.includes(text)));
        }
      }
      assert.equal(overviews.size, 50);
      assert.equal(levels.size, 4); assert.equal(workplaces.size, 3); assert.equal(employment.size, 3);
      assert.ok(body.items.some(({ company }) => company === 'Lockheed Martin'));
    } finally { await database.close(); }
  });

  test('the complete catalog supports representative keywords, locations, categories and combined filters', async () => {
    const database = await initializeDatabase(':memory:');
    try {
      await seedDemoJobs(database, 'test');
      const app = createApp(database);
      for (const q of ['software', 'intern', 'aerospace', 'controls', 'AI', 'NVIDIA', 'SpaceX', 'Montreal', 'Seattle']) {
        const upper = await request(app).get('/api/jobs').query({ q: q.toUpperCase() }).expect(200);
        const lower = await request(app).get('/api/jobs').query({ q: q.toLowerCase() }).expect(200);
        assert.ok(upper.body.total > 0 && upper.body.total < 50, q);
        assert.deepEqual(upper.body.items.map(({ id }) => id), lower.body.items.map(({ id }) => id));
      }
      const ai = await request(app).get('/api/jobs').query({ q: 'AI' }).expect(200);
      assert.equal(ai.body.total, 7);
      for (const item of ai.body.items) {
        const { body: { job } } = await request(app).get(`/api/jobs/${item.id}`).expect(200);
        assert.match(`${job.title} ${job.company} ${job.description}`, /\bAI\b/i);
      }
      const combined = await request(app).get('/api/jobs').query({ q: 'intern', location: 'Montreal', category: 'data-analytics' }).expect(200);
      assert.equal(combined.body.total, 2);
      assert.ok(combined.body.items.every(({ location, category }) => location === 'Montreal, QC' && category === 'data-analytics'));
      const empty = await request(app).get('/api/jobs').query({ q: 'no-such-demo-role', location: 'Seattle' }).expect(200);
      assert.equal(empty.body.total, 0);
      assert.equal(empty.body.hasDemo, false);
    } finally { await database.close(); }
  });
});

test('additive job migration preserves legacy rows and is safe to reopen', async () => {
  const { randomUUID } = require('node:crypto');
  const { unlink } = require('node:fs/promises');
  const path = require('node:path');
  const { tmpdir } = require('node:os');
  const { open } = require('sqlite');
  const sqlite3 = require('sqlite3');
  const filename = path.join(tmpdir(), `careerconnect-migration-${randomUUID()}.sqlite`);
  let database;
  try {
    database = await open({ filename, driver: sqlite3.Database });
    await database.exec(`CREATE TABLE jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, company TEXT NOT NULL,
      location TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, demo_key TEXT UNIQUE
    ); INSERT INTO jobs (title, company, location, category, description)
    VALUES ('Legacy job', 'Legacy company', 'Montreal, QC', 'engineering', 'Preserve this entire description.');`);
    await database.close(); database = null;
    for (let pass = 0; pass < 2; pass++) {
      database = await initializeDatabase(filename);
      const response = await request(createApp(database)).get('/api/jobs/1').expect(200);
      assert.equal(response.body.job.description, 'Preserve this entire description.');
      assert.equal(response.body.job.details, null);
      assert.equal(response.body.job.employmentType, null);
      await database.run("UPDATE jobs SET details_json = 'malformed' WHERE id = 1");
      assert.equal((await request(createApp(database)).get('/api/jobs/1').expect(200)).body.job.details, null);
      await assert.rejects(database.run("UPDATE jobs SET employment_type = 'Unknown' WHERE id = 1"), /CHECK/);
      await database.close(); database = null;
    }
  } finally {
    if (database) await database.close();
    await unlink(filename).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  }
});
