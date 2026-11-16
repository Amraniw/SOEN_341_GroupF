const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const { createAuthenticateUser } = require('../middleware/authenticateUser');
const {
  DEFAULT_UPLOAD_DIRECTORY,
  createResumeUpload,
} = require('../middleware/resumeUpload');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const RESUME_NOT_FOUND = { error: 'This resume could not be found.' };

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

  function toPublicResume(resume, isDefault) {
    return {
      id: resume.id,
      originalName: resume.original_name,
      uploadedAt: resume.uploaded_at,
      isDefault,
    };
  }

  // The default is the resume the user chose. Without a choice (accounts from
  // before resume collections, or after the chosen resume is deleted) it is the
  // most recently uploaded resume, which is the resume /current always returned.
  function findDefaultResume(userId) {
    return database.get(
      `SELECT r.id, r.original_name, r.uploaded_at
       FROM resumes r
       LEFT JOIN default_resumes d ON d.user_id = r.user_id AND d.resume_id = r.id
       WHERE r.user_id = ?
       ORDER BY d.resume_id IS NOT NULL DESC, r.uploaded_at DESC, r.id DESC
       LIMIT 1`,
      userId
    );
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
    const defaultResume = await findDefaultResume(userId);
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
      const resume = await findDefaultResume(request.authenticatedUser.id);
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

      const defaultResume = await findDefaultResume(userId);
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
