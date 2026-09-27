const { createApp } = require('./app');
const { initializeDatabase } = require('./database/database');

const DEFAULT_PORT = 3000;

function getPort() {
  const port = Number.parseInt(process.env.PORT || DEFAULT_PORT, 10);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
}

async function startServer() {
  const database = await initializeDatabase();
  const app = createApp(database);
  const port = getPort();

  const server = app.listen(port, () => {
    console.log(`CareerConnect API is running at http://localhost:${port}`);
  });

  async function shutDown() {
    server.close(async () => {
      await database.close();
      process.exit(0);
    });
  }

  process.on('SIGINT', shutDown);
  process.on('SIGTERM', shutDown);
}

startServer().catch((error) => {
  console.error('Failed to start CareerConnect API:', error);
  process.exitCode = 1;
});
