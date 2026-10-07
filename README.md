# Dynamic Learning · CS-411 Digital Education

Matched 30-minute lessons on recursion and memoization, based on the team's
Digital Education project proposal. Both groups use the same curriculum,
activities, animations, code editor, and assessments; their hint systems differ.

## Architecture and task ownership

```text
GitHub Pages: React / Vite
  #/ai-lesson      -> POST /api/ai/chat -> Heroku: Flask -> Gemini
  #/control-lesson -> the same activities, local fixed hints and worked answers

shared/recursion-lesson.json     common curriculum, baseline questions, tutor context
shared/control-support.json     control-only tiered hints and worked examples
frontend/src/lessons/shared/     single lesson, activities, animations, Python, records
frontend/src/lessons/ai/         AI route, Gemini hint panel, current-attempt context
frontend/src/lessons/control/    control route and fixed hint panel
frontend/src/lib/                API client and chat history handling
backend/app/routes/ai.py         request validation and AI endpoint
backend/app/services/tutor.py    Gemini adapter and tutor instructions
```

Each route supplies its support component to the same `RecursionLesson`.
Curriculum and activity changes in the shared folder affect both conditions.
Hint-system changes stay in the condition's folder. The control route runs the
same browser Python checks but imports no AI client and makes no Gemini/backend
requests. Progress and exports use separate condition-specific sessions.

## Local development (Windows / PowerShell)

