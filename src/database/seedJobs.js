const { initializeDatabase } = require('./database');
const { DEMO_JOBS } = require('./demoJobs');

// Normal reruns preserve edits. Explicit refresh affects only our stable demo
// keys; unrelated postings, users and resumes are untouched.
async function seedDemoJobs(database, environment = process.env.NODE_ENV, { refreshExisting = false } = {}) {
  if (environment === 'production') throw new Error('Demo jobs cannot be seeded in production.');
  let inserted = 0;
  await database.exec('BEGIN IMMEDIATE');
  try {
    const existing = new Set((await database.all('SELECT demo_key FROM jobs WHERE demo_key IS NOT NULL')).map(({ demo_key }) => demo_key));
    for (const [index, job] of DEMO_JOBS.entries()) {
      const key = `us05-demo-${index + 1}`;
      const details = { overview: job.overview, responsibilities: job.responsibilities, qualifications: job.qualifications, preferredSkills: job.preferredSkills, companyDescription: job.companyDescription };
      // Preserve full-content keyword search, including location, while keeping
      // list responses small. Structured sections are detail-only.
      const description = [job.overview, job.location, ...job.responsibilities, ...job.qualifications, ...job.preferredSkills, job.companyDescription].join('\n\n');
      const createdAt = new Date(Date.UTC(2026, 9, 1 + Math.floor(index * 18 / 49), 9, index % 3)).toISOString();
      await database.run(
        `INSERT INTO jobs (title, company, location, category, description, created_at, demo_key, employment_type, workplace_type, experience_level, details_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(demo_key) ${refreshExisting ? `DO UPDATE SET title=excluded.title, company=excluded.company, location=excluded.location,
           category=excluded.category, description=excluded.description, created_at=excluded.created_at,
           employment_type=excluded.employment_type, workplace_type=excluded.workplace_type,
           experience_level=excluded.experience_level, details_json=excluded.details_json` : 'DO NOTHING'}`,
        job.title, job.company, job.location, job.category, description, createdAt, key,
        job.employmentType, job.workplaceType, job.experienceLevel, JSON.stringify(details)
      );
      if (!existing.has(key)) inserted++;
    }
    await database.exec('COMMIT');
  } catch (error) {
    await database.exec('ROLLBACK');
    throw error;
  }
  return inserted;
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo jobs cannot be seeded in production.');
  const database = await initializeDatabase();
  try {
    const refreshExisting = process.argv.includes('--refresh');
    const inserted = await seedDemoJobs(database, process.env.NODE_ENV, { refreshExisting });
    console.log(`Added ${inserted} educational demo postings.${refreshExisting ? ' Refreshed the 50 managed demo records.' : ' Existing postings were preserved.'}`);
  } finally {
    await database.close();
  }
}
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { seedDemoJobs };
