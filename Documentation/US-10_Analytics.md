# US-10: Application Analytics and History Dashboard

Job seekers can review their application submissions, current status distribution, monthly activity and recorded status history. The authenticated `/api/applications/analytics?range=30|90|all` endpoint derives metrics from persisted applications. Active means Applied, Under Review or Interview. Submission cohorts use UTC calendar dates, inclusive of today; status distribution describes current outcomes, not historical outcomes at the end of a period. Recent activity independently includes the latest 100 status events within the range. Per-application details provide the complete chronological history.

## Acceptance scenarios

1. Given a signed-in job seeker with applications, selecting 30 days, 90 days or All time updates submission counts, status totals, monthly activity and the application list. Status filters narrow the list without changing the cohort totals.
2. Given recorded recruiter status changes, opening View status history shows actual chronological events and timestamps. Stages that never occurred are not presented as completed.
3. Given no submissions in a range, metrics show zero and a useful empty state appears without fabricated sample data.
4. Given another account or an anonymous visitor, private analytics cannot be accessed. Recruiters receive 403 from the analytics endpoint.
5. Given a failed request, the dashboard presents an error and retry action. Refresh retrieves current persisted information.
6. With keyboard navigation, narrow screens and dark mode, controls, chart labels and numeric values remain accessible. Charts use native meters with adjacent text values.

## Validation and demo

Run `npm test` through the existing CI workflow. Create applications, change statuses through the team recruiter workflow when available, then demonstrate range selection, breakdowns, monthly totals and expanded history. Check both themes and a mobile viewport before merging.

## Sprint 3 evidence

Link this implementation and its acceptance scenarios to US-10 on the project board. Record acceptance execution, commit/PR references and contribution time. The team maintains meeting minutes and the one-page sprint summary; Wassim must also submit his individual Sprint 3 PDF in his personal AI_Log directory. These external/report deliverables are not completed by implementing the dashboard.
