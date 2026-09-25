const paths = {
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  home: '<path d="m3 10 9-7 9 7v10H3zM9 20v-7h6v7"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  file: '<path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  briefcase:
    '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12l9 3 9-3M12 12v5"/>',
  building:
    '<path d="M4 21V3h11v18M15 9h5v12M8 7h3M8 11h3M8 15h3M8 21v-3h3v3"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};

export function icon(name, className = '') {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
}

export function escapeHtml(value = '') {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ]
  );
}

export function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => [...part][0])
    .join('')
    .toUpperCase();
}

export function formatDate(value) {
  if (typeof value !== 'string' || !value) return 'Date unavailable';
  const date = new Date(
    value.includes('T') ? value : value.replace(' ', 'T') + 'Z'
  );
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
}

export function formatSize(bytes) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function showMessage(element, message, kind = 'error') {
  element.className = `notice notice-${kind}`;
  element.textContent = message;
  element.hidden = false;
  element.parentElement?.classList.add('has-message');
  element.focus();
}

export function hideMessage(element) {
  element.parentElement?.classList.remove('has-message');
  element.hidden = true;
}

export function initIcons() {
  document.querySelectorAll('[data-icon]').forEach((element) => {
    element.innerHTML = icon(element.dataset.icon);
  });
}

initIcons();

// Motion is progressive enhancement: content remains visible without JavaScript.
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.add('motion-ready');

if (!reduceMotion) {
  requestAnimationFrame(() =>
    document.documentElement.classList.add('page-ready')
  );
  const revealTargets = document.querySelectorAll(
    '.principles > div, .section-intro, .feature, .future-banner, .panel, .next-card, .roadmap'
  );
  revealTargets.forEach((element, index) => {
    element.classList.add('reveal');
    element.style.setProperty('--reveal-order', String(index % 3));
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }),
      { rootMargin: '0px 0px -7% 0px', threshold: 0.08 }
    );
    revealTargets.forEach((element) => observer.observe(element));
  } else {
    revealTargets.forEach((element) => element.classList.add('is-visible'));
  }
}

const publicHeader = document.querySelector('.public-header');
if (publicHeader) {
  const updateHeader = () =>
    publicHeader.classList.toggle('is-scrolled', scrollY > 18);
  updateHeader();
  addEventListener('scroll', updateHeader, { passive: true });
}
