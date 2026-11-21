import { session } from './workspace.js';
import { request } from './api.js';
import { setupPictureControls } from './profile-picture.js';
import { clearDisplaySession, signInUrl } from './session.js';
import { formatDate, initials } from './ui.js';

if (session?.user.role === 'recruiter') {
  const { user } = session;
  const byId = (id) => document.getElementById(id);
  byId('recruiter-name').textContent = user.name;
  byId('recruiter-email').textContent = user.email;
  byId('recruiter-member-since').textContent = formatDate(user.createdAt);
  const avatar = byId('profile-avatar');
  avatar.textContent = initials(user.name);
  setupPictureControls(avatar, avatar.textContent);

  const form = byId('recruiter-profile-form');
  const fields = form.querySelector('fieldset');
  const feedback = byId('recruiter-profile-status');
  const editable = ['headline', 'location', 'phone', 'website', 'summary'];
  let profile;

  function showError(node, error, message = error.message) {
    if (error.status === 401) {
      clearDisplaySession();
      location.replace(signInUrl('expired'));
    } else if (error.status === 403) {
      location.replace('/dashboard/index.html');
    } else {
      node.textContent = message;
    }
  }

  function render(saved) {
    profile = saved;
    byId('recruiter-headline').textContent = saved?.headline || 'Recruiter';
    for (const name of editable) form.elements[name].value = saved?.[name] || '';
  }

  request('/profile', undefined, 'GET').then(({ profile: saved }) => {
    render(saved);
    fields.disabled = false;
    feedback.textContent = '';
  }).catch((error) => showError(feedback, error, 'Profile unavailable. Refresh the page to try again.'));

  const companies = byId('recruiter-companies');
  request('/recruiter/jobs', undefined, 'GET').then(({ items }) => {
    const names = [...new Set(items.map(({ company }) => company))];
    companies.textContent = names.join(', ') || 'No companies on your postings yet.';
  }).catch((error) => showError(companies, error, 'Company names are unavailable.'));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (fields.disabled) return;
    const payload = Object.fromEntries(editable.map((name) => [name, form.elements[name].value.trim()]));
    // PUT replaces the whole profile. Carry over fields from the previous account layout.
    for (const name of ['skills', 'education', 'experience']) payload[name] = profile?.[name] || '';
    fields.disabled = true;
    form.setAttribute('aria-busy', 'true');
    feedback.textContent = 'Saving profile…';
    try {
      const result = await request('/profile', payload, 'PUT');
      render(result.profile);
      feedback.textContent = result.message;
    } catch (error) {
      showError(feedback, error);
    } finally {
      fields.disabled = false;
      form.removeAttribute('aria-busy');
      form.querySelector('button').focus();
    }
  });
}
