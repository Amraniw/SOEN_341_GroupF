# Sprint 4 Project Management

## 1. Sprint Planning

### Sprint Goal

Prepare CareerConnect for the final demonstration by validating the completed implementation across the job-seeker and recruiter workflows. Focus on the six issues in the Sprint 4 milestone, with regression testing for the core workflows and targeted validation for AI job recommendations.

### Sprint Backlog

| Issue | Title | Sprint 4 scope |
|---|---|---|
| #195 | US-19 — Application Analytics Dashboard | Verify that the job-seeker dashboard shows accurate application totals, status breakdowns, and activity over time for the selected date range. Check the empty state. |
| #200 | User Authentication and Profile Management | Verify registration, login, logout, session restoration, and role-specific access. Test profile editing for both roles and résumé upload, default selection, and removal for job seekers. |
| #201 | Job Search and Listings | Verify that users can browse available postings, combine search and filters, and open a listing's details. Check empty results and closed postings. |
| #202 | Job Application Submission and Tracking | Verify that job seekers can submit an application, see a confirmation, and follow status changes in their history. Check duplicate submissions and verify that recruiter updates appear on the job-seeker side. |
| #204 | Notifications and Analytics | Verify that application updates, interview invitations, deadline reminders, and recruiter activity reach the intended users. Check notification read state and confirm dashboard figures reflect the underlying application records. |
| #17 | US-12 - AI Job Recommendations | Verify that a job seeker can request matches using their default résumé and receive relevant open postings with evidence from the résumé and job descriptions. Test missing or unreadable résumés, no matches, and provider failures. |

### Priorities

Validate authentication and profiles, listings, and application tracking together first. These workflows provide the accounts, postings, and application history needed to verify notifications and dashboard metrics. Use #195 to validate the dashboard itself and #204 to validate notification behavior and how it relates to application activity. Test #17 alongside the core flows using representative résumés and postings.

### Effort and Team Capacity

Use the 1–5 effort scale from Sprint 3, where 1 is low effort and 5 is high complexity. Record estimates, owners, and target dates in the work plan once the team allocates capacity for validation, reviews, and demo preparation.

### Risks

| Risk | Mitigation |
|---|---|
| A recruiter update appears in one view but is missing from the application timeline, notification list, or analytics. | Run one application through both roles and check all three views against the resulting history. |
| Filters or date ranges produce misleading listings or dashboard totals. | Use known records with dates on either side of the selected range and verify the expected results. |
| AI recommendations include unsupported evidence or depend on provider availability. | Verify recommendations against the résumé and postings, use mocked responses for repeatable failure tests, and check provider availability before the demonstration. |

## 2. Sprint 4 Work Plan

| Issue | Title | Responsible member | Target date | Effort (1–5) | Status |
|---|---|---|---|---|---|
| #195 | US-19 — Application Analytics Dashboard | | | | Open |
| #200 | User Authentication and Profile Management | | | | Open |
| #201 | Job Search and Listings | | | | Open |
| #202 | Job Application Submission and Tracking | | | | Open |
| #204 | Notifications and Analytics | | | | Open |
| #17 | US-12 - AI Job Recommendations | | | | Open |

### Quality and Demo Preparation

- Record acceptance test results on the relevant issue and run automated regression tests through CI.
- Review any Sprint 4 changes through pull requests. Record static analysis findings and link fixes to the relevant reports.
- Validate AI Résumé Review alongside AI Job Recommendations for the demo. Document the inputs, model configuration, expected outputs, limitations, privacy considerations, and failure handling for both features.
- Keep meeting minutes, contribution records, and AI usage logs current for the evaluation.
