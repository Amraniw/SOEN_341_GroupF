import { session } from './workspace.js';
import { request } from './api.js';
import { clearDisplaySession } from './session.js';
import {
  escapeHtml,
  icon,
  formatDate,
  formatSize,
  hideMessage,
  showMessage,
} from './ui.js';

if (session) {
  const form = document.querySelector('#resume-form');
  const picker = document.querySelector('#resume-file');
  const drop = document.querySelector('#drop-zone');
  const selected = document.querySelector('#selected-file');
  const upload = document.querySelector('#upload-button');
  const notice = document.querySelector('#upload-notice');
  const progress = document.querySelector('#upload-progress');
  const dropTitle = drop.querySelector('h3');
  const dropHelp = document.querySelector('#file-help');
  const listEmpty = document.querySelector('#receipt-empty');
  const list = document.querySelector('#receipt-list');
  const listNotice = document.querySelector('#resumes-notice');
  const listLoading = document.querySelector('#resumes-loading');
  const count = document.querySelector('#resume-count');
  let file = null;
  let resumes = [];
  let busy = false;
  let selectionVersion = 0;
  let deleteConfirmationTimeout = null;

  function expireSession() {
    clearDisplaySession();
    location.replace('/auth/login.html?reason=expired');
  }

  function resetDeleteConfirmation() {
    window.clearTimeout(deleteConfirmationTimeout);
    deleteConfirmationTimeout = null;
    const button = list.querySelector('[data-delete-resume].is-confirming');
    if (!button) return;
    button.classList.remove('is-confirming');
    button.querySelector('[data-delete-label]').textContent = 'Delete';
    button.setAttribute('aria-label', button.dataset.label);
  }

  // One change at a time: list actions and uploads wait for each other.
  function setBusy(value) {
    busy = value;
    picker.disabled = value;
    upload.disabled = value || !file;
    const removeSelection = selected.querySelector('button');
    if (removeSelection) removeSelection.disabled = value;
    list.setAttribute('aria-busy', String(value));
    list.querySelectorAll('button').forEach((button) => {
      button.disabled = value;
    });
  }

  function isResume(value) {
    return (
      Number.isSafeInteger(value?.id) &&
      value.id > 0 &&
      typeof value.originalName === 'string' &&
      typeof value.isDefault === 'boolean'
    );
  }

  function resumeItem(resume) {
    const name = escapeHtml(resume.originalName);
    const defaultAction = resume.isDefault
      ? `<span class="badge badge-success">${icon('check')} Default</span>`
      : `<button class="resume-default-button" type="button" data-default-resume aria-label="Make ${name} your default resume">Make default</button>`;
    return `<li class="resume-receipt" data-resume-id="${resume.id}">
      <span class="document-icon">${icon('file')}<span>PDF</span></span>
      <div class="min-width-zero">
        <h3 class="break-word">${name}</h3>
        <p>Uploaded ${escapeHtml(formatDate(resume.uploadedAt))}</p>
      </div>
      <div class="resume-receipt-actions">
        ${defaultAction}
        <button class="resume-delete-button" type="button" data-delete-resume data-label="Delete ${name}" aria-label="Delete ${name}">
          ${icon('trash')}<span data-delete-label>Delete</span>
        </button>
      </div>
    </li>`;
  }

  // Throws, so each caller decides how to report a failure.
  async function refreshResumes() {
    const result = await request('/resumes', undefined, 'GET');
    if (!Array.isArray(result.items) || !result.items.every(isResume)) {
      throw new Error(
        'Your saved resumes could not be shown. Refresh the page to try again.'
      );
    }
    resumes = result.items;
    resetDeleteConfirmation();
    listLoading.hidden = true;
    listEmpty.hidden = resumes.length > 0;
    list.innerHTML = resumes.map(resumeItem).join('');
    list.querySelectorAll('button').forEach((button) => {
      button.disabled = busy;
    });
    count.textContent = `${resumes.length} saved`;
  }

  async function loadResumes() {
    try {
      await refreshResumes();
    } catch (error) {
      if (error.status === 401) {
        expireSession();
        return;
      }
      listLoading.hidden = true;
      showMessage(listNotice, error.message);
    }
  }

  // Reports a completed change once the list shows it.
  async function showChange(message) {
    try {
      await refreshResumes();
      showMessage(listNotice, message, 'success');
    } catch (error) {
      if (error.status === 401) {
        expireSession();
        return;
      }
      showMessage(
        listNotice,
        `${message} Refresh the page to see your updated list.`,
        'success'
      );
    }
  }

  async function showFailure(error) {
    if (error.status === 401) {
      expireSession();
      return;
    }
    if (error.status === 404) {
      // For example, deleted in another tab: show what is saved now.
      await loadResumes();
      showMessage(
        listNotice,
        'That resume is no longer saved. Your list has been refreshed.'
      );
      return;
    }
    showMessage(listNotice, error.message);
  }

  function resetSelection() {
    selectionVersion += 1;
    file = null;
    picker.value = '';
    selected.hidden = true;
    selected.replaceChildren();
    upload.disabled = true;
    selected.classList.remove('is-uploaded');
    drop.dataset.uploadState = 'empty';
    dropTitle.textContent = 'Give your experience a home.';
    dropHelp.innerHTML =
      'Drop one PDF here, or choose a file.<br>PDF format only. Maximum file size: 5 MB.';
  }

  async function selectFiles(files) {
    if (busy) return;
    resetSelection();
    hideMessage(notice);
    if (!files.length) return;
    const version = selectionVersion;
    const candidate = files[0];
    let error = '';
    if (files.length !== 1) error = 'Choose one PDF at a time.';
    else if (
      !/\.pdf$/i.test(candidate.name) ||
      (candidate.type && candidate.type !== 'application/pdf')
    )
      error = 'Choose a PDF file. Other file types are not supported.';
    else if (candidate.size > 5 * 1024 * 1024)
      error = 'Your file is too large. Choose a PDF of 5 MB or less.';
    else {
      try {
        if ((await candidate.slice(0, 5).text()) !== '%PDF-')
          error =
            'This file does not appear to be a PDF. Export your resume as a PDF and try again.';
      } catch {
        error = 'We could not read that file. Please choose it again.';
      }
    }
    if (version !== selectionVersion) return;
    if (error) {
      showMessage(notice, error);
      return;
    }
    file = candidate;
    selected.innerHTML = `<span class="icon-tile">${icon('file')}</span><div class="min-width-zero"><strong class="break-word">${escapeHtml(file.name)}</strong><p>${formatSize(file.size)} · Ready to upload</p></div><button class="button button-quiet" type="button" id="remove-selection" aria-label="Remove selected file">Remove</button>`;
    selected.hidden = false;
    drop.dataset.uploadState = 'selected';
    selected.querySelector('button').addEventListener('click', () => {
      resetSelection();
      picker.focus();
    });
    upload.disabled = false;
    document.querySelector('#selection-status').textContent =
      `${file.name} selected. Ready to upload.`;
  }

  picker.addEventListener('change', () => selectFiles([...picker.files]));
  let dragDepth = 0;
  drop.addEventListener('dragenter', (event) => {
    event.preventDefault();
    if (!busy) {
      dragDepth += 1;
      drop.classList.add('drag-over');
    }
  });
  drop.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = busy ? 'none' : 'copy';
  });
  drop.addEventListener('dragleave', () => {
    dragDepth -= 1;
    if (dragDepth <= 0) drop.classList.remove('drag-over');
  });
  drop.addEventListener('drop', (event) => {
    event.preventDefault();
    dragDepth = 0;
    drop.classList.remove('drag-over');
    selectFiles([...event.dataTransfer.files]);
  });

  async function makeDefault(resume) {
    resetDeleteConfirmation();
    setBusy(true);
    hideMessage(notice);
    hideMessage(listNotice);
    try {
      await request(`/resumes/${resume.id}/default`, undefined, 'PUT');
      await showChange(`“${resume.originalName}” is now your default resume.`);
    } catch (error) {
      await showFailure(error);
    } finally {
      setBusy(false);
    }
  }

  async function deleteResume(resume, button) {
    if (!button.classList.contains('is-confirming')) {
      resetDeleteConfirmation();
      button.classList.add('is-confirming');
      button.querySelector('[data-delete-label]').textContent = 'Confirm delete';
      button.setAttribute(
        'aria-label',
        `Confirm deletion of ${resume.originalName}`
      );
      deleteConfirmationTimeout = window.setTimeout(
        resetDeleteConfirmation,
        5000
      );
      return;
    }

    window.clearTimeout(deleteConfirmationTimeout);
    setBusy(true);
    button.setAttribute('aria-busy', 'true');
    hideMessage(notice);
    hideMessage(listNotice);
    try {
      const { defaultResume } = await request(
        `/resumes/${resume.id}`,
        undefined,
        'DELETE'
      );
      // The upload area may still describe the upload that was just deleted.
      if (drop.dataset.uploadState === 'complete') resetSelection();
      let message = `“${resume.originalName}” was deleted. Your other resumes are unchanged.`;
      if (!defaultResume) {
        message =
          'Resume deleted. You have no saved resumes, so your profile readiness is back to 60%. Upload a new PDF whenever you are ready.';
      } else if (resume.isDefault) {
        message = `“${resume.originalName}” was deleted. “${defaultResume.originalName}” is now your default resume.`;
      }
      await showChange(message);
    } catch (error) {
      await showFailure(error);
    } finally {
      button.removeAttribute('aria-busy');
      resetDeleteConfirmation();
      setBusy(false);
    }
  }

  list.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || busy) return;
    const id = Number(button.closest('[data-resume-id]')?.dataset.resumeId);
    const resume = resumes.find((item) => item.id === id);
    if (!resume) return;
    if (button.hasAttribute('data-default-resume')) makeDefault(resume);
    else if (button.hasAttribute('data-delete-resume'))
      deleteResume(resume, button);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    resetDeleteConfirmation();
    hideMessage(notice);
    hideMessage(listNotice);
    upload.classList.add('is-busy');
    upload.innerHTML =
      '<span class="button-spinner" aria-hidden="true"></span>Uploading…';
    progress.hidden = false;
    drop.dataset.uploadState = 'uploading';
    form.setAttribute('aria-busy', 'true');
    const data = new FormData();
    const pdf = file.type
      ? file
      : new Blob([file], { type: 'application/pdf' });
    data.append('resume', pdf, file.name);
    try {
      const result = await request('/resumes', data);
      if (!result.resume?.originalName)
        throw new Error(
          'The upload response was incomplete. Please check before uploading again.'
        );
      const uploadedFile = file;
      selectionVersion += 1;
      file = null;
      picker.value = '';
      selected.innerHTML = `<span class="document-icon">${icon('file')}<span>PDF</span></span><div class="min-width-zero"><strong class="break-word">${escapeHtml(uploadedFile.name)}</strong><p>${formatSize(uploadedFile.size)} · Uploaded just now</p></div><span class="badge badge-success">${icon('check')} Uploaded</span>`;
      selected.classList.add('is-uploaded');
      selected.hidden = false;
      drop.dataset.uploadState = 'complete';
      dropTitle.textContent = 'Resume saved to your account.';
      dropHelp.innerHTML =
        'Your profile readiness is now 100%.<br>This upload is now your default resume.';
      showMessage(
        notice,
        'Resume uploaded successfully. It is now your default resume and will remain available after refresh and future sign-ins.',
        'success'
      );
      await loadResumes();
    } catch (error) {
      if (error.status === 401) {
        expireSession();
        return;
      }
      showMessage(notice, error.message);
    } finally {
      setBusy(false);
      upload.classList.remove('is-busy');
      upload.innerHTML = `${icon('upload')} Upload resume`;
      progress.hidden = true;
      if (drop.dataset.uploadState === 'uploading')
        drop.dataset.uploadState = file ? 'selected' : 'empty';
      form.removeAttribute('aria-busy');
    }
  });

  loadResumes();
}
