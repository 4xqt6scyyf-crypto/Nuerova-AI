# Uptime Monitoring Template

Use `uptime-checks.example.json` as a starter for UptimeRobot or Better Stack.

## Recommended checks

- `GET /api/health` every 60 seconds.
- `GET /api/health/sheets` every 5 minutes.

## Recommended alerts

- Trigger after 2 consecutive failures.
- Notify at least Email + Slack (and SMS for critical projects).

## Synthetic signup check

Most uptime tools run GET-only checks. For signup flow validation, schedule a synthetic script (GitHub Action cron or monitor platform script) that:

1. POSTs a test email to `/api/signup`.
2. Validates HTTP 200 and `{ "ok": true }`.
3. Optionally checks `/api/signups` for recent row visibility.
