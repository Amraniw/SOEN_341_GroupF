import { icon } from './ui.js';

const preview = document.querySelector('.product-preview');

if (preview) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const windowSurface = preview.querySelector('.preview-window');
  const title = preview.querySelector('[data-preview-title]');
  const copy = preview.querySelector('[data-preview-copy]');
  const resumeRow = preview.querySelector('[data-preview-resume]');
  const resumeLabel = preview.querySelector('[data-preview-resume-label]');
  const resumeBadge = preview.querySelector('[data-preview-resume-badge]');
  const controls = [...preview.querySelectorAll('[data-preview-step]')];
  const states = {
    account: {
      title: 'A good place to start.',
      copy: 'One account. Your next chapter.',
      resumeLabel: 'Add your resume',
      resumeBadge: 'Next step',
      label:
        'Illustrative workspace preview. Account created; resume is the next step.',
    },
    resume: {
      title: 'Your essentials, together.',
      copy: 'Your workspace is ready for what comes next.',
      resumeLabel: 'Resume uploaded',
      resumeBadge: 'Ready',
      label:
        'Illustrative workspace preview. Account and resume are complete; workspace is ready.',
    },
  };
  let state = 'account';
  let changeTimer;

  function render(nextState) {
    if (nextState === state || !states[nextState]) return;
    clearTimeout(changeTimer);
    preview.classList.add('is-changing');
    changeTimer = setTimeout(
      () => {
        state = nextState;
        const next = states[state];
        title.textContent = next.title;
        copy.textContent = next.copy;
        resumeLabel.textContent = next.resumeLabel;
        resumeBadge.textContent = next.resumeBadge;
        resumeBadge.className = `badge ${state === 'resume' ? 'badge-success' : 'badge-neutral'}`;
        resumeRow.querySelector('.icon').outerHTML = icon(
          state === 'resume' ? 'check' : 'file'
        );
        preview.dataset.previewState = state;
        windowSurface.setAttribute('aria-label', next.label);
        controls.forEach((control) =>
          control.setAttribute(
            'aria-pressed',
            String(control.dataset.previewStep === state)
          )
        );
        requestAnimationFrame(() => preview.classList.remove('is-changing'));
      },
      reduceMotion ? 0 : 120
    );
  }

  controls.forEach((control) =>
    control.addEventListener('click', () => render(control.dataset.previewStep))
  );

  const pointerMotion = matchMedia(
    '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'
  );
  let frame;
  function updatePointer(event) {
    if (!pointerMotion.matches) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const bounds = preview.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width;
      const y = (event.clientY - bounds.top) / bounds.height;
      preview.style.setProperty('--pointer-x', `${x * 100}%`);
      preview.style.setProperty('--pointer-y', `${y * 100}%`);
      preview.style.setProperty('--pointer-opacity', '1');
      preview.style.setProperty('--preview-shift-x', `${(x - 0.5) * 6}px`);
      preview.style.setProperty('--preview-shift-y', `${(y - 0.5) * 6}px`);
    });
  }
  preview.addEventListener('pointermove', updatePointer, { passive: true });
  preview.addEventListener('pointerleave', () => {
    preview.style.setProperty('--pointer-opacity', '0');
    preview.style.setProperty('--preview-shift-x', '0px');
    preview.style.setProperty('--preview-shift-y', '0px');
  });
}
