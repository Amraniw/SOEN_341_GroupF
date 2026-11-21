const path = require('node:path');
const express = require('express');
const { findDefaultResume } = require('../database/resumes');
const { localDate } = require('../domain/jobAlerts');
const { createAuthenticateUser } = require('../middleware/authenticateUser');
const { requireSameOrigin } = require('../middleware/requireSameOrigin');
const { DEFAULT_UPLOAD_DIRECTORY } = require('../middleware/resumeUpload');
const { createJobMatcher, shortlistJobs, presentMatch } = require('../services/jobMatching');
const { NON_RESUME_MESSAGE, ResumeAnalysisError } = require('../services/resumeAnalysis');
const { extractResumeText } = require('../services/resumeText');

const AVAILABLE = "status = 'open' AND (closing_date IS NULL OR closing_date >= ?)";
const JOB_COLUMNS = 'id, title, company, location, workplace_type AS workplaceType, demo_key, description, details_json AS details';
const MISSING_RESUME = 'Your default resume file is missing. Upload another PDF or choose a different default under Manage resumes.';

function createJobMatchRouter(database, { uploadDirectory = DEFAULT_UPLOAD_DIRECTORY, recommendJobs = createJobMatcher() } = {}) {
  const router = express.Router();
  const inProgress = new Set();

  router.post('/', createAuthenticateUser(database), requireSameOrigin, async (request, response, next) => {
    response.set('Cache-Control', 'no-store');
    const { id: userId, role } = request.authenticatedUser;
    if (role !== 'job_seeker') return response.status(403).json({ error: 'AI job matching is available to job seekers.' });
    if (Object.keys(request.query).length || !request.body || Array.isArray(request.body) || Object.keys(request.body).length) {
      return response.status(400).json({ error: 'AI job matching uses your default resume automatically.' });
    }
    if (inProgress.has(userId)) {
      return response.status(429).json({ error: 'Matching is already in progress. Wait a moment and try again.' });
    }

    inProgress.add(userId);
    try {
      const resume = await findDefaultResume(database, userId);
      if (!resume) {
        return response.status(409).json({ code: 'no_resume', error: 'Upload a PDF and set a default under Manage resumes to find matches.' });
      }
      if (!resume.stored_name || path.basename(resume.stored_name) !== resume.stored_name) {
        return response.status(409).json({ code: 'resume_missing', error: MISSING_RESUME });
      }

      let text;
      try {
        text = await extractResumeText(path.join(uploadDirectory, resume.stored_name));
      } catch (error) {
        if (error.code === 'ENOENT') return response.status(409).json({ code: 'resume_missing', error: MISSING_RESUME });
        return response.status(503).json({ code: 'pdf_extraction_unavailable', error: 'PDF text extraction is unavailable.' });
      }
      if (!text) {
        return response.status(422).json({ error: 'We could not read enough text in your default PDF. Try a resume with searchable text.' });
      }

      const jobs = await database.all(`SELECT ${JOB_COLUMNS} FROM jobs WHERE ${AVAILABLE} ORDER BY created_at DESC, id DESC`, localDate());
      const postings = shortlistJobs(jobs, text);
      const source = { id: resume.id, originalName: resume.original_name };
      if (!postings.length) return response.json({ resume: source, matches: [], outcome: 'no_open_jobs' });

      const result = await recommendJobs(text, postings);
      let matches = [];
      if (result.matches.length) {
        const ids = result.matches.map(({ jobId }) => jobId);
        const current = await database.all(
          `SELECT ${JOB_COLUMNS} FROM jobs WHERE ${AVAILABLE} AND id IN (${ids.map(() => '?').join(', ')})`,
          localDate(), ...ids
        );
        const byId = new Map(current.map((job) => [String(job.id), job]));
        matches = result.matches.flatMap((match) => {
          const job = byId.get(match.jobId);
          if (!job) return [];
          const presentation = presentMatch(match, job);
          if (!presentation) return [];
          const { id, title, company, location, workplaceType, demo_key } = job;
          return [{ job: { id, title, company, location, workplaceType, isDemo: Boolean(demo_key) }, ...presentation }];
        });
      }

      const currentDefault = await findDefaultResume(database, userId);
      if (currentDefault?.id !== resume.id) {
        return response.status(409).json({ code: 'resume_changed', error: 'Your default resume changed. Try matching again with the current default.' });
      }
      if (!result.isResume) return response.status(422).json({ error: NON_RESUME_MESSAGE });
      const outcome = matches.length ? 'matched' : result.matches.length ? 'stale_matches' : 'no_matches';
      return response.json({ resume: source, matches, outcome });
    } catch (error) {
      if (error instanceof ResumeAnalysisError) {
        return response.status(error.status).json({ error: error.message, code: error.code });
      }
      return next(error);
    } finally {
      inProgress.delete(userId);
    }
  });

  return router;
}

module.exports = { createJobMatchRouter };
