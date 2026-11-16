# AI Usage Log – Sprint 3

**Project:** CareerConnect – Job Search and Application Tracking Platform

**Course:** SOEN 341 – Software Process

**Sprint:** Sprint 3

**Responsible Person:** Massi A. Sadek

---

## AI Interaction 1 – Sprint 3: Repository and Project Audit

**Date:** November 15, 2026

**Task ID/Title:** Sprint 3 – Initial Repository and Implementation Audit

**Tool:** Codex

**Purpose of AI Use:** Review the existing CareerConnect implementation, understand the work completed during previous sprints, identify remaining Sprint 3 requirements, and avoid duplicating or interfering with teammates' contributions.

### Prompt / Interaction

I asked Codex to perform a read-only analysis of the repository before starting any new development.

The request focused on understanding the existing system, reviewing the Sprint 3 requirements, identifying implemented functionality, checking the responsibilities associated with US-08 and US-10, and identifying possible conflicts with ongoing team contributions.

I explicitly instructed Codex not to modify any files, execute tests, implement features, or perform Git operations.

**Prompt and response evidence:** codex://threads/01a1e0ee-5e42-7a32-95cd-65172a9d3086

### AI-Suggested Content

Codex reviewed the existing application architecture, authentication, job posting management, application tracking, dashboards, notifications, and test infrastructure.

The analysis confirmed that the recruiter job posting management functionality had already been implemented during Sprint 2, while some applicant-management and application-analytics functionality remained incomplete at the audited checkpoint.

Codex also identified overlapping responsibilities between teammates and recommended confirming task ownership before implementing additional functionality.

### Validation

Codex inspected the repository source code, existing tests, Git history, sprint documentation, and team assignments.

The audit was performed on branch `feature/us-10-jobseeker-applications` at commit `7f63ae4`.

The working tree remained clean. No code was modified and no tests were executed during this interaction.

### Decision

**Accepted for planning purposes.**

The audit provided an overview of existing functionality and helped avoid unnecessary implementation. Additional verification was required before concluding that my assigned Sprint 3 work was complete.

### Reflection

This analysis helped me understand how the different project features were connected and why checking existing functionality was important before starting new development.

It also helped clarify the distinction between my previous recruiter posting management work and the applicant-management functionality being developed by my teammates.

**Responsible Person:** Massi Sadek

## AI Interaction 2 – US-09: Job Posting Management and Test Coverage Audit

**Date:** November 16, 2026

**Task ID/Title:** Sprint 3 / US-09 – Existing Implementation and Test Coverage Review

**Tool:** Codex

**Purpose of AI Use:** Verify that my Job Posting Management functionality from Sprint 2 was still implemented correctly after the team's Sprint 3 changes, review existing test coverage, and identify safe regression tests without modifying the application.

### Prompt / Interaction

I asked Codex to review my existing Job Posting Management implementation on the updated Sprint 3 branch.

The request included:

- Checking whether recruiters could still create, edit, display, close, and reopen their own job postings.
- Verifying recruiter authorization, ownership restrictions, frontend/backend integration, and preservation of existing applications.
- Comparing my Sprint 2 contribution with the current implementation and reviewing changes made by my teammates.
- Identifying existing tests, missing coverage, and possible risks before executing anything.

I explicitly instructed Codex to perform a read-only audit without changing code, running tests, or interfering with my teammates' work.

**Prompt and response evidence:** codex://threads/01a1e0ee-5e42-7a32-95cd-65172a9d3086

### AI-Suggested Content

Codex confirmed that the main Job Posting Management functionality was already implemented and remained present in the current repository.

The audit identified the existing recruiter API, dashboard interface, form validation, role-based authorization, ownership protection, and safe deletion behavior.

Codex also confirmed that my Sprint 2 commit `a436fa9` introduced the original posting-management functionality and that subsequent team changes preserved its main behavior.

Existing automated coverage included **28 recruiter API tests and 24 recruiter UI tests**, although these were identified through source inspection and had not yet been executed during this interaction.

Codex recommended reusing the existing tests instead of adding duplicate functionality or unnecessary tests. It also identified a PDF-upload test with filesystem side effects, which needed to be excluded from our initial testing.

### Validation

The audit was performed on branch `feature/us-09-job-posting-management` at commit `34cfaf0`.

Codex inspected the relevant source files, test definitions, Git history, existing acceptance criteria, and CI configuration.

The review confirmed that the existing implementation covered the documented creation, editing, owned listings, close/reopen, authorization, and application-preservation requirements.

A separate archive operation was not found. The documented US-09 acceptance criteria instead described closing and reopening postings.

