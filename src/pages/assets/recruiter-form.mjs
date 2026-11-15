export const CATEGORIES = [
  ['software-engineering', 'Software Engineering'], ['engineering', 'Aerospace & Engineering'],
  ['data-analytics', 'Data & Analytics'], ['product-design', 'Product & Design'],
  ['business-operations', 'Business & Operations'],
];
export const ENUMS = {
  employmentType: ['Full-time', 'Internship', 'Contract'],
  workplaceType: ['On-site', 'Hybrid', 'Remote'],
  experienceLevel: ['Intern', 'Entry-level', 'Mid-level', 'Senior'],
};
export const LISTS = {
  responsibilities: 'Responsibilities', qualifications: 'Qualifications',
  preferredSkills: 'Preferred skills', benefits: 'Benefits',
};
export const FIELDS = [
  ['title', 'Job title', 200], ['company', 'Company', 200], ['location', 'Location', 200],
  ['category', 'Category', CATEGORIES], ['description', 'Description', 5000],
  ['employmentType', 'Employment type', ENUMS.employmentType],
  ['workplaceType', 'Workplace type', ENUMS.workplaceType],
  ['experienceLevel', 'Experience level', ENUMS.experienceLevel],
  ['closingDate', 'Applications close on', 'date'],
  ['overview', 'Structured overview', 3000], ['companyDescription', 'About the company', 2000],
];
const REQUIRED = ['title', 'company', 'location', 'category', 'description'];

export function postingDraft(job) {
  return {
    ...Object.fromEntries(FIELDS.map(([key]) => [key, job?.[key] ?? job?.details?.[key] ?? ''])),
    ...Object.fromEntries(Object.keys(LISTS).map((key) => [key, [...(job?.details?.[key] || [])]])),
  };
}

function comparableDetails(details) {
  return details === null ? null : {
    overview: details.overview, companyDescription: details.companyDescription || '',
    ...Object.fromEntries(Object.keys(LISTS).map((key) => [key, details[key] || []])),
  };
}

// Field checks report every invalid field at once, so a recruiter can fix them
// together. `error` and `field` stay the first problem, as before.
function fieldError(key, label, spec, raw) {
  if (typeof raw !== 'string' || raw.includes('\0')) return `${label} must be valid text.`;
  const value = raw.trim();
  if (REQUIRED.includes(key) && !value) return `${label} is required.`;
  if (typeof spec === 'number' && raw.length > spec) return `${label} must be ${spec} characters or fewer.`;
  if (key === 'category' && !CATEGORIES.some(([id]) => id === value)) return 'Choose a valid category.';
  if (ENUMS[key] && value && !ENUMS[key].includes(value)) return `Choose a valid ${label.toLowerCase()}.`;
  if (spec === 'date' && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${label} must be a valid date.`;
  return null;
}

function invalid(errors) {
  return { error: errors[0].message, field: errors[0].field, errors };
}

export function postingPayload(draft, original = null) {
  const payload = {};
  const errors = [];
  for (const [key, label, spec] of FIELDS) {
    const raw = draft[key] ?? '';
    const message = fieldError(key, label, spec, raw);
    if (message) errors.push({ field: key, message });
    else if (!['overview', 'companyDescription'].includes(key)) payload[key] = raw.trim() || null;
  }
  const lists = {};
  for (const [key, label] of Object.entries(LISTS)) {
    const items = draft[key];
    if (!Array.isArray(items) || items.length > 20 || items.some((value) =>
      typeof value !== 'string' || value.includes('\0') || value.length > 1000)) {
      errors.push({ field: key, message: `${label} supports up to 20 entries of 1000 characters each.` });
    } else {
      lists[key] = items.map((value) => value.trim()).filter(Boolean);
    }
  }
  if (errors.length) return invalid(errors);
  const details = { overview: (draft.overview ?? '').trim(), companyDescription: (draft.companyDescription ?? '').trim(), ...lists };
  const hasDetails = details.overview || details.companyDescription || Object.keys(LISTS).some((key) => details[key].length);
  if (hasDetails && !details.overview) return invalid([{ field: 'overview', message: 'Add a structured overview when using optional job sections.' }]);
  if (hasDetails && new TextEncoder().encode(JSON.stringify(details)).length > 6000) {
    return invalid([{ field: 'overview', message: 'Optional job sections must total 6000 bytes or fewer. Shorten an entry and try again.' }]);
  }
  payload.details = hasDetails ? details : null;
  if (original) {
    for (const key of Object.keys(payload)) {
      const current = key === 'details' ? comparableDetails(payload.details) : payload[key];
      const previous = key === 'details' ? comparableDetails(original.details ?? null) : original[key] ?? null;
      if (JSON.stringify(current) === JSON.stringify(previous)) delete payload[key];
    }
  }
  if (new TextEncoder().encode(JSON.stringify(payload)).length > 10240) {
    return invalid([{ field: 'description', message: 'This posting exceeds the 10 KB request limit. Shorten the description or optional sections.' }]);
  }
  return { payload };
}
