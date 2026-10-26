
# Sprint 2 Project Management

## 1. Sprint Planning

### Sprint Goal

The goal of this sprint is to expand the CareerConnect web application by implementing the core job-search and application-management features while refining and integrating the functionalities developed in Sprint 1.

The main focus is to implement User Profile Management, Job Search and Filtering, Job Application Submission, and Application Status Tracking. Additionally, the team will begin developing Recruiter Job Posting Management and implement an Application Dashboard.

Sprint 2 will also focus on acceptance testing, Continuous Integration (CI), and maintaining proper GitHub project management practices.

### Sprint Backlog

| User Story | Description |
|---|---|
| US-03 Profile Management | Allows job seekers to create, edit, and view their professional profiles. |
| US-05 Job Search and Filtering | Allows users to browse and search job opportunities using keywords, locations, and categories. |
| US-06 Job Application Submission | Allows job seekers to apply for jobs and receive confirmation. |
| US-07 Application Status Tracking | Allows job seekers to track the progress of their applications. |
| US-09 Job Posting Management | Allows recruiters to create and manage job postings. Development begins in Sprint 2 and continues into Sprint 3. |
| US-10 Application Dashboard | Allows users to view their application history and statuses. |

Resume Management (US-04), implemented during Sprint 1, will also be reviewed and integrated with the new functionalities.

### Priorities

| User Story | Priority | Why |
|---|---|---|
| Profile Management | High | Allows users to maintain their professional information. |
| Job Search and Filtering | High | Necessary for users to find available opportunities. |
| Job Application Submission | High | Allows users to apply for jobs through the platform. |
| Application Status Tracking | High | Allows users to monitor their applications. |
| Job Posting Management | Medium | Necessary for recruiters, but full implementation can continue in Sprint 3. |
| Application Dashboard | Medium | Centralizes application history and tracking. |

### Effort Estimation

The effort needed for each user story is estimated using a scale from 1 to 5. A value of 1 represents low effort, while 5 represents high complexity and development effort.

| User Story | Estimated Effort |
|---|---|
| Profile Management | 3 |
| Job Search and Filtering | 4 |
| Job Application Submission | 4 |
| Application Status Tracking | 3 |
| Job Posting Management | 4 |
| Application Dashboard | 3 |

Job Search and Filtering, Job Application Submission, and Job Posting Management require both front-end and back-end development, making them relatively complex. The remaining features are expected to require moderate effort.

### Team Capacity

The team consists of 6 members. As in Sprint 1, members will work in pairs to complete their assigned development and documentation tasks. Each pair will manage their workload and coordinate with other members to ensure successful integration.

| Pair | Task |
|---|---|
| 1 | Front-end: User interfaces for profile management, job searching, applications, and dashboards. |
| 2 | Back-end: Database structures, job applications, status tracking, and recruiter functionality. |
| 3 | Documentation and Testing: Sprint planning, acceptance tests, meeting minutes, CI setup, and project documentation. |

All team members will participate in reviewing and testing the completed functionalities.

### Risks

- Not completing all required features before the Sprint 2 evaluation.
- Difficulties integrating front-end and back-end components.
- Database and application-status synchronization issues.
- Continuous Integration pipeline configuration or testing failures.
- Insufficient acceptance test coverage.
- Communication issues between team members.

## 2. Sprint 2 Work Plan

| Issue # | Issue Title | Issue Type | Responsible Member | Target Date | Priority | Status |
|---|---|---|---|---|---|---|
| #3 | Profile Management | User Story | Suheil | October 19 | High | Completed |
| #5 | Job Search and Filtering | User Story | Rayane, Carla | October 20 | High | Completed |
| #6 | Job Application Submission | User Story | Wassim, Adam | October 23 | High | Completed |
| #7 | Application Status Tracking | User Story | Wassim, Adam | October 24 | High | Completed |
| #9 | Job Posting Management | User Story | Rayane, Massi | October 20 | Medium | Incomplete |
| #10 | Application Dashboard | User Story | Wassim, Adam | October 24 | Medium | Completed |
| - | Acceptance Tests | Task | Rayane, Wassim | October 24 | High | Completed |
| - | Continuous Integration Pipeline | Task | Adam | October 19 | High | Completed |
| - | Sprint Planning and Documentation | Task | Rayane, Carla | October 25 | High | Completed |
| - | Dark Mode | Bonus | Adam | October 25 | Low | Completed |


