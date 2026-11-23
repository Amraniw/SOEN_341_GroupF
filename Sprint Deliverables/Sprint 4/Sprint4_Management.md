# Sprint 4 Project Management

## 1. Sprint Planning

### Sprint Goal

The goal of this sprint is to validate the completed CareerConnect features and prepare the application for the final demonstration.

The main focus is to verify authentication and profiles, job search and listings, application submission and tracking, notifications, the application analytics dashboard, and AI job recommendations.

Sprint 4 will also focus on running unit and acceptance tests, maintaining the CI pipeline, reviewing changes, and addressing findings from static analysis.

### Sprint Backlog

| User Story | Description |
|---|---|
| US-19 — Application Analytics Dashboard | Verify that job seekers can view application totals, status breakdowns, and activity over time. |
| User Authentication and Profile Management | Verify registration, login, session handling, profile editing, and résumé management. |
| Job Search and Listings | Verify that users can browse, search, and filter available job postings and view their details. |
| Job Application Submission and Tracking | Verify that job seekers can submit applications and track status changes made by recruiters. |
| Notifications and Analytics | Verify that users receive the expected in-app updates and reminders and that analytics reflect recorded application activity. |
| US-12 - AI Job Recommendations | Verify that job seekers receive relevant open job recommendations based on their default résumé and that the feature handles missing résumés and provider errors. |

Features implemented during previous sprints will also be reviewed, integrated, and tested to ensure proper functionality.

### Priorities

| User Story | Priority | Why |
|---|---|---|
| US-19 — Application Analytics Dashboard | High | Verifies that job seekers can see accurate application trends and status totals. |
| User Authentication and Profile Management | High | Both user roles depend on account access and profile management. |
| Job Search and Listings | High | Job seekers need to find and review available postings before applying. |
| Job Application Submission and Tracking | High | Connects job-seeker applications to recruiter status updates and application history. |
| Notifications and Analytics | High | Keeps users informed of application activity, interview invitations, and deadlines. |
| US-12 - AI Job Recommendations | High | Validates a required Sprint 4 AI feature for the final demonstration. |

### Effort Estimation

The effort needed for each user story is estimated using a scale from 1 to 5. A value of 1 represents low effort, while 5 represents high complexity and development effort.

| User Story | Estimated Effort |
|---|---|
| US-19 — Application Analytics Dashboard | |
| User Authentication and Profile Management | |
| Job Search and Listings | |
| Job Application Submission and Tracking | |
| Notifications and Analytics | |
| US-12 - AI Job Recommendations | |

Application tracking, notifications, and analytics share application data, so their validation includes scenarios that span the job-seeker and recruiter workflows. AI job recommendations also require tests for output relevance and failure handling.

### Team Capacity

The team consists of 6 members. As in previous sprints, members will coordinate their development, testing, and documentation responsibilities to complete the assigned tasks.

| Pair | Task |
|---|---|
| 1 | Front-end work covers the analytics dashboard, profiles, job listings, application tracking, notifications, and the AI recommendations interface. |
| 2 | Back-end work covers authentication, search, application status updates, notification delivery, analytics, and AI matching. |
| 3 | Documentation and testing cover acceptance tests, unit tests, CI, static analysis, and sprint records. |

All team members will participate in reviewing, testing, and integrating the completed functionalities.

### Risks

- Regressions in previously implemented workflows before the Sprint 4 evaluation.
- Inconsistent application statuses across the recruiter dashboard, job-seeker history, and notifications.
- Incorrect analytics totals or date filtering.
- Irrelevant AI recommendations or provider failures during validation.
- Insufficient unit or acceptance test coverage.
- Continuous Integration pipeline failures.
- Delays in collecting review and testing evidence for the final demonstration.

## 2. Sprint 4 Work Plan

| Issue # | Issue Title | Issue Type | Responsible Member | Target Date | Priority | Status |
|---|---|---|---|---|---|---|
| #195 | US-19 — Application Analytics Dashboard | User Story | | | High | Open |
| #200 | User Authentication and Profile Management | Task | | | High | Open |
| #201 | Job Search and Listings | Task | | | High | Open |
| #202 | Job Application Submission and Tracking | Task | | | High | Open |
| #204 | Notifications and Analytics | Task | | | High | Open |
| #17 | US-12 - AI Job Recommendations | User Story | | | High | Open |

This section summarizes the GitHub issues in the Sprint 4 milestone. Responsibilities, deadlines, and progress will be tracked in the GitHub repository.
