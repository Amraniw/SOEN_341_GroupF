# Job Application Submission and Tracking (US-06, US-07, US-10)

## User experience

- Available job details expose **Apply now** to an authenticated job seeker.
- Public visitors receive a sign-in action that returns them to the same job.
- A successful submission is confirmed immediately and links to Applications.
- Reopening or refreshing the job recognizes an existing application and blocks
  duplicate submission.
- The authenticated Applications workspace summarizes, filters, and displays
  persisted applications with an accessible status progression.
- The UI supports the shared responsive layout, keyboard focus, reduced-motion
  preferences, and light/dark themes.

## Persistence

`applications` links one user to one job with a database-level unique constraint.
Its status is constrained to `applied`, `under_review`, `interview`, `offered`,
or `rejected`, which the API presents using the required human-readable labels.
Deleting an account removes its private applications and history. A job with
applications cannot be deleted; it is closed instead, preserving every job
seeker's tracking record.

`application_status_history` is an append-only audit trail populated by SQLite
triggers on initial submission and each real status transition. The application
record's `updated_at` value changes with the status.

## API

All routes require the signed HttpOnly CareerConnect session.

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/applications` | Submit `{ "jobId": number }`; returns 201 confirmation |
| `GET` | `/api/applications` | List the current user's applications and canonical statuses |
| `GET` | `/api/applications/job/:jobId` | Check whether the current user applied to a job |
| `GET` | `/api/applications/:applicationId` | Read one owned application and its status history |

The API rejects malformed identifiers and request fields, unavailable jobs,
duplicates, missing sessions, and attempts to access another user's data without
exposing database or stack details.

## Verification

Run `npm test`. `test/applications.test.js` covers submission, confirmation,
persistence, duplicate prevention, authentication, ownership isolation, all five
statuses, history, constraints, cascade cleanup, malformed input, and the HTML
dashboard route. The complete suite also guards registration, sessions, resumes,
job discovery, migrations, and startup behavior.
