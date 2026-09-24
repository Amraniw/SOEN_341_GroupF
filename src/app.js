const express = require('express');
const { createAuthRouter } = require('./routes/authRoutes');

function createApp(database) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));
  app.use('/api', createAuthRouter(database));

  app.use((request, response) => {
    response.status(404).json({ error: 'Route not found.' });
  });

  app.use((error, request, response, next) => {
    if (error.type === 'entity.parse.failed') {
      return response.status(400).json({ error: 'Request body must contain valid JSON.' });
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
