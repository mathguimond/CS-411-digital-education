# Frontend

Both participant routes share `src/lessons/shared/RecursionLesson.jsx` and one
curriculum, `../shared/recursion-lesson.json`. `activities/` implements the
questions; `visualizations/` owns the fit-to-window trees and animations;
`python/` runs the browser worker; `study/` owns durable saves and retry recovery.
`src/auth/` handles demographics, login/resume, and assignment-based route guards.

`src/lessons/ai/` and `src/lessons/control/` are thin support adapters. Both use
the shared hint panel. AI follow-ups and fixed hints are requested through the
authenticated API, which owns the question limits and records every conversation.
Fixed hints live in `../shared/control-support.json`; login options, hint budgets,
and target duration live in `../shared/study-config.json`.

Every entry route leads to login until the backend assigns a lesson. Enrollment
requires an initially unchecked data-sharing consent box; its wording/version
comes from the shared study config and the backend records the acceptance.
A browser
token and local retry queue preserve progress across refreshes. The database is
authoritative for assignment, submitted progress, start/stop times, and hint use.
The pre-test starts the elapsed-time clock; transfer submission stops it before
reflection. Overtime permits continuing. There is no participant record-download UI.

Run `npm ci` and `npm run dev`, with Flask on port 5000. Production uses the public
`VITE_API_BASE_URL` build variable. Never place database credentials or a Gemini
key in a `VITE_` variable. Both study groups require the backend for storage.

Checks: `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e`.
Browser tests start their own Flask fixture on port 5001 and run actual Python,
using installed Edge on Windows or Playwright Chromium elsewhere. Install backend
dependencies before running them. Gemini is mocked; no paid requests are made.

To test the GitHub Pages base path in PowerShell:

```powershell
$env:VITE_BASE_PATH = '/CS-411-digital-education/'
npm.cmd run build
$env:PLAYWRIGHT_PREVIEW_BASE = '/CS-411-digital-education/'
npm.cmd run test:e2e
```

See the [project guide](../README.md) for database schema, deployment, and study rules.
