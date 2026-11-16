# AI LOG - Sprint 2
NOTE: I used AI to understand how to make the system but didnt copy and paste all of it, i used my general knowledge as well

## AI Tool used
1. Claude

## Date
1. November 10th, 2026
2. November 15th, 2026

## Purpose
1. Needed the use of Claude to assist with the notification system
2. Needed the use of Claude to assit with the statuses and offers

## Prompts Used

Me: 
https://github.com/Amraniw/SOEN_341_GroupF

here is a repo 

i want you to assit me with to this user story: 
Notifications and Reminders: Users receive in-app notifications for application updates, interview invitations, upcoming deadlines, and recruiter actions such as new applications


Claude: 
Still working: the backend is done and all 151 tests pass. I’m now smoke-testing the bell’s frontend code in a simulated browser before packaging everything for you.

I built the notifications feature against a fresh clone of your main. Three of the four notification types work. Deadline reminders are not built yet, because the project has no deadline data to remind about. I haven’t opened the bell in a real browser. I did run the full test suite (151 pass, including 13 new tests for this feature) and a simulated-browser check of the bell.

What it does
Story requirement	How it works
Recruiter action: new application	When a job seeker applies, the recruiter who owns the posting gets “Sam Seeker applied for Backend Developer.”
Application updates	When an application’s status changes, the applicant gets “Your application for X at Y was updated to Under Review.”
Interview invitations	A change to the interview status gives the applicant an “Interview invitation” instead.
Upcoming deadlines	Not built yet (see the question at the end).
Header bell: A bell with an unread count now shows in the signed-in header on every workspace page (job seeker and recruiter). It checks for new notifications every 30 seconds.
Dropdown: The dropdown lists notifications, and clicking one marks it read and opens its page. There is also a “Mark all as read” button.
API: The new routes are GET /api/notifications (with ?limit= and ?unread=true), GET /api/notifications/unread-count, PATCH /api/notifications/:id/read, and POST /api/notifications/read-all.
Triggers: Database triggers create the notifications, like your existing status-history trigger. That means any route you add later that inserts an application or changes its status will notify automatically.
Dark mode: The bell uses your colour variables, so it works in dark mode too.
What I found in the repo

Nothing in the backend can change an application’s status right now. There is no recruiter page for reviewing applications. So the “application updates” and “interview invitations” notifications work, but nothing in the app triggers them yet. The tests trigger them by updating the database directly. When a teammate builds the recruiter review feature, those notifications will start appearing with no extra work.

How to apply it
powershell
cd C:\Users\adame\Desktop\amogus\SOEN_341_GroupF
git checkout main
git pull origin main
git checkout -b feature/notifications
git apply --ignore-whitespace notifications.patch
npm test
npm start

Download notifications.patch first and put it in the project folder. If git apply fails (usually because of Windows line endings), unzip notifications-files.zip over the project instead. It contains the 12 changed files in the right folders, but it overwrites those files, so only use it if you have no local edits in them.

To try it:

Sign up as a recruiter and create a posting.
Sign up as a job seeker in another browser or a private window, and apply to that posting.
The recruiter’s bell shows a 1 within 30 seconds, or right after a page refresh.
To see an update, change a status by hand in the database with the sqlite3 command line (or any SQLite viewer) opened on data\careerconnect.sqlite: UPDATE applications SET status='interview' WHERE id=1;

Then commit, push, and open a pull request. CI will run the same tests. If your course needs it, add an AI_Log entry for this work.

Question for you

What does “upcoming deadlines” mean for your team? Jobs have no deadline field, and there is no interview-scheduling feature yet, so there is nothing to remind people about. The two options are:

Application deadlines on job postings. Recruiters pick a closing date when they create a posting, and recruiters (and possibly job seekers who haven’t applied) get a reminder a few days before it closes. This means changes to the recruiter form.
Interview dates. Recruiters schedule interviews and applicants get reminders. This is a bigger feature.

I would do option 1 next. The notifications table already has a deadline_reminder type and a dedupe_key column, so reminders can be added without changing the database structure.

[Notifications_PATCH]
[Notifications files_ZIP]

2. 
Me: as a job seeker you should be able to accept or decline offers and if you accept it changes your status to employed (so you wont get the welcome notification) check to the repo to see what has changed first 

Claude:
offered already exists as an application status, but there’s no way for a job seeker to respond to it. I’m reading how applications and status changes currently work on main.

I now understand the pieces, and main currently has 166 passing tests. I’m checking the middleware and the existing application test helpers so the new endpoint and tests follow the same patterns.

I have what I need. One more check: the database helper’s return value (so I can detect “no row changed”) and whether the page’s request helper supports PATCH.

Job seekers can now accept or decline offers, and accepting marks them as employed, so they stop getting the welcome notification. The changes are in offers.patch. All 178 tests pass on a fresh copy of main with the patch applied. I also clicked through it with the real page code against a real running copy of your app, and it behaved correctly.

What I found in the repo first. notif and job-alerts are already merged into main, and offered already exists as an application status. Nothing let a job seeker respond to it. Your job-maxxing branch isn’t pushed to GitHub, so I built this on main and couldn’t see your recruiter changes.

How it works:

Offers: an application with an offer now shows “You have an offer” with Accept offer and Decline offer buttons on the Applications page.
Confirmation: each button asks you to confirm first, since neither answer can be undone.
Accepting: this sets the applicant to employed in the same database operation, so the two can’t disagree. The welcome notification only goes to unemployed job seekers, so it stops after that.
Declining: this leaves employment unchanged.
One answer only: a second answer is rejected, even if two requests arrive at once.
Recruiter notification: the recruiter who owns the job gets an “Offer accepted” or “Offer declined” notification (that text is in applicationRoutes.js).

I stored the answer in two new columns instead of adding “accepted” and “declined” statuses, because SQLite can’t change the status constraint in place. Existing databases pick them up automatically. I also updated one existing test to expect the two new empty columns on old applications.

Applying it. Put offers.patch in your project folder and run git apply offers.patch, then npm test. Commit with git add src test so the patch files stay out. git apply makes no changes if it fails, so it’s safe to try. Your recruiter patch also edits src/database/database.js, so if the apply fails there, either paste the error here or add the changes by hand. The first is the line const { installOfferResponses } = require('./offerResponses'); right after the employment require near the top of the file. The second is await installOfferResponses(database); just before the line const jobColumns = new Set(. If the patch complains about anything else, send me the error.

[Offers_PATCH]



