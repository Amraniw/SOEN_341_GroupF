import { session } from './workspace.js';
import { initials, formatDate } from './ui.js';

if (session) {
  const { user } = session;
  document.querySelector('#profile-avatar').textContent = initials(user.name);
  document.querySelector('#profile-name').textContent = user.name;
  document.querySelector('#profile-email').textContent = user.email;
  document.querySelector('#account-name').textContent = user.name;
  document.querySelector('#account-email').textContent = user.email;
  document.querySelector('#account-created').textContent = formatDate(
    user.createdAt
  );
}
