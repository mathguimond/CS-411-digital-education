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
Provider failures also include a safe `error_code`, such as `model_unavailable`,
`authentication_failed`, `quota_exceeded`, or `provider_timeout`. Heroku logs show
the category and provider HTTP status; raw provider bodies, keys, and learner text
are not logged or returned.

## Diagnosing a deployed chat failure

`ai_configured: true` checks that the key and model variables are present, not that
Gemini accepts them. Open Heroku **More → View logs**, or run:

```text
heroku logs --tail --app YOUR-APP-NAME
```

Send one chat message, then find `Tutor request failed reason=...`.

| Reason | What to check |
| --- | --- |
| `authentication_failed` | Replace invalid/expired Gemini credentials in `GEMINI_API_KEY`. |
| `permission_denied` | API key restrictions and project/model access in Google AI Studio. |
| `model_unavailable` | Exact `GEMINI_MODEL` identifier and availability for your project. |
| `quota_exceeded` | Gemini rate limits, quota, and billing for the key's project. |
| `billing_required` | Billing/credits in the Gemini project's account. |
| `invalid_provider_request` | SDK/model parameter compatibility and project prerequisites. |
| `provider_timeout` | Gemini latency; the current HTTP timeout is 20 seconds. |
| `output_limit` | The model's generation/thinking budget exhausted the token limit. |
| `response_blocked` | Gemini blocked generation; rephrase the question. |
| `provider_unavailable` | Transient network/provider availability; retry later. |

The browser's Network tab shows `error_code` in the failed request's JSON response.
Redeploy the backend after changing this code; the existing frontend already shows
the readable `error` field. See [Google's troubleshooting guide](https://ai.google.dev/gemini-api/docs/troubleshooting).

The endpoint is public and rate-limited, with no participant authentication. CORS
does not prevent direct non-browser calls. In-memory limits are per-process;
configure `RATELIMIT_STORAGE_URI` with Redis for limits shared across workers/dynos.

Run `python -m unittest discover -s tests -v`. Tests use mocks; no real key is needed.
