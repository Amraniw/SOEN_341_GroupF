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
  // Accept/decline state: which offer is awaiting confirmation, and any error to show.
  let offerConfirm = null;
  let offerBusy = false;
  const offerErrors = {};

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

  // The accept/decline area on an application that has an offer. Both answers are
  // final, so each asks for a confirmation first.
  function offerPanel(application) {
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
    return `<li class="application-card">
      <div class="application-card-top">${companyMark(application.job.company)}<div class="application-card-title"><p>${escapeHtml(application.job.company)}</p><h3>${escapeHtml(application.job.title)}</h3><span>${escapeHtml(application.job.location)}</span></div>${statusBadge(application)}</div>
      ${timeline(application)}
      ${offerPanel(application)}
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

  async function submitOffer() {
    if (!offerConfirm || offerBusy) return;
    const { id, response } = offerConfirm;
    offerBusy = true;
    delete offerErrors[id];
    render();
    try {
      const result = await request(`/applications/${id}/offer`, { response }, 'PATCH');
      applications = applications.map((application) => (application.id === id ? result.application : application));
      offerConfirm = null;
    } catch (error) {
      offerErrors[id] = error.message;
    } finally {
      offerBusy = false;
      render();
      list.querySelector('[data-offer-confirm], [data-offer-choice]')?.focus();
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
    } else if (event.target.closest('[data-offer-choice]')) {
      const choice = event.target.closest('[data-offer-choice]');
      const id = Number(choice.dataset.applicationId);
      offerConfirm = { id, response: choice.dataset.offerChoice };
      delete offerErrors[id];
      render();
      list.querySelector('[data-offer-confirm]')?.focus();
    } else if (event.target.closest('[data-offer-cancel]')) {
      const id = offerConfirm?.id;
      offerConfirm = null;
      if (id !== undefined) delete offerErrors[id];
      render();
      list.querySelector('[data-offer-choice]')?.focus();
    } else if (event.target.closest('[data-offer-confirm]')) {
      submitOffer();
    }
  });

  loadApplications();
}
