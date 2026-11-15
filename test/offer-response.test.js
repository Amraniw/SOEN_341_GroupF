const assert = require('node:assert/strict');
const { after, before, beforeEach, describe, test } = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/app');
const { initializeDatabase } = require('../src/database/database');

describe('Accepting or declining a job offer', () => {
  let database;
  let app;
  let jobId;
  let recruiterId;
  let sequence = 0;

  before(async () => {
    database = await initializeDatabase(':memory:');
    app = createApp(database, { sessionSecret: 'careerconnect-offer-test-secret' });
  });
  after(async () => database.close());

  beforeEach(async () => {
    await database.run('DELETE FROM notifications');
    await database.run('DELETE FROM applications');
    await database.run('DELETE FROM jobs');
    await database.run('DELETE FROM users');
    const recruiter = request.agent(app);
    const credentials = { email: 'recruiter@example.test', password: 'DemoPass123' };
    await recruiter.post('/api/register').send({ name: 'Riley Recruiter', ...credentials, role: 'recruiter' }).expect(201);
    recruiterId = (await database.get('SELECT id FROM users WHERE email = ?', credentials.email)).id;
    jobId = (await database.run(
      `INSERT INTO jobs (title, company, location, category, description, status, recruiter_id)
       VALUES ('Frontend Developer', 'Northstar Studio', 'Montreal, QC', 'software-engineering', 'Build interfaces.', 'open', ?)`,
      recruiterId
    )).lastID;
  });

  async function jobSeeker({ employmentStatus = 'unemployed', status = 'offered', name = 'Jordan Davis' } = {}) {
    sequence += 1;
    const credentials = { email: `seeker-${sequence}@example.test`, password: 'DemoPass123' };
    const agent = request.agent(app);
    await agent.post('/api/register').send({ name, ...credentials, employmentStatus }).expect(201);
    await agent.post('/api/login').send(credentials).expect(200);
    const applicationId = (await agent.post('/api/applications').send({ jobId }).expect(201)).body.application.id;
    if (status !== 'applied') await database.run('UPDATE applications SET status = ? WHERE id = ?', status, applicationId);
    return { agent, credentials, applicationId };
  }

  const employment = async (email) =>
    (await database.get('SELECT employment_status FROM users WHERE email = ?', email)).employment_status;

  test('requires a signed-in job seeker', async () => {
    const { applicationId } = await jobSeeker();
    await request(app).patch(`/api/applications/${applicationId}/offer`).send({ response: 'accepted' }).expect(401);
    const recruiter = request.agent(app);
    await recruiter.post('/api/login').send({ email: 'recruiter@example.test', password: 'DemoPass123' }).expect(200);
    await recruiter.patch(`/api/applications/${applicationId}/offer`).send({ response: 'accepted' }).expect(403);
    assert.equal((await database.get('SELECT offer_response FROM applications')).offer_response, null);
  });

  test('accepting records the answer and marks the job seeker as employed', async () => {
    const { agent, credentials, applicationId } = await jobSeeker();
    assert.equal(await employment(credentials.email), 'unemployed');

    const response = await agent.patch(`/api/applications/${applicationId}/offer`).send({ response: 'accepted' }).expect(200);
    assert.equal(response.body.application.offerResponse, 'accepted');
    assert.ok(response.body.application.offerRespondedAt);
    assert.equal(response.body.application.status, 'offered');
    assert.equal(await employment(credentials.email), 'employed');
    assert.equal((await agent.get('/api/session').expect(200)).body.user.employmentStatus, 'employed');
    assert.equal((await agent.get('/api/applications').expect(200)).body.items[0].offerResponse, 'accepted');
  });

  test('an employed job seeker no longer gets the welcome notification on sign-in', async () => {
    const { agent, credentials, applicationId } = await jobSeeker();
    const welcomes = async () => (await database.get("SELECT COUNT(*) AS n FROM notifications WHERE type = 'welcome'")).n;
    assert.equal(await welcomes(), 1, 'the first sign-in, while unemployed, sends it');
    await agent.patch(`/api/applications/${applicationId}/offer`).send({ response: 'accepted' }).expect(200);
    await agent.post('/api/login').send(credentials).expect(200);
    assert.equal(await welcomes(), 1, 'signing in again after accepting adds none');
  });

  test('declining records the answer and leaves employment unchanged', async () => {
    const { agent, credentials, applicationId } = await jobSeeker();
    const response = await agent.patch(`/api/applications/${applicationId}/offer`).send({ response: 'declined' }).expect(200);
    assert.equal(response.body.application.offerResponse, 'declined');
    assert.equal(await employment(credentials.email), 'unemployed');
    await agent.post('/api/login').send(credentials).expect(200);
    assert.equal((await database.get("SELECT COUNT(*) AS n FROM notifications WHERE type = 'welcome'")).n, 2);
  });

  test('the recruiter is notified of the answer', async () => {
    const accepted = await jobSeeker({ name: 'Ada Lovelace' });
    await accepted.agent.patch(`/api/applications/${accepted.applicationId}/offer`).send({ response: 'accepted' }).expect(200);
    const declined = await jobSeeker({ name: 'Grace Hopper' });
    await declined.agent.patch(`/api/applications/${declined.applicationId}/offer`).send({ response: 'declined' }).expect(200);

    const rows = await database.all(
      "SELECT title, message, link FROM notifications WHERE user_id = ? AND title LIKE 'Offer %' ORDER BY id",
      recruiterId
    );
    assert.deepEqual(rows, [
      { title: 'Offer accepted', message: 'Ada Lovelace accepted your offer for Frontend Developer.', link: '/recruiter/dashboard' },
      { title: 'Offer declined', message: 'Grace Hopper declined your offer for Frontend Developer.', link: '/recruiter/dashboard' },
    ]);
  });

  test('an offer can only be answered once', async () => {
    const { agent, credentials, applicationId } = await jobSeeker();
    await agent.patch(`/api/applications/${applicationId}/offer`).send({ response: 'declined' }).expect(200);
    const again = await agent.patch(`/api/applications/${applicationId}/offer`).send({ response: 'accepted' }).expect(409);
    assert.equal(again.body.error, 'You already declined this offer.');
    assert.equal((await database.get('SELECT offer_response FROM applications')).offer_response, 'declined');
    assert.equal(await employment(credentials.email), 'unemployed');
  });

  test('simultaneous answers have a single winner', async () => {
    const { agent, applicationId } = await jobSeeker();
    const results = await Promise.all(
      ['accepted', 'declined', 'accepted'].map((value) =>
        agent.patch(`/api/applications/${applicationId}/offer`).send({ response: value })
      )
    );
    assert.deepEqual(results.map(({ status }) => status).sort(), [200, 409, 409]);
    assert.equal((await database.get("SELECT COUNT(*) AS n FROM notifications WHERE title LIKE 'Offer %'")).n, 1);
  });

  test('only an applied-to offer can be answered', async () => {
    for (const status of ['applied', 'under_review', 'interview', 'rejected']) {
      const { agent, credentials, applicationId } = await jobSeeker({ status });
      const response = await agent.patch(`/api/applications/${applicationId}/offer`).send({ response: 'accepted' }).expect(409);
      assert.equal(response.body.error, 'This application does not have an offer to respond to.');
      assert.equal(await employment(credentials.email), 'unemployed');
    }
  });

  test('job seekers cannot answer someone else’s offer', async () => {
    const owner = await jobSeeker({ name: 'Owner' });
    const other = await jobSeeker({ name: 'Someone Else', status: 'applied' });
    await other.agent.patch(`/api/applications/${owner.applicationId}/offer`).send({ response: 'accepted' }).expect(404);
    assert.equal((await database.get('SELECT offer_response FROM applications WHERE id = ?', owner.applicationId)).offer_response, null);
    assert.equal(await employment(owner.credentials.email), 'unemployed');
    assert.equal(await employment(other.credentials.email), 'unemployed');
  });

  test('invalid requests are rejected without changing anything', async () => {
    const { agent, credentials, applicationId } = await jobSeeker();
    for (const body of [{}, { response: 'maybe' }, { response: '' }, { response: null }, { response: ['accepted'] }]) {
      assert.equal((await agent.patch(`/api/applications/${applicationId}/offer`).send(body).expect(400)).body.error, 'Choose whether to accept or decline the offer.');
    }
    assert.equal((await agent.patch(`/api/applications/${applicationId}/offer`).send({ response: 'accepted', status: 'offered' }).expect(400)).body.error, 'The offer response contains unsupported information.');
    for (const id of ['0', '-1', 'abc', '1.5', '999999']) {
      await agent.patch(`/api/applications/${id}/offer`).send({ response: 'accepted' }).expect(404);
    }
    assert.equal((await database.get('SELECT offer_response FROM applications')).offer_response, null);
    assert.equal(await employment(credentials.email), 'unemployed');
  });

  test('untrusted origins cannot answer an offer', async () => {
    const { agent, applicationId } = await jobSeeker();
    await agent.patch(`/api/applications/${applicationId}/offer`).set('Origin', 'https://evil.example').send({ response: 'accepted' }).expect(403);
    assert.equal((await database.get('SELECT offer_response FROM applications')).offer_response, null);
  });

  test('the database only allows accepted or declined', async () => {
    const { applicationId } = await jobSeeker();
    await assert.rejects(database.run('UPDATE applications SET offer_response = ? WHERE id = ?', 'perhaps', applicationId), /CHECK/);
  });
});
