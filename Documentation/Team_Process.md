# CareerConnect – Team Process

## Purpose

This document defines how our team will organize and collaborate on CareerConnect during Sprint 1. Our goal is to keep everyone's work clear and traceable, avoid unnecessary conflicts, and make sure that code and documentation are reviewed before becoming part of the final project.

For Sprint 1, our six team members are divided into three working groups:

- **2 members – Frontend**
- **2 members – Backend**
- **2 members – Documentation**

This division is specific to Sprint 1. At the beginning of future sprints, we will review the work that needs to be completed and redistribute responsibilities based on the sprint goals, workload, and team capacity.

---

## 1. Sprint 1 Team Workflow

For Sprint 1, the team works in parallel across three areas:

### Frontend Team

The frontend pair is responsible for the user-facing part of the basic features selected for Sprint 1.

Their work includes tasks such as:

- Creating the required pages and forms
- Implementing the interface for the selected Sprint 1 features
- Adding client-side validation where needed
- Connecting the interface to backend functionality when it becomes available
- Testing the user flow from the frontend side

Frontend development is done through the `frontend` branch.

### Backend Team

The backend pair is responsible for the server-side logic required for the Sprint 1 features.

Their work includes tasks such as:

- Implementing application logic
- Handling authentication and user data when required
- Creating the required backend functionality
- Managing database-related operations
- Providing the functionality needed by the frontend
- Testing backend behaviour and error cases

Backend development is done through the `backend` branch.

### Documentation Team

The documentation pair is responsible for organizing and maintaining the Sprint 1 project documentation.

This includes:

- README updates
- Sprint planning documentation
- Sprint 1 work plan
- Team process documentation
- Meeting minutes
- Team contribution tracking
- Repository organization
- Making sure required Sprint 1 documents are present and up to date

Each team member is still responsible for maintaining their **own AI Usage Log**, even if they are not part of the documentation pair.

Documentation work can be completed on a dedicated temporary branch such as:

`docs/team-process`

`docs/sprint1-planning`

`docs/meeting-minutes`

The branch is then merged through a Pull Request.

---

## 2. GitHub Workflow

We use GitHub Issues, branches, commits, and Pull Requests to keep our work organized and traceable.

Our general workflow is:

`Issue → Assigned Work → Development/Documentation → Commit → Push → Pull Request → Review → Merge → Done`

Before starting a task, the responsible member should make sure they understand what needs to be completed and that the corresponding Issue or Sprint task is clear.

While working, team members should commit meaningful progress rather than waiting until the entire sprint is finished.

When the work is ready, it is pushed to GitHub and submitted through a Pull Request so the changes can be checked before being integrated.

---

## 3. Branching Strategy

For Sprint 1, our repository uses the following main branches:

### `main`

`main` represents the stable version of CareerConnect.

Completed and reviewed work is ultimately merged into `main`.

Team members should avoid directly developing or making large changes on `main`.

### `frontend`

The `frontend` branch is the shared working branch for the two frontend members during Sprint 1.

Frontend changes are developed and tested here before being integrated with the rest of the application.

### `backend`

The `backend` branch is the shared working branch for the two backend members during Sprint 1.

Backend functionality is developed and tested here before integration.

### `dev`

`dev` is our integration branch.

Once frontend and backend work is ready to work together, it can be combined in `dev` so that the team can test the complete functionality before merging the stable result into `main`.

Our main development flow is therefore:

```text
Frontend Team ──→ frontend ──┐
                              │
                              ├──→ dev ──→ main
                              │
Backend Team ───→ backend ───┘
```

Documentation work does not need to go through the frontend or backend branches. A documentation branch can be created from the appropriate up-to-date branch and merged through a Pull Request.

Example:

```text
docs/team-process ──→ main
docs/meeting-minutes ──→ main
```

Temporary branches can be deleted after their Pull Request has been successfully merged.

---

## 4. Working With Shared Branches

Because two members are working on frontend and two members are working on backend, communication between each pair is important.

Before starting work, members should update their local copy of the branch:

```bash
git switch frontend
git pull
```

or:

```bash
git switch backend
git pull
```

The two members working in the same area should divide their tasks clearly so that they do not unnecessarily edit the same files at the same time.

For larger or independent tasks, a member may create a temporary feature branch:

```text
feature/user-login
feature/user-registration
feature/profile-management
```

Once the feature is ready, it can be merged into the appropriate shared branch through a Pull Request.

For example:

```text
feature/login-ui → frontend
feature/authentication → backend
```

This allows us to keep work separated when necessary without creating a branch for every small change.

---

## 5. GitHub Issues and Task Assignment

GitHub Issues are used to represent our user stories and important project work.

Each issue should be clear enough for the team to understand:

- What needs to be completed
- Who the work is for
- What result is expected
- Its priority
- Its relevant labels
- Who is responsible for it

User stories follow the format:

> As a [user], I want [functionality] so that [benefit].

When a user story requires several steps, it can be broken down into smaller tasks.

For example:

**US-01 – User Registration**

- Create registration interface
- Implement registration logic
- Validate user information
- Connect frontend and backend
- Test registration

This allows frontend, backend, and documentation work to remain connected to the same overall project requirements.

---

## 6. Commit Process

Commits should clearly describe the work completed.

