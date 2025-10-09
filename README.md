# Mini KMS — teachable key management, end to end

Mini KMS is a hands-on playground for everything that happens to a cryptographic key after it is born. You can mint keys, wrap them, hand them to applications, rotate them on schedule, revoke them when things go wrong, and prove nobody tampered with the audit trail along the way. The project couples a TypeScript/Express API with a React console so you can demo or learn the full lifecycle in minutes instead of reading a 40‑page spec.

---

## Why people like it

- **All-the-things lifecycle** – Create, rotate, disable, revoke, and audit symmetric AES-256-GCM and RSA-2048 keys with per-version grace periods and scheduler-driven hygiene.
- **Real envelope protection** – Every key version is wrapped under a configurable master key (local AES or AWS KMS) before it ever touches disk.
- **Bring-your-own access control** – Fine-grained grants let admins hand out `create`, `encrypt`, `rotate`, etc. to individual principals; non-admin creators automatically receive manage permissions for the keys they spin up.
- **Tamper-evident trail** – Each API call emits a hash-chained audit record. `/v1/audit/verify` recomputes the chain and the UI flags the most recent integrity result.
- **Operational heartbeat** – `/v1/ops/metrics` packages key state counts, rotation alerts, crypto usage, and audit health so operators know what needs attention.
- **Friendly console** – The React front end includes a dashboard, a lifecycle wizard, grant editor, audit viewer, and an actor switcher so you can role-play different personas without logging out.

---

## Architecture at a glance

backend/   Express + TypeScript API
frontend/  React (Vite) console
db/        MySQL (keys, key_versions, grants, audit_logs)

- Services: `KeyService`, `CryptoService`, `EnvelopeService`, `GrantService`, `AuditService`, `OpsService`, and a node-cron scheduler for rotations.
- Storage: `mysql2/promise` with JSON columns for metadata; schema bootstrapped on startup.
- Audit: SHA-256 hash chain with optional AWS KMS wrapping for the audit key, plus compatibility handling for older entries.
- Frontend: React 18, React Router v6, @tanstack/react-query, Axios, custom dark theme CSS.

---

## Getting started

### Prerequisites

- Node.js 18+
- npm (or pnpm/yarn)
- MySQL 8.0+ with a database you control

### Install & configure

bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install


Create `backend/.env` (or export the variables) with at least:

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | API port | `4000` |
| `KMS_MASTER_KEY` | 32+ byte secret for local AES wrapping | generated at boot |
| `KMS_GRACE_DAYS` | Default grace period after rotation | `7` |
| `KMS_USE_AWS` | Set `true` to wrap with AWS KMS | `false` |
| `KMS_AWS_KEY_ID` | AWS CMK ARN/ID | — |
| `DB_HOST` / `DB_PORT` | MySQL location | `127.0.0.1` / `3306` |
| `DB_USER` / `DB_PASSWORD` | Credentials | `mini_kms` / — |
| `DB_NAME` | Schema to use | `mini_kms` |

Example bootstrap SQL:

sql
CREATE DATABASE IF NOT EXISTS mini_kms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'mini_kms'@'%' IDENTIFIED BY 'change-me';
GRANT ALL PRIVILEGES ON mini_kms.* TO 'mini_kms'@'%';
FLUSH PRIVILEGES;

### Run it
bash
# Terminal 1 – API
cd backend
npm run dev

# Terminal 2 – React console
cd frontend
npm run dev


