document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('auth-form');
  const pageType = document.body.dataset.authPage;

  if (!form || !pageType) return;

  const status = document.getElementById('formStatus');
  const submitButton = form.querySelector('button[type="submit"]');
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  document.querySelectorAll('[data-password-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.passwordToggle);
      const showPassword = input.type === 'password';
      input.type = showPassword ? 'text' : 'password';
      button.setAttribute('aria-label', showPassword ? 'Hide password' : 'Show password');
      button.classList.toggle('is-visible', showPassword);
    });
  });

  const passwordInput = document.getElementById('password');
  if (pageType === 'signup' && passwordInput) {
    const updatePasswordRules = () => {
      document.querySelector('[data-password-rule="length"]')?.classList.toggle('is-met', passwordInput.value.length >= 8);
      document.querySelector('[data-password-rule="number"]')?.classList.toggle('is-met', /\d/.test(passwordInput.value));
    };
    passwordInput.addEventListener('input', updatePasswordRules);
  }

  function showFieldError(fieldName, message) {
    const field = document.getElementById(fieldName);
    const error = document.getElementById(`${fieldName}Error`);
    field?.classList.toggle('is-invalid', Boolean(message));
    field?.setAttribute('aria-invalid', String(Boolean(message)));
    if (error) error.textContent = message;
  }

  function clearFeedback() {
    status.hidden = true;
    status.textContent = '';
    status.className = 'alert';
    ['name', 'email', 'password', 'confirmPassword'].forEach((field) => showFieldError(field, ''));
  }

  function showStatus(message, type) {
    status.textContent = message;
    status.className = `alert alert--${type}`;
    status.hidden = false;
    status.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function setLoading(isLoading) {
    submitButton.disabled = isLoading;
    submitButton.classList.toggle('is-loading', isLoading);
    submitButton.setAttribute('aria-busy', String(isLoading));
  }

  function validateLogin(values) {
    let valid = true;
    if (!emailPattern.test(values.email)) {
      showFieldError('email', 'Enter a valid email address.');
      valid = false;
    }
    if (!values.password) {
      showFieldError('password', 'Enter your password.');
      valid = false;
    }
    return valid;
  }

  function validateSignup(values) {
    let valid = true;
    if (!values.name) {
      showFieldError('name', 'Enter your full name.');
      valid = false;
    }
    if (!emailPattern.test(values.email)) {
      showFieldError('email', 'Enter a valid email address.');
      valid = false;
    }
    if (values.password.length < 8) {
      showFieldError('password', 'Use at least 8 characters.');
      valid = false;
    } else if (new TextEncoder().encode(values.password).length > 72) {
      showFieldError('password', 'Password must be 72 bytes or fewer.');
      valid = false;
    }
    if (values.confirmPassword !== values.password) {
      showFieldError('confirmPassword', 'Passwords do not match.');
      valid = false;
    }
    return valid;
  }

  form.addEventListener('input', (event) => {
    if (event.target.id) showFieldError(event.target.id, '');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFeedback();

    const values = {
      name: document.getElementById('name')?.value.trim() || '',
      email: document.getElementById('email').value.trim().toLowerCase(),
      password: passwordInput.value,
      confirmPassword: document.getElementById('confirmPassword')?.value || '',
    };

    const isValid = pageType === 'signup' ? validateSignup(values) : validateLogin(values);
    if (!isValid) {
      showStatus('Please review the highlighted fields.', 'error');
      form.querySelector('.is-invalid')?.focus();
      return;
    }

    setLoading(true);
    try {
      if (pageType === 'signup') {
        await window.CareerConnectAPI.request('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: values.name, email: values.email, password: values.password }),
        });
        form.reset();
        showStatus('Your account is ready. Redirecting you to sign in…', 'success');
        window.setTimeout(() => {
          window.location.href = `./login.html?registered=1&email=${encodeURIComponent(values.email)}`;
        }, 900);
      } else {
        const result = await window.CareerConnectAPI.request('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: values.email, password: values.password }),
        });
        sessionStorage.setItem('careerconnect.user', JSON.stringify(result.user));
        showStatus('Welcome back. Opening your workspace…', 'success');
        window.setTimeout(() => {
          window.location.href = '../dashboard/index.html';
        }, 650);
      }
    } catch (error) {
      showStatus(error.message, 'error');
    } finally {
      setLoading(false);
    }
  });

  if (pageType === 'login') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('registered') === '1') {
      const email = params.get('email');
      if (email) document.getElementById('email').value = email;
      showStatus('Account created successfully. Sign in to continue.', 'success');
    }
  }
});