Good examples:

```text
Add user registration form
Implement login validation
Add Sprint 1 work plan
Update Team Process documentation
Fix registration input validation
```

We should avoid unclear commit messages such as:

```text
update
changes
stuff
final
```

Before committing, team members should use:

```bash
git status
```

to verify which files are being included.

Commits should contain only files related to the work being performed whenever possible.

---

## 7. Pull Request Process

Pull Requests are used to integrate work safely and keep changes visible to the rest of the team.

A Pull Request should clearly state:

- What was completed
- Which feature, issue, or documentation task it relates to
- Any important information for the reviewer
- How the work was tested or checked, when applicable

Before creating or merging a Pull Request, the author should verify that the correct destination branch is selected.

Examples:

```text
feature/login-ui → frontend

feature/authentication → backend

frontend/backend → dev

dev → main

docs/team-process → main
```

We will avoid merging unfinished or clearly broken work into `main`.

---

## 8. Review Process

Whenever practical, another team member should review a Pull Request before it is merged.

For frontend work, the reviewer should check that:

- The requested interface or functionality is present
- The user flow works as expected
- The implementation matches the related user story
- Existing frontend functionality is not unnecessarily broken

For backend work, the reviewer should check that:

- The required logic works
- Inputs and important error cases are handled
- The implementation matches the related user story
- The changes can be integrated with the frontend when required

For documentation, the reviewer should check that:

- The document satisfies the Sprint 1 requirement
- The information reflects what the team is actually doing
- Required information is not missing
- The document is clear and organized

If a problem is found, the reviewer can leave a comment or request a change before the merge.

The purpose of the review is not only to approve work, but also to make sure at least one other team member understands what is being added to the project.

---

## 9. Definition of Ready (DoR)

A user story or task is considered **Ready** when the team has enough information to start working on it.

Before starting, we should be able to confirm that:

- [ ] The user story or task is clearly written.
- [ ] The expected result is understood.
- [ ] Acceptance criteria are defined when applicable.
- [ ] The work can be broken into understandable tasks.
- [ ] Important dependencies are known.
- [ ] The priority has been identified.
- [ ] The responsible member or working group is known.
- [ ] There are no major unanswered questions preventing the work from starting.

If the team does not understand what needs to be built, the item should remain in the backlog until it is clarified.

---

## 10. Definition of Done (DoD)

A user story or task is considered **Done** when:

- [ ] The required work has been completed.
- [ ] The acceptance criteria are satisfied.
- [ ] The functionality works as expected.
- [ ] Relevant testing or validation has been completed.
- [ ] There are no known blocking errors.
- [ ] The work has been committed and pushed to GitHub.
- [ ] The changes have been reviewed when applicable.
- [ ] The Pull Request has been merged into the correct branch.
- [ ] Related documentation has been updated when necessary.
- [ ] AI usage related to the task has been documented by the responsible member when applicable.
- [ ] The related Issue or Sprint task has been updated.

For development work, simply writing the code does not mean the task is Done. The work must also be checked and properly integrated.

For documentation work, the document must be complete, reviewed, and available in the repository.

---

## 11. Team Communication and Conflicts

Since several team members are working in parallel, communication is important.

Each pair should keep the other member informed about what they are currently modifying.

If two members need to work on the same file, they should coordinate before making major changes.

Members should regularly pull the latest changes from their working branch to reduce merge conflicts.

If a merge conflict occurs, the members involved should review both versions and resolve the conflict together when necessary. Another member's work should never be deleted simply to make a conflict disappear without first understanding the changes.

If someone is blocked or cannot complete an assigned task, they should tell the team as early as possible so the work can be adjusted.

---

## 12. Sprint 1 Documentation and AI Logs

Our repository keeps Sprint documentation separate from the application source code.

The team will maintain:

- Sprint deliverables
- Meeting minutes
- General project documentation
- Team contribution information
- Individual AI Usage Logs

Although two members are responsible for coordinating Sprint 1 documentation, **each team member remains responsible for documenting their own contributions and AI usage**.

Any AI-generated suggestion used for the project must be reviewed by the person using it. The team remains responsible for the final content, code, and decisions included in CareerConnect.

---

## 13. Future Sprints

The `2 frontend / 2 backend / 2 documentation` organization is our **Sprint 1 working structure**, not a permanent assignment for the entire project.

At the beginning of each future sprint, the team will review:

- The sprint requirements
- Remaining user stories
- Technical work required
- Documentation requirements
- Team workload and capacity
- What worked or did not work in the previous sprint

Based on this review, responsibilities may be redistributed.

The same team members do not have to remain in frontend, backend, or documentation roles for every sprint.

Our Git and review process may also be adjusted if the team identifies a more effective workflow, as long as the new process remains clear and agreed upon by the team.

---

## Team Agreement

For Sprint 1, our goal is to work as three coordinated pairs while still contributing to one shared CareerConnect project.

Each member is responsible for:

- Completing their assigned work
- Keeping their GitHub activity clear
- Communicating with their pair and the rest of the team
- Reviewing work when needed
- Keeping their AI Log up to date
- Being able to explain their own contribution

This process is intended to give us enough structure to work safely as a team without making the workflow unnecessarily complicated. We will review and improve it as the project progresses.