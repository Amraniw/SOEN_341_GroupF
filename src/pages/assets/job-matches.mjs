import { jobUrl } from './job-context.mjs';

const outcomes = {
  no_matches: 'No strong matches found right now.',
  no_open_jobs: 'There are no open postings to match right now.',
  stale_matches: 'The recommended postings changed while matching. Try again for current opportunities.',
};

const errors = {
  ai_not_configured: 'AI matching needs server setup. Ask the site administrator to enable it.',
  ai_authentication: 'OpenAI rejected the server configuration. Ask the site administrator to check it.',
  ai_model_unavailable: 'The configured AI model is unavailable. Ask the site administrator to check it.',
  ai_usage_limit: 'AI matching reached its usage limit. Try again later.',
  ai_connection: 'The server could not reach OpenAI. Please try again.',
  ai_timeout: 'Matching took too long. Please try again.',
  ai_invalid_output: 'AI returned recommendations we couldn’t verify. Please try again.',
  pdf_extraction_unavailable: 'PDF text extraction is temporarily unavailable. Please try again.',
};

const unreadableResults = 'We couldn’t read these recommendations. Please try again.';
const hasText = (value) => typeof value === 'string' && Boolean(value.trim());

function readMatch(match) {
  const job = match?.job;
  if (!Number.isSafeInteger(job?.id) || job.id < 1 || !hasText(job.title) || !hasText(job.company)) return null;
  const alignment = match.alignment === 'strong' ? 'strong' : 'potential';
  const strengths = Array.isArray(match.strengths) ? match.strengths.filter(hasText).slice(0, 3) : [];
  if (strengths.length) {
    return { job, alignment, strengths, summary: hasText(match.summary) ? match.summary : '',
      consideration: hasText(match.consideration) ? match.consideration : null };
  }

  // The earlier endpoint returned evidence pairs instead of presentation fields.
  const evidence = Array.isArray(match.reasons) ? match.reasons.filter((reason) =>
    hasText(reason?.resumeEvidence) && hasText(reason?.postingEvidence)).slice(0, 3) : [];
  if (!evidence.length) return null;
  const { resumeEvidence, postingEvidence } = evidence[0];
  const experience = alignment === 'strong' ? 'shows relevant experience' : 'shows experience that could transfer to this work';
  const phrase = (text) => text.trim().replace(/[.!?]+$/u, '');
  return {
    job, alignment, consideration: null,
    summary: `The role calls for work such as “${phrase(postingEvidence)}”. Your resume ${experience}, including “${phrase(resumeEvidence)}”.`,
    strengths: [...new Set(evidence.map((reason) => reason.resumeEvidence))],
  };
}

function renderMatch(document, { job, alignment, summary, strengths, consideration }, icon, initials) {
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function symbol(name) {
    const node = element('span', null, 'job-match-symbol');
    node.setAttribute('aria-hidden', 'true');
    node.innerHTML = icon(name);
    return node;
  }
  const card = element('li', null, 'job-match-card');
  const identity = element('div', null, 'job-match-identity');
  const mark = element('span', initials(job.company), 'company-mark');
  mark.setAttribute('aria-hidden', 'true');
  const heading = element('div');
  heading.append(element('p', job.company, 'job-match-company'), element('h3', job.title));
  identity.append(mark, heading);
  const details = [job.location, job.workplaceType, job.isDemo && 'Demo posting'].filter(hasText).join(' · ');
  const alignmentLabel = element('span', alignment === 'strong' ? 'Strong alignment' : 'Potential fit', 'job-match-alignment');
  alignmentLabel.dataset.alignment = alignment;
  card.append(identity, element('p', details, 'job-match-metadata'), alignmentLabel);
  if (summary) card.append(element('p', summary, 'job-match-summary'));
  const evidence = element('ul', null, 'job-match-strengths');
  evidence.setAttribute('aria-label', 'Alignment strengths');
  for (const strength of strengths) {
    const point = element('li');
    point.append(symbol('check'), element('span', strength));
    evidence.append(point);
  }
  card.append(evidence);
  if (consideration) {
    const note = element('p', null, 'job-match-consideration');
    note.append(element('strong', 'Worth noting'), element('span', consideration));
    card.append(note);
  }
  const link = element('a', 'View job', 'text-link');
  link.href = jobUrl(job.id, {}, '/workspace/jobs/');
  link.setAttribute('aria-label', `View job · ${job.title}`);
  link.append(symbol('arrow'));
  card.append(link);
  return card;
}

