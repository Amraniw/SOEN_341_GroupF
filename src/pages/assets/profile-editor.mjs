import { readSkills, readEntries, compatibleEntries, entryError } from './profile-fields.mjs';

export function createProfileEditor({ form, escape }) {
  const field = (kind) => form.querySelector(`#${kind}`);
  const roots = {};
  const originals = {};
  const entries = { experience: [], education: [] };
  const removed = {};
  let skills = [];
  let skillOriginal = '';
  let skillInitial = '';
  let sequence = 0;

  for (const kind of ['skills', 'experience', 'education']) {
    const source = field(kind);
    source.hidden = true;
    const wrapper = source.closest('.form-field');
    wrapper.classList.add('profile-collection');
    const oldLabel = wrapper.querySelector('label');
    const label = document.createElement('span');
    label.className = 'collection-label';
    label.id = `${kind}-collection-label`;
    label.textContent = oldLabel.textContent;
    oldLabel.replaceWith(label);
    const root = document.createElement('div');
    root.className = 'collection-editor';
    root.setAttribute('role', 'group');
    root.setAttribute('aria-labelledby', label.id);
    root.setAttribute('aria-describedby', `${kind}-hint ${kind}-error`);
    source.after(root);
    roots[kind] = root;
    wrapper.querySelector('.field-hint').textContent = kind === 'skills'
      ? 'Type a skill, then press Enter or comma. You can also use Add skill.'
      : `Add each ${kind === 'experience' ? 'position' : 'qualification'} separately. Dates and extra details are optional.`;
  }

  function syncSkills() {
    const value = skills.join(', ');
    field('skills').value = JSON.stringify(skills) === skillInitial ? skillOriginal : value;
  }
  function renderSkills() {
    roots.skills.innerHTML = `<ul class="editable-skills" aria-label="Your skills">${skills.map((skill, index) => `<li><span>${escape(skill)}</span><button type="button" data-remove-skill="${index}" aria-label="Remove ${escape(skill)}">×</button></li>`).join('')}</ul><div class="skill-entry"><input type="text" aria-label="Add a skill" placeholder="e.g. SQL" maxlength="500" autocomplete="off"><button type="button" class="button button-secondary" data-add-skill>Add skill</button></div><span class="collection-status" role="status"></span>`;
    syncSkills();
  }
  function addSkill() {
    const input = roots.skills.querySelector('input');
    const proposed = [...skills];
    for (const skill of readSkills(input.value)) if (!proposed.some((existing) => existing.toLowerCase() === skill.toLowerCase())) proposed.push(skill);
    if (proposed.join(', ').length > field('skills').maxLength) {
      document.querySelector('#skills-error').textContent = 'There are too many skills to save. Shorten or remove a skill.';
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return false;
    }
    skills = proposed;
    renderSkills();
    document.querySelector('#skills-error').textContent = '';
    roots.skills.querySelector('input').focus();
    return true;
  }
  roots.skills.addEventListener('keydown', (event) => {
    if (event.target.matches('input') && !event.isComposing && ['Enter', ','].includes(event.key)) { event.preventDefault(); addSkill(); }
  });
  roots.skills.addEventListener('input', (event) => {
    if (event.target.matches('input') && /[,;\n]/.test(event.target.value)) addSkill();
  });
  roots.skills.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-remove-skill]');
    if (remove) {
      const [skill] = skills.splice(Number(remove.dataset.removeSkill), 1);
      renderSkills();
      roots.skills.querySelector('.collection-status').textContent = `${skill} removed.`;
      roots.skills.querySelector('input').focus();
    } else if (event.target.closest('[data-add-skill]')) addSkill();
  });

  function collect(kind) {
    entries[kind] = [...roots[kind].querySelectorAll('.structured-entry')].map((element) => {
      const item = { _id: element.dataset.entryId };
      element.querySelectorAll('[data-entry-field]').forEach((input) => { item[input.dataset.entryField] = input.type === 'checkbox' ? input.checked : input.value; });
      return item;
    });
    field(kind).value = compatibleEntries(originals[kind] || '', entries[kind], kind);
  }
  function input(kind, item, key, label, type = 'text', max = 120) {
    const id = `${kind}-${item._id}-${key}`;
    return `<div class="entry-field"><label for="${id}">${label}</label><input id="${id}" data-entry-field="${key}" type="${type}" ${type === 'text' ? `maxlength="${max}"` : ''} value="${escape(item[key] || '')}" ${key === 'end' && item.present ? 'disabled' : ''}></div>`;
  }
  function renderEntries(kind) {
    const experience = kind === 'experience';
    roots[kind].innerHTML = `<div class="structured-entries">${entries[kind].map((item, index) => `<fieldset class="structured-entry" data-entry-id="${item._id}"><legend>${experience ? 'Experience' : 'Education'} ${index + 1}</legend><button class="entry-remove" type="button" data-remove-entry="${item._id}" aria-label="Remove ${kind} ${index + 1}">Remove</button><div class="entry-grid">${input(kind, item, experience ? 'company' : 'institution', experience ? 'Company' : 'Institution')}${input(kind, item, experience ? 'role' : 'program', experience ? 'Role / position' : 'Program / degree')}${input(kind, item, 'start', 'Start date', 'month')}${input(kind, item, 'end', 'End date', 'month')}${experience ? `<label class="entry-present"><input type="checkbox" data-entry-field="present" ${item.present ? 'checked' : ''}> I currently work here</label><div class="entry-field entry-wide"><label for="${kind}-${item._id}-description">Short description <span>(optional)</span></label><textarea id="${kind}-${item._id}-description" data-entry-field="description" maxlength="500" rows="2">${escape(item.description || '')}</textarea></div>` : ''}${item.legacy !== undefined ? `<div class="entry-field entry-wide"><label for="${kind}-${item._id}-legacy">Existing details</label><textarea id="${kind}-${item._id}-legacy" data-entry-field="legacy" rows="3">${escape(item.legacy)}</textarea><small>Your original text is kept here. You can add structured details above.</small></div>` : ''}</div><p class="entry-error" id="${kind}-${item._id}-error" role="alert"></p></fieldset>`).join('')}</div><div class="collection-actions"><button type="button" class="button button-secondary" data-add-entry>+ Add ${kind}</button>${removed[kind] ? `<span class="collection-status" role="status">Entry removed. <button type="button" class="text-link" data-undo-entry>Undo</button></span>` : ''}</div>`;
  }
  for (const kind of ['experience', 'education']) {
    roots[kind].addEventListener('input', () => collect(kind));
    roots[kind].addEventListener('change', (event) => {
      if (event.target.dataset.entryField === 'present') {
        const end = event.target.closest('.structured-entry').querySelector('[data-entry-field="end"]');
        end.disabled = event.target.checked;
      }
      collect(kind);
    });
    roots[kind].addEventListener('click', (event) => {
      collect(kind);
      const remove = event.target.closest('[data-remove-entry]');
      if (remove) {
        const index = entries[kind].findIndex((item) => item._id === remove.dataset.removeEntry);
        removed[kind] = { index, item: entries[kind].splice(index, 1)[0] };
        renderEntries(kind);
        collect(kind);
        roots[kind].querySelector('[data-undo-entry]').focus();
      } else if (event.target.closest('[data-add-entry]')) {
        const item = { _id: String(++sequence) };
        entries[kind].push(item);
        renderEntries(kind);
        roots[kind].querySelector(`#${kind}-${item._id}-${kind === 'experience' ? 'company' : 'institution'}`).focus();
      } else if (event.target.closest('[data-undo-entry]')) {
        const previous = removed[kind];
        entries[kind].splice(previous.index, 0, previous.item);
        delete removed[kind];
        renderEntries(kind);
        collect(kind);
        roots[kind].querySelector('[data-add-entry]').focus();
      }
    });
  }

  return {
    load(profile) {
      skillOriginal = profile?.skills || '';
      skills = readSkills(skillOriginal);
      skillInitial = JSON.stringify(skills);
      renderSkills();
      for (const kind of ['experience', 'education']) {
        originals[kind] = profile?.[kind] || '';
        entries[kind] = readEntries(originals[kind], kind).map((item) => ({ ...item, _id: String(++sequence) }));
        delete removed[kind];
        renderEntries(kind);
      }
    },
    commit() {
      if (roots.skills.querySelector('input').value.trim() && !addSkill()) return false;
      syncSkills();
      for (const kind of ['experience', 'education']) collect(kind);
      return true;
    },
    validate() {
      for (const kind of ['experience', 'education']) {
        const elements = roots[kind].querySelectorAll('.structured-entry');
        for (let index = 0; index < entries[kind].length; index++) {
          const error = entryError(entries[kind][index], kind);
          elements[index].querySelector('.entry-error').textContent = error;
          elements[index].querySelectorAll('[aria-invalid]').forEach((input) => { input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); });
          if (error) {
            const target = error.startsWith('End date')
              ? elements[index].querySelector('[data-entry-field="end"]')
              : elements[index].querySelector('input');
            target.setAttribute('aria-invalid', 'true');
            target.setAttribute('aria-describedby', elements[index].querySelector('.entry-error').id);
            target.focus();
            return false;
          }
        }
      }
      return true;
    },
    focus(kind) { const root = roots[kind]; if (!root) return false; root.querySelector('input,button').focus(); return true; },
    setBusy(busy) {
      Object.values(roots).forEach((root) => root.querySelectorAll('input,textarea,button').forEach((input) => {
        input.disabled = busy || (input.dataset.entryField === 'end' && input.closest('.structured-entry').querySelector('[data-entry-field="present"]')?.checked);
      }));
    },
  };
}
