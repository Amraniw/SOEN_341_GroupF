import { session } from './workspace.js';
import { renderProfileStory } from './profile-story.mjs';
import { createProfileEditor } from './profile-editor.mjs';
import { refreshPictures, setupPictureControls } from './profile-picture.js';
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
  setupPictureControls(document.querySelector('#profile-avatar'), initials(user.name));
  refreshPictures();
  document.querySelector('#profile-name').textContent = user.name;
  document.querySelector('#profile-email').textContent = user.email;
  document.querySelector('#account-name').textContent = user.name;
  document.querySelector('#account-email').textContent = user.email;
  document.querySelector('#account-created').textContent = formatDate(
    user.createdAt
  );

  const form = document.querySelector('#profile-form');
  const fields = [...form.querySelectorAll('[data-label]')];
  const collections = createProfileEditor({ form, escape: escapeHtml });
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
    const contacts = document.querySelector('#profile-contact');
    contacts.replaceChildren();
    contacts.hidden = true;
    if (!profile) {
      showState('empty');
      return;
    }

    for (const value of [profile.location, profile.phone]) {
      if (!value) continue;
      const span = document.createElement('span');
      span.textContent = value;
      contacts.append(span);
    }
    if (isValidWebsite(profile.website)) {
      const link = document.createElement('a');
      link.href = profile.website;
      link.textContent = profile.website;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      contacts.append(link);
    }
    contacts.hidden = !contacts.childElementCount;
    document.querySelector('#profile-story').innerHTML = renderProfileStory(profile, escapeHtml);
    document.querySelector('#profile-updated').textContent =
      `Last updated ${formatDateTime(profile.updatedAt)}`;
    showState('view');
  }

  function validationMessage(field) {
    const value = field.value.trim();
    if (!value)
      return field.required ? `${field.dataset.label} is required.` : '';
    if (value.length > field.maxLength) {
      if (['experience', 'education'].includes(field.name))
        return 'These entries are too long. Shorten some details or remove an entry.';
      return `Use ${field.maxLength} characters or fewer.`;
    }
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
    collections.load(profile);
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
    collections.setBusy(saving);
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

  // Shows the default resume chosen on the Resume page; resumes are not managed here.
  async function loadResume() {
    const summary = document.querySelector('#profile-resume');
    const link = document.querySelector('#profile-resume-link');
    try {
      const { items } = await request('/resumes', undefined, 'GET');
      const resume = items.find((item) => item.isDefault);
      document.querySelector('#resume-library-count').textContent = `${items.length} saved ${items.length === 1 ? 'resume' : 'resumes'}`;
      if (resume) {
        summary.innerHTML = `<ul class="receipt-list" aria-label="Default resume"><li class="resume-receipt">
          <span class="document-icon">${icon('file')}<span>PDF</span></span>
          <div class="min-width-zero"><h3 class="break-word">${escapeHtml(resume.originalName)}</h3><p>Uploaded ${escapeHtml(formatDate(resume.uploadedAt))}</p></div>
          <span class="badge badge-success">${icon('check')} Default</span>
        </li></ul>`;
        link.innerHTML = `Manage your resumes ${icon('arrow')}`;
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
    if (!collections.commit()) return;
    const valid = fields.map((field) => {
      field.dataset.touched = 'true';
      return validate(field);
    });
    if (valid.includes(false)) {
      const invalid = fields[valid.indexOf(false)];
      if (!collections.focus(invalid.name)) invalid.focus();
      return;
    }

    if (!collections.validate()) return;
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
