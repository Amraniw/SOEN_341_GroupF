const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const { createAuthenticateUser } = require('../middleware/authenticateUser');
const {
  DEFAULT_UPLOAD_DIRECTORY,
  createResumeUpload,
} = require('../middleware/resumeUpload');

const PROJECT_ROOT = path.join(__dirname, '..', '..');

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

      return response.status(201).json({
        message: 'Resume uploaded successfully.',
        resume: {
          id: resume.id,
          originalName: resume.original_name,
          uploadedAt: resume.uploaded_at,
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { createResumeRouter };
