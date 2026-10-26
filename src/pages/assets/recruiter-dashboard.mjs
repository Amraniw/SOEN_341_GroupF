import { FIELDS, LISTS, postingDraft, postingPayload } from './recruiter-form.mjs';

export function createRecruiterDashboard({ document, request, formatDate, onUnauthorized = () => {} }) {
  const byId = (id) => document.getElementById(id);
  const form = byId('posting-form');
  const fieldset = byId('editor-fields');
  const editor = byId('posting-editor');
  const list = byId('posting-list');
  const dialog = byId('delete-dialog');
  const controls = {};
  const listEditors = {};
  let original = null;
  let deletion = null;
  let busy = false;
  let loading = false;
  let generation = 0;

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = String(text);
    if (className) node.className = className;
    return node;
  }
  function notice(node, text, error = false) {
    node.textContent = text;
    node.hidden = false;
    node.className = `notice notice-${error ? 'error' : 'success'}`;
    node.setAttribute('role', error ? 'alert' : 'status');
  }
  function accessError(error) {
    if (error.status === 401 || error.status === 403) onUnauthorized(error);
  }
  function setBusy(value) {
    busy = value;
    fieldset.disabled = value;
    form.setAttribute('aria-busy', String(value));
    for (const id of ['save-posting', 'cancel-edit', 'new-posting', 'confirm-delete', 'cancel-delete']) byId(id).disabled = value;
    byId('posting-retry').disabled = value || loading;
    for (const button of list.querySelectorAll('[data-management]')) {
      button.disabled = value || button.getAttribute('data-has-applications') === 'true';
    }
  }
  function action(text, handler, className = 'button button-secondary') {
    const button = element('button', text, className);
    button.type = 'button';
    button.addEventListener('click', handler);
    return button;
  }

  const optional = element('details', undefined, 'recruiter-details');
  optional.append(element('summary', 'Optional job sections'));
  const help = element('p', 'Add a structured overview when using these sections. Add or remove list entries below. Leave all sections blank to use the plain description.');
  help.id = 'structured-help';
  optional.append(help);
  const optionalBody = element('div', undefined, 'recruiter-details-body');
  optional.append(optionalBody);
  for (const [key, labelText, spec] of FIELDS) {
    const wrapper = element('div', undefined, `recruiter-field${['description', 'overview', 'companyDescription'].includes(key) ? ' recruiter-field-wide' : ''}`);
    const required = ['title', 'company', 'location', 'category', 'description'].includes(key);
    const label = element('label', `${labelText}${required ? ' *' : ''}`);
    label.htmlFor = `posting-${key}`;
    let input;
    if (Array.isArray(spec)) {
      input = element('select');
      const placeholder = element('option', required ? 'Choose a category' : 'Not specified');
      placeholder.value = '';
      input.append(placeholder);
      for (const value of spec) {
        const [id, text] = Array.isArray(value) ? value : [value, value];
        const option = element('option', text);
        option.value = id;
        input.append(option);
      }
    } else {
      input = element(['description', 'overview', 'companyDescription'].includes(key) ? 'textarea' : 'input');
      input.maxLength = spec;
      if (input.tagName === 'TEXTAREA') input.rows = key === 'description' ? 6 : 4;
      else input.type = 'text';
    }
    input.id = `posting-${key}`;
    input.name = key;
    input.required = required;
    input.addEventListener('input', () => input.removeAttribute('aria-invalid'));
    controls[key] = input;
    wrapper.append(label, input);
    if (['overview', 'companyDescription'].includes(key)) {
      input.setAttribute('aria-describedby', 'structured-help');
      optionalBody.append(wrapper);
    } else fieldset.append(wrapper);
  }
  function addEntry(key, value = '', focus = true) {
    const { rows, add, label } = listEditors[key];
    if (rows.children.length >= 20) return;
    const row = element('div', undefined, 'recruiter-list-row');
    const inputLabel = element('label');
    const number = element('span');
    const input = element('textarea');
    input.value = value;
    input.rows = 2;
    input.maxLength = 1000;
    inputLabel.append(number, input);
    const renumber = () => {
      [...rows.children].forEach((item, index) => { item.querySelector('span').textContent = `Entry ${index + 1}`; });
      add.disabled = rows.children.length >= 20;
    };
    const remove = action('Remove', () => { row.remove(); renumber(); add.focus(); });
    remove.setAttribute('aria-label', `Remove ${label.toLowerCase()} entry`);
    row.append(inputLabel, remove);
    rows.append(row);
    renumber();
    if (focus) input.focus();
  }
  for (const [key, label] of Object.entries(LISTS)) {
    const group = element('fieldset', undefined, 'recruiter-list-editor');
    group.append(element('legend', label));
    const rows = element('div', undefined, 'recruiter-list-rows');
    rows.id = `posting-${key}`;
    const add = action('Add entry', () => addEntry(key));
    add.setAttribute('aria-label', `Add ${label.toLowerCase()} entry`);
    listEditors[key] = { rows, add, label };
    group.append(rows, add);
    optionalBody.append(group);
  }
  fieldset.append(optional);

  function populate(job) {
    const draft = postingDraft(job);
    for (const [key, input] of Object.entries(controls)) {
      input.value = draft[key];
      input.removeAttribute('aria-invalid');
    }
    for (const key of Object.keys(LISTS)) {
      listEditors[key].rows.replaceChildren();
      listEditors[key].add.disabled = false;
      draft[key].forEach((value) => addEntry(key, value, false));
    }
    optional.open = Boolean(job?.details);
    editor.hidden = false;
    byId('form-notice').hidden = true;
    byId('editor-heading').textContent = job ? 'Edit posting' : 'Create posting';
    byId('save-posting').textContent = job ? 'Save changes' : 'Create posting';
    controls.title.focus();
  }
  function newPosting() {
    if (busy) return;
    original = null;
    populate(null);
  }
  function cancelEdit() {
    if (busy) return;
    editor.hidden = true;
    original = null;
    byId('new-posting').focus();
  }
  async function edit(id) {
    if (busy) return;
    setBusy(true);
    notice(byId('mutation-notice'), 'Loading posting…');
    try {
      const result = await request(`/recruiter/jobs/${id}`, undefined, 'GET');
      if (!result.job || result.job.id !== id) throw new Error('This posting could not be loaded. Please refresh and try again.');
      original = result.job;
      populate(original);
      byId('mutation-notice').hidden = true;
    } catch (error) {
      accessError(error);
      notice(byId('mutation-notice'), error.message, true);
    } finally { setBusy(false); }
    if (!editor.hidden) controls.title.focus();
  }

  function renderPostings(items) {
    if (!Array.isArray(items) || items.some((job) => !Number.isSafeInteger(job.id) || job.id < 1 || !['open', 'closed'].includes(job.status))) {
      throw new Error('The postings response was incomplete. Refresh to try again.');
    }
    list.replaceChildren();
    byId('posting-state').textContent = `${items.length} ${items.length === 1 ? 'posting' : 'postings'}`;
    if (!items.length) {
      const empty = element('li', undefined, 'recruiter-empty');
      empty.append(element('h3', 'Your next opportunity starts here.'), element('p', 'You have no job postings yet. Create your first posting to get started.'), action('Create first posting', newPosting, 'button'));
      list.append(empty);
    }
    for (const job of items) {
      const item = element('li');
      const card = element('article', undefined, 'panel recruiter-card');
      const top = element('div', undefined, 'recruiter-card-top');
      const identity = element('div');
      identity.append(element('h3', job.title), element('p', `${job.company} · ${job.location}`));
      top.append(identity, element('span', job.status === 'open' ? 'Open' : 'Closed', `recruiter-status${job.status === 'closed' ? ' recruiter-status-closed' : ''}`));
      const facts = element('div', undefined, 'recruiter-facts');
      facts.append(element('span', job.categoryName), element('span', `Created ${formatDate(job.createdAt)}`), element('span', `${job.applicationCount} ${job.applicationCount === 1 ? 'application' : 'applications'}`));
      const actions = element('div', undefined, 'recruiter-actions');
      const editButton = action('Edit', () => edit(job.id));
      editButton.setAttribute('aria-label', `Edit ${job.title}`);
      const lifecycle = action(job.status === 'open' ? 'Close posting' : 'Reopen posting', () => changeStatus(job));
      const remove = action('Delete', () => askDelete(job), 'button recruiter-danger');
      remove.disabled = job.applicationCount > 0;
      remove.setAttribute('data-has-applications', String(job.applicationCount > 0));
      remove.setAttribute('aria-label', `Delete ${job.title}`);
      for (const button of [editButton, lifecycle, remove]) button.setAttribute('data-management', '');
      actions.append(editButton, lifecycle, remove);
      if (job.status === 'open') {
        const view = element('a', 'View public posting', 'text-link');
        view.href = `/jobs/${job.id}`;
        actions.append(view);
      }
      card.append(top, facts, actions);
      if (job.applicationCount > 0) card.append(element('p', 'This posting has applications. Close it to preserve their records.'));
      item.append(card);
      list.append(item);
    }
  }

  async function load() {
    const version = ++generation;
    loading = true;
    byId('posting-retry').disabled = true;
    byId('recruiter-overview').setAttribute('aria-busy', 'true');
    list.setAttribute('aria-busy', 'true');
    byId('overview-state').textContent = 'Loading your overview…';
    byId('posting-state').textContent = 'Loading postings…';
    const current = () => version === generation;
    // Catch each resource separately: one unavailable endpoint does not hide the
    // other, and refresh errors cannot turn a successful save into a failed save.
    await Promise.all([
      request('/recruiter/overview', undefined, 'GET').then(({ overview }) => {
        if (!current()) return;
        const values = { total: overview?.totalPostings, open: overview?.openPostings, closed: overview?.closedPostings, applications: overview?.totalApplications };
        if (Object.values(values).some((value) => !Number.isSafeInteger(value) || value < 0)) throw new Error('The overview response was incomplete. Refresh to try again.');
        for (const [key, value] of Object.entries(values)) byId(`stat-${key}`).textContent = String(value);
        byId('overview-state').textContent = 'Your posting activity, up to date.';
        byId('overview-state').setAttribute('role', 'status');
      }).catch((error) => {
        if (!current()) return;
        accessError(error);
        for (const key of ['total', 'open', 'closed', 'applications']) byId(`stat-${key}`).textContent = '—';
        byId('overview-state').textContent = `Overview unavailable. ${error.message} Use Refresh dashboard to retry.`;
        byId('overview-state').setAttribute('role', 'alert');
      }),
      request('/recruiter/jobs', undefined, 'GET').then((result) => {
        if (!current()) return;
        renderPostings(result.items);
        byId('posting-state').setAttribute('role', 'status');
      }).catch((error) => {
        if (!current()) return;
        accessError(error);
        list.replaceChildren();
        byId('posting-state').textContent = `Postings unavailable. ${error.message} Use Refresh dashboard to retry.`;
        byId('posting-state').setAttribute('role', 'alert');
      }),
    ]);
    if (current()) {
      loading = false;
      byId('recruiter-overview').setAttribute('aria-busy', 'false');
      list.setAttribute('aria-busy', 'false');
      byId('posting-retry').disabled = busy;
    }
  }

  async function submit() {
    if (busy) return;
    const draft = Object.fromEntries(Object.entries(controls).map(([key, input]) => [key, input.value]));
    for (const key of Object.keys(LISTS)) draft[key] = [...listEditors[key].rows.querySelectorAll('textarea')].map((input) => input.value);
    const { payload, error, field } = postingPayload(draft, original);
    if (error) {
      notice(byId('form-notice'), error, true);
      const input = controls[field] || listEditors[field]?.rows.querySelector('textarea');
      if (input) { input.setAttribute('aria-invalid', 'true'); input.focus(); }
      return;
    }
    if (!Object.keys(payload).length) { notice(byId('form-notice'), 'No changes to save.'); return; }
    setBusy(true);
    byId('form-notice').hidden = true;
    byId('save-posting').textContent = 'Saving…';
    try {
      await request(original ? `/recruiter/jobs/${original.id}` : '/recruiter/jobs', payload, original ? 'PATCH' : 'POST');
      notice(byId('mutation-notice'), original ? 'Posting updated successfully.' : 'Posting created successfully.');
      editor.hidden = true;
      original = null;
      await load();
      byId('postings-heading').focus();
    } catch (error) {
      accessError(error);
      notice(byId('form-notice'), error.message, true);
      byId('form-notice').focus();
    } finally {
      setBusy(false);
      byId('save-posting').textContent = original ? 'Save changes' : 'Create posting';
    }
  }
  async function changeStatus(job) {
    if (busy) return;
    setBusy(true);
    try {
      const status = job.status === 'open' ? 'closed' : 'open';
      await request(`/recruiter/jobs/${job.id}/status`, { status }, 'PATCH');
      notice(byId('mutation-notice'), status === 'closed' ? 'Posting closed. Existing applications are preserved.' : 'Posting reopened and available to job seekers.');
      await load();
    } catch (error) { accessError(error); notice(byId('mutation-notice'), error.message, true); }
    finally { setBusy(false); }
  }
  function askDelete(job) {
    if (busy) return;
    if (job.applicationCount > 0) { notice(byId('mutation-notice'), 'Postings with applications must be closed instead of deleted.', true); return; }
    deletion = job;
    byId('delete-copy').textContent = `You are deleting “${job.title}”.`;
    byId('delete-notice').hidden = true;
    dialog.showModal();
  }
  function cancelDelete() {
    if (busy) return;
    deletion = null;
    dialog.close();
  }
  async function confirmDelete() {
    if (busy || !deletion) return;
    setBusy(true);
    try {
      await request(`/recruiter/jobs/${deletion.id}`, undefined, 'DELETE');
      if (original?.id === deletion.id) { original = null; editor.hidden = true; }
      deletion = null;
      dialog.close();
      notice(byId('mutation-notice'), 'Posting permanently deleted.');
      await load();
      byId('postings-heading').focus();
    } catch (error) {
      accessError(error);
      if (error.status === 409) {
        deletion = null;
        dialog.close();
        notice(byId('mutation-notice'), 'This posting now has applications and cannot be deleted. Close it instead.', true);
        await load();
        byId('mutation-notice').focus();
      } else { notice(byId('delete-notice'), error.message, true); byId('delete-notice').focus(); }
    } finally { setBusy(false); }
  }

  byId('new-posting').addEventListener('click', newPosting);
  byId('cancel-edit').addEventListener('click', cancelEdit);
  byId('posting-retry').addEventListener('click', load);
  byId('cancel-delete').addEventListener('click', cancelDelete);
  byId('confirm-delete').addEventListener('click', confirmDelete);
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); cancelDelete(); });
  form.addEventListener('submit', (event) => { event.preventDefault(); return submit(); });
  return { load, edit, submit, changeStatus, newPosting, cancelEdit, askDelete, cancelDelete, confirmDelete };
}
