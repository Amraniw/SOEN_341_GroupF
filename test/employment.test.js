const assert = require('node:assert/strict');
const { after, before, beforeEach, describe, test } = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/app');
const { initializeDatabase } = require('../src/database/database');

describe('Current jobs on the profile, leaving a job and applying again', () => {
  let database;
  let app;
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
    const recruiter = request.agent(app);
    const credentials = { email: 'recruiter@example.test', password: 'DemoPass123' };
    await recruiter.post('/api/register').send({ name: 'Riley Recruiter', ...credentials, role: 'recruiter' }).expect(201);
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

  // Applies, then the recruiter's offer arrives (set directly: this suite is about what happens next).
  async function offered(person, jobId) {
    const applicationId = (await person.agent.post('/api/applications').send({ jobId }).expect(201)).body.application.id;
    await database.run("UPDATE applications SET status = 'offered' WHERE id = ?", applicationId);
    return applicationId;
  }

  const accept = (person, applicationId) =>
    person.agent.patch(`/api/applications/${applicationId}/offer`).send({ response: 'accepted' });
  const leave = (person, applicationId) =>
    person.agent.post(`/api/profile/employment/jobs/${applicationId}/leave`).send({});
  const employment = (person) => person.agent.get('/api/profile/employment');
  const count = async (sql, ...params) => (await database.get(sql, ...params)).n;
  const welcomes = () => count("SELECT COUNT(*) AS n FROM notifications WHERE type = 'welcome'");
  const titles = (body) => body.currentJobs.map((job) => job.title);

  test('requires a signed-in job seeker', async () => {
    const person = await seeker();
    await request(app).get('/api/profile/employment').expect(401);
    await request(app).post('/api/profile/employment/jobs/1/leave').send({}).expect(401);
    await request(app).post('/api/profile/employment/unemployed').send({}).expect(401);
    const recruiter = request.agent(app);
    await recruiter.post('/api/login').send({ email: 'recruiter@example.test', password: 'DemoPass123' }).expect(200);
    await recruiter.get('/api/profile/employment').expect(403);
    await recruiter.post('/api/profile/employment/jobs/1/leave').send({}).expect(403);
    await recruiter.post('/api/profile/employment/unemployed').send({}).expect(403);
    assert.equal((await employment(person)).body.employmentStatus, 'unemployed');
  });

  test('an unemployed job seeker has no current jobs', async () => {
    const person = await seeker();
    assert.deepEqual((await employment(person).expect(200)).body, { employmentStatus: 'unemployed', currentJobs: [] });
  });

  test('accepting an offer puts the job on the profile and tells the recruiter', async () => {
    const person = await seeker({ name: 'Ada Lovelace' });
    const applicationId = await offered(person, await addJob());
    await accept(person, applicationId).expect(200);

    const { body } = await employment(person).expect(200);
    assert.equal(body.employmentStatus, 'employed');
    assert.equal(body.currentJobs.length, 1);
    assert.deepEqual(
      { title: body.currentJobs[0].title, company: body.currentJobs[0].company, location: body.currentJobs[0].location, applicationId: body.currentJobs[0].applicationId },
      { title: 'Frontend Developer', company: 'Northstar Studio', location: 'Montreal, QC', applicationId }
    );
    assert.ok(body.currentJobs[0].startedAt);
    assert.equal(
      (await database.get("SELECT message FROM notifications WHERE user_id = ? AND title = 'Offer accepted'", recruiterId)).message,
      'Ada Lovelace accepted your offer for Frontend Developer.'
    );
  });

  test('declining an offer puts nothing on the profile', async () => {
    const person = await seeker();
    const applicationId = await offered(person, await addJob());
    await person.agent.patch(`/api/applications/${applicationId}/offer`).send({ response: 'declined' }).expect(200);
    assert.deepEqual((await employment(person)).body, { employmentStatus: 'unemployed', currentJobs: [] });
  });

  test('several jobs can be current at once, newest first', async () => {
    const person = await seeker();
    for (const title of ['Frontend Developer', 'Data Analyst', 'Product Designer']) {
      await accept(person, await offered(person, await addJob(title))).expect(200);
    }
    const { body } = await employment(person).expect(200);
    assert.equal(body.employmentStatus, 'employed');
    assert.deepEqual(titles(body).sort(), ['Data Analyst', 'Frontend Developer', 'Product Designer']);
  });

  test('leaving one of several jobs keeps the job seeker employed', async () => {
    const person = await seeker();
    const first = await offered(person, await addJob('Frontend Developer'));
    const second = await offered(person, await addJob('Data Analyst'));
    await accept(person, first).expect(200);
    await accept(person, second).expect(200);

    const response = await leave(person, first).expect(200);
    assert.equal(response.body.employmentStatus, 'employed');
    assert.deepEqual(titles(response.body), ['Data Analyst']);
    assert.equal((await person.agent.get('/api/session').expect(200)).body.user.employmentStatus, 'employed');
    assert.equal(await welcomes(), 1, 'still employed, so no welcome beyond the first sign-in');
  });

  test('leaving the last job makes the job seeker unemployed again', async () => {
    const person = await seeker();
    const first = await offered(person, await addJob('Frontend Developer'));
    const second = await offered(person, await addJob('Data Analyst'));
    await accept(person, first).expect(200);
    await accept(person, second).expect(200);
    await leave(person, first).expect(200);

    const last = await leave(person, second).expect(200);
    assert.deepEqual(last.body.currentJobs, []);
    assert.equal(last.body.employmentStatus, 'unemployed');
    assert.equal((await person.agent.get('/api/session').expect(200)).body.user.employmentStatus, 'unemployed');
    const applications = (await person.agent.get('/api/applications').expect(200)).body.items;
    assert.ok(applications.every((application) => application.quitAt && application.offerResponse === 'accepted'));
  });

  test('every sign-in sends the welcome again once unemployed, and not while employed', async () => {
    const person = await seeker();
    const applicationId = await offered(person, await addJob());
    assert.equal(await welcomes(), 1, 'the first sign-in, while unemployed');
    await accept(person, applicationId).expect(200);
    await person.agent.post('/api/login').send(person.credentials).expect(200);
    assert.equal(await welcomes(), 1, 'none while employed');

    await leave(person, applicationId).expect(200);
    assert.equal(await welcomes(), 1, 'leaving sends nothing by itself');
    await person.agent.post('/api/login').send(person.credentials).expect(200);
    assert.equal(await welcomes(), 2, 'back at the next sign-in');
    await person.agent.post('/api/login').send(person.credentials).expect(200);
    assert.equal(await welcomes(), 3, 'and at every sign-in until employed again');
  });

  test('the recruiter of the job that was left is told, and no one else', async () => {
    const person = await seeker({ name: 'Ada Lovelace' });
    const otherRecruiter = (await database.run(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('Other Recruiter', 'other@example.test', 'x', 'recruiter')"
    )).lastID;
    const firstJob = await addJob('Frontend Developer');
    const secondJob = (await database.run(
      `INSERT INTO jobs (title, company, location, category, description, status, recruiter_id)
       VALUES ('Data Analyst', 'Other Co', 'Remote', 'data-analytics', 'x', 'open', ?)`, otherRecruiter
    )).lastID;
    const first = await offered(person, firstJob);
    const second = await offered(person, secondJob);
    await accept(person, first).expect(200);
    await accept(person, second).expect(200);

    await leave(person, first).expect(200);
    const note = (userId) => database.get("SELECT message, link FROM notifications WHERE user_id = ? AND title = 'Position left'", userId);
    assert.deepEqual(await note(recruiterId), { message: 'Ada Lovelace has left the Frontend Developer position.', link: '/recruiter/dashboard' });
    assert.equal(await note(otherRecruiter), undefined);
  });

  test('only a job that is currently held can be left, and only once', async () => {
    const person = await seeker();
    const other = await seeker({ name: 'Someone Else' });
    const applicationId = await offered(person, await addJob());
    const declined = await offered(person, await addJob('Data Analyst'));
    await person.agent.patch(`/api/applications/${declined}/offer`).send({ response: 'declined' }).expect(200);

    await leave(person, applicationId).expect(404); // offered, not accepted yet
    await leave(person, declined).expect(404); // declined, never held
    await accept(person, applicationId).expect(200);
    await leave(other, applicationId).expect(404); // someone else's job
    for (const id of ['0', '-1', 'abc', '1.5', '999999']) {
      await person.agent.post(`/api/profile/employment/jobs/${id}/leave`).send({}).expect(404);
    }
    await leave(person, applicationId).expect(200);
    const again = await leave(person, applicationId).expect(409);
    assert.equal(again.body.error, 'You have already left this job.');
    assert.equal(await count("SELECT COUNT(*) AS n FROM notifications WHERE title = 'Position left'"), 1);
  });

  test('simultaneous leave requests have a single winner', async () => {
    const person = await seeker();
    const applicationId = await offered(person, await addJob());
    await accept(person, applicationId).expect(200);
    const results = await Promise.all([leave(person, applicationId), leave(person, applicationId), leave(person, applicationId)]);
    assert.deepEqual(results.map(({ status }) => status).sort(), [200, 409, 409]);
    assert.equal(await count("SELECT COUNT(*) AS n FROM notifications WHERE title = 'Position left'"), 1);
  });

  test('leaving rejects request fields and untrusted origins', async () => {
    const person = await seeker();
    const applicationId = await offered(person, await addJob());
    await accept(person, applicationId).expect(200);
    await person.agent.post(`/api/profile/employment/jobs/${applicationId}/leave`).send({ jobId: 2 }).expect(400);
    await person.agent.post(`/api/profile/employment/jobs/${applicationId}/leave`).set('Origin', 'https://evil.example').send({}).expect(403);
    assert.equal((await employment(person)).body.currentJobs.length, 1);
  });

  test('someone who signed up as employed, with no job on record, can mark themselves unemployed', async () => {
    const person = await seeker({ employmentStatus: 'employed' });
    assert.deepEqual((await employment(person)).body, { employmentStatus: 'employed', currentJobs: [] });
    assert.equal(await welcomes(), 0);
    const response = await person.agent.post('/api/profile/employment/unemployed').send({}).expect(200);
    assert.equal(response.body.employmentStatus, 'unemployed');
    await person.agent.post('/api/profile/employment/unemployed').send({}).expect(409);
    await person.agent.post('/api/login').send(person.credentials).expect(200);
    assert.equal(await welcomes(), 1, 'the welcome applies from the next sign-in');
  });

  test('that shortcut is not a way around leaving jobs one by one', async () => {
    const person = await seeker();
    const applicationId = await offered(person, await addJob());
    await accept(person, applicationId).expect(200);
    const blocked = await person.agent.post('/api/profile/employment/unemployed').send({}).expect(409);
    assert.match(blocked.body.error, /Leave your current jobs first/);
    assert.equal((await employment(person)).body.employmentStatus, 'employed');
    await person.agent.post('/api/profile/employment/unemployed').send({ status: 'x' }).expect(400);
    await person.agent.post('/api/profile/employment/unemployed').set('Origin', 'https://evil.example').send({}).expect(403);
  });

  test('after leaving, the job can be applied for again and starts over as Applied', async () => {
    const person = await seeker();
    const jobId = await addJob();
    const applicationId = await offered(person, jobId);
    await accept(person, applicationId).expect(200);
    await leave(person, applicationId).expect(200);
    await database.run("DELETE FROM notifications WHERE type <> 'welcome'");

    const again = await person.agent.post('/api/applications').send({ jobId }).expect(201);
    assert.equal(again.body.application.id, applicationId, 'the same application starts over');
    assert.equal(again.body.application.status, 'applied');
    assert.equal(again.body.application.offerResponse, null);
    assert.equal(again.body.application.quitAt, null);

    const history = (await database.all('SELECT status FROM application_status_history WHERE application_id = ? ORDER BY id', applicationId)).map(({ status }) => status);
    assert.deepEqual(history, ['applied', 'offered', 'applied']);
    assert.equal(await count("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND message LIKE '% applied again for Frontend Developer.'", recruiterId), 1);
    assert.equal(await count("SELECT COUNT(*) AS n FROM notifications WHERE title = 'Application update'"), 0, 'no stray "moved to Applied" update');
    assert.equal((await employment(person)).body.employmentStatus, 'unemployed');

    await person.agent.post('/api/applications').send({ jobId }).expect(409);
    await database.run("UPDATE applications SET status = 'offered' WHERE id = ?", applicationId);
    await accept(person, applicationId).expect(200);
    assert.deepEqual(titles((await employment(person)).body), ['Frontend Developer']);
  });

  test('applying again needs the job to be open, and applications never left stay duplicates', async () => {
    const person = await seeker();
    const jobId = await addJob();
    const applicationId = await offered(person, jobId);
    await person.agent.post('/api/applications').send({ jobId }).expect(409);
    await accept(person, applicationId).expect(200);
    await person.agent.post('/api/applications').send({ jobId }).expect(409);
    await leave(person, applicationId).expect(200);
    await database.run("UPDATE jobs SET status = 'closed' WHERE id = ?", jobId);
    await person.agent.post('/api/applications').send({ jobId }).expect(404);
    assert.ok((await database.get('SELECT quit_at FROM applications WHERE id = ?', applicationId)).quit_at);
  });

  test('applying again uses the applicant’s current resume, not the old copy', async () => {
    const person = await seeker();
    const jobId = await addJob();
    const applicationId = await offered(person, jobId);
    await database.run("INSERT INTO application_resumes (application_id, original_name, content) VALUES (?, 'old.pdf', x'01')", applicationId);
    await accept(person, applicationId).expect(200);
    await leave(person, applicationId).expect(200);
    await person.agent.post('/api/applications').send({ jobId }).expect(201);
    assert.equal(await count('SELECT COUNT(*) AS n FROM application_resumes WHERE application_id = ?', applicationId), 0, 'no resume on file now, so the old copy is gone');
  });
});
