const { OFFER_RESPONSES } = require('../domain/applications');

// Adds offer responses to applications. Safe to run on every start.
async function installOfferResponses(database) {
  const columns = new Set(
    (await database.all('PRAGMA table_info(applications)')).map(({ name }) => name)
  );
  if (!columns.has('offer_response')) {
    await database.exec(
      `ALTER TABLE applications ADD COLUMN offer_response TEXT CHECK (offer_response IN (${OFFER_RESPONSES.map((response) => `'${response}'`).join(', ')}))`
    );
  }
  if (!columns.has('offer_responded_at')) {
    await database.exec('ALTER TABLE applications ADD COLUMN offer_responded_at TEXT');
  }

  // Accepting an offer makes the applicant employed in the same statement, so the
  // two can never disagree. Declining changes nothing about employment.
  await database.exec(`
    CREATE TRIGGER IF NOT EXISTS applications_offer_accepted_employs_applicant
    AFTER UPDATE OF offer_response ON applications
    WHEN NEW.offer_response = 'accepted' AND OLD.offer_response IS NOT 'accepted'
    BEGIN
      UPDATE users SET employment_status = 'employed'
      WHERE id = NEW.user_id AND role = 'job_seeker';
    END;
  `);
}

module.exports = { installOfferResponses };
