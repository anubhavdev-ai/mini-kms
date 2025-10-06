# Mini KMS — Secure Key Lifecycle Demo

A teaching-first mini Key Management System that demonstrates secure key lifecycle practices end-to-end:

> **generate → use → rotate → revoke → audit**

The stack includes a TypeScript/Express API with optional AWS KMS wrapping, MySQL-backed metadata storage, scheduled rotation, tamper-evident audit logging, and a React console that walks through the complete workflow.

---

## Features

- **Two key types**: AES-256-GCM (symmetric) and RSA-2048 (asymmetric for signing/envelope encryption).
- **Key lifecycle**: creation, enable/disable, versioned rotation, grace periods, manual revoke, scheduler-driven auto-rotation.
- **Envelope encryption**: key material wrapped under a master key (local AES-256-GCM) or optionally an AWS KMS CMK.
- **Fine-grained grants**: per principal/key allow-lists for encrypt/decrypt/rotate/revoke/sign/verify/read.
- **Cryptographic APIs**: AEAD encrypt/decrypt, RSA sign/verify, RSA encrypt/decrypt.
- **Persistence**: MySQL metadata store with envelope-encrypted key material and hash-chained audit log.
- **Demo UI**: React admin console with dashboard, key list, grant editor, audit viewer, and a guided lifecycle wizard.

---

## Repository layout

```
backend/   # Express + TypeScript API
frontend/  # React (Vite) console
```

---

## Getting started

### Prerequisites

- Node.js 18+
- npm or pnpm/yarn
- MySQL 8.0+ (or compatible) instance accessible with schema creation privileges

Clone and install dependencies (network access required during installation):

```bash
cd backend
npm install
cd ../frontend
npm install
```

### Environment variables (backend)

Create a `.env` file inside `backend/` or export the variables before running:

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | HTTP port for API | `4000` |
| `KMS_MASTER_KEY` | 32+ byte secret used to derive the local AES-256-GCM master key | randomly generated volatile key (demo only) |
| `KMS_GRACE_DAYS` | Default grace period after rotation before auto-revoke | `7` |
| `KMS_USE_AWS` | Set to `true` to wrap secrets with AWS KMS | `false` |
| `KMS_AWS_KEY_ID` | AWS KMS key ARN/ID (required when `KMS_USE_AWS=true`) | — |
| `DB_HOST` | MySQL host | `127.0.0.1` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_USER` | MySQL user with access to `DB_NAME` | `mini_kms` |
| `DB_PASSWORD` | Password for `DB_USER` | — |
| `DB_NAME` | Database/schema to use | `mini_kms` |
| `DB_POOL_MAX` | Connection pool size | `10` |

When AWS wrapping is enabled the service uses the default AWS SDK credentials chain. In demo mode the master key is derived from `KMS_MASTER_KEY` and stored only in memory.

Before starting the backend, provision the MySQL schema (example):

```sql
CREATE DATABASE IF NOT EXISTS mini_kms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'mini_kms'@'%' IDENTIFIED BY 'change-me';
GRANT ALL PRIVILEGES ON mini_kms.* TO 'mini_kms'@'%';
FLUSH PRIVILEGES;
```

### Running locally

```bash
# Start backend API
cd backend
npm run dev

# In a new terminal, start the React console
cd frontend
npm run dev
```

Visit `http://localhost:5173` for the UI (proxied to the API).

---

## API overview

Authenticated via simple headers (for demo):

- `x-principal`: caller identity (e.g. `demo-admin`, `demo-app`)
- `x-role`: `admin`, `app`, or `auditor` (defaults to `app` if omitted)
- `x-request-id`: optional correlation ID (auto-generated when absent)

### Key management

- `POST /v1/keys` — create logical key with initial version.
- `GET /v1/keys` — list keys (metadata only).
- `GET /v1/keys/:id` — detail including versions.
- `POST /v1/keys/:id/rotate` — create new version, disable previous.
- `POST /v1/keys/:id/versions/:version/disable` — stop encrypt/sign but keep decrypt during grace.
- `POST /v1/keys/:id/versions/:version/revoke` — fail-close, decrypt/sign blocked immediately.

### Cryptographic operations

- `POST /v1/crypto/encrypt` — AES-GCM or RSA OAEP; returns ciphertext bundle.
- `POST /v1/crypto/decrypt` — decrypt with specific or active version.
- `POST /v1/crypto/sign` / `POST /v1/crypto/verify` — RSA SHA-256 signatures.

### Governance

- `POST /v1/grants` / `GET /v1/grants` — manage principal grants.
- `GET /v1/audit` — hash-chained audit trail.
- `POST /v1/audit/verify` — recompute chain integrity.
- `GET /v1/healthz` — basic health ping (also logged).

All operations are recorded with `requestId`, actor, status, and appended hash chain.

---

## Demo workflow (curl)

```bash
# 1) Create AES key
curl -X POST http://localhost:4000/v1/keys \
  -H 'Content-Type: application/json' \
  -H 'x-principal: demo-admin' \
  -H 'x-role: admin' \
  -d '{"name":"payments-aes","type":"AES256_GCM","purpose":"ENCRYPTION","rotationPeriodDays":30}'

# 2) Encrypt sample payload (replace KEY_ID)
curl -X POST http://localhost:4000/v1/crypto/encrypt \
  -H 'Content-Type: application/json' \
  -H 'x-principal: payments-app' \
  -H 'x-role: app' \
  -d '{"keyId":"KEY_ID","plaintext":"demo payload"}'

# 3) Rotate key
curl -X POST http://localhost:4000/v1/keys/KEY_ID/rotate \
  -H 'Content-Type: application/json' \
  -H 'x-principal: demo-admin' \
  -H 'x-role: admin'

# 4) Decrypt using version=1 (grab ciphertext bundle from step 2)
# 5) Revoke version 1
curl -X POST http://localhost:4000/v1/keys/KEY_ID/versions/1/revoke \
  -H 'x-principal: demo-admin' -H 'x-role: admin'

# 6) Verify log chain
curl -X POST http://localhost:4000/v1/audit/verify \
  -H 'x-principal: audit-bot' -H 'x-role: auditor'
```

Scheduler-backed rotation runs hourly; adjust cron in `backend/src/services/scheduler.ts` for different intervals.

---

## Frontend console highlights

- **Dashboard**: key counts, last audit events.
- **Keys**: create/manage keys and versions, rotate/revoke controls with live state.
- **Lifecycle Wizard**: single-click walkthrough of generate → encrypt → rotate → decrypt → revoke → verify.
- **Grants**: manage principal access (comma-separated ops + optional JSON conditions).
- **Audit**: integrity check and tail of the hash-chained log.

By default the UI issues requests as `demo-admin`. Modify `frontend/src/api/client.ts` to simulate other principals.

---

## Security considerations & future work

- Harden backup/restore workflows for the MySQL metadata store (e.g., nightly dumps, PITR) and add automated schema migrations.
- Integrate with AWS KMS or Vault for long-lived key wrapping, plus KEK rotation support.
- Implement dual control / approval workflows for revocation or deletion.
- Extend audit anchoring (e.g., periodic hash export to S3/SIEM) and alerting.
- Harden authentication (JWT, mTLS) and enforce TLS fronting proxy.
- Add automated tests (unit + integration) and CI pipeline.

---

## License

