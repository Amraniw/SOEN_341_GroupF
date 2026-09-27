# AI Logs — Sprint 1

This document summarizes the main AI-assisted activities completed during Sprint 1 using ChatGPT and Codex. AI was used as a support tool for project organization, requirements analysis, documentation, implementation, debugging, testing, and review. All outputs were reviewed and validated before being integrated into the project.

**ChatGPT Chat Link:** [https://chatgpt.com/share/6ab95292-cffc-83ea-8f5c-8053d069a0a0]

**Codex Chat Link:** [https://chatgpt.com/s/cx_6ab961fb745c81919331b0881a8ad0ab]

---

# ChatGPT Prompts

## Task 1 — Repository Structure Review

**Purpose of AI Use:**  
Project organization and analysis.

**Chat Link or Prompt/Response:**  
See ChatGPT Chat Link above.

**Prompt:**  
Review our current GitHub repository setup for CareerConnect. The setup is not finished yet and some README files, folders, or documentation may still change. Identify anything important that should be modified or added for Sprint 1.

**AI-Suggested Content:**  
ChatGPT reviewed the repository structure and suggested improvements to the AI log organization, documentation folders, source folder, sprint deliverables, and project-management files.

**Validation:**  
The suggestions were compared against the Sprint 1 requirements before changes were made to the repository.

**Decision:**  
Modified before use.

**Reflection:**  
The review helped identify organizational improvements while avoiding unnecessary files. The final repository structure was decided based on the actual Sprint 1 requirements.

**Responsible Person:**  
Rayane Lkotbi

---

## Task 2 — Sprint Documentation Organization

**Purpose of AI Use:**  
Documentation and project-planning analysis.

**Chat Link or Prompt/Response:**  
See ChatGPT Chat Link above.

**Prompt:**  
Explain the difference between the Sprint Plan, Work Plan, and Team Contributions. What should each contain, and can they be combined into one project-management document without losing any required Sprint 1 information?

**AI-Suggested Content:**  
ChatGPT explained that the Sprint Plan covers priorities, risks, effort estimates, backlog, and team capacity; the Work Plan summarizes planned GitHub issues and assignments; and Team Contributions records the work actually completed by each member.

**Validation:**  
The explanation was compared with the Sprint 1 project instructions and Appendix A requirements.

**Decision:**  
Accepted.

**Reflection:**  
The interaction clarified the purpose of each project-management artifact and helped simplify the documentation structure.

**Responsible Person:**  
Rayane Lkotbi

---

## Task 3 — Generate Initial User Stories

**Purpose of AI Use:**  
Brainstorming and requirements elicitation.

**Chat Link or Prompt/Response:**  
See ChatGPT Chat Link above.

**Prompt:**  
Generate 10 user stories for CareerConnect, a web-based job search and application tracking platform.

The primary users are job seekers and recruiters.

The platform is expected to support user registration and authentication, profile management, resume management, recruiter job postings, job search and filtering, job applications, application status tracking, application history, saved jobs, and notifications.

Write each story using the format:

As a [user], I want [goal], so that [reason].

Keep the stories focused on user needs rather than implementation details.

**AI-Suggested Content:**  
ChatGPT generated 10 initial user stories covering registration, login, profile management, resume management, job search, application submission, application tracking, saved jobs, recruiter job postings, and an application dashboard.

**Validation:**  
The generated stories were compared with the CareerConnect requirements before being converted into GitHub Issues. Additional original stories were created separately by the team.

**Decision:**  
Modified and partially accepted.

**Reflection:**  
The AI-generated stories provided a useful starting point for the product backlog but still required review, task breakdown, labeling, and additional team-generated features.

**Responsible Person:**  
Rayane Lkotbi

---

## Task 4 — GitHub Issue and Sprint Workflow

**Purpose of AI Use:**  
Project-management and workflow clarification.

**Chat Link or Prompt/Response:**  
See ChatGPT Chat Link above.

**Prompt:**  
Now that we have the 10 AI-generated user stories, what should we do with them? Explain where they should go in GitHub, how they should be converted into Issues, and how they are used during Sprint 1.

**AI-Suggested Content:**  
ChatGPT recommended creating each user story as a GitHub Issue, breaking stories into implementation tasks, applying labels, adding relevant issues to the Sprint 1 project board, assigning team members when appropriate, and using the selected issues as the sprint backlog.

**Validation:**  
The proposed workflow was compared with the Sprint 1 requirements for GitHub Issues, labels, task breakdown, project planning, and assignments.

**Decision:**  
Accepted.

**Reflection:**  
The interaction clarified the relationship between user stories, GitHub Issues, the project board, and the Sprint 1 backlog.

**Responsible Person:**  
Rayane Lkotbi

---

## Task 5 — Review of Sprint 1 AI Usage

**Purpose of AI Use:**  
Policy review and validation of AI-assisted work.

**Chat Link or Prompt/Response:**  
See ChatGPT Chat Link above.

**Prompt:**  
Review the ChatGPT and Codex prompts used during Sprint 1 and determine whether they are within the permitted AI scope and are defensible under the SOEN 341 AI-use rules. Consider repository setup, documentation, user stories, frontend implementation, debugging, testing, and integration.

**AI-Suggested Content:**  
ChatGPT reviewed the planned AI log entries and identified which uses were clearly within scope, which required careful attribution, and which required stronger validation evidence. Particular attention was given to direct frontend implementation and distinguishing team-generated ideas from AI-generated content.

**Validation:**  
The review was compared with the SOEN 341 course outline, Sprint 1 instructions, and clarification provided by the TA regarding AI-assisted coding.

**Decision:**  
Accepted.

**Reflection:**  
The review helped ensure that the final AI log accurately discloses how AI was used and emphasizes validation, human decision-making, and responsibility for the submitted work.

**Responsible Person:**  
Rayane Lkotbi

---

# Codex Prompts

## Task 6 — Backend Architecture Review

**Purpose of AI Use:**  
Code understanding, coordination, and technical analysis.

**Chat Link or Prompt/Response:**  
See Codex Chat Link above.

**Prompt:**  
Help me understand and plan the backend work being completed with my teammate.

Review the backend changes added by my teammate and explain the architecture, authentication, database, API endpoints, resume-upload functionality, tests, and how the code works. Help me coordinate decisions without taking credit for my teammate's implementation.

**AI-Suggested Content:**  
Codex analyzed the backend structure and explained how the authentication, database, API routes, resume-upload functionality, and tests were organized.

**Validation:**  
The explanations were checked directly against the repository code and the teammate's implementation.

**Decision:**  
Accepted.

**Reflection:**  
The interaction improved my understanding of the backend and helped me coordinate frontend and integration work without misrepresenting authorship.

**Responsible Person:**  
Rayane Lkotbi

---

## Task 7 — Development Environment and Git Troubleshooting

**Purpose of AI Use:**  
Debugging and development-workflow support.

**Chat Link or Prompt/Response:**  
See Codex Chat Link above.

**Prompt:**  
Help configure and repair my local CareerConnect development environment and repository setup.

Verify Node.js, npm, dependencies, Git configuration, branches, and repository state. Diagnose terminal, OneDrive, authentication, and repository issues so that I can reliably edit, pull, test, commit, and push the project.

**AI-Suggested Content:**  
Codex helped diagnose development-environment problems, Git authentication issues, branch state, dependency setup, and OneDrive-related repository problems.

**Validation:**  
The fixes were validated by successfully running Git commands, accessing the correct repository, installing dependencies, and using the project locally.

**Decision:**  
Modified before use.

**Reflection:**  
The assistance was useful for resolving environment problems while improving my understanding of the local Git and Node.js workflow.

**Responsible Person:**  
Rayane Lkotbi

---

## Task 8 — Sprint 1 Frontend Implementation

**Purpose of AI Use:**  
AI-assisted implementation based on user-defined requirements and design constraints.

**Chat Link or Prompt/Response:**  
See Codex Chat Link above.

**Prompt:**  
Build a polished Sprint 1 frontend for CareerConnect on the experimental `test` branch.

First inspect the existing repository and preserve its technology stack. Focus on the Sprint 1 features—registration/authentication and resume or profile management—while creating a professional application shell, responsive design system, accessible forms, and honest loading, error, empty, and success states. Do not implement unsupported future features.

**AI-Suggested Content:**  
Codex created an initial frontend implementation for the selected Sprint 1 features based on the specified requirements, technology stack, interface expectations, responsive behavior, and accessibility constraints.

**Validation:**  
The implementation was manually reviewed in the browser, compared with the Sprint 1 scope, tested at different screen sizes, and later refined through additional implementation and testing passes.

**Decision:**  
Modified before use.

**Reflection:**  
Codex accelerated implementation, but the initial result still required human review, design decisions, visual refinement, testing, and integration with the backend.

**Responsible Person:**  
Rayane Lkotbi

---

## Task 9 — Frontend Refinement and Testing

**Purpose of AI Use:**  
Code review, UI refinement, debugging, and testing.

**Chat Link or Prompt/Response:**  
See Codex Chat Link above.

**Prompt:**  
Review the initial CareerConnect frontend implementation and perform additional refinement passes.

Use screenshots and browser testing to improve the landing page, registration experience, dashboard, navigation, typography, spacing, responsive behavior, accessibility, form validation, submission feedback, transitions, and important desktop, tablet, and mobile states. Preserve the working backend integration and stay within Sprint 1 scope.

**AI-Suggested Content:**  
Codex identified and corrected visual inconsistencies, responsive-layout issues, validation behavior, submission feedback, accessibility concerns, and other usability problems.

**Validation:**  
The updated interface was repeatedly inspected in the browser and tested across multiple screen sizes and user states. Visual regressions and functional problems were corrected through additional passes.

**Decision:**  
Modified before use.

**Reflection:**  
Iterative refinement was more effective than accepting the first generated implementation. The process showed the importance of reviewing and testing AI-generated code rather than assuming the first result is correct.

**Responsible Person:**  
Rayane Lkotbi

---

## Task 10 — Frontend and Backend Integration

**Purpose of AI Use:**  
Integration, debugging, and testing.

**Chat Link or Prompt/Response:**  
See Codex Chat Link above.

**Prompt:**  
Help combine and test the frontend and backend work.

Create or verify a combined development branch containing the experimental frontend and backend changes, confirm that the frontend uses the real backend endpoints, run the application and automated tests, diagnose integration or merge problems, and explain how to test the resulting site in VS Code and the browser.

**AI-Suggested Content:**  
Codex assisted with integrating the frontend and backend branches, verifying API usage, identifying merge or integration issues, running tests, and checking that the combined application operated correctly.

**Validation:**  
The combined application was run locally, backend endpoints and frontend interactions were checked, automated tests were executed where available, and integration problems were manually reviewed.

**Decision:**  
Modified before use.

**Reflection:**  
The interaction was useful for validating that independently developed frontend and backend work functioned together correctly before the Sprint 1 demonstration.

**Responsible Person:**  
Rayane Lkotbi
