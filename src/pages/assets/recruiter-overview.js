import { session } from './workspace.js';
import { request } from './api.js';
import { clearDisplaySession, signInUrl } from './session.js';
import { formatDate } from './ui.js';

if (session?.user.role === 'recruiter') {
  function showFailure(id, fallback, error) {
    if (error.status === 401) {
      clearDisplaySession();
      location.replace(signInUrl('expired'));
    } else if (error.status === 403) {
      location.replace('/dashboard/index.html');
    } else {
      document.getElementById(id).textContent = fallback;
    }
  }

  request('/recruiter/overview', undefined, 'GET').then(({ overview }) => {
    document.getElementById('snapshot-open').textContent = overview.openPostings;
    document.getElementById('snapshot-applications').textContent = overview.totalApplications;
    document.getElementById('snapshot-closed').textContent = overview.closedPostings;
    document.getElementById('snapshot-status').textContent = '';
  }).catch((error) => showFailure('snapshot-status', 'Hiring totals are unavailable. Refresh the page to try again.', error));

  request('/notifications?limit=20', undefined, 'GET').then(({ items }) => {
    const activity = items.filter(({ type }) => ['new_application', 'application_update'].includes(type)).slice(0, 4);
    const list = document.getElementById('recruiter-activity-list');
    document.getElementById('activity-status').textContent = activity.length ? '' : 'No recent recruiting activity.';
    for (const item of activity) {
      const row = document.createElement('li');
      const title = document.createElement('strong');
      const date = document.createElement('time');
      const message = document.createElement('p');
      title.textContent = item.title;
      date.textContent = formatDate(item.createdAt);
      message.textContent = item.message;
      row.append(title, date, message);
      if (item.type === 'new_application' && /^\/recruiter\/dashboard\?applicants=[1-9]\d*#candidate-review$/.test(item.link)) {
        const link = document.createElement('a');
        link.className = 'text-link';
        link.href = item.link;
        link.textContent = 'Review applicants';
        row.append(link);
      }
      list.append(row);
    }
  }).catch((error) => showFailure('activity-status', 'Recent activity is unavailable. Refresh the page to try again.', error));
}
