const NOTIFICATION_TYPES = Object.freeze([
  'new_application',
  'application_update',
  'interview_invitation',
  'welcome',
  'idle_warning',
  // Reserved so deadline reminders can be added without rebuilding the table
  // (SQLite cannot alter a CHECK constraint in place).
  'deadline_reminder',
  'job_match',
]);

function publicNotification(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    link: row.type === 'new_application' && Number.isSafeInteger(row.job_id)
      ? `/recruiter/dashboard?applicants=${row.job_id}#candidate-review`
      : row.link,
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
    title: `🫩🥀`,
    message: `Congratulations, ${firstName}! You are unemployed!`,
    link: '/workspace/jobs/',
  };
}

// Created when someone has been inactive on their home page for a while.
function idleWarningNotification() {
  return {
    type: 'idle_warning',
    title: '67',
    message: 'It appears, you have been inactive for 67 seconds. Are you still there?',
    link: null,
  };
}

module.exports = {
  NOTIFICATION_TYPES,
  publicNotification,
  shouldSendWelcome,
  welcomeNotification,
  idleWarningNotification,
};
