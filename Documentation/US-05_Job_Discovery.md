# US-05: Job search and filtering

Initially implemented on `task-2` for parent issue #5 and tasks #37–#41 and #73.
The latest user request moved the preserved working application onto `test`.
The subsequent commit instruction returns the completed feature to `task-2`.
See [the refinement report](US-05_Refinement.md) for current validation and scope.

The subsequent [stabilization pass](US-05_Stabilization.md) adds consistent public
navigation, server-verified session resolution, explicit logout, and workspace
listing/details routes using the same feature implementation. Its validation
supersedes the first-pass test counts below: **57 tests and 31 syntax checks**.

## Run locally

```sh
npm ci
npm start
```

Open `/jobs/` from the landing-page header or the workspace's **Find jobs** link.
`/jobs/index.html` also works. Public browsing requires no account. A standalone
static server cannot supply search results or resolve the `/jobs/:jobId` route;
use the Express application for functional review.

Server startup automatically installs missing records from the 50-job educational
catalog into the configured SQLite database (`DB_PATH`, or
`data/careerconnect.sqlite`). This makes the same initial catalog available to
anyone who runs `npm start` or `npm run dev` after cloning the project. Each
computer still owns its database; this does not synchronize accounts or edits.
Automatic setup is skipped for `NODE_ENV=production`, and the optional explicit
`npm run seed:jobs` command also refuses production. Unique `demo_key` values and
a transaction keep reruns repeatable. Startup preserves existing postings,
including IDs, edits and closed status, as well as users and resumes. Missing
demo records are recreated; close a posting instead of deleting it to keep it
unavailable across restarts. Tests use their own
in-memory databases and small fixtures, independently of this dataset.
Use `npm run seed:jobs -- --refresh` to replace earlier demo copy with the new
catalog. Refresh updates only the 50 managed keys, retaining IDs and status.
Real company names provide context; none of these vacancies is verified or official.

## Architecture and data changes

This repository uses Express 5, SQLite via `sqlite`/`sqlite3`, plain HTML/CSS/ES
modules, Node's test runner, and Supertest. There is no SPA router, ORM, frontend
test framework, build step, or existing CI configuration. Authentication and
resumes retain their existing routes and cookie sessions.

The existing additive initialization in `src/database/database.js` now creates:

- `job_categories`: canonical category IDs and labels from `src/domain/jobs.js`.
- `jobs`: integer ID, title, company, location, category foreign key, full plain
  text description, open/closed status, creation timestamp, and nullable unique
  demo identifier. Required text fields, status, and categories have database
  constraints. An availability/date index supports the current small dataset.

Existing users and resumes are retained. No destructive migration, new database
engine, or package dependency was introduced. This follows the repository's
existing `CREATE TABLE IF NOT EXISTS` approach rather than adding a migration
framework. A repeatable `PRAGMA table_info`/`ALTER TABLE ADD COLUMN` migration now
adds nullable constrained employment/workplace/experience fields and optional
`details_json`. Old rows retain their full plain-text fallback. Company/recruiter
ownership relationships remain outside this story.

## API and exact search behavior

### `GET /api/jobs?q=&location=&category=`

Response:

```json
{
  "items": [],
  "total": 0,
  "categories": [{ "id": "software-engineering", "name": "Software Engineering" }],
  "demoOnly": false,
  "hasDemo": false
}
```

The example shortens the category array; the API supplies all five canonical
categories. Each result contains ID, title, company, location, category ID and
label, description summary, `createdAt`, `isDemo`, `employmentType`, `workplaceType`
and `experienceLevel`. Full descriptions/structured sections are detail-only.

- Keyword search is a case-insensitive substring of title **OR** company **OR**
  full description. It matches a whole phrase, not independent ranked tokens.
  One- and two-character alphanumeric keywords use whole-token matching, so `AI`
  does not match incidental letters in `maintain` or `failure`. Seed descriptions
  include their location so keyword city searches work without changing the
  dedicated substring location filter.
- Location uses a case-insensitive substring of the stored location.
- Category is an exact canonical ID, normalized to lowercase.
- Leading/trailing whitespace is removed; repeated whitespace is collapsed.
  Empty values do not restrict results.
- Keyword, location, and category combine with **AND**.
- `%`, `_`, and backslash are literal characters, not search wildcards.
- All values are bound SQL parameters. Query shape, duplicate parameters,
  category values, and maximum lengths (120/100/80) are validated. Unsupported
  query parameters return 400.
- Only open jobs are returned, newest timestamp first, then descending ID.
  SQLite date normalization handles both default SQLite and ISO timestamps.
- The modest Sprint 2 dataset has no pagination, relevance score, or extra sort
  controls. `total` is the exact size of the filtered result, from the same query.
- Search uses SQLite's built-in `LIKE` behavior: case folding covers ASCII;
  accent folding and language-specific Unicode case folding are not implemented.

### `GET /api/jobs/:jobId`

