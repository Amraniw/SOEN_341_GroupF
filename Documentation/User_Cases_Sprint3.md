# CareerConnect User Cases

These user cases cover every user story implemented so far (Sprints 1–3) and describe each feature as it is built in CareerConnect.

**Users:** Job Seeker, Recruiter
**Application statuses:** Applied, Under Review, Interview, Offered, Rejected

| User Story | Sprint |
|---|---|
| US-01 User Registration | 1 |
| US-02 User Login | 1 |
| US-03 Profile Management | 2 |
| US-04 Resume Management | 1 (integrated in 2) |
| US-05 Job Search and Filtering | 2 |
| US-06 Job Application Submission | 2 |
| US-07 Application Status Tracking | 2 |
| US-08 Recruiter Application Dashboard | 3 |
| US-09 Job Posting Management | 2–3 |
| US-10 Application Dashboard and Analytics | 2–3 |
| US-16 Notifications and Reminders | 3 |
| US-17 AI-Powered Resume Feedback | 3–4 |

---

## US-01 User Registration (Sprint 1)

### US-01.1 Create an account
**As a** new user, **I want** to create an account **so that** I can use CareerConnect.

**Acceptance criteria**
- The sign-up form asks for name, email, password, and account role (Job Seeker or Recruiter).
- Job seekers also choose an employment status (Unemployed or Employed); it defaults to Unemployed.
- On success, the account is created and the user is signed in.

### US-01.2 Validate registration information
**As a** new user, **I want** clear errors when my information is invalid **so that** I can fix it.

**Acceptance criteria**
- Name is required and must be 100 characters or fewer.
- Email is required and must be a valid address.
- Password must be at least 8 characters (and at most 72 bytes).
- An invalid role or employment status is rejected.

### US-01.3 Prevent duplicate accounts
**As the** system, **I want** each email to be used only once **so that** accounts are unique.

**Acceptance criteria**
- Registering with an email that already exists shows "An account with this email already exists."
- Passwords are stored hashed with bcrypt, never in plain text.

---

## US-02 User Login (Sprint 1)

### US-02.1 Log in
**As a** registered user, **I want** to log in with my email and password **so that** I can access my account.

**Acceptance criteria**
- Valid credentials sign the user in and take them to their workspace (job seeker workspace or recruiter dashboard, depending on role).
- Wrong email or password shows "Invalid email or password." without revealing which one was wrong.
- Missing or badly formatted email, or a missing password, shows a validation error.

### US-02.2 Stay signed in and log out
**As a** user, **I want** to stay signed in and be able to log out **so that** my account is convenient and secure.

**Acceptance criteria**
- The session lasts up to 24 hours.
- Logging out ends the session; protected pages then require signing in again.

### US-02.3 Role-based access
**As the** system, **I want** to restrict features by role **so that** each user only sees what applies to them.

**Acceptance criteria**
- Only recruiters can access the recruiter dashboard and posting management.
- Only job seekers can apply to jobs, view application analytics, and request AI resume feedback.

---

## US-03 Profile Management (Sprint 2)

### US-03.1 Create and edit a profile
**As a** job seeker, **I want** to create and edit my professional profile **so that** recruiters can learn about me.

**Acceptance criteria**
- Fields: professional headline (required, ≤120 chars), location (≤100), phone (≤30), professional summary (≤1000), skills (≤500), education (≤1000), work experience (≤1500), portfolio or website (≤200).
- An invalid phone number or a website not starting with http:// or https:// shows an error.
- Saved changes are shown when the profile is viewed again.

### US-03.2 Add a profile picture
**As a** user, **I want** to add a profile picture **so that** my account feels personal.

**Acceptance criteria**
- Only one JPG or PNG image under 2 MB is accepted; anything else shows an error.
- The picture appears on the account page and in the workspace header.
- The user can remove the picture.

---

## US-04 Resume Management (Sprint 1, integrated in Sprint 2)

### US-04.1 Upload a resume
**As a** job seeker, **I want** to upload my resume **so that** I can use it when applying.

**Acceptance criteria**
- Only PDF files up to 5 MB are accepted; invalid files show an error.
- The newest uploaded resume becomes the default.

### US-04.2 Manage multiple resumes
**As a** job seeker, **I want** to keep several resumes and choose a default **so that** I can apply with the right one.

**Acceptance criteria**
- All saved resumes are listed under "Saved resumes."
- The user can set any saved resume as the default.
- The user can delete a resume; if it was the default, the most recent remaining resume becomes the default.

---

## US-05 Job Search and Filtering (Sprint 2)

### US-05.1 Search for jobs
**As a** job seeker, **I want** to search jobs by keyword **so that** I can find relevant opportunities.

