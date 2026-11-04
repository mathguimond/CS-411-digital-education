# Backend

Flask on Heroku connects to the attached Postgres database through `DATABASE_URL`.
SQLAlchemy uses psycopg and TLS; the connection pool permits two regular and one
overflow connection per worker. Local development uses a gitignored SQLite file.
The versioned migration runs locally or through `flask --app app.main db-upgrade`;
the Heroku Procfile runs that command in its release phase.

The API stores demographics, assignment, current work, every section submission,
events, code runs, tree edits, and full hint conversations. Participant tokens are
256-bit random values held by the browser; only their hashes are stored. There
are no usernames or passwords and no public results-list endpoint.

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Reads the database assignment table and reports AI configuration |
| `POST /api/study/enroll` | Validates demographics and atomically assigns a condition |
| `GET /api/study/session` | Restores own progress, server clock, hint use, and conversations |
| `PUT /api/study/session` | Saves a revisioned snapshot and idempotent event batch |
| `POST /api/study/checkpoint` | Saves a Continue submission, validates required responses, and advances |
| `POST /api/study/hints` | Returns a fixed or AI hint according to the stored assignment |
| `POST /api/ai/chat` | Authenticated AI-only alias for the hint endpoint |

All endpoints except enrollment and health require `Authorization: Bearer TOKEN`.
Enrollment includes a browser-generated `session_token` plus `gender`, `age`,
`school_level`, `degree`, and `referrer`. Reusing the same token retries enrollment
without adding another participant. The server ignores any claimed condition.

Save requests contain `id`, `revision`, `snapshot`, and up to 25 `events`.
Checkpoint requests contain `id`, `revision`, `activityId`, and `snapshot`.
Retries reuse the identifier; a stale revision returns 409 without overwriting work.
Completion/unlocking flags are owned by checkpoints, not ordinary draft saves.

Hint requests contain `id`, `activityId`, `questionId`, and optionally `message`.
The server verifies that the question belongs to the activity and that the activity
is unlocked. Text/MCQ questions have two replies, and code/tree questions have four.
Follow-ups share the same budget. Requests reserve a slot while Gemini is running;
failed provider calls do not spend it. Stored replies survive refresh or response
loss. Fixed hints use the same budgets and contain no worked solutions.

Gemini receives the selected question, current work/answers on the page, and prior
hint conversations. Server instructions require at most two sentences, and output
is shortened to enforce that limit. Learner text is treated as untrusted input.
Pre-test and final reflection have no hints; transfer supports hints and code tests.

`participants.pretest_completed_at` and `transfer_completed_at` own the wall clock.
Every submission stores elapsed milliseconds since the first timestamp. Passing
30 minutes never blocks submission; the elapsed clock stops at transfer completion.
Both client occurrence time and server receipt time are retained for events.

## Configuration and operation

Copy `.env.example` to `.env` locally. Keep Gemini and database credentials only
on the backend. Heroku supplies `DATABASE_URL` for the attached database. Retain
`GEMINI_API_KEY`, `GEMINI_MODEL`, and allowed GitHub Pages origin(s). Heroku startup
requires Postgres; it never silently falls back to an ephemeral SQLite database.

The source lesson and study settings live in root `shared/`, so deploy the whole
repository. The [project guide](../README.md) contains the deployment sequence.
No code in the API executes learner Python; the frontend worker performs tests.

Provider errors use safe categories such as `model_unavailable`, `quota_exceeded`,
`provider_timeout`, and `output_limit`. Logs contain the category/status, not keys,
learner messages, or raw provider bodies. Database failures return a retryable
503 without exposing connection details. `CHAT_RATE_LIMIT` applies per participant
to study hint requests; hard question budgets remain in Postgres across restarts.

Run `.venv/Scripts/python.exe -m unittest discover -s tests -v` on Windows, or
`python -m unittest discover -s tests -v` elsewhere. Tests use isolated SQLite
databases by default. CI sets `TEST_DATABASE_URL` to a dedicated Postgres test
database and checks migrations and concurrent requests in private temporary schemas.
Never point that variable at study data. Browser-only fixture routes under
`/__test__/` exist exclusively in `tests/browser_server.py`, outside the production app.
