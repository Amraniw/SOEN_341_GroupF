# AI Usage Log – Sprint 2

**Project:** CareerConnect – Job Search and Application Tracking Platform

**Course:** SOEN 341 – Software Process

**Sprint:** Sprint 2

**Responsible Person:** Massi A. Sadek

---

## AI Interaction 1 – Feature 4, Phase 01: Database Foundation and Role Security

**Date:** October 22, 2026

**Task ID/Title:** Feature 4 / US-09 – Phase 01: Database Foundation, Recruiter Identity, and Role Security

**Tool:** Codex

**Purpose of AI Use:** Implement the approved Phase 01 foundation and validate the directly affected behavior on `task-4`.

### Prompt / Interaction

I provided Codex with the Phase 01 implementation instructions, including:

> "You are implementing only Phase 01: Database Foundation, Recruiter Identity, and Role Security."

> "Feature 4 introduces an exclusive `job_seeker` / `recruiter` account model."

The instructions requested additive database changes, role-aware registration and sessions, reusable server-side recruiter authorization, recruiter rejection from job application submission, minimal signup/session changes, and focused regression tests. Dashboard pages, posting CRUD, snapshot capture, company verification, role-changing endpoints, and Git publishing operations were outside this phase.

### AI-Suggested Content

Codex implemented:

- Idempotent column checks and additive SQLite migrations for constrained `users.role`, nullable `jobs.recruiter_id`, and nullable `applications.job_snapshot_json`, plus a recruiter/job creation-order index. Existing tables are not rebuilt.
- Optional registration roles, defaulting omitted values to `job_seeker`; unsupported values are rejected. Public registration, login, and session responses include the persisted role.
- Database-backed role loading in the existing authentication middleware and a reusable `createAuthorizeRecruiter(database)` middleware. Anonymous/missing-account access returns 401; authenticated non-recruiters receive 403.
- A job-seeker role check on application submission. Existing application responses and status/history behavior are retained.
- Signup submission of the selected role, removal of the Company Key field and its conditional script, and retention of the role in the display-session cache.
- Focused migration/security/frontend-session tests and the necessary updates to the existing session response and failure-injection tests.

### Validation

Codex verified the clean starting checkout was `task-4` at `ee75419` and inspected the directly relevant files. No branch switch, commit, push, merge, rebase, reset, or PR operation was performed.

The first focused command was:

```sh
node --test test/database-foundation.test.js test/roles.test.js test/role-frontend.test.js test/auth.test.js test/session.test.js test/applications.test.js test/resume.test.js
```

It produced **3 passes and 58 failures** inside the sandbox: migration and frontend-session checks passed, while the Supertest API checks could not open their temporary local listeners. With the required execution permission, only those failed API files were rerun:

```sh
node --test test/roles.test.js test/auth.test.js test/session.test.js test/applications.test.js test/resume.test.js
```

Result: **58 passed, 0 failed**. No application changes were needed between these two runs.

The directly affected job migration and seed-preservation checks were also run:

```sh
node --test --test-name-pattern='additive job migration|seed is repeatable|explicit refresh' test/jobs.test.js
```

Result: **3 passed, 0 failed**. The combined completed checks therefore covered **64 distinct tests, all passing**.

Validation covered:

- Fresh schema constraints, recruiter foreign keys, and the recruiter index.
- Legacy users, resumes, closed demo jobs, applications, timestamps, and history surviving repeated initialization with unchanged table root pages.
- Preservation of populated roles, ownership, and snapshot values on later initialization; duplicate constraints, restricted job deletion, account cascades, and status-history triggers.
- Default and explicit job-seeker registration, recruiter self-registration, invalid role rejection, signed-session restoration, and private-field exclusion.
- Attempts to elevate an existing account through registration, login, or supplied role values; authorization follows the current database role.
- Recruiter application rejection without application/history insertion, and ordinary job-seeker submission with the original contract and a null snapshot.
- Actual frontend session/API modules under mocked browser globals, checking login-cache, reload, and server-restored roles. This was not a full browser test.
- Existing authentication, session recovery, application tracking, resume ownership/upload/deletion, and selected demo/migration compatibility checks.

