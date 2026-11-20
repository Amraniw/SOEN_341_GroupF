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
let selected = 0;

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
