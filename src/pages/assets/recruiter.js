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
  function showRecruiterSection() {
    const postings = location.hash === '#postings';
    document.querySelectorAll('#workspace-sidebar .nav-link').forEach((link) => {
      const selected = postings
        ? link.getAttribute('href') === '/recruiter/dashboard#postings'
        : link.getAttribute('href') === '/recruiter/dashboard';
      link.removeAttribute('aria-current');
      link.querySelector('.active-dot')?.remove();
      if (selected) {
        link.setAttribute('aria-current', 'page');
        const dot = document.createElement('span');
        dot.className = 'active-dot';
        link.append(dot);
      }
    });
    if (postings) {
      document.querySelector('#postings').scrollIntoView({ block: 'start' });
      document.querySelector('#postings-heading').focus({ preventScroll: true });
    }
  }
  window.addEventListener('hashchange', showRecruiterSection);
  document.querySelector('#workspace-sidebar').addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (link?.getAttribute('href') === '/recruiter/dashboard#postings' && location.hash === '#postings') {
      event.preventDefault();
      showRecruiterSection();
    }
  });
  Promise.resolve(dashboard.load()).then(showRecruiterSection);
  setupCandidateReview();
}