Syntax checks passed for the **11 changed/new JavaScript files**, and `git diff --check` passed. Validation used **Node v24.11.1**, in-memory or temporary test databases, and temporary upload directories. The existing development database was not initialized or migrated. The full repository suite, browser UI flows, CI execution, and the Node 20/22 matrix were not run during this phase.

### Decision

**Modified and validated before review.**

The implementation follows the existing database-injected Express routers, additive SQLite initialization, signed-cookie identity, and native frontend modules. The generated tests and source changes remain uncommitted for review. No Phase 02 functionality was started.

### Reflection

The implementation separates account role selection during registration from authorization on later requests. Permissions are derived from the current database record, while browser storage remains display metadata. Nullable ownership and snapshot fields preserve the existing job and application records without assigning demo postings to arbitrary recruiters or introducing snapshot behavior prematurely.

**Responsible Person:** Massi Sadek

---

## AI Interaction 2 – Feature 4, Phase 02: Secure Recruiter Posting Management API

**Date:** October 22, 2026

**Task ID/Title:** Feature 4 / US-09 – Phase 02: Secure Recruiter Posting Management API

**Tool:** Codex

**Purpose of AI Use:** Implement the recruiter posting API using the reviewed Phase 01 identity and database foundation, while preserving its uncommitted files and log entry.

### Prompt / Interaction

I provided the Phase 02 instructions, including:

> "Implement ONLY Phase 02: Secure Recruiter Posting Management API."

> "Phase 01 changes are intentionally UNCOMMITTED. Preserve all existing modifications, untracked files, tests, and AI Log entries."

The request specified seven recruiter endpoints, complete posting validation, database-enforced ownership, close/reopen behavior, safe deletion, scoped overview statistics, same-origin/CSRF protection, and dedicated tests. It excluded dashboard pages, an applications inbox, snapshot capture, later phases, and Git publishing operations.

### AI-Suggested Content

Codex added:

- `src/routes/recruiterRoutes.js`: overview, owned posting list/detail, creation, PATCH editing, status updates, and deletion. Every endpoint uses the existing database-backed recruiter authorization middleware; recruiter responses use `Cache-Control: no-store`.
- `src/domain/recruiterJobs.js`: explicit writable fields, canonical categories, exact existing employment/workplace/experience enums, structured-details validation, normalization, and an explicit recruiter job serializer.
- `src/middleware/requireSameOrigin.js`: mutation-only origin checks scoped to the recruiter router, compatible with the existing signed-cookie session and local development.
- `test/recruiter.test.js`: dedicated API tests using an in-memory SQLite database and real signed login sessions.

The only shared application edit was in `src/app.js`: import/register the router and map the existing JSON parser's oversized recruiter requests to a safe 400 response. Phase 01 database, authentication, authorization, frontend, and test files were preserved unchanged.

Technical decisions implemented in this phase:

