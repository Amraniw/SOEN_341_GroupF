import { request } from './api.js';
import { startSession } from './session.js';
import { hideMessage, icon, showMessage } from './ui.js';

const form = document.querySelector('[data-auth-form]');
const signup = form.dataset.authForm === 'signup';
const submit = form.querySelector('[type="submit"]');
const notice = document.querySelector('#form-notice');
const fields = [...form.querySelectorAll('input[data-label]')];
const originalButton = signup
  ? `Create account ${icon('arrow')}`
  : `Sign in ${icon('arrow')}`;

function validationMessage(input) {
  const value = input.value;
  if (!input.required && !value.trim()) return '';
  if (!value.trim()) return `${input.dataset.label} is required.`;
  if (
    input.name === 'email' &&
    (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ||
      value.trim().length > 254)
  )
    return 'Enter a valid email address.';
  if (input.name === 'name' && value.trim().length > 100)
    return 'Use 100 characters or fewer.';
  if (signup && input.name === 'password') {
    if (value.length < 8) return 'Use at least 8 characters.';
    if (new TextEncoder().encode(value).length > 72)
      return 'This password is too long. Use 72 UTF-8 bytes or fewer; some characters use multiple bytes.';
  }
  if (input.name === 'confirm' && value !== form.elements.password.value)
    return 'Passwords do not match.';
  return '';
}

function validate(input) {
  const error = validationMessage(input);
  document.getElementById(`${input.id}-error`).textContent = error;
  input.setAttribute('aria-invalid', String(Boolean(error)));
  return !error;
}

function updateRequirement() {
  const requirement = document.querySelector('[data-password-requirement]');
  if (!requirement) return;
  const interacted = Boolean(form.elements.password.value);
  const met = form.elements.password.value.length >= 8;
  requirement.classList.toggle('is-met', met);
  requirement.querySelector('.requirement-mark').textContent = met ? '✓' : '○';
  requirement.setAttribute(
    'aria-label',
    `${met ? 'Met' : interacted ? 'Not yet met' : 'Requirement'}: at least 8 characters`
  );
}

fields.forEach((input) => {
  input.addEventListener('blur', () => {
    input.dataset.touched = 'true';
    validate(input);
  });
  input.addEventListener('input', () => {
    if (input.dataset.touched) validate(input);
    if (input.name === 'password') {
      updateRequirement();
      if (form.elements.confirm?.dataset.touched)
        validate(form.elements.confirm);
    }
  });
});

document.querySelectorAll('[data-toggle-password]').forEach((button) => {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.togglePassword);
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.textContent = visible ? 'Hide' : 'Show';
    button.setAttribute(
      'aria-label',
      `${visible ? 'Hide' : 'Show'} ${input.dataset.label.toLowerCase()}`
    );
    button.setAttribute('aria-pressed', String(visible));
  });
});

function setButtonState(state) {
  submit.classList.toggle('is-busy', state === 'busy');
  submit.classList.toggle('is-success', state === 'success');
  if (state === 'busy') {
    submit.innerHTML = `<span class="button-spinner" aria-hidden="true"></span>${signup ? 'Creating account…' : 'Signing in…'}`;
  } else if (state === 'success') {
    submit.innerHTML = `${icon('check')}${signup ? 'Account created' : 'Signed in'}`;
  } else {
    submit.innerHTML = originalButton;
  }
}

function friendlyError(error) {
  if (/already|exists|registered/i.test(error.message))
    return 'An account with this email already exists. Sign in instead or use another email.';
  if (error.status === 400)
    return 'Review the highlighted details and try again.';
  return error.message;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submit.disabled) return;
  hideMessage(notice);
  const valid = fields.map((input) => {
    input.dataset.touched = 'true';
    return validate(input);
  });
  if (valid.includes(false)) {
    fields[valid.indexOf(false)].focus();
    return;
  }
  try {
    sessionStorage.setItem('careerconnect.storage-check', '1');
    sessionStorage.removeItem('careerconnect.storage-check');
  } catch {
    showMessage(notice, 'Enable session storage in your browser to continue.');
    return;
  }
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  submit.disabled = true;
  fields.forEach((field) => (field.disabled = true));
  setButtonState('busy');
  form.setAttribute('aria-busy', 'true');
  let registered = false;
  try {
    if (signup) {
      await request('/register', {
        name: form.elements.name.value.trim(),
        email,
        password,
      });
      registered = true;
    }
    const data = await request('/login', { email, password });
    if (!data.user?.name || !data.user?.email)
      throw new Error('The sign-in response was incomplete. Please try again.');
    startSession(data.user);
    setButtonState('success');
    await new Promise((resolve) => setTimeout(resolve, 320));
    location.assign('/dashboard/index.html');
  } catch (error) {
    if (registered) {
      form.hidden = true;
      showMessage(
        notice,
        'Your account was created, but automatic sign-in could not finish. Use the sign-in link below to continue.',
        'success'
      );
    } else {
      showMessage(notice, friendlyError(error));
    }
    submit.disabled = false;
    fields.forEach((field) => (field.disabled = false));
    setButtonState('idle');
    form.removeAttribute('aria-busy');
  }
});

const reason = new URLSearchParams(location.search).get('reason');
if (reason === 'expired')
  showMessage(
    notice,
    'Please sign in again to continue. Your session may have expired.',
    'info'
  );
if (reason === 'required')
  showMessage(notice, 'Sign in to open your workspace.', 'info');
if (reason === 'changed')
  showMessage(
    notice,
    'An account was signed in on another tab. Sign in again to confirm which account you want to use.',
    'info'
  );
