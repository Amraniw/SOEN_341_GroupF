const prefix = (kind) => `CCPROFILE:${kind}:1:`;
const keys = ['company', 'role', 'institution', 'program', 'start', 'end', 'description', 'legacy', 'present'];

export function readSkills(value = '') {
  return [...new Set(value.split(/[,;\n]+/).map((skill) => skill.trim()).filter(Boolean))];
}

export function readEntries(value = '', kind) {
  if (!value.trim()) return [];
  if (value.startsWith(prefix(kind))) {
    try {
      const items = JSON.parse(value.slice(prefix(kind).length));
      if (Array.isArray(items) && items.every((item) => item && typeof item === 'object' && !Array.isArray(item) && Object.keys(item).every((key) => keys.includes(key) && (key === 'present' ? typeof item[key] === 'boolean' : typeof item[key] === 'string')))) return items;
    } catch { /* Unrecognized content remains editable as legacy text. */ }
  }
  return value.split(/\n\s*\n/).filter((entry) => entry.trim()).map((entry) => {
    const text = entry.trim();
    return text.includes('\n') || text.startsWith('CCPROFILE:')
      ? { legacy: text }
      : { [kind === 'experience' ? 'company' : 'institution']: text };
  });
}

export function writeEntries(items, kind) {
  const clean = items.map((item) => Object.fromEntries(keys.flatMap((key) => {
    if (key === 'present') return item.present ? [[key, true]] : [];
    const value = typeof item[key] === 'string' ? item[key].trim() : '';
    return value && !(key === 'end' && item.present) ? [[key, value]] : [];
  }))).filter((item) => Object.keys(item).length);
  return clean.length ? prefix(kind) + JSON.stringify(clean) : '';
}

export function compatibleEntries(original, items, kind) {
  return writeEntries(readEntries(original, kind), kind) === writeEntries(items, kind) ? original : writeEntries(items, kind);
}

export function entryError(item, kind) {
  const populated = keys.some((key) => typeof item[key] === 'string' ? item[key].trim() : item[key]);
  if (!populated) return '';
  const primary = kind === 'experience' ? 'company' : 'institution';
  if (!item[primary]?.trim() && !item.legacy?.trim()) return `Add ${kind === 'experience' ? 'a company' : 'an institution'} or remove this entry.`;
  for (const key of ['start', 'end']) {
    if (key === 'end' && item.present) continue;
    if (item[key] && !/^\d{4}-(0[1-9]|1[0-2])$/.test(item[key])) return 'Choose a valid month and year.';
  }
  if (item.start && item.end && !item.present && item.end < item.start) return 'End date must be after the start date.';
  return '';
}

export function entryDate(value) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value || '')) return value || '';
  return new Date(`${value}-01T00:00:00Z`).toLocaleDateString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
