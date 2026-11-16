const assert = require('node:assert/strict');
const { after, before, beforeEach, describe, test } = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/app');
const { initializeDatabase } = require('../src/database/database');

describe('Employment on the profile, leaving a job and applying again', () => {
  let database;
  let app;
  let recruiter;
  let recruiterId;
  let sequence = 0;

  before(async () => {
    database = await initializeDatabase(':memory:');
    app = createApp(database, { sessionSecret: 'careerconnect-employment-test-secret' });
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
    recruiterId = (await database.get('SELECT id FROM users WHERE email = ?', credentials.email)).id;
  });

  async function addJob(title = 'Frontend Developer', status = 'open') {
    return (await database.run(
      `INSERT INTO jobs (title, company, location, category, description, status, recruiter_id)
       VALUES (?, 'Northstar Studio', 'Montreal, QC', 'software-engineering', 'Build interfaces.', ?, ?)`,
      title, status, recruiterId
    )).lastID;
  }

  async function seeker({ name = 'Jordan Davis', employmentStatus = 'unemployed' } = {}) {
    sequence += 1;
    const credentials = { email: `seeker-${sequence}@example.test`, password: 'DemoPass123' };
    const agent = request.agent(app);
    await agent.post('/api/register').send({ name, ...credentials, employmentStatus }).expect(201);
    await agent.post('/api/login').send(credentials).expect(200);
    return { agent, credentials };
  }

  async function offered(person, jobId) {
    const applicationId = (await person.agent.post('/api/applications').send({ jobId }).expect(201)).body.application.id;
    await recruiter.patch(`/api/recruiter/applications/${applicationId}/status`).send({ status: 'offered' }).expect(200);
    return applicationId;
  }

  const accept = (person, applicationId) =>
    person.agent.patch(`/api/applications/${applicationId}/offer`).send({ response: 'accepted' });
  const leave = (person) => person.agent.post('/api/profile/employment/unemployed').send({});
  const employment = (person) => person.agent.get('/api/profile/employment');
  const count = async (sql, ...params) => (await database.get(sql, ...params)).n;

  test('requires a signed-in job seeker', async () => {
    await request(app).get('/api/profile/employment').expect(401);
    await request(app).post('/api/profile/employment/unemployed').send({}).expect(401);
    await recruiter.get('/api/profile/employment').expect(403);
    await recruiter.post('/api/profile/employment/unemployed').send({}).expect(403);
  });

  test('an unemployed job seeker has no current job', async () => {
    const person = await seeker();
    const response = await employment(person).expect(200);
    assert.deepEqual(response.body, { employmentStatus: 'unemployed', currentJob: null });
  });

  test('accepting an offer makes the job the current job on the profile', async () => {
    const person = await seeker();
    const applicationId = await offered(person, await addJob());
    await accept(person, applicationId).expect(200);

    const { body } = await employment(person).expect(200);
    assert.equal(body.employmentStatus, 'employed');
    assert.equal(body.currentJob.title, 'Frontend Developer');
    assert.equal(body.currentJob.company, 'Northstar Studio');
    assert.equal(body.currentJob.location, 'Montreal, QC');
    assert.equal(body.currentJob.applicationId, applicationId);
    assert.ok(body.currentJob.startedAt);
  });

  test('declining an offer leaves the profile without a job', async () => {
    const person = await seeker();
    const applicationId = await offered(person, await addJob());
    await person.agent.patch(`/api/applications/${applicationId}/offer`).send({ response: 'declined' }).expect(200);
    assert.deepEqual((await employment(person)).body, { employmentStatus: 'unemployed', currentJob: null });
  });

  test('only one job can be current at a time', async () => {
    const person = await seeker();
    const first = await offered(person, await addJob('Frontend Developer'));
    const second = await offered(person, await addJob('Data Analyst'));
    await accept(person, first).expect(200);

    const blocked = await accept(person, second).expect(409);
    assert.match(blocked.body.error, /already accepted another offer/);
    assert.equal((await employment(person)).body.currentJob.title, 'Frontend Developer');
    // Declining the other offer is still fine.
    await person.agent.patch(`/api/applications/${second}/offer`).send({ response: 'declined' }).expect(200);

    // After leaving the first job, the second can no longer be answered (it was declined), but a new one can be accepted.
    await leave(person).expect(200);
    const third = await offered(person, await addJob('Product Designer'));
    await accept(person, third).expect(200);
    assert.equal((await employment(person)).body.currentJob.title, 'Product Designer');
  });

  test('leaving the job makes the job seeker unemployed and clears the current job', async () => {
    const person = await seeker();
    const applicationId = await offered(person, await addJob());
    await accept(person, applicationId).expect(200);

    const response = await leave(person).expect(200);
    assert.equal(response.body.employmentStatus, 'unemployed');
    assert.equal(response.body.currentJob, null);
    assert.deepEqual((await employment(person)).body, { employmentStatus: 'unemployed', currentJob: null });
    assert.equal((await person.agent.get('/api/session').expect(200)).body.user.employmentStatus, 'unemployed');

    const application = (await person.agent.get('/api/applications').expect(200)).body.items[0];
    assert.ok(application.quitAt);
    assert.equal(application.offerResponse, 'accepted');
  });

  test('the recruiter is told when someone leaves the position', async () => {
    const person = await seeker({ name: 'Ada Lovelace' });
    await accept(person, await offered(person, await addJob())).expect(200);
    await leave(person).expect(200);

    const note = await database.get(
      "SELECT title, message, link FROM notifications WHERE user_id = ? AND title = 'Position left'",
      recruiterId
    );
    assert.deepEqual(note, {
      title: 'Position left',
      message: 'Ada Lovelace has left the Frontend Developer position.',
      link: '/recruiter/dashboard',
    });
    const listed = (await recruiter.get(`/api/recruiter/jobs/${(await database.get('SELECT job_id FROM applications')).job_id}/applications`).expect(200)).body.items[0];
    assert.ok(listed.quitAt);
  });

  test('the welcome notification comes back at every sign-in once unemployed again', async () => {
    const person = await seeker();
    const welcomes = () => count("SELECT COUNT(*) AS n FROM notifications WHERE type = 'welcome'");
    assert.equal(await welcomes(), 1, 'sent at the first sign-in');
    await accept(person, await offered(person, await addJob())).expect(200);
    await person.agent.post('/api/login').send(person.credentials).expect(200);
    assert.equal(await welcomes(), 1, 'none while employed');

    await leave(person).expect(200);
    assert.equal(await welcomes(), 1, 'leaving sends nothing by itself');
    await person.agent.post('/api/login').send(person.credentials).expect(200);
    assert.equal(await welcomes(), 2, 'back at the next sign-in');
    await person.agent.post('/api/login').send(person.credentials).expect(200);
    assert.equal(await welcomes(), 3, 'and every sign-in after that, until employed again');
  });

  test('someone who signed up as employed can switch to unemployed without a job on record', async () => {
    const person = await seeker({ employmentStatus: 'employed' });
    assert.deepEqual((await employment(person)).body, { employmentStatus: 'employed', currentJob: null });
    await leave(person).expect(200);
    assert.equal((await employment(person)).body.employmentStatus, 'unemployed');
    assert.equal(await count("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND title = 'Position left'", recruiterId), 0);
    assert.equal(await count("SELECT COUNT(*) AS n FROM notifications WHERE type = 'welcome'"), 0, 'nothing sent by leaving');
    await person.agent.post('/api/login').send(person.credentials).expect(200);
    assert.equal(await count("SELECT COUNT(*) AS n FROM notifications WHERE type = 'welcome'"), 1, 'sent at the next sign-in');
  });

  test('leaving cannot be repeated, and an unemployed job seeker cannot "leave"', async () => {
    const person = await seeker();
    await leave(person).expect(409);
    await accept(person, await offered(person, await addJob())).expect(200);
    await leave(person).expect(200);
    const again = await leave(person).expect(409);
    assert.equal(again.body.error, 'You are not currently marked as employed.');
    assert.equal(await count("SELECT COUNT(*) AS n FROM notifications WHERE title = 'Position left'"), 1);
  });

  test('simultaneous leave requests have a single winner', async () => {
    const person = await seeker();
    await accept(person, await offered(person, await addJob())).expect(200);
    const results = await Promise.all([leave(person), leave(person), leave(person)]);
    assert.deepEqual(results.map(({ status }) => status).sort(), [200, 409, 409]);
    assert.equal(await count("SELECT COUNT(*) AS n FROM notifications WHERE title = 'Position left'"), 1);
  });

  test('leave rejects request fields and untrusted origins', async () => {
    const person = await seeker({ employmentStatus: 'employed' });
    await person.agent.post('/api/profile/employment/unemployed').send({ status: 'employed' }).expect(400);
    await person.agent.post('/api/profile/employment/unemployed').set('Origin', 'https://evil.example').send({}).expect(403);
    assert.equal((await employment(person)).body.employmentStatus, 'employed');
  });

  test('after leaving, the job can be applied for again and starts over as Applied', async () => {
    const person = await seeker();
    const jobId = await addJob();
    const applicationId = await offered(person, jobId);
    await accept(person, applicationId).expect(200);
    await leave(person).expect(200);
    await database.run("DELETE FROM notifications WHERE type <> 'welcome'");

    const again = await person.agent.post('/api/applications').send({ jobId }).expect(201);
    assert.equal(again.body.application.id, applicationId, 'the same application starts over');
    assert.equal(again.body.application.status, 'applied');
    assert.equal(again.body.application.offerResponse, null);
    assert.equal(again.body.application.quitAt, null);

    // History is kept, with the fresh start recorded.
    const history = (await database.all('SELECT status FROM application_status_history WHERE application_id = ? ORDER BY id', applicationId)).map(({ status }) => status);
    assert.deepEqual(history, ['applied', 'offered', 'applied']);
    // The recruiter hears about it, and the applicant gets no stray "moved to Applied" update.
    assert.equal(await count("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND message LIKE '% applied again for Frontend Developer.'", recruiterId), 1);
    assert.equal(await count("SELECT COUNT(*) AS n FROM notifications WHERE title = 'Application update'"), 0);
    // Still unemployed until they accept again.
    assert.equal((await employment(person)).body.employmentStatus, 'unemployed');

    // A repeat while the new application is active is a duplicate again.
    await person.agent.post('/api/applications').send({ jobId }).expect(409);
    // And the offer cycle works a second time.
    await recruiter.patch(`/api/recruiter/applications/${applicationId}/status`).send({ status: 'offered' }).expect(200);
    await accept(person, applicationId).expect(200);
    assert.equal((await employment(person)).body.currentJob.title, 'Frontend Developer');
  });

  test('applying again needs the job to still be open, and applications that were never quit stay duplicates', async () => {
    const person = await seeker();
    const jobId = await addJob();
    const applicationId = await offered(person, jobId);
    await person.agent.post('/api/applications').send({ jobId }).expect(409);

    await accept(person, applicationId).expect(200);
    await person.agent.post('/api/applications').send({ jobId }).expect(409);
    await leave(person).expect(200);
    await database.run("UPDATE jobs SET status = 'closed' WHERE id = ?", jobId);
    await person.agent.post('/api/applications').send({ jobId }).expect(404);
    assert.ok((await database.get('SELECT quit_at FROM applications WHERE id = ?', applicationId)).quit_at);
  });

  test('another applicant’s history is untouched when someone leaves and re-applies', async () => {
    const jobId = await addJob();
    const ada = await seeker({ name: 'Ada' });
    const dan = await seeker({ name: 'Dan' });
    const adaApplication = await offered(ada, jobId);
    const danApplication = (await dan.agent.post('/api/applications').send({ jobId }).expect(201)).body.application.id;
    await accept(ada, adaApplication).expect(200);
    await leave(ada).expect(200);
    await ada.agent.post('/api/applications').send({ jobId }).expect(201);
    assert.equal((await database.get('SELECT status FROM applications WHERE id = ?', danApplication)).status, 'applied');
    assert.equal(await count('SELECT COUNT(*) AS n FROM application_status_history WHERE application_id = ?', danApplication), 1);
  });
});
