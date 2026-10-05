# ReachInbox — Full-Stack Email Job Scheduler

TypeScript + Express + Next.js + Tailwind + PostgreSQL + Redis/BullMQ + Ethereal + Elasticsearch + Google OAuth + Slack notifications.

Schedule emails for the future, bulk-import recipients via CSV, watch scheduled/sent jobs on a live dashboard, and stay crash-safe: jobs persist in Postgres and are re-queued after any restart. Duplicate submissions are blocked via idempotency keys.

## Features

- **Schedule emails** — subject + HTML body + N recipients + future `scheduledAt` → delayed BullMQ job.
- **CSV upload** — `/upload`: preview (first 20 rows, valid/invalid counts) then schedule for all rows. Header row + dupes handled, 10k rows / 5 MB cap.
- **Dashboard** — `/dashboard`: stat cards, status filter tabs, ES-powered search, progress (`sent/total`), Ethereal preview links, cancel button, 10s auto-refresh.
- **Rate limiting** — `express-rate-limit` on `/api/*` + BullMQ worker `limiter` (token-bucket per duration) + Nodemailer pooled transport.
- **Concurrency** — `Worker({ concurrency: WORKER_CONCURRENCY })`, default 5.
- **Persistence after restart** — `recoverPendingJobs()` on boot re-enqueues `pending/processing` rows missing from Redis; Redis AOF enabled in compose.
- **No duplicates** — client `idempotencyKey` (uuid) = BullMQ `jobId` + Postgres `UNIQUE(idempotencyKey)` + `UNIQUE(jobId, toEmail)` on logs; retries skip already-`sent` recipients.
- **Ethereal Email** — auto-creates a test account on boot (dev) or uses `ETHEREAL_USER/PASS`; preview URL stored per recipient.
- **Elasticsearch** — sent/failed logs indexed; `/api/jobs?q=` searches ES, falls back to Postgres `ILIKE` when ES is down.
- **Google OAuth** — Passport `google-oauth20` login-only; JWT in httpOnly cookie. `POST /auth/demo-login` works before keys exist.
- **Slack** — Incoming Webhook posts job summary (sent/failed counts + preview) on completion; failures never break sending.

## Architecture

```
Next.js (3000) ──REST+cookies──▶ Express API (3001) ──Prisma──▶ PostgreSQL (jobs, logs, users)
                                        │──BullMQ delayed jobs──▶ Redis (AOF) ──▶ Worker ──Nodemailer──▶ Ethereal SMTP
                                        │──fire-and-forget──▶ Slack webhook + Elasticsearch index
```

Boot recovery: `SELECT * FROM EmailJob WHERE status IN (pending, processing)` → skip jobs already in Redis → `queue.add(delay = scheduledAt - now)`.

## Quickstart (Docker — recommended)

Requirements: Docker + Docker Compose.

```bash
cp .env.example backend/.env
cp frontend/.env.example frontend/.env   # or set NEXT_PUBLIC_API_URL=http://localhost:3001
# edit backend/.env: JWT_SECRET, GOOGLE_CLIENT_ID/SECRET, SLACK_WEBHOOK_URL (optional)
docker compose up --build
```

- Frontend: http://localhost:3000
- API health: http://localhost:3001/health
- Ethereal inbox: https://ethereal.email/login (credentials printed in backend logs on first boot)
- Elasticsearch: http://localhost:9200

## Local dev (without Docker)

Requirements: Node 20+, Postgres 16, Redis 7, (optional) Elasticsearch 8.

```bash
# backend
cd backend
cp .env.example .env   # edit DATABASE_URL, REDIS_URL, JWT_SECRET
npm install
npx prisma migrate dev
npm run dev            # http://localhost:3001

# frontend (second terminal)
cd frontend
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > .env.local
npm install
npm run dev            # http://localhost:3000
```

Seed demo user: `cd backend && npm run seed` (or just use demo login in the UI).

## API reference

