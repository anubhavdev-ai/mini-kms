# Mini KMS Backend — how the sausage is made

This document translates the marketing bullet points into nuts-and-bolts engineering detail. If you’re extending the service, this is the map.

---

## 1. What we set out to build

- A lightweight control plane for AES-256-GCM and RSA-2048 keys.
- Envelope wrapping that can flip between local AES and AWS KMS without code changes.
- APIs for lifecycle (create → rotate → revoke), crypto usage, grants, audit, health, and ops metrics.
- A tamper-evident audit chain that can be verified on demand.
- Scheduled hygiene (automatic rotations) plus granular RBAC so teams can manage their own keys safely.

---

## 2. Architecture snapshot

Client (React console / curl / automation)
        │
        ▼
[Express HTTP Layer]
  ├─ middleware: helmet, cors, morgan, JSON body limit, request-id injector
  ├─ routers:
  │    • /v1/keys     (key lifecycle)
  │    • /v1/crypto   (encrypt/decrypt/sign/verify)
  │    • /v1/grants   (RBAC management)
  │    • /v1/audit    (log tail + verify)
  │    • /v1/ops      (operational metrics)
  │    • /v1/healthz  (ping)
  └─ error handler → JSON payloads

[Service Layer]
  ├─ KeyService        (metadata + versions)
  ├─ CryptoService     (runtime crypto, unwrap → operate → wrap)
  ├─ EnvelopeService   (AWS KMS or local AES wrapper)
  ├─ GrantService      (authorization decisions)
  ├─ AuditService      (hash chain + compatibility)
  ├─ OpsService        (metrics/rotation insights)
  └─ Scheduler         (node-cron rotation job)

[Storage Layer]
  └─ StorageService (mysql2/promise) handling `keys`, `key_versions`, `grants`, `audit_logs`

Utilities like `asyncHandler`, `crypto.ts`, and `http.ts` keep the surface tidy.

---

## 3. Module deep dive

### 3.1 App bootstrap (`src/app.ts`)
- Loads config (derived from `.env`), wires up services, starts the rotation scheduler.
- Attaches middleware and mounts routers under `/v1/...`.
- Centralised error handler logs the stack and returns JSON `{ error }`.

### 3.2 Configuration (`src/config.ts`)
- Derives a deterministic 32-byte master key from `KMS_MASTER_KEY`.
- Reads AWS KMS toggles (`KMS_USE_AWS`, `KMS_AWS_KEY_ID`) and default grace period (`KMS_GRACE_DAYS`).
- Exposes MySQL connection parameters.

### 3.3 StorageService
- Owns table creation (idempotent `CREATE TABLE IF NOT EXISTS`).
- Presents domain-friendly helpers: `insertKey`, `listVersionsForKey`, `upsertGrant`, `insertAuditRecord`, metrics queries, etc.
- Serialises `metadata`, `wrappedMaterial`, `allowedOps`, `conditions`, `details` to JSON columns.
- Adds analytics utilities:
  - `countKeysByState`
  - `countKeyVersions`
  - `findRotationCandidates` (last rotation timestamp per key)
  - `countAuditActionsSince`
  - `getLastAuditVerification`

### 3.4 EnvelopeService
- If AWS is enabled, uses `@aws-sdk/client-kms` with encryption context (`keyId`, `version`, `type`).
- Local mode: AES-256-GCM with master key derived in config; includes IV + auth tag in the envelope.
- Public API: `wrapSecret` / `unwrapSecret`, returning an `EnvelopeCiphertext` that notes the algorithm and metadata.

### 3.5 KeyService
- **Create** – Validates name uniqueness, generates key material via `generateKeyMaterial`, wraps it, persists `KeyRecord` + `KeyVersionRecord`, and returns the aggregate.
- **Rotate** – Generates new material, disables the previous version (setting `notAfter` if missing), persists a new version, updates the key’s `currentVersion`.
- **State management** – `setVersionState` toggles versions to `DISABLED` or `REVOKED`, disabling the parent key if you revoke the active version.
- **Search helpers** – `getKey`, `listKeys`, `findVersion`, `listVersionsForKey`.

### 3.6 CryptoService
- Chooses the right algorithm based on the key type.
- For AES keys, uses AES-GCM with additional data: `{ keyId, version, ... }`.
- For RSA keys:
  - `encrypt` uses OAEP with SHA-256.
  - `sign` / `verify` uses PKCS#1 v1.5 with SHA-256.
- Enforces state (no encrypt with `REVOKED`, enforce grace windows when decrypting).

### 3.7 GrantService
- Reads all grants for a principal and checks if any match the requested key (`*` wildcard allowed) and operation.
- Short-circuits for `admin` (full access) and `auditor` (read-only).
- `upsertByPrincipal` handles both inserts and updates to keep clients simple.

