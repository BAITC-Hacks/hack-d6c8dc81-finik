# Career Quest frontend

React/Vite presentation for the Career Quest API. See the root
[README](../README.md) for backend setup, dataset details, demo steps, and checks.

From this directory:

```sh
npm ci
VITE_API_BASE_URL=http://localhost:8000/api npm run dev -- --host localhost --port 5173 --strictPort
```

`VITE_API_BASE_URL` defaults to `http://localhost:8000/api`. The backend must run
separately. The English login screen provides demo entry; real sign-in is disabled.

```sh
npm test
npm run lint
npm run build
```

From the repository root, run `node frontend/scripts/browser-smoke.mjs` after
building the backend for the isolated Chrome integration check.
