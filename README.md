# Dynamic Learning · CS-411 Digital Education

A study of recursion and memoization with matched AI and control lessons.
GitHub Pages hosts React; Heroku hosts Flask and Postgres. Both groups use one
curriculum, activity implementation, Python runtime, and visual design.

## Participant flow

Participants enter through `#/login`, including when they open a lesson link
directly. They provide gender, age, school level, degree/program, and recruiter.
An unchecked, required consent box explains sharing lesson data with the Dynamic
Learning study team and third-party LLM providers for lesson support and analysis.
The API requires explicit consent to the current wording before enrollment and
stores its text, version, and server timestamp with the participant.
There is no username or password. A random browser token resumes their assigned
lesson after refresh; the database stores only its hash.

Assignment happens on the server in a locked database transaction. Overall
AI/control counts stay within one participant. If the overall counts are tied,
the recruiter group's counts determine the next assignment; a random choice
breaks a remaining tie. Registration retries reuse the original enrollment.
Changing the lesson URL cannot change the assignment.

The five-question pre-test asks about recursion awareness, Fibonacci tracing,
repeated calls, complexity, and Python experience. A “yes” to recursion awareness
requires a short explanation. Diagnostic questions include “I don't know.”

Submitting the pre-test starts the server-owned lesson clock. The interface shows
**elapsed time**, including after 30 minutes. Overtime gives a gentle reminder;
it never submits or blocks the lesson. Every Continue submission stores elapsed
milliseconds since the pre-test. Completing transfer stops the clock before the
final rating and reflection questions.

| Part | Shared activity |
| --- | --- |
| Discover | Nesting dolls, worked Fibonacci, one short response and two MCQs |
| Build & trace | Construct `climb_stairs(4)` first, explain suitability/recurrence, write and test Python, choose maximum stack depth |
| Optimize | Worked Fibonacci cache example, two redundancy MCQs, refactor own stairs code, one MCQ about the main change |
| Transfer | Three design MCQs, `unique_paths(2,2)` tree before code, visible tests, then memoize a copy of the naive code |
| Reflect | Hint helpfulness 0–10, experience with the assigned hint system, likes/dislikes and impact of each activity format, own definition of recursion |

Tree completeness never blocks progression. Coding activities require a code run,
without requiring correctness. Transfer activities can be revisited before final
submission; optimized code is retained when returning to earlier transfer work.
Trees fit a fixed viewport; students can still arrange their own nodes.

Each question's lightbulb requests a targeted hint. Text and MCQ questions allow
**three replies**; tree and code questions allow **five**. Follow-ups count toward
the same question budget. The database enforces limits across refreshes and
simultaneous requests. Both hint types use at most two sentences and have no
worked solutions. AI receives the selected question, its current answer, work on
the page, and prior hint conversations. Its instructions prioritize the current
attempt, adapt to earlier difficulties, and give direct guidance rather than
questions. Pre-test and final reflection have no hints; transfer does.

## Code ownership

```text
shared/recursion-lesson.json            shared questions, activities, context
shared/study-config.json               login options, duration, hint budgets
shared/control-support.json            short fixed hints by question ID
frontend/src/auth/                     login and assignment guard
frontend/src/lessons/shared/            one lesson, activities, visuals, Python
frontend/src/lessons/shared/study/      resumable saves and retry outbox
frontend/src/lessons/ai/                AI support presentation
frontend/src/lessons/control/           control support presentation
backend/app/database.py                SQLAlchemy models and connections
backend/app/services/study.py          enrollment, balanced assignment, saves
backend/app/services/hints.py          durable hint budgets and conversations
backend/app/services/tutor.py          Gemini adapter and two-sentence policy
backend/migrations/                    versioned Alembic schema
```

Question wording, options, activity order, and validation use the same JSON on
both services. Change the curriculum version when study tasks change. This
revision uses `study-v4`; earlier browser-only pilot records are not imported.

## Local development

Use Python 3.13 and Node.js 22.12+ or 24. From the repository root in PowerShell:

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r requirements.txt
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
Set-Location frontend
npm.cmd ci
```

Keep `GEMINI_API_KEY` and your configured `GEMINI_MODEL` in the backend only.
Local development defaults to a gitignored SQLite file in `backend/instance/`;
its versioned migration runs automatically. Set backend `DATABASE_URL` to use
Postgres locally instead, then run `flask --app app.main db-upgrade` before startup.

Start the API from `backend/`:

```powershell
.venv/Scripts/python.exe -m flask --app app.main run --host 127.0.0.1 --port 5000
```

Start `npm.cmd run dev` from `frontend/`, then open
`http://localhost:5173/#/login`. Leave `VITE_API_BASE_URL` empty locally so Vite
proxies to Flask. Control participants also need the API for registration, saves,
and hint budgets, although their hints never call Gemini. Use a fresh browser
profile or private window for another participant.

