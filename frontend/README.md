# Frontend

React / Vite app on GitHub Pages. See the [project guide](../README.md) for setup
and deployment.

- `src/lessons/ai/`: the five-part AI lesson and Gemini chat.
  `activities/` contains each learning activity; `visualizations/` contains the
  nesting-doll and call-tree animations; `python/` owns browser code execution;
  `study/` owns progress, locks, timing, and export.
- `src/lessons/control/`: control page, fixed hints, and self-check corrections.
- `src/shared/`: common workspace and session event export.
- `../shared/ai-lesson.json`: AI part metadata, pre-test, suitability tasks, and
  server tutor context. Update its version when changing study tasks.
- `../shared/lesson.json`: the original control sample; independent of AI edits.
- `public/python/lesson_runner.py`: Python checks loaded into the browser worker.

Direct routes: `#/ai-lesson` and `#/control-lesson`. Root is an organizer preview.
`npm run dev` proxies `/api` to Flask on port 5000; production uses the public
`VITE_API_BASE_URL` build variable. No Gemini key belongs in this app.

Run `npm ci`, then `npm run dev`. Checks: `npm run lint`, `npm test`, `npm run build`,
and `npm run test:e2e`. Browser tests use installed Edge on Windows. Elsewhere run
`npx playwright install chromium` first. They mock Gemini but download and execute
the real Pyodide runtime, so internet access is required.

AI progress persists across refreshes in the current tab. Use a fresh tab for a
new learner. JSON download includes answers, code, run results, and process
metrics; chat text is excluded. There is no automatic upload of study results.

The tutor stays available throughout. It offers only clarification during the
pre-test/transfer, conceptual conversation during the introduction, and hints
during practice. Transfer runs execute the student's code only; assessment checks
are withheld until final submission. The organizer must review written reasoning.

Deploy the updated backend alongside the frontend: it must recognize the new
`ai-*` activity IDs and apply the corresponding tutor policies. The runtime worker
and Python harness both honor Vite's configured GitHub Pages base path.

CI also runs the browser suite against a production preview under the repository
path. To check that locally in PowerShell:

```powershell
$env:VITE_BASE_PATH = '/CS-411-digital-education/'
npm.cmd run build
$env:PLAYWRIGHT_PREVIEW_BASE = '/CS-411-digital-education/'
npm.cmd run test:e2e
Remove-Item Env:VITE_BASE_PATH, Env:PLAYWRIGHT_PREVIEW_BASE
```
