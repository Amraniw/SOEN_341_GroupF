import { escapeHtml, formatDate } from './ui.js';
import { companyMark, DEMO_DISCLAIMER, fetchJobs, jobTags, jobsUrl, searchState } from './job-shared.js';
import { initJobShell } from './job-shell.js';
import { request } from './api.js';
import { signInUrl } from './session.js';

if (await initJobShell()) {
  const surface = document.querySelector('#job-detail');
  const back = document.querySelector('#back-to-jobs');
  back.href = jobsUrl(searchState());
  const id = location.pathname.split('/').filter(Boolean).at(-1);
  let controller;
  let generation = 0;

  function applicationStatus(application, confirmation = false) {
    const heading = confirmation ? 'Application submitted' : 'Already applied';
    return `<div class="application-confirmation" role="status" aria-live="polite">
      <span class="application-confirmation-icon" aria-hidden="true">✓</span>
      <div><strong>${heading}</strong><p>Your status is <span class="application-status status-${escapeHtml(application.status.replaceAll('_', '-'))}">${escapeHtml(application.statusLabel)}</span>.</p></div>
      <a class="text-link" href="/applications/index.html">Track application →</a>
    </div>`;
  }

  function readyToApply(job) {
    return `<button class="button button-wide" type="button" data-apply-job="${job.id}">Apply now</button>
      <p>Submit with your CareerConnect account. You can track every status update in your workspace.</p>`;
  }

  async function initializeApplication(job) {
    const apply = document.querySelector('#job-apply');
    if (!apply) return;
    apply.setAttribute('aria-busy', 'true');
    try {
      const { application } = await request(`/applications/job/${job.id}`, undefined, 'GET');
      apply.innerHTML = application ? applicationStatus(application) : readyToApply(job);
    } catch (error) {
      if (error.status === 401) {
        apply.innerHTML = `<a class="button button-wide" href="${escapeHtml(signInUrl('apply'))}">Sign in to apply</a><p>Your job search will be waiting when you return.</p>`;
      } else {
        apply.innerHTML = `${readyToApply(job)}<p class="application-check-warning" role="status">We couldn’t verify whether you already applied. Please check your applications before submitting again.</p>`;
      }
    } finally {
      apply.removeAttribute('aria-busy');
    }
  }

  async function submitApplication(button) {
    const apply = button.closest('#job-apply');
    const original = button.textContent;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.innerHTML = '<span class="button-spinner" aria-hidden="true"></span>Submitting…';
    try {
      const result = await request('/applications', { jobId: Number(button.dataset.applyJob) });
      apply.innerHTML = applicationStatus(result.application, true);
      apply.focus({ preventScroll: true });
    } catch (error) {
      if (error.status === 401) {
        location.assign(signInUrl('apply'));
        return;
      }
      if (error.status === 409) {
        try {
          const { application } = await request(`/applications/job/${button.dataset.applyJob}`, undefined, 'GET');
          if (application) {
            apply.innerHTML = applicationStatus(application);
            return;
          }
        } catch { /* The original safe error is shown below. */ }
      }
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.textContent = original;
      let notice = apply.querySelector('.notice');
      if (!notice) {
        notice = document.createElement('p');
        notice.className = 'notice notice-error application-error';
        notice.setAttribute('role', 'alert');
        apply.append(notice);
      }
      notice.textContent = error.message;
      notice.focus();
    }
  }

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
            <div class="job-apply" id="job-apply" tabindex="-1" aria-busy="true"><button class="button button-wide" type="button" disabled>Checking status…</button>
            <p>Checking your application status.</p></div>
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
      initializeApplication(job);
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

  surface.addEventListener('click', (event) => {
    const apply = event.target.closest('[data-apply-job]');
    if (apply) submitApplication(apply);
    else if (event.target.closest('[data-retry]')) loadDetail();
  });
  addEventListener('pagehide', () => controller?.abort());
  loadDetail();
}
