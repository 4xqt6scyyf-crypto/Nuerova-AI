# Nuerova AI Spend Tracker

Simple landing page + backend API for tracking AI usage and beta signups.

## How to run

### Prerequisites

- Node.js 18+
- npm

### Install

From repo root:

```bash
npm install
npm --prefix server install
```

### Start in dev (one command)

```bash
npm run dev
```

This runs:

- Frontend dev server on `http://localhost:8080`
- Backend API on `http://localhost:3000`

### Start in production/preview

```bash
npm start
```

This runs the backend on `http://localhost:3000` and serves `index.html` at `/`.

## Verify it works

Health check:

```bash
curl -s http://localhost:3000/health
```

Expected response:

```json
{"ok":true,"sheetsConfigured":false}
```

Signup API check:

```bash
curl -s -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"founder@example.com"}'
```

Expected response:

```json
{"ok":true,"sheets":{"enabled":false,"synced":false,"mode":null}}
```

Read saved signups:

```bash
curl -s http://localhost:3000/signups
```

Returns the latest 10 signup rows from Google Sheets (`email` + `timestamp`) when Sheets is configured.
Signups are also persisted locally in `server/data/signups.json`.

## Enable Google Sheets editing (optional)

To have signups create/update rows in Google Sheets, set these environment variables before starting the backend:

- `GOOGLE_SHEETS_SPREADSHEET_ID` — target spreadsheet ID
- `GOOGLE_SHEETS_RANGE` — target append range (example: `Signups!A:B`)
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

You can place these in either:

- `server/.env`
- `.env` at repo root

The backend loads both automatically on startup.
An example template is provided at `server/.env.example`.

When configured, `POST /api/signup` appends `[email, timestamp]` to the configured range.

Required sheet access:

1. Create a Google Cloud service account with Sheets API enabled.
2. Share the Google Sheet with the service account email as **Editor**.

Connectivity check (recommended before live signups):

```bash
curl -s http://localhost:3000/health/sheets
```

Expected when fully configured and reachable:

```json
{"ok":true,"configured":true,"reachable":true}
```

If Sheets sync fails while configured, signup returns:

```json
{"ok":false,"error":"failed to sync signup to google sheets"}
```

## Frontend API base URL configuration

The frontend uses one configurable base URL from runtime config (`/app-config.js`):

- `VITE_API_URL` (preferred name)
- `NEXT_PUBLIC_API_URL` (fallback)

Default when not set: empty string (`""`), which means same-origin calls to `/api/*`.

In dev, same-origin is handled by the frontend proxy (`/api/*` -> `http://127.0.0.1:3000`).

## Codespaces notes

- Backend binds to `0.0.0.0`.
- Frontend dev server binds to `0.0.0.0`.
- Forward ports `8080` (frontend) and `3000` (backend) in Codespaces.
- Open the forwarded URL for port `8080` to use the landing page.

## Project structure

- `index.html` — landing page and signup UI
- `frontend-dev-server.js` — frontend static server + `/api` proxy for dev
- `server/index.js` — backend API and local signup persistence
- `server/data/signups.json` — local signup storage
- `server/smoke-test.sh` — API smoke test script

## SECURITY

- Never commit `.env` files.
- Never paste service account JSON or private keys into chat.
- Rotate Google service account keys in Google Cloud Console:
  1. Go to **IAM & Admin** -> **Service Accounts**.
  2. Select the service account used by this app.
  3. Open **Keys** -> **Add Key** -> **Create new key**.
  4. Update `server/.env` with the new key, then delete old keys.