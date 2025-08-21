# Service Ticket API (NestJS + Prisma + PostgreSQL)

A production-minded backend for the **Service Ticket Management System**. It implements the full ticket lifecycle, role-based rules (Associate/Manager), CSV export/import loop, **AI severity suggestion** (OpenAI with deterministic fallback), Swagger docs, and E2E tests.

---

## Stack

- **NestJS** (REST API, Swagger)
- **Prisma** (ORM) + **PostgreSQL** (prefer serverless: Neon / Supabase / AWS Aurora Serverless v2)
- **JWT Auth** (minimal claims; role-aware)
- **CSV** export/import + **nightly automation** endpoint
- **OpenAI** integration with **heuristic fallback** (always returns a valid severity)
- **Biome** (format/lint)
- Tests: **Jest + Supertest** (+ **nock** to mock OpenAI)

---

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

---

## Environment

Create `.env` (for local/dev):

```env
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

> **Prisma engine note (Cloud Run):** The container base is Debian 12 (bookworm, **OpenSSL 3**).  
> `schema.prisma` already sets:  
> `binaryTargets = ["native", "debian-openssl-3.0.x"]`.  
> The Dockerfile runs `yarn prisma generate` **inside Linux** and ships the generated client to runtime.

---

## Install & Run (dev)

```bash
yarn
yarn prisma generate
yarn prisma migrate dev -n init
yarn prisma db seed

yarn start:dev
# Swagger: http://localhost:8080/docs
```

---

## Demo Credentials

- **Associate** — `associate@example.com` / `Password123!`
- **Manager** — `manager@example.com` / `Password123!`

### CORS

CORS is enabled in `main.ts` to allow configured origins, preflight, and headers (e.g., `X-Cron-Secret`, `Content-Disposition` for CSV filename).  
Set `FRONT_END_URL` (or `CORS_ORIGIN`) as needed.

---

# Deployment (gcloud, no Terraform)

This section formalizes a **containerized, serverless, scale-to-zero** deployment on **Cloud Run**, using **Artifact Registry** + **Cloud Build** and **Secret Manager**.

> ✅ Requirements satisfied:
>
> - **Dockerfile** (containerized)
> - **Serverless hosting** on **Cloud Run**
> - **Scale to zero** (default on Cloud Run)

## 0) Prerequisites

- Google Cloud project (use your **Project ID**)
- **gcloud** CLI installed and authenticated:
  ```bash
  gcloud auth login
  gcloud config set project <PROJECT_ID>
  ```
- Region used below: `us-central1` (change if needed).

## 1) Enable APIs & create Docker repository

```bash
gcloud services enable artifactregistry.googleapis.com cloudbuild.googleapis.com run.googleapis.com secretmanager.googleapis.com cloudscheduler.googleapis.com

gcloud artifacts repositories create apps \
  --repository-format=docker \
  --location=us-central1 \
  --description="Docker repo for apps"
```

## 2) Create secrets (Secret Manager)

> **Database (Neon)**: include `?sslmode=require` in the URL.

**Windows PowerShell** (avoids newline issues):

```powershell
# Set your real values here
$env:DATABASE_URL   = "postgres://user:pass@host/db?sslmode=require"
$env:JWT_SECRET     = "replace-me"
$env:CRON_SECRET    = "replace-me-cron"
$env:OPENAI_API_KEY = "sk-proj00"

$tmp = New-TemporaryFile
Set-Content -Path $tmp -Value $env:DATABASE_URL -NoNewline -Encoding UTF8
gcloud secrets create DATABASE_URL --replication-policy=automatic
gcloud secrets versions add DATABASE_URL --data-file=$tmp
Remove-Item $tmp

$tmp = New-TemporaryFile
Set-Content -Path $tmp -Value $env:JWT_SECRET -NoNewline -Encoding UTF8
gcloud secrets create JWT_SECRET --replication-policy=automatic
gcloud secrets versions add JWT_SECRET --data-file=$tmp
Remove-Item $tmp

