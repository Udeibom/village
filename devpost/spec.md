# Spec — Village

## Overview
Village turns a lesson request + classroom constraints into a constraint-checked lesson. The checker enforces materials, timings, assessment-objective alignment, and curriculum traceability with plain JavaScript (no AI in the checker).

## Stack
- Frontend: React 19 + Vite
- Backend: Node.js + Express 5 (local dev server on 3001)
- Shared: validation/checking logic in `shared/`
- AI: Groq API via `server/grok.js` (key held server-side)
- Data: localStorage for classroom state (no backend DB)

## Where it runs
- Dev: `npm run dev` starts `server/` and `vite` (proxy `/api` to server)
- Build: `vite build` → static site; server runs separately or via platform API routes
- Deployed: supports Vercel (see `vercel.json`, `api/`)

## Components
- `src/App.jsx` — main UI flow
- `src/components/*` — lesson form, lesson view/editor, feasibility panel, bank/export/print
- `server/index.js` — API routes (`/api/generate`, `/api/health`)
- `server/grok.js` — lesson generation with constraint-aware prompting + retries
- `server/check.js` / `shared/validate.js` — deterministic checker
- `shared/curriculum.js` — curriculum text search/quote
- `src/lib/*` — state, bank (proven lessons), storage

## Key behaviors
- Generate lesson constrained by grade/subject/objective, duration, class size, materials, curriculum text
- Deterministic feasibility check on every lesson/edit
- "Proven lessons" bank with reuse rules
- Offline-capable for viewing/editing/checking after load
- No account/login required

## File structure (core)
```
src/        # React app
server/     # API + generation + check orchestration
shared/     # validation/checking/curriculum (browser+node)
api/        # serverless entry points (Vercel)
public/     # static assets
```
