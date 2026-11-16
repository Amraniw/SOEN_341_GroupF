import { session } from './workspace.js';
import { request } from './api.js';
import { formatDate } from './ui.js';

// The Employment panel on "My account": whether the job seeker is employed, the job
// they accepted, and a way to switch back to unemployed. Recruiters do not have it.
const panel = document.querySelector('#employment-panel');

if (session && panel && session.user.role === 'job_seeker') {
  panel.hidden = false;
  const $ = (selector) => panel.querySelector(selector);
  const el = {
    badge: $('#employment-badge'),
    loading: $('#employment-loading'),
    error: $('#employment-error'),
    errorMessage: $('#employment-error-message'),
    retry: $('#employment-retry'),
    body: $('#employment-body'),
    message: $('#employment-message'),
    job: $('#employment-job'),
    browse: $('#employment-browse'),
    actions: $('#employment-actions'),
    leave: $('#employment-leave'),
    confirm: $('#employment-confirm'),
    confirmTitle: $('#employment-confirm-title'),
    confirmText: $('#employment-confirm-text'),
    confirmError: $('#employment-confirm-error'),
    confirmYes: $('#employment-confirm-yes'),
    confirmNo: $('#employment-confirm-no'),
  };
  let employment = null;
  let busy = false;

  function showOnly(name) {
    el.loading.hidden = name !== 'loading';
    el.error.hidden = name !== 'error';
    el.body.hidden = name !== 'body';
  }

  function closeConfirm() {
    el.confirm.hidden = true;
    el.confirmError.hidden = true;
    el.confirmError.textContent = '';
  }

  function render(flash = '') {
    const { employmentStatus, currentJob } = employment;
    const employed = employmentStatus === 'employed';
    el.badge.hidden = !employmentStatus;
    el.badge.textContent = employed ? 'Employed' : 'Unemployed';
    el.badge.className = `badge ${employed ? 'badge-success' : 'badge-neutral'}`;

    el.job.hidden = !currentJob;
    if (currentJob) {
      $('#employment-job-title').textContent = currentJob.title;
      $('#employment-job-company').textContent = currentJob.company;
      $('#employment-job-location').textContent = currentJob.location || 'Not specified';
      $('#employment-job-since').textContent = formatDate(currentJob.startedAt);
    }

    el.message.textContent =
      flash ||
      (employed
        ? currentJob ? '' : 'You’re currently employed.'
        : employmentStatus === 'unemployed' ? 'You’re looking for your next role.' : 'Your employment status isn’t set yet.');
    el.browse.hidden = employed;
    el.actions.hidden = !employed;
    el.leave.textContent = currentJob ? 'Leave this job' : 'I’m no longer employed';
    showOnly('body');
  }

  async function load() {
    showOnly('loading');
    try {
      employment = await request('/profile/employment', undefined, 'GET');
      render();
    } catch (error) {
      el.errorMessage.textContent = error.message;
      showOnly('error');
    }
  }

  el.retry.addEventListener('click', load);

  el.leave.addEventListener('click', () => {
    const { currentJob } = employment;
    el.confirmTitle.textContent = currentJob ? `Leave ${currentJob.title} at ${currentJob.company}?` : 'Mark yourself as unemployed?';
    el.confirmText.textContent = currentJob
      ? 'It will be removed from your profile, the recruiter will be told, and you’ll be marked as unemployed. You can apply for it again later.'
      : 'Your profile will show you as unemployed.';
    el.confirm.hidden = false;
    el.confirmYes.focus();
  });

  el.confirmNo.addEventListener('click', () => {
    closeConfirm();
    el.leave.focus();
  });

  el.confirmYes.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    el.confirmYes.disabled = true;
    el.confirmNo.disabled = true;
    el.confirmError.hidden = true;
    try {
      employment = await request('/profile/employment/unemployed', {}, 'POST');
      closeConfirm();
      render('You’re now marked as unemployed.');
      el.message.focus();
    } catch (error) {
      el.confirmError.textContent = error.message;
      el.confirmError.hidden = false;
    } finally {
      busy = false;
      el.confirmYes.disabled = false;
      el.confirmNo.disabled = false;
    }
  });

  load();
}
