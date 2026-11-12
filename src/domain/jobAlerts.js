// Job alerts for job seekers:
//  - job_match: a newly posted (or edited / reopened) job matches their profile
//    headline or location.
//  - deadline_reminder: a matching job they have not applied to closes soon.
// Both use notifications.dedupe_key so each person gets each alert only once.

// Words that describe the person rather than the kind of job they want.
const HEADLINE_STOPWORDS = new Set([
  'a', 'an', 'and', 'the', 'for', 'with', 'of', 'in', 'to', 'on', 'or', 'my', 'i', 'am',
  'student', 'students', 'aspiring', 'seeking', 'looking', 'experienced', 'passionate',
  'junior', 'senior', 'jr', 'sr', 'intern', 'internship', 'entry', 'level', 'graduate', 'grad',
  'new', 'recent', 'open', 'opportunities', 'opportunity', 'role', 'roles', 'position',
  'professional', 'enthusiast', 'based', 'year', 'final', 'undergraduate', 'bachelor',
  'degree', 'candidate', 'lead', 'freelance',
]);

const REMINDER_WINDOW_DAYS = 3; // remind when the job closes today, tomorrow or in 2 days
const REMINDER_INTERVAL_MS = 60 * 60 * 1000;
const CLOSING_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function words(value) {
  return normalize(value).split(/[^a-z0-9+#]+/).filter(Boolean);
}

// "Software Engineering Student at Concordia" -> ['software', 'engineering']
function headlineKeywords(headline) {
  const role = normalize(headline).split(/\s(?:at|@)\s|@/)[0];
  return [...new Set(words(role).filter((word) => !HEADLINE_STOPWORDS.has(word)))];
}

// Same word, or the same root ("engineer"/"engineering", "developer"/"development").
function similarWords(a, b) {
  if (a === b) return true;
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix += 1;
  return prefix >= 6;
}

// The headline matches when more than half of its keywords appear in the job title,
// so "Software Developer" matches "Junior Software Developer" but "Mechanical
// Engineer" does not match "Software Engineer".
function headlineMatches(headline, jobTitle) {
  const keywords = headlineKeywords(headline);
  if (!keywords.length) return false;
  const titleWords = words(jobTitle);
  const found = keywords.filter((keyword) => titleWords.some((word) => similarWords(keyword, word)));
  return found.length > keywords.length / 2;
}

// Compares the city (the part before the first comma): "Montreal" matches
// "Montréal, QC" and "Montreal, Quebec" matches "Montreal, QC".
function city(location) {
  return words(normalize(location).split(',')[0]).join(' ');
}

function locationMatches(profileLocation, jobLocation) {
  const wanted = city(profileLocation);
  if (!wanted) return false;
  if (city(jobLocation) === wanted) return true;
  return ` ${words(jobLocation).join(' ')} `.includes(` ${wanted} `);
}

function matchReasons(profile, job) {
  const reasons = [];
  if (headlineMatches(profile.headline, job.title)) reasons.push('headline');
  if (locationMatches(profile.location, job.location)) reasons.push('location');
  return reasons;
}

function jobLink(jobId) {
  return `/workspace/jobs/${jobId}`;
}

function jobMatchNotification(job, reasons) {
  const why = reasons.length === 2
    ? 'your headline and location'
    : reasons[0] === 'headline' ? 'your headline' : 'your location';
  return {
    type: 'job_match',
    title: 'New job that matches your profile',
    message: `${job.title} at ${job.company} (${job.location}) matches ${why}.`,
    link: jobLink(job.id),
  };
}

// Today's date (YYYY-MM-DD) in the server's local time zone.
function localDate(now = new Date()) {
  const date = new Date(now);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

function addDays(day, count) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + count * 86400000).toISOString().slice(0, 10);
}

function isValidClosingDate(value) {
  if (typeof value !== 'string' || !CLOSING_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function closingReminderNotification(job, daysLeft) {
  const when = daysLeft <= 0 ? 'today' : daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`;
  const date = new Date(`${job.closing_date}T12:00:00Z`).toLocaleDateString('en-CA', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
  return {
    type: 'deadline_reminder',
    title: `Job closing ${when}`,
    message: `${job.title} at ${job.company} stops accepting applications ${when} (${date}). Apply before it closes.`,
    link: jobLink(job.id),
  };
}

async function insertOnce(database, userId, jobId, dedupeKey, notification) {
  const result = await database.run(
    `INSERT INTO notifications (user_id, type, title, message, link, job_id, dedupe_key)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(dedupe_key) DO NOTHING`,
    userId, notification.type, notification.title, notification.message, notification.link, jobId, dedupeKey
  );
  return result.changes > 0;
}

async function jobSeekerProfiles(database) {
  return database.all(
    `SELECT u.id AS user_id, p.headline, p.location
     FROM users u JOIN profiles p ON p.user_id = u.id
     WHERE u.role = 'job_seeker'`
  );
}

// Sends a job_match notification to every job seeker whose profile matches this
// open job. Returns how many notifications were created.
async function notifyMatchingJobSeekers(database, jobId) {
  const job = await database.get(
    "SELECT id, title, company, location FROM jobs WHERE id = ? AND status = 'open'",
    jobId
  );
  if (!job) return 0;
  let created = 0;
  for (const profile of await jobSeekerProfiles(database)) {
    const reasons = matchReasons(profile, job);
    if (!reasons.length) continue;
    if (await insertOnce(database, profile.user_id, job.id, `job_match:${job.id}:${profile.user_id}`,
      jobMatchNotification(job, reasons))) created += 1;
  }
  return created;
}

// Reminds matching job seekers who have not applied yet that an open job closes
// within the reminder window. Pass `jobId` to check a single job.
async function sendClosingReminders(database, { now = new Date(), jobId = null } = {}) {
  const today = localDate(now);
  const lastDay = addDays(today, REMINDER_WINDOW_DAYS - 1);
  const jobs = await database.all(
    `SELECT id, title, company, location, closing_date FROM jobs
     WHERE status = 'open' AND closing_date IS NOT NULL
       AND closing_date >= ? AND closing_date <= ? ${jobId === null ? '' : 'AND id = ?'}`,
    ...(jobId === null ? [today, lastDay] : [today, lastDay, jobId])
  );
  if (!jobs.length) return 0;
  const profiles = await jobSeekerProfiles(database);
  let created = 0;
  for (const job of jobs) {
    const applied = new Set((await database.all(
      'SELECT user_id FROM applications WHERE job_id = ?', job.id
    )).map((row) => row.user_id));
    const reminder = closingReminderNotification(job, daysBetween(today, job.closing_date));
    for (const profile of profiles) {
      if (applied.has(profile.user_id) || !matchReasons(profile, job).length) continue;
      const key = `deadline_reminder:${job.id}:${profile.user_id}:${job.closing_date}`;
      if (await insertOnce(database, profile.user_id, job.id, key, reminder)) created += 1;
    }
  }
  return created;
}

// Runs right away and then every hour. Alerts are a convenience, so errors are
// logged and never stop the server.
function startClosingReminderSchedule(database, { intervalMs = REMINDER_INTERVAL_MS } = {}) {
  const run = () => sendClosingReminders(database).catch((error) => {
    console.error('Could not send job closing reminders:', error.message);
  });
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}

// Called after a recruiter creates, edits or reopens a posting.
async function runJobAlerts(database, jobId) {
  try {
    await notifyMatchingJobSeekers(database, jobId);
    await sendClosingReminders(database, { jobId });
  } catch (error) {
    console.error('Could not send job alerts:', error.message);
  }
}

module.exports = {
  REMINDER_WINDOW_DAYS,
  headlineKeywords,
  headlineMatches,
  locationMatches,
  matchReasons,
  jobMatchNotification,
  closingReminderNotification,
  isValidClosingDate,
  localDate,
  notifyMatchingJobSeekers,
  sendClosingReminders,
  startClosingReminderSchedule,
  runJobAlerts,
};
