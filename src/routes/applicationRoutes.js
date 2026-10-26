const express = require('express');
const { createAuthenticateUser } = require('../middleware/authenticateUser');
const {
  APPLICATION_STATUSES,
  applicationStatusName,
} = require('../domain/applications');

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function publicApplication(row) {
  return {
    id: row.id,
    jobId: row.job_id,
    status: row.status,
    statusLabel: applicationStatusName(row.status),
    appliedAt: row.applied_at,
    updatedAt: row.updated_at,
    job: {
      id: row.job_id,
      title: row.title,
      company: row.company,
      location: row.location,
      category: row.category,
      categoryName: row.category_name,
      employmentType: row.employment_type,
      workplaceType: row.workplace_type,
    },
  };
}

const APPLICATION_SELECT = `
  SELECT a.id, a.user_id, a.job_id, a.status, a.applied_at, a.updated_at,
         j.title, j.company, j.location, j.category,
         c.name AS category_name, j.employment_type, j.workplace_type
  FROM applications a
  JOIN jobs j ON j.id = a.job_id
  JOIN job_categories c ON c.id = j.category`;

function createApplicationRouter(database) {
  const router = express.Router();
  const authenticateUser = createAuthenticateUser(database);

  router.use(authenticateUser);

  router.get('/', async (request, response, next) => {
    try {
      const rows = await database.all(
        `${APPLICATION_SELECT}
         WHERE a.user_id = ?
         ORDER BY datetime(a.updated_at) DESC, a.id DESC`,
        request.authenticatedUser.id
      );
      return response.json({
        items: rows.map(publicApplication),
        total: rows.length,
        statuses: APPLICATION_STATUSES,
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/job/:jobId', async (request, response, next) => {
    const jobId = positiveInteger(Number(request.params.jobId));
    if (!jobId || String(jobId) !== request.params.jobId) {
      return response.status(400).json({ error: 'Choose a valid job posting.' });
    }

    try {
      const row = await database.get(
        `${APPLICATION_SELECT} WHERE a.user_id = ? AND a.job_id = ?`,
        request.authenticatedUser.id,
        jobId
      );
      return response.json({ application: row ? publicApplication(row) : null });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/:applicationId', async (request, response, next) => {
    const applicationId = positiveInteger(Number(request.params.applicationId));
    if (!applicationId || String(applicationId) !== request.params.applicationId) {
      return response.status(404).json({ error: 'This application could not be found.' });
    }

    try {
      const row = await database.get(
        `${APPLICATION_SELECT} WHERE a.id = ? AND a.user_id = ?`,
        applicationId,
        request.authenticatedUser.id
      );
      if (!row) {
        return response.status(404).json({ error: 'This application could not be found.' });
      }
      const history = await database.all(
        `SELECT status, changed_at
         FROM application_status_history
         WHERE application_id = ?
         ORDER BY datetime(changed_at) ASC, id ASC`,
        applicationId
      );
      return response.json({
        application: {
          ...publicApplication(row),
          history: history.map(({ status, changed_at }) => ({
            status,
            statusLabel: applicationStatusName(status),
            changedAt: changed_at,
          })),
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/', async (request, response, next) => {
    if (request.authenticatedUser.role !== 'job_seeker') {
      return response.status(403).json({ error: 'Only job seekers can submit applications.' });
    }

    const body = request.body || {};
    if (Object.keys(body).some((key) => key !== 'jobId')) {
      return response.status(400).json({ error: 'The application request contains unsupported information.' });
    }
    const jobId = positiveInteger(body.jobId);
    if (!jobId) {
      return response.status(400).json({ error: 'Choose a valid job posting.' });
    }

    try {
      const existing = await database.get(
        `${APPLICATION_SELECT} WHERE a.user_id = ? AND a.job_id = ?`,
        request.authenticatedUser.id,
        jobId
      );
      if (existing) {
        return response.status(409).json({
          error: 'You have already applied for this job.',
          application: publicApplication(existing),
        });
      }

      const job = await database.get(
        "SELECT id FROM jobs WHERE id = ? AND status = 'open'",
        jobId
      );
      if (!job) {
        return response.status(404).json({ error: 'This job posting is no longer available.' });
      }

      let result;
      try {
        result = await database.run(
          `INSERT INTO applications (user_id, job_id)
           VALUES (?, ?)`,
          request.authenticatedUser.id,
          jobId
        );
      } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT') {
          return response.status(409).json({ error: 'You have already applied for this job.' });
        }
        throw error;
      }

      const application = await database.get(
        `${APPLICATION_SELECT} WHERE a.id = ? AND a.user_id = ?`,
        result.lastID,
        request.authenticatedUser.id
      );
      return response.status(201).json({
        message: 'Application submitted successfully.',
        application: publicApplication(application),
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { createApplicationRouter };
