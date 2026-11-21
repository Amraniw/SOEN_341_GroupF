const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { initializeDatabase } = require('../src/database/database');
const { createApp } = require('../src/app');

test('legacy career text is preserved exactly when untouched, including ambiguous multiline entries', async () => {
  const { readEntries, compatibleEntries } = await import('../src/pages/assets/profile-fields.mjs');
  for (const kind of ['experience', 'education']) {
    for (const original of ['NVIDIA\n\nSpaceX\n\nNASA', 'Role\nCompany\n2025–Present\nDetails', '  Organization  ', 'CCPROFILE:experience:1:not-json']) {
      assert.equal(compatibleEntries(original, readEntries(original, kind), kind), original);
    }
  }
});

test('structured entries round-trip, retain legacy notes, and validate dates without persisting UI ids', async () => {
  const { readEntries, writeEntries, entryError } = await import('../src/pages/assets/profile-fields.mjs');
  const entries = [{ company: 'NVIDIA', role: 'Engineer', start: '2025-01', present: true, end: '2026-01', legacy: 'Original details', _id: 'ui-only' }];
  const encoded = writeEntries(entries, 'experience');
  const decoded = readEntries(encoded, 'experience');
  assert.equal(decoded[0].company, 'NVIDIA');
  assert.equal(decoded[0].legacy, 'Original details');
  assert.equal(decoded[0].present, true);
  assert.ok(!encoded.includes('_id'));
  assert.ok(!decoded[0].end);
  assert.equal(entryError(decoded[0], 'experience'), '');
  assert.match(entryError({ company: 'Team', start: '2026-02', end: '2025-01' }, 'experience'), /End date/);
  assert.match(entryError({ institution: 'University', start: '2025-15' }, 'education'), /valid month/);
  assert.equal(writeEntries([{ _id: 'blank' }], 'experience'), '');
  assert.equal(entryError({ _id: 'blank' }, 'experience'), '');
});

test('structured profile display escapes entries and does not fabricate missing role or dates', async () => {
  const { writeEntries } = await import('../src/pages/assets/profile-fields.mjs');
  const { renderProfileStory } = await import('../src/pages/assets/profile-story.mjs');
  const escape = value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const html = renderProfileStory({ experience: writeEntries([{ company: '<img src=x>', role: 'Engineer', start: '2025-01', present: true }], 'experience'), education: writeEntries([{ institution: 'Concordia' }], 'education') }, escape);
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('Jan 2025 – Present'));
  assert.ok(html.includes('Concordia'));
  assert.ok(!html.includes('Degree'));
});

test('existing profile API persists structured text and enforces its original length limits', async () => {
  const { writeEntries } = await import('../src/pages/assets/profile-fields.mjs');
  const db = await initializeDatabase(':memory:');
  try {
    const app = createApp(db, { sessionSecret: 'profile-collection-test' });
    const agent = request.agent(app);
    await agent.post('/api/register').send({ name: 'Profile User', email: 'collections@example.test', password: 'Password123' }).expect(201);
    await agent.post('/api/login').send({ email: 'collections@example.test', password: 'Password123' }).expect(200);
    const experience = writeEntries([{ company: 'Northstar', role: 'Engineer', start: '2025-01', present: true }], 'experience');
    const education = writeEntries([{ institution: 'Concordia', program: 'Software Engineering', start: '2022-09', end: '2026-05' }], 'education');
    await agent.put('/api/profile').send({ headline: 'Engineer', skills: 'SQL, C++', experience, education }).expect(201);
    const result = (await agent.get('/api/profile').expect(200)).body.profile;
    assert.equal(result.experience, experience);
    assert.equal(result.education, education);
    await agent.put('/api/profile').send({ headline: 'Engineer', experience: 'x'.repeat(1501) }).expect(400);
    assert.equal((await agent.get('/api/profile').expect(200)).body.profile.experience, experience);
  } finally { await db.close(); }
});
