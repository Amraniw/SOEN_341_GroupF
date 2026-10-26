const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const cookieSession = require('cookie-session');
const multer = require('multer');
const { createAuthRouter } = require('./routes/authRoutes');
const { createResumeRouter } = require('./routes/resumeRoutes');
const { createJobRouter } = require('./routes/jobRoutes');
const { createApplicationRouter } = require('./routes/applicationRoutes');
const { createRecruiterRouter } = require('./routes/recruiterRoutes');
const { createProfileRouter } = require('./routes/profileRoutes');
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
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    })
  );
  app.use(express.json({ limit: '10kb' }));
  app.use('/api', createAuthRouter(database));
  app.use('/api/jobs', createJobRouter(database));
  app.use('/api/applications', createApplicationRouter(database));
  app.use('/api/recruiter', createRecruiterRouter(database));
  app.use(
    '/api/resumes',
    createResumeRouter(database, { uploadDirectory: options.uploadDirectory })
  );
  app.use('/api/profile', createProfileRouter(database));
  app.use(express.static(path.join(__dirname, 'pages')));
  app.get(['/recruiter/dashboard', '/recruiter/dashboard/'], (request, response) => {
    response.sendFile(path.join(__dirname, 'pages', 'recruiter', 'dashboard.html'));
  });
  app.get(['/workspace/jobs', '/workspace/jobs/', '/workspace/jobs/index.html'], (request, response) => {
    response.sendFile(path.join(__dirname, 'pages', 'jobs', 'index.html'));
  });
  app.get('/workspace/jobs/:jobId', (request, response) => {
    response.sendFile(path.join(__dirname, 'pages', 'jobs', 'detail.html'));
  });
  app.get('/jobs/:jobId', (request, response) => {
    response.sendFile(path.join(__dirname, 'pages', 'jobs', 'detail.html'));
  });

  app.use((request, response) => {
    response.status(404).json({ error: 'Route not found.' });
  });

  app.use((error, request, response, next) => {
    if (error.type === 'entity.too.large' && /^\/api\/recruiter(?:\/|$)/.test(request.path)) {
      return response.status(400).json({ error: 'Recruiter requests must be 10 KB or smaller.' });
    }

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
