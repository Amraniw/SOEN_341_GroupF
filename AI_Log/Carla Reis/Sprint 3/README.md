# AI Logs — Sprint 3

This document records the main AI-assisted planning and requirements activities carried out during Sprint 3 of CareerConnect. Claude was used in order to implement the notifications and reminders. Added 

**Claude Chat Link:** https://claude.ai/share/30e9701d-72fa-48d7-9d11-ed2dd90b25e5

## Task 3 — Notifications and Reminders (US-16)

**Purpose of AI Use:**
Code review of existing notification work, feature implementation, and testing.

**Chat Link or Prompt/Response:**
See Claude Chat Link above.

**Prompt:**
"Ok so i just saw that my partner already made some changes for the notifications, from the changes he made can you tell me which notifications he implemented or anything related to notifications and reminders" — followed by — "I dont want you to change any of the stuff he implemented add a notification when a new job that matches your headline or your location, also add a reminder when a job posting is about to close" — and later — "I want that only if you want to be reminded of the job posting closing you select the option of getting reminded."

**AI-Suggested Content:**
Claude reviewed the project's Git history and summarized the notification system already merged by my partner (PR #147): application, status-update and interview notifications, the welcome and idle notifications, the notification bell, popups and the notifications API. It pointed out that `deadline_reminder` was reserved but never created. It then implemented:
(1) a `job_match` notification sent to job seekers when a recruiter posts, edits or reopens a job that matches their profile headline or location;
(2) an optional "Applications close on" date for job postings, shown on the recruiter dashboard and the job page;
(3) an opt-in "Remind me before it closes" button on the job page, a `job_reminders` table and `/api/job-reminders` endpoints, and an hourly check that sends a `deadline_reminder` when the job closes within 2 days, skipping anyone who has already applied.
New code was kept in separate files (`jobAlerts.js`, `jobReminderRoutes.js`, `job-reminder.mjs`) with automated tests in `job-alerts.test.js`.

**Validation:**
Checked that my partner's notification code was left unchanged apart from one added entry (`job_match`) in the list of notification types, which the database needs to accept the new type. Ran the full test suite locally (all tests passing, including the new job-alert tests). Tested in the running app: a recruiter posted a job, a matching job seeker received the notification in the bell, and the reminder button turned on and off, stayed on after a page reload, and sent the reminder for a job closing within 2 days.

**Decision:**
Modified before use. The first version reminded every matching job seeker automatically; I changed it so reminders are only sent to job seekers who choose to be reminded about a specific job.

**Reflection:**
This helped me quickly understand what my partner had already built, so I could add to it without duplicating or breaking his work. It also showed me that the matching rules (headline keywords, city comparison) are a design choice to test and adjust, not something to accept automatically. Jobs still don't close automatically when the closing date passes, which could be a future improvement.

**Responsible Person:**
Carla Sophia Reis Lopez
