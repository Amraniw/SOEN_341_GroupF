# US-05 stabilization: routing, session state, navigation, and containment

Follow-up: [account initialization and recovery](US-05_Account_Recovery.md)
corrects the stale default backend and replaces reload-based workspace recovery
with a true request retry. The latest suite contains 66 passing tests.

Branch: `task-2`. The user's direct branch instruction remains authoritative;
the second supplied prompt's references to `test` were not followed.
All uncommitted implementation work from the first pass was preserved.

## Confirmed root causes

1. **Looking ahead:** the landing page and both Jobs documents had independently
   hardcoded public headers. The Jobs copies omitted Looking ahead.
2. **Apparent logout:** the server's signed HttpOnly cookie remained valid across
   navigation. Browser reproduction confirmed the resume API still recognized
   the account. Jobs inferred displayed identity from tab storage, the landing
   header always rendered anonymous controls, and workspaces also relied on
   cached display metadata. There was no current-session endpoint to reconcile
   those presentations with the actual authenticated account. Cookie path was
   not the root cause.
3. **Workspace escape:** the workspace sidebar and dashboard job entry both
   linked to the public `/jobs/` route, which could only render the public shell.
4. **Background cutoff:** `.public-header + main` in `public.css` unintentionally
   applied landing-page gradients, a decorative pseudo-element, and
   `overflow: hidden` to Jobs' width-constrained main element. At the reproduced
   1280px viewport, that main was 1040px wide while the document was 1265px wide.
   The background stopped abruptly at its edges. This was not evidence of a
   document wider than the viewport. Removing the clipping also required
   explicitly allowing long result text and metadata to wrap.

## Architecture

- `public-header.js` defines the common public navigation once: Find jobs,
  How it works, and Looking ahead. Home and both public Jobs documents use it.
  The existing compact Back to home header on authentication forms remains
  appropriate to that separate form layout.
- `home.js` initializes the shared header without changing hero composition,
  preview behavior, typography, or feature-strip content.
- How it works and Looking ahead remain landing-page anchors, linked as
  `/index.html#how-it-works` and `/index.html#looking-ahead`. Active state follows
  the route/hash, and anchor spacing accounts for the sticky header.
- `GET /api/session` resolves the signed cookie against the users table and
  returns `{ user }`, or `{ user: null }` for an anonymous/invalid session.
  Responses use `Cache-Control: no-store` and never expose password fields.
- `session.js` shares that resolution across the document. Tab storage is only
  an optional display/receipt cache, not proof of identity. Public navigation
  resolves asynchronously without blocking browsing or flashing anonymous
  actions first. A lookup failure is represented as retryable unknown state.
- `workspace.js` awaits the same server resolution before showing any workspace
  identity. Anonymous visitors are directed to sign-in; failed lookups show a
  retry state. Other tabs and restored documents revalidate the actual cookie
  rather than being forced into another sign-in based on cached metadata.
- `POST /api/logout` clears the real session cookie. Header sign-out buttons
  only clear display state after that request succeeds. Cross-tab notifications
  exclude their originating document to avoid reloading a sign-in/logout flow
  before its own navigation completes.

## Public and workspace Jobs

| Context | Listing | Details | Presentation |
| --- | --- | --- | --- |
| Public | `/jobs/` | `/jobs/:jobId` | Shared public header and account-aware actions |
| Workspace | `/workspace/jobs/` | `/workspace/jobs/:jobId` | Existing workspace header, sidebar, identity, active Jobs item |

Both contexts serve the **same** listing/detail HTML and run the **same**
`jobs.js`, `job-detail.js`, `job-card.js`, query logic, and APIs. `job-shell.js`
chooses presentation from the explicit route, with no referrer or transient
navigation flags. `job-context.mjs` creates list/detail/return URLs in that
context and preserves keyword, location, and category query parameters.

Public browsing remains public even for authenticated visitors; it is never
automatically redirected into workspace Jobs. Your workspace and Visit public
site provide deliberate cross-navigation. The workspace's existing frontend
guard now uses server-verified identity; static shell HTML itself contains no
private account data. Existing protected APIs continue to enforce authorization.
Sign-in restores an allowed workspace destination, including a filtered detail
URL, and rejects external/malformed return URLs.

## Layout changes

Landing decoration is scoped to `.landing-main`. Public Jobs uses a full-width
unclipped main with a nested shared container, keeping heading, form, count,
notice, and cards on the same controlled grid. Workspace Jobs fits inside the
existing sidebar layout. Container queries adapt the search panel to available
content width rather than assuming the whole viewport is usable.

Mobile controls follow Keywords -> Location -> Category -> Search in both the
DOM and visual order. All public navigation links and both anonymous account
actions remain visible. Long metadata and result queries wrap; job cards stack
their details action when constrained. No body-level overflow hiding was added.

## Validation performed

### Automated and static checks

- `node --test`: **57/57 tests passed**, including all 45 from the first pass.
- Added 8 session/routing tests: anonymous lookup, no-store behavior, cookie-only
  identity, public/workspace navigation and refresh, real logout, private-API
  authorization, deleted/tampered sessions, and shared HTML route contracts.
- Added 4 native-module tests for deterministic route context, contextual
  details/return URLs, normalization/reset, and safe post-login destinations.
- `node --check`: **31 JavaScript modules passed**.
- `git diff --check`: clean.
- `npm` is unavailable in the execution environment, so the repository's exact
  configured test script (`node --test`) was run directly. No build, lint,
  formatter, or type-check scripts are configured; none are claimed to pass.

### Browser checks

An isolated development database and disposable local account were used to
avoid modifying real user accounts. Checks included:

- Anonymous Home -> Jobs -> How it works -> Looking ahead -> Jobs, with common
  links and anonymous account controls retained.
- Signed-in workspace -> Jobs -> details -> back, with sidebar, active item,
  identity, filters, result count, and route context preserved.
- Signed-in workspace -> public Home -> both anchors -> public Jobs, including
  landing/anchor/public Jobs reloads and direct entry in a new tab.
- Workspace detail reload and login restoration to a requested workspace detail.
- Explicit logout, anonymous controls afterward, and cross-tab sign-in/logout
  synchronization. Other open workspaces return to sign-in after actual logout.
- Account and resume pages load correctly; the landing preview still switches
  between its two existing states.
- Public combined search, removing an individual filter, browser Back, direct
  detail reload, return to results, zero results, and clear/reset behavior.
- Actual API connection failure by stopping the isolated local server, followed
  by successful retry after restart with the applied criteria preserved.
- Public listing, workspace listing, and workspace detail geometry at **1600,
  1440, 1280, 1024, 768, 430, and 390px**. No horizontal page overflow; search
  controls measured 46px high. Both anonymous account actions remained visible
  at all widths. Keyboard Tab followed Location -> Category -> Search after the
  keyword input, with a visible focus outline.
- Temporary long unbroken titles/company/location and a 120-character query at
  390px: no horizontal overflow in cards, detail content, or result status.
- Final normal-navigation console review returned no warnings/errors. Deliberate
  API failure was verified as a separate expected error condition.

## Scope and remaining limits

No job schema, seed strategy, search/filter semantics, data-access behavior,
authentication library, frontend framework, or package dependency changed in
this pass. Existing cookie-session lifetime and configuration remain in effect.
The first pass's SQLite Unicode-folding and application-submission limitations
remain unchanged. This is not a formal screen-reader audit or an automated E2E
suite; browser checks used the available browser tooling.
