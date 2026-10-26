const express = require('express');
const { createAuthorizeRecruiter } = require('../middleware/authorizeRecruiter');
const { requireSameOrigin } = require('../middleware/requireSameOrigin');
const { JOB_COLUMNS, isObject, readJobFields, recruiterJob } = require('../domain/recruiterJobs');

// Aggregate once for a listing, rather than querying applications per posting.
const JOB_SELECT = `SELECT j.*, COALESCE(counts.application_count, 0) AS applicationCount
  FROM jobs j LEFT JOIN (
    SELECT job_id, COUNT(*) AS application_count FROM applications GROUP BY job_id
  ) counts ON counts.job_id = j.id`;
const NOT_FOUND = { error: 'This job posting could not be found.' };
const DELETE_CONFLICT = { error: 'This posting has applications and cannot be deleted. Close it instead.' };

function createRecruiterRouter(database) {
  const router = express.Router();
  router.use((request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });
  router.use(createAuthorizeRecruiter(database), requireSameOrigin);

  router.param('id', (request, response, next, id) => {
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
      return response.status(400).json({ error: 'Choose a valid job posting ID.' });
    }
    request.jobId = Number(id);
    return next();
  });

  async function ownedJob(request) {
    return database.get(`${JOB_SELECT} WHERE j.id = ? AND j.recruiter_id = ?`,
      request.jobId, request.authenticatedUser.id);
  }

  router.get('/overview', async (request, response) => {
    const overview = await database.get(
      `SELECT COUNT(*) AS totalPostings,
              COALESCE(SUM(j.status = 'open'), 0) AS openPostings,
              COALESCE(SUM(j.status = 'closed'), 0) AS closedPostings,
              COALESCE(SUM(counts.application_count), 0) AS totalApplications
       FROM jobs j LEFT JOIN (
         SELECT job_id, COUNT(*) AS application_count FROM applications GROUP BY job_id
       ) counts ON counts.job_id = j.id
       WHERE j.recruiter_id = ?`, request.authenticatedUser.id
    );
    response.json({ overview });
  });

  router.get('/jobs', async (request, response) => {
    const rows = await database.all(
      `${JOB_SELECT} WHERE j.recruiter_id = ? ORDER BY datetime(j.created_at) DESC, j.id DESC`,
      request.authenticatedUser.id
    );
    response.json({ items: rows.map(recruiterJob), total: rows.length });
  });

  router.post('/jobs', async (request, response) => {
    const { fields, error } = readJobFields(request.body);
    if (error) return response.status(400).json({ error });
    const keys = Object.keys(fields);
    const result = await database.run(
      `INSERT INTO jobs (${keys.map((key) => JOB_COLUMNS[key]).join(', ')}, recruiter_id)
       VALUES (${keys.map(() => '?').join(', ')}, ?)`,
      [...keys.map((key) => fields[key]), request.authenticatedUser.id]
    );
    request.jobId = result.lastID;
    const job = await ownedJob(request);
    if (!job) return response.status(404).json(NOT_FOUND);
    return response.status(201).json({ message: 'Job posting created successfully.', job: recruiterJob(job) });
  });

  router.get('/jobs/:id', async (request, response) => {
    const job = await ownedJob(request);
    if (!job) return response.status(404).json(NOT_FOUND);
    return response.json({ job: recruiterJob(job) });
  });

  router.patch('/jobs/:id', async (request, response) => {
    const { fields, error } = readJobFields(request.body, { partial: true });
    if (error) return response.status(400).json({ error });
    const keys = Object.keys(fields);
    const result = await database.run(
      `UPDATE jobs SET ${keys.map((key) => `${JOB_COLUMNS[key]} = ?`).join(', ')}
       WHERE id = ? AND recruiter_id = ?`,
      [...keys.map((key) => fields[key]), request.jobId, request.authenticatedUser.id]
    );
    if (!result.changes) return response.status(404).json(NOT_FOUND);
    const job = await ownedJob(request);
    if (!job) return response.status(404).json(NOT_FOUND);
    return response.json({ message: 'Job posting updated successfully.', job: recruiterJob(job) });
  });

  router.patch('/jobs/:id/status', async (request, response) => {
    const body = request.body;
    if (!isObject(body) || Object.keys(body).length !== 1 || !Object.hasOwn(body, 'status') || !['open', 'closed'].includes(body.status)) {
      return response.status(400).json({ error: 'Provide only a status of open or closed.' });
    }
    const result = await database.run('UPDATE jobs SET status = ? WHERE id = ? AND recruiter_id = ?',
      body.status, request.jobId, request.authenticatedUser.id);
    if (!result.changes) return response.status(404).json(NOT_FOUND);
    const job = await ownedJob(request);
    if (!job) return response.status(404).json(NOT_FOUND);
    return response.json({ message: 'Job posting status updated successfully.', job: recruiterJob(job) });
  });

  router.delete('/jobs/:id', async (request, response, next) => {
    if (request.body !== undefined && (!isObject(request.body) || Object.keys(request.body).length)) {
      return response.status(400).json({ error: 'Deletion does not accept request fields.' });
    }
    try {
      // One atomic statement protects both ownership and the application check.
      // The existing RESTRICT foreign key remains the final integrity boundary.
      const result = await database.run(
        `DELETE FROM jobs WHERE id = ? AND recruiter_id = ?
         AND NOT EXISTS (SELECT 1 FROM applications WHERE job_id = jobs.id)`,
        request.jobId, request.authenticatedUser.id
      );
      if (result.changes) return response.json({ message: 'Job posting deleted successfully.' });
      const job = await database.get('SELECT id FROM jobs WHERE id = ? AND recruiter_id = ?',
        request.jobId, request.authenticatedUser.id);
      return response.status(job ? 409 : 404).json(job ? DELETE_CONFLICT : NOT_FOUND);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT' && /FOREIGN KEY/i.test(error.message)) {
        return response.status(409).json(DELETE_CONFLICT);
      }
      return next(error);
    }
  });

  return router;
}

module.exports = { createRecruiterRouter };
