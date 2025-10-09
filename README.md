# Mini KMS — key management, end to end

Mini KMS is a hands-on playground for everything that happens to a cryptographic key after it is born. You can mint keys, wrap them, hand them to applications, rotate them on schedule, revoke them when things go wrong, and prove nobody tampered with the audit trail along the way.

---

## Why people like it

- **All-the-things lifecycle** – Create, rotate, disable, revoke, and audit symmetric AES-256-GCM and RSA-2048 keys with per-version grace periods and scheduler-driven hygiene.
- **Real envelope protection** – Every key version is wrapped under a configurable master key (local AES or AWS KMS) before it ever touches disk.
- **Bring-your-own access control** – Fine-grained grants let admins hand out `create`, `encrypt`, `rotate`, etc. to individual principals; non-admin creators automatically receive manage permissions for the keys they spin up.
- **Tamper-evident trail** – Each API call emits a hash-chained audit record. `/v1/audit/verify` recomputes the chain, and when anchoring is enabled the head hash is pushed to a blockchain with the transaction details echoed back in the UI.
- **Built-in authentication** – Users register and sign in with email/password, receive JWTs, and automatically own the keys they create (the first account becomes the administrator).
- **Operational heartbeat** – `/v1/ops/metrics` packages key state counts, rotation alerts, crypto usage, and audit health so operators know what needs attention.
- **Friendly console** – The React front end includes a dashboard, lifecycle wizard, audit viewer, grants editor, and responsive navigation with session-aware messaging.

---

## Architecture at a glance

```
backend/   Express + TypeScript API
frontend/  React (Vite) console
db/        MySQL (users, keys, key_versions, grants, audit_logs)
```

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
| `AUTH_JWT_SECRET` | Secret used to sign access tokens | — |
| `AUTH_JWT_EXPIRES_IN` | Token lifetime (e.g. `1h`, `24h`) | `1h` |
| `ANCHOR_ENABLED` | Set to `true` to anchor audit hashes on-chain | `false` |
| `ANCHOR_RPC_URL` | Ethereum-compatible JSON-RPC endpoint | — |
| `ANCHOR_PRIVATE_KEY` | Hex-encoded private key for the anchoring wallet | — |
| `ANCHOR_TARGET_ADDRESS` | (Optional) Destination address for the zero-value anchor tx | wallet address |
| `ANCHOR_CHAIN_ID` | (Optional) Override chain ID for the provider | inferred |
| `ANCHOR_CONFIRMATIONS` | Confirmations to await before reporting success | `1` |
| `ANCHOR_NETWORK_NAME` | Friendly name to display in responses | provider name |

Example bootstrap SQL:

```sql
CREATE DATABASE IF NOT EXISTS mini_kms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'mini_kms'@'%' IDENTIFIED BY 'change-me';
GRANT ALL PRIVILEGES ON mini_kms.* TO 'mini_kms'@'%';
FLUSH PRIVILEGES;
```

> 💡 The very first account you register becomes the administrator. Everyone else starts as a standard user and only sees the keys they create unless an admin grants extra privileges.

### Run it
bash
# Terminal 1 – API
cd backend
npm run dev

# Terminal 2 – React console
cd frontend
npm run dev


Visit [http://localhost:5173](http://localhost:5173). Register or sign in from the console login screen (the very first account becomes the administrator) and start managing keys with the issued token.

---

## Everyday workflows

### Authentication

- `POST /v1/auth/register` — Create an account (returns a JWT + user profile). The first account becomes an admin; everyone else starts as a standard user.
- `POST /v1/auth/login` — Exchange email/password for a fresh JWT.

Send `Authorization: Bearer <token>` on every other request.

### Key management APIs

| Endpoint | Description |
| --- | --- |
| `POST /v1/keys` | Create a logical key. Creators are auto-granted manage operations and the key is tagged with their identity. |
| `GET /v1/keys` / `/:id` | List your keys or inspect a specific key (admins/auditors can see everything). |
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

```bash
# 0. (Optional) register an account
curl -X POST http://localhost:4000/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"demo123"}'

# 1. Log in and capture the JWT
TOKEN=$(curl -s -X POST http://localhost:4000/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"demo123"}' | jq -r '.token')

# 2. Create a key (record the id for later steps)
KEY_ID=$(curl -s -X POST http://localhost:4000/v1/keys \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"payments-aes","type":"AES256_GCM","purpose":"ENCRYPTION","rotationPeriodDays":30}' | jq -r '.id')

# 3. Encrypt data
curl -X POST http://localhost:4000/v1/crypto/encrypt \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"keyId":"'$KEY_ID'","plaintext":"demo payload"}'

# 4. Rotate, 5. Revoke, 6. Verify
curl -X POST http://localhost:4000/v1/keys/$KEY_ID/rotate -H "Authorization: Bearer $TOKEN"
curl -X POST http://localhost:4000/v1/keys/$KEY_ID/versions/1/revoke -H "Authorization: Bearer $TOKEN"
curl -X POST http://localhost:4000/v1/audit/verify -H "Authorization: Bearer $TOKEN"
```

If blockchain anchoring is enabled, successful verifications submit a transaction and return the hash, block number, and network label so you can log it elsewhere. The rotation scheduler runs hourly by default (`backend/src/services/scheduler.ts`); tweak the cron expression if you want a different cadence.

---

## What the console gives you

- **Session-aware shell** – Login screen, responsive navigation, and a mobile-friendly menu that shows who is signed in.
- **Dashboard** – Key counts, audit health, rotation alerts, and usage metrics for the last 24h/30d.
- **Keys** – Inventory table with owner column, create form, rotate/revoke controls, and per-version history scoped to the current user.
- **Lifecycle wizard** – Click through generate → encrypt → rotate → decrypt → revoke → verify, perfect for demos.
- **Audit viewer** – Live log stream, integrity verification, and blockchain anchoring receipts when enabled.
- **Grants editor (admin only)** – Manage principal access, including wildcard (`*`) policies and JSON-based conditions.

---

## Security posture (and how to harden it)

- Envelope encryption keeps key material encrypted at rest; plaintext only exists in process memory.
- All audit entries belong to a SHA-256 hash chain. Flip on blockchain anchoring (`ANCHOR_ENABLED=true`) to push the head hash on-chain automatically after each verification, or layer additional immutable stores if you need redundancy.
- RBAC runs through `GrantService`; grant the `create` op sparingly. Admins bypass checks, auditors can only read.
- Switch the master key to AWS KMS (or another HSM) in production, and rotate the KEK periodically.
- Run `/v1/audit/verify` and `/v1/ops/metrics` on a schedule. Alert on failures, missing heartbeats, or drift.
- Front the API with TLS and real authentication (mTLS, OIDC) when you go beyond the lab.
- JWTs back every request—keep `AUTH_JWT_SECRET` in a secrets manager and rotate tokens on a cadence.

---

## Roadmap ideas

- Support additional key types (Ed25519, X25519) and new crypto operations.
- Add dual control / approval workflows for destructive actions.
- Ship Terraform/Pulumi providers and language SDKs for Infrastructure-as-Code integration.
- Expand anchoring support (e.g., scheduled seals, multi-chain redundancy, or managed notary services).
- Expand the console with analytics, charts, notifications.
