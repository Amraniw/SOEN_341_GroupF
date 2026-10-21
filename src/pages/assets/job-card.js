import { escapeHtml, icon } from './ui.js';
import { companyMark, jobMetadata, jobTags, jobUrl } from './job-shared.js';

export function jobCard(job, filters, demoOnly) {
  const href = jobUrl(job.id, filters);
  return `<li><article class="job-card">
    ${companyMark(job.company)}
    <div class="job-card-content">
      <h3><a class="job-title-link" href="${escapeHtml(href)}">${escapeHtml(job.title)}</a></h3>
      <p class="job-company">${escapeHtml(job.company)}${job.isDemo && !demoOnly ? ' <span class="badge badge-neutral">Demo</span>' : ''}</p>
      <div class="job-metadata">${jobMetadata(job)}</div>
      <p class="job-summary">${escapeHtml(job.summary.split('\n')[0])}</p>
      <div class="job-tags">${jobTags(job)}</div>
    </div>
    <span class="job-card-action" aria-hidden="true">View details ${icon('arrow')}</span>
  </article></li>`;
}
