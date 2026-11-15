const assert = require('node:assert/strict');
const { after, before, beforeEach, describe, test } = require('node:test');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const request = require('supertest');
const { createApp } = require('../src/app');
const { initializeDatabase } = require('../src/database/database');

const HOST = 'localhost:3000';
const ORIGIN = `http://${HOST}`;
const job = { title: 'Backend Developer', company: 'Northstar Studio', location: 'Montreal, QC', category: 'software-engineering', description: 'Build thoughtful APIs.' };

describe('Recruiters review applicants and move them through the hiring pipeline', () => {
  let database;
  let app;
  let recruiter;
  let other;
  let seeker;
  let second;
  let sequence = 0;

  async function account(name, role) {
    sequence += 1;
    const agent = request.agent(app);
    const body = { name, email: `pipeline-${sequence}@example.test`, password: 'PipelineTest2026!', role };
    const registration = await agent.post('/api/register').send(body).expect(201);
    await agent.post('/api/login').send(body).expect(200);
    return { agent, id: registration.body.user.id, name };
  }
  function mutation(who, method, path, body) {
    const pending = who.agent[method](path).set('Host', HOST).set('Origin', ORIGIN);
    return body === undefined ? pending : pending.send(body);
  }
  async function postJob(owner = recruiter) {
    return (await mutation(owner, 'post', '/api/recruiter/jobs', job).expect(201)).body.job;
  }
  async function apply(who, jobId) {
    return (await who.agent.post('/api/applications').send({ jobId }).expect(201)).body.application;
  }
  const move = (who, applicationId, status) =>
    mutation(who, 'patch', `/api/recruiter/applications/${applicationId}/status`, { status });
  const applicationNotifications = async (who) =>
    (await who.agent.get('/api/notifications').expect(200)).body.items.filter((item) => item.link === '/applications/index.html');

  before(async () => {
    database = await initializeDatabase(':memory:');
    app = createApp(database, { sessionSecret: 'recruiter-pipeline-test-secret' });
  });
  after(async () => database.close());
  beforeEach(async () => {
    await database.run('DELETE FROM notifications');
    await database.run('DELETE FROM applications');
    await database.run('DELETE FROM jobs');
    await database.run('DELETE FROM users');
    recruiter = await account('Riley Recruiter', 'recruiter');
    other = await account('Olive Other', 'recruiter');
    seeker = await account('Sam Seeker', 'job_seeker');
    second = await account('Alex Applicant', 'job_seeker');
  });

  test('only the owning recruiter can list applicants for a posting', async () => {
    const posting = await postJob();
    await apply(seeker, posting.id);
    await apply(second, posting.id);

    const { body } = await recruiter.agent.get(`/api/recruiter/jobs/${posting.id}/applications`).expect(200);
    assert.equal(body.total, 2);
    assert.deepEqual(body.job, { id: posting.id, title: 'Backend Developer', company: 'Northstar Studio' });
    assert.deepEqual(body.items.map((item) => item.applicant.name), ['Alex Applicant', 'Sam Seeker']);
    assert.equal(body.items[1].applicant.email, 'pipeline-3@example.test');
    assert.equal(body.items[1].status, 'applied');
    assert.equal(body.items[1].statusLabel, 'Applied');
    assert.deepEqual(body.statuses.map(({ id }) => id), ['applied', 'under_review', 'interview', 'offered', 'rejected']);

    await other.agent.get(`/api/recruiter/jobs/${posting.id}/applications`).expect(404);
    await seeker.agent.get(`/api/recruiter/jobs/${posting.id}/applications`).expect(403);
    await request(app).get(`/api/recruiter/jobs/${posting.id}/applications`).expect(401);
    await recruiter.agent.get('/api/recruiter/jobs/999999/applications').expect(404);
    await recruiter.agent.get('/api/recruiter/jobs/abc/applications').expect(400);
  });

  test('each decision sends the applicant a matching notification', async () => {
    const posting = await postJob();
    const application = await apply(seeker, posting.id);

    const review = await move(recruiter, application.id, 'under_review').expect(200);
    assert.equal(review.body.changed, true);
    assert.equal(review.body.application.status, 'under_review');
    assert.equal(review.body.application.statusLabel, 'Under Review');

    await move(recruiter, application.id, 'interview').expect(200);
    await move(recruiter, application.id, 'offered').expect(200);
    await move(recruiter, application.id, 'rejected').expect(200);

    const items = await applicationNotifications(seeker);
    assert.deepEqual(items.map(({ type }) => type), [
      'application_update', 'job_offer', 'interview_invitation', 'application_update',
    ]);
    assert.equal(items[3].message, 'Your application for Backend Developer at Northstar Studio is now under review.');
    assert.equal(items[2].title, 'Interview invitation');
    assert.equal(items[2].message, 'You have been invited to interview for Backend Developer at Northstar Studio.');
    assert.equal(items[1].title, 'Job offer');
    assert.equal(items[1].message, 'Congratulations! Northstar Studio has offered you the Backend Developer position.');
    assert.equal(items[0].message, 'Northstar Studio has decided not to move forward with your application for Backend Developer. Thank you for applying.');
    assert.ok(items.every((item) => item.read === false));

    // Other applicants and the recruiter are not notified about this decision.
    assert.equal((await applicationNotifications(second)).length, 0);
    assert.equal((await applicationNotifications(recruiter)).length, 0);
  });

  test('applicants see the new status and its history on their own applications page data', async () => {
    const posting = await postJob();
    const application = await apply(seeker, posting.id);
    await move(recruiter, application.id, 'interview').expect(200);

    const { body } = await seeker.agent.get(`/api/applications/${application.id}`).expect(200);
    assert.equal(body.application.status, 'interview');
    assert.deepEqual(body.application.history.map(({ status }) => status), ['applied', 'interview']);
  });

  test('setting the same status again changes nothing and sends no second notification', async () => {
    const posting = await postJob();
    const application = await apply(seeker, posting.id);
    await move(recruiter, application.id, 'offered').expect(200);
    const repeat = await move(recruiter, application.id, 'offered').expect(200);

    assert.equal(repeat.body.changed, false);
    assert.equal(repeat.body.message, 'This application already has that status.');
    assert.equal((await applicationNotifications(seeker)).length, 1);
    const { body } = await seeker.agent.get(`/api/applications/${application.id}`).expect(200);
    assert.equal(body.application.history.length, 2);
  });

  test('recruiters can only change applications to their own postings', async () => {
    const posting = await postJob();
    const application = await apply(seeker, posting.id);

    await move(other, application.id, 'rejected').expect(404);
    await move(seeker, application.id, 'offered').expect(403);
    await request(app).patch(`/api/recruiter/applications/${application.id}/status`).send({ status: 'offered' }).expect(401);
    await move(recruiter, 999999, 'offered').expect(404);

    const row = await database.get('SELECT status FROM applications WHERE id = ?', application.id);
    assert.equal(row.status, 'applied');
    assert.equal((await applicationNotifications(seeker)).length, 0);
  });

  test('status updates validate the request', async () => {
    const posting = await postJob();
    const application = await apply(seeker, posting.id);
    const url = `/api/recruiter/applications/${application.id}/status`;

    for (const body of [{}, { status: 'hired' }, { status: '' }, { status: 4 }, { status: null }, { status: 'offered', note: 'x' }, []]) {
      await mutation(recruiter, 'patch', url, body).expect(400);
    }
    for (const id of ['0', '-3', 'abc', '1.5']) {
      await move(recruiter, id, 'offered').expect(400);
    }
    await recruiter.agent.patch(url).set('Host', HOST).set('Origin', 'http://evil.example').send({ status: 'offered' }).expect(403);
    assert.equal((await database.get('SELECT status FROM applications WHERE id = ?', application.id)).status, 'applied');
  });

  test('applications on a closed posting can still be reviewed', async () => {
    const posting = await postJob();
    const application = await apply(seeker, posting.id);
    await mutation(recruiter, 'patch', `/api/recruiter/jobs/${posting.id}/status`, { status: 'closed' }).expect(200);

    await recruiter.agent.get(`/api/recruiter/jobs/${posting.id}/applications`).expect(200);
    await move(recruiter, application.id, 'offered').expect(200);
    assert.equal((await applicationNotifications(seeker))[0].type, 'job_offer');
  });

  test('an existing database gets the job_offer type and new wording on its next start', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'careerconnect-offers-'));
    const filename = path.join(directory, 'older.sqlite');
    let older;
    try {
      older = await initializeDatabase(filename);
      await older.run("INSERT INTO users (name, email, password_hash, role) VALUES ('Rec', 'rec@example.test', 'x', 'recruiter')");
      await older.run("INSERT INTO users (name, email, password_hash, role) VALUES ('Sam', 'sam@example.test', 'x', 'job_seeker')");
      await older.run(
        `INSERT INTO jobs (title, company, location, category, description, status, recruiter_id)
         VALUES ('Developer', 'Acme', 'Montreal', 'software-engineering', 'Build.', 'open', 1)`
      );
      await older.run('INSERT INTO applications (user_id, job_id) VALUES (2, 1)');
      // Recreate the notification table and trigger as the previous build had them.
      await older.exec(`
        DROP TRIGGER applications_notify_recruiter;
        DROP TRIGGER applications_notify_applicant;
        DROP TABLE notifications;
        CREATE TABLE notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('new_application', 'application_update', 'interview_invitation', 'welcome', 'idle_warning', 'deadline_reminder', 'job_match')),
          title TEXT NOT NULL CHECK (length(trim(title)) > 0),
          message TEXT NOT NULL CHECK (length(trim(message)) > 0),
          link TEXT,
          application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL,
          job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
          dedupe_key TEXT UNIQUE,
          read_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        INSERT INTO notifications (id, user_id, type, title, message) VALUES (7, 2, 'application_update', 'Kept', 'Kept message');
        CREATE TRIGGER applications_notify_applicant AFTER UPDATE OF status ON applications
        WHEN NEW.status <> OLD.status
        BEGIN
          INSERT INTO notifications (user_id, type, title, message, application_id, job_id)
          SELECT NEW.user_id, 'application_update', 'Application update', 'Old wording', NEW.id, j.id
          FROM jobs j WHERE j.id = NEW.job_id;
        END;
      `);
      await assert.rejects(older.run("INSERT INTO notifications (user_id, type, title, message) VALUES (2, 'job_offer', 'a', 'b')"), /CHECK/);
      await older.close();

      older = await initializeDatabase(filename);
      assert.deepEqual(await older.all('SELECT id, title FROM notifications'), [{ id: 7, title: 'Kept' }]);
      await older.run("UPDATE applications SET status = 'offered' WHERE id = 1");
      const offer = await older.get("SELECT type, title, message FROM notifications WHERE id <> 7");
      assert.deepEqual(offer, {
        type: 'job_offer', title: 'Job offer',
        message: 'Congratulations! Acme has offered you the Developer position.',
      });
    } finally {
      await older?.close().catch(() => {});
      await rm(directory, { recursive: true, force: true });
    }
  });
});