No tests were executed during this audit. No application files, tests, or documentation were modified, and the working tree remained clean.

### Decision

**Accepted for validation.**

The existing functionality appeared complete for my assigned Job Posting Management scope. I decided to proceed with focused regression testing rather than implementing the same functionality again.

### Reflection

This audit confirmed the importance of reviewing previous work before starting new development. It helped identify that most of my assigned responsibilities had already been completed during Sprint 2.

It also allowed me to select relevant tests while avoiding unnecessary changes, duplicated work, and potential conflicts with my teammates' Sprint 3 contributions.

**Responsible Person:** Massi Sadek

## AI Interaction 3 – US-09: Job Posting Management Regression and Integration Testing

**Date:** November 16, 2026

**Task ID/Title:** Sprint 3 / US-09 – Final Verification and Regression Testing

**Tool:** Codex

**Purpose of AI Use:** Validate my existing Job Posting Management implementation through automated testing and verify that it remained functional after my teammates' Sprint 3 changes, without modifying any project files.

### Prompt / Interaction

I asked Codex to review the relevant code, verify that the selected tests were safe to execute, and run the existing regression tests on `feature/us-09-job-posting-management`.

I specifically requested tests covering recruiter posting creation, editing, owned listings, close/reopen, authorization, frontend/backend integration, application persistence, and job-alert notifications.

I also asked Codex to consider Souhail's recent contributions while keeping Applicant Management outside my implementation responsibility.

I explicitly instructed Codex not to modify source code, tests, documentation, databases, or Git history, and to report any failures without attempting fixes.

**Prompt and response evidence:** codex://threads/01a1e5e7-0e0f-77c0-b82e-397e171baa84

### AI-Suggested Content

Codex confirmed that the existing Job Posting Management implementation supported all the documented US-09 operations, including creating and editing postings, displaying recruiter-owned jobs, closing/reopening postings, enforcing ownership restrictions, and protecting applications during deletion.

It also confirmed that the relevant application-tracking and job-alert functionality remained compatible with the tested posting workflows.

No additional production code or duplicate tests were recommended based on the verified results.

### Validation

Codex verified the branch `feature/us-09-job-posting-management` at commit `34cfaf0` and inspected the tests to confirm that the selected cases used isolated in-memory SQLite databases and excluded the PDF-upload test with filesystem side effects.

The following commands were executed:

```sh
git status --short

node --test --test-name-pattern='actual UI controller' test/recruiter-ui.test.js

node --test --test-name-pattern='all seven endpoints require|another recruiter and an ownerless demo|creation rejects|owned listings include|owned details and PATCH|closing and reopening control|deletion with applications' test/recruiter.test.js

git status --short

node --test test/recruiter-ui.test.js

git status --short

node --test test/applications.test.js test/job-alerts.test.js

git status --short
```

**Test results:**

| Test Execution                      | Passed | Failed |
| ----------------------------------- | -----: | -----: |
| Targeted UI/API integration         |      1 |      0 |
| Recruiter backend API tests         |      7 |      0 |
| Complete recruiter UI suite         |     24 |      0 |
| Application tracking and job alerts |     19 |      0 |
| **Total**                           | **51** |  **0** |

The results represent **51 successful test executions covering 50 distinct test cases**, since the targeted UI/API test was also included in the complete UI suite.

The first attempt to run the UI integration test inside Codex's sandbox failed because Supertest could not establish a temporary HTTP listener. The identical command passed after the required execution permission was granted. No application changes were necessary.

Validation confirmed:

- Recruiter-only access and cross-recruiter ownership protection.
- Posting creation, editing, listing, close/reopen, and safe deletion.
- Frontend/backend integration using authenticated sessions.
- Preservation of submitted applications and status history.
- Job matching notifications and closing-date reminders.
- Existing Sprint 3 dashboard improvements and error handling.

All four `git status --short` checks returned empty output. Codex made no source, test, documentation, or Git changes.

The tests did not cover the complete Applicant Management workflow, real-browser acceptance testing, or a distinct archive feature. The full repository suite and hosted CI were not executed.

### Decision

**Accepted and validated.**

The existing US-09 Job Posting Management functionality passed all selected regression and integration tests. No new implementation was necessary for the verified scope.

### Reflection

This verification confirmed that my work from Sprint 2 remained functional after the team's Sprint 3 integration. Reusing the existing tests allowed me to validate the main recruiter workflows without rewriting code or interfering with my teammates' contributions.

It also demonstrated the importance of checking test isolation and documenting environmental failures separately from actual application defects.

**Responsible Person:** Massi Sadek
