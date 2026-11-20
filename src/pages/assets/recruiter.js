import { session } from './workspace.js';
import { request } from './api.js';
import { clearDisplaySession, signInUrl } from './session.js';
import { formatDate } from './ui.js';
import { createRecruiterDashboard } from './recruiter-dashboard.mjs';
import { setupCandidateReview } from './recruiter-candidates.js';

if (session?.user.role === 'recruiter') {
  const dashboard = createRecruiterDashboard({
    document, request, formatDate,
    onUnauthorized(error) {
      if (error.status === 401) {
        clearDisplaySession();
        location.replace(signInUrl('expired'));
      } else location.replace('/dashboard/index.html');
    },
  });
  dashboard.load().then(() => {
    if (location.hash === '#postings') {
      document.querySelector('#postings').scrollIntoView({ block: 'start' });
      document.querySelector('#postings-heading').focus({ preventScroll: true });
    }
  });
  setupCandidateReview();
}
