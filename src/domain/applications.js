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

function applicationStatusName(status) {
  return APPLICATION_STATUSES.find(({ id }) => id === status)?.name || status;
}

module.exports = {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_IDS,
  applicationStatusName,
};
