import { session } from './workspace.js';
import { request } from './api.js';
import { clearDisplaySession } from './session.js';
import { escapeHtml, initials, icon, formatDate } from './ui.js';

if (session) {
  const { user } = session;
  const setupCount = document.querySelector('#setup-count');
  const setupProgress = document.querySelector('#setup-progress');
  const resumeStep = document.querySelector('#resume-step');
  const resumeSummary = document.querySelector('#resume-summary');

  document.querySelector('#welcome-name').textContent = user.name
    .trim()
    .split(/\s+/)[0];
  document.querySelector('#account-summary').innerHTML =
    `<div class="avatar">${escapeHtml(initials(user.name))}</div><div class="min-width-zero"><h2>${escapeHtml(user.name)}</h2><p class="break-word">${escapeHtml(user.email)}</p><span class="badge badge-neutral">CareerConnect member</span></div>`;

  function renderResume(resume) {
    const uploaded = Boolean(resume);
    const readiness = uploaded ? 100 : 60;

    setupCount.textContent = `${readiness}% complete`;
    setupProgress.value = readiness;
    setupProgress.textContent = `${readiness}%`;
    setupProgress.setAttribute(
      'aria-label',
      `Profile readiness: ${readiness} percent`
    );

    if (uploaded) {
      resumeStep.innerHTML =
        `<span class="step-icon complete">${icon('check')}</span><div><h3>Resume uploaded</h3><p>Saved securely to your account.</p></div><a class="text-link" href="/resume/index.html">Manage resume ${icon('arrow')}</a>`;
      document.querySelector('#next-title').textContent =
        'Your next chapter starts here.';
      document.querySelector('#next-copy').textContent =
        'Your account and resume are ready. Keep your current experience on file as your career grows.';
      document.querySelector('#next-action').innerHTML =
        `Manage resume ${icon('arrow')}`;
      resumeSummary.innerHTML =
        `<span class="badge badge-success">Resume ready</span><h3 class="break-word">${escapeHtml(resume.originalName)}</h3><p>Uploaded ${escapeHtml(formatDate(resume.uploadedAt))}</p><a class="text-link" href="/resume/index.html">View or delete resume ${icon('arrow')}</a>`;
      return;
    }

    resumeStep.innerHTML =
      `<span class="step-icon">2</span><div><h3>Add your resume</h3><p>Upload a PDF of your experience.</p></div><a class="text-link" href="/resume/index.html">Get started ${icon('arrow')}</a>`;
    resumeSummary.innerHTML =
      `<span class="icon-tile">${icon('file')}</span><h3>Make your experience count.</h3><p>Upload a PDF to raise your profile readiness from 60% to 100%.</p><a class="text-link" href="/resume/index.html">Upload resume ${icon('arrow')}</a>`;
  }

  async function loadCurrentResume() {
    try {
      const result = await request('/resumes/current', undefined, 'GET');
      renderResume(result.resume);
    } catch (error) {
      if (error.status === 401) {
        clearDisplaySession();
        location.replace('/auth/login.html?reason=expired');
        return;
      }
      setupCount.textContent = 'Status unavailable';
      resumeSummary.innerHTML =
        `<span class="badge badge-neutral">Unable to refresh</span><h3>Resume status unavailable</h3><p>${escapeHtml(error.message)}</p><a class="text-link" href="/dashboard/index.html">Try again ${icon('arrow')}</a>`;
    }
  }

  loadCurrentResume();
}
