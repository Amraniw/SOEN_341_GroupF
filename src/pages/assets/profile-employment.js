import { session } from './workspace.js';
import { request } from './api.js';
import { formatDate } from './ui.js';

// The Employment panel on "My account": employed or unemployed, every job the job
// seeker accepted and has not left (each with a way to leave it), and a shortcut to
// unemployed for someone employed with no accepted job on record. Recruiters do not
// have this panel.
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
    jobs: $('#employment-jobs'),
    browse: $('#employment-browse'),
    actions: $('#employment-actions'),
    unemployed: $('#employment-unemployed'),
    confirm: $('#employment-confirm'),
    confirmTitle: $('#employment-confirm-title'),
    confirmText: $('#employment-confirm-text'),
    confirmError: $('#employment-confirm-error'),
    confirmYes: $('#employment-confirm-yes'),
    confirmNo: $('#employment-confirm-no'),
  };
  let employment = null;
  let pending = null; // { job } while leaving a job, { job: null } for the unemployed shortcut
  let busy = false;

  function showOnly(name) {
    el.loading.hidden = name !== 'loading';
    el.error.hidden = name !== 'error';
    el.body.hidden = name !== 'body';
  }

  function closeConfirm() {
    pending = null;
    el.confirm.hidden = true;
    el.confirmError.hidden = true;
    el.confirmError.textContent = '';
  }

  function text(tag, value, className = '') {
    const node = document.createElement(tag);
    node.textContent = value;
    if (className) node.className = className;
    return node;
  }

  function jobItem(job) {
    const item = document.createElement('li');
    item.className = 'employment-job';
    const info = document.createElement('div');
    info.append(
      text('strong', job.title),
      text('span', [job.company, job.location].filter(Boolean).join(' · ')),
      text('span', `Since ${formatDate(job.startedAt)}`)
    );
    const leave = text('button', 'Leave this job', 'button button-secondary');
    leave.type = 'button';
    leave.dataset.leaveJob = job.applicationId;
    leave.setAttribute('aria-label', `Leave ${job.title} at ${job.company}`);
    item.append(info, leave);
    return item;
  }

  function render(flash = '') {
    const { employmentStatus, currentJobs } = employment;
    const employed = employmentStatus === 'employed';
    el.badge.hidden = !employmentStatus;
    el.badge.textContent = employed ? 'Employed' : 'Unemployed';
    el.badge.className = `badge ${employed ? 'badge-success' : 'badge-neutral'}`;

    el.jobs.replaceChildren(...currentJobs.map(jobItem));
    el.jobs.hidden = currentJobs.length === 0;

    el.message.textContent =
      flash ||
      (employed
        ? currentJobs.length ? '' : 'You’re currently employed.'
        : employmentStatus === 'unemployed' ? 'You’re looking for your next role.' : 'Your employment status isn’t set yet.');
    el.browse.hidden = employed && currentJobs.length > 0;
    // The shortcut is only for being employed with no accepted job on record.
    el.actions.hidden = !(employed && currentJobs.length === 0);
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

  function askToConfirm(job, trigger) {
    pending = { job, trigger };
    el.confirmTitle.textContent = job ? `Leave ${job.title} at ${job.company}?` : 'Mark yourself as unemployed?';
    const rest = employment.currentJobs.length - 1;
    el.confirmText.textContent = job
      ? `It will be removed from your profile and the recruiter will be told. ${rest > 0 ? 'You’ll stay employed because you have other jobs.' : 'It’s your last job, so you’ll be marked as unemployed.'} You can apply for it again later.`
      : 'Your profile will show you as unemployed.';
    el.confirm.hidden = false;
    el.confirmYes.focus();
  }

  el.retry.addEventListener('click', load);
  el.unemployed.addEventListener('click', () => askToConfirm(null, el.unemployed));
  el.jobs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-leave-job]');
    if (!button) return;
    const job = employment.currentJobs.find(({ applicationId }) => applicationId === Number(button.dataset.leaveJob));
    if (job) askToConfirm(job, button);
  });

  el.confirmNo.addEventListener('click', () => {
    const { trigger } = pending || {};
    closeConfirm();
    trigger?.focus();
  });

  el.confirmYes.addEventListener('click', async () => {
    if (busy || !pending) return;
    const { job } = pending;
    busy = true;
    el.confirmYes.disabled = true;
    el.confirmNo.disabled = true;
    el.confirmError.hidden = true;
    try {
      employment = job
        ? await request(`/profile/employment/jobs/${job.applicationId}/leave`, {}, 'POST')
        : await request('/profile/employment/unemployed', {}, 'POST');
      closeConfirm();
      const stillEmployed = employment.employmentStatus === 'employed';
      render(job
        ? `You left ${job.title} at ${job.company}.${stillEmployed ? '' : ' You’re now marked as unemployed.'}`
        : 'You’re now marked as unemployed.');
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
