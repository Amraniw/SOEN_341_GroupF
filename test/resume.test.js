const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, beforeEach, describe, test } = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/app');
const { initializeDatabase } = require('../src/database/database');
const { MAX_RESUME_SIZE_BYTES } = require('../src/middleware/resumeUpload');

const validUser = {
  name: 'Resume Test User',
  email: 'resume@example.com',
  password: 'DemoPass123',
};

const validPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n');

describe('Feature 2: Resume upload', () => {
  let app;
  let database;
  let temporaryDirectory;
  let uploadDirectory;

  before(async () => {
    temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'careerconnect-resume-tests-'));
    uploadDirectory = path.join(temporaryDirectory, 'uploads', 'resumes');
    database = await initializeDatabase(':memory:');
    app = createApp(database, {
      sessionSecret: 'careerconnect-test-secret-with-at-least-32-bytes',
      uploadDirectory,
    });
  });

  beforeEach(async () => {
    await database.exec(`
      DELETE FROM resumes;
      DELETE FROM users;
      DELETE FROM sqlite_sequence WHERE name IN ('resumes', 'users');
    `);
    await fs.rm(uploadDirectory, { recursive: true, force: true });
  });

  after(async () => {
    await database.close();
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  });

  async function createLoggedInAgent() {
    const agent = request.agent(app);
    await agent.post('/api/register').send(validUser).expect(201);
    const loginResponse = await agent
      .post('/api/login')
      .send({ email: validUser.email, password: validUser.password })
      .expect(200);

    return { agent, userId: loginResponse.body.user.id };
  }

  test('1. valid PDF upload succeeds', async () => {
    const { agent } = await createLoggedInAgent();

    const response = await agent
      .post('/api/resumes')
      .attach('resume', validPdf, {
        filename: 'Wassim_Resume.pdf',
        contentType: 'application/pdf',
      });

    assert.equal(response.status, 201);
    assert.equal(response.body.message, 'Resume uploaded successfully.');
    assert.equal(response.body.resume.originalName, 'Wassim_Resume.pdf');
  });

  test('2. uploaded PDF physically exists in the upload directory', async () => {
    const { agent } = await createLoggedInAgent();
    await agent
      .post('/api/resumes')
      .attach('resume', validPdf, {
        filename: 'resume.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    const storedResume = await database.get('SELECT stored_name FROM resumes');
    const fileStats = await fs.stat(path.join(uploadDirectory, storedResume.stored_name));

    assert.equal(fileStats.isFile(), true);
  });

  test('3. resume metadata is inserted into SQLite', async () => {
    const { agent } = await createLoggedInAgent();
    await agent
      .post('/api/resumes')
      .attach('resume', validPdf, {
        filename: 'resume.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    const storedResume = await database.get('SELECT * FROM resumes');

    assert.equal(storedResume.original_name, 'resume.pdf');
    assert.match(storedResume.stored_name, /^[0-9a-f-]{36}\.pdf$/);
    assert.equal(storedResume.file_path.endsWith(storedResume.stored_name), true);
    assert.ok(storedResume.uploaded_at);
  });

  test('4. resume is associated with the authenticated user', async () => {
    const { agent, userId } = await createLoggedInAgent();
    await agent
      .post('/api/resumes')
      .attach('resume', validPdf, {
        filename: 'resume.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    const storedResume = await database.get('SELECT user_id FROM resumes');
    assert.equal(storedResume.user_id, userId);
  });

  test('5. upload without a file fails', async () => {
    const { agent } = await createLoggedInAgent();
    const response = await agent.post('/api/resumes');

    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'A resume PDF is required.');
  });

  test('6. non-PDF and fake PDF uploads fail', async () => {
    const { agent } = await createLoggedInAgent();

    const textResponse = await agent
      .post('/api/resumes')
      .attach('resume', Buffer.from('plain text'), {
        filename: 'resume.txt',
        contentType: 'text/plain',
      });

    assert.equal(textResponse.status, 415);
    assert.equal(textResponse.body.error, 'Only PDF resumes are accepted.');

    const fakePdfResponse = await agent
      .post('/api/resumes')
      .attach('resume', Buffer.from('not really a PDF'), {
        filename: 'fake.pdf',
        contentType: 'application/pdf',
      });

    assert.equal(fakePdfResponse.status, 415);
    assert.equal(fakePdfResponse.body.error, 'The uploaded file is not a valid PDF.');
  });

  test('7. oversized PDF upload fails', async () => {
    const { agent } = await createLoggedInAgent();
    const oversizedPdf = Buffer.alloc(MAX_RESUME_SIZE_BYTES + 1);
    Buffer.from('%PDF-').copy(oversizedPdf);

    const response = await agent
      .post('/api/resumes')
      .attach('resume', oversizedPdf, {
        filename: 'oversized.pdf',
        contentType: 'application/pdf',
      });

    assert.equal(response.status, 413);
    assert.equal(response.body.error, 'Resume must be 5 MB or smaller.');
  });

  test('8. unauthenticated upload fails without writing a file', async () => {
    const response = await request(app)
      .post('/api/resumes')
      .attach('resume', validPdf, {
        filename: 'resume.pdf',
        contentType: 'application/pdf',
      });

    assert.equal(response.status, 401);
    assert.equal(response.body.error, 'Authentication required.');

    const storedFiles = await fs.readdir(uploadDirectory).catch(() => []);
    assert.equal(storedFiles.length, 0);
  });

  test('9. matching original filenames never overwrite each other', async () => {
    const { agent } = await createLoggedInAgent();

    for (let uploadNumber = 0; uploadNumber < 2; uploadNumber += 1) {
      await agent
        .post('/api/resumes')
        .attach('resume', validPdf, {
          filename: 'same-name.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);
    }

    const storedResumes = await database.all(
      'SELECT stored_name FROM resumes ORDER BY id'
    );
    const storedFiles = await fs.readdir(uploadDirectory);

    assert.equal(storedResumes.length, 2);
    assert.notEqual(storedResumes[0].stored_name, storedResumes[1].stored_name);
    assert.equal(storedFiles.length, 2);
  });

  test('10. Feature 1 registration and login still work', async () => {
    const agent = request.agent(app);
    await agent.post('/api/register').send(validUser).expect(201);

    const loginResponse = await agent.post('/api/login').send({
      email: validUser.email,
      password: validUser.password,
    });

    assert.equal(loginResponse.status, 200);
    assert.equal(loginResponse.body.message, 'Login successful.');
    assert.ok(loginResponse.headers['set-cookie']);
  });
});