Visit [http://localhost:5173](http://localhost:5173). Requests default to the `demo-admin` principal, but you can switch personas from the actor toolbar.

---

## Everyday workflows

### Key management APIs

| Endpoint | Description |
| --- | --- |
| `POST /v1/keys` | Create a logical key (admins or principals with a `create` grant). Creators are auto-granted manage operations, and the key is tagged with an `owner`. |
| `GET /v1/keys` / `/:id` | List keys or inspect versions. |
| `POST /v1/keys/:id/rotate` | Mint a new version, disable the previous one, update `currentVersion`. |
| `POST /v1/keys/:id/versions/:version/disable` | Stop encrypt/sign while grace window elapses. |
| `POST /v1/keys/:id/versions/:version/revoke` | Fail-close immediately for compromised versions. |

### Crypto operations

- `POST /v1/crypto/encrypt` — AES-GCM or RSA OAEP with key/version metadata in the response.
- `POST /v1/crypto/decrypt` — Works with specific or current version (honours grace windows).
- `POST /v1/crypto/sign` / `verify` — RSA SHA-256 signatures.

### Governance & insight

- `POST /v1/grants` / `GET /v1/grants` — Assign or view principal permissions (`encrypt`, `rotate`, `create`, …).
- `GET /v1/audit` / `POST /v1/audit/verify` — Read the hash-chained audit log and recompute integrity.
- `GET /v1/ops/metrics` — Pull operational intel: key counts by state, rotation alerts, crypto usage (24h/30d), audit verification health.
- `GET /v1/healthz` — Simple ping recorded in the audit log for liveness checks.

### Curl walkthrough

bash
# 1. Create a key
curl -X POST http://localhost:4000/v1/keys \
  -H 'x-principal: demo-admin' -H 'x-role: admin' \
  -H 'Content-Type: application/json' \
  -d '{"name":"payments-aes","type":"AES256_GCM","purpose":"ENCRYPTION","rotationPeriodDays":30}'

# 2. Encrypt data
curl -X POST http://localhost:4000/v1/crypto/encrypt \
  -H 'x-principal: payments-app' -H 'x-role: app' \
  -H 'Content-Type: application/json' \
  -d '{"keyId":"KEY_ID","plaintext":"demo payload"}'

# 3. Rotate, 4. Revoke, 5. Verify audit
curl -X POST http://localhost:4000/v1/keys/KEY_ID/rotate -H 'x-principal: demo-admin' -H 'x-role: admin'
curl -X POST http://localhost:4000/v1/keys/KEY_ID/versions/1/revoke -H 'x-principal: demo-admin' -H 'x-role: admin'
curl -X POST http://localhost:4000/v1/audit/verify -H 'x-principal: audit-bot' -H 'x-role: auditor'

The rotation scheduler runs hourly by default (`backend/src/services/scheduler.ts`); tweak the cron expression if you want a different cadence.

---

## What the console gives you

- **Actor toolbar** – Toggle principal/role headers on the fly; values persist in `localStorage` so you can hop between admin/app/auditor views.
- **Dashboard** – Key counts, audit health, rotation alerts, and usage metrics for the last 24h/30d.
- **Keys** – Inventory table with owner column, create form, rotate/revoke controls, and per-version history.
- **Lifecycle wizard** – Click through generate → encrypt → rotate → decrypt → revoke → verify, perfect for demos.
- **Grants editor** – View and upsert principal access, including wildcard (`*`) keys and comma-separated operation lists.
- **Audit viewer** – Live log stream plus a “verify integrity” button that flashes results instantly.

---

## Security posture (and how to harden it)

- Envelope encryption keeps key material encrypted at rest; plaintext only exists in process memory.
- All audit entries belong to a SHA-256 hash chain. Pair it with an external anchor (S3 versioned blob, blockchain hash, etc.) for extra reassurance.
- RBAC runs through `GrantService`; grant the `create` op sparingly. Admins bypass checks, auditors can only read.
- Switch the master key to AWS KMS (or another HSM) in production, and rotate the KEK periodically.
- Run `/v1/audit/verify` and `/v1/ops/metrics` on a schedule. Alert on failures, missing heartbeats, or drift.
- Front the API with TLS and real authentication (mTLS, OIDC) when you go beyond the lab.

---

## Roadmap ideas

- Support additional key types (Ed25519, X25519) and new crypto operations.
- Add dual control / approval workflows for destructive actions.
- Ship Terraform/Pulumi providers and language SDKs for Infrastructure-as-Code integration.
- Stream audit anchors to immutable storage or a blockchain for independent verification.
- Expand the console with charts, notifications.

