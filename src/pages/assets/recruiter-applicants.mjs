// Applicant review for a recruiter's posting: list applicants, move them through the
// pipeline, and confirm the two decisions that cannot be quietly taken back (offer, decline).
// Built with DOM methods and textContent only, so applicant-supplied text is never parsed as HTML.
const DECISIONS = {
  offered: { heading: 'Send a job offer?', confirm: 'Send offer', copy: (name, title) => `${name} will be offered the ${title} position and notified right away.` },
  rejected: { heading: 'Decline this application?', confirm: 'Decline application', copy: (name, title) => `${name}’s application for ${title} will be declined and they will be notified right away.` },
};

export function createApplicantsPanel({ document, request, formatDate, onUnauthorized = () => {} }) {
  const byId = (id) => document.getElementById(id);
  const dialog = byId('decision-dialog');
  let pending = null;
  let sending = false;

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = String(text);
    if (className) node.className = className;
    return node;
  }
  function accessError(error) {
    if (error.status === 401 || error.status === 403) onUnauthorized(error);
  }
  function summary(items, statuses) {
    if (!items.length) return 'No applications yet.';
    const counts = statuses
      .map(({ id, name }) => [name, items.filter((item) => item.status === id).length])
      .filter(([, count]) => count > 0)
      .map(([name, count]) => `${count} ${name.toLowerCase()}`);
    return `${items.length} ${items.length === 1 ? 'applicant' : 'applicants'} · ${counts.join(' · ')}`;
  }

  // One applicant row. `statuses` comes from the server so labels and order never drift.
  function renderApplicant(application, statuses, job, onChange) {
    const row = element('li', undefined, 'applicant');
    const main = element('div', undefined, 'applicant-main');
    main.append(
      element('strong', application.applicant.name),
      element('span', application.applicant.email),
      element('small', `Applied ${formatDate(application.appliedAt)}`),
    );
    const badge = element('span', application.statusLabel, `applicant-status applicant-status-${application.status}`);

    const actions = element('div', undefined, 'applicant-actions');
    const label = element('label', `Status for ${application.applicant.name}`, 'sr-only');
    const select = element('select');
    label.htmlFor = `applicant-status-${application.id}`;
    select.id = label.htmlFor;
    for (const { id, name } of statuses) {
      const option = element('option', name);
      option.value = id;
      select.append(option);
    }
    select.value = application.status;
    const save = element('button', 'Update status', 'button button-secondary');
    save.type = 'button';
    save.disabled = true;
    const feedback = element('p', undefined, 'applicant-feedback');
    feedback.setAttribute('role', 'status');
    select.addEventListener('change', () => {
      save.disabled = select.value === application.status;
      feedback.textContent = '';
    });

    async function send(status) {
      sending = true;
      save.disabled = true;
      select.disabled = true;
      feedback.textContent = 'Saving…';
      try {
        const result = await request(`/recruiter/applications/${application.id}/status`, { status }, 'PATCH');
        onChange(result.application, result.changed
          ? `Moved to ${result.application.statusLabel}. ${application.applicant.name} was notified.`
          : `Already ${result.application.statusLabel}.`);
      } catch (error) {
        accessError(error);
        select.disabled = false;
        save.disabled = select.value === application.status;
        feedback.textContent = error.message || 'We couldn’t update this application. Please try again.';
      } finally { sending = false; }
    }
    save.addEventListener('click', () => {
      if (sending || select.value === application.status) return;
      const status = select.value;
      if (DECISIONS[status]) {
        pending = { send: () => send(status), status, name: application.applicant.name, title: job.title, returnTo: save };
        byId('decision-heading').textContent = DECISIONS[status].heading;
        byId('decision-copy').textContent = DECISIONS[status].copy(application.applicant.name, job.title);
        byId('confirm-decision').textContent = DECISIONS[status].confirm;
        byId('decision-notice').hidden = true;
        dialog.showModal();
      } else send(status);
    });
    actions.append(label, select, save);
    row.append(main, badge, actions, feedback);
    return row;
  }

  // Wires an existing "Review applicants" button to an expandable panel inside the posting card.
  function attach(job, card, button) {
    let section = null;
    let loaded = false;
    button.setAttribute('aria-expanded', 'false');

    async function load() {
      section.replaceChildren(element('p', 'Loading applicants…', 'applicants-summary'));
      try {
        const { items, statuses } = await request(`/recruiter/jobs/${job.id}/applications`, undefined, 'GET');
        let current = items;
        const head = element('p', undefined, 'applicants-summary');
        head.setAttribute('role', 'status');
        const list = element('ul', undefined, 'applicant-list');
        const refresh = () => { head.textContent = summary(current, statuses); };
        // Replace only the row that changed, so the recruiter keeps their place and focus.
        function build(application, note = '') {
          const row = renderApplicant(application, statuses, job, (updated, message) => {
            current = current.map((item) => (item.id === updated.id ? updated : item));
            const next = build(updated, message);
            row.replaceWith(next);
            next.querySelector('select').focus();
            refresh();
          });
          row.querySelector('p').textContent = note;
          return row;
        }
        for (const application of current) list.append(build(application));
        refresh();
        section.replaceChildren(head, list);
        loaded = true;
      } catch (error) {
        accessError(error);
        loaded = false;
        section.replaceChildren(element('p', error.message || 'We couldn’t load the applicants. Close this panel and try again.', 'applicants-summary'));
      }
    }

    button.addEventListener('click', async () => {
      const opening = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(opening));
      if (!section) {
        section = element('section', undefined, 'applicants');
        section.setAttribute('aria-label', `Applicants for ${job.title}`);
        card.append(section);
      }
      section.hidden = !opening;
      if (opening && !loaded) await load();
    });
  }

  function closeDialog() {
    const returnTo = pending?.returnTo;
    pending = null;
    dialog.close();
    returnTo?.focus();
  }
  byId('cancel-decision').addEventListener('click', () => { if (!sending) closeDialog(); });
  byId('confirm-decision').addEventListener('click', async () => {
    if (!pending || sending) return;
    const { send } = pending;
    closeDialog();
    await send();
  });
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); if (!sending) closeDialog(); });

  return { attach };
}
