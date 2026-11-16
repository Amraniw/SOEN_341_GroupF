# AI Logs — Sprint 3

This document records the main AI-assisted planning and requirements activities carried out during Sprint 3 of CareerConnect. Claude was used to implement the notifications and reminders and to write the Sprint 3 user cases.

**Claude Chat Link:** https://claude.ai/share/c6a02c8c-1454-45bf-8e0a-c9045ffc5253

## Task 3 — Notifications and Reminders (US-16)

**Purpose of AI Use:**
Code review of existing notification work, feature implementation, and testing.

**Prompt:**
- "Ok so i just saw that my partner already made some changes for the notifications, from the changes he made can you tell me which notifications he implemented or anything related to notifications and reminders"
- "I dont want you to change any of the stuff he implemented add a notification when a new job that matches your headline or your location, also add a reminder when a job posting is about to close"
- "I want that only if you want to be reminded of the job posting closing you select the option of getting reminded."

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

---

## Sprint 3 User Cases

**Claude Chat Link:** https://claude.ai/share/a7532ae5-b1bf-48fc-8aff-44834a0e8f72

**Purpose of AI Use:**
Requirements documentation: writing the Sprint 3 user cases and acceptance criteria based on the features we implemented.

**Prompt:**
- "I have to implement user cases for Sprint 3, these the features we implemented for the sprint [...] Can you please give me some user cases"
- "You have to do them based on our implementation, ill send it now"
- Uploaded the project repository (`SOEN_341_GroupF-main.zip`).

**AI-Suggested Content:**
Claude first wrote generic user stories from my feature descriptions. After I uploaded the repository, it read the routes, domain logic, database triggers and front-end pages, and rewrote the user cases to match what is actually implemented. The result is `Documentation/User_Cases.md`, organized by our backlog IDs (US-08, US-10, US-16, US-17), with each feature split into smaller cases (e.g. US-08.1 to US-08.8) written as "As a… I want… so that…" with acceptance criteria. It also pointed out where my feature descriptions did not match the code:
(1) postings are archived with Close/Reopen, and a posting with applications cannot be deleted;
(2) the recruiter applicant filter only offers status in the UI, even though the backend also supports a date range;
(3) the closing reminder is sent to matching job seekers, not to recruiters;
(4) the application statuses are Applied, Under Review, Interview, Offered and Rejected (there is no "Pending");
(5) AI feedback only works on saved PDF resumes and is not stored, so job-tailored feedback and feedback history were listed as Sprint 4 work.

**Validation:**
Compared each user case and acceptance criterion with the running app and the code (recruiter dashboard, applications dashboard, notification bell, AI Resume Review page). Checked that the statuses, field names, limits (5 MB PDF, 3-day reminder window, 30-second notification refresh) and error messages listed in the user cases match the implementation, and that the acceptance criteria can be linked to our acceptance tests in GitHub Issues.

**Decision:**
Modified before use. I rejected the first generic version because it described features we did not build (for example an "Archived" tab and a "Hired" status) and had Claude rewrite the user cases from our code instead. I left out the welcome and idle-warning notifications since they are not Sprint 3 requirements.

**Reflection:**
Writing the user cases from the actual implementation made them accurate and testable, and it exposed gaps between what we planned and what we built, such as the missing date filter in the recruiter UI and the closing reminder going to job seekers instead of recruiters. These are things to either fix in Sprint 4 or reflect in our feature descriptions. It also showed me that AI-generated requirements need to be checked against the real system, because the first version sounded reasonable but did not match our app.

**Responsible Person:**
Carla Sophia Reis Lopez
