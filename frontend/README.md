# Frontend

React / Vite app on GitHub Pages. See the [project guide](../README.md) for setup
and deployment.

- `src/lessons/shared/`: the single five-part lesson used by both conditions.
  `RecursionLesson.jsx` owns the layout and progression. `activities/` contains
  the tasks and sequential activity plan; `visualizations/` contains animations
  and the draggable tree builder; `python/` owns browser code execution;
  `study/` owns progress, assessment locks, timing, and export.
- `src/lessons/ai/`: AI route, Gemini hint panel, and current-attempt context.
- `src/lessons/control/`: control route and fixed hint/solution panel.
- `../shared/recursion-lesson.json`: common curriculum and server tutor context.
  Update its version when changing tasks for both groups. Existing version and
  API part IDs are retained to preserve AI progress.
- `../shared/control-support.json`: two tiered hints and fallback worked answers
  for each supported activity. Edit this file when revising control support;
  update its separate version, which is included in control records.
- `public/python/lesson_runner.py`: identical Python checks for both groups.

Direct routes: `#/ai-lesson` and `#/control-lesson`. Root is an organizer preview.
Both routes supply a different support component to the same `RecursionLesson`.
The control bundle imports no AI client and sends no backend/Gemini requests.
`npm run dev` proxies `/api` to Flask on port 5000; production uses the public
`VITE_API_BASE_URL` build variable. No Gemini key belongs in this app.

Run `npm ci`, then `npm run dev`. Checks: `npm run lint`, `npm test`, `npm run build`,
and `npm run test:e2e`. Browser tests use installed Edge on Windows. Elsewhere run
`npx playwright install chromium` first. They mock Gemini but download and execute
the real Pyodide runtime, so internet access is required.

Each group's progress persists separately across refreshes in the current tab.
JSON download includes the condition, answers, code, constructed trees, run
results, and process metrics. Control records include hint tiers, fallback usage,
and support version; chat text is excluded. Results are not uploaded automatically.

AI activities start with **Ask for a hint**. Follow-up input appears after a hint
arrives, and earlier chats remain in a scrollable history across activities.
Control activities reveal two static hints in order, then offer a complete worked
answer for self-checking. Reference code and annotated tree examples live in that
support panel. Revealed cards persist when an activity is revisited or refreshed.

Both support panels are absent during the pre-test and transfer assessment.
The API also rejects help for assessment part IDs. The grid approach must be
submitted before the editor appears. Students can run their own transfer code;
correctness feedback appears only after final submission. Both groups unlock
activities by completing responses and submitting an attempt, without requiring
correctness. Written reasoning and agreement between code and trees need organizer review.

Redeploy the backend with this refactor because the curriculum file moved to
`shared/recursion-lesson.json`. Prompt policies and API part IDs are unchanged.
The runtime worker and Python harness honor the configured GitHub Pages base path.

CI also runs browser checks against a production preview under the repository
path. To check that locally in PowerShell:

```powershell
$env:VITE_BASE_PATH = '/CS-411-digital-education/'
npm.cmd run build
$env:PLAYWRIGHT_PREVIEW_BASE = '/CS-411-digital-education/'
npm.cmd run test:e2e
Remove-Item Env:VITE_BASE_PATH, Env:PLAYWRIGHT_PREVIEW_BASE
```
