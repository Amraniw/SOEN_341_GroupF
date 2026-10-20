# US-05 visual and content refinement — 2026-10-20

## Scope and branch

The latest supplied prompt explicitly requests `test`. The working checkout was
on `task-2`; a plain switch refused to overwrite local changes. The complete
working application was saved in recoverable stash
`b068d85d272fdad6fdb75ba10af1285e0be2e294`, then restored onto `test`.
The older `test` branch lacked the backend, so the preserved integrated app is
also present there. The user's subsequent instruction moves the completed
application changes back to `task-2` for committing. The staged `test` state is
retained in recovery snapshot `812b9c2aaffe27dbcb7ef6ca411624d103b9fe9c`.
No push, PR, deployment or new dependency was added.
Unrelated historical documents retain the target branch's versions; the recovery
snapshot also retains their prior-branch versions.

## Product changes

Cards use a neutral two-letter company mark, prominent linked title, company,
wrapping location/experience/category/date, concise summary, and two restrained
employment/workplace tags. Small hover elevation and arrow movement respect
reduced-motion preferences; keyboard focus outlines the entire linked card.
Search retains URL criteria, removable chips, counts and existing recovery states.

Details now show company identity, job metadata, overview, role-specific semantic
responsibility/qualification/preferred-skill lists and short company context.
The desktop summary sidebar is sticky; it stacks above the description when the
available content width is at most 820px, including inside the workspace shell.
Apply now is natively disabled and associated with its visible explanation via
`aria-describedby`. There is no application handler, endpoint, success or write.

## Persistence and seed

The additive migration adds nullable `employment_type`, `workplace_type`,
`experience_level` (constrained values), and `details_json`. Initialization checks
existing columns before adding them. Existing descriptions and legacy posting
rendering remain valid; invalid JSON falls back safely to the original text.
No accounts, resumes or unrelated jobs are replaced.

`src/database/demoJobs.js` contains exactly 50 authored server-side scenarios.
Each has 4–5 responsibilities, 4–5 qualifications, 2–3 preferred skills, an
individual overview and company context. The catalog spans all five canonical
categories, twelve location settings, all four experience levels, Full-time /
Internship / Contract, and On-site / Hybrid / Remote. Benefits are omitted rather
than inventing actual company compensation or policies.

Normal `npm run seed:jobs` inserts missing managed demo keys and preserves edits.
Explicit `npm run seed:jobs -- --refresh` updates the 50 managed demo records,
retaining their IDs and open/closed status; it deliberately replaces edits within
those demo records. Both paths are transactional and refuse production before
opening a database. No seed runs automatically. On the user's existing database,
the explicit refresh inserted 28 and enriched the original 22; total: **50**.

The list API includes a bounded summary and three metadata values, never the full
description or structured lists. Details are fetched only through the existing
ID-based detail endpoint. The original description remains searchable.

## Demo attribution

One unobtrusive notice appears above demo results and once on a demo detail:
“Demonstration job postings for educational purposes. These are not verified live openings.”
Company names are real; the vacancies, team and scope are fictional. No official
logos, external images, requisition IDs, recruiters, salary claims, sponsorship
or partnership claims are used. Mixed catalogs retain a small Demo label only
on the demo cards, with the same global notice.

## Search verification

Parameterized filters, exact canonical categories, AND semantics, literal LIKE
wildcards, ordering and validation remain in place. Short ASCII alphanumeric
terms (one or two characters) use token boundaries through bound SQLite GLOB;
longer keywords and location retain substring matching. This prevents `AI` from
matching incidental letters in words such as `failure`. Demo descriptions include
location text, making keyword city searches useful as well.

| Query | Matches in the 50-role catalog |
| --- | ---: |
| software | 25 |
| intern | 9 |
| aerospace | 17 |
| controls | 8 |
| AI | 7 |
| NVIDIA | 5 |
| SpaceX | 5 |
| Montreal | 6 |
| Seattle | 6 |

`intern` + Montreal + Data & Analytics returns exactly two roles. Upper/lowercase
queries return identical IDs. Unknown terms yield a successful zero count.

## Verification and limits

- `node --test`: **70 passed**, including all existing auth, resume, cookie-session,
  retry lifecycle and routing tests. New checks cover all 50 detail payloads,
  content diversity, metadata, small list responses, representative queries,
  explicit refresh preservation and reopening a migrated legacy database twice.
- Native syntax checks passed for **34 JavaScript modules**, and `git diff --check`
  is clean. A normal seed rerun inserted **0**, leaving exactly 50 local demo rows.
- Browser checks exercised public and authenticated workspace listings/details
  at **1440, 1280, 1024, 768, 430 and 390px**. All four surfaces had no horizontal
  page overflow. Long titles, company names and list text wrap; fields remain usable.
- Real UI checks covered combined criteria, direct detail reload, contextual
  return, clear/reset, zero results, invalid-ID UI and visible keyboard focus.
  Detail pages have one H1, logical headings, semantic lists, and the explained
  disabled Apply control. Sticky/stacked sidebar geometry was checked at each width.
- A temporary real Express app with an in-memory database verified disposable
  registration, login, workspace onboarding, session persistence, public landing
  anchors, sign-out and login again. Normal-navigation console inspection found
  no warnings/errors. The intentional missing-ID request returns 404 as expected.
- The production app is unbundled native HTML/CSS/JS. No build, lint or type-check
  script exists; there is no production build result to claim. Browser checks
  are manual automation, not a new committed E2E framework or formal WCAG audit.
- This remains educational content with no live vacancy feed, applications,
  recruiter management, salary/benefit data or extra metadata filter controls.
