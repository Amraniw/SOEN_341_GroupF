import { session } from './workspace.js';
import { request } from './api.js';
import { clearDisplaySession } from './session.js';
import {
  escapeHtml,
  formatDate,
  formatDateTime,
  hideMessage,
  icon,
  initials,
  showMessage,
} from './ui.js';

// The server accepts JSON bodies up to 10 KB (src/app.js).
const MAX_PROFILE_BYTES = 10 * 1024;

// Same rules as src/routes/profileRoutes.js; the server remains the authority.
function isValidPhone(value) {
  const digits = value.replace(/\D/g, '');
  return (
    /^\+?[\d\s().-]+$/.test(value) && digits.length >= 7 && digits.length <= 15
  );
}

function isValidWebsite(value) {
  try {
    const url = new URL(value);
    return (
      ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.')
    );
  } catch {
    return false;
  }
}

if (session) {
  const { user } = session;
  document.querySelector('#profile-avatar').textContent = initials(user.name);
  document.querySelector('#profile-name').textContent = user.name;
  document.querySelector('#profile-email').textContent = user.email;
  document.querySelector('#account-name').textContent = user.name;
  document.querySelector('#account-email').textContent = user.email;
  document.querySelector('#account-created').textContent = formatDate(
    user.createdAt
  );

  const form = document.querySelector('#profile-form');
  const fields = [...form.querySelectorAll('[data-label]')];
  const notice = document.querySelector('#profile-notice');
  const headline = document.querySelector('#profile-headline');
  const editButton = document.querySelector('#profile-edit');
  const createButton = document.querySelector('#profile-create');
  const cancelButton = document.querySelector('#profile-cancel');
  const saveButton = document.querySelector('#profile-save');
  const states = {
    loading: document.querySelector('#profile-loading'),
    error: document.querySelector('#profile-error'),
    empty: document.querySelector('#profile-empty'),
    view: document.querySelector('#profile-view'),
    edit: form,
  };
  let profile = null;
  let expired = false;

  function expireSession() {
    if (expired) return;
    expired = true;
    clearDisplaySession();
    location.replace('/auth/login.html?reason=expired');
  }

  function showState(name) {
    for (const [state, element] of Object.entries(states))
      element.hidden = state !== name;
    editButton.hidden = name !== 'view';
  }

  function renderProfile() {
    headline.textContent = profile?.headline || '';
    headline.hidden = !profile;
    if (!profile) {
      showState('empty');
      return;
    }

    document.querySelectorAll('[data-profile-value]').forEach((element) => {
      const value = profile[element.dataset.profileValue];
      element.classList.toggle('muted', !value);
      if (element.dataset.profileValue === 'website' && isValidWebsite(value)) {
        const link = document.createElement('a');
        link.className = 'text-link break-word';
        link.href = value;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = value;
        element.replaceChildren(link);
      } else {
        element.textContent = value || 'Not added yet';
      }
    });
    document.querySelector('#profile-updated').textContent =
      `Last updated ${formatDateTime(profile.updatedAt)}`;
    showState('view');
  }

  function validationMessage(field) {
    const value = field.value.trim();
    if (!value)
      return field.required ? `${field.dataset.label} is required.` : '';
    if (value.length > field.maxLength)
      return `Use ${field.maxLength} characters or fewer.`;
    if (field.name === 'phone' && !isValidPhone(value))
      return 'Enter a phone number with 7 to 15 digits. You can use +, spaces, dashes, dots and parentheses.';
    if (field.name === 'website' && !isValidWebsite(value))
      return 'Enter a full web address that starts with http:// or https://.';
    return '';
  }

  function validate(field) {
    const error = validationMessage(field);
    document.getElementById(`${field.id}-error`).textContent = error;
    field.setAttribute('aria-invalid', String(Boolean(error)));
    return !error;
  }

  function openForm() {
    hideMessage(notice);
    fields.forEach((field) => {
      field.value = profile?.[field.name] || '';
      delete field.dataset.touched;
      field.removeAttribute('aria-invalid');
      document.getElementById(`${field.id}-error`).textContent = '';
    });
    showState('edit');
    fields[0].focus();
  }

  function closeForm() {
    hideMessage(notice);
    renderProfile();
    (profile ? editButton : createButton).focus();
  }

  function setSaving(saving) {
    form.setAttribute('aria-busy', String(saving));
    fields.forEach((field) => (field.disabled = saving));
    cancelButton.disabled = saving;
    saveButton.disabled = saving;
    saveButton.innerHTML = saving
      ? '<span class="button-spinner" aria-hidden="true"></span>Saving…'
      : 'Save profile';
  }

  async function loadProfile() {
    showState('loading');
    try {
      const result = await request('/profile', undefined, 'GET');
      profile = result.profile;
      renderProfile();
    } catch (error) {
      if (error.status === 401) {
        expireSession();
        return;
      }
      document.querySelector('#profile-error-message').textContent =
        `We couldn’t load your professional profile. ${error.message}`;
      showState('error');
    }
  }

  // Shows the resume saved through the existing Resume page; it is not managed here.
  async function loadResume() {
    const summary = document.querySelector('#profile-resume');
    const link = document.querySelector('#profile-resume-link');
    try {
      const { resume } = await request('/resumes/current', undefined, 'GET');
      if (resume) {
        summary.innerHTML = `<ul class="receipt-list" aria-label="Current resume"><li class="resume-receipt">
          <span class="document-icon">${icon('file')}<span>PDF</span></span>
          <div class="min-width-zero"><h3 class="break-word">${escapeHtml(resume.originalName)}</h3><p>Uploaded ${escapeHtml(formatDate(resume.uploadedAt))}</p></div>
          <span class="badge badge-success">${icon('check')} Saved</span>
        </li></ul>`;
        link.innerHTML = `Manage resume ${icon('arrow')}`;
      } else {
        summary.innerHTML = `<div class="empty-state"><span class="icon-tile">${icon('file')}</span><div><h3>No resume saved yet</h3><p>Upload a PDF on the Resume page and it will appear here.</p></div></div>`;
        link.innerHTML = `Upload resume ${icon('arrow')}`;
      }
    } catch (error) {
      if (error.status === 401) {
        expireSession();
        return;
      }
      summary.innerHTML = `<p>Resume information is unavailable. ${escapeHtml(error.message)}</p>`;
    }
  }

  fields.forEach((field) => {
    field.addEventListener('blur', () => {
      field.dataset.touched = 'true';
      validate(field);
    });
    field.addEventListener('input', () => {
      if (field.dataset.touched) validate(field);
    });
  });

  createButton.addEventListener('click', openForm);
  editButton.addEventListener('click', openForm);
  cancelButton.addEventListener('click', closeForm);
  document
    .querySelector('#profile-retry')
    .addEventListener('click', loadProfile);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (saveButton.disabled) return;
    hideMessage(notice);
    const valid = fields.map((field) => {
      field.dataset.touched = 'true';
      return validate(field);
    });
    if (valid.includes(false)) {
      fields[valid.indexOf(false)].focus();
      return;
    }

    const body = Object.fromEntries(
      fields.map((field) => [field.name, field.value.trim()])
    );
    if (
      new TextEncoder().encode(JSON.stringify(body)).length > MAX_PROFILE_BYTES
    ) {
      showMessage(
        notice,
        'Your profile is too long to save. Shorten the longest sections and try again.'
      );
      return;
    }

    setSaving(true);
    try {
      const result = await request('/profile', body, 'PUT');
      if (!result.profile?.headline)
        throw new Error(
          'The save response was incomplete. Refresh the page to check your profile.'
        );
      profile = result.profile;
      renderProfile();
      showMessage(notice, result.message, 'success');
    } catch (error) {
      if (error.status === 401) {
        expireSession();
        return;
      }
      showMessage(notice, error.message);
    } finally {
      setSaving(false);
    }
  });

  loadProfile();
  loadResume();
}
