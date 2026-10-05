# Frontend

React / Vite app on GitHub Pages. See the [project guide](../README.md) for setup
and deployment.

- `src/lessons/ai/`: AI page and Gemini chat.
- `src/lessons/control/`: control page, fixed hints, and self-check corrections.
- `src/shared/`: common workspace and session event export.
- `../shared/lesson.json`: common lesson content.

Direct routes: `#/ai-lesson` and `#/control-lesson`. Root is an organizer preview.
`npm run dev` proxies `/api` to Flask on port 5000; production uses the public
`VITE_API_BASE_URL` build variable. No Gemini key belongs in this app.

Run `npm ci`, then `npm run dev`. Checks: `npm run lint`, `npm test`, `npm run build`.
