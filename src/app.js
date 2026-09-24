const crypto = require('node:crypto');
const express = require('express');
const cookieSession = require('cookie-session');
const multer = require('multer');
const { createAuthRouter } = require('./routes/authRoutes');
const { createResumeRouter } = require('./routes/resumeRoutes');
const { UnsupportedResumeTypeError } = require('./middleware/resumeUpload');

const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function createApp(database, options = {}) {
  const app = express();
  const sessionSecret =
    options.sessionSecret ||
    process.env.SESSION_SECRET ||
    crypto.randomBytes(32).toString('hex');

  app.disable('x-powered-by');
  app.use(
    cookieSession({
      name: 'careerconnect_session',
      keys: [sessionSecret],
      maxAge: SESSION_MAX_AGE_MS,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
  );
  app.use(express.json({ limit: '10kb' }));
  app.use('/api', createAuthRouter(database));
  app.use(
    '/api/resumes',
    createResumeRouter(database, { uploadDirectory: options.uploadDirectory })
  );

  app.use((request, response) => {
    response.status(404).json({ error: 'Route not found.' });
  });

  app.use((error, request, response, next) => {
    if (error.type === 'entity.parse.failed') {
      return response.status(400).json({ error: 'Request body must contain valid JSON.' });
    }

    if (error instanceof UnsupportedResumeTypeError) {
      return response.status(415).json({ error: error.message });
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return response.status(413).json({ error: 'Resume must be 5 MB or smaller.' });
      }

      return response.status(400).json({ error: 'Invalid resume upload request.' });
    }

    console.error(error);

    if (response.headersSent) {
      return next(error);
    }

    return response.status(500).json({ error: 'An unexpected server error occurred.' });
  });

  return app;
}

module.exports = { createApp };
