import { escapeHtml, formatDate } from './ui.js';
import { companyMark, DEMO_DISCLAIMER, fetchJobs, jobTags, jobsUrl, searchState } from './job-shared.js';
import { initJobShell } from './job-shell.js';

if (await initJobShell()) {
  const surface = document.querySelector('#job-detail');
  const back = document.querySelector('#back-to-jobs');
  back.href = jobsUrl(searchState());
  const id = location.pathname.split('/').filter(Boolean).at(-1);
  let controller;
  let generation = 0;

  async function loadDetail() {
    controller?.abort();
    controller = new AbortController();
    const requestId = ++generation;
    const currentController = controller;
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; currentController.abort(); }, 15000);
    surface.setAttribute('aria-busy', 'true');
    surface.innerHTML = '<h1>Job details</h1><p role="status">Loading job details...</p>';
    try {
      const { job } = await fetchJobs(`/${encodeURIComponent(id)}`, controller.signal);
      if (requestId !== generation) return;
      document.title = `${job.title} | CareerConnect`;
      const details = job.details;
      const section = (heading, items) => items?.length ? `<section class="detail-section"><h2>${heading}</h2><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>` : '';
      const facts = [
        ['Location', job.location], ['Employment', job.employmentType],
        ['Workplace', job.workplaceType], ['Experience', job.experienceLevel],
        ['Category', job.categoryName], ['Posted', formatDate(job.createdAt)],
      ];
      surface.innerHTML = `<article class="job-detail">
        <header class="job-detail-header">
          <div class="detail-identity">${companyMark(job.company)}<p class="detail-company">${escapeHtml(job.company)}</p></div>
          <p class="eyebrow">${escapeHtml(job.categoryName)}</p>
          <h1>${escapeHtml(job.title)}</h1>
          <p class="detail-location">${escapeHtml(job.location)} <span aria-hidden="true">·</span> Posted ${escapeHtml(formatDate(job.createdAt))}</p>
          <div class="job-tags">${jobTags(job)}</div>
          ${job.isDemo ? `<p class="demo-notice">${DEMO_DISCLAIMER}</p>` : ''}
        </header>
        <div class="job-detail-layout">
          <aside class="job-facts" aria-labelledby="facts-heading">
            <h2 id="facts-heading">At a glance</h2>
            <dl>${facts.filter(([, value]) => value).map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>
            <div class="job-apply"><button class="button button-wide" type="button" disabled aria-describedby="apply-note">Apply now</button>
            <p id="apply-note">Applications are not available yet.</p></div>
          </aside>
          <div class="job-description">
            <section class="detail-section"><h2>Job overview</h2><div class="description-text">${escapeHtml(details?.overview || job.description)}</div></section>
            ${section('Responsibilities', details?.responsibilities)}
            ${section('Qualifications', details?.qualifications)}
            ${section('Preferred skills', details?.preferredSkills)}
            ${section('What you’ll get', details?.benefits)}
            ${details?.companyDescription ? `<section class="detail-section detail-about"><h2>About ${escapeHtml(job.company)}</h2><p>${escapeHtml(details.companyDescription)}</p></section>` : ''}
          </div>
        </div>
      </article>`;
    } catch (error) {
      if (requestId !== generation || (error.name === 'AbortError' && !timedOut)) return;
      const missing = error.status === 404;
      document.title = `${missing ? 'Job not found' : 'Job unavailable'} | CareerConnect`;
      surface.innerHTML = `<div class="jobs-state" role="${missing ? 'status' : 'alert'}"><h1>${missing ? 'This job posting could not be found.' : 'We couldn’t load this job.'}</h1><p>${missing ? 'It may have been removed or is no longer available.' : escapeHtml(timedOut ? 'The request timed out. Please try again.' : error.message)}</p>${missing ? `<a class="button" href="${escapeHtml(back.href)}">Back to jobs</a>` : '<button class="button button-secondary" type="button" data-retry>Try again</button>'}</div>`;
    } finally {
      clearTimeout(timeout);
      if (requestId === generation) surface.setAttribute('aria-busy', 'false');
    }
  }

  surface.addEventListener('click', (event) => { if (event.target.closest('[data-retry]')) loadDetail(); });
  addEventListener('pagehide', () => controller?.abort());
  loadDetail();
}
