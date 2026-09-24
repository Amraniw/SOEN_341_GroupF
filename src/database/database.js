const fs = require('node:fs/promises');
const path = require('node:path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const DEFAULT_DATABASE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'careerconnect.sqlite'
);

async function initializeDatabase(databasePath = process.env.DB_PATH || DEFAULT_DATABASE_PATH) {
  if (databasePath !== ':memory:') {
    await fs.mkdir(path.dirname(databasePath), { recursive: true });
  }

  const database = await open({
    filename: databasePath,
    driver: sqlite3.Database,
  });

  await database.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return database;
}

module.exports = {
  DEFAULT_DATABASE_PATH,
  initializeDatabase,
};