- The server derives posting ownership from `request.authenticatedUser.id`; ownership/system properties are rejected in request bodies. New jobs use the existing database default of `open` and a null demo key.
- Read and mutation queries include recruiter ownership conditions. Missing, foreign-owned, and ownerless demo postings return the same 404 response.
- Lists include open and closed jobs, ordered by parsed creation timestamp descending and then ID descending. Application counts use grouped SQL aggregation rather than one query per posting. Overview counts are scoped to owned postings and return zeros for an empty account.
- Successful reads return `{ overview }`, `{ items, total }`, or `{ job }`. Creation returns 201 with `{ message, job }`; editing/status updates return 200 with `{ message, job }`; deletion returns 200 with `{ message }`. Errors use `{ error }`.
- Required text limits are title/company/location 200 characters, category 80, and description 5000. Categories normalize to canonical lowercase IDs. Optional blank/null enum fields normalize to null. Description paragraphs are preserved.
- Structured `details` uses the existing overview, responsibilities, qualifications, preferredSkills, benefits, and companyDescription conventions. Overview is required when a details object is supplied. Limits are overview 3000 characters, company description 2000, each list at most 20 nonblank items of at most 1000 characters, and normalized details at most 6000 UTF-8 bytes. Unknown sections, wrong types, and embedded NULs are rejected.
- PATCH preserves omitted top-level fields. Supplied structured details replace that optional JSON field; null clears it. Posting status changes use the separate endpoint and accept only `open` or `closed`.
- Deletion checks ownership and absence of applications in one atomic SQL statement. The existing foreign-key restriction remains intact; application conflicts return 409 with a suggestion to close the posting. Application rows/history are not mutated by posting edits, status changes, or failed deletion.
- Same-origin comparison uses Express's request protocol and Host, without a fixed domain or newly trusting forwarded headers. Explicit Origin must be a valid matching HTTP(S) origin. Supplied Fetch Metadata must say `same-origin`. When Origin is absent, a supplied Referer must match; requests without these browser headers remain usable by API clients. Mutation bodies require JSON, preventing simple cross-site form posts; bodyless DELETE remains supported. This policy relies on the existing absence of cross-origin CORS grants and applies only to recruiter routes.

### Validation

Codex verified the branch remained `task-4` at `ee75419`, recorded hashes for the Phase 01 files, and inspected only the relevant router/schema/security dependencies and test patterns.

The dedicated new tests were run with the permission required for Supertest's temporary local listeners:

```sh
node --test test/recruiter.test.js
```

Result: **26 passed, 0 failed, 0 skipped**. Coverage included all seven endpoints' authentication/role enforcement, complete creation, server ownership, public visibility, owned-only listing/details, PATCH behavior, validation/system-field rejection, ownerless demos, close/reopen, application/history preservation, deletion conflicts, scoped overview counts, origin policy, malformed/oversized JSON, safe database failures, and concurrency/constraint cases.

The existing public job-discovery suite was then selected:

```sh
node --test --test-name-pattern='US-05: job discovery' test/jobs.test.js
```

Result: **14 passed, 0 failed, 0 skipped** among selected tests. This verified public availability, ordering, search normalization/AND semantics, literal wildcard handling, safe validation/errors, full details, HTML routes, database constraints, and empty results. Unrelated seed/migration suites were not selected.

Final validation review identified embedded NUL strings as a potential SQLite text-constraint failure. Codex added explicit rejection and negative cases, then reran only the six affected validation checks:

```sh
node --test --test-name-pattern='complete posting|required-only creation|optional fields can|creation rejects|structured details reject|PATCH rejects' test/recruiter.test.js
```

Result: **6 passed, 0 failed, 0 skipped**. Overall, **40 distinct tests passed**, with six of them repeated after the targeted validation change. No Phase 02 test run failed.

The concurrency/constraint checks exercised simultaneous deletes, concurrent application submission/deletion, ownership reassignment immediately before each mutation, and simulated foreign-key deletion failure. They verified a single deletion winner, no orphaned records, preservation of successful applications, 404 after ownership changes, and safe 409 conflict responses. They are not a multi-process database load test.

Syntax checks passed for the **five Phase 02 JavaScript files**, and `git diff --check` passed. Validation used Node v24.11.1 and an in-memory test database. The development database was not initialized, seeded, or migrated.

The 64-test Phase 01 batch, full repository suite, browser UI tests, CI, and Node 20/22 matrix were not rerun. Existing application submission/tracking compatibility was exercised directly by the new lifecycle/deletion tests; unrelated resume/frontend behavior was not retested.

### Decision

**Modified and validated before review.**

The Phase 02 implementation remains uncommitted for review. No branch switch, commit, push, merge, rebase, reset, restore, clean, or PR operation was performed. No dashboard, inbox, snapshot capture, Phase 03, or Phase 04 work was started.

