# Service Ticket API (NestJS + Prisma + PostgreSQL)

A production-minded backend for the **Service Ticket Management System**. It implements the full ticket lifecycle, role-based rules (Associate/Manager), CSV export/import loop, **AI severity suggestion** (OpenAI with deterministic fallback), Swagger docs, and E2E tests.

## Stack

- **NestJS** (REST API, Swagger)
- **Prisma** (ORM) + **PostgreSQL** (prefer serverless: Neon / Supabase / AWS Aurora Serverless v2)
- **JWT Auth** (minimal claims; role-aware)
- **CSV** export/import + **nightly automation** endpoint
- **OpenAI** integration with **heuristic fallback** (always returns a valid severity)
- **Biome** (format/lint)
- Tests: **Jest + Supertest** (+ **nock** to mock OpenAI)

## Domain Rules

- Roles:
  - **Associate**: create tickets; may edit title/description while in **REVIEW** (resets to **DRAFT**).
  - **Manager**: review **DRAFT** tickets (cannot review their own). Actions:
    - **APPROVE** → **PENDING**
    - **CHANGE_SEVERITY** (must provide reason)
      - If severity **increases** → **REVIEW** (signals associate to revisit)
      - If severity **decreases** → **PENDING**
- Statuses: **DRAFT → (REVIEW) → PENDING → OPEN → CLOSED**
- Soft delete allowed **only** before **PENDING**.
- Human-readable number: **`TKT-YYYY-XXXXXX`** (sequential per year).
- CSV:
  - **Export**: all **PENDING** tickets.
  - **Auto-process** (simulated external system): stable distribution ≈ **33/33/34** across **PENDING/OPEN/CLOSED**.
  - **Import**: updates **only** `status` (idempotent/validated).
- AI: OpenAI when available; otherwise deterministic **heuristic** that still returns a valid enum.

## Environment

Create `.env`:

```
# Database (serverless recommended)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/service_ticket
DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/service_ticket_test

# CORS
FRONT_END_URL=http://localhost:5173

# Auth
JWT_SECRET=replace-me
JWT_EXPIRES_IN=1d

# AI (optional; heuristic used if absent)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1/chat/completions
OPENAI_TIMEOUT_MS=2500

# Automation
CRON_SECRET=replace-me-secret

# App
PORT=8080
NODE_ENV=development
```

## Install & Run (dev)

```bash
yarn
yarn prisma generate
yarn prisma migrate dev -n init
yarn prisma db seed

yarn start:dev
# Swagger: http://localhost:8080/docs
```

## Demo Credentials

- **Associate** — `associate@example.com` / `Password123!`
- **Manager** — `manager@example.com` / `Password123!`

### CORS

CORS is enabled in `main.ts` to allow this origin, preflight, and headers (e.g., `X-Cron-Secret`, `Content-Disposition` for CSV filename). You can also set `CORS_ORIGIN` in `.env`.

## REST Endpoints (overview)

- **Auth**
  - `POST /auth/login` → `{ access_token, user }`
- **Tickets**
  - `GET /tickets?status=...` (paginated)
  - `POST /tickets`
  - `PATCH /tickets/:id` → edit while **REVIEW** (Associate original author or Manager not creator) → **DRAFT**
  - `PATCH /tickets/:id/review` (Manager, not creator)
    - `{ "action": "APPROVE" }` → **PENDING**
    - `{ "action": "CHANGE_SEVERITY", "newSeverity", "severityChangeReason" }`
      - Increase → **REVIEW**
      - Decrease → **PENDING**
  - `DELETE /tickets/:id` (soft delete) — only `< PENDING`
- **CSV**
  - `GET /csv/export/pending` → CSV of **PENDING**
  - `POST /csv/auto-process` (multipart) → processed CSV (~33/33/34)
  - `POST /csv/import` (multipart) → `{ updatedCount, skippedCount, totalRows, errorsCount }`
- **Automation**
  - `POST /automation/run-now` (Manager) → export→process→import
  - `POST /automation/nightly` (header `x-cron-secret`) → export→process→import
- **AI**
  - `POST /ai/severity-suggestion` → `{ severity, source: "LLM"|"HEURISTIC", model?, reasons? }`

## Tests

```bash
# E2E (Jest + Supertest), with OpenAI mocked via nock
yarn test:e2e
```

E2E covers:

- Draft → Review → Edit back to Draft → Approve → Pending
- “Manager cannot review own ticket”
- Soft delete rules
- CSV export/import cycle (exact counts asserted)
- Automation run-now / nightly (secret)
- AI module (heuristic + OpenAI mocked responses)

## Serverless Principles & AWS Notes

- **12-factor** env config; **stateless** containers; idempotent CSV import; bounded-time AI calls (timeouts).
- **Containerized** Dockerfile; health endpoints via Nest defaults.
- **DB**: serverless Postgres (Neon / Supabase / Aurora Serverless v2).
- **AWS Fargate (ECS)**:
  - Push image to ECR; create ECS service behind ALB; enable auto-scaling.
  - Nightly job: **Scheduled Task** (CloudWatch Events) hitting `/automation/nightly` with `x-cron-secret`.
  - “Scale to zero” can be approximated with on-demand tasks / schedules; or use a platform that supports zero-scale natively.
