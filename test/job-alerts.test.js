const assert = require('node:assert/strict');
const { after, before, beforeEach, describe, test } = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/app');
const { initializeDatabase } = require('../src/database/database');
const {
  headlineMatches, locationMatches, localDate, sendClosingReminders,
} = require('../src/domain/jobAlerts');

const HOST = 'localhost:3000';
const ORIGIN = `http://${HOST}`;
const password = 'DemoPass123';

function addDays(day, count) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + count * 86400000).toISOString().slice(0, 10);
}

describe('Job match rules', () => {
  test('headline matches when most of its keywords are in the job title', () => {
    assert.equal(headlineMatches('Software Developer', 'Junior Software Developer'), true);
    assert.equal(headlineMatches('Software Engineering Student at Concordia', 'Software Engineer'), true);
    assert.equal(headlineMatches('Aspiring Data Analyst', 'Data Analyst Intern'), true);
    assert.equal(headlineMatches('Mechanical Engineer', 'Software Engineer'), false);
    assert.equal(headlineMatches('Student', 'Software Engineer'), false);
  });

  test('location compares the city and ignores accents and province', () => {
    assert.equal(locationMatches('Montreal', 'Montréal, QC'), true);
    assert.equal(locationMatches('Montreal, Quebec', 'Montreal, QC'), true);
    assert.equal(locationMatches('Toronto, ON', 'Montreal, QC'), false);
    assert.equal(locationMatches('', 'Montreal, QC'), false);
  });
});

