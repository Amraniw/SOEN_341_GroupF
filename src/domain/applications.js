const APPLICATION_STATUSES = Object.freeze([
  { id: 'applied', name: 'Applied' },
  { id: 'under_review', name: 'Under Review' },
  { id: 'interview', name: 'Interview' },
  { id: 'offered', name: 'Offered' },
  { id: 'rejected', name: 'Rejected' },
]);

const APPLICATION_STATUS_IDS = Object.freeze(
  APPLICATION_STATUSES.map(({ id }) => id)
);

// A job seeker's answer to an offer. It is stored beside the status, not as a new
// status, because SQLite cannot alter the status CHECK constraints in place.
const OFFER_RESPONSES = Object.freeze(['accepted', 'declined']);

function applicationStatusName(status) {
  return APPLICATION_STATUSES.find(({ id }) => id === status)?.name || status;
}

module.exports = {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_IDS,
  OFFER_RESPONSES,
  applicationStatusName,
};
