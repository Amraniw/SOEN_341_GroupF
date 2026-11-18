import { session } from './workspace.js';
import { request } from './api.js';
import { clearDisplaySession } from './session.js';
import { escapeHtml, icon } from './ui.js';

if (session) {
  const { user } = session;
  document.querySelector('#welcome-name').textContent = user.name.trim().split(/\s+/)[0];

  async function loadOverview() {
    const results = await Promise.allSettled([
      request('/applications', undefined, 'GET'),
      request('/resumes', undefined, 'GET'),
      request('/profile', undefined, 'GET'),
    ]);
    if (results.some((result) => result.status === 'rejected' && result.reason.status === 401)) {
      clearDisplaySession();
      location.replace('/auth/login.html?reason=expired');
      return;
    }
    const [applicationResult, resumeResult, profileResult] = results;
    let applications;
    let resumes;
    if (applicationResult.status === 'fulfilled') {
      applications = applicationResult.value.items;
      document.querySelector('#overview-active').textContent = applications.filter((item) => ['applied', 'under_review', 'interview'].includes(item.status)).length;
      document.querySelector('#overview-applications').textContent = applications.length
        ? 'Follow every opportunity from submission to its latest status. Revisit role details and see how each application is progressing.'
        : 'Find a role that fits, then follow its progress here. Your applications and status history stay together as your search grows.';
    } else {
      document.querySelector('#overview-applications').textContent = 'Application summary unavailable. Open Applications to try again.';
    }
    if (resumeResult.status === 'fulfilled') {
      resumes = resumeResult.value.items;
      const defaultResume = resumes.find((item) => item.isDefault);
      document.querySelector('#overview-resumes').textContent = resumes.length;
      const resumeSummary = document.querySelector('#overview-resume');
      resumeSummary.classList.toggle('overview-default-resume', Boolean(defaultResume));
      resumeSummary.textContent = defaultResume ? `Default · ${defaultResume.originalName}` : 'No resume saved yet.';
      if (defaultResume) resumeSummary.title = 'Default resume: ' + defaultResume.originalName;
    } else {
      document.querySelector('#overview-resume').textContent = 'Resume summary unavailable. Open Manage resumes to try again.';
    }
    document.querySelector('#overview-profile').textContent = profileResult.status === 'fulfilled'
      ? profileResult.value.profile?.headline || 'Professional profile not created yet.'
      : 'Your professional profile is unavailable right now.';

    let next;
    if (applications?.some((item) => item.status === 'offered' && !item.offerResponse && !item.quitAt)) {
      next = ['An offer is ready for your review.', 'See the role and choose your next step in Applications.', '/applications/index.html', 'Review applications'];
    } else if (resumes?.length === 0) {
      next = ['Bring your experience into focus.', 'Upload your first resume, then use AI Resume Review for focused feedback.', '/resume/index.html', 'Add a resume'];
    } else if (applications?.some((item) => item.status === 'interview')) {
      next = ['Your search is moving forward.', 'Check your interview-stage applications and keep track of each opportunity.', '/applications/index.html', 'View applications'];
    }
    if (next) {
      document.querySelector('#next-title').textContent = next[0];
      document.querySelector('#next-copy').textContent = next[1];
      const action = document.querySelector('#next-action');
      action.href = next[2];
      action.innerHTML = `${escapeHtml(next[3])} ${icon('arrow')}`;
    }
  }
  loadOverview();
}
