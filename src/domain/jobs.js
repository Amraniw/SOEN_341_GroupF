// Canonical category IDs are persisted; labels are supplied to clients by the API.
const JOB_CATEGORIES = Object.freeze([
  { id: 'software-engineering', name: 'Software Engineering' },
  { id: 'engineering', name: 'Aerospace & Engineering' },
  { id: 'data-analytics', name: 'Data & Analytics' },
  { id: 'product-design', name: 'Product & Design' },
  { id: 'business-operations', name: 'Business & Operations' },
]);

module.exports = { JOB_CATEGORIES };
