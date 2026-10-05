# Dynamic Learning · CS-411 Digital Education

An initial 30-minute AI-assisted lesson on recursion and memoization, based on
the team's Digital Education project proposal. The control route retains its
original sample activity, ready for the other lesson team to develop.

## Architecture and task ownership

```text
GitHub Pages: React / Vite
  #/ai-lesson      -> POST /api/ai/chat -> Heroku: Flask -> Gemini
  #/control-lesson -> local fixed hints and worked answers

shared/ai-lesson.json            AI curriculum, baseline questions, tutor context
shared/lesson.json               original control/sample curriculum
frontend/src/lessons/ai/         activities, animations, Python runner, tutor, records
frontend/src/lessons/control/    control page, fixed support, and content entry point
frontend/src/shared/             lesson layout and session event hooks
frontend/src/lib/                API client and chat history handling
backend/app/routes/ai.py         request validation and AI endpoint
backend/app/services/tutor.py    Gemini adapter and tutor instructions
```

Each condition has a separate route bundle and curriculum. Work on a condition's
folder without editing the other. Shared layout changes deliberately affect both.
The control route imports no AI client or Python runtime and makes no backend
requests. Align its eventual learning objectives, tasks, and timing with the AI
lesson before comparing study outcomes.

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
or Gemini key. Unconfigured AI requests show a clear error rather than a fake answer.

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

## AI lesson pilot

The five parts follow the proposal and the team's clarified choices:

| Part | Target time | Activity | Tutor support |
| --- | --- | --- | --- |
| Pre-test | 3 min | Four drafted diagnostic questions; answers lock on submission | Instructions/interface only |
| Discover | 5 min | Animated nesting dolls, waiting calls, returns, own explanation | Conversation with check-in questions |
| Build & trace | 8 min | Suitability comparison, recursive Fibonacci, predict and trace fib(4) | Hints only |
| Optimize | 7 min | Identify repeated inputs, dictionary memoization, cache animation, explain complexity | Hints only |
| Transfer | 7 min | Independent Climbing Stairs code and design explanation | Instructions/interface only |

There is no countdown. Students may revisit submitted practice parts until they
start transfer, but cannot reopen the pre-test. During transfer, earlier practice
and its conversations are inaccessible. Their own Python code can run, including
their chosen print statements; generated correctness tests run only on final
submission. Both assessment results appear at the end. Explanations need organizer
review; the output, structure, and call-count checks provide initial feedback.

Python executes in a module Web Worker using
[Pyodide](https://pyodide.org/en/stable/usage/webworker.html), pinned to 314.0.7.
The first run downloads the runtime from jsDelivr, so it requires internet access.
Execution is stopped after eight seconds; output and test function-call counts
are bounded. No learner code executes on Flask. When a student asks for practice
help, their current attempt is sent to Gemini with the message. Assessment drafts
are excluded from automatic tutor context. Tutor restrictions are server-owned
prompt policies; pilot-check live replies, especially requests for full solutions.

The pilot is not a tamper-resistant assessment: browser state and tests can be
inspected, and there is no authenticated assignment or server-side assessment
state. Call counts are a useful check for repeated work, not a proof of complexity.

## Editing and study records

- Edit AI tasks/context in `shared/ai-lesson.json` and activity components under
  `frontend/src/lessons/ai/activities/`. Animations, Python execution, and study
  state have their own folders. Tune the tutor in `backend/app/services/tutor.py`.
  Restart Flask after content edits and deploy **both services** for this lesson
  update: the new activity IDs must be available to the backend.
- Build the control lesson in `frontend/src/lessons/control/` and
  `shared/lesson.json`. Its current corrections support self-checking only.
- Bump the AI content `version` when tasks change. AI progress, answers, code,
  conversations, and events persist across refreshes in `sessionStorage` in the
  current browser tab. A fresh tab starts a new session. The existing control
  sample retains its in-memory record behavior.
- **Download session record** exports schema version 2: random session ID,
  condition/content version, answers, code, submissions, run snapshots/results,
  navigation/animation interactions, tutor request counts/timing, and active time.
  Chat text persists locally for resume but is omitted from the export.

Active time accumulates while the tab is visible and the last pointer/keyboard
interaction was within 60 seconds. `activeMsByPart` keys 0–4 match the table above;
part 3 includes diagnosis, refactoring, and explanation. `activeMsByEditor` measures
focused, enabled Python editing separately. `metrics.unsuccessfulMemoizationRuns`
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
