const { JOB_CATEGORIES } = require('./jobs');

const TEXT_LIMITS = { title: 200, company: 200, location: 200, category: 80, description: 5000 };
const ENUMS = {
  employmentType: ['Full-time', 'Internship', 'Contract'],
  workplaceType: ['On-site', 'Hybrid', 'Remote'],
  experienceLevel: ['Intern', 'Entry-level', 'Mid-level', 'Senior'],
};
const JOB_COLUMNS = Object.freeze({
  title: 'title', company: 'company', location: 'location', category: 'category', description: 'description',
  employmentType: 'employment_type', workplaceType: 'workplace_type', experienceLevel: 'experience_level',
  details: 'details_json',
});
const DETAIL_LISTS = ['responsibilities', 'qualifications', 'preferredSkills', 'benefits'];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeDetails(value) {
  if (value === null) return { details: null };
  if (!isObject(value) || Object.keys(value).some((key) => !['overview', 'companyDescription', ...DETAIL_LISTS].includes(key))) {
    return { error: 'details must be an object containing only supported job sections.' };
  }
  if (typeof value.overview !== 'string' || !value.overview.trim() || value.overview.includes('\0') || value.overview.length > 3000) {
    return { error: 'details.overview must contain 1 to 3000 characters.' };
  }
  const details = { overview: value.overview.trim() };
  for (const key of DETAIL_LISTS) {
    if (!Object.hasOwn(value, key)) continue;
    if (!Array.isArray(value[key]) || value[key].length > 20 || value[key].some((item) =>
      typeof item !== 'string' || !item.trim() || item.includes('\0') || item.length > 1000)) {
      return { error: `details.${key} must be a list of at most 20 nonblank strings, each up to 1000 characters.` };
    }
    details[key] = value[key].map((item) => item.trim());
  }
  if (Object.hasOwn(value, 'companyDescription')) {
    if (typeof value.companyDescription !== 'string' || value.companyDescription.includes('\0') || value.companyDescription.length > 2000) {
      return { error: 'details.companyDescription must be text of 2000 characters or fewer.' };
    }
    details.companyDescription = value.companyDescription.trim();
  }
  if (Buffer.byteLength(JSON.stringify(details), 'utf8') > 6000) {
    return { error: 'Structured job details must be 6000 bytes or fewer.' };
  }
  return { details };
}

function readJobFields(body, { partial = false } = {}) {
  if (!isObject(body) || !Object.keys(body).length) {
    return { error: 'Provide a JSON object containing job fields.' };
  }
  if (Object.keys(body).some((key) => !Object.hasOwn(JOB_COLUMNS, key))) {
    return { error: 'The job request contains unsupported fields.' };
  }
  const fields = {};
  for (const [key, limit] of Object.entries(TEXT_LIMITS)) {
    if (partial && !Object.hasOwn(body, key)) continue;
    const value = body[key];
    if (typeof value !== 'string' || !value.trim() || value.includes('\0') || value.length > limit) {
      return { error: `${key} must contain 1 to ${limit} characters.` };
    }
    fields[key] = key === 'description' ? value.trim() : value.trim().replace(/\s+/g, ' ');
    if (key === 'category') {
      fields.category = fields.category.toLowerCase();
      if (!JOB_CATEGORIES.some(({ id }) => id === fields.category)) {
        return { error: 'Choose a valid job category.' };
      }
    }
  }
  for (const [key, allowed] of Object.entries(ENUMS)) {
    if (!Object.hasOwn(body, key)) {
      if (!partial) fields[key] = null;
      continue;
    }
    const value = body[key];
    if (value === null || (typeof value === 'string' && !value.trim())) {
      fields[key] = null;
    } else if (typeof value === 'string' && allowed.includes(value.trim())) {
      fields[key] = value.trim();
    } else {
      return { error: `Choose a valid ${key}.` };
    }
  }
  if (Object.hasOwn(body, 'details')) {
    const { details, error } = normalizeDetails(body.details);
    if (error) return { error };
    fields.details = details === null ? null : JSON.stringify(details);
  } else if (!partial) {
    fields.details = null;
  }
  return { fields };
}

function recruiterJob(row) {
  let details = null;
  try { details = normalizeDetails(JSON.parse(row.details_json)).details ?? null; } catch { /* Plain-text fallback. */ }
  return {
    id: row.id, title: row.title, company: row.company, location: row.location,
    category: row.category, categoryName: JOB_CATEGORIES.find(({ id }) => id === row.category)?.name,
    description: row.description, status: row.status, createdAt: row.created_at,
    employmentType: row.employment_type, workplaceType: row.workplace_type,
    experienceLevel: row.experience_level, details,
    recruiterId: row.recruiter_id, applicationCount: row.applicationCount,
  };
}

module.exports = { JOB_COLUMNS, isObject, readJobFields, recruiterJob };