**Acceptance criteria**
- The keyword searches job title, company, and description.
- Short keywords (e.g., "AI") match whole words only.
- Only open job postings appear in results.

### US-05.2 Filter jobs
**As a** job seeker, **I want** to filter jobs by location and category **so that** I can narrow my results.

**Acceptance criteria**
- Location matches any part of the job's location.
- Categories: Software Engineering, Aerospace & Engineering, Data & Analytics, Product & Design, Business & Operations.
- Filters can be combined with a keyword search.

### US-05.3 View job details
**As a** job seeker, **I want** to open a job posting **so that** I can read the full details before applying.

**Acceptance criteria**
- The job page shows title, company, location, category, employment type, workplace type, experience level, description, structured details (overview, responsibilities, qualifications, etc.), and closing date if set.
- A closed or missing job shows "This job posting could not be found."

---

## US-06 Job Application Submission (Sprint 2)

### US-06.1 Apply to a job
**As a** job seeker, **I want** to apply to a job **so that** recruiters can consider me.

**Acceptance criteria**
- Clicking apply on an open job creates an application with status **Applied** and shows "Application submitted successfully."
- The job seeker's default resume is attached as a snapshot, so the recruiter sees the version that was submitted.
- The recruiter who owns the posting is notified (see US-16.6).

### US-06.2 Prevent invalid applications
**As the** system, **I want** to block duplicate or invalid applications **so that** application data stays clean.

**Acceptance criteria**
- Applying twice to the same job shows "You have already applied for this job."
- Applying to a closed job shows "This job posting is no longer available."
- Recruiters cannot submit applications.

---

## US-07 Application Status Tracking (Sprint 2)

### US-07.1 See the current status of an application
**As a** job seeker, **I want** to see the status of each application **so that** I know where I stand.

**Acceptance criteria**
- Each application shows one of: Applied, Under Review, Interview, Offered, Rejected.
- The job page shows whether the job seeker has already applied and the current status.

### US-07.2 See an application's status timeline
**As a** job seeker, **I want** to see every status change of an application **so that** I can follow its progress.

**Acceptance criteria**
- Every status change is recorded automatically with the date and time.
- Expanding an application shows its full timeline, oldest to newest.

---

## US-08 Recruiter Application Dashboard (Sprint 3)

### US-08.1 View applicants for a posting
**As a** recruiter, **I want** to see everyone who applied to a posting **so that** I can review candidates in one place.

**Acceptance criteria**
- Each posting shows its application count.
- Opening a posting's applicants shows each candidate's name, email, and profile information, newest first.
- The recruiter can view the resume submitted with the application on the page; if none was attached, a message says so.
- Recruiters only see applicants for their own postings.

### US-08.2 Filter applicants
**As a** recruiter, **I want** to filter applicants by status **so that** I can focus on candidates at a specific stage.

**Acceptance criteria**
- A status dropdown lists all statuses plus "All statuses."
- Filtering updates the list and applicant count; if none match, "No applicants match these filters." is shown.
- *(The backend also supports a date range filter; it is not yet available in the UI.)*

### US-08.3 Update an applicant's status
**As a** recruiter, **I want** to change an application's status **so that** the candidate knows where they stand.

**Acceptance criteria**
- The recruiter picks a status on the candidate card and clicks "Save status."
- The change is saved, added to the status timeline (US-07.2), and shown on the job seeker's dashboard.
- The job seeker is notified (US-16.2, US-16.3).

---

## US-09 Job Posting Management (Sprint 2–3)

### US-09.1 View recruiter overview
**As a** recruiter, **I want** a summary of my postings **so that** I can see my hiring activity at a glance.

**Acceptance criteria**
- "At a glance" shows total postings, open postings, closed postings, and total applications.

### US-09.2 Create a job posting
**As a** recruiter, **I want** to create a job posting **so that** job seekers can find it and apply.

**Acceptance criteria**
- Required: title, company, location, category, description.
- Optional: employment type (Full-time, Internship, Contract), workplace type (On-site, Hybrid, Remote), experience level (Intern, Entry-level, Mid-level, Senior), closing date, and structured details.
- Invalid or missing fields show an error and the posting is not saved.
- The new posting is **open** and appears in job search right away; matching job seekers are notified (US-16.4).

### US-09.3 Edit a job posting
**As a** recruiter, **I want** to edit my postings **so that** I can keep them accurate.

**Acceptance criteria**
- Only the owner can edit a posting; changes appear in job search right away.

### US-09.4 Close or reopen a posting
**As a** recruiter, **I want** to close a posting **so that** it stops receiving applications without losing its applicants.

**Acceptance criteria**
- A closed posting is hidden from job search and can't receive applications; existing applications are kept.
- A closed posting can be reopened at any time.

### US-09.5 Delete a posting
**As a** recruiter, **I want** to delete a posting created by mistake **so that** my dashboard stays clean.

