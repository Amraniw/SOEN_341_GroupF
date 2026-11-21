const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const { findDefaultResume } = require('../database/resumes');
const { createAuthenticateUser } = require('../middleware/authenticateUser');
const { requireSameOrigin } = require('../middleware/requireSameOrigin');
const { createResumeAnalyzer, ResumeAnalysisError } = require('../services/resumeAnalysis');
const { extractResumeText } = require('../services/resumeText');
const { JOB_CATEGORIES } = require('../domain/jobs');
const {
  DEFAULT_UPLOAD_DIRECTORY,
  createResumeUpload,
} = require('../middleware/resumeUpload');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const RESUME_NOT_FOUND = { error: 'This resume could not be found.' };
const REVIEW_POSTING_LIMIT = 80;
const reviewCategories = new Set(JOB_CATEGORIES.map(({ id }) => id));
const categoryParameters = [...reviewCategories].map(() => '?').join(', ');
const UNREADABLE_RESUME = {
  error: 'We could not read enough text in this PDF. Select a PDF with searchable text and try again.',
};

function readResumeId(value) {
  return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
}

async function removeFile(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Failed to remove uploaded file:', error);
    }
  }
}

async function hasPdfSignature(filePath) {
  const file = await fs.open(filePath, 'r');

  try {
    const signature = Buffer.alloc(5);
    const { bytesRead } = await file.read(signature, 0, signature.length, 0);
    return bytesRead === signature.length && signature.toString('ascii') === '%PDF-';
  } finally {
    await file.close();
  }
}