This section summarizes the main GitHub issues planned for Sprint 2. Each user story is broken down into smaller tasks in the GitHub repository, where responsibilities, deadlines, and progress will be tracked.

## 3. Team Contributions

### Rayane Lkotbi

- **Work completed:** Organized Sprint 2 planning, backlog, user stories, tasks, documentation, and AI logs. Led AI-assisted development of Job Search and Filtering (US-05), including frontend, backend, database integration, and UI improvements.
- **Issues worked on:** Job Search and Filtering (US-05), job listings, search filters, job descriptions, Sprint 2 planning, and documentation.
- **Pull requests / commits:** Pull Request #81, involving job search implementation, interface improvements, debugging, and integration. Additional contributions to sprint planning, checklists, and AI logs.
- **Reviews or testing performed:** Reviewed AI-generated code, verified job search and filtering functionality, tested navigation and authentication sessions, and reviewed automated API tests, database persistence, and CI checks.
- **Time spent:** October 19 to  25

### Wassim Amrani

- **Work completed:**
  - Implemented Task 3: Job Application Submission and Tracking with Codex assistance.
  - Added authenticated application submission, persistent SQLite storage, duplicate-application prevention, and successful-submission confirmation.
  - Implemented application tracking with support for Applied, Under Review, Interview, Offered, and Rejected, including status-history and timestamp support.
  - Built the My Applications dashboard with status filters, counters, application timelines, job links, and empty states.
  - Connected the application workflow to the existing job listings and job-detail pages.
  - Helped integrate the team's job-listing and Dark Mode features, including resolving the homepage header conflict.
  - Identified and requested a correction to dark-mode styling on individual job-posting pages.
  - Added automated tests and supporting documentation with Codex assistance.
  - Prepared my Sprint 2 AI usage log.
  - Wrote or uploaded Sprint 2 meeting minutes.

