# AI Logs — Sprint 2

This document summarizes the main AI-assisted activities carried out during Sprint 2 using ChatGPT and Codex. AI was used to support sprint planning, requirements analysis, GitHub project management, documentation, feature implementation, debugging, acceptance testing, Continuous Integration (CI), and code review. AI-generated suggestions and outputs were reviewed and validated as appropriate before being incorporated into the CareerConnect project.

**ChatGPT Chat Link:** [https://chatgpt.com/share/6adebc5d-eadc-83e9-8846-e1700aefa538]

**Codex Chat Link:** [https://chatgpt.com/s/cx_6adebca0f6cc8191bba4c0f6411b228d]

---


# ChatGPT Prompts

## Task 1 — Sprint 2 Guidelines Review

**Purpose of AI Use:**  
Requirements analysis and sprint planning.

**Chat Link or Prompt/Response:**  
See ChatGPT Chat Link above.

**Prompt:**  
Review the Sprint 2 project guidelines and identify the required features, deliverables, evaluation criteria, and project management expectations.

**AI-Suggested Content:**  
ChatGPT summarized the Sprint 2 requirements, including profile and resume management, job search, application submission and tracking, and initial recruiter functionality. It also identified the required acceptance tests, CI pipeline, GitHub documentation, contribution logs, AI logs, and evaluation criteria.

**Validation:**  
The summary was compared against the official Sprint 2 guidelines to verify the required features, deliverables, and grading criteria.

**Decision:**  
Accepted for planning reference.

**Reflection:**  
The review clarified Sprint 2 expectations and helped identify the main development and documentation priorities.

**Responsible Person:**  
Rayane Lkotbi

---

## Task 2 — Sprint 2 User Story Prioritization

**Purpose of AI Use:**  
Backlog analysis and sprint planning.

**Chat Link or Prompt/Response:**  
See ChatGPT Chat Link above.

**Prompt:**  
Analyze the existing CareerConnect user stories and determine which should be prioritized for implementation during Sprint 2.

**AI-Suggested Content:**  
ChatGPT recommended prioritizing profile and resume management, job searching and filtering, application submission, and application status tracking. Recruiter functionality was identified as a secondary priority because it can be completed during Sprint 3. Additional features such as notifications and saved jobs were recommended for later implementation.

**Validation:**  
The proposed priorities were compared against the mandatory Sprint 2 features. The recommendations were preliminary because the actual GitHub backlog was not provided for direct review.

**Decision:**  
Accepted as preliminary planning guidance, subject to review against the team's GitHub Issues.

**Reflection:**  
The analysis helped distinguish mandatory Sprint 2 functionality from features that could be deferred, supporting a more focused sprint backlog.

**Responsible Person:**  
Rayane Lkotbi

---

## Task 3 — Continuous Integration Requirements Review

**Purpose of AI Use:**  
Technical research and requirements clarification.

**Chat Link or Prompt/Response:**  
See ChatGPT Chat Link above.

**Prompt:**  
Explain the purpose of Continuous Integration (CI), how GitHub Actions supports automated testing, and whether CI was required during Sprint 1.

**AI-Suggested Content:**  
ChatGPT explained how CI automatically builds and tests code changes to detect integration problems. It described how GitHub Actions executes automated workflows when code is pushed or pull requests are opened. It also clarified that a working CI pipeline was not an explicit Sprint 1 deliverable but is mandatory in Sprint 2.

**Validation:**  
The CI requirements were compared against the Sprint 1 and Sprint 2 guidelines. The technical explanation was reviewed for consistency with GitHub Actions functionality.

**Decision:**  
Accepted.

**Reflection:**  
The interaction clarified the role of CI in collaborative development and established why the team must implement and demonstrate a working pipeline during Sprint 2.

**Responsible Person:**  
Rayane Lkotbi

---

## Task 4 — GitHub Actions CI Configuration Guidance

**Purpose of AI Use:**  
Technical planning and CI configuration guidance.

**Chat Link or Prompt/Response:**  
See ChatGPT Chat Link above.

**Prompt:**  
Provide guidance on configuring a GitHub Actions workflow appropriate for the CareerConnect project.

**AI-Suggested Content:**  
ChatGPT proposed a CI workflow using `.github/workflows/ci.yml`, triggered by pushes and pull requests. It provided an example Node.js configuration for installing dependencies, running automated tests, and building the application. It also recommended testing both successful and failed workflow executions and configuring branch protection.

**Validation:**  
The proposed workflow was reviewed conceptually against Sprint 2 requirements. The example was not executed or verified against the actual CareerConnect technology stack.

**Decision:**  
Accepted as guidance; configuration requires adaptation and testing before implementation.

**Reflection:**  
The guidance provided a starting point for implementing CI while highlighting the need to adapt the workflow to the project's dependencies, test framework, and repository structure.

**Responsible Person:**  
Rayane Lkotbi

# Codex Prompts

## Task 6 — Sprint 2 Requirements Review

**Purpose of AI Use:**  
Requirements understanding, scope analysis, and preparation for implementation.

**Chat Link or Prompt/Response:**  
See Codex Chat Link above.

**Prompt:**  
Read the Sprint 2 guidelines, verify access to the entire document, and explain the sprint objectives, requirements, deliverables, and potential concerns. Focus on Task 2, covering job search and the job listing interface. Do not modify files or begin implementation during this preliminary review.

**AI-Suggested Content:**  
Codex reviewed the three-page document and summarized the job listing, keyword/location/category filtering, and detailed job-description requirements. It also identified sprint-wide requirements such as acceptance tests, CI, AI usage records, and contribution logs.

**Validation:**  
The analysis was checked against the supplied Sprint 2 PDF. The preliminary review remained read-only and did not implement functionality.

**Decision:**  
Accepted as preparation for the implementation work.

**Reflection:**  
Reviewing the requirements first helped distinguish Task 2 functionality from other sprint features and project-management responsibilities.

**Responsible Person:**  
Rayane Lkotbi

---

## Task 7 — Job Search and Listing Implementation

**Purpose of AI Use:**  
AI-assisted frontend and backend implementation based on user-defined requirements.

**Chat Link or Prompt/Response:**  
See Codex Chat Link above.

**Prompt:**  
Implement Sprint 2 Task 2 in the existing CareerConnect application. Inspect and preserve the repository architecture, then provide available job listings, keyword search, location/category filtering, and detailed job descriptions. Preserve existing authentication and resume functionality, and perform the requested work on the designated branch.

**AI-Suggested Content:**  
Codex added SQLite-backed job and category persistence, validated API routes, parameterized search, reusable job cards, a search interface, and dedicated job details. It implemented result counts, URL-preserved criteria, removable filters, contextual return links, and loading, empty, error, and retry states using the existing Express and native HTML/CSS/JavaScript architecture.

**Validation:**  
API tests covered matching, normalization, combined filters, literal wildcard handling, invalid input, ordering, unavailable jobs, and detail retrieval. The interface was also reviewed through real browser interactions, including searches, refreshes, detail navigation, and return to results.

**Decision:**  
Modified before use through subsequent debugging, integration, and visual refinement passes.

**Reflection:**  
Codex accelerated implementation, but the initial result needed further review to ensure the feature behaved consistently within the existing application.

**Responsible Person:**  
Rayane Lkotbi

---

## Task 8 — Navigation, Session, and Responsive Layout Stabilization

**Purpose of AI Use:**  
Integration debugging, interface refinement, and regression testing.

**Chat Link or Prompt/Response:**  
See Codex Chat Link above.

**Prompt:**  
Use the supplied screenshots and observed bugs to fix inconsistent public navigation, apparent sign-out when visiting Jobs, incorrect public/workspace routing, and responsive layout problems. Preserve the existing working search and filtering functionality.

**AI-Suggested Content:**  
Codex centralized public navigation, added server-verified session lookup and explicit logout, and reused the same Jobs implementation within public and authenticated workspace shells. It corrected landing-page styling that affected Jobs, constrained layout problems, and navigation that lost workspace context. It also addressed a same-document account-notification race during sign-in and logout.

**Validation:**  
Browser checks covered signed-in and anonymous navigation, landing-page anchors, refreshes, direct entry, logout, account changes across tabs, and public/workspace Jobs. Automated session and navigation-context tests were added alongside the existing feature tests.

**Decision:**  
Modified before use based on browser findings and user feedback.

**Reflection:**  
The debugging showed that correct backend authentication does not automatically guarantee consistent account presentation and navigation across every page.

**Responsible Person:**  
Rayane Lkotbi

---

## Task 9 — Workspace Initialization and Account-Status Recovery

**Purpose of AI Use:**  
Root-cause analysis, error-recovery implementation, and testing.

**Chat Link or Prompt/Response:**  
See Codex Chat Link above.

**Prompt:**  
Investigate the workspace account-status error and the Retry account status / Try again controls shown in the supplied screenshots. Make retries perform a fresh check and allow recovery without repeatedly registering or signing in.

**AI-Suggested Content:**  
Codex identified a stale backend process on the default local address that had not loaded the session endpoint. It restarted that instance against the existing database and improved the shared session lifecycle, pending-request deduplication, loading feedback, malformed-response handling, and retry behavior. Workspace initialization could then resume after a successful retry instead of requiring a document reload.

**Validation:**  
Automated tests covered transient failure, repeated failure, recovery, concurrent checks, unauthorized sessions, malformed responses, and preservation of a verified identity during service errors. An isolated in-memory browser test environment exercised real registration, login, cookies, and deliberately failed session checks without changing saved user accounts.

**Decision:**  
Modified before use and validated through repeated failure-and-recovery scenarios.

**Reflection:**  
Testing the same server address used by the user was essential. A retry control also needed to recover the application state, rather than only reload the page or repeat a permanently failing request without useful feedback.

**Responsible Person:**  
Rayane Lkotbi

---

## Task 10 — Job Cards, Structured Details, and the 50-Job Demonstration Catalog

**Purpose of AI Use:**  
Visual refinement, data modelling, demonstration-content generation, and usability improvement.

**Chat Link or Prompt/Response:**  
See Codex Chat Link above.

**Prompt:**  
Improve the working job-discovery experience without rebuilding its architecture. Refine the cards and search surface, create richer role-specific details, and expand the persistent demonstration catalog to exactly 50 jobs. Use recognizable company names with clear educational disclaimers, preserve search behavior, and keep application submission outside this refinement pass.

**AI-Suggested Content:**  
Codex introduced restrained company monograms, clearer title/company hierarchy, employment/workplace metadata, and subtle card interactions. It added optional structured detail fields through an additive database migration and authored 50 server-side demonstration postings with distinct overviews, responsibilities, qualifications, and preferred skills. Detail pages gained a sticky desktop summary that stacks on smaller screens. Seed reruns preserved existing edits, while an explicit refresh updated managed demo content without changing stable job IDs.

During this pass, Apply now was visibly disabled with an explanation because actual submissions belonged to a separate task. This describes that implementation stage, not the later application-submission work added elsewhere in the project.

**Validation:**  
Tests verified all 50 persisted records, detail payloads, lightweight listing responses, metadata diversity, legacy database migration, repeatable seeding, and preservation of unrelated records. Representative searches and combinations were checked. A relevance issue where AI matched incidental letters in words such as maintain was corrected using whole-token matching for short alphanumeric terms.

**Decision:**  
Modified before use after functional and visual review.

**Reflection:**  
Generated demonstration content required review for variety, technical plausibility, and honest attribution. Real company names did not make these fictional educational roles official or verified vacancies.

**Responsible Person:**  
Rayane Lkotbi
