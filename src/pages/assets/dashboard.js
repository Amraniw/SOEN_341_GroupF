import { session } from './workspace.js';
import { escapeHtml, initials, icon, formatDate } from './ui.js';

if (session) {
  const { user, receipts } = session;
  document.querySelector('#welcome-name').textContent = user.name
    .trim()
    .split(/\s+/)[0];
  document.querySelector('#account-summary').innerHTML =
    `<div class="avatar">${escapeHtml(initials(user.name))}</div><div class="min-width-zero"><h2>${escapeHtml(user.name)}</h2><p class="break-word">${escapeHtml(user.email)}</p><span class="badge badge-neutral">CareerConnect member</span></div>`;
  const uploaded = receipts.length > 0;
  document.querySelector('#setup-count').textContent = uploaded
    ? '2 of 2 steps completed'
    : '1 of 2 steps completed';
  document.querySelector('#setup-progress').value = uploaded ? 2 : 1;
  if (uploaded) {
    document.querySelector('#resume-step').innerHTML =
      `<span class="step-icon complete">${icon('check')}</span><div><h3>Resume uploaded</h3><p>Confirmed during this sign-in.</p></div><a class="text-link" href="/resume/index.html">View receipt ${icon('arrow')}</a>`;
    document.querySelector('#next-title').textContent =
      'Your next chapter starts here.';
    document.querySelector('#next-copy').textContent =
      'Your account is ready and your resume has been uploaded. Keep a current copy ready as your experience grows.';
    document.querySelector('#next-action').innerHTML =
      `View resume ${icon('arrow')}`;
  }
  document.querySelector('#resume-summary').innerHTML = uploaded
    ? `<span class="badge badge-success">Upload confirmed</span><h3 class="break-word">${escapeHtml(receipts[0].originalName)}</h3><p>Uploaded ${escapeHtml(formatDate(receipts[0].uploadedAt))}</p><a class="text-link" href="/resume/index.html">View upload details ${icon('arrow')}</a>`
    : `<span class="icon-tile">${icon('file')}</span><h3>Make your experience count.</h3><p>Upload a PDF of your resume to your account. Earlier uploads are not shown in this release.</p><a class="text-link" href="/resume/index.html">Upload resume ${icon('arrow')}</a>`;
}
