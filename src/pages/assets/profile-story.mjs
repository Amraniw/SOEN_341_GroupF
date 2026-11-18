import { readSkills, readEntries, entryDate } from './profile-fields.mjs';

// Existing free text stays verbatim; structured entries show only supplied fields.
export function renderProfileStory(profile, escape, { idPrefix = 'profile', showMissing = true } = {}) {
  const fields = [['summary', 'About'], ['skills', 'Skills'], ['experience', 'Experience'], ['education', 'Education']];
  const missing = [];
  const sections = fields.map(([key, label]) => {
    const value = profile[key]?.trim();
    if (!value) { missing.push(key === 'summary' ? 'a summary' : key); return ''; }
    let content;
    if (key === 'skills') {
      content = `<ul class="profile-skill-list" aria-label="Skills">${readSkills(value).map((skill) => `<li>${escape(skill)}</li>`).join('')}</ul>`;
    } else if (key === 'experience' || key === 'education') {
      const entries = readEntries(value, key);
      content = `<ul class="profile-records">${entries.map((entry) => {
        const title = key === 'experience' ? entry.company : entry.institution;
        const organization = key === 'experience' ? entry.role : entry.program;
        const dates = [entryDate(entry.start), entry.present ? 'Present' : entryDate(entry.end)].filter(Boolean).join(' – ');
        return `<li>${title ? `<strong class="profile-record-title">${escape(title)}</strong>` : ''}${organization ? `<span class="profile-record-organization">${escape(organization)}</span>` : ''}${dates ? `<span class="profile-record-dates">${escape(dates)}</span>` : ''}${entry.description ? `<p>${escape(entry.description)}</p>` : ''}${entry.legacy ? `<p>${escape(entry.legacy)}</p>` : ''}</li>`;
      }).join('')}</ul>`;
    } else {
      content = `<p class="profile-about">${escape(value)}</p>`;
    }
    const headingId = escape(`${idPrefix}-${key}-heading`);
    return `<section class="profile-story-section profile-story-${key}" aria-labelledby="${headingId}"><h3 id="${headingId}">${label}</h3>${content}</section>`;
  }).join('');
  return sections + (showMissing && missing.length ? `<p class="profile-missing">Add ${escape(missing.join(', '))} using Edit profile.</p>` : '');
}
