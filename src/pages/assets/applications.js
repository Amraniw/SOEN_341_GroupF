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
  const analytics = document.createElement('section');
  analytics.className = 'application-analytics';
  analytics.setAttribute('aria-label', 'Application analytics');
  analytics.innerHTML = `<div class="applications-toolbar"><div><p class="eyebrow">YOUR SEARCH, IN PERSPECTIVE</p><h2>Application insights</h2></div><label class="application-filter">Submitted within<select id="analytics-range"><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option></select></label><button type="button" class="button button-secondary" id="analytics-refresh">Refresh</button></div><p>Submission metrics and the list below follow this range. Recent activity shows status events in the same period. Dates use UTC.</p><div id="analytics-content" aria-live="polite"></div>`;
  document.querySelector('.application-overview').before(analytics);
  const range = analytics.querySelector('#analytics-range');
  const insights = analytics.querySelector('#analytics-content');

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
      <details data-history="${application.id}"><summary>View status history</summary><div class="actual-history"></div></details>
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
      insights.textContent = 'Loading insights…';
      const result = await request(`/applications/analytics?range=${range.value}`, undefined, 'GET');
      applications = result.items;
      statuses = result.statuses;
      const peak = Math.max(1, ...result.activity.map((item) => item.count));
      insights.innerHTML = `<div class="analytics-metrics"><div><strong>${result.total}</strong><span>Submitted in range</span></div><div><strong>${result.active}</strong><span>Currently active</span></div><div><strong>${result.statuses.find((s) => s.id === 'offered').count}</strong><span>Offers</span></div></div><div class="analytics-grid"><section><h3>Current status breakdown</h3><p>Current outcomes of applications submitted in this range.</p>${result.statuses.map((s) => `<div class="analytics-bar"><span>${escapeHtml(s.name)}</span><meter min="0" max="${Math.max(1, result.total)}" value="${s.count}" aria-label="${escapeHtml(s.name)}"></meter><strong>${s.count}</strong></div>`).join('')}</section><section><h3>Applications over time</h3><p>Monthly submission totals within the selected range.</p>${result.activity.length ? result.activity.map((a) => `<div class="analytics-bar"><span>${escapeHtml(a.month)}</span><meter min="0" max="${peak}" value="${a.count}" aria-label="Applications in ${escapeHtml(a.month)}"></meter><strong>${a.count}</strong></div>`).join('') : '<p>No submissions in this period.</p>'}</section></div><section><h3>Recent activity</h3><p>Latest 100 recorded status events in this period.</p><ol class="analytics-history">${result.history.map((h) => `<li><strong>${escapeHtml(h.title)}</strong> · ${escapeHtml(h.company)}<br>${escapeHtml(h.statusLabel)} · ${escapeHtml(formatDateTime(h.changedAt))}</li>`).join('') || '<li>No status activity in this period.</li>'}</ol></section>`;
      filter.innerHTML = '<option value="">All statuses</option>' + statuses.map(({ id, name }) => `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`).join('');
      render();
    } catch (error) {
      insights.textContent = 'Insights are unavailable. Use Try again below.';
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
  range.addEventListener('change', loadApplications);
  analytics.querySelector('#analytics-refresh').addEventListener('click', loadApplications);
  list.addEventListener('toggle', async (event) => {
    const detail = event.target.closest('details[data-history]');
    if (!detail?.open || detail.dataset.loaded) return;
    const target = detail.querySelector('.actual-history');
    target.textContent = 'Loading history…';
    try {
      const result = await request(`/applications/${detail.dataset.history}`, undefined, 'GET');
      target.innerHTML = `<ol>${result.application.history.map((h) => `<li>${escapeHtml(h.statusLabel)} · ${escapeHtml(formatDateTime(h.changedAt))}</li>`).join('')}</ol>`;
      detail.dataset.loaded = 'true';
    } catch { target.textContent = 'History could not be loaded. Close and reopen to retry.'; }
  }, true);
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