**Acceptance criteria**
- Deletion requires confirmation in a "Permanently delete posting?" dialog.
- Postings with applications cannot be deleted; the recruiter is told to close them instead.

---

## US-10 Application Dashboard and Analytics (Sprint 2–3)

### US-10.1 View application history
**As a** job seeker, **I want** to see all jobs I applied to **so that** I can keep track of my search.

**Acceptance criteria**
- "Your application journey" lists each application with job title, company, status, and dates.
- A status summary shows how many applications are in each status.

### US-10.2 Filter applications by status
**As a** job seeker, **I want** to filter my applications by status **so that** I can focus on specific ones.

**Acceptance criteria**
- Filtering is available from the "Show status" dropdown or by clicking a status in the summary.
- An empty result shows a "Show all applications" button.

### US-10.3 View application insights for a time range (Sprint 3)
**As a** job seeker, **I want** analytics about my applications **so that** I can measure my progress.

**Acceptance criteria**
- Range options: Last 30 days (default), Last 90 days, All time; a Refresh button reloads the data.
- Metrics: applications submitted in range, currently active (Applied, Under Review, Interview), and offers.
- "Current status breakdown" shows a bar and count per status.
- "Applications over time" shows monthly submission totals.
- "Recent activity" shows the latest status events in the range.
- Only job seekers can view analytics.

---

## US-16 Notifications and Reminders (Sprint 3)

### US-16.1 View and manage notifications
**As a** user, **I want** a notification bell **so that** I can see my updates in one place.

**Acceptance criteria**
- The bell shows a badge with the unread count; the dropdown lists notifications newest first.
- Clicking a notification marks it as read and opens the related page; "Mark all as read" clears the count.
- New notifications are checked every 30 seconds and shown as a popup that can be clicked or dismissed.

### US-16.2 Application status update notification
**As a** job seeker, **I want** to be notified when my application status changes **so that** I don't have to keep checking.

**Acceptance criteria**
- A status change (other than to Interview) creates an "Application update" notification with the job, company, and new status, linking to the Applications page.

### US-16.3 Interview invitation notification
**As a** job seeker, **I want** a specific notification when I'm invited to interview **so that** I can respond quickly.

**Acceptance criteria**
- Setting the status to Interview creates an "Interview invitation" notification naming the job and company.

### US-16.4 Job match notification
**As a** job seeker, **I want** to be notified when a new job matches my profile **so that** I don't miss opportunities.

**Acceptance criteria**
- When a posting is created, edited, or reopened, job seekers whose **headline** or **location** matches it are notified.
- Headline match: more than half of the headline's job keywords appear in the job title (filler words like "student" or "aspiring" are ignored).
- Location match compares the city, ignoring accents ("Montreal" matches "Montréal, QC").
- Each job seeker is notified only once per posting.

### US-16.5 Job closing reminder
**As a** job seeker, **I want** a reminder before a matching job closes **so that** I can apply in time.

**Acceptance criteria**
- Matching job seekers who haven't applied get a "Job closing today / tomorrow / in 2 days" reminder for open jobs closing within 3 days.
- The check runs at server start and every hour; each reminder is sent only once per job and closing date.

### US-16.6 New application notification
**As a** recruiter, **I want** to be notified when someone applies to my posting **so that** I can review them promptly.

**Acceptance criteria**
- A "New application" notification shows the applicant's name and the job title, and opens that posting's applicant review.

---

## US-17 AI-Powered Resume Feedback (started Sprint 3, completed Sprint 4)

### US-17.1 Request AI resume feedback
**As a** job seeker, **I want** AI feedback on a saved resume **so that** I know how to improve it.

**Acceptance criteria**
- In "AI Resume Review," the job seeker picks a saved resume and submits it.
- The feedback shows a short candidate profile, up to 4 aligned roles, up to 3 strengths, and up to 3 improvements.
- Feedback is based only on the resume: no invented skills, no scores or hiring predictions, and no comments on sensitive personal traits.
- Only job seekers can use it, and only on their own resumes.

### US-17.2 Detect documents that aren't resumes
**As a** job seeker, **I want** to be told if my file isn't a resume **so that** I don't get misleading feedback.

**Acceptance criteria**
- A non-resume PDF shows "This PDF does not appear to be a resume." with no feedback sections.

### US-17.3 Handle AI review errors
**As a** job seeker, **I want** clear messages when a review fails **so that** I know what to do.

**Acceptance criteria**
- Unreadable PDF (422), AI not configured (503), timeout (504), AI failure (502), and a second review while one is running (429) each show a clear message.

### Planned for Sprint 4
- US-17.4: Feedback tailored to a specific job posting.
- US-17.5: Save past feedback to track improvements over time.
