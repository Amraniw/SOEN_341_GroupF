import { session } from './workspace.js';
import { request } from './api.js';
import { addReceipt, clearDisplaySession, readSession } from './session.js';
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
  const dropHelp = drop.querySelector('#file-help');
  let file = null;
  let busy = false;
  let selectionVersion = 0;

  function renderReceipts() {
    const receipts = readSession()?.receipts || [];
    document.querySelector('#receipt-empty').hidden = receipts.length > 0;
    document.querySelector('#receipt-list').innerHTML = receipts
      .map(
        (receipt) =>
          `<li class="resume-receipt"><span class="document-icon">${icon('file')}<span>PDF</span></span><div class="min-width-zero"><h3 class="break-word">${escapeHtml(receipt.originalName)}</h3><p>${escapeHtml(formatSize(receipt.size))} <span aria-hidden="true">·</span> Uploaded ${escapeHtml(formatDate(receipt.uploadedAt))}</p></div><span class="badge badge-success">${icon('check')} Uploaded</span></li>`
      )
      .join('');
  }

  function resetSelection() {
    selectionVersion++;
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
      dragDepth++;
      drop.classList.add('drag-over');
    }
  });
  drop.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = busy ? 'none' : 'copy';
  });
  drop.addEventListener('dragleave', () => {
    dragDepth--;
    if (dragDepth <= 0) drop.classList.remove('drag-over');
  });
  drop.addEventListener('drop', (event) => {
    event.preventDefault();
    dragDepth = 0;
    drop.classList.remove('drag-over');
    selectFiles([...event.dataTransfer.files]);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!file || busy) return;
    busy = true;
    hideMessage(notice);
    upload.disabled = true;
    picker.disabled = true;
    selected.querySelector('button').disabled = true;
    upload.textContent = 'Uploading…';
    upload.classList.add('is-busy');
    upload.innerHTML =
      '<span class="button-spinner" aria-hidden="true"></span>Uploading…';
    progress.hidden = false;
    drop.dataset.uploadState = 'uploading';
    form.setAttribute('aria-busy', 'true');
    const data = new FormData();
    // Some file pickers omit MIME type. The PDF signature was checked above.
    const pdf = file.type
      ? file
      : new Blob([file], { type: 'application/pdf' });
    data.append('resume', pdf, file.name);
    try {
      const result = await request('/resumes', data);
      if (!result.resume?.originalName)
        throw new Error(
          'The upload response was incomplete. Please check with support before uploading again.'
        );
      let saved = true;
      try {
        addReceipt(result.resume, file.size);
      } catch {
        saved = false;
      }
      const uploadedFile = file;
      selectionVersion++;
      file = null;
      picker.value = '';
      selected.innerHTML = `<span class="document-icon">${icon('file')}<span>PDF</span></span><div class="min-width-zero"><strong class="break-word">${escapeHtml(uploadedFile.name)}</strong><p>${formatSize(uploadedFile.size)} · Uploaded just now</p></div><span class="badge badge-success">${icon('check')} Uploaded</span>`;
      selected.classList.add('is-uploaded');
      selected.hidden = false;
      drop.dataset.uploadState = 'complete';
      dropTitle.textContent = 'Resume added to your workspace.';
      dropHelp.innerHTML =
        'Your confirmation is ready below.<br>Choose another PDF whenever you need to add a new copy.';
      renderReceipts();
      showMessage(
        notice,
        saved
          ? 'Resume uploaded successfully. Your confirmation is shown below.'
          : 'Your resume was uploaded, but this browser could not retain the receipt.',
        'success'
      );
    } catch (error) {
      if (error.status === 401) {
        clearDisplaySession();
        location.replace('/auth/login.html?reason=expired');
        return;
      }
      showMessage(notice, error.message);
    } finally {
      busy = false;
      picker.disabled = false;
      upload.disabled = !file;
      upload.classList.remove('is-busy');
      upload.innerHTML = `${icon('upload')} Upload resume`;
      progress.hidden = true;
      if (drop.dataset.uploadState === 'uploading')
        drop.dataset.uploadState = file ? 'selected' : 'empty';
      const remove = selected.querySelector('button');
      if (remove) remove.disabled = false;
      form.removeAttribute('aria-busy');
    }
  });
  renderReceipts();
}
