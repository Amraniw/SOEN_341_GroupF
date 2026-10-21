# CareerConnect

## Team Members

- Rayane Lkotbi | 40330437
- Carla Sophia Reis Lopez | 40262300
- Wassim Amrani | 40282136
- Suheil Almouhassel 40285426
- Adam El Fadil | 40340176
- Sadek Massinissa Abderaouf | 40327548

## Project Description

CareerConnect is a web-based job search and application tracking platform designed to help job seekers organize and manage their job-search activities in one centralized system.

The platform allows users to create and manage profiles, upload resumes, search and filter job opportunities, submit applications, and track the progress of their applications throughout the hiring process. Recruiters can also create and manage job postings.

## Identified Problem

Job seekers often manage their job search across multiple websites, emails, documents, and spreadsheets. This can make it difficult to keep track of job opportunities, application statuses, resumes, deadlines, and previous applications.

## Proposed Solution

CareerConnect provides a centralized platform where job seekers can manage their job-search activities in one place. Users will be able to organize job opportunities, manage resumes, submit applications, track application progress, save jobs, and receive reminders.

Recruiters will also be able to create and manage job postings.

## Main Users

- Job Seekers
- Recruiters

## Proposed Features

- User registration and authentication
- User profile management
- Resume upload and management
- Job posting management for recruiters
- Job search and filtering
- Job application submission
- Application status tracking:
  - Applied
  - Under Review
  - Interview
  - Offered
  - Rejected
- Application history dashboard
- Notifications and application deadline reminders
- Saved jobs and favourites
- Generative AI-based functionality
- Additional original team-designed feature

## Technologies

The technology stack will be finalized by the team during Sprint 1.
- Version Control: GitHub
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js and JavaScript
- Database: SQLite
- Authentication: bcrypt and cookie-based sessions
- File upload: Multer
- Testing: Node Test Runner and Supertest
- AI: Claude, ChatGPT, Codex

## Setup Instructions

Setup Instructions

Prerequisites

- Git
- Node.js 20 or later
- npm (included with Node.js)

Installation

Clone the repository:

- git clone https://github.com/Amraniw/SOEN_341_GroupF.git
cd SOEN_341_GroupF

Install the dependencies:

- npm ci

Running the Application

Start the application normally:

- npm start

Or start it in development mode with automatic server restarts:

- npm run dev

Use development mode while changing backend routes so Nodemon reloads them.
If using `npm start`, restart the server after backend changes; a browser refresh
only reloads frontend files and cannot update the running backend's routes.

Open the application at:

- http://localhost:3000

## Project Documentation

Additional project documentation, sprint planning, meeting minutes, AI usage logs, user stories, and development-process information will be maintained in this repository and its GitHub Wiki.

## Sprint 2: Job discovery (US-05)

Open **Find jobs** in the landing-page header or workspace navigation to browse,
search by keyword/location/category, and view complete job descriptions. Search
criteria are preserved in the URL and when returning from a job.

Public discovery uses `/jobs/`; workspace discovery uses `/workspace/jobs/`
and retains the workspace sidebar. Both share the same search and details
implementation. Public navigation recognizes the server session, including
across landing-page anchors, and Sign out ends that session explicitly.
See the [stabilization report](Documentation/US-05_Stabilization.md).
The [account recovery report](Documentation/US-05_Account_Recovery.md) documents
registration/workspace checks, real retries, and the default-server correction.

The 50 educational demonstration postings are included in the source code and
installed automatically when you run `npm start` or `npm run dev`. No separate
seed command is needed on a new computer. They use real company names but are
not verified live openings. Each computer keeps its own database; the bundled
catalog supplies the same initial jobs everywhere, while accounts and future
applications remain local to that computer.

Startup adds missing demo postings and preserves existing IDs, edits, closed
postings, unrelated jobs, accounts and resumes. Deleted demo postings are added
again on the next startup; close a posting to keep it unavailable. Existing
running servers need one restart to use the automatic setup. You can also run
`npm run seed:jobs` explicitly. To upgrade the earlier 22-role
catalog, run `npm run seed:jobs -- --refresh`; this refreshes only the 50 managed
demo keys, preserving their IDs and unrelated records. The command refuses
`NODE_ENV=production`, and automatic demo setup is also skipped in production.

See the [visual/content refinement report](Documentation/US-05_Refinement.md)
for structured details, seed refresh behavior, search semantics and current checks.

Run the regression and job-search integration tests with `npm test`.
See [the US-05 implementation guide](Documentation/US-05_Job_Discovery.md) for
API/schema details and [acceptance scenarios](Documentation/Acceptance_Tests/US-05.md)
for the Sprint 2 GitHub issue handoff.

## Sprint 2: Applications (US-06, US-07, US-10)

Signed-in job seekers can apply from a job-detail page and receive an immediate
success confirmation. Each application is stored in SQLite, protected against
duplicate submissions, and appears in the **Applications** workspace after a
refresh or later sign-in. The dashboard tracks the required Applied, Under
Review, Interview, Offered, and Rejected statuses and preserves an audit history
whenever the current status changes.

The application endpoints require the signed HttpOnly session and return only
the current user's records. See the [implementation guide](Documentation/US-06_US-07_Applications.md)
and the acceptance scenarios for [submission](Documentation/Acceptance_Tests/US-06.md)
and [tracking](Documentation/Acceptance_Tests/US-07.md).
