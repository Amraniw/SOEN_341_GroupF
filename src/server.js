const { createApp } = require('./app');
const { initializeDatabase } = require('./database/database');
const { seedDemoJobs } = require('./database/seedJobs');

const DEFAULT_PORT = 3000;

function getPort() {
  const port = Number.parseInt(process.env.PORT || DEFAULT_PORT, 10);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
}

async function startServer({ databasePath, port = getPort() } = {}) {
  const database = await initializeDatabase(databasePath);
  try {
    // The educational catalog ships with the project. Normal seed reruns only
    // insert missing demo keys, preserving edits, closed jobs and personal data.
    if (process.env.NODE_ENV !== 'production') {
      await seedDemoJobs(database);
    }
    const app = createApp(database);
    const server = await new Promise((resolve, reject) => {
      const listener = app.listen(port, () => resolve(listener));
      listener.once('error', reject);
    });
    return { server, database };
  } catch (error) {
    await database.close();
    throw error;
  }
}

if (require.main === module) {
  startServer().then(({ server, database }) => {
    console.log(`CareerConnect API is running at http://localhost:${server.address().port}`);
    let stopping = false;
    function shutDown() {
      if (stopping) return;
      stopping = true;
      server.close(async () => {
        await database.close();
        process.exit(0);
      });
    }
    process.on('SIGINT', shutDown);
    process.on('SIGTERM', shutDown);
  }).catch((error) => {
    console.error('Failed to start CareerConnect API:', error);
    process.exitCode = 1;
  });
}

module.exports = { startServer };
