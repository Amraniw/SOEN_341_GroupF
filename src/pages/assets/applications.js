import { request } from './api.js';
import { companyMark } from './job-shared.js';
import { escapeHtml, formatDate, formatDateTime } from './ui.js';
import { session } from './workspace.js';
import { renderActivity, renderHistory } from './application-visuals.mjs';

if (session) {
  const list = document.querySelector('#application-list');
  const status = document.querySelector('#applications-status');
  const summary = document.querySelector('#application-summary');
  const filter = document.querySelector('#application-filter');
  const feedback = document.querySelector('#applications-feedback');
  let applications = [];
  let statuses = [];
  let loadGeneration = 0;
  const expandedApplications = new Set();
  const analytics = document.createElement('section');
  analytics.className = 'application-analytics';
  analytics.setAttribute('aria-label', 'Application analytics');
  analytics.innerHTML = `<div class="applications-toolbar"><div><h2>At a glance</h2><p>Applications submitted in your selected period.</p></div><div class="analytics-controls"><label class="application-filter">Submitted within<select id="analytics-range"><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option></select></label><button type="button" class="button button-secondary" id="analytics-refresh">Refresh</button></div></div><div id="analytics-content" aria-live="polite"></div>`;
  document.querySelector('.application-overview').prepend(analytics);
  const range = analytics.querySelector('#analytics-range');
  const insights = analytics.querySelector('#analytics-content');
  // Accept/decline state: which offer is awaiting confirmation, and any error to show.
  let offerConfirm = null;
  let offerBusy = false;
  const offerErrors = {};

  function statusBadge(application) {
    const className = application.status.replaceAll('_', '-');
    return `<span class="application-status status-${escapeHtml(className)}">${escapeHtml(application.statusLabel)}</span>`;
  }

  // The accept/decline area on an application that has an offer. Both answers are
  // final, so each asks for a confirmation first.
  function offerPanel(application) {
    if (application.quitAt) {
      return `<div class="offer-panel is-declined" role="status"><strong>You left this job</strong><p>You left this position on ${escapeHtml(formatDateTime(application.quitAt))}. You can apply for it again from the job page.</p></div>`;
    }
    if (application.offerResponse === 'accepted') {
      return '<div class="offer-panel is-accepted" role="status"><strong>Offer accepted</strong><p>Congratulations! Your profile now shows you as employed.</p></div>';
    }
    if (application.offerResponse === 'declined') {
      return `<div class="offer-panel is-declined" role="status"><strong>Offer declined</strong><p>You turned down this offer on ${escapeHtml(formatDateTime(application.offerRespondedAt))}.</p></div>`;
    }
    if (application.status !== 'offered') return '';

    const error = offerErrors[application.id]
      ? `<p class="offer-error" role="alert">${escapeHtml(offerErrors[application.id])}</p>`
      : '';
    if (offerConfirm?.id === application.id) {
      const accepting = offerConfirm.response === 'accepted';
      return `<div class="offer-panel" role="group" aria-label="Confirm your response">
        <strong>${accepting ? 'Accept this offer?' : 'Decline this offer?'}</strong>
        <p>${accepting ? 'Your profile will be marked as employed. This can’t be undone.' : 'This can’t be undone.'}</p>${error}
        <div class="offer-actions">
          <button class="button" type="button" data-offer-confirm ${offerBusy ? 'disabled aria-busy="true"' : ''}>${accepting ? 'Yes, accept offer' : 'Yes, decline offer'}</button>
          <button class="button button-secondary" type="button" data-offer-cancel ${offerBusy ? 'disabled' : ''}>Cancel</button>
        </div>
      </div>`;
    }
    return `<div class="offer-panel" role="group" aria-label="Respond to your offer">
      <strong>You have an offer</strong>
      <p>Accept it to take the job, or decline to pass.</p>${error}
      <div class="offer-actions">
        <button class="button" type="button" data-offer-choice="accepted" data-application-id="${application.id}">Accept offer</button>
        <button class="button button-secondary" type="button" data-offer-choice="declined" data-application-id="${application.id}">Decline offer</button>
      </div>
    </div>`;
  }

  function card(application) {
    const description = (application.job.summary || '').replace(/\s+/g, ' ').trim();
    const expanded = expandedApplications.has(String(application.id));
    return `<li class="application-card" data-application="${application.id}">
      <div class="application-row">
        <button class="application-toggle" type="button" data-toggle-application="${application.id}" aria-expanded="${expanded}" aria-controls="application-details-${application.id}" aria-label="${escapeHtml(application.job.title)} at ${escapeHtml(application.job.company)}">
          ${companyMark(application.job.company)}
          <span class="application-card-title"><strong class="application-role">${escapeHtml(application.job.title)}</strong><span class="application-title-meta"><span class="application-company">${escapeHtml(application.job.company)}<span class="application-location">${escapeHtml(application.job.location)}</span></span><span class="application-source" title="${application.job.isDemo ? 'Educational demo posting' : 'User-created posting'}">${application.job.isDemo ? 'Demo' : 'User application'}</span><span class="application-date" title="${escapeHtml(formatDateTime(application.appliedAt))}">Applied ${escapeHtml(formatDate(application.appliedAt))}</span></span></span>
          ${statusBadge(application)}<span class="application-expand-icon" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m4 6 4 4 4-4"/></svg></span>
        </button>
        <a class="text-link application-job-link" href="/workspace/jobs/${application.jobId}">View job <span aria-hidden="true">↗</span></a>
      </div>
      <div class="application-panel ${expanded ? 'is-expanded' : ''}" id="application-details-${application.id}" aria-hidden="${!expanded}" ${expanded ? '' : 'inert'}>
        <div class="application-panel-inner"><div class="application-panel-content">
          ${description ? `<p class="application-description">${escapeHtml(description)}</p>` : ''}
          <div class="application-journey">${renderHistory(application.history || [], escapeHtml, formatDateTime)}</div>
          ${offerPanel(application)}
        </div></div>
      </div>
    </li>`;
  }

  function render() {
    const selected = filter.value;
    const visible = selected ? applications.filter(({ status: value }) => value === selected) : applications;
    status.textContent = selected
      ? `${visible.length} ${visible.length === 1 ? 'application' : 'applications'} with this status`
      : `${applications.length} ${applications.length === 1 ? 'application' : 'applications'} total`;
    summary.innerHTML = statuses.map(({ id, name }) => `<button type="button" class="application-summary-item ${selected === id ? 'is-active' : ''}" aria-pressed="${selected === id}" data-status-filter="${escapeHtml(id)}"><strong>${applications.filter(({ status: value }) => value === id).length}</strong><span>${escapeHtml(name)}</span></button>`).join('');
    list.innerHTML = visible.map(card).join('');
    feedback.hidden = visible.length > 0;
    if (!visible.length) {
      feedback.innerHTML = applications.length
        ? '<div class="empty-state"><h3>No applications have this status.</h3><p>Choose another status to see the rest of your applications.</p><button class="button button-secondary" type="button" data-clear-application-filter>Show all applications</button></div>'
        : '<div class="empty-state"><h3>Your next opportunity starts here.</h3><p>When you apply for a job, it will appear here with its latest status.</p><a class="button" href="/workspace/jobs/">Explore jobs</a></div>';
    }
  }

  async function submitOffer() {
    if (!offerConfirm || offerBusy) return;
    const { id, response } = offerConfirm;
    offerBusy = true;
    delete offerErrors[id];
    render();
    try {
      const result = await request(`/applications/${id}/offer`, { response }, 'PATCH');
      applications = applications.map((application) => (application.id === id ? { ...result.application, history: application.history } : application));
      offerConfirm = null;
    } catch (error) {
      offerErrors[id] = error.message;
    } finally {
      offerBusy = false;
      render();
      (list.querySelector(`[data-application="${id}"] [data-offer-confirm], [data-application="${id}"] [data-offer-choice]`) || list.querySelector(`[data-toggle-application="${id}"]`))?.focus();
    }
  }

  async function loadApplications() {
    const generation = ++loadGeneration;
    list.setAttribute('aria-busy', 'true');
    feedback.hidden = true;
    status.textContent = 'Loading applications…';
    try {
      insights.textContent = 'Loading insights…';
      const [result, yearly] = await Promise.all([
        request(`/applications/analytics?range=${range.value}`, undefined, 'GET'),
        request('/applications', undefined, 'GET'),
      ]);
      if (generation !== loadGeneration) return;
      applications = result.items;
      statuses = result.statuses;
      const selectedStatus = filter.value;
      insights.innerHTML = `<div class="analytics-metrics"><div><strong>${result.total}</strong><span>Submitted</span></div><div><strong>${result.active}</strong><span>Active applications</span></div><div><strong>${result.statuses.find((s) => s.id === "offered")?.count || 0}</strong><span>Offers</span></div></div>${renderActivity(yearly.items, "all", escapeHtml)}`;
      filter.innerHTML = '<option value="">All statuses</option>' + statuses.map(({ id, name }) => `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`).join('');
      filter.value = statuses.some(({ id }) => id === selectedStatus) ? selectedStatus : "";
      render();
    } catch (error) {
      if (generation !== loadGeneration) return;
      insights.textContent = 'Insights are unavailable. Use Try again below.';
      status.textContent = 'Applications could not be loaded.';
      list.innerHTML = '';
      feedback.innerHTML = `<div class="empty-state" role="alert"><h3>We couldn’t load your applications.</h3><p>${escapeHtml(error.message)}</p><button class="button button-secondary" type="button" data-retry-applications>Try again</button></div>`;
      feedback.hidden = false;
    } finally {
      if (generation === loadGeneration) list.setAttribute('aria-busy', 'false');
    }
  }

  list.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-toggle-application]');
    if (!toggle) return;
    const id = toggle.dataset.toggleApplication;
    const expanded = !expandedApplications.has(id);
    if (expanded) expandedApplications.add(id);
    else expandedApplications.delete(id);
    toggle.setAttribute('aria-expanded', String(expanded));
    const panel = document.getElementById(toggle.getAttribute('aria-controls'));
    panel.classList.toggle('is-expanded', expanded);
    panel.setAttribute('aria-hidden', String(!expanded));
    panel.inert = !expanded;
  });

  filter.addEventListener('change', render);
  range.addEventListener('change', loadApplications);
  analytics.querySelector('#analytics-refresh').addEventListener('click', loadApplications);
  const tooltip = document.createElement('div');
  tooltip.id = 'activity-tooltip';
  tooltip.className = 'activity-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  document.body.append(tooltip);
  let tooltipDay = null;
  function hideTooltip() {
    tooltipDay?.removeAttribute('aria-describedby');
    tooltipDay = null;
    tooltip.hidden = true;
  }
  function showTooltip(day) {
    hideTooltip();
    tooltipDay = day;
    tooltip.textContent = day.dataset.dayLabel;
    tooltip.hidden = false;
    day.setAttribute('aria-describedby', tooltip.id);
    const rect = day.getBoundingClientRect();
    const width = tooltip.offsetWidth;
    const height = tooltip.offsetHeight;
    tooltip.style.left = `${Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, document.documentElement.clientWidth - width - 8))}px`;
    tooltip.style.top = `${rect.top > height + 12 ? rect.top - height - 8 : rect.bottom + 8}px`;
  }
  analytics.addEventListener('pointerover', (event) => { const day = event.target.closest('[data-day-label]'); if (day) showTooltip(day); });
  analytics.addEventListener('pointerout', (event) => { if (event.target.closest('[data-day-label]')) hideTooltip(); });
  analytics.addEventListener('focusin', (event) => { const day = event.target.closest('[data-day-label]'); if (day) showTooltip(day); });
  analytics.addEventListener('focusout', hideTooltip);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') hideTooltip(); });
  window.addEventListener('scroll', hideTooltip, true);
  window.addEventListener('resize', hideTooltip);
  range.addEventListener('change', hideTooltip);
  analytics.querySelector('#analytics-refresh').addEventListener('click', hideTooltip);
  document.addEventListener('click', (event) => {
    const day = event.target.closest('[data-day-label]');
    if (day) analytics.querySelector('.calendar-selection').textContent = day.dataset.dayLabel;
    const summaryFilter = event.target.closest('[data-status-filter]');
    if (summaryFilter) {
      filter.value = filter.value === summaryFilter.dataset.statusFilter ? '' : summaryFilter.dataset.statusFilter;
      render();
      summary.querySelector(`[data-status-filter="${summaryFilter.dataset.statusFilter}"]`)?.focus();
    } else if (event.target.closest('[data-clear-application-filter]')) {
      filter.value = '';
      render();
    } else if (event.target.closest('[data-retry-applications]')) {
      loadApplications();
    } else if (event.target.closest('[data-offer-choice]')) {
      const choice = event.target.closest('[data-offer-choice]');
      const id = Number(choice.dataset.applicationId);
      offerConfirm = { id, response: choice.dataset.offerChoice };
      delete offerErrors[id];
      render();
      list.querySelector(`[data-application="${id}"] [data-offer-confirm]`)?.focus();
    } else if (event.target.closest('[data-offer-cancel]')) {
      const id = offerConfirm?.id;
      offerConfirm = null;
      if (id !== undefined) delete offerErrors[id];
      render();
      list.querySelector(`[data-application="${id}"] [data-offer-choice]`)?.focus();
    } else if (event.target.closest('[data-offer-confirm]')) {
      submitOffer();
    }
  });

  loadApplications();
}
