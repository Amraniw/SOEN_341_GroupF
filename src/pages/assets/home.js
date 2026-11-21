import './ui.js';
import { initPublicHeader } from './public-header.js';
import { workspaceHome } from './workspace-role.mjs';

const primaryLinks = document.querySelectorAll('[data-home-primary]');
const footer = document.querySelector('[data-home-footer]');
const jobLinks = document.querySelectorAll('[data-home-jobs]');
const seekerLinks = document.querySelectorAll('[data-seeker-entry]');
const recruiterLink = document.querySelector('[data-home-recruiter]');

function setEntry(link, path, label) {
  link.href = path;
  link.querySelector('[data-entry-label]').textContent = label;
}

initPublicHeader({
  onSessionChange(session) {
    const role = session?.user.role;
    const recruiter = role === 'recruiter';
    const home = workspaceHome(role);
    const label = recruiter ? 'Recruiter workspace' : 'Your workspace';
    primaryLinks.forEach((link) => {
      setEntry(link, session ? home : '/auth/signup.html', session ? label : 'Create account');
    });
    setEntry(footer, session ? home : '/auth/login.html', session ? label : 'Sign in');
    jobLinks.forEach((link) => { link.href = session ? '/workspace/jobs/' : '/jobs/'; });
    recruiterLink.hidden = Boolean(session) && !recruiter;
    seekerLinks.forEach((link) => {
      link.hidden = recruiter;
      if (session && !recruiter) setEntry(link, link.dataset.seekerEntry, link.dataset.signedInLabel);
    });
  },
});

// Keep section links on this document whether the home page opened at / or /index.html.
document.querySelectorAll('[data-public-header] .public-nav a[href*="#"]').forEach((link) => {
  link.href = link.hash;
});

const tabList = document.querySelector('.home-preview-tabs');
const tabs = Array.from(tabList.querySelectorAll('[role="tab"]'));
const panels = tabs.map((tab) => document.getElementById(tab.getAttribute('aria-controls')));
const previewGuide = document.querySelector('.preview-guide');
const tipTitle = document.getElementById('preview-tip-title');
const tipCopy = document.getElementById('preview-tip-copy');
const previewNext = document.querySelector('.preview-next');
const nextTitle = document.getElementById('preview-next-title');
const tips = {
  'preview-jobs': ['Try a keyword', 'Search for a title or company, then open a sample posting to see what the role involves.'],
  'preview-resumes': ['Find the default PDF', 'The Default label shows which resume is ready to use when you apply.'],
  'preview-review': ['See an example edit', 'The sample review pairs an aligned role with a concrete suggestion for improving the resume.'],
  'preview-applications': ['Read the timeline', 'See where a sample application stands and which stages it passed to get there.'],
};
let selected = 0;

function updatePreviewCards() {
  const [title, copy] = tips[panels[selected].id];
  const next = (selected + 1) % tabs.length;
  tipTitle.textContent = title;
  tipCopy.textContent = copy;
  nextTitle.textContent = tabs[next].textContent.trim();
  previewNext.setAttribute('aria-controls', panels[next].id);
}

function selectTab(index) {
  if (index === selected) return;
  selected = index;
  tabList.style.setProperty('--active-tab', index);
  tabs.forEach((tab, position) => {
    const active = position === index;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    panels[position].hidden = !active;
  });
  updatePreviewCards();
}

tabs.forEach((tab, index) => {
  panels[index].setAttribute('role', 'tabpanel');
  panels[index].setAttribute('aria-labelledby', tab.id);
  panels[index].tabIndex = 0;

  tab.addEventListener('click', () => selectTab(index));
  tab.addEventListener('keydown', (event) => {
    const target = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    if (typeof target !== 'number') return;
    event.preventDefault();
    selectTab(target);
    tabs[target].focus();
  });
});
tabList.hidden = false;
updatePreviewCards();
previewGuide.hidden = false;
previewNext.hidden = false;
previewNext.addEventListener('click', () => {
  const next = (selected + 1) % tabs.length;
  selectTab(next);
  tabs[next].focus();
});

const sampleSearch = document.getElementById('preview-job-search');
const sampleStatus = document.getElementById('preview-search-status');
const sampleCount = document.getElementById('preview-result-count');
const sampleJobs = Array.from(document.querySelectorAll('#preview-job-results li'), (row) => ({
  row,
  searchable: row.textContent.toLowerCase().replace(/\s+/g, ' '),
}));

sampleSearch.addEventListener('input', () => {
  const terms = sampleSearch.value.trim().toLowerCase().split(/\s+/);
  const count = sampleJobs.reduce((total, { row, searchable }) => {
    row.hidden = !terms.every((term) => searchable.includes(term));
    return total + Number(!row.hidden);
  }, 0);
  sampleCount.textContent = `${count} sample ${count === 1 ? 'role' : 'roles'}`;
  sampleStatus.textContent = !count ? 'No example jobs match. Try “software”.' : sampleSearch.value.trim()
    ? `${count} example ${count === 1 ? 'job' : 'jobs'} found.`
    : '';
});
sampleSearch.closest('label').hidden = false;
document.querySelector('[data-preview-search-fallback]').hidden = true;

const previewStage = document.querySelector('.home-preview-stage');
const tiltEnabled = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
let tiltFrame = 0;

function resetTilt() {
  cancelAnimationFrame(tiltFrame);
  tiltFrame = 0;
  for (const property of ['--preview-tilt-x', '--preview-tilt-y']) previewStage.style.removeProperty(property);
}

previewStage.addEventListener('pointermove', (event) => {
  if (!tiltEnabled.matches || event.pointerType === 'touch') return;
  cancelAnimationFrame(tiltFrame);
  tiltFrame = requestAnimationFrame(() => {
    tiltFrame = 0;
    const { left, top, width, height } = previewStage.getBoundingClientRect();
    const x = Math.max(-0.5, Math.min(0.5, (event.clientX - left) / width - 0.5));
    const y = Math.max(-0.5, Math.min(0.5, (event.clientY - top) / height - 0.5));
    previewStage.style.setProperty('--preview-tilt-x', `${-y * 6}deg`);
    previewStage.style.setProperty('--preview-tilt-y', `${x * 8}deg`);
  });
}, { passive: true });
previewStage.addEventListener('pointerleave', resetTilt);
tiltEnabled.addEventListener('change', resetTilt);
