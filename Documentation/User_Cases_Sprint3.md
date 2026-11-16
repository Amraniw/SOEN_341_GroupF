# Sprint 3 User Cases

These user cases describe the Sprint 3 features as they are implemented in CareerConnect. Each feature matches a Sprint 3 backlog item (US-08, US-10, US-16, US-17) and is broken into smaller user cases with acceptance criteria.

Application statuses used throughout: **Applied, Under Review, Interview, Offered, Rejected**.

---

## US-08 Recruiter Dashboard and Posting Management

### US-08.1 View recruiter overview
**As a** recruiter, **I want** a summary of my postings at the top of my dashboard **so that** I can see my hiring activity at a glance.

**Acceptance criteria**
- The "At a glance" section shows total postings, open postings, closed postings, and total applications received.
- Only the logged-in recruiter's own postings are counted.

### US-08.2 Create a job posting
**As a** recruiter, **I want** to create a job posting from my dashboard **so that** job seekers can find it and apply.

**Acceptance criteria**
- Required fields: title, company, location, category, and description.
- Optional fields: employment type (Full-time, Internship, Contract), workplace type (On-site, Hybrid, Remote), experience level (Intern, Entry-level, Mid-level, Senior), closing date, and structured details (overview, responsibilities, qualifications, preferred skills, benefits, company description).
- Missing or invalid fields show an error and the posting is not saved.
- A new posting is saved as **open**, appears in "My job postings," and shows up in job search right away.
- Creating a posting triggers job-match notifications for job seekers (see US-16.4).

### US-08.3 Edit a job posting
**As a** recruiter, **I want** to edit my postings **so that** I can correct or update them.

**Acceptance criteria**
- The recruiter can update any field of a posting they own; other recruiters' postings cannot be edited (404).
- Saved changes appear in job search right away.
- Editing a posting re-runs job-match alerts and closing reminders.

### US-08.4 Close or reopen a posting (archive)
**As a** recruiter, **I want** to close a posting I no longer want applications for **so that** it is hidden without losing its applicants.

**Acceptance criteria**
- A closed posting is hidden from job search and no longer accepts applications.
- Existing applications on a closed posting are kept and can still be reviewed.
- A closed posting can be reopened at any time; reopening makes it visible again and re-runs job alerts.

### US-08.5 Delete a posting
**As a** recruiter, **I want** to delete a posting created by mistake **so that** my dashboard stays clean.

**Acceptance criteria**
- The recruiter must confirm in a "Permanently delete posting?" dialog before deletion.
- A posting with no applications is permanently deleted.
- A posting that has applications cannot be deleted; the recruiter is told to close it instead.

### US-08.6 View applicants for a posting
**As a** recruiter, **I want** to see everyone who applied to a posting **so that** I can review candidates in one place.

**Acceptance criteria**
- Each posting in "My job postings" shows its application count.
- Opening a posting's applicants shows each candidate's name, email, and profile information, newest first.
- The recruiter can view the resume submitted with the application directly on the page; if none was attached, a message says so.
- Recruiters can only see applicants for their own postings.

### US-08.7 Filter applicants
**As a** recruiter, **I want** to filter applicants by status **so that** I can focus on candidates at a specific stage.

**Acceptance criteria**
- A status dropdown lists all application statuses plus "All statuses."
- Filtering shows only matching applicants and an updated applicant count.
- If no applicants match, "No applicants match these filters." is shown.
- *(Backend also supports filtering by application date range with `from`/`to`; not yet exposed in the UI.)*

### US-08.8 Update an applicant's status
**As a** recruiter, **I want** to change an application's status **so that** the candidate knows where they stand.

**Acceptance criteria**
- The recruiter picks a new status from the dropdown on the candidate card and clicks "Save status."
- The change is saved, recorded in the application's status history, and visible on the job seeker's dashboard.
- The job seeker receives a notification (see US-16.2 and US-16.3).

---

## US-10 Application Analytics and History Dashboard

### US-10.1 View application insights for a time range
**As a** job seeker, **I want** to choose a time range for my application insights **so that** I can look at recent activity or my whole search.

**Acceptance criteria**
- The "Submitted within" selector offers Last 30 days, Last 90 days, and All time (default: 30 days).
- Metrics, charts, and the application list update to the selected range.
- A Refresh button reloads the data.

### US-10.2 View key metrics
**As a** job seeker, **I want** summary numbers about my applications **so that** I can measure my progress quickly.

**Acceptance criteria**
- The dashboard shows applications submitted in range, currently active applications (Applied, Under Review, or Interview), and offers received.

### US-10.3 View status breakdown
**As a** job seeker, **I want** to see how my applications are distributed by status **so that** I understand my outcomes.

**Acceptance criteria**
- A "Current status breakdown" shows a bar and count for each status.
- The counts add up to the total submitted in the selected range.

### US-10.4 View applications over time
**As a** job seeker, **I want** to see how many applications I submitted each month **so that** I can track my job-search activity.

**Acceptance criteria**
- "Applications over time" shows monthly submission totals within the selected range.
- If there are no submissions, "No submissions in this period." is shown.

### US-10.5 View application history and recent activity
**As a** job seeker, **I want** to see my past applications and their status changes **so that** I have a full record of my search.

**Acceptance criteria**
- "Your application journey" lists each application with job title, company, status, and dates.
- "Recent activity" shows the latest status events in the selected range.
- Expanding an application loads its full status timeline (each status and when it changed).

