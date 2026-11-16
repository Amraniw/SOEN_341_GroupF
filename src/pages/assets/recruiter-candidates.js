import { request } from './api.js';
import { escapeHtml } from './ui.js';

export function setupCandidateReview() {
  const id = new URLSearchParams(location.search).get('applicants');
  if (!id || !/^[1-9]\d*$/.test(id)) return;
  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.id = 'candidate-review';
  panel.innerHTML = `<h2 tabindex="-1">Review applicants</h2><form class="candidate-filters"><label>Status<select name="status"><option value="">All statuses</option></select></label><button class="button button-secondary">Filter applicants</button></form><p role="status" aria-live="polite"></p><div class="candidate-list"></div>`;
  document.querySelector('#postings').before(panel);
  const form = panel.querySelector('form');
  form.hidden = true;
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
    } catch (error) { if (current === generation) { list.innerHTML = ''; notice.textContent = `${error.message} Use Apply filters to retry.`; } }
    finally { if (current === generation) list.setAttribute('aria-busy', 'false'); }
  }
  form.addEventListener('submit', (event) => { event.preventDefault(); load(); });
  list.addEventListener('submit', async (event) => {
    event.preventDefault();
    const target = event.target;
    const button = target.querySelector('button');
    const status = target.querySelector('[role=status]');
    button.disabled = true;
    try { const result = await request(`/recruiter/jobs/${id}/applications/${target.dataset.application}/status`, { status: target.elements.status.value }, 'PATCH'); status.textContent = result.message; notice.textContent = 'Status saved. The candidate’s application history is updated; a notification is sent when the status changes.'; }
    catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });
  load();
}