| Method | Route | Auth | Body / query |
|---|---|---|---|
| GET | `/health` | — | liveness |
| GET | `/auth/google` → `/auth/google/callback` | OAuth | Google login → cookie + redirect to `/dashboard` |
| POST | `/auth/demo-login` | — | dev login, returns `{ token, user }` |
| GET | `/auth/me` | cookie | current user |
| POST | `/auth/logout` | — | clears cookie |
| POST | `/api/jobs` | login* | `{ subject, body, to[], scheduledAt, idempotencyKey? }` → 201 (or 200 + `deduplicated:true`) |
| GET | `/api/jobs?status=&q=&page=` | — | list; `q` via ES w/ PG fallback |
| GET | `/api/jobs/:id` | — | job + all logs |
| DELETE | `/api/jobs/:id/cancel` | login* | cancel pending job (removes from Redis, marks `cancelled`) |
| POST | `/api/upload/preview` | login* | `multipart file` → `{ total, invalid, preview[] }` |
| POST | `/api/upload/schedule` | login* | `multipart file + subject + body + scheduledAt` → creates job |
| GET | `/api/stats` | — | `{ totalJobs, byStatus, totalEmails, sentEmails }` |

\* Auth is enforced when users exist; with a fresh DB (no users) writes are allowed so the scheduler works before Google keys are configured.

Example:

```bash
curl -b cookie.txt -c cookie.txt -X POST http://localhost:3001/auth/demo-login
curl -b cookie.txt -X POST http://localhost:3001/api/jobs \
  -H 'Content-Type: application/json' \
  -d '{"subject":"Hello","body":"<p>Hi!</p>","to":["a@x.com"],"scheduledAt":"2026-10-06T10:00:00.000Z"}'
```

## Google OAuth setup (when ready)

The app works without Google keys via demo login (`POST /auth/demo-login` or the button on the login page). To enable real Google sign-in:

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create a project → **APIs & Services → Credentials → Create Credentials → OAuth client ID** (type: Web application).
2. Authorized redirect URI: `http://localhost:3001/auth/google/callback` (must match `GOOGLE_CALLBACK_URL`).
3. Put the client ID/secret in `backend/.env`:
   `GOOGLE_CLIENT_ID=…`, `GOOGLE_CLIENT_SECRET=…`
4. Restart the backend (`docker compose restart backend`). The login page's **Continue with Google** button now works; users are upserted into `users` and get a 7-day JWT cookie. Scope is login-only (profile + email) — sending stays on Ethereal.

## Slack setup (optional)

Create an **Incoming Webhook** (Slack App → Incoming Webhooks, or workflow webhook) and set `SLACK_WEBHOOK_URL` in `backend/.env`. The worker posts a summary (subject, sent/failed counts, Ethereal preview) on every finished job. Empty = notifications skipped silently.

## Configuration

Backend `.env`: `DATABASE_URL, REDIS_URL, JWT_SECRET, GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL, FRONTEND_URL, ETHEREAL_USER/PASS/FROM, SLACK_WEBHOOK_URL, ELASTICSEARCH_URL, WORKER_CONCURRENCY (5), EMAIL_RATE_MAX (10), EMAIL_RATE_DURATION_MS (60000), PORT (3001)`.

Tune throughput via `WORKER_CONCURRENCY` + `EMAIL_RATE_*` without code changes.

## Verification checklist

1. `docker compose up --build` → `/health` ok, login works.
2. Compose → send +2 min → dashboard shows `pending`, then `sent` + Ethereal link; Slack message arrives.
3. `docker restart reachinbox-backend` mid-delay → job still sends (recovery log line).
4. Submit same `idempotencyKey` twice → second response has `deduplicated:true`, single job.
5. Upload 1k-row CSV → invalid rows counted, partial failures show `partial` status.
6. Stop Elasticsearch → search still works (Postgres fallback).

## Tradeoffs & next steps

- Gmail sending (OAuth2 `gmail.send` scope) intentionally omitted per scope (login-only); `mailer.ts` is the seam to add it.
- ES index is log-centric (`email_logs`); job-level aggregations stay in Postgres.
- No per-user job isolation on reads yet — add `where: { createdById }` if multi-tenant privacy is needed.
- Next: retries dashboard, per-recipient timeline, `.csv` export, Playwright e2e.