### US-10.6 Filter applications by status
**As a** job seeker, **I want** to filter my applications by status **so that** I can focus on specific ones.

**Acceptance criteria**
- Filtering is available from the "Show status" dropdown or by clicking a status in the summary.
- If no applications have that status, an empty state appears with a "Show all applications" button.

### US-10.7 Restrict analytics to job seekers
**As the** system, **I want** application analytics limited to job seekers **so that** recruiters cannot access them.

**Acceptance criteria**
- A recruiter requesting the analytics endpoint receives a 403 error.

---

## US-16 Notifications and Reminders

### US-16.1 View and manage notifications
**As a** user, **I want** a notification bell **so that** I can see all my updates in one place.

**Acceptance criteria**
- The bell in the workspace header shows a badge with the number of unread notifications.
- The dropdown lists notifications newest first, with how long ago each was sent.
- Clicking a notification marks it as read and opens the related page.
- "Mark all as read" clears the unread count.
- When there are no notifications, "You're all caught up" is shown.
- New notifications are checked every 30 seconds and appear as a popup (toast), which can be clicked or dismissed.

### US-16.2 Application status update notification
**As a** job seeker, **I want** to be notified when my application status changes **so that** I don't have to keep checking.

**Acceptance criteria**
- When a recruiter changes a status (other than to Interview), the job seeker receives an "Application update" notification naming the job, company, and new status.
- The notification links to the Applications page.
- No notification is sent if the status did not actually change.

### US-16.3 Interview invitation notification
**As a** job seeker, **I want** a specific notification when I'm invited to interview **so that** I can respond quickly.

**Acceptance criteria**
- When the status is set to Interview, the job seeker receives an "Interview invitation" notification naming the job and company.

### US-16.4 Job match notification
**As a** job seeker, **I want** to be notified when a new job matches my profile **so that** I don't miss relevant opportunities.

**Acceptance criteria**
- When a recruiter creates, edits, or reopens a posting, every job seeker whose profile **headline** or **location** matches it is notified.
- Headline match: more than half of the headline's job keywords appear in the job title (e.g., "Software Developer" matches "Junior Software Developer" but "Mechanical Engineer" does not match "Software Engineer"). Words such as "student," "aspiring," and "intern" are ignored.
- Location match compares the city and ignores accents (e.g., "Montreal" matches "Montréal, QC").
- The message says whether the job matched the headline, the location, or both, and links to the job.
- Each job seeker is notified only once per posting, even if it is edited later.

### US-16.5 Job closing reminder
**As a** job seeker, **I want** a reminder before a matching job closes **so that** I can apply in time.

**Acceptance criteria**
- Job seekers get a "Job closing today / tomorrow / in 2 days" reminder for open jobs that match their profile and close within 3 days.
- Job seekers who have already applied do not receive the reminder.
- The server checks for reminders at startup and every hour; each job seeker gets one reminder per job and closing date.

### US-16.6 New application notification
**As a** recruiter, **I want** to be notified when someone applies to my posting **so that** I can review them promptly.

**Acceptance criteria**
- When a job seeker applies, the recruiter who owns the posting receives a "New application" notification with the applicant's name and job title.
- Clicking it opens the recruiter dashboard on that posting's applicant review section.

---

## US-17 AI-Powered Resume Feedback (started in Sprint 3, completed in Sprint 4)

### US-17.1 Upload a resume for review
**As a** job seeker, **I want** to upload my resume **so that** it can be reviewed by AI.

**Acceptance criteria**
- Only PDF files up to 5 MB are accepted; other files are rejected with an error.
- Uploaded resumes appear under "Saved resumes," and the newest upload becomes the default.

### US-17.2 Request AI resume feedback
**As a** job seeker, **I want** to request AI feedback on a saved resume **so that** I know how to improve it.

**Acceptance criteria**
- From the "AI Resume Review" section, the job seeker selects a saved resume and submits it for review.
- The feedback shows:
  - a short candidate profile (1–2 sentences),
  - up to 4 roles the resume aligns with,
  - up to 3 strengths,
  - up to 3 actionable improvements.
- Feedback is based only on what is in the resume: no invented skills, no scores or hiring predictions, and no comments on sensitive personal traits.
- Only job seekers can request a review (recruiters get a 403), and only for their own resumes.

### US-17.3 Detect documents that aren't resumes
**As a** job seeker, **I want** to be told if the file I uploaded isn't a resume **so that** I don't get misleading feedback.

**Acceptance criteria**
- If the PDF is not a resume (e.g., a report or invoice), the review shows "This PDF does not appear to be a resume." and no profile, roles, strengths, or improvements.

### US-17.4 Handle AI review errors
**As a** job seeker, **I want** clear messages when a review can't be completed **so that** I know what to do next.

**Acceptance criteria**
- Text can't be read from the PDF: an "unreadable resume" message (422).
- The AI service is not configured on the server: a message asking the administrator to enable it (503).
- The AI takes too long: "AI resume review took too long. Please try again." (504).
- The AI request fails: "AI resume review could not be completed. Please try again." (502).
- A second review requested while one is running: "A resume review is already running…" (429).

### Planned for Sprint 4
- US-17.5: Feedback tailored to a specific job posting (compare resume against the posting's requirements).
- US-17.6: Save past feedback so job seekers can track improvements over time.