- **Issues worked on:**
  - [#6 — US-06: Job Application Submission](https://github.com/Amraniw/SOEN_341_GroupF/issues/6)
  - [#7 — US-07: Application Status Tracking](https://github.com/Amraniw/SOEN_341_GroupF/issues/7)
  - [#10 — US-10: Application Dashboard](https://github.com/Amraniw/SOEN_341_GroupF/issues/10)

- **Pull requests / commits:**
  - Implementation: [PR #80 — Job application tracking](https://github.com/Amraniw/SOEN_341_GroupF/pull/80)
  - Task 3 implementation commit: [`fefbae3`](https://github.com/Amraniw/SOEN_341_GroupF/commit/fefbae3)
  - Job-page dark-mode correction: [`681d674`](https://github.com/Amraniw/SOEN_341_GroupF/commit/681d674)
  - Related team integration: [PR #77 — Task 2](https://github.com/Amraniw/SOEN_341_GroupF/pull/77) and [PR #78 — Darkmode](https://github.com/Amraniw/SOEN_341_GroupF/pull/78)
  - Reviewed: [PR #84 — Implement recruiter job posting management](https://github.com/Amraniw/SOEN_341_GroupF/pull/84)

- **Reviews or testing performed:**
  - Reviewed PR #84 concerning recruiter job posting management.
  - Reviewed the application workflow and clarified its integration dependency on recruiter roles and job ownership.
  - Identified the dark-mode issue on individual job-posting pages and reviewed the correction before requesting the final commit and push.
  - Reviewed Codex's reported automated validation covering application submission, persistence, duplicate prevention, user isolation, supported statuses, history, and invalid requests.
  - Codex reported that the complete project suite passed with 81 tests and 0 failures after the dark-mode correction.

- **Time spent:**
  - Task 3 implementation and review: 3 hours
  - Testing and corrections: 4 hours
  - Pull-request review: 2 hours
  - Documentation: 2 hours
  - **Total: 11 hours**

### Carla Reis

- **Work completed:** Helped with the documentation for the sprint 2 like sprint planning, user stories and the team process as well as with the final report to be submitted. Also contributed with imprlementaiton 2, the Job search and Filtering along with a teammate providing feedback and reviewing the implementation.
- **Issues worked on:** Job Search and Filtering (US-05), Documentation
- **Pull requests / commits:** Planning and documentation for Sprint 2, work related to the Job Search and Filtering implementaiton.
- **Reviews or testing performed:** Job Search and Filtering functionality and Debug of AI generated code. Feedback provided while the implementation process of implementation 2. Reviewed final documentation to be submitted.
- **Time spent:** October 19 to 26 

### Adam El Fadil

- **Work completed:**
1. Theme of the website [HTML/CSS]
2. Implemented a darkmode and an easy way to switch betweens dark and light mode [CSS/JavaScript] (BONUS)
3. Assissted with Task 3 US-06/US-10 [JavaScript] (Pair Programming) 
4. Workflow & Continuous Integration [YAML] 

- **Issues worked on:**
1. Frontend 
2. Workflow & CI
3. Documentation
4. Backend (Pair Programming)

- **Pull requests / commits:**
Around 10 commits, mostly done for work on the frontend and the workflow.

- **Reviews or testing performed:**
1. October 21st: Tested the darkmode compability. (Verdict: It works in every pages as long as you implement the small darkmode script in the head section of your HTML)
2. October 25th: Tested the implementation of Task 3 such as:
A - Submitting a job application (Verdict: Everything works fine)
B - Job application dashboard (Verdict: Looks good but you cannot edit or withdraw a job application)

- **Time spent:**
1. Darkmode & Theme: 3h + 30 min testing
2. Assisting with Task 3 (Pair Programming): 2h
3. Workflow, CI & Documentation: 1h

### Massi Sadek

- **Work completed:**
  - Implemented Feature 4 (US-09): Recruiter Job Posting Management with Codex assistance.
  - Extended the SQLite database to support recruiter accounts, job ownership, and role-based access control.
  - Implemented secure recruiter API endpoints for creating, viewing, editing, closing, reopening, and deleting job postings.
  - Developed the recruiter dashboard with posting forms, job listings, overview statistics, and management controls.
  - Integrated recruiter functionality with the existing authentication, session management, job listings, and navigation systems.
  - Added server-side authorization, ownership validation, input validation, and security protections to prevent unauthorized modifications.
  - Added automated tests covering recruiter functionality, database migrations, security, and frontend integration.
  - Prepared the Sprint 2 AI Usage Log documenting four Codex interactions, implementation decisions, and validation results.

- **Issues worked on:** #9 — US-09: Job Posting Management

- **Pull requests / commits:**
  - PR #84 — Implement recruiter job posting management
  - Implementation commit a436fa9

- **Reviews or testing performed:**
 - Reviewed Codex-generated implementation and verified integration with existing project functionality.
 - Validated recruiter authentication, posting ownership, role restrictions, and secure CRUD operations.
 - Verified the recruiter dashboard manually in the browser, including creating, editing, closing, reopening, and deleting postings.
 - Completed full automated validation with 138 tests passed and 0 failures, plus 54 successful JavaScript syntax checks.
 - Verified compatibility with existing job-seeker features and documented outstanding dependency security advisories.

- **Time spent:** October 22 to 26

### Suheil Almouhassel

- **Work completed:**
- **Issues worked on:**
- **Pull requests / commits:**
- **Reviews or testing performed:**
- **Time spent:**

