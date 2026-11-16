const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createAuthorizeRecruiter } = require('../middleware/authorizeRecruiter');
const { requireSameOrigin } = require('../middleware/requireSameOrigin');
const { JOB_COLUMNS, isObject, readJobFields, recruiterJob } = require('../domain/recruiterJobs');
const { runJobAlerts } = require('../domain/jobAlerts');
const { APPLICATION_STATUSES, APPLICATION_STATUS_IDS } = require('../domain/applications');

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

  router.get('/jobs/:id/applications', async (req, res) => {
    if (!await ownedJob(req)) return res.status(404).json(NOT_FOUND);
    const { status, from, to } = req.query;
    const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    if (Object.keys(req.query).some((key) => !['status', 'from', 'to'].includes(key)) || (status !== undefined && !APPLICATION_STATUS_IDS.includes(status)) || (from !== undefined && !validDate(from)) || (to !== undefined && !validDate(to)) || (from && to && from > to)) return res.status(400).json({ error: 'Choose valid status and date filters.' });
    const items = await database.all(`SELECT a.id, a.status, a.applied_at AS appliedAt, a.updated_at AS updatedAt, u.name, u.email, p.headline, p.location, p.summary, p.skills, p.education, p.experience FROM applications a JOIN users u ON u.id = a.user_id LEFT JOIN profiles p ON p.user_id = u.id WHERE a.job_id = ? AND (? IS NULL OR a.status = ?) AND (? IS NULL OR date(a.applied_at) >= ?) AND (? IS NULL OR date(a.applied_at) <= ?) ORDER BY a.applied_at DESC, a.id DESC`, req.jobId, status || null, status || null, from || null, from || null, to || null, to || null);
    for (const item of items) {
      item.hasResume = Boolean(await database.get('SELECT application_id FROM application_resumes WHERE application_id = ?', item.id));
      if (!item.hasResume) item.hasResume = Boolean(await database.get('SELECT r.id FROM resumes r JOIN applications a ON a.user_id = r.user_id WHERE a.id = ? LIMIT 1', item.id));
    }
    const job = await ownedJob(req);
    return res.json({ items, statuses: APPLICATION_STATUSES, job: { id: job.id, title: job.title, company: job.company } });
  });

  router.get('/jobs/:id/applications/:applicationId/resume', async (req, res) => {
    if (!/^[1-9]\d*$/.test(req.params.applicationId)) return res.sendStatus(404);
    const resume = await database.get(`SELECT r.content FROM application_resumes r JOIN applications a ON a.id = r.application_id JOIN jobs j ON j.id = a.job_id WHERE a.id = ? AND j.id = ? AND j.recruiter_id = ?`, req.params.applicationId, req.jobId, req.authenticatedUser.id);
    if (!resume) {
      const legacy = await database.get(`SELECT r.file_path FROM applications a JOIN jobs j ON j.id = a.job_id JOIN resumes r ON r.user_id = a.user_id LEFT JOIN default_resumes d ON d.resume_id = r.id AND d.user_id = r.user_id WHERE a.id = ? AND j.id = ? AND j.recruiter_id = ? ORDER BY (d.resume_id IS NOT NULL) DESC, r.uploaded_at DESC, r.id DESC LIMIT 1`, req.params.applicationId, req.jobId, req.authenticatedUser.id);
      if (!legacy) return res.status(404).json({ error: 'This applicant has no available resume.' });
      try {
        const content = await fs.readFile(path.resolve(__dirname, '../..', legacy.file_path));
        return res.set('Cache-Control', 'no-store').set('Content-Type', 'application/pdf').set('Content-Disposition', 'inline; filename="resume.pdf"').send(content);
      } catch { return res.status(404).json({ error: 'The resume file is no longer available.' }); }
    }
    return res.set('Cache-Control', 'no-store').set('Content-Type', 'application/pdf').set('Content-Disposition', 'inline; filename="resume.pdf"').set('X-Content-Type-Options', 'nosniff').send(resume.content);
  });

  router.patch('/jobs/:id/applications/:applicationId/status', async (req, res) => {
    if (!/^[1-9]\d*$/.test(req.params.applicationId) || !Number.isSafeInteger(Number(req.params.applicationId))) return res.status(400).json({ error: 'Choose a valid application.' });
    if (!isObject(req.body) || Object.keys(req.body).length !== 1 || !APPLICATION_STATUS_IDS.includes(req.body.status)) return res.status(400).json({ error: 'Choose a valid application status.' });
    const current = await database.get('SELECT a.status FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ? AND j.id = ? AND j.recruiter_id = ?', req.params.applicationId, req.jobId, req.authenticatedUser.id);
    if (!current) return res.status(404).json({ error: 'This application could not be found.' });
    const stages = ['applied', 'under_review', 'interview', 'offered'];
    if (current.status !== req.body.status && (['offered', 'rejected'].includes(current.status) || (req.body.status !== 'rejected' && stages.indexOf(req.body.status) < stages.indexOf(current.status)))) return res.status(409).json({ error: 'Applications move forward through review and interview to a final offer or rejection.' });
    const result = await database.run(`UPDATE applications SET status = ? WHERE id = ? AND job_id = ? AND EXISTS (SELECT 1 FROM jobs WHERE id = applications.job_id AND recruiter_id = ?)`, req.body.status, Number(req.params.applicationId), req.jobId, req.authenticatedUser.id);
    if (!result.changes) return res.status(404).json({ error: 'This application could not be found.' });
    return res.json({ message: 'Application status updated.', status: req.body.status });
  });

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
    await runJobAlerts(database, job.id);
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
    await runJobAlerts(database, job.id);
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
    if (job.status === 'open') await runJobAlerts(database, job.id);
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
