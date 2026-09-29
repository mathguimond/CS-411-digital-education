# CS-411 Digital Education

Initial project scaffold for a two-lesson website comparing AI-assisted and non-AI learning experiences.

## Project structure

- `frontend/` — React app (Vite) with two starter lesson routes:
  - `#/lesson-ai`
  - `#/lesson-standard`
- `backend/` — Python (Flask) starter backend with a health endpoint at `/api/health`

## Local development

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e .
flask --app app.main run
```

## GitHub setup

- `.github/workflows/ci.yml` runs basic frontend/backend validation on pushes and pull requests.
- `.github/workflows/frontend-pages.yml` builds and deploys `frontend/` to GitHub Pages when `main` is updated.
