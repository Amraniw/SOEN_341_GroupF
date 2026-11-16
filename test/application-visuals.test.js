const { test } = require('node:test');
const assert = require('node:assert/strict');
test('seeker timeline shows submission and current state without superseded decisions', async () => {
  const { renderHistory } = await import('../src/pages/assets/application-visuals.mjs');
  const history = ['applied', 'offered', 'interview', 'offered', 'under_review'].map((status) => ({ status, statusLabel: status, changedAt: '2026-11-16' }));
  const html = renderHistory(history, (value) => value, (value) => value);
  assert.ok(html.includes('applied'));
  assert.ok(html.includes('under_review'));
  assert.ok(!html.includes('offered'));
  assert.ok(!html.includes('interview'));
});
test('daily calendar includes empty days and counts multiple submissions on a UTC day', async () => {
  const { activityDays } = await import('../src/pages/assets/application-visuals.mjs');
  const days = activityDays([{ appliedAt: '2026-11-15 12:00:00' }, { appliedAt: '2026-11-15 18:00:00' }], '30', new Date('2026-11-16T12:00:00Z'));
  assert.equal(days.find((day) => day.date === '2026-11-15').count, 2);
  assert.equal(days.find((day) => day.date === '2026-11-16').count, 0);
  assert.equal(days.reduce((sum, day) => sum + day.count, 0), 2);
  assert.equal(days.at(-1).date, '2026-12-31');
  assert.equal(days.filter((day) => day.inYear).length, 365);
  const leap = activityDays([], 'all', new Date('2028-06-01T12:00:00Z'));
  assert.equal(leap.filter((day) => day.inYear).length, 366);
  const { renderActivity } = await import('../src/pages/assets/application-visuals.mjs');
  const html = renderActivity([], 'all', (v) => v, new Date('2026-11-16T12:00:00Z'));
  assert.equal((html.match(/type="button"/g) || []).length, 365);
  for (const month of ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']) assert.ok(html.includes(month));
  assert.ok(html.includes('calendar-year">2026'));
});
