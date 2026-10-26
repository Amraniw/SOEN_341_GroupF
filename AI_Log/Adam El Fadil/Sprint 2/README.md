# AI LOG - Sprint 2
NOTE: For the creation of the darkmode and other coding I did, I did not use AI, only the knowledge I aquired on my free time and during the SOEN287 (Web Programming) class.

## AI Tool used
1. Claude

## Date
1. October 25st, 2026

## Purpose
1. Needed the use of Claude to assist with the workflow

## Prompts Used
1. 
Me: Assist me with the creation of the workflow for my repository. 
Claude: 
1. Replace the editor contents

Click in the editor, press Ctrl+A, and paste this over everything:

yaml
name: Node.js CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [20.x, 22.x]

    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

It’s the same as the template, except it drops Node 18, drops the optional build step, and removes the comments. You can leave the filename as node.js.yml.

2. Click the green “Commit changes...” button (top right)

A dialog opens. I’d pick “Create a new branch for this commit and start a pull request”. Name it something like add-ci, then click “Propose changes”. The workflow then runs on that pull request, so you see whether it passes before it lands on main. If you’d rather skip the review, committing directly to main also works.

3. Watch it run

Open the pull request and scroll to the bottom. You’ll see “Node.js CI / build (20.x)” and “build (22.x)” with a spinner, and then a green check or red X. You can also open the Actions tab.

4. If it fails (red X)

Click “Details” next to the failed check to open the log. The usual causes:

npm test isn’t defined: Open package.json and check that "scripts" has a "test" entry. If it’s missing, tell me what test command you use.
A test depends on your computer: Examples are a local database file, an .env file, or a fixed path. Paste the error from the log and I’ll fix it.
Out-of-sync lock file: Run npm install locally and commit the updated package-lock.json.

Paste the error from the log if you get stuck.

5. Merge it

When both checks are green, click “Merge pull request”. After that, every pull request into main, including your darkmode one, gets checked automatically.