function createResumeRouter(database, options = {}) {
  const router = express.Router();
  const authenticateUser = createAuthenticateUser(database);
  const uploadDirectory = options.uploadDirectory || DEFAULT_UPLOAD_DIRECTORY;
  const upload = createResumeUpload(uploadDirectory);
  const analyzeResume = options.analyzeResume || createResumeAnalyzer();
  const reviewsInProgress = new Set();

  function toPublicResume(resume, isDefault) {
    return {
      id: resume.id,
      originalName: resume.original_name,
      uploadedAt: resume.uploaded_at,
      isDefault,
    };
  }

  // Newest first, with the default marked.
  async function listResumes(userId) {
    const rows = await database.all(
      `SELECT id, original_name, uploaded_at
       FROM resumes
       WHERE user_id = ?
       ORDER BY uploaded_at DESC, id DESC`,
      userId
    );
    const defaultResume = await findDefaultResume(database, userId);
    return rows.map((row) => toPublicResume(row, row.id === defaultResume?.id));
  }

  // A single statement that only matches the user's own resume, so another
  // account's resume can never be chosen. Returns false when there is no match.
  async function chooseDefault(userId, resumeId) {
    const result = await database.run(
      `INSERT INTO default_resumes (user_id, resume_id)
       SELECT user_id, id FROM resumes WHERE id = ? AND user_id = ?
       ON CONFLICT(user_id) DO UPDATE SET resume_id = excluded.resume_id`,
      resumeId,
      userId
    );
    return result.changes > 0;
  }

  router.get('/', authenticateUser, async (request, response, next) => {
    try {
      const items = await listResumes(request.authenticatedUser.id);
      return response.json({ items, total: items.length });
    } catch (error) {
      return next(error);
    }
  });

  // Returns the default resume, so existing consumers keep receiving the active one.
  router.get('/current', authenticateUser, async (request, response, next) => {
    try {
      const resume = await findDefaultResume(database, request.authenticatedUser.id);
      return response.json({ resume: resume ? toPublicResume(resume, true) : null });
    } catch (error) {
      return next(error);
    }
  });

  // Unchanged contract: removes every resume on the account, and so the default.
  router.delete('/current', authenticateUser, async (request, response, next) => {
    try {
      const resumes = await database.all(
        'SELECT stored_name FROM resumes WHERE user_id = ?',
        request.authenticatedUser.id
      );

      if (resumes.length === 0) {
        return response.status(404).json({ error: 'No resume is available to delete.' });
      }

      await database.run(
        'DELETE FROM resumes WHERE user_id = ?',
        request.authenticatedUser.id
      );

      await Promise.all(
        resumes.map((resume) => removeFile(path.join(uploadDirectory, resume.stored_name)))
      );

      return response.json({ message: 'Resume deleted successfully.' });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/', authenticateUser, upload.single('resume'), async (request, response, next) => {
    if (!request.file) {
      return response.status(400).json({ error: 'A resume PDF is required.' });
    }

    try {
      if (!(await hasPdfSignature(request.file.path))) {
        await removeFile(request.file.path);
        return response.status(415).json({ error: 'The uploaded file is not a valid PDF.' });
      }

      const relativeFilePath = path
        .relative(PROJECT_ROOT, request.file.path)
        .split(path.sep)
        .join('/');

      let resume;
      try {
        resume = await database.get(
          `INSERT INTO resumes (user_id, original_name, stored_name, file_path)
           VALUES (?, ?, ?, ?)
           RETURNING id, original_name, uploaded_at`,
          request.authenticatedUser.id,
          request.file.originalname,
          request.file.filename,
          relativeFilePath
        );
      } catch (error) {
        await removeFile(request.file.path);
        throw error;
      }

      // Uploading a newer PDF has always made it the current resume, so a new
      // upload becomes the default. The user can choose an older one again later.
      await chooseDefault(request.authenticatedUser.id, resume.id);

      return response.status(201).json({
        message: 'Resume uploaded successfully.',
        resume: toPublicResume(resume, true),
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/:resumeId/ai-feedback', authenticateUser, requireSameOrigin, async (request, response) => {
    response.set('Cache-Control', 'no-store');
    const userId = request.authenticatedUser.id;
    if (request.authenticatedUser.role !== 'job_seeker') {
      return response.status(403).json({ error: 'AI resume review is available to job seekers.' });
    }
    const resumeId = readResumeId(request.params.resumeId);
    if (!resumeId) return response.status(404).json(RESUME_NOT_FOUND);

    const resume = await database.get(
      'SELECT stored_name FROM resumes WHERE id = ? AND user_id = ?',
      resumeId,
      userId
    );
    if (!resume || !resume.stored_name || path.basename(resume.stored_name) !== resume.stored_name) {
      return response.status(404).json(RESUME_NOT_FOUND);
    }
    if (reviewsInProgress.has(userId)) {
      return response.status(429).json({ error: 'A resume review is already running. Wait a moment and try again.' });
    }

    reviewsInProgress.add(userId);
    try {
      let text;
      try {
        text = await extractResumeText(path.join(uploadDirectory, resume.stored_name));
      } catch (error) {
        if (error.code === 'ENOENT') return response.status(404).json(RESUME_NOT_FOUND);
        return response.status(503).json({
          code: 'pdf_extraction_unavailable',
          error: 'PDF text extraction is unavailable. Ask the site administrator to check the server.',
        });
      }
      if (!text) return response.status(422).json(UNREADABLE_RESUME);

      const postings = await database.all(
        `SELECT id, title, company, category, substr(description, 1, 400) AS description
         FROM jobs WHERE status = 'open' AND category IN (${categoryParameters})
         ORDER BY created_at DESC, id DESC LIMIT ?`,
        ...reviewCategories,
        REVIEW_POSTING_LIMIT
      );
      const feedback = await analyzeResume(text, postings);
      const allowedIds = new Set(postings.map(({ id }) => String(id)));
      const matchedIds = feedback.isResume && Array.isArray(feedback.alignedRoles)
        ? [...new Set(feedback.alignedRoles.filter((id) => allowedIds.has(id)))].slice(0, 4)
        : [];
      const matches = matchedIds.length ? await database.all(
        `SELECT id, title, company, category, demo_key AS demoKey FROM jobs
         WHERE status = 'open' AND id IN (${matchedIds.map(() => '?').join(', ')})`,
        matchedIds
      ) : [];
      const byId = new Map(matches.filter(({ title, company, category }) =>
        reviewCategories.has(category) && title.trim() && !/^undefined$/i.test(title.trim()) && company.trim()
      ).map(({ id, title, company, demoKey }) => [String(id), { id, title, company, isDemo: Boolean(demoKey) }]));
      const alignedRoles = matchedIds.map((id) => byId.get(id)).filter(Boolean);
      return response.json({ resumeId, feedback: { ...feedback, alignedRoles } });
    } catch (error) {
      if (error instanceof ResumeAnalysisError) {
        return response.status(error.status).json({ error: error.message, code: error.code });
      }
      return response.status(502).json({ error: 'AI resume review could not be completed. Please try again.' });
    } finally {
      reviewsInProgress.delete(userId);
    }
  });

  // Declared after the /current routes, which keep their own meaning.
  router.put('/:resumeId/default', authenticateUser, async (request, response, next) => {
    const resumeId = readResumeId(request.params.resumeId);
    if (!resumeId) {
      return response.status(404).json(RESUME_NOT_FOUND);
    }

    try {
      const userId = request.authenticatedUser.id;
      const resume = await database.get(
        'SELECT id, original_name, uploaded_at FROM resumes WHERE id = ? AND user_id = ?',
        resumeId,
        userId
      );

      if (!resume || !(await chooseDefault(userId, resumeId))) {
        return response.status(404).json(RESUME_NOT_FOUND);
      }

      return response.json({
        message: 'Default resume updated.',
        resume: toPublicResume(resume, true),
      });
    } catch (error) {
      return next(error);
    }
  });

  // Deletes one resume and keeps the rest. Deleting the default also deletes its
  // default_resumes row, so the most recently uploaded remaining resume becomes
  // the default; with no resumes left there is no default.
  router.delete('/:resumeId', authenticateUser, async (request, response, next) => {
    const resumeId = readResumeId(request.params.resumeId);
    if (!resumeId) {
      return response.status(404).json(RESUME_NOT_FOUND);
    }

    try {
      const userId = request.authenticatedUser.id;
      const resume = await database.get(
        'SELECT stored_name FROM resumes WHERE id = ? AND user_id = ?',
        resumeId,
        userId
      );
      if (!resume) {
        return response.status(404).json(RESUME_NOT_FOUND);
      }

      const result = await database.run(
        'DELETE FROM resumes WHERE id = ? AND user_id = ?',
        resumeId,
        userId
      );
      // No change means a parallel request deleted it first.
      if (!result.changes) {
        return response.status(404).json(RESUME_NOT_FOUND);
      }

      await removeFile(path.join(uploadDirectory, resume.stored_name));

      const defaultResume = await findDefaultResume(database, userId);
      return response.json({
        message: 'Resume deleted successfully.',
        defaultResume: defaultResume ? toPublicResume(defaultResume, true) : null,
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { createResumeRouter };
