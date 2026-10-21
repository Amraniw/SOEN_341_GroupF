import { escapeHtml } from './ui.js';
import { jobCard } from './job-card.js';
import { FILTER_KEYS, searchState, searchParams, jobsUrl, fetchJobs } from './job-shared.js';
import { initJobShell } from './job-shell.js';

if (await initJobShell()) {
  const form = document.querySelector('#job-search');
  const category = document.querySelector('#job-category');
  const list = document.querySelector('#job-list');
  const status = document.querySelector('#results-status');
  const feedback = document.querySelector('#jobs-feedback');
  const active = document.querySelector('#active-filters');
  const demo = document.querySelector('#demo-notice');
  let filters = searchState();
  let categories = [];
  let controller;
  let generation = 0;
  let hasResults = false;

  function syncForm(preserveDraft = false) {
    for (const key of ['q', 'location']) {
      const field = form.elements[key];
      if (!preserveDraft || field.value === field.defaultValue) field.value = filters[key];
    }
    syncCategories();
  }

  function syncCategories() {
    category.innerHTML = '<option value="">All categories</option>' + categories.map(({ id, name }) => `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`).join('');
    if (filters.category && !categories.some(({ id }) => id === filters.category)) {
      const option = new Option(filters.category, filters.category);
      category.add(option);
    }
    category.value = filters.category;
  }

  function renderFilters() {
    const labels = { q: 'Keywords', location: 'Location', category: 'Category' };
    const keys = FILTER_KEYS.filter((key) => filters[key]);
    active.hidden = keys.length === 0;
    active.innerHTML = keys.map((key) => {
      const value = key === 'category' ? categories.find(({ id }) => id === filters[key])?.name || filters[key] : filters[key];
      return `<button class="filter-chip" type="button" data-remove="${key}" aria-label="Remove ${escapeHtml(labels[key])} filter: ${escapeHtml(value)}"><span>${escapeHtml(labels[key])}: ${escapeHtml(value)}</span><span aria-hidden="true">×</span></button>`;
    }).join('') + (keys.length ? '<button class="text-link clear-filters" type="button" data-clear>Clear all</button>' : '');
  }

  function showSkeletons() {
    list.innerHTML = Array.from({ length: 3 }, () => '<li class="job-card job-skeleton" aria-hidden="true"><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div></li>').join('');
  }

  async function loadJobs() {
    controller?.abort();
    controller = new AbortController();
    const requestId = ++generation;
    let timedOut = false;
    const currentController = controller;
    const timeout = setTimeout(() => { timedOut = true; currentController.abort(); }, 15000);
    list.setAttribute('aria-busy', 'true');
    list.classList.add('is-updating');
    status.textContent = hasResults ? 'Updating results...' : 'Loading jobs...';
    feedback.hidden = true;
    if (!hasResults) showSkeletons();

    try {
      const query = searchParams(filters);
      const result = await fetchJobs(query ? `?${query}` : '', controller.signal);
      if (requestId !== generation) return;
      categories = result.categories;
      syncCategories();
      renderFilters();
      status.textContent = `${result.total} ${result.total === 1 ? 'job' : 'jobs'}${filters.q ? ` for “${filters.q}”` : ' available'}`;
      demo.hidden = !result.hasDemo;
      list.innerHTML = result.items.map((job) => jobCard(job, filters, result.demoOnly)).join('');
      hasResults = true;
      if (!result.total) {
        feedback.innerHTML = '<div class="jobs-state"><span class="eyebrow">A LITTLE MORE ROOM TO SEARCH</span><h3>No jobs match these filters.</h3><p>Try removing a filter or using broader search terms.</p><button class="button button-secondary" type="button" data-clear>Clear filters</button></div>';
        feedback.hidden = false;
      }
    } catch (error) {
      if (requestId !== generation || (error.name === 'AbortError' && !timedOut)) return;
      list.innerHTML = '';
      hasResults = false;
      demo.hidden = true;
      status.textContent = 'Jobs could not be loaded.';
      feedback.innerHTML = `<div class="jobs-state" role="alert"><h3>We couldn’t load jobs.</h3><p>${escapeHtml(timedOut ? 'The request timed out. Please try again.' : error.message)}</p><button class="button button-secondary" type="button" data-retry>Try again</button></div>`;
      feedback.hidden = false;
    } finally {
      clearTimeout(timeout);
      if (requestId === generation) {
        list.setAttribute('aria-busy', 'false');
        list.classList.remove('is-updating');
      }
    }
  }

  function applyFilters(next, push = true) {
    filters = next;
    const url = jobsUrl(filters);
    if (push && location.pathname + location.search !== url) history.pushState(null, '', url);
    syncForm();
    renderFilters();
    loadJobs();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = new FormData(form);
    applyFilters(Object.fromEntries(FILTER_KEYS.map((key) => [key, values.get(key).trim().replace(/\s+/g, ' ')])));
  });
  category.addEventListener('change', () => form.requestSubmit());
  document.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-remove]');
    if (remove) {
      const key = remove.dataset.remove;
      applyFilters({ ...filters, [key]: '' });
      form.elements[key].focus();
    } else if (event.target.closest('[data-clear]')) {
      applyFilters({ q: '', location: '', category: '' });
      form.elements.q.focus();
    } else if (event.target.closest('[data-retry]')) {
      loadJobs();
    }
  });
  addEventListener('popstate', () => applyFilters(searchState(), false));
  addEventListener('pagehide', () => controller?.abort());
  // Session management refreshes restored documents before their data is reused.
  syncForm(true);
  renderFilters();
  loadJobs();
}
