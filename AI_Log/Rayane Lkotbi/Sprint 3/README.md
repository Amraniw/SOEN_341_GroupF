# AI Logs — Sprint 3

This document records the main AI-assisted planning and requirements activities carried out during Sprint 3 of CareerConnect. ChatGPT was used to interpret the sprint guidelines, review the backlog, and prepare sprint documentation. Codex activities are reserved below for separate reporting. AI-generated material must be checked against the official guidelines, repository issues, and the team's actual implementation before submission.

**ChatGPT Chat Link:** [https://chatgpt.com/share/6afb4569-39a4-83ea-ab8a-9424fcaba9f0]

**Codex Chat Link:** [https://chatgpt.com/s/cx_6afb4f0191008191ac05e755c2ab6aa9]

---

# ChatGPT Prompts

## Task 1 — Sprint 3 Guidelines Analysis

**Purpose of AI Use:**  
Requirements analysis and sprint planning.

**Chat Link or Prompt/Response:**  
See ChatGPT Chat Link above.

**Prompt:**  
"We have received the sprint 3 guideline. Analyze it first and give me your feedback, compare what its asking with what we have done."

**AI-Suggested Content:**  
ChatGPT identified the Sprint 3 requirements: recruiter posting/application management, job-seeker analytics, notifications, initial Generative AI functionality, acceptance tests, automated unit tests, CI, and repository documentation. It compared these requirements against earlier CareerConnect planning and flagged the ambiguity between starting the AI feature in Sprint 3 and completing it in Sprint 4.

**Validation:**  
Reviewed the analysis against the official Sprint 3 guideline. Implementation status was treated as unverified unless supported by the supplied issue lists or screenshots.

**Decision:**  
Accepted as planning guidance, with actual feature and test completion requiring repository verification.

**Reflection:**  
The review clarified the sprint's emphasis on test coverage and CI, and highlighted requirements that needed to be added or refined in the backlog.

**Responsible Person:**  
Rayane Lkotbi

---

## Task 2 — Sprint 3 Backlog and Project Management Documentation

**Purpose of AI Use:**  
Backlog refinement, task planning, and documentation drafting.

**Chat Link or Prompt/Response:**  
See ChatGPT Chat Link above.

**Prompt:**  
"Ok, look at what we will work on for this sprint: You can see in the picture the User stories that needs to be addressed for Sprint 3, its written in small for milestone Sprint 3. Do not take into account the bonus User story. Now that you know the US and tasks that has been distributed, I want you to create a checklist [...] for sprint 3. You must also generate [...] a sprint management [...] for sprint 3."

**AI-Suggested Content:**  
ChatGPT drafted a Sprint 3 master checklist and project-management section covering US-08 (Recruiter Application Dashboard), US-10 (Job-Seeker Application Dashboard), US-16 (Notifications and Reminders), and US-17 (AI-Powered Resume Feedback). It proposed priorities, effort estimates, risks, a team-capacity breakdown, and a work-plan table, while separating acceptance testing, unit testing, CI, documentation, and final evaluation.

**Validation:**  
Compared the selected user stories and issue numbers with the supplied GitHub screenshot and the sprint guideline. Proposed dates, effort estimates, and unconfirmed assignments were treated as planning suggestions rather than verified project records.

**Decision:**  
Modified before use; project-management details were to be finalized against actual GitHub issues and team assignments.

**Reflection:**  
This helped organize the Sprint 3 workload into a consistent checklist and made the difference between acceptance tests and unit tests explicit.

**Responsible Person:**  
Rayane Lkotbi

---

# Codex Prompts

## Task 3 — Repository Reorientation Before US-17

**Purpose of AI Use:**  
Repository analysis, branch verification, and preparation for implementation.

**Chat Link or Prompt/Response:**  
See Codex Chat Link above.

**Prompt:**  
Before starting Sprint 3 implementation, verify the current branch and Git status, review recent commits and merges, and explain the existing frontend, backend, database, routing, authentication, tests, and CI. Repeat the review after the recruiter-dashboard merge and the creation of the resume feature branch. Keep this review read-only.

**AI-Suggested Content:**  
Codex summarized the Express and SQLite architecture and traced the Sprint 1 and Sprint 2 features that US-17 would build on. The second review confirmed that `resume_ai` and `main` pointed to the PR #149 merge at that time and identified the newly merged multiple-resume support and default selection.

**Validation:**  
Codex compared the branch tips with GitHub, inspected the relevant source and merge diffs, and verified a clean working tree. The updated baseline passed all 183 automated tests.

**Decision:**  
Accepted as the baseline for implementing US-17 on `resume_ai`.

**Reflection:**  
Rechecking after the merge clarified that default selection controls the resume shown on the profile. The AI review needed its own explicit selection so a user could review any saved PDF without changing that default.

**Responsible Person:**  
Rayane Lkotbi

---

## Task 4 — US-17 Core Implementation and Local Setup

**Purpose of AI Use:**  
AI-assisted feature implementation, debugging, and regression testing.

**Chat Link or Prompt/Response:**  
See Codex Chat Link above.

**Prompt:**  
Implement Phase 1 of US-17 on `resume_ai`. Let a job seeker select one saved PDF on the existing Resume page, verify ownership, extract readable text, and return concise, structured AI feedback. Distinguish unreadable PDFs from readable documents that are unrelated to resumes. Keep credentials server-side and test the flow with a fake provider.

**AI-Suggested Content:**  
Codex added server-side PDF.js extraction, an authenticated analysis endpoint, and an OpenAI Responses API integration with schema validation. The Resume page showed a candidate profile, aligned roles, strengths, and improvements for the selected PDF. Follow-up work clarified the missing-key message, isolated PDF parsing after an intermittent Windows crash, and configured GPT-6 Luna as the default model.

**Validation:**  
Automated checks covered resume ownership, selected-file isolation, non-resume and unreadable PDFs, invalid provider responses, and duplicate requests. The full local suite passed 193 tests after the parser fix. A Chrome smoke test exercised the review flow with synthetic PDFs and a fake provider.

**Decision:**  
Modified before use through debugging and local setup checks. The feature was later merged into `main` in PR #156.

**Reflection:**  
Ownership checks and structured output validation were essential because resume text is sensitive and AI responses can be incomplete. Mocked tests verified the application flow, while a live review depended on the server's API configuration.

**Responsible Person:**  
Rayane Lkotbi

---

## Task 5 — US-17 Feedback and Interface Refinement

**Purpose of AI Use:**  
Response refinement, interface polish, and accessibility testing.

**Chat Link or Prompt/Response:**  
See Codex Chat Link above.

**Prompt:**  
Use the supplied screenshots and feedback to polish the AI Resume Review experience. Give results more room, make the feedback shorter and easier to scan, and refine the Analyze, loading, results, and retry states. Preserve the working resume selection and analysis flow, and respect reduced-motion preferences.

**AI-Suggested Content:**  
Codex widened the review area and organized the results into a candidate profile, role tags, strengths, and areas to improve. It tightened response limits, then refined the loading placeholder, filename and status presentation, and keyboard focus. Validated results appear in a short stagger as the panel resizes.

**Validation:**  
Codex ran 42 focused tests after the layout and response-length changes, then 10 focused tests after the final interaction pass. Chrome checks with a fake provider covered desktop, tablet, and mobile layouts, keyboard focus, reduced motion, retry, and switching between resume and non-resume results. I reviewed the visual direction and requested a final pass on loading and transitions.

**Decision:**  
Modified before use based on screenshot review and feedback. The final interface uses a staged reveal after validation.

**Reflection:**  
The first layout made useful feedback difficult to scan. Shorter responses, clearer sections, and stable controls improved the experience while keeping review results tied to the selected resume.

**Responsible Person:**  
Rayane Lkotbi
