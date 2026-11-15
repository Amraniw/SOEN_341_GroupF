const { applicationStatusName } = require('./applications');

// Recruiters only ever see applications for postings they own, so every query
// built from this select must also filter on jobs.recruiter_id.
const RECRUITER_APPLICATION_SELECT = `
  SELECT a.id, a.job_id, a.status, a.applied_at, a.updated_at,
         a.offer_response, a.offer_responded_at,
         u.id AS applicant_id, u.name AS applicant_name, u.email AS applicant_email
  FROM applications a
  JOIN users u ON u.id = a.user_id
  JOIN jobs j ON j.id = a.job_id`;

function recruiterApplication(row) {
  return {
    id: row.id,
    jobId: row.job_id,
    status: row.status,
    statusLabel: applicationStatusName(row.status),
    appliedAt: row.applied_at,
    updatedAt: row.updated_at,
    // How the applicant answered an offer: 'accepted', 'declined', or null while waiting.
    offerResponse: row.offer_response ?? null,
    offerRespondedAt: row.offer_responded_at ?? null,
    applicant: {
      id: row.applicant_id,
      name: row.applicant_name,
      email: row.applicant_email,
    },
  };
}

module.exports = { RECRUITER_APPLICATION_SELECT, recruiterApplication };
