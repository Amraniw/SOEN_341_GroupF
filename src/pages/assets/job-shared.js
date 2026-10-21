import { escapeHtml, formatDate } from './ui.js';
export { FILTER_KEYS, searchState, searchParams, jobsUrl, jobUrl } from './job-context.mjs';

export function jobMetadata(job) {
  return [job.location, job.experienceLevel, job.categoryName, `Posted ${formatDate(job.createdAt)}`]
    .filter(Boolean).map((value) => `<span>${escapeHtml(value)}</span>`).join('');
}

export const DEMO_DISCLAIMER = 'Demonstration job postings for educational purposes. These are not verified live openings.';

export function companyMark(company) {
  const words = company.trim().split(/\s+/);
  const mark = words.length > 1 ? words.slice(0, 2).map((word) => [...word][0]).join('') : [...company].slice(0, 2).join('');
  return `<span class="company-mark" aria-hidden="true">${escapeHtml(mark.toUpperCase())}</span>`;
}

export function jobTags(job) {
  return [job.employmentType, job.workplaceType].filter(Boolean)
    .map((value) => `<span class="job-tag">${escapeHtml(value)}</span>`).join('');
}

export async function fetchJobs(path, signal) {
  try {
    const response = await fetch(`/api/jobs${path}`, {
      credentials: 'same-origin',
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const error = new Error(response.status === 400 ? data?.error || 'Check your search criteria and try again.' : 'We could not load jobs. Please try again.');
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError' || error.status) throw error;
    throw new Error('We could not connect. Check your connection and try again.');
  }
}