Returns `{ "job": ... }` with the full stored description and optional `details`
(overview, responsibilities, qualifications, preferred skills, company description).
Malformed/absent structured data falls back to plain text. Invalid, unknown,
closed, nonpositive, or unsafe integer IDs return a safe 404 JSON error. Internal
database failures use the app's existing generic 500 error response. Database
paths, demo keys, and stack traces are not exposed to the browser.

## Frontend behavior

- A semantic search form applies text criteria on **Search jobs** or Enter.
  Category changes submit immediately; text search is deliberately explicit.
- Meaningful criteria live in URL query parameters. Reload, shareable links,
  Back/Forward, direct detail access, and **Back to jobs** preserve context.
- Cards retrieve results from SQLite through the real API, not a frontend array.
  Descriptions are escaped and displayed as text; stored markup cannot execute.
- A matching count, individually removable criteria, and clear-all controls show
  the current search. Category labels are supplied by the server.
- Initial loading uses static card-shaped skeletons. Subsequent requests retain
  existing results with an updating status. AbortController plus request
  generations prevent older responses from replacing newer state. A 15-second
  timeout leads to a retryable error.
- Empty results, API/network failure, timeout, and missing jobs have distinct
  states. Retry preserves applied criteria. Samples are identified discreetly;
  mixed real/demo results label the sample cards individually.
- Shared CareerConnect tokens, buttons, typography, icons, focus styles, motion
  rules, and header are reused. Workspace navigation opens `/workspace/jobs/`
  inside the existing workspace shell. Public `/jobs/` retains the public shell.
  Both anonymous account actions remain available in mobile public navigation.

## Issue completion map

| Issue | Implemented evidence |
| --- | --- |
| #37 | Responsive search form, compact category filter, shared visual language |
| #38 | Public SQLite-backed keyword search, validation, URL state |
| #39 | Location/category filters, AND semantics, individual removal and reset |
| #40 | Reusable job cards, exact counts, loading/empty/error/retry states |
| #41 | Search/API/seed integration tests and browser review |
| #73 | Dedicated detail route, full description, direct access, 404 UI, contextual return |

No GitHub issues were created or closed by this change. The scenarios in
`Documentation/Acceptance_Tests/US-05.md` are ready to copy into labeled GitHub
issues linked to #5 and the relevant tasks.

## Validation and CI handoff

The numbers below record the original implementation. Current validation is
**70 passing tests**; see [the refinement report](US-05_Refinement.md).

- Baseline: all 30 existing tests passed with `node --test`.
- Full suite: run `npm test` (the configured script is `node --test`).
  Final execution of `node --test` passed **45/45 tests** (30 existing and 15
  added). The environment did not expose an `npm` executable, so its exact
  configured test command was run directly.
  `test/jobs.test.js` adds small independent fixtures covering availability,
  ordering, all search fields, case/whitespace, combined filters, empty results,
  wildcard/injection safety, malformed input, direct details, invalid/closed
  IDs, HTML routing, database constraints, safe failures, and seed safeguards.
- `node src/database/seedJobs.js` created 22 sample records in the local database.
  The automated seed test verifies rerun safety, preservation, and production
  refusal.
- Run `node --check` against the server and browser JavaScript files; run
  `git diff --check` for whitespace validation.
  Final checks passed for all **26 JavaScript files**, and the diff check was
  clean. Repeating the local seed inserted **0** additional records.
- No build, lint, formatter, or type-check scripts are configured. No new CI
  pipeline or E2E dependency was added; CI ownership belongs to the team-level
  sprint work. Include `npm ci` and `npm test` in that pipeline.

Browser review used the running Express application and persisted demo data:
default listings; uppercase/lowercase keywords; combined keyword/location/category;
accurate counts; individual removal; clear all; no-results recovery; full details;
detail reload; contextual return; browser Back; invalid direct details; real
network failure by stopping the local server and successful retry after restart.
Both listing and detail geometry were checked at 1440, 1280, 1024, 768, and 390
pixels, with no horizontal page overflow. Search controls measured at least
44px high. Keyboard Tab moved from keyword to location with a visible 3px focus
outline. Labels, semantic headings/links, restrained live announcements, escaped
content, and reduced-motion CSS were reviewed. This is not a claim of a formal
screen-reader or automated WCAG audit.

## Limits and future integration

- Apply now is visible but disabled, with a persistent explanation that
  applications are unavailable. There is no handler, submission API or write.
  The application story can later connect the retrieved stable `job.id` to its
  authenticated submission endpoint.
- Recruiter posting management can write to the existing `jobs` table, use the
  canonical categories and open/closed status, and set `demo_key` to NULL. Such
  records are immediately visible without changing discovery. Recruiter ownership
  and authorization require that separate story's schema/API design.
- Saved jobs can reference the stable `jobs.id` and add an authenticated action
  beside the existing title link without replacing the card/query contract.
- This story adds no job creation UI, application tracking, external job feeds,
  saved-job persistence or recommendation system.
