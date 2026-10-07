# Frontend

React / Vite app on GitHub Pages. See the [project guide](../README.md) for setup
and deployment.

- `src/lessons/ai/`: the five-part AI lesson and adaptive Gemini hints.
  `activities/` contains each learning activity; `visualizations/` contains the
  nesting-doll and Fibonacci animations plus a draggable call-tree builder;
  `activities/activityPlan.js` defines the sequential activity flow; `python/` owns browser code execution;
  `study/` owns progress, locks, timing, and export.
- `src/lessons/control/`: control page, fixed hints, and self-check corrections.
- `src/shared/`: common workspace and session event export.
- `../shared/ai-lesson.json`: AI part metadata, pre-test, and
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
new learner. JSON download includes answers, code, constructed trees, run results, and process
metrics; chat text is excluded. There is no automatic upload of study results.

Each assisted activity starts with an **Ask for a hint** button. It sends the
current responses, code, tree, and latest run to Gemini. Follow-up input appears
after a successful hint. A new activity resets to the hint button and keeps all
previous messages in a bounded, scrollable history. The server's prompt policies
have not been retuned in this update; task context now reflects the new curriculum.
AI support is absent during the pre-test
and transfer assessment, and the API rejects help for those activity IDs.
Transfer runs execute the student's code only; assessment checks
are withheld until final submission. Students explain the grid approach before
unlocking the editor, build a naive tree, then memoize their own code. Activity
progression requires completed responses and a submitted attempt, not correctness.
The organizer must review written reasoning and whether the tree matches the code.

Deploy the updated backend alongside the frontend: it must recognize the new
updated shared task context. The existing `ai-*` part IDs remain unchanged. The runtime worker
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
