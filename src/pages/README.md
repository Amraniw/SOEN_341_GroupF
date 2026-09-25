# CareerConnect frontend — Sprint 1

## Run and integrate

This branch contains a dependency-free HTML/CSS/native JavaScript frontend.
Serve **src/pages as the HTTP document root**, not the repository root.
The public entry point is /index.html (also / with a standard static server).
Do not open these files directly using file://; ES modules and API requests need HTTP.

For a public-page preview from the repository root, with Python installed:

```sh
python -m http.server 3410 --bind 127.0.0.1 --directory src/pages
```

A static preview cannot register, sign in, or upload. It displays a service error
when the API is unavailable. There is no mock account or fake upload implementation.

For functional integration, serve this directory and the existing backend under
the same origin. The inspected dev backend already mounts src/pages using
express.static; all frontend assets now live inside that served directory.
Registration, login, and upload requests use the existing HttpOnly session cookie.
No backend changes or branch merges are part of this frontend change.

The test branch does not currently contain package.json, backend code, or the
backend test suite. Full functionality therefore requires the existing backend
to be integrated by the team. Do not treat a static preview as a complete deployment.

## Pages

- /index.html: public entry and explicitly illustrative product preview.
- /auth/signup.html: name, email, password, confirmation, then real sign-in.
- /auth/login.html: sign-in with retryable errors and password visibility.
- /dashboard/index.html: account details, setup steps, resume receipt summary.
- /profile/index.html: read-only name, email, creation date, account-access limits.
- /resume/index.html: PDF selection, drag-and-drop, validation, upload, receipts.

## Frontend structure

- assets/base.css: centralized colors, type, spacing tokens, controls and states.
- assets/public.css, auth.css, workspace.css: page-specific layouts.
- assets/responsive.css: desktop, tablet, mobile and reduced-motion overrides.
- assets/styles.css: stylesheet entry point, with ordered imports.
- assets/ui.js: consistent line icons, safe text rendering, date/size formatting.
- assets/home.js: controlled 01/02 preview state and desktop-only pointer response.
- assets/api.js: same-origin requests, timeout, HTTP/network errors.
- assets/session.js: display metadata scoped to the tab, never credentials.
- assets/workspace.js: shared navigation, mobile disclosure, account-change handling.
- assets/auth.js, dashboard.js, profile.js, resume.js: focused page behavior.

No framework, build step, font CDN, icon package, or new project dependency.
Public content and authentication forms use semantic HTML. Authenticated pages
require JavaScript; a noscript message explains how to proceed.

## Existing API contracts

| Operation | Endpoint           | Request                    | Success                      |
| --------- | ------------------ | -------------------------- | ---------------------------- |
| Register  | POST /api/register | JSON name, email, password | 201, user                    |
| Sign in   | POST /api/login    | JSON email, password       | 200, user and session cookie |
| Upload    | POST /api/resumes  | multipart field resume     | 201, resume                  |

Registration does not set a session; the frontend signs in after successful
registration. If that second request fails, it confirms account creation and
directs the user to sign in instead of registering again.

Validation follows the current server: name up to 100 characters; email up to
254 characters; registration password at least 8 characters and at most 72 UTF-8
bytes; resume PDF up to 5 × 1024 × 1024 bytes. The browser checks file extension,
provided MIME type and PDF signature. The server remains the authority.

## Deliberate limitations

The current backend has no session lookup, sign-out, profile update, resume list,
resume download, replacement, or deletion endpoints. The UI does not simulate them.

- Account details are the response from the latest successful sign-in in this tab.
  Session storage is only a display cache, never authorization.
- Account editing is read-only. Education, headline and photo upload are deferred.
- Upload confirmations contain server-returned filename/date and locally known
  size. They are retained only for the current sign-in; this is not server history.
- Dashboard setup progress reflects those two supported steps in this sign-in,
  not professional profile completeness or historical upload status.
- Uploads add independent copies. The UI explicitly explains this.
- A 401 from upload clears displayed identity and returns to sign-in.
- Display state expires after 23 hours, before the server's 24-hour cookie.
  Without a current-user endpoint, passive pages cannot verify a live session.
- Sign-in in another open tab notifies existing workspaces through BroadcastChannel
  to prevent stale displayed identity. Full session synchronization still needs
  a current-user endpoint; restored/suspended tabs and external API logins remain
  a backend-integration concern.
- There is no sign-out button because clearing browser display state would not
  invalidate the HttpOnly cookie. The account page explains the limitation.
- Jobs, companies, applications, employer tools and AI remain outside this increment.
  Roadmap text is clearly labeled and contains no enabled placeholder actions.

## Validation performed

Against an unmodified temporary snapshot of the existing dev backend with an
in-memory database and temporary uploads:

- All 20 existing Node backend tests passed.
- Browser checks covered real registration/login/upload, duplicate accounts,
  invalid credentials, invalid PDF/signature/size, receipts, reload, expired cookies,
  drag-and-drop, removal before upload, server errors, offline recovery, cross-tab
  sign-in, malformed display storage, and keyboard navigation.
- All six pages inspected at 1440, 1280, 1024, 768 and 390 pixels.
- The same five widths were exercised with hero state 02, registration validation,
  delayed loading, safe server failure, long identity data, and long filenames.
- Long names and filenames checked for overflow.
- Axe WCAG A/AA and best-practice checks passed on all six pages at desktop/mobile.
- Native JavaScript syntax and frontend formatting checked.
- The public page recorded zero cumulative layout shift in desktop/mobile spot checks;
  its dependency-free CSS/JavaScript assets transferred about 58 KB locally.
- Reduced-motion emulation confirmed immediate state changes with pointer response
  and nonessential transitions disabled.

Motion uses shared timing/easing tokens, opacity and transforms. Reduced-motion
mode removes pointer response and movement while retaining understandable state
changes. Cross-document View Transitions were intentionally not enabled after
Edge emitted abort warnings with the JavaScript-rendered workspace shell; normal
navigation remains immediate and every page progressively enhances its entrance.

Playwright, axe-core and Prettier were QA tools outside this repository. They were
not added to the application. No configured build, type-check or lint command
exists on this branch; do not report these as having passed.

For future review, repeat these flows against the integrated backend, especially
session expiration, account switching and the resume multipart contract.
