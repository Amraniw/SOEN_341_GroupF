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
  return `<section class="activity-calendar"><div class="calendar-heading"><div><h3>Application activity</h3><p>${days.reduce((sum, day) => sum + day.count, 0)} applications in ${year}</p></div><span class="calendar-year">${year}</span></div><div class="calendar-scroll"><div class="calendar-grid"><div class="calendar-weekdays"><span></span><span>Mon</span><span>Wed</span><span>Fri</span></div>${weeks.map((week) => `<div class="calendar-week"><span class="calendar-month">${escape(week.find((day) => day.month)?.month || '')}</span>${week.map((day) => { if (!day.inYear) return '<span class="calendar-padding"></span>'; const dateLabel = new Date(`${day.date}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }); const label = `${dateLabel}\n${day.count ? `${day.count} ${day.count === 1 ? "application" : "applications"}` : "No applications"}${day.future ? " · Upcoming day" : ""}`; return `<button type="button" class="calendar-day ${day.future ? 'calendar-future' : ''} level-${day.count ? Math.max(1, Math.ceil(day.count / max * 4)) : 0}" aria-label="${escape(label)}" data-day-label="${escape(label)}"></button>`; }).join('')}</div>`).join('')}</div></div><div class="calendar-footer"><span class="calendar-selection" role="status">January–December ${year} · Each square is one day (UTC).</span><div class="calendar-legend">Less ${[0,1,2,3,4].map((n) => `<i class="calendar-day level-${n}"></i>`).join('')} More</div></div></section>`;
}

export function coherentHistory(history) {
  if (!history.length) return [];
  const latest = history.at(-1);
  const stages = ['applied', 'under_review', 'interview', 'offered'];
  const visible = [latest];
  let ceiling = latest.status === 'rejected' ? 3 : stages.indexOf(latest.status);
  // Walk backward from the authoritative current state. Strictly decreasing
  // ranks retain real chronological stages without repeats or conflicting ends.
  for (let index = history.length - 2; index >= 0; index -= 1) {
    const event = history[index];
    const rank = stages.indexOf(event.status);
    if (rank >= 0 && rank < ceiling) {
      visible.unshift(event);
      ceiling = rank;
    }
  }
  return visible;
}

export function renderHistory(history, escape, format) {
  const visible = coherentHistory(history);
  if (!visible.length) return '<p class="timeline-note">No status history is available yet.</p>';
  const current = visible.at(-1).status;
  const stages = [{ status: 'applied', statusLabel: 'Applied' }, { status: 'under_review', statusLabel: 'Under Review' }, { status: 'interview', statusLabel: 'Interview' }, { status: 'offered', statusLabel: 'Offered' }];
  // Only recorded events are completed; skipped stages never imply a decision.
  const future = current === 'rejected' ? [] : stages.slice(stages.findIndex((stage) => stage.status === current) + 1);
  const nodes = [...visible, ...future.map((stage) => ({ ...stage, future: true }))];
  return `<ol class="event-timeline" aria-label="Application status history">${nodes.map((event, index) => `<li class="event-node ${event.future ? "event-future" : index === visible.length - 1 ? "event-current" : "event-complete"} ${event.status === "rejected" ? "event-rejected" : ""}" ${index === visible.length - 1 ? 'aria-current="step"' : ""}><span class="event-pin" aria-hidden="true"></span><strong>${escape(event.statusLabel)}</strong>${index === visible.length - 1 ? '<span class="event-current-label">Current</span>' : ""}${event.future ? '<span class="event-pending">Upcoming</span>' : `<time>${escape(format(event.changedAt))}</time>`}</li>`).join("")}</ol>`;
}
