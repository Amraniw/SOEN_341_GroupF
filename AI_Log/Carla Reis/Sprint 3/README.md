# AI Logs — Sprint 3

This document records the main AI-assisted planning and requirements activities carried out during Sprint 3 of CareerConnect. Claude was used to implement the notifications and reminders and to write the user cases.

## Task 3 — Notifications and Reminders (US-16)
**Claude Chat Link:** https://claude.ai/share/c6a02c8c-1454-45bf-8e0a-c9045ffc5253

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

## User Cases for All User Stories and GitHub Issues
**Claude Chat Link:** https://claude.ai/share/a7532ae5-b1bf-48fc-8aff-44834a0e8f72

**Purpose of AI Use:** 
Requirements documentation: writing user cases with acceptance criteria based on our implementation, and preparing them to be added as GitHub Issues.

**Prompt:**
- "I have to implement user cases for Sprint 3, these the features we implemented for the sprint [...] Can you please give me some user cases"
- "You have to do them based on our implementation, ill send it now" (then uploaded the project repository, SOEN_341_GroupF-main.zip)
- "Can you actually do a user case for all the user stories we have so far"
- "Can you do like one user case per like user story"

**AI-Suggested Content:** 
Claude first wrote generic user stories from my feature descriptions. After I uploaded the repository, it read the routes, domain logic, database triggers and front-end pages and rewrote the user cases to match what is actually implemented. When I asked for all user stories, it extended Documentation/User_Cases.md to cover the 12 stories implemented so far (US-01 to US-10, US-16, US-17), each split into smaller user cases written as "As a… I want… so that…" with acceptance criteria, and a table showing which sprint each story belongs to. It separated US-08 (reviewing applicants) from US-09 (posting management) to match our sprint documents. It also pointed out where my feature descriptions did not match the code: (1) postings are archived with Close/Reopen, and postings with applications cannot be deleted; (2) the recruiter applicant filter only offers status in the UI, although the backend supports a date range; (3) the closing reminder is sent to matching job seekers, not recruiters; (4) the statuses are Applied, Under Review, Interview, Offered and Rejected (no "Pending"); (5) AI feedback only works on saved PDF resumes and is not stored; (6) no US-11 to US-15 were found in our documents, and saved jobs/favourites are not implemented. Since Claude could not access our GitHub repository directly, it generated a GitHub CLI script (create_user_case_issues.sh) and a copy-paste file (User_Case_Issues.md) to create one issue per user story, each containing all its user cases and labelled user case and its story ID (e.g. US-08).

**Validation:** 
Compared the user cases and acceptance criteria with the running app and the code (sign-up and login, profile, resumes, job search, applications, recruiter dashboard, notifications and AI Resume Review). Checked that statuses, field limits, file limits (5 MB PDF resumes, 2 MB JPG/PNG pictures) and error messages match the implementation. Previewed the script with its dry-run mode before creating the issues, and checked the created issues on GitHub.

**Decision:** 
Modified before use. I rejected the first generic version because it described features we did not build (for example an "Archived" tab and a "Hired" status). I first had one issue per user case (37 issues), then changed it to one issue per user story (12 issues) as requested by my teammate. I left out the welcome and idle-warning notifications since they are not part of our user stories.

**Reflection:** 
Writing the user cases from the code made them accurate and testable, and it exposed gaps between what we planned and what we built, such as the missing date filter in the recruiter UI. AI-generated requirements still need to be checked against the real system, because the first version sounded reasonable but did not match our app.

**Responsible Person:** 
Carla Sophia Reis Lopez
