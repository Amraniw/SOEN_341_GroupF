# AI Usage Log — Sprint 2

**Student:** Suheil Almouhassel  
**Project:** CareerConnect — SOEN 341  
**Assigned Task:** Task 1 — User Profile and Resume Management  
**User Stories:** US-03 and US-04  
**AI Tools:** ChatGPT and Claude Code  
**Branch:** `task-1`

## 1. Purpose of AI Usage

I used AI assistance to help implement the User Profile Management functionality and integrate it with the existing Resume Management system.

AI was used for code analysis, implementation, debugging, testing, and reviewing the integration with existing project components.

## 2. Prompts Used

**Prompt 1 — Repository Analysis**

"Analyze the existing project structure, identify the authentication, database, profile, and resume components, and determine what needs to be implemented for Task 1 without modifying teammates' code."

**Prompt 2 — Profile Implementation**

"Implement the job-seeker profile functionality, including creating, editing, displaying, and saving professional information using the existing Express and SQLite architecture. Integrate the existing resume system without rewriting it."

**Prompt 3 — Code Review and Testing**

"Verify that profile information persists correctly, users can only access their own profiles, and existing functionality remains unchanged. Run the existing automated tests."

**Prompt 4 — Scope Verification**

"Review the implementation and identify any incomplete requirements. Do not modify authentication, registration, dashboards, or other teammate-owned components."

## 3. AI-Assisted Implementation

AI helped implement and review:

- User profile HTML interface.
- JavaScript for profile creation, editing, and displaying information.
- Express API endpoints (`GET /api/profile` and `PUT /api/profile`).
- SQLite profile storage.
- User-specific profile access and validation.
- Integration with the existing resume-management functionality.

The implementation involved:

- `src/pages/profile/index.html`
- `src/pages/assets/profile.js`
- `src/routes/profileRoutes.js`
- `src/database/database.js`
- `src/app.js`

## 4. Testing and Verification

- All **81 existing automated tests passed**.
- Profile creation, editing, and persistence were verified.
- Resume integration was checked.
- Authentication and access controls were reviewed.
- Existing teammate functionality was checked for regressions.