### 3.8 AuditService
- Builds a SHA-256 hash over a canonicalised payload (stable JSON ordering, timestamps rounded to seconds) with the previous hash as prefix.
- Stores records via `StorageService`.
- `verifyChain` recomputes expected hashes, honours legacy formats for older rows, and collects IDs it had to treat as legacy.
- Links every API path to `AuditService.record`, logging both successes and failures with contextual details.

### 3.9 OpsService
- Pulls live metrics using `StorageService` helpers: key counts, rotation candidates (including days since last rotation), audit verification status, and usage tallies (encrypt/decrypt/rotate counts over the last 24h/30d).
- Powers the dashboard and `/v1/ops/metrics`.

### 3.10 Scheduler
- Cron expression `0 * * * *` (top of every hour).
- Fetches keys due for rotation (using `rotationPeriodDays`), rotates them, and records audit entries tagged with the scheduler actor.
- Failures surface in the audit trail with `status: FAILURE`.

---

## 4. Data model cheat sheet

| Entity | Key fields | Purpose |
| --- | --- | --- |
| `keys` | `id`, `name`, `type`, `purpose`, `state`, `rotation_period_days`, `grace_period_days`, `current_version`, `metadata` | Logical key metadata + owner tags |
| `key_versions` | `id`, `key_id`, `version`, `state`, `wrapped_material`, `public_key_pem`, `not_before`, `not_after`, `grace_period_days` | Versioned wrapped material |
| `grants` | `id`, `principal`, `role`, `key_id`, `allowed_ops`, `conditions` | RBAC rules, wildcard allowed |
| `audit_logs` | `id`, `timestamp`, `actor`, `role`, `action`, `status`, `request_id`, `details`, `prev_hash`, `hash` | Tamper-evident log |

JSON columns keep metadata flexible for future expansions.

---

## 5. Typical request flow

1. **Client hits `/v1/keys`** → Router extracts actor headers (`x-principal`, `x-role`), checks grants (`GrantService.ensureAuthorized`), delegates to `KeyService.createKey`, logs via `AuditService.record`, and responds with the new key/versions.
2. **App encrypts data** → `/v1/crypto/encrypt` verifies permissions, loads current version, unwraps secret, encrypts payload, returns ciphertext + version metadata, and logs `ENCRYPT`.
3. **Scheduler rotates stale keys** → Cron job lists candidates, calls `KeyService.rotateKey`, emits `KEY_ROTATE` audit entries (success or failure).
4. **Auditor verifies logs** → `/v1/audit/verify` recomputes the hash chain end-to-end, logs `AUDIT_VERIFY` with `ok` flag, and the UI highlights the result.
5. **Operators query `/v1/ops/metrics`** → `OpsService` returns dashboards metrics (key states, rotation alerts, usage, last audit verification).

---

## 6. Security posture

- Envelope encryption ensures wrapped secret material is never stored in plaintext.
- AES-GCM includes `keyId`/`version` as Additional Authenticated Data to prevent ciphertext replay across keys.
- Grants enforce least privilege; only principals with `create` can mint new keys, and new keys auto-grant manage permissions to the creator.
- Audit chain verifies integrity locally; for production we recommend anchoring head hashes to immutable storage (S3 with versioning, blockchain, etc.).
- Environment variables supply secrets; `.env` remains untracked. Run behind TLS and layer real authentication (mTLS, OIDC) before going live.
- Scheduler runs under an admin persona so all automated actions have consistent audit semantics.

---

## 7. Extending the system

- Swap MySQL for PostgreSQL by reimplementing `StorageService` with the same interface.
- Add new key types by extending `KeyType`, `generateKeyMaterial`, and `CryptoService`.
- Build more ops signals (e.g., auto-revoke when grace window expires) or send metrics to Prometheus.
- Integrate approval workflows (dual control) by enhancing `GrantService` and the routers.
- Expose gRPC or GraphQL adapters using the same service layer.
- Anchor audit hashes externally (blockchain, notary service) for stronger compliance stories.

---

## 8. Deploying & operating

- `npm run build` compiles the TypeScript backend to ESM (`dist/`), and `npm start` runs `dist/server.js`.
- Provision the database ahead of time or let `StorageService` bootstrap tables on the first run.
- Monitor logs for `AUDIT_VERIFY` failures or scheduler errors; hook `/v1/ops/metrics` into dashboards.
- Back up the MySQL instance regularly (point-in-time recovery recommended).
- Rotate the KMS master key periodically and re-wrap key material as part of a maintenance window.

With this mental model in place you can comfortably add features, tighten security, or port the design to a different stack.***
