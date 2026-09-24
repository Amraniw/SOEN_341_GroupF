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

    CREATE TABLE IF NOT EXISTS resumes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL UNIQUE,
      file_path TEXT NOT NULL UNIQUE,
      uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
  `);

  return database;
}

module.exports = {
  DEFAULT_DATABASE_PATH,
  initializeDatabase,
};