### Reflection

Parameterized owner conditions protect mutations even when ownership changes after authentication. Atomic deletion plus the existing foreign key preserves application records under competing requests. Scoping CSRF checks to the new router protects recruiter mutations without changing existing job-seeker endpoint contracts. Existing application views still join current job data, and public details still return 404 after closure; snapshot behavior and closed-posting UI remain outside this phase. Reverse-proxy deployment and browser behavior were not validated here.

**Responsible Person:** Massi Sadek

---

## AI Interaction 3 – Feature 4, Phase 03: Recruiter Dashboard UI

**Date:** October 22, 2026

**Task ID/Title:** Feature 4 / US-09 – Phase 03: Recruiter Dashboard and Posting Management Interface

**Tool:** Codex

**Purpose of AI Use:** Implement the recruiter frontend against the approved Phase 02 API, preserving all earlier uncommitted implementation files and AI Log entries.

### Prompt / Interaction

I provided the Phase 03 instructions, including:

> "Implement ONLY Phase 03: a functional recruiter dashboard and job-posting management interface integrated with the existing backend."

> "Reuse the project's existing frontend architecture."

The request covered recruiter navigation, real overview values, owned postings, complete create/edit forms, structured list controls, close/reopen, confirmed deletion, role-specific Apply restrictions, security/accessibility, and focused tests. It excluded applicant inboxes, snapshots, Phase 04, Phase 05 integration/CI, frameworks, dependencies, and Git publishing operations.

### AI-Suggested Content

Codex implemented:

- `src/pages/recruiter/dashboard.html`, served at `/recruiter/dashboard`, its trailing-slash alias, and the static `.html` path. The page reuses the shared branding, authenticated workspace shell, styles, theme, mobile navigation, and logout behavior.
- `src/pages/assets/recruiter.css`: token-based dashboard cards, overview statistics, responsive form/list layouts, and a native deletion dialog.
- `src/pages/assets/recruiter.js`: the page entry point using the existing session, API client, formatting, and authentication recovery.
- `src/pages/assets/recruiter-dashboard.mjs`: safe DOM rendering, independent loading/error recovery for overview and listings, a reusable create/edit form, add/remove controls for structured lists, duplicate-submission prevention, lifecycle requests, deletion confirmation, and 409 conflict handling.
- `src/pages/assets/recruiter-form.mjs`: exact existing categories/enums, complete field prepopulation, client validation, request-size checks, and whitelisted payload construction. Editing sends only changed top-level fields, preserving omitted optional values. Intentional clearing is supported.
- `src/pages/assets/workspace-role.mjs`: server-session-based workspace admission, role-specific navigation, and default destinations. Recruiter workspace access rejects job seekers, including route case variants; ordinary dashboard aliases direct recruiters to their dashboard.
- `src/pages/assets/job-application.mjs`: server-verified application action state. Recruiters do not query applicant actions or receive Apply controls; failed or unknown session checks fail closed.
- Minimal integration edits in `src/app.js`, `auth.js`, `job-context.mjs`, `workspace.js`, `public-header.js`, and `job-detail.js` for the page alias, login return paths, role-specific links, and Apply behavior.
- `test/recruiter-ui.test.js`: focused role/model/DOM tests and a real signed-cookie API lifecycle integration test, using the existing Node test runner and Supertest.

The prompt named `/api/auth/me`, but targeted inspection confirmed that the actual existing session endpoint is `/api/session`. Codex reused the existing session resolver and endpoint rather than adding a parallel authentication API.

The dashboard calls all seven existing recruiter API operations through the shared same-origin JSON/cookie client. It displays API-supplied counts and owned jobs, including closed postings. Posting text and error messages use textContent, input values, or safe DOM attributes; the new dashboard does not use innerHTML. Existing template-based integration points retain escaped content or static markup.

