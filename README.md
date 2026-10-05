# CS-411 Digital Education

A foundation for comparing AI-assisted and independent learning about recursion,
ending with memoization as an introduction to dynamic programming. The full lessons
are the next step; one sample question is included to test the learning tools.

## Architecture and task ownership

```text
GitHub Pages: React / Vite
  #/ai-lesson      -> POST /api/ai/chat -> Heroku: Flask -> Gemini
  #/control-lesson -> local fixed hints and worked answers

shared/lesson.json               common questions, outline, hints, and solutions
frontend/src/lessons/ai/         AI page, tutor UI, and content entry point
frontend/src/lessons/control/    control page, fixed support, and content entry point
frontend/src/shared/             lesson layout and session event hooks
frontend/src/lib/                API client and chat history handling
backend/app/routes/ai.py         request validation and AI endpoint
backend/app/services/tutor.py    Gemini adapter and tutor instructions
```

Each condition has a separate route bundle. Work on a condition's folder without
editing the other. Shared changes deliberately affect both. The two content entry
points initially import the same lesson so questions stay comparable. The control
route imports no AI client and makes no backend requests.

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

## Build the lessons next

1. Replace the sample in `shared/lesson.json` with the actual steps. Each step has
   a unique `id`, `title`, `description`, `question`, optional `code`, `hints` array,
   and `solution`. Navigation appears with multiple steps. Change the content
   `version` whenever the study content changes.
2. Build the AI experience in `frontend/src/lessons/ai/`; tune its tutor in
   `backend/app/services/tutor.py`. The backend loads the active step from shared
   JSON instead of accepting browser-supplied system instructions. Restart Flask
   after content edits, and deploy both services for shared-content changes.
   If AI-specific content overrides questions, update the server context too.
3. Build the fixed-hint experience in `frontend/src/lessons/control/`. Corrections
   support self-checking; saving answers does not grade or execute code.
4. Use `record(type, details)` for study events. JSON exports include condition,
   content version, random session ID, timestamps, saved answers, hint/solution
   use, navigation, and chat success/failure timing. Chat text is not added to the
   event export; it exists in the AI conversation and is sent to Gemini.

Answers and records currently live in the open tab and reset on refresh.
**Download session record** is for development/pilot checks, not automatic research
collection. Before the actual study, add consent, participant assignment, pre/post
assessments, and durable collection (for example Heroku Postgres). This scaffold
does not yet contain a database or centralized results collection.

## Validation

```powershell
Set-Location frontend
npm.cmd run lint
npm.cmd test
npm.cmd run build
Set-Location ../backend
.venv/Scripts/python.exe -m unittest discover -s tests -v
```

CI runs these checks on pull requests and pushes to `main`. Backend tests mock
Gemini, so no paid requests or credentials are required. They cover validation,
provider failures, CORS, and rate limiting. The integration uses the
[Google Gen AI SDK](https://googleapis.github.io/python-genai/).
