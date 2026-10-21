const express = require('express');
const { JOB_CATEGORIES } = require('../domain/jobs');

const FILTER_LIMITS = { q: 120, location: 100, category: 80 };

function readFilters(query) {
  const filters = {};
  for (const key of Object.keys(query)) {
    if (!Object.hasOwn(FILTER_LIMITS, key)) {
      return { error: 'Unsupported search parameter.' };
    }
  }
  for (const [key, limit] of Object.entries(FILTER_LIMITS)) {
    const value = query[key] ?? '';
    if (typeof value !== 'string' || value.length > limit) {
      return { error: `${key} must be a single text value of ${limit} characters or fewer.` };
    }
    filters[key] = value.trim().replace(/\s+/g, ' ');
  }
  filters.category = filters.category.toLowerCase();
  if (filters.category && !JOB_CATEGORIES.some(({ id }) => id === filters.category)) {
    return { error: 'Choose a valid job category.' };
  }
  return { filters };
}

function substringPattern(value) {
  // LIKE wildcards must be treated literally, just like other search text.
  return `%${value.replace(/[\\%_]/g, '\\$&')}%`;
}

function publicJob(row) {
  const { created_at, demo_key, details_json, ...job } = row;
  const result = { ...job, createdAt: created_at, isDemo: Boolean(demo_key) };
  if (details_json !== undefined) result.details = readDetails(details_json);
  return result;
}

function readDetails(value) {
  // Legacy/malformed structured copy falls back to the stored plain description.
  try {
    const data = JSON.parse(value);
    if (!data || typeof data.overview !== 'string' || !data.overview.trim()) return null;
    const details = { overview: data.overview };
    for (const key of ['responsibilities', 'qualifications', 'preferredSkills', 'benefits']) {
      if (Array.isArray(data[key])) details[key] = data[key].filter((item) => typeof item === 'string' && item.trim());
    }
    if (typeof data.companyDescription === 'string') details.companyDescription = data.companyDescription;
    return details;
  } catch {
    return null;
  }
}

function createJobRouter(database) {
  const router = express.Router();

  router.get('/', async (request, response) => {
    const { filters, error } = readFilters(request.query);
    if (error) return response.status(400).json({ error });

    const conditions = ["j.status = 'open'"];
    const values = [];
    if (filters.q) {
      if (/^[a-z0-9]{1,2}$/i.test(filters.q)) {
        // Short terms such as AI must not match incidental letters in "failure"
        // or "maintain". GLOB character classes provide token boundaries without
        // adding an extension or changing normal substring/location matching.
        conditions.push("lower(' ' || j.title || ' ' || j.company || ' ' || j.description || ' ') GLOB ?");
        values.push(`*[^a-z0-9]${filters.q.toLowerCase()}[^a-z0-9]*`);
      } else {
        conditions.push("(j.title LIKE ? ESCAPE '\\' OR j.company LIKE ? ESCAPE '\\' OR j.description LIKE ? ESCAPE '\\')");
        values.push(...Array(3).fill(substringPattern(filters.q)));
      }
    }
    if (filters.location) {
      conditions.push("j.location LIKE ? ESCAPE '\\'");
      values.push(substringPattern(filters.location));
    }
    if (filters.category) {
      conditions.push('j.category = ?');
      values.push(filters.category);
    }

    const rows = await database.all(
      `SELECT j.id, j.title, j.company, j.location, j.category,
              c.name AS categoryName, substr(j.description, 1, 200) AS summary,
              j.created_at, j.demo_key, j.employment_type AS employmentType,
              j.workplace_type AS workplaceType, j.experience_level AS experienceLevel
       FROM jobs j JOIN job_categories c ON c.id = j.category
       WHERE ${conditions.join(' AND ')}
       ORDER BY datetime(j.created_at) DESC, j.id DESC`,
      values
    );
    response.json({
      items: rows.map(publicJob),
      total: rows.length,
      categories: JOB_CATEGORIES,
      demoOnly: rows.length > 0 && rows.every((row) => Boolean(row.demo_key)),
      hasDemo: rows.some((row) => Boolean(row.demo_key)),
    });
  });

  router.get('/:jobId', async (request, response) => {
    const { jobId } = request.params;
    if (!/^[1-9]\d*$/.test(jobId) || !Number.isSafeInteger(Number(jobId))) {
      return response.status(404).json({ error: 'This job posting could not be found.' });
    }
    const row = await database.get(
      `SELECT j.id, j.title, j.company, j.location, j.category, c.name AS categoryName,
              j.description, j.created_at, j.demo_key, j.employment_type AS employmentType,
              j.workplace_type AS workplaceType, j.experience_level AS experienceLevel, j.details_json
       FROM jobs j JOIN job_categories c ON c.id = j.category
       WHERE j.id = ? AND j.status = 'open'`,
      Number(jobId)
    );
    if (!row) {
      return response.status(404).json({ error: 'This job posting could not be found.' });
    }
    response.json({ job: publicJob(row) });
  });

  return router;
}

module.exports = { createJobRouter };
