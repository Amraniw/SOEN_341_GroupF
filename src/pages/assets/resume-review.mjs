function failureMessage(error) {
  switch (error.code) {
    case 'pdf_extraction_unavailable': return 'PDF text extraction is unavailable. Ask the site administrator to check the server.';
    case 'ai_authentication': return 'OpenAI rejected the server’s API key. Ask the site administrator to check it.';
    case 'ai_model_unavailable': return 'The configured OpenAI model is unavailable. Ask the site administrator to check it.';
    case 'ai_usage_limit': return 'OpenAI rate or usage limits blocked this review. Try again later or contact the site administrator.';
    case 'ai_connection': return 'The server could not connect to OpenAI. Please try again.';
  }
  switch (error.status) {
    case 404: return 'This resume is no longer available. Select a different saved resume.';
    case 502: return 'AI resume review could not be completed. Please try again.';
    case 503: return 'AI resume review requires server setup. Ask the site administrator to enable it.';
    case 504: return 'AI resume review took too long. Please try again.';
    default: return error.message;
  }
}

export function createResumeReview({ document, request, formatDateTime, onUnauthorized, onSelectionChange = () => {} }) {
  const panel = document.querySelector('#resume-review');
  const form = panel.querySelector('form');
  const select = panel.querySelector('select');
  const button = panel.querySelector('button');
  const actionLabel = button.querySelector('#review-action-label');
  const activity = button.querySelector('.review-activity');
  const status = panel.querySelector('[role="status"]');
  const statusMessage = status.querySelector('#review-status-message');
  const statusFile = status.querySelector('#review-status-file');
  const output = panel.querySelector('#review-output');
  const content = output.querySelector('#review-content');
  const loading = content.querySelector('#review-loading');
  const preview = content.querySelector('#review-preview');
  const result = panel.querySelector('#resume-review-result');
  const profile = result.querySelector('p');
  const noMatches = result.querySelector('#review-no-matches');
  const lists = {
    alignedRoles: result.querySelector('#review-roles'),
    strengths: result.querySelector('#review-strengths'),
    improvements: result.querySelector('#review-improvements'),
  };
  const reviews = new Map();
  let resumes = new Map();
  let pending = false;
  let expansion;

  function render(error = '', { transition = false, reveal = false } = {}) {
    const resume = resumes.get(select.value);
    const feedback = resume && reviews.get(resume.id);
    const showFeedback = !pending && Boolean(feedback?.isResume);
    const roles = Array.isArray(feedback?.alignedRoles) ? feedback.alignedRoles.filter((role) =>
      Number.isSafeInteger(role?.id) && role.id > 0 &&
      typeof role.title === 'string' && role.title.trim() && !/^undefined$/i.test(role.title.trim())
    ) : [];
    const animate = transition && output.animate &&
      !document.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Read the current height before cancelling an interrupted transition.
    const previousHeight = animate ? output.getBoundingClientRect().height : 0;
    expansion?.cancel();
    select.disabled = pending || resumes.size === 0;
    button.disabled = !resume;
    // Keep the submit button focused while the pending guard prevents repeat submissions.
    button.setAttribute('aria-disabled', String(pending || !resume));
    actionLabel.textContent = pending ? 'Analyzing…' : error && resume ? 'Retry analysis'
      : feedback ? 'Analyze again' : 'Analyze resume';
    activity.hidden = !pending;
    button.classList.toggle('is-busy', pending);
    content.setAttribute('aria-busy', String(pending));
    loading.hidden = !pending;
    preview.hidden = pending || Boolean(feedback) || Boolean(error);
    result.hidden = !showFeedback;
    noMatches.hidden = !showFeedback || roles.length > 0;
    onSelectionChange(resume?.id, pending);
    result.classList.toggle('review-reveal', Boolean(animate && reveal && showFeedback));

    status.dataset.state = error ? 'error' : pending ? 'pending'
      : feedback?.isResume ? 'complete' : feedback ? 'non-resume' : 'idle';
    let message;
    if (error) message = error;
    else if (!resume) message = resumes.size
      ? 'Choose a saved resume to review.' : 'Upload a PDF to request a review.';
    else if (pending) message = 'Reviewing';
    else if (!feedback) message = 'Ready to analyze.';
    else if (!feedback.isResume) message = feedback.nonResumeMessage;
    else message = 'Review complete';
    const file = !error && resume && (pending || showFeedback)
      ? ` ${resume.originalName}${pending ? '…' : ''}` : '';
    if (statusMessage.textContent !== message) statusMessage.textContent = message;
    if (statusFile.textContent !== file) statusFile.textContent = file;
    statusFile.hidden = !file;

    profile.textContent = result.hidden ? '' : feedback.candidateProfile;
    for (const [key, list] of Object.entries(lists)) {
      const values = key === 'alignedRoles' ? roles : feedback?.[key];
      list.replaceChildren(...(result.hidden ? [] : values.map((value) => {
        const item = document.createElement('li');
        if (key === 'alignedRoles') {
          const link = document.createElement('a');
          link.href = `/workspace/jobs/${value.id}`;
          link.textContent = value.title;
          const companyName = typeof value.company === 'string' ? value.company.trim() : '';
          const details = [/^undefined$/i.test(companyName) ? '' : companyName, value.isDemo ? 'Demo posting' : ''].filter(Boolean);
          if (details.length) {
            const company = document.createElement('span');
            company.textContent = details.join(' · ');
            link.append(company);
          }
          item.append(link);
        } else item.textContent = value;
        return item;
      })));
    }
    if (animate) {
      const finalHeight = output.getBoundingClientRect().height;
      if (Math.abs(finalHeight - previousHeight) >= 1) {
        expansion = output.animate([
          { height: `${previousHeight}px`, overflow: 'clip' },
          { height: `${finalHeight}px`, overflow: 'clip' },
        ], { duration: pending ? 220 : 300, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
      }
    }
  }

  function setResumes(items) {
    const selected = select.value;
    resumes = new Map(items.map((resume) => [String(resume.id), resume]));
    for (const id of reviews.keys()) {
      if (!resumes.has(String(id))) reviews.delete(id);
    }
    const names = new Map();
    for (const { originalName } of items) names.set(originalName, (names.get(originalName) || 0) + 1);
    const options = items.map((resume) => {
      const option = document.createElement('option');
      option.value = String(resume.id);
      option.textContent = names.get(resume.originalName) > 1
        ? `${resume.originalName} · ${formatDateTime(resume.uploadedAt)} · #${resume.id}`
        : resume.originalName;
      return option;
    });
    select.replaceChildren(select.options[0], ...options);
    select.value = resumes.has(selected) ? selected : '';
    render(selected && !select.value ? 'The selected resume is no longer saved.' : '');
  }

  select.addEventListener('change', () => render('', { transition: true }));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const resume = resumes.get(select.value);
    if (!resume || pending) return;

    pending = true;
    render('', { transition: true });
    let errorMessage = '';
    let reveal = false;
    try {
      const { resumeId, feedback } = await request(`/resumes/${resume.id}/ai-feedback`, {});
      if (resumeId !== resume.id || !feedback) throw new Error('The review response was incomplete. Please try again.');
      if (resumes.has(String(resume.id))) {
        reviews.set(resume.id, feedback);
        reveal = select.value === String(resume.id);
      }
    } catch (error) {
      if (error.status === 401) onUnauthorized();
      else if (select.value === String(resume.id)) errorMessage = failureMessage(error);
    } finally {
      pending = false;
      render(errorMessage, { transition: true, reveal });
    }
  });

  panel.hidden = false;
  return {
    setResumes,
    selectResume(id) {
      if (pending || !resumes.has(String(id))) return;
      select.value = String(id);
      render('', { transition: true });
      select.focus();
    },
    showLoadError() {
      if (!resumes.size) render('Saved resumes could not be loaded. Refresh the page to try again.');
    },
  };
}