Closing/reopening refreshes both overview and postings. Permanent deletion requires explicit confirmation; postings already known to have applications have deletion disabled with an explanation. If an application arrives after the list was loaded, the server's 409 is shown as a close-instead message and the list/counts refresh. A successful save remains successful if the following refresh fails, avoiding a misleading prompt to resubmit it.

### Validation

Codex confirmed `task-4` remained at `ee75419` and recorded hashes of all 18 existing modified/untracked files before implementation. Backend database, recruiter API/validation, authorization, CSRF, and earlier test files were not changed. The only changes to pre-existing Phase 01/02 source were the approved small additions in app.js and the role-aware return destination in auth.js. Earlier AI Log entries were preserved and this entry was appended.

The initial focused command was:

```sh
node --test test/recruiter-ui.test.js test/job-context.test.js
```

Result: **19 passed, 4 failed**. All four failures came from the new DOM test double's page-ID extraction: its tag pattern omitted numbered heading tags such as h2. The actual HTML contained the expected headings. Codex corrected the test fixture without changing application code for those failures, then reran the affected DOM and real-controller integration checks:

```sh
node --test --test-name-pattern='Phase 03 dashboard DOM behavior|actual UI controller' test/recruiter-ui.test.js
```

Result: **9 passed, 0 failed**.

Final review strengthened the role gate for dashboard aliases and case variants. Only the affected role tests were rerun:

```sh
node --test --test-name-pattern='Phase 03 role-aware workspace integration' test/recruiter-ui.test.js
```

Result: **5 passed, 0 failed**. An added loading-state assertion was validated separately:

```sh
node --test --test-name-pattern='real overview values' test/recruiter-ui.test.js
```

Result: **1 passed, 0 failed**. There are **23 distinct passing tests** across this phase's selected checks: 19 new UI/integration tests and four existing navigation tests. No selected tests remain failed or skipped. Passed unrelated checks were not repeated.

Coverage included:

- Role-specific navigation, safe post-login destinations, server-verified admission, anonymous/job-seeker redirects, case variants, and recruiter dashboard aliases.
- Recruiter Apply restrictions, ordinary job-seeker application state, anonymous sign-in state, and failures that do not expose Apply controls.
- Canonical categories, backend-compatible complete payloads, required/enum/length/list/size validation, intentional clearing, and omission of unchanged or protected fields.
- API-driven overview/list rendering, loading and empty states, independent error/retry states, literal rendering of hostile posting/error text, form prepopulation, and add/remove list buttons.
- Duplicate-save prevention, preservation of input after API errors, and separation of save success from refresh failure.
- Confirm/cancel deletion, 409 explanation, deletion disabling after application counts refresh, and authentication-error handling.
- Actual Express page/asset availability and a real UI-controller-to-API flow for creation, editing, close/reopen, public availability, application arrival, deletion conflict, application-history preservation, and permanent deletion of an empty posting.

The DOM tests run actual dashboard code against a small test double derived from the page IDs; assigning innerHTML throws. This verifies behavior and safe rendering but is not a browser layout or accessibility-engine test. The real API integration uses an in-memory SQLite database, temporary Supertest listeners, real signed cookies, and the existing same-origin middleware.

Syntax checks passed for all **12 changed/new JavaScript files**, and `git diff --check` passed. Validation used Node v24.11.1. No development database was initialized, seeded, or migrated, and no normal application server was started or restarted.

The full Phase 01/02 batches, full suite, browser visual/keyboard checks, automated accessibility audit, CI, and Node 20/22 matrix were not run. CSS responsiveness and semantics were reviewed in source; no browser-rendered screenshots or viewport results are claimed.

### Decision

**Modified and validated before review.**

The implementation uses native modules and existing styles, sessions, APIs, and test tools. No framework, build step, dependency, backend role-policy change, or CSRF change was introduced. The work remains uncommitted on task-4. No commit, push, merge, rebase, reset, restore, clean, branch switch, or PR operation was performed.

### Reflection

