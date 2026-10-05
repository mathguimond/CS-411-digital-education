# Backend

Flask API on Heroku, using the Google Gen AI Python SDK. See the
[project guide](../README.md) for local setup and root-level deployment.

Copy `.env.example` to `.env`; set `GEMINI_API_KEY`, `GEMINI_MODEL`, and
`ALLOWED_ORIGINS`. Run `python -m flask --app app.main run` from this directory.
Production uses the root `Procfile`; the root `shared/` content folder is required.

## API

- `GET /api/health`: returns `status` and `ai_configured`, without calling Gemini.
- `POST /api/ai/chat`: takes JSON below and returns `{ "reply": "..." }`.

```json
{
  "condition": "ai",
  "step_id": "setup-check",
  "message": "Can I have a hint?",
  "history": [
    { "role": "user", "content": "What is recursion?" },
    { "role": "assistant", "content": "A function solving smaller versions of its problem." }
  ]
}
```

Messages have at most 4,000 characters. History has at most 12 messages / 16,000
characters, alternating user and assistant in complete turns. Requests have a
32 KB limit. Gemini uses server-owned lesson context and a 20-second timeout with
automatic retries disabled.

Errors have an `error` field: 400 invalid input, 403 disallowed browser origin,
413 oversized request, 429 rate limit, 502 provider failure, 503 missing config.
The application logs no learner text or provider exception details.

The endpoint is public and rate-limited, with no participant authentication. CORS
does not prevent direct non-browser calls. In-memory limits are per-process;
configure `RATELIMIT_STORAGE_URI` with Redis for limits shared across workers/dynos.

Run `python -m unittest discover -s tests -v`. Tests use mocks; no real key is needed.
