export function activityDays(items, range, now = new Date()) {
  const year = now.getUTCFullYear();
  const end = new Date(Date.UTC(year, 11, 31));
  const counts = new Map();
  for (const item of items) {
    const day = item.appliedAt.slice(0, 10);
    counts.set(day, (counts.get(day) || 0) + 1);
  }
  const start = new Date(Date.UTC(year, 0, 1));
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const days = [];
  for (const day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    const date = day.toISOString().slice(0, 10);
    const inYear = day.getUTCFullYear() === year;
    days.push({ date, inYear, future: date > now.toISOString().slice(0, 10), count: inYear ? counts.get(date) || 0 : 0, month: inYear && day.getUTCDate() === 1 ? day.toLocaleDateString('en', { month: 'short', timeZone: 'UTC' }) : '' });
  }
  return days;
}

export function renderActivity(items, range, escape, now = new Date()) {
  const year = now.getUTCFullYear();
  const days = activityDays(items, range, now);
  const max = Math.max(1, ...days.map((d) => d.count));
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return `<section class="activity-calendar"><div class="calendar-heading"><div><h3>Application activity</h3><p>${days.reduce((sum, day) => sum + day.count, 0)} applications in ${year}</p></div><span class="calendar-year">${year}</span></div><div class="calendar-scroll"><div class="calendar-grid"><div class="calendar-weekdays"><span></span><span>Mon</span><span>Wed</span><span>Fri</span></div>${weeks.map((week) => `<div class="calendar-week"><span class="calendar-month">${escape(week.find((day) => day.month)?.month || '')}</span>${week.map((day) => { if (!day.inYear) return '<span class="calendar-padding"></span>'; const label = day.future ? `${day.date}: upcoming day` : `${day.date}: ${day.count} ${day.count === 1 ? 'application' : 'applications'}`; return `<button type="button" class="calendar-day ${day.future ? 'calendar-future' : ''} level-${day.count ? Math.max(1, Math.ceil(day.count / max * 4)) : 0}" title="${label}" aria-label="${label}" data-day-label="${label}"></button>`; }).join('')}</div>`).join('')}</div></div><div class="calendar-footer"><span class="calendar-selection" role="status">January–December ${year} · Each square is one day (UTC).</span><div class="calendar-legend">Less ${[0,1,2,3,4].map((n) => `<i class="calendar-day level-${n}"></i>`).join('')} More</div></div></section>`;
}

export function renderHistory(history, escape, format) {
  const first = history[0];
  const latest = history.at(-1);
  const visible = !first ? [] : first === latest || latest.status === 'applied' ? [latest] : [first, latest];
  return `<ol class="event-timeline">${visible.map((event, index) => `<li class="event-node ${index === visible.length - 1 ? 'event-current' : ''}"><span class="event-pin" aria-hidden="true"></span><div><strong>${escape(event.statusLabel)}</strong>${index === visible.length - 1 ? '<span class="event-current-label">Current status</span>' : ''}<time>${escape(format(event.changedAt))}</time></div></li>`).join('')}</ol><p class="timeline-note">Your submission and current application status.</p>`;
}
