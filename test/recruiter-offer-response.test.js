const assert = require('node:assert/strict');
const { after, before, beforeEach, describe, test } = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/app');
const { initializeDatabase } = require('../src/database/database');

describe('Recruiters see how applicants answered their offers', () => {
  let database;
  let app;
  let recruiter;
  let jobId;

  before(async () => {
    database = await initializeDatabase(':memory:');
    app = createApp(database, { sessionSecret: 'careerconnect-recruiter-offer-test-secret' });
  });
  after(async () => database.close());

  beforeEach(async () => {
    await database.run('DELETE FROM notifications');
    await database.run('DELETE FROM applications');
    await database.run('DELETE FROM jobs');
    await database.run('DELETE FROM users');
    recruiter = request.agent(app);
    const credentials = { email: 'recruiter@example.test', password: 'DemoPass123' };
    await recruiter.post('/api/register').send({ name: 'Riley Recruiter', ...credentials, role: 'recruiter' }).expect(201);
    await recruiter.post('/api/login').send(credentials).expect(200);
    const { id } = await database.get('SELECT id FROM users WHERE email = ?', credentials.email);
    jobId = (await database.run(
      `INSERT INTO jobs (title, company, location, category, description, status, recruiter_id)
       VALUES ('Frontend Developer', 'Northstar Studio', 'Montreal, QC', 'software-engineering', 'Build interfaces.', 'open', ?)`,
      id
    )).lastID;
  });

  async function applicant(name) {
    const credentials = { email: `${name.split(' ')[0].toLowerCase()}@example.test`, password: 'DemoPass123' };
    const agent = request.agent(app);
    await agent.post('/api/register').send({ name, ...credentials, employmentStatus: 'unemployed' }).expect(201);
    await agent.post('/api/login').send(credentials).expect(200);
    const applicationId = (await agent.post('/api/applications').send({ jobId }).expect(201)).body.application.id;
    return { agent, applicationId };
  }

  const listed = async () => (await recruiter.get(`/api/recruiter/jobs/${jobId}/applications`).expect(200)).body.items;

  test('the full flow: offer sent, then accepted or declined, is visible to the recruiter', async () => {
    const ada = await applicant('Ada Lovelace');
    const dan = await applicant('Dan Brown');
    const wes = await applicant('Wes Waiting');
    for (const { applicationId } of [ada, dan, wes]) {
      await recruiter.patch(`/api/recruiter/applications/${applicationId}/status`).send({ status: 'offered' }).expect(200);
    }

    // The applicant is told about the offer and can follow the link to answer it.
    const note = (await ada.agent.get('/api/notifications?unread=true').expect(200)).body.items.find(({ type }) => type === 'job_offer');
    assert.equal(note.link, '/applications/index.html');

    assert.ok((await listed()).every((item) => item.offerResponse === null && item.offerRespondedAt === null));

    await ada.agent.patch(`/api/applications/${ada.applicationId}/offer`).send({ response: 'accepted' }).expect(200);
    await dan.agent.patch(`/api/applications/${dan.applicationId}/offer`).send({ response: 'declined' }).expect(200);

    const byName = Object.fromEntries((await listed()).map((item) => [item.applicant.name, item]));
    assert.equal(byName['Ada Lovelace'].offerResponse, 'accepted');
    assert.ok(byName['Ada Lovelace'].offerRespondedAt);
    assert.equal(byName['Dan Brown'].offerResponse, 'declined');
    assert.equal(byName['Wes Waiting'].offerResponse, null);
    assert.equal(byName['Wes Waiting'].status, 'offered');
  });

  test('the status endpoint also reports the answer, and other recruiters still cannot see the posting', async () => {
    const ada = await applicant('Ada Lovelace');
    await recruiter.patch(`/api/recruiter/applications/${ada.applicationId}/status`).send({ status: 'offered' }).expect(200);
    await ada.agent.patch(`/api/applications/${ada.applicationId}/offer`).send({ response: 'accepted' }).expect(200);
    const moved = await recruiter.patch(`/api/recruiter/applications/${ada.applicationId}/status`).send({ status: 'interview' }).expect(200);
    assert.equal(moved.body.application.offerResponse, 'accepted');

    const other = request.agent(app);
    const credentials = { email: 'other-recruiter@example.test', password: 'DemoPass123' };
    await other.post('/api/register').send({ name: 'Other Recruiter', ...credentials, role: 'recruiter' }).expect(201);
    await other.post('/api/login').send(credentials).expect(200);
    await other.get(`/api/recruiter/jobs/${jobId}/applications`).expect(404);
  });
});