Keeping role decisions tied to the server session avoids granting actions from display storage. A reusable form and changed-field payloads preserve optional posting sections during edits, while backend authorization remains authoritative. Independent resource recovery and clear mutation confirmations help users distinguish a failed refresh from a failed write. Browser review remains necessary before claiming visual or full keyboard/accessibility validation. Applicant management and snapshot capture remain outside this phase; no Phase 04 or Phase 05 work was started.

**Responsible Person:** Massi Sadek

---

## AI Interaction 4 – Final Acceptance Validation: Recruiter Posting Management

**Date:** October 22, 2026

**Task ID/Title:** Feature 4 / US-09 – Final validation of the assigned 1-point requirement

**Tool:** Codex

**Purpose of AI Use:** Validate the completed implementation against the exact requirement: "Allow recruiters to create and manage job postings."

### Prompt / Interaction

I requested final acceptance validation, preservation of all uncommitted work, and fixes only for confirmed blockers. After an interruption, I explicitly instructed Codex to resume without repeating completed work. Applicant management, snapshots, additional product features, and Git delivery operations were excluded.

### AI-Suggested Content

Codex reviewed the existing acceptance coverage and frontend/API wiring. No confirmed functional blocker was identified, so no application code or tests were changed during final validation. The dashboard and navigation use the existing `/api/session` identity contract and the approved `/api/recruiter` endpoints.

### Validation

Before the interruption, Codex executed the repository's CI commands once on Node v24.11.1 / npm 11.6.2:

- `npm ci`: exit 0; dependencies installed from the existing lockfile. npm reported three high-severity dependency findings and a prebuild-install deprecation warning.
- `npm test`: exit 0; **138 tests passed, 0 failed, 0 skipped, 0 cancelled**, across 14 suites.
- Syntax checks: **54 JavaScript files passed, 0 failed**, covering source and test `.js`/`.mjs` files with the appropriate CommonJS/module parsing mode.
- `git diff --check`: passed.

The full suite verified recruiter registration/login and role persistence; dashboard page availability and admission; owned posting creation/list/detail/edit; close/reopen and public availability; safe deletion/409 conflicts; unauthorized and cross-owner rejection; and preservation of existing job-seeker authentication, job search, application submission/tracking, resumes, sessions, migrations, and startup behavior. Dashboard controller integration exercised the real signed-cookie API using an isolated database. DOM tests are not a substitute for manual browser verification.

To identify the dependency warning accurately, Codex also ran `npm audit --json`: exit 1, reporting **three high-severity affected packages: body-parser, multer, and undici**. These security findings remain unresolved; no audit fix, dependency upgrade, or lockfile change was applied. Passing functional tests is not a claim of production security readiness.

On resumption, hash comparisons confirmed that all 32 recorded repository files, including package.json, package-lock.json, earlier implementation files, and this log, were unchanged since the completed integration checks. The passed tests and syntax checks were therefore reused rather than rerun. This entry was appended, and the final diff and preservation checks were completed.

The final worktree contains **14 modified tracked files and 16 untracked files**, including all prior work. The branch remains `task-4` at `ee75419`. No commit, push, merge, rebase, reset, restore, branch switch, or PR operation occurred.

### Decision

**Ready for manual browser verification of the 1-point requirement.**

No additional implementation is needed based on the automated acceptance results. Manual browser checks should cover recruiter signup/login, `/recruiter/dashboard`, create/view/edit, close/reopen, deletion confirmation, responsive layout, and keyboard behavior. The GitHub Actions Node 20/22 matrix and actual hosted CI were not executed locally; local checks used Node 24. No browser visual or accessibility-engine results are claimed.

### Reflection

The final pass confirmed the assigned posting-management workflow without expanding product scope. Reusing the verified results after checking file hashes avoided unnecessary test repetitions. The outstanding dependency findings and browser/CI limitations remain explicitly separate from the passing functional checks. No applicant inbox, snapshot capture, or additional phase was implemented during this validation.

**Responsible Person:** Massi Sadek
