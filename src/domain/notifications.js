const NOTIFICATION_TYPES = Object.freeze([
  'new_application',
  'application_update',
  'interview_invitation',
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

module.exports = { NOTIFICATION_TYPES, publicNotification };
