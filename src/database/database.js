const fs = require('node:fs/promises');
const path = require('node:path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { JOB_CATEGORIES } = require('../domain/jobs');
const { APPLICATION_STATUS_IDS, APPLICATION_STATUSES } = require('../domain/applications');
const { NOTIFICATION_TYPES } = require('../domain/notifications');

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

    CREATE TABLE IF NOT EXISTS profiles (
      user_id INTEGER PRIMARY KEY,
      headline TEXT NOT NULL CHECK (length(trim(headline)) > 0),
      location TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      skills TEXT NOT NULL DEFAULT '',
      education TEXT NOT NULL DEFAULT '',
      experience TEXT NOT NULL DEFAULT '',
      website TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS job_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL CHECK (length(trim(title)) > 0),
      company TEXT NOT NULL CHECK (length(trim(company)) > 0),
      location TEXT NOT NULL CHECK (length(trim(location)) > 0),
      category TEXT NOT NULL REFERENCES job_categories(id),
      description TEXT NOT NULL CHECK (length(trim(description)) > 0),
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      demo_key TEXT UNIQUE
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_available ON jobs(status, created_at DESC, id DESC);

    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      job_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'applied'
        CHECK (status IN (${APPLICATION_STATUS_IDS.map((status) => `'${status}'`).join(', ')})),
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE RESTRICT,
      UNIQUE (user_id, job_id)
    );

    CREATE INDEX IF NOT EXISTS idx_applications_user_updated
      ON applications(user_id, updated_at DESC, id DESC);

    CREATE TABLE IF NOT EXISTS application_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      status TEXT NOT NULL
        CHECK (status IN (${APPLICATION_STATUS_IDS.map((status) => `'${status}'`).join(', ')})),
      changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_application_history_application
      ON application_status_history(application_id, changed_at ASC, id ASC);

    CREATE TRIGGER IF NOT EXISTS applications_record_initial_status
    AFTER INSERT ON applications
    BEGIN
      INSERT INTO application_status_history (application_id, status)
      VALUES (NEW.id, NEW.status);
    END;

    CREATE TRIGGER IF NOT EXISTS applications_record_status_change
    AFTER UPDATE OF status ON applications
    WHEN NEW.status <> OLD.status
    BEGIN
      UPDATE applications SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      INSERT INTO application_status_history (application_id, status)
      VALUES (NEW.id, NEW.status);
    END;
  `);

  // Additive migrations also run on fresh databases, keeping one definition for
  // each new column. Nullable foreign keys are compatible with existing rows.
  const userColumns = new Set((await database.all('PRAGMA table_info(users)')).map(({ name }) => name));
  if (!userColumns.has('role')) {
    await database.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'job_seeker' CHECK (role IN ('job_seeker', 'recruiter'))");
  }

  const jobColumns = new Set((await database.all('PRAGMA table_info(jobs)')).map(({ name }) => name));
  const jobColumnDefinitions = {
    employment_type: "TEXT CHECK (employment_type IN ('Full-time', 'Internship', 'Contract'))",
    workplace_type: "TEXT CHECK (workplace_type IN ('On-site', 'Hybrid', 'Remote'))",
    experience_level: "TEXT CHECK (experience_level IN ('Intern', 'Entry-level', 'Mid-level', 'Senior'))",
    details_json: 'TEXT',
    recruiter_id: 'INTEGER REFERENCES users(id)',
  };
  for (const [name, definition] of Object.entries(jobColumnDefinitions)) {
    if (!jobColumns.has(name)) await database.exec(`ALTER TABLE jobs ADD COLUMN ${name} ${definition}`);
  }

  await database.exec('CREATE INDEX IF NOT EXISTS idx_jobs_recruiter_created ON jobs(recruiter_id, created_at DESC, id DESC)');

  const applicationColumns = new Set((await database.all('PRAGMA table_info(applications)')).map(({ name }) => name));
  if (!applicationColumns.has('job_snapshot_json')) {
    await database.exec('ALTER TABLE applications ADD COLUMN job_snapshot_json TEXT');
  }

  // Notifications are created by triggers so that every code path that inserts
  // an application or changes its status produces one, including routes added
  // later. They run after the migrations above because they read jobs.recruiter_id.
  const statusLabel = (column) =>
    `CASE ${column} ${APPLICATION_STATUSES.map(({ id, name }) => `WHEN '${id}' THEN '${name}'`).join(' ')} ELSE ${column} END`;
  await database.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL
        CHECK (type IN (${NOTIFICATION_TYPES.map((type) => `'${type}'`).join(', ')})),
      title TEXT NOT NULL CHECK (length(trim(title)) > 0),
      message TEXT NOT NULL CHECK (length(trim(message)) > 0),
      link TEXT,
      application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL,
      job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
      dedupe_key TEXT UNIQUE,
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_user_created
      ON notifications(user_id, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
      ON notifications(user_id, read_at);

    CREATE TRIGGER IF NOT EXISTS applications_notify_recruiter
    AFTER INSERT ON applications
    WHEN (SELECT recruiter_id FROM jobs WHERE id = NEW.job_id) IS NOT NULL
    BEGIN
      INSERT INTO notifications (user_id, type, title, message, link, application_id, job_id)
      SELECT j.recruiter_id, 'new_application', 'New application',
             u.name || ' applied for ' || j.title || '.',
             '/recruiter/dashboard', NEW.id, j.id
      FROM jobs j JOIN users u ON u.id = NEW.user_id
      WHERE j.id = NEW.job_id;
    END;

    CREATE TRIGGER IF NOT EXISTS applications_notify_applicant
    AFTER UPDATE OF status ON applications
    WHEN NEW.status <> OLD.status
    BEGIN
      INSERT INTO notifications (user_id, type, title, message, link, application_id, job_id)
      SELECT NEW.user_id,
             CASE NEW.status WHEN 'interview' THEN 'interview_invitation' ELSE 'application_update' END,
             CASE NEW.status WHEN 'interview' THEN 'Interview invitation' ELSE 'Application update' END,
             CASE NEW.status
               WHEN 'interview' THEN 'You have been invited to interview for ' || j.title || ' at ' || j.company || '.'
               ELSE 'Your application for ' || j.title || ' at ' || j.company
                    || ' was updated to ' || (${statusLabel('NEW.status')}) || '.'
             END,
             '/applications/index.html', NEW.id, j.id
      FROM jobs j WHERE j.id = NEW.job_id;
    END;
  `);

  for (const category of JOB_CATEGORIES) {
    await database.run(
      'INSERT INTO job_categories (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name',
      category.id,
      category.name
    );
  }

  return database;
}

module.exports = {
  DEFAULT_DATABASE_PATH,
  initializeDatabase,
};
