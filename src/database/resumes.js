// A saved choice wins. Older accounts and accounts whose default was removed
// use their most recent remaining upload, just like the Resume page.
function findDefaultResume(database, userId) {
  return database.get(
    `SELECT r.id, r.original_name, r.uploaded_at, r.stored_name
     FROM resumes r
     LEFT JOIN default_resumes d ON d.user_id = r.user_id AND d.resume_id = r.id
     WHERE r.user_id = ?
     ORDER BY d.resume_id IS NOT NULL DESC, r.uploaded_at DESC, r.id DESC
     LIMIT 1`,
    userId
  );
}

module.exports = { findDefaultResume };
