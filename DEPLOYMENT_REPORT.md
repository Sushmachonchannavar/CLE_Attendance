# Deployment Report — Staff Attendance & Location System

**Status:** Deployment preparation complete; public deployment blocked pending hosting-account access and production secrets. No public URL is claimed or implied by this report.

## Hosting platform

- **Frontend:** Cloudflare Pages (free static hosting, HTTPS included).
- **Backend:** Render Web Service with a persistent disk (low-cost; HTTPS included).
- The Render blueprint is [render.yaml](render.yaml). The frontend includes `_redirects` for React client-side routing.

## URLs

| Item | Current value |
| --- | --- |
| Frontend HTTPS URL | Not created — requires Cloudflare Pages project/account access. |
| Backend HTTPS URL | Not created — requires Render service/account access. |
| Health check URL | `https://<render-service>.onrender.com/health` after backend deployment. |

## Project inspection

| Area | Finding |
| --- | --- |
| Frontend | `frontend/`; React 19 + Vite 7; output directory `frontend/dist`. |
| Backend | `backend/`; Node.js/Express; starts with `npm start`. |
| Database | SQLite via `better-sqlite3`, default `backend/database.sqlite`; migrations execute at server startup. |
| Files | OD attachments are written below `backend/uploads/od-documents`. |
| API URL | Production frontend reads `VITE_API_URL`; it must be `https://<backend>/api` at build time. |
| Build configuration | `npm run build` in `frontend`; static SPA fallback is supplied by `frontend/public/_redirects`. |
| Existing deployment | None found. |

## Database decision

SQLite is suitable only when the backend has a **persistent, single-instance disk**. Render's normal filesystem is ephemeral, so the blueprint mounts `/var/data` and sets `DB_FILE=/var/data/database.sqlite`.

The disk also preserves OD documents. `UPLOAD_DIR=/var/data/uploads/od-documents` is configured in the Render blueprint. For horizontal scaling, zero-downtime deploys, or higher traffic, migrate both relational data and documents to PostgreSQL plus object storage. That migration was intentionally not performed because it would change the persistence layer and needs a data-migration plan.

**Data preservation:** `backend/database.sqlite` is currently tracked by Git. Do not expose it in a public repository. Export/backup it securely, upload/restore it to the Render persistent disk once, then remove it from repository tracking in a separate, reviewed security change.

## Environment variables

Set these in the Render dashboard only; never in Cloudflare Pages and never commit their values:

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | Yes | `production` |
| `PORT` | Platform supplied | Do not hard-code. |
| `FRONTEND_URL` | Yes | Exact Cloudflare Pages HTTPS origin, no trailing slash. |
| `JWT_SECRET` | Yes | New random secret, at least 32 characters. |
| `DB_FILE` | Yes | `/var/data/database.sqlite` |
| `UPLOAD_DIR` | Yes | `/var/data/uploads/od-documents` |
| `SMS_API_KEY`, `SMS_AUTH_KEY`, `SMS_SENDER`, `SMS_BASE_URL`, `SMS_CAMPAIGN`, `DLT_TE_ID` | As required by provider | Production SMS configuration; do not use the development fallback. |
| `CAMPUS_LAT`, `CAMPUS_LNG` | Yes | Production campus center coordinates. |

Set only non-secret frontend build variables in Cloudflare Pages:

```text
VITE_API_URL=https://<render-service>.onrender.com/api
VITE_CAMPUS_LAT=<campus latitude>
VITE_CAMPUS_LNG=<campus longitude>
```

`VITE_*` values are embedded in browser code. Never put JWT, SMS, database, or other secrets there.

## Deployment steps performed

1. Inspected frontend/backend, SQLite use, routes, Vite config, environment-variable usage, ignored files, and Git configuration.
2. Added `GET /health` returning `{ "status": "ok" }`.
3. Tightened production CORS: only `FRONTEND_URL` is accepted in production; local development origins remain available outside production.
4. Added Render persistent-disk blueprint and frontend SPA redirect configuration.
5. Kept all UI and business rules unchanged.

## Tests performed

| Check | Result |
| --- | --- |
| Backend integration suite (`npm run test:api`) | 28/28 passed. |
| Frontend production build (`frontend: npm run build`) | Passed. |
| Frontend lint (`frontend: npm run lint`) | Passed. |
| Public HTTPS and production end-to-end test | Blocked: no deployed service exists yet. |

## Remaining issues / required access

1. Connect or provide access to a Render account and Cloudflare account, plus permission to create services/projects.
2. Provide the intended public frontend project/domain name and backend service name.
3. Enter production SMS gateway credentials in Render's secret settings and confirm the provider permits messages to the test phones.
4. Securely transfer the existing SQLite database and any OD documents to the persistent disk; do not commit them to Git.
5. Remove `backend/database.sqlite` from Git tracking in a reviewed security change before making the repository public.

## Mobile testing instructions after deployment

1. On Cloudflare Pages, configure the variables above and deploy branch `main` with build command `npm ci && npm run build` and output directory `frontend/dist` (or configure root directory as `frontend`).
2. In Render, create the service from `render.yaml`, attach the persistent disk, set the listed secrets, deploy, and confirm `https://<backend>/health` returns HTTP 200.
3. Copy the exact Cloudflare Pages `https://...` URL into `FRONTEND_URL` in Render; redeploy the backend.
4. Rebuild/redeploy the frontend after setting `VITE_API_URL` to the exact Render HTTPS `/api` URL.
5. On Android or iPhone using mobile data, open the Cloudflare Pages HTTPS URL in Chrome/Safari. Sign in, accept **only** browser Location permission, and test punch-in, location updates, punch-out, leave/OD, and approvals with separate role accounts.
6. Verify developer/network logs show location requests only to `https://<backend>/api/employee/location`. The app does not request contacts, photos, files, SMS, camera, or microphone permissions. OD file selection is user-initiated only.