$tmp = New-TemporaryFile
Set-Content -Path $tmp -Value $env:CRON_SECRET -NoNewline -Encoding UTF8
gcloud secrets create CRON_SECRET --replication-policy=automatic
gcloud secrets versions add CRON_SECRET --data-file=$tmp
Remove-Item $tmp

$tmp = New-TemporaryFile
Set-Content -Path $tmp -Value $env:OPENAI_API_KEY -NoNewline -Encoding UTF8
gcloud secrets create OPENAI_API_KEY --replication-policy=automatic
gcloud secrets versions add OPENAI_API_KEY --data-file=$tmp
Remove-Item $tmp
```

> To update a secret later (without recreating):  
> `gcloud secrets versions add <NAME> --data-file=<FILE>` (Cloud Run uses `latest` on next revision).

## 3) Build & push the image (Cloud Build)

From the **backend root** (where the `Dockerfile` lives):

```bash
gcloud builds submit --tag us-central1-docker.pkg.dev/<PROJECT_ID>/apps/service-ticket-api:prod .
```

## 4) First deploy to Cloud Run

Create the service setting **secrets** and **env vars** in one go:

```bash
gcloud run deploy service-ticket-api \
  --image us-central1-docker.pkg.dev/<PROJECT_ID>/apps/service-ticket-api:prod \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,CRON_SECRET=CRON_SECRET:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest \
  --update-env-vars "NODE_ENV=production,OPENAI_MODEL=gpt-4o-mini,CORS_ORIGIN=http://localhost:5173"
```

Output will include:  
`Service URL: https://service-ticket-api-XXXXXXXXXX.us-central1.run.app`

- **Swagger**: `https://.../docs`
- **Scale to zero**: with no traffic, Cloud Run reduces instances to 0 (see **Metrics**).

## 5) Database migrations (one-off)

Run locally (pointing to the same `DATABASE_URL` as the Secret), or use an ephemeral container/Cloud Run Job:

```bash
# local
export DATABASE_URL="postgres://user:pass@host/db?sslmode=require"
yarn prisma migrate deploy --schema src/database/schema/schema.prisma
yarn prisma db seed
```

## 6) Nightly automation (Scheduler, optional)

Create a **Cloud Scheduler** job to call `/automation/nightly` daily (no auth, protected by `x-cron-secret`):

```bash
SERVICE_URL="$(gcloud run services describe service-ticket-api --region us-central1 --format='value(status.url)')"

gcloud scheduler jobs create http service-ticket-api-nightly \
  --location us-central1 \
  --schedule "0 3 * * *" \
  --time-zone "Etc/UTC" \
  --uri "${SERVICE_URL}/automation/nightly" \
  --http-method POST \
  --headers "x-cron-secret=$(gcloud secrets versions access latest --secret=CRON_SECRET)" \
  --headers "Content-Type=application/json" \
  --message-body "{}"
```

Run it manually to verify:

```bash
gcloud scheduler jobs run service-ticket-api-nightly --location us-central1
```

**One-liner to deploy new code:**

```bash
gcloud builds submit --tag us-central1-docker.pkg.dev/<PROJECT_ID>/apps/service-ticket-api:prod . \
&& gcloud run deploy service-ticket-api --image us-central1-docker.pkg.dev/<PROJECT_ID>/apps/service-ticket-api:prod --region us-central1 --allow-unauthenticated
```

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

---

## Tests

```bash
# E2E (Jest + Supertest), with OpenAI mocked via nock
yarn test:e2e
```

Covers:

- Draft → Review → Edit back to Draft → Approve → Pending
- “Manager cannot review own ticket”
- Soft delete rules
- CSV export/import cycle (exact counts asserted)
- Automation run-now / nightly (secret)
- AI module (heuristic + OpenAI mocked responses)