export function initJobMatches({ document, request, icon, initials, open }) {
  const panel = document.querySelector('#job-matches');
  const toggle = panel.querySelector('#job-match-toggle');
  const disclosure = panel.querySelector('#job-match-disclosure');
  const resume = panel.querySelector('#job-match-resume');
  const sourceLabel = panel.querySelector('#job-match-source-label');
  const button = panel.querySelector('#job-match-action');
  const buttonLabel = panel.querySelector('#job-match-action-label');
  const status = panel.querySelector('#job-match-status');
  const browse = panel.querySelector('#job-match-browse');
  const list = panel.querySelector('#job-match-results');
  let defaultResume;
  let busy = false;

  function showDefault(value) {
    defaultResume = value;
    sourceLabel.hidden = !value;
    resume.textContent = value?.originalName || 'No default resume';
  }

  function setState(message, state) {
    status.textContent = message;
    panel.dataset.state = state;
    browse.hidden = state !== 'empty';
  }

  function setButton(label, disabled) {
    buttonLabel.textContent = label;
    button.setAttribute('aria-disabled', String(disabled));
  }

  function setExpanded(expanded) {
    toggle.setAttribute('aria-expanded', String(expanded));
    disclosure.inert = !expanded;
  }

  async function loadDefault() {
    busy = true;
    setButton('Find my matches', true);
    try {
      const result = await request('/resumes/current', undefined, 'GET');
      showDefault(result.resume);
      if (!defaultResume) setState('Set a default resume to discover jobs aligned with your experience.', 'setup');
      setButton('Find my matches', !defaultResume);
      return true;
    } catch (error) {
      showDefault(null);
      resume.textContent = 'Default resume unavailable';
      setState(error.status === 401 ? 'Sign in again to find your matches.' : 'We couldn’t load your default resume. Try again.', 'error');
      setButton('Retry loading resume', false);
      return false;
    } finally {
      busy = false;
    }
  }

  button.addEventListener('click', async () => {
    if (busy || button.getAttribute('aria-disabled') === 'true') return;
    if (!defaultResume) {
      setState('', 'idle');
      await loadDefault();
      return;
    }

    busy = true;
    setButton('Analyzing…', true);
    setState('Reviewing your default resume…', 'loading');
    list.replaceChildren();
    list.setAttribute('aria-busy', 'true');
    const activity = setTimeout(() => {
      status.textContent = 'Comparing your experience with current opportunities…';
    }, 2200);
    try {
      const result = await request('/job-matches', {});
      if (hasText(result?.resume?.originalName)) showDefault(result.resume);
      const matches = Array.isArray(result?.matches) ? result.matches.map(readMatch).filter(Boolean) : [];
      const count = matches.length;
      if (!Array.isArray(result?.matches) || (result.matches.length && !count)) {
        setState(unreadableResults, 'error');
        setButton('Try again', false);
      } else {
        list.replaceChildren(...matches.map((match) => renderMatch(document, match, icon, initials)));
        setState(count ? `${count} ${count === 1 ? 'role' : 'roles'} to explore` : outcomes[result.outcome] ?? outcomes.no_matches, count ? 'complete' : 'empty');
        setButton('Find matches again', false);
      }
    } catch (error) {
      const message = errors[error.code] || (error.status === 401 ? 'Sign in again to find your matches.' :
        Number.isInteger(error.status) && hasText(error.message) ? error.message : unreadableResults);
      setState(message, 'error');
      clearTimeout(activity);
      if (error.code === 'no_resume' || error.code === 'resume_changed') {
        if (await loadDefault()) setButton('Find my matches', !defaultResume);
      } else {
        setButton('Try again', false);
      }
    } finally {
      clearTimeout(activity);
      busy = false;
      list.setAttribute('aria-busy', 'false');
    }
  });

  setExpanded(open);
  toggle.addEventListener('click', () => {
    disclosure.classList.add('can-transition');
    setExpanded(toggle.getAttribute('aria-expanded') !== 'true');
  });
  panel.hidden = false;
  document.querySelector('#main').classList.add('jobs-with-matches');
  return loadDefault();
}
