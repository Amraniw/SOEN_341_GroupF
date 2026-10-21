import { isWorkspaceJobs, jobsBasePath } from './job-context.mjs';
import { initPublicHeader } from './public-header.js';

export async function initJobShell() {
  const form = document.querySelector('#job-search');
  if (form) form.action = jobsBasePath();
  if (!isWorkspaceJobs()) {
    initPublicHeader();
    return true;
  }

  // Both route families serve the same HTML and behavior. Only the surrounding
  // presentation changes, determined by the URL even on direct access/reload.
  const header = document.querySelector('[data-public-header]');
  header.removeAttribute('data-public-header');
  header.id = 'workspace-header';
  header.className = 'workspace-header';
  const main = document.querySelector('#main');
  main.className = 'workspace-main jobs-workspace-main';
  main.querySelector('.jobs-content').classList.remove('container');
  const workspace = document.createElement('div');
  workspace.setAttribute('data-workspace', '');
  workspace.hidden = true;
  const layout = document.createElement('div');
  layout.className = 'workspace-layout';
  const sidebar = document.createElement('aside');
  sidebar.id = 'workspace-sidebar';
  sidebar.className = 'workspace-sidebar';
  sidebar.setAttribute('aria-label', 'Workspace navigation');
  document.body.append(workspace);
  workspace.append(header, layout);
  layout.append(sidebar, main);
  const { session } = await import('./workspace.js');
  return Boolean(session);
}
