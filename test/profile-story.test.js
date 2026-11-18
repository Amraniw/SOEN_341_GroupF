const { test } = require('node:test');
const assert = require('node:assert/strict');
const escape = (value) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

test('recruiter profiles use distinct heading references without owner-only editing prompts', async () => {
  const { renderProfileStory } = await import('../src/pages/assets/profile-story.mjs');
  const profile = { summary: '<script>untrusted</script>', experience: 'Legacy company' };
  const first = renderProfileStory(profile, escape, { idPrefix: 'candidate-1', showMissing: false });
  const second = renderProfileStory(profile, escape, { idPrefix: 'candidate-2', showMissing: false });
  assert.ok(first.includes('aria-labelledby="candidate-1-summary-heading"'));
  assert.ok(second.includes('id="candidate-2-summary-heading"'));
  assert.ok(!first.includes('candidate-2'));
  assert.ok(!first.includes('Edit profile'));
  assert.ok(!first.includes('<script>'));
  assert.ok(first.includes('Legacy company'));
  assert.equal(renderProfileStory({}, escape, { showMissing: false }), '');
});

test('professional profile preserves free text without inventing structured career facts', async () => {
  const { renderProfileStory } = await import('../src/pages/assets/profile-story.mjs');
  const experience = 'Developer\nIndependent project, 2025\nBuilt an accessible site.\n\nVolunteer\nCommunity project';
  const html = renderProfileStory({ summary: 'A stored summary.', skills: 'JavaScript, CSS\nAccessibility; SQL', experience, education: 'BEng\nConcordia University\n2022–2026' }, escape);
  assert.ok(html.includes('A stored summary.'));
  for (const entry of experience.split('\n\n')) assert.ok(html.includes(escape(entry)));
  for (const skill of ['JavaScript', 'CSS', 'Accessibility', 'SQL']) assert.ok(html.includes(`<li>${skill}</li>`));
  assert.ok(html.includes('BEng\nConcordia University\n2022–2026'));
  assert.ok(!html.includes('profile-missing'));
});

test('incomplete profile groups missing fields and escapes stored markup', async () => {
  const { renderProfileStory } = await import('../src/pages/assets/profile-story.mjs');
  const html = renderProfileStory({ summary: '<img src=x onerror=alert(1)>', skills: '<script>test</script>' }, escape);
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;img'));
  assert.equal((html.match(/class="profile-missing"/g) || []).length, 1);
  assert.ok(!html.includes('Not added yet'));
  const empty = renderProfileStory({}, escape);
  assert.ok(!empty.includes('<section'));
  assert.equal((empty.match(/profile-missing/g) || []).length, 1);
});

test('companies and institutions lead in bold, with roles and degrees beneath', async () => {
  const { writeEntries } = await import('../src/pages/assets/profile-fields.mjs');
  const { renderProfileStory } = await import('../src/pages/assets/profile-story.mjs');
  const html = renderProfileStory({ experience: writeEntries([{ company: 'NVIDIA', role: 'GPU Designer' }, { company: 'NASA' }], 'experience'), education: writeEntries([{ institution: 'Concordia', program: 'Aerospace Engineering' }], 'education') }, escape);
  for (const name of ['NVIDIA', 'NASA', 'Concordia']) assert.ok(html.includes(`<strong class="profile-record-title">${name}</strong>`));
  for (const name of ['GPU Designer', 'Aerospace Engineering']) {
    assert.ok(html.includes(`<span class="profile-record-organization">${name}</span>`));
    assert.ok(!html.includes(`<strong class="profile-record-title">${name}</strong>`));
  }
  assert.ok(html.indexOf('NVIDIA') < html.indexOf('GPU Designer'));
});
