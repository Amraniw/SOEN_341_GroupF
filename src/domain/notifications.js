const NOTIFICATION_TYPES = Object.freeze([
  'new_application',
  'application_update',
  'interview_invitation',
  'welcome',
  // Reserved so deadline reminders can be added without rebuilding the table
  // (SQLite cannot alter a CHECK constraint in place).
  'deadline_reminder',
]);

function publicNotification(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    link: row.link,
    createdAt: row.created_at,
    readAt: row.read_at,
    read: row.read_at !== null,
  };
}

// Job seekers who are currently unemployed get a welcome notification each time
// they sign in. Recruiters and employed job seekers do not.
function shouldSendWelcome(user) {
  return user.role === 'job_seeker' && user.employment_status === 'unemployed';
}

function welcomeNotification(user) {
  const firstName = String(user.name || '').trim().split(/\s+/)[0] || 'there';
  return {
    type: 'welcome',
    title: `Welcome back, ${firstName}!`,
    message: 'Still looking for your next role? Browse open jobs and keep your resume up to date so you are ready to apply.',
    link: '/workspace/jobs/',
  };
}

module.exports = { NOTIFICATION_TYPES, publicNotification, shouldSendWelcome, welcomeNotification };