Use Node.js 22.12+ or 24 LTS and Python 3.13. From the repository root:

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r requirements.txt
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Set `GEMINI_API_KEY` in `backend/.env` with a key from
[Google AI Studio](https://aistudio.google.com/apikey). Set `GEMINI_MODEL` to a model
available to your project; the example uses `gemini-3.8-flash`. Keep the model fixed
throughout a study run. The backend loads `.env`; existing environment variables
take precedence. Never put a Gemini key in a `VITE_` variable: these variables are
public frontend build output.

Start the backend in one terminal:

```powershell
Set-Location backend
.venv/Scripts/python.exe -m flask --app app.main run --host 127.0.0.1 --port 5000
```

Start the frontend in another:

```powershell
Set-Location frontend
npm.cmd ci
npm.cmd run dev
```

Open `http://localhost:5173/#/ai-lesson` or
`http://localhost:5173/#/control-lesson`. The root page is an organizer preview.
Participant pages have no condition-switching navigation. Vite proxies `/api` to
Flask locally, so leave `VITE_API_BASE_URL` empty. Check the backend separately at
`http://127.0.0.1:5000/api/health`.

On macOS/Linux, activate `backend/.venv/bin/activate` and use `python` and `npm`
instead of the Windows executables. Gunicorn runs in production on Linux; use
Flask's development server on Windows. The control lesson works without a backend
or Gemini key; Python's first download still requires internet access.
Unconfigured AI requests show a clear error rather than a fake answer.

## Deploy the backend to Heroku

Deploy the **whole repository from its root**. Root-level `requirements.txt`,
`.python-version`, and `Procfile` make Heroku detect Python and start Gunicorn in
`backend/`. The root `shared/` folder must be included. See
[Heroku's Python deployment guide](https://devcenter.heroku.com/articles/getting-started-with-python).

Commit the changes, then use the Heroku CLI:

```text
heroku login
heroku create YOUR-UNIQUE-APP-NAME --buildpack heroku/python
heroku config:set GEMINI_MODEL=gemini-3.8-flash ALLOWED_ORIGINS=https://mathguimond.github.io --app YOUR-UNIQUE-APP-NAME
git push heroku HEAD:main
heroku ps:scale web=1 --app YOUR-UNIQUE-APP-NAME
```

Set `GEMINI_API_KEY` under **Settings → Config Vars** in Heroku's dashboard so it
does not appear in shell history. Replace `ALLOWED_ORIGINS` for another GitHub
account or custom domain. Origins have no repository path or trailing slash;
multiple origins are comma-separated. Heroku may assign a hostname with an
app-specific suffix; use the actual URL from its dashboard.

Check `https://YOUR-ACTUAL-HEROKU-HOST/api/health` for `status: "ok"` and
`ai_configured: true`. This checks configuration, not provider connectivity.

The default limit is 10 chat requests per minute per IP, adjustable with
`CHAT_RATE_LIMIT` (consider classrooms sharing an IP). `memory://` rate-limit
storage is for development: it is per process and resets on restart. For shared
limits, provision Redis and set `RATELIMIT_STORAGE_URI` to its connection URL.

The endpoint is public. CORS and the request's condition field are browser
integration rules, **not participant authentication**. Users can manually change
lesson links. Add issued participant tokens if you need enforced study assignment.

## Deploy the frontend to GitHub Pages

1. In **Settings → Pages**, select **GitHub Actions** as the source.
2. In **Settings → Secrets and variables → Actions → Variables**, add repository
   variable `VITE_API_BASE_URL` with the actual Heroku HTTPS origin, without `/api`
   (for example `https://YOUR-ACTUAL-HEROKU-HOST`). This is public, not a secret key.
3. Push to `main` or run **Deploy frontend to GitHub Pages** manually. The workflow
   validates the backend URL, uses Pages' base path, builds, and deploys. Changing
   frontend environment variables requires another build/deployment.

Once deployed, send participants their assigned link:

```text
https://mathguimond.github.io/CS-411-digital-education/#/ai-lesson
https://mathguimond.github.io/CS-411-digital-education/#/control-lesson
```

Hash routes support direct links and refreshes on static Pages without rewrites.
Original `#/lesson-ai` and `#/lesson-standard` links redirect to the new routes.
For a custom domain, configure Pages and change the backend allowed origin. See
[Vite's Pages deployment guide](https://vite.dev/guide/static-deploy.html).

## Matched lesson pilot

The five parts follow the proposal and the team's clarified choices:

| Part | Target time | Shared activity | AI support | Control support |
| --- | --- | --- | --- | --- |
| Pre-test | 5 min | Three Fibonacci questions and prior memoization experience; answers lock on submission | Disabled | Disabled |
| Discover | 5 min | Dolls as a call tree, worked Fibonacci, explain base cases, reduction, pending calls | Hint on request, then follow-up input | Two static hints, then a model explanation |
| Build & trace | 5 min | Recursion suitability for Climbing Stairs, own naive code, draggable call tree for n=5 | Hint on request, then follow-up input | Two static hints per activity, then reference code or annotated tree |
| Optimize | 5 min | Worked Fibonacci cache example, redundancy in own stairs tree, memoize own stairs code | Hint on request, then follow-up input | Two static hints per activity, then a worked explanation or memoized code |
| Transfer | 10 min | Independent Grid Unique Paths: explain, code and construct a tree, then memoize | Disabled | Disabled |

Section time estimates are internal design targets and are not displayed in the
lesson navigation. There is no countdown. Each activity unlocks after completing
its responses and submitting an attempt, without requiring correctness. Tree
attempts require filled inputs and returns for at least three nodes. Students may revisit submitted practice parts until they
start transfer, but cannot reopen the pre-test. During transfer, earlier practice
and its conversations are inaccessible. Their own Python code can run, including
their chosen print statements; generated correctness tests run only on final
submission. Grid approach responses must be submitted before the editor appears;
assessment stages then advance in a fixed order. Both assessment results appear
at the end. Explanations and agreement between code and trees need organizer
review; output, structure, call-count, and tree checks provide initial feedback.
Grid memoization should use O(rows × cols) time/cache and O(rows + cols) stack
space under unit-cost arithmetic and dictionary access.

Prior independent memoization experience and possible prior mastery are flagged
in exported records. These flags never block participation. The experience
question is not included in the scored three-question baseline.

Python executes in a module Web Worker using
[Pyodide](https://pyodide.org/en/stable/usage/webworker.html), pinned to 314.0.7.
The first run downloads the runtime from jsDelivr, so it requires internet access.
Execution is stopped after eight seconds; output and test function-call counts
are bounded. No learner code executes on Flask. When a student asks for practice
help, their current activity's responses, code, constructed tree, and latest run
are sent to Gemini with the message. Each assisted activity initially shows a
hint button; follow-up input appears after a hint arrives. New activities return
to the hint button. Previous messages remain visible in a scrollable history;
only recent complete turns from the current activity are sent as API history.
Server prompt policies remain unchanged; activity facts reflect this curriculum.
All support is
removed during the pre-test and transfer assessment, including its mobile button,
and the backend rejects chat requests for these steps without contacting Gemini.
Hints-only practice uses server-owned prompt policies; pilot-check live replies,
especially requests for full solutions.

Control hints are revealed in order. After both hints, the learner can reveal
the complete worked answer and compare it with their own attempt. This pilot
does not automatically grade written explanations to decide when help is needed.
Reference code and trees appear only in the control support panel. Revealed hints
and solutions persist when an activity is revisited or the page is refreshed.
Attempt-based progression remains identical in both groups.

The pilot is not a tamper-resistant assessment: browser state and tests can be
inspected, and there is no authenticated assignment or server-side assessment
state. Call counts are a useful check for repeated work, not a proof of complexity.

## Editing and study records

- Edit tasks/context for both groups in `shared/recursion-lesson.json` and activity components under
  `frontend/src/lessons/shared/activities/`. Animations, Python execution, and study
  state have their own shared folders. `ai_allowed: false` disables both support panels and API help
  for an assessment part. Tune the tutor in `backend/app/services/tutor.py`.
  Restart Flask after content edits and deploy **both services** for this lesson
  update: the backend needs the revised shared task context. Part IDs are unchanged.
- Revise control hints and solutions in `shared/control-support.json`; its separate
  support version is recorded in control exports. Its panel lives in
  `frontend/src/lessons/control/`. Gemini support lives in `frontend/src/lessons/ai/`.
- Bump the common curriculum `version` when tasks change. Progress, answers, code,
  conversations, and events persist across refreshes in `sessionStorage` in the
  current browser tab, with separate storage keys for AI and control. A fresh tab
  starts a new session. The existing curriculum version and API part IDs are retained
  to preserve AI progress. `shared/lesson.json` remains only for the legacy API setup check.
- **Download session record** exports schema version 3: random session ID,
  condition/content version, cohort flags, answers, code, constructed trees,
  per-activity submission snapshots, run results, navigation/animation interactions,
  hint and follow-up counts/timing, edit events, and active time.
  Chat text persists locally for resume but is omitted from the export.
  Control records also contain revealed hint tiers, fallback usage, and support version.

Active time accumulates while the tab is visible and the last pointer/keyboard
interaction was within 60 seconds. `activeMsByPart` keys 0–4 match the table above;
part 3 includes diagnosis, refactoring, and explanation. `activeMsByEditor` measures
focused, enabled Python editing separately. `activeMsByActivity` splits each part
into its sequential activities. `metrics.activityTimeline` reports first run,
first passing practice run, submissions, edits, and feedback-to-next-edit delays.
Text/code edit bursts within 700 ms count as one edit event. Syntax errors,
failed output checks, runtime exceptions, and hint turns have separate counters.
`metrics.fixedHintsOpened` and `metrics.fallbackSolutionsDisplayed` measure control
support usage; `metrics.hintRequests` counts requests for either kind of hint.
`metrics.unsuccessfulMemoizationRuns`
counts tests that fail correctness/structure/efficiency checks and execution
timeouts. Runtime download failures are logged separately and do not count as
unsuccessful learner programs. Saved responses and tests are pilot measures,
not a finalized scoring rubric or validated learning-gain metric.

Records are downloaded manually; there is no database or automatic research
collection yet. Consent, issued participant assignments, a finalized assessment
rubric, and durable results collection remain work for the actual study.

## Validation

```powershell
Set-Location frontend
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
Set-Location ../backend
.venv/Scripts/python.exe -m unittest discover -s tests -v
```

CI runs these checks on pull requests and pushes to `main`. Browser tests use
Microsoft Edge on Windows and Playwright Chromium elsewhere; install Chromium
with `npx playwright install chromium` if needed. They exercise actual Pyodide,
assessment locks, hidden transfer feedback, recovery from nonterminating code,
and export. Gemini is mocked, so no paid requests or credentials are required.
Backend tests cover validation, provider failures, CORS, rate limiting, tutor
policy/context selection, and Python grading. The Gemini integration uses the
[Google Gen AI SDK](https://googleapis.github.io/python-genai/).
