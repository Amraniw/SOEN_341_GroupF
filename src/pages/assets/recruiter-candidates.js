import { request } from './api.js';
import { escapeHtml } from './ui.js';

function mountCandidateReview(id, card) {
  if (!id || !/^[1-9]\d*$/.test(id)) return;
  const panel = document.createElement('section');
  panel.className = 'inline-candidate-review';
  panel.id = `candidate-review-${id}`;
  panel.innerHTML = `<h2 tabindex="-1">Review applicants</h2><form class="candidate-filters"><label>Status<select name="status"><option value="">All statuses</option></select></label><button class="button button-secondary">Filter applicants</button></form><p role="status" aria-live="polite"></p><div class="candidate-list"></div>`;
  card.append(panel);
  const form = panel.querySelector('form');
  const notice = panel.querySelector('[role=status]');
  const list = panel.querySelector('.candidate-list');
  let statuses = [];
  let generation = 0;
  async function load() {
    const current = ++generation;
    notice.textContent = 'Loading applicants…';
    list.setAttribute('aria-busy', 'true');
    try {
      const query = new URLSearchParams();
      for (const [key, value] of new FormData(form)) if (value) query.set(key, value);
      const data = await request(`/recruiter/jobs/${id}/applications?${query}`, undefined, 'GET');
      if (current !== generation) return;
      panel.querySelector('h2').textContent = `Applicants · ${data.job.title}`;
      statuses = data.statuses;
      if (form.elements.status.options.length === 1) for (const s of statuses) form.elements.status.add(new Option(s.name, s.id));
      notice.textContent = `${data.items.length} ${data.items.length === 1 ? 'applicant' : 'applicants'}`;
      list.innerHTML = data.items.map((a) => `<article class="candidate-card"><h3>${escapeHtml(a.name)}</h3><p>${escapeHtml(a.email)}</p>${a.hasResume ? `<details><summary>Review submitted resume</summary><iframe title="Submitted resume for ${escapeHtml(a.name)}" loading="lazy" src="/api/recruiter/jobs/${id}/applications/${a.id}/resume#toolbar=0&navpanes=0" class="candidate-resume"></iframe></details>` : '<p>No resume was attached when this application was submitted.</p>'}<form data-application="${a.id}"><label>Application status<select name="status">${statuses.map((s) => `<option value="${s.id}" ${s.id === a.status ? 'selected' : ''}>${s.name}</option>`).join('')}</select></label><button class="button button-secondary">Save status</button><p role="status" aria-live="polite"></p></form></article>`).join('') || '<p>No applicants match these filters.</p>';
    } catch (error) { if (current === generation) { list.innerHTML = ''; notice.textContent = `${error.message} Use Filter applicants to retry.`; } }
    finally { if (current === generation) list.setAttribute('aria-busy', 'false'); }
  }
  form.addEventListener('submit', (event) => { event.preventDefault(); load(); });
  list.addEventListener('submit', async (event) => {
    event.preventDefault();
    const target = event.target;
    const button = target.querySelector('button');
    const status = target.querySelector('[role=status]');
    button.disabled = true;
    try {
      const result = await request(`/recruiter/jobs/${id}/applications/${target.dataset.application}/status`, { status: target.elements.status.value }, 'PATCH');
      if (!target.isConnected) return;
      status.textContent = result.message;
      const selectedStatus = form.elements.status.value;
      if (selectedStatus && selectedStatus !== result.status) await load();
      else notice.textContent = 'Status saved. The candidate’s application history is updated; a notification is sent when the status changes.';
    }
    catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });
  load();
}

export function setupCandidateReview() {
  const postings = document.querySelector('#posting-list');
  if (!postings) return;
  function expand(link) {
    const id = new URL(link.href, location.href).searchParams.get('applicants');
    const card = link.closest('.recruiter-card');
    if (!card || !/^[1-9]\d*$/.test(id || '')) return;
    let panel = card.querySelector('.inline-candidate-review');
    if (!panel) { mountCandidateReview(id, card); panel = card.querySelector('.inline-candidate-review'); }
    else panel.hidden = !panel.hidden;
    link.setAttribute('aria-expanded', String(!panel.hidden));
    link.setAttribute('aria-controls', panel.id);
    link.textContent = panel.hidden ? 'Review applicants' : 'Hide applicants';
  }
  postings.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-review-applicants]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    expand(link);
  });
  const requested = new URLSearchParams(location.search).get('applicants');
  if (!requested) return;
  function openRequested() {
    const link = [...postings.querySelectorAll('a[data-review-applicants]')].find((item) => new URL(item.href, location.href).searchParams.get('applicants') === requested);
    if (!link) return false;
    expand(link);
    link.closest('.recruiter-card').scrollIntoView({ block: 'start' });
    return true;
  }
  if (!openRequested()) {
    const observer = new MutationObserver(() => { if (openRequested()) observer.disconnect(); });
    observer.observe(postings, { childList: true });
  }
}
