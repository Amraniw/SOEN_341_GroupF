const express = require('express');
const { createAuthenticateUser } = require('../middleware/authenticateUser');
const { requireSameOrigin } = require('../middleware/requireSameOrigin');
const {
  APPLICATION_STATUSES,
  OFFER_RESPONSES,
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
    offerResponse: row.offer_response ?? null,
    offerRespondedAt: row.offer_responded_at ?? null,
    quitAt: row.quit_at ?? null,
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
         a.offer_response, a.offer_responded_at, a.quit_at,
         j.title, j.company, j.location, j.category,
         c.name AS category_name, j.employment_type, j.workplace_type
  FROM applications a
  JOIN jobs j ON j.id = a.job_id
  JOIN job_categories c ON c.id = j.category`;

function createApplicationRouter(database) {
  const router = express.Router();
  const authenticateUser = createAuthenticateUser(database);

  router.use(authenticateUser);

  router.get('/analytics', async (request, response, next) => {
    response.set('Cache-Control', 'no-store');
    if (request.authenticatedUser.role !== 'job_seeker') return response.status(403).json({ error: 'Only job seekers can view application analytics.' });
    const range = request.query.range || '30';
    if (Object.keys(request.query).some((key) => key !== 'range') || !['30', '90', 'all'].includes(range)) return response.status(400).json({ error: 'Choose a range of 30, 90, or all.' });
    try {
      const cutoff = range === 'all' ? '0000-01-01' : new Date(Date.now() - (Number(range) - 1) * 86400000).toISOString().slice(0, 10);
      const rows = await database.all(`${APPLICATION_SELECT} WHERE a.user_id = ? AND date(a.applied_at) >= ? ORDER BY a.applied_at DESC, a.id DESC`, request.authenticatedUser.id, cutoff);
      const history = await database.all(`SELECT h.application_id, h.status, h.changed_at, j.title, j.company FROM application_status_history h JOIN applications a ON a.id = h.application_id JOIN jobs j ON j.id = a.job_id WHERE a.user_id = ? AND date(h.changed_at) >= ? ORDER BY h.changed_at DESC, h.id DESC LIMIT 100`, request.authenticatedUser.id, cutoff);
      const counts = APPLICATION_STATUSES.map(({ id, name }) => ({ id, name, count: rows.filter((row) => row.status === id).length }));
      const months = new Map();
      for (const row of rows) { const month = row.applied_at.slice(0, 7); months.set(month, (months.get(month) || 0) + 1); }
      return response.json({ range, cutoff, total: rows.length, active: rows.filter((row) => ['applied', 'under_review', 'interview'].includes(row.status)).length, statuses: counts, activity: [...months].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count })), items: rows.map(publicApplication), history: history.map((row) => ({ applicationId: row.application_id, status: row.status, statusLabel: applicationStatusName(row.status), changedAt: row.changed_at, title: row.title, company: row.company })) });
    } catch (error) { return next(error); }
  });

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

  // A job seeker accepts or declines an offer they received. Accepting also marks
  // them as employed (see the trigger in database/offerResponses.js). One answer
  // only: the conditional UPDATE lets exactly one of any simultaneous requests win.
  router.patch('/:applicationId/offer', requireSameOrigin, async (request, response, next) => {
    if (request.authenticatedUser.role !== 'job_seeker') {
      return response.status(403).json({ error: 'Only job seekers can respond to offers.' });
    }
    const applicationId = positiveInteger(Number(request.params.applicationId));
    if (!applicationId || String(applicationId) !== request.params.applicationId) {
      return response.status(404).json({ error: 'This application could not be found.' });
    }
    const body = request.body || {};
    if (Object.keys(body).some((key) => key !== 'response')) {
      return response.status(400).json({ error: 'The offer response contains unsupported information.' });
    }
    if (!OFFER_RESPONSES.includes(body.response)) {
      return response.status(400).json({ error: 'Choose whether to accept or decline the offer.' });
    }

    try {
      const userId = request.authenticatedUser.id;
      const result = await database.run(
        `UPDATE applications
         SET offer_response = ?, offer_responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ? AND status = 'offered' AND offer_response IS NULL
           AND (? <> 'accepted' OR NOT EXISTS (
             SELECT 1 FROM applications other
             WHERE other.user_id = applications.user_id
               AND other.offer_response = 'accepted' AND other.quit_at IS NULL))`,
        body.response,
        applicationId,
        userId,
        body.response
      );

      if (result.changes === 0) {
        const existing = await database.get(
          `${APPLICATION_SELECT} WHERE a.id = ? AND a.user_id = ?`,
          applicationId,
          userId
        );
        if (!existing) {
          return response.status(404).json({ error: 'This application could not be found.' });
        }
        if (existing.offer_response) {
          return response.status(409).json({
            error: `You already ${existing.offer_response} this offer.`,
            application: publicApplication(existing),
          });
        }
        if (existing.status === 'offered' && body.response === 'accepted') {
          return response.status(409).json({
            error: 'You already accepted another offer. Leave your current job before accepting a new one.',
          });
        }
        return response.status(409).json({ error: 'This application does not have an offer to respond to.' });
      }

      // Letting the recruiter know is a convenience: it must never undo the answer.
      try {
        await database.run(
          `INSERT INTO notifications (user_id, type, title, message, link, application_id, job_id)
           SELECT j.recruiter_id, 'application_update', ?,
                  u.name || ' ' || ? || ' your offer for ' || j.title || '.',
                  '/recruiter/dashboard', a.id, j.id
           FROM applications a
           JOIN jobs j ON j.id = a.job_id
           JOIN users u ON u.id = a.user_id
           WHERE a.id = ? AND j.recruiter_id IS NOT NULL`,
          body.response === 'accepted' ? 'Offer accepted' : 'Offer declined',
          body.response,
          applicationId
        );
      } catch (error) {
        console.error('Could not notify the recruiter about the offer response:', error.message);
      }

      const row = await database.get(
        `${APPLICATION_SELECT} WHERE a.id = ? AND a.user_id = ?`,
        applicationId,
        userId
      );
      return response.json({
        message: body.response === 'accepted' ? 'Offer accepted.' : 'Offer declined.',
        application: publicApplication(row),
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
      if (existing && !existing.quit_at) {
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

      // Someone who left a job they accepted may apply to it again. The same
      // application starts over, so its history stays in one place.
      if (existing) {
        const restart = await database.run(
          `UPDATE applications
           SET status = 'applied', applied_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
               offer_response = NULL, offer_responded_at = NULL, quit_at = NULL
           WHERE id = ? AND user_id = ? AND quit_at IS NOT NULL`,
          existing.id,
          request.authenticatedUser.id
        );
        if (restart.changes === 0) {
          return response.status(409).json({ error: 'You have already applied for this job.' });
        }
        try {
          await database.run(
            `INSERT INTO notifications (user_id, type, title, message, link, application_id, job_id)
             SELECT j.recruiter_id, 'new_application', 'New application',
                    u.name || ' applied again for ' || j.title || '.', '/recruiter/dashboard', a.id, j.id
             FROM applications a JOIN jobs j ON j.id = a.job_id JOIN users u ON u.id = a.user_id
             WHERE a.id = ? AND j.recruiter_id IS NOT NULL`,
            existing.id
          );
        } catch (error) {
          console.error('Could not notify the recruiter about the new application:', error.message);
        }
        const restarted = await database.get(
          `${APPLICATION_SELECT} WHERE a.id = ? AND a.user_id = ?`,
          existing.id,
          request.authenticatedUser.id
        );
        return response.status(201).json({
          message: 'Application submitted successfully.',
          application: publicApplication(restarted),
        });
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