Python executes in a module Web Worker using Pyodide 314.0.7 from jsDelivr. Its
first download needs internet access. Execution is stopped after eight seconds;
output and function calls are bounded. Learner code never executes on Flask.

## Heroku and GitHub Pages deployment

Deploy the complete repository root. The root `requirements.txt`, `.python-version`,
and `Procfile` select Python and start Flask through Gunicorn in `backend/`.

1. Attach the Heroku Postgres database to this backend app and ensure its config
   includes `DATABASE_URL`. The backend selects the psycopg driver and requires
   TLS for Heroku-style URLs. Do not put database credentials in frontend variables.
2. Retain backend `GEMINI_API_KEY`, `GEMINI_MODEL`, and `ALLOWED_ORIGINS`.
   The GitHub Pages origin is `https://mathguimond.github.io`, without a repository
   path or trailing slash. Multiple allowed origins are comma-separated.
3. Deploy the backend. The Procfile release command runs `db-upgrade` before the
   new web process starts. It creates study tables without deleting collected data.
   Failed migrations fail the release. Subsequent releases reuse the schema version.
4. Check `https://YOUR-HEROKU-HOST/api/health` for `database_ready: true` and
   `ai_configured: true`. The database check reads the assignment table; the AI
   flag checks configuration rather than making a paid model request.
5. Set GitHub Actions repository variable `VITE_API_BASE_URL` to the backend HTTPS
   origin, without `/api`. In Settings → Pages select GitHub Actions, then run
   the existing deployment workflow. Redeploy both services for this revision.

Send everyone the same entry link:

```text
https://mathguimond.github.io/CS-411-digital-education/#/login
```

The old lesson links also enter through registration and server assignment.
See [Heroku Postgres connections](https://devcenter.heroku.com/articles/connecting-heroku-postgres)
and [release-phase migrations](https://devcenter.heroku.com/articles/release-phase).

## Stored results and timestamps

| Table | Contents |
| --- | --- |
| `participants` | Demographics, recruiter, consent wording/version/timestamp, assigned condition, curriculum version, hashed resume token, canonical start/stop/completion times, latest state |
| `activity_submissions` | Each Continue submission, full response/code/tree snapshot, accepted timestamp, elapsed milliseconds |
| `study_events` | Answer/code changes, tree edits, code runs/results, navigation, active-time and interaction events; client and server timing |
| `hint_turns` | Question/activity, request, reply, exact learner context, provider/support version, status, and elapsed time |
| `assignment_state` | Transactionally updated overall and recruiter allocation counts |
| `sync_batches` | Identifiers that make retrying a save idempotent |

`activity_submissions.elapsed_ms` is **time since pre-test completion**, never time
left. It is zero for the initial pre-test submission and stays at the transfer
completion time during reflection. Absolute timestamps preserve when reflection
was submitted. Event `elapsed_ms` uses the synchronized browser clock;
`server_elapsed_ms` records time at receipt, so offline delays remain distinguishable.
Times before the pre-test have null elapsed values.

Automatic saves use authenticated requests, revisions, and a local retry queue.
Continue waits for a durable checkpoint; refresh retries the same pending request.
Conflicting tabs preserve the unsaved draft and request a reload rather than
silently overwriting newer work. There is no public endpoint listing study results;
organizers access them through their authorized database connection.

The consent migration adds nullable `consented_at`, `consent_version`, and
`consent_text` columns. Earlier participant records remain intact; their consent
fields are not backfilled with consent that was never collected.

## Validation

```powershell
Set-Location frontend
npm.cmd run lint
npm.cmd test
$env:VITE_BASE_PATH = '/CS-411-digital-education/'
npm.cmd run build
$env:PLAYWRIGHT_PREVIEW_BASE = '/CS-411-digital-education/'
npm.cmd run test:e2e
Set-Location ../backend
.venv/Scripts/python.exe -m unittest discover -s tests -v
```

Browser tests start an isolated local API/database, use Edge on Windows or
Playwright Chromium elsewhere, execute real Pyodide, and mock Gemini. They test
both complete lesson flows and query the saved database records. On Linux/macOS,
install backend dependencies and run `npx playwright install chromium` first.
CI also runs backend tests against a temporary PostgreSQL 17 database, including
concurrent assignment and hint requests and the actual migration. An optional
`TEST_DATABASE_URL` must point to a database whose name ends in `_test`; tests
create and remove private schemas there.

The browser's code/tests remain inspectable, so automatic output, AST, tree, and
call-count checks are pilot measures. Call counts are not a mathematical complexity
proof; written understanding still needs organizer review.
