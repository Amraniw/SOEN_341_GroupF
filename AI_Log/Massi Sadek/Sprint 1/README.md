# AI Usage Log – Sprint 1

**Project:** CareerConnect – Job Search and Application Tracking Platform  
**Course:** SOEN 341 – Software Process  
**Sprint:** Sprint 1  
**Responsible Person:** Massi A. Sadek  

---

## AI Interaction 1 – Git/GitHub Workflow

**Date:** September 21, 2026  
**Task ID/Title:** Understanding Git/GitHub Workflow  
**Purpose of AI Use:** Technical guidance and understanding Git/GitHub collaboration.

### Prompt / Interaction

I used AI to better understand how to safely work with our shared GitHub repository.

Example prompts:

> "Our team has a shared GitHub repository for our SOEN 341 project. How can I safely clone the repository and work on it without affecting the original project or breaking another member's work?"

> "Once I have cloned the repository, how do I safely pull the latest changes, create my own branch, make changes, commit them and push them for a Pull Request?"

I also asked follow-up questions about commands such as `git status`, `git pull`, `git switch`, `git add`, `git commit`, and `git push`.

### AI-Suggested Content

AI explained the basic collaborative Git workflow:

```text
Pull latest changes
      ↓
Create/switch to working branch
      ↓
Make changes
      ↓
Check changes
      ↓
Commit
      ↓
Push
      ↓
Pull Request
      ↓
Review and Merge
```

It also suggested checking the repository before making changes:

```bash
git status
git switch main
git pull
```

For separate work, it recommended creating a branch:

```bash
git switch -c branch-name
```

After completing the work:

```bash
git status
git add <files>
git commit -m "Description of changes"
git push -u origin branch-name
```

The main recommendation was to avoid making uncontrolled changes directly on `main` and to verify the current branch and modified files before committing.

### Validation

Before using unfamiliar commands on the CareerConnect repository, I tested the workflow using a temporary repository.

I verified that branches kept changes separate, that `git pull` correctly updated my local repository, and that pushing a branch did not automatically modify `main`.

After confirming the workflow, I used it on the CareerConnect repository.

### Decision

**Accepted after validation.**

The workflow was used after I tested the commands and understood what they were doing.

### Reflection

AI helped me understand how Git protects collaborative work and how local changes, commits, pushes, branches, and Pull Requests are connected.

The most useful habit I learned was to check `git status` and my current branch before making or pushing changes.

**Responsible Person:** Massi Sadek




## AI Interaction 2 – Team Process README Formatting

**Date:** September 22, 2026  
**Task ID/Title:** Organizing and Improving the Team Process README  
**Purpose of AI Use:** Documentation formatting, organization, and minor improvement suggestions.

### Prompt / Interaction

I was responsible for writing the Team Process documentation for Sprint 1. Most of the content and decisions had already been determined during our team discussion, and I had taken notes about the workflow we agreed to follow.

I provided these notes and ideas to AI and asked for help organizing them into a README that would be professional, clear, and easy for the team to follow.

I also asked AI to clearly identify any small process details or improvements that might have been forgotten in my notes. These suggestions were meant to be presented separately so that I could review them myself and decide whether they were relevant to our team before including them.

Example prompt:

> "I am responsible for writing our Team Process README. Most of the process has already been decided by the team and I took notes during our discussion. Using the information I provide, help me organize it into a clear and professional README. Keep our decisions the same, but improve the structure and formatting using sections, lists, checklists, and simple workflow examples where useful. If you notice an important detail or improvement that we may have forgotten, clearly point it out separately so I can decide whether it is relevant before adding it."

I then provided the main points from our discussion, including our Sprint 1 team organization, GitHub branches, Pull Request process, review process, communication, Definition of Ready, and Definition of Done.

### AI-Suggested Content

AI mainly suggested reorganizing the information into clear sections instead of writing everything in paragraphs.

For example, it suggested separating the README into sections such as:

```text
Sprint 1 Team Workflow
GitHub Workflow
Branching Strategy
GitHub Issues and Tasks
Commit and Pull Request Process
Review Process
Definition of Ready
Definition of Done
Team Communication
Future Sprints
```

AI also suggested small formatting and process improvements such as:

- Using checklists for the Definition of Ready and Definition of Done.
- Showing the branch workflow visually.
- Using short bullet points for responsibilities.
- Including examples of meaningful commit messages.
- Separating the current Sprint 1 process from possible changes in future sprints.
- Making responsibilities and review expectations more explicit where my original notes were unclear.

Most of the actual content came from the notes and decisions I provided. Any additional ideas suggested by AI were treated only as recommendations and were reviewed individually before being considered for the final README.

### Validation

I compared the formatted README with my original notes from the team discussion and the official Sprint 1 requirements.

For any additional idea suggested by AI, I considered whether it was useful, realistic, and consistent with how our team actually planned to work. Relevant suggestions were kept or adapted, while unnecessary or inappropriate suggestions were not included.

I also manually reviewed the final README to make sure that AI had not changed our actual team decisions.

### Decision

**Modified before use.**

I kept the useful formatting and organization suggestions and selected only the additional ideas that were relevant to our team. I modified the generated content where necessary so that the final README accurately represented our actual decisions and workflow.

### Reflection

AI was useful for turning my rough notes into documentation that was clearer and easier to follow. It was also helpful for identifying a few details that I could consider before finalizing the document.

I learned that AI can be useful not only for formatting documentation, but also as a second review to identify potentially missing details. However, these suggestions still need to be evaluated before being included because the team remains responsible for the final process and decisions.

**Responsible Person:** Massi Sadek