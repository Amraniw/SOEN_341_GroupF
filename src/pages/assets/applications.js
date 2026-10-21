import { request } from './api.js';
import { companyMark } from './job-shared.js';
import { escapeHtml, formatDateTime } from './ui.js';
import { session } from './workspace.js';

if (session) {
  const list = document.querySelector('#application-list');
  const status = document.querySelector('#applications-status');
  const total = document.querySelector('#application-total');
  const summary = document.querySelector('#application-summary');
  const filter = document.querySelector('#application-filter');
  const feedback = document.querySelector('#applications-feedback');
  let applications = [];
  let statuses = [];

  function statusBadge(application) {
    const className = application.status.replaceAll('_', '-');
    return `<span class="application-status status-${escapeHtml(className)}">${escapeHtml(application.statusLabel)}</span>`;
  }

  function timeline(application) {
    const path = ['applied', 'under_review', 'interview', 'offered'];
    if (application.status === 'rejected') {
      return `<div class="application-timeline application-timeline-rejected"><span class="timeline-dot is-complete"></span><span>Applied</span><span class="timeline-line"></span><span class="timeline-dot is-rejected"></span><strong>Rejected</strong></div>`;
    }
    const current = Math.max(0, path.indexOf(application.status));
    return `<div class="application-timeline" aria-label="Application progress">${path.map((stage, index) => `<span class="timeline-step ${index <= current ? 'is-complete' : ''} ${index === current ? 'is-current' : ''}"><i aria-hidden="true"></i><span>${escapeHtml(statuses.find(({ id }) => id === stage)?.name || stage)}</span></span>`).join('<span class="timeline-connector" aria-hidden="true"></span>')}</div>`;
  }

  function card(application) {
    return `<li class="application-card">
      <div class="application-card-top">${companyMark(application.job.company)}<div class="application-card-title"><p>${escapeHtml(application.job.company)}</p><h3>${escapeHtml(application.job.title)}</h3><span>${escapeHtml(application.job.location)}</span></div>${statusBadge(application)}</div>
      ${timeline(application)}
      <div class="application-card-footer"><span>Applied ${escapeHtml(formatDateTime(application.appliedAt))}</span><span>Updated ${escapeHtml(formatDateTime(application.updatedAt))}</span><a class="text-link" href="/workspace/jobs/${application.jobId}">View job →</a></div>
    </li>`;
  }

  function render() {
    const selected = filter.value;
    const visible = selected ? applications.filter(({ status: value }) => value === selected) : applications;
    total.textContent = String(applications.length);
    status.textContent = selected
      ? `${visible.length} ${visible.length === 1 ? 'application' : 'applications'} with this status`
      : `${applications.length} ${applications.length === 1 ? 'application' : 'applications'} total`;
    summary.innerHTML = statuses.map(({ id, name }) => `<button type="button" class="application-summary-item ${selected === id ? 'is-active' : ''}" data-status-filter="${escapeHtml(id)}"><strong>${applications.filter(({ status: value }) => value === id).length}</strong><span>${escapeHtml(name)}</span></button>`).join('');
    list.innerHTML = visible.map(card).join('');
    feedback.hidden = visible.length > 0;
    if (!visible.length) {
      feedback.innerHTML = applications.length
        ? '<div class="empty-state"><h3>No applications have this status.</h3><p>Choose another status to see the rest of your applications.</p><button class="button button-secondary" type="button" data-clear-application-filter>Show all applications</button></div>'
        : '<div class="empty-state"><h3>Your next opportunity starts here.</h3><p>When you apply for a job, it will appear here with its latest status.</p><a class="button" href="/workspace/jobs/">Explore jobs</a></div>';
    }
  }

  async function loadApplications() {
    list.setAttribute('aria-busy', 'true');
    feedback.hidden = true;
    status.textContent = 'Loading applications…';
    try {
      const result = await request('/applications', undefined, 'GET');
      applications = result.items;
      statuses = result.statuses;
      filter.innerHTML = '<option value="">All statuses</option>' + statuses.map(({ id, name }) => `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`).join('');
      render();
    } catch (error) {
      total.textContent = '—';
      status.textContent = 'Applications could not be loaded.';
      list.innerHTML = '';
      feedback.innerHTML = `<div class="empty-state" role="alert"><h3>We couldn’t load your applications.</h3><p>${escapeHtml(error.message)}</p><button class="button button-secondary" type="button" data-retry-applications>Try again</button></div>`;
      feedback.hidden = false;
    } finally {
      list.setAttribute('aria-busy', 'false');
    }
  }

  filter.addEventListener('change', render);
  document.addEventListener('click', (event) => {
    const summaryFilter = event.target.closest('[data-status-filter]');
    if (summaryFilter) {
      filter.value = filter.value === summaryFilter.dataset.statusFilter ? '' : summaryFilter.dataset.statusFilter;
      render();
    } else if (event.target.closest('[data-clear-application-filter]')) {
      filter.value = '';
      render();
    } else if (event.target.closest('[data-retry-applications]')) {
      loadApplications();
    }
  });

  loadApplications();
}