describe('Job match and closing reminder notifications', () => {
  let database;
  let app;
  let recruiter;

  before(async () => {
    database = await initializeDatabase(':memory:');
    app = createApp(database, { sessionSecret: 'job-alerts-test-secret' });
  });
  beforeEach(async () => {
    await database.run('DELETE FROM notifications');
    await database.run('DELETE FROM applications');
    await database.run('DELETE FROM jobs');
    await database.run('DELETE FROM profiles');
    await database.run('DELETE FROM users');
    recruiter = await signIn('recruiter@example.test', 'recruiter');
  });
  after(async () => database.close());

  async function signIn(email, role = 'job_seeker') {
    const agent = request.agent(app);
    await agent.post('/api/register').set('Host', HOST).set('Origin', ORIGIN)
      .send({ name: 'Test Person', email, password, role, ...(role === 'job_seeker' ? { employmentStatus: 'employed' } : {}) })
      .expect(201);
    await agent.post('/api/login').set('Host', HOST).set('Origin', ORIGIN).send({ email, password }).expect(200);
    return agent;
  }

  async function seeker(email, headline, location) {
    const agent = await signIn(email);
    const user = await database.get('SELECT id FROM users WHERE email = ?', email);
    await database.run('INSERT INTO profiles (user_id, headline, location) VALUES (?, ?, ?)', user.id, headline, location);
    return { agent, id: user.id };
  }

  function post(fields = {}) {
    return recruiter.post('/api/recruiter/jobs').set('Host', HOST).set('Origin', ORIGIN).send({
      title: 'Junior Software Developer', company: 'Maple Tech', location: 'Montreal, QC',
      category: 'software-engineering', description: 'Build web apps.', ...fields,
    });
  }

  async function notificationsFor(userId, type) {
    return database.all('SELECT * FROM notifications WHERE user_id = ? AND type = ? ORDER BY id', userId, type);
  }

  test('a new posting notifies job seekers whose headline or location matches', async () => {
    const both = await seeker('both@example.test', 'Software Developer', 'Montreal');
    const headline = await seeker('headline@example.test', 'Software Developer', 'Toronto, ON');
    const place = await seeker('place@example.test', 'Graphic Designer', 'Montréal, Quebec');
    const neither = await seeker('neither@example.test', 'Graphic Designer', 'Vancouver');

    const { body } = await post().expect(201);

    const [bothNote] = await notificationsFor(both.id, 'job_match');
    assert.match(bothNote.message, /Junior Software Developer at Maple Tech \(Montreal, QC\) matches your headline and location\./);
    assert.equal(bothNote.link, `/workspace/jobs/${body.job.id}`);
    assert.match((await notificationsFor(headline.id, 'job_match'))[0].message, /matches your headline\.$/);
    assert.match((await notificationsFor(place.id, 'job_match'))[0].message, /matches your location\.$/);
    assert.equal((await notificationsFor(neither.id, 'job_match')).length, 0);

    // It shows up through the existing bell API.
    const list = await both.agent.get('/api/notifications').set('Host', HOST).set('Origin', ORIGIN).expect(200);
    assert.equal(list.body.items[0].type, 'job_match');
    assert.equal(list.body.unreadCount, 1);
  });

  test('editing or reopening a posting does not send the same match twice', async () => {
    const person = await seeker('once@example.test', 'Software Developer', 'Toronto');
    const { body } = await post().expect(201);
    const path = `/api/recruiter/jobs/${body.job.id}`;
    await recruiter.patch(path).set('Host', HOST).set('Origin', ORIGIN).send({ description: 'Updated.' }).expect(200);
    await recruiter.patch(`${path}/status`).set('Host', HOST).set('Origin', ORIGIN).send({ status: 'closed' }).expect(200);
    await recruiter.patch(`${path}/status`).set('Host', HOST).set('Origin', ORIGIN).send({ status: 'open' }).expect(200);
    assert.equal((await notificationsFor(person.id, 'job_match')).length, 1);
  });

  test('recruiters and seekers without a profile get no match', async () => {
    const noProfile = await signIn('noprofile@example.test');
    await post().expect(201);
    const recruiterUser = await database.get("SELECT id FROM users WHERE role = 'recruiter'");
    assert.equal((await database.all('SELECT * FROM notifications WHERE type = ?', 'job_match')).length, 0);
    assert.ok(noProfile && recruiterUser);
  });

  test('closing date is validated, saved and shown on the public job', async () => {
    await post({ closingDate: '2026-02-30' }).expect(400);
    const { body } = await post({ closingDate: '2030-01-15' }).expect(201);
    assert.equal(body.job.closingDate, '2030-01-15');
    const publicJob = await request(app).get(`/api/jobs/${body.job.id}`).expect(200);
    assert.equal(publicJob.body.job.closingDate, '2030-01-15');
    const cleared = await recruiter.patch(`/api/recruiter/jobs/${body.job.id}`).set('Host', HOST).set('Origin', ORIGIN)
      .send({ closingDate: null }).expect(200);
    assert.equal(cleared.body.job.closingDate, null);
  });

  test('matching job seekers who have not applied are reminded when a job closes soon', async () => {
    const today = localDate();
    const reminded = await seeker('remind@example.test', 'Software Developer', 'Toronto');
    const applied = await seeker('applied@example.test', 'Software Developer', 'Montreal');
    const other = await seeker('other@example.test', 'Nurse', 'Halifax');

    const { body } = await post({ closingDate: addDays(today, 1) }).expect(201);
    await database.run('INSERT INTO applications (user_id, job_id) VALUES (?, ?)', applied.id, body.job.id);
    await database.run("DELETE FROM notifications WHERE type = 'deadline_reminder'");

    assert.equal(await sendClosingReminders(database), 1);
    const [reminder] = await notificationsFor(reminded.id, 'deadline_reminder');
    assert.equal(reminder.title, 'Job closing tomorrow');
    assert.match(reminder.message, /Junior Software Developer at Maple Tech stops accepting applications tomorrow/);
    assert.equal(reminder.link, `/workspace/jobs/${body.job.id}`);
    assert.equal((await notificationsFor(applied.id, 'deadline_reminder')).length, 0);
    assert.equal((await notificationsFor(other.id, 'deadline_reminder')).length, 0);

    // The hourly check does not repeat it.
    assert.equal(await sendClosingReminders(database), 0);
  });

  test('posting a job that already closes soon sends the reminder right away', async () => {
    const person = await seeker('soon@example.test', 'Software Developer', 'Montreal');
    await post({ closingDate: localDate() }).expect(201);
    const [reminder] = await notificationsFor(person.id, 'deadline_reminder');
    assert.equal(reminder.title, 'Job closing today');
  });

  test('jobs closing later, already past, or closed get no reminder', async () => {
    const today = localDate();
    const person = await seeker('later@example.test', 'Software Developer', 'Montreal');
    await post({ closingDate: addDays(today, 10) }).expect(201);
    await post({ closingDate: addDays(today, -1) }).expect(201);
    const { body } = await post({ closingDate: addDays(today, 2) }).expect(201);
    await recruiter.patch(`/api/recruiter/jobs/${body.job.id}/status`).set('Host', HOST).set('Origin', ORIGIN)
      .send({ status: 'closed' }).expect(200);
    await database.run("DELETE FROM notifications WHERE type = 'deadline_reminder'");
    assert.equal(await sendClosingReminders(database), 0);
    assert.equal((await notificationsFor(person.id, 'deadline_reminder')).length, 0);
  });
});
