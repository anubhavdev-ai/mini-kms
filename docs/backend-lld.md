# Mini KMS Backend Low-Level Design

## 1. Goals & Scope
- Manage lifecycle for symmetric AES-256-GCM and asymmetric RSA-2048 keys.
- Support AWS KMS-based envelope encryption (optional) or local AES master key fallback.
- Provide REST APIs for key management, cryptographic usage, grants, audit logging, and health checks.
- Offer auditability via tamper-evident hash chained logs.
- Enable scheduled and manual key rotations plus revocation workflows.
- Serve as crypto control-plane for downstream workloads, including the Voice-Based Financial Scam Detector (Problem Statement 2) for securely handling model secrets, feature encryption, and signing.

## 2. High-Level Architecture
```
[Express HTTP Layer]
   ├─ Middleware (helmet, cors, morgan, request-id)
   ├─ Routers
   │   ├─ /v1/keys     → Key lifecycle controller
   │   ├─ /v1/crypto   → Cryptographic operations
   │   ├─ /v1/grants   → RBAC grants management
   │   ├─ /v1/audit    → Audit log retrieval & integrity check
   │   └─ /v1/healthz  → Operational ping
   └─ Error Handling

[Services Layer]
   ├─ KeyService         → Persisted key metadata, rotations, state transitions
   ├─ CryptoService      → AEAD encryption/decryption, RSA encrypt/sign/verify
   ├─ EnvelopeService    → Wrap/unwrap materials via AWS KMS or local AES MK
   ├─ GrantService       → Grant lookup & enforcement
   ├─ AuditService       → Hash-chained logging & verification
   ├─ StorageService     → MySQL data access layer (keys, versions, grants, audit)
   └─ Scheduler (node-cron) → Hourly rotation job

[Utilities]
   ├─ crypto.ts          → Primitive wrappers around Node crypto
   ├─ http.ts            → Request-id injection & actor extraction
   └─ asyncHandler.ts    → Promise-aware route wrapper
```

## 3. Module Details

### 3.1 HTTP Composition (`src/app.ts`)
- Instantiates core services with `config.masterKey` and database-backed storage derived from `.env` settings.
- Applies security middleware (`helmet`, JSON body limit, `cors`) and structured logging via `morgan`.
- Mounts routers under `/v1` namespace.
- Registers global error handler returning JSON payload.

### 3.2 Configuration (`src/config.ts`)
- Derives 32-byte master key hash from `KMS_MASTER_KEY` (required for deterministic local operation).
- Flags AWS KMS usage via `KMS_USE_AWS` and `KMS_AWS_KEY_ID`.
- Controls default grace period (`KMS_GRACE_DAYS`).
- Exposes MySQL connection settings (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_POOL_MAX`).

### 3.3 Storage Layer (`StorageService`)
- Built on top of `mysql2/promise` connection pool configured via `.env`.
- Bootstraps schema (`keys`, `key_versions`, `grants`, `audit_logs`) during startup in `initDatabase`.
- Provides targeted CRUD helpers (insert/update/list/find) consumed by higher-level services.
- Serializes structured fields (`metadata`, `wrappedMaterial`, `allowedOps`, `conditions`, `details`) as JSON columns.

### 3.4 EnvelopeService (AWS KMS Integration)
- If `KMS_USE_AWS=true`, constructs a default `KMSClient` using environment credentials.
- `wrapSecret()` issues `EncryptCommand` with `EncryptionContext` containing `keyId`, `version`, and `type`.
- `unwrapSecret()` uses `DecryptCommand`, preserving context and optional `KeyId`.
- Local fallback uses `crypto.createCipheriv` AES-256-GCM with derived master key.
- Returned `EnvelopeCiphertext` tracks algorithm (`AWS-KMS` or `AES-256-GCM`) and metadata for auditing.

### 3.5 KeyService
- **Create**: Generates material (`generateKeyMaterial`), wraps via envelope, persists metadata & version record.
- **Rotate**: Issues new version, disables previous active version with computed grace `notAfter`, updates `currentVersion`.
- **State transitions**: `setVersionState` toggles to `DISABLED` or `REVOKED`, optionally disabling logical key when current version revoked.
- **Lookup**: Provides `getActiveVersion`, `findVersion`, and `listDueForRotation` (timestamp-based with `rotationPeriodDays`).
- **Validation**: Enforces unique names, ensures only enabled keys rotate.

### 3.6 CryptoService
- **Encrypt**: Uses active version; AES keys call `encryptWithAesGcm` with JSON AAD (keyId, version, plus caller-supplied fields). RSA keys leverage OAEP.
- **Decrypt**: Accepts explicit version or defaults to current; ensures state not `REVOKED` and grace window valid for `DISABLED`.
- **Sign / Verify**: RSA SHA-256 with PKCS#1 padding; ensures version has public key.
- Responses include version metadata to aid consumers.

### 3.7 GrantService
- Stores per-principal grants in MySQL via `StorageService` helpers.
- `ensureAuthorized` enforces RBAC: `admin` bypass, `auditor` read-only, `app` must match grant by keyId or wildcard.
- Integrates with routers for runtime authorization before service calls.

### 3.8 AuditService
- Appends `AuditRecord` with `prev_hash`/`hash` chain using SHA-256 of record payload + previous hash.
- Persists each record via `StorageService.insertAuditRecord`, reading the last hash to maintain continuity.
- `verifyChain` reloads the ordered log from MySQL and recomputes the chain end-to-end.
- All router interactions log both success and failure states with captured error messages.

### 3.9 Scheduler
- Cron expression `0 * * * *` checks for keys due for rotation.
- For each due key, invokes `rotateKey` and logs result as `scheduler` actor.
- Failures recorded with `status: FAILURE` for observability.

### 3.10 Error Handling & Logging
- Route handlers wrap service calls in `try/catch`, mapping domain errors to `400/403/404` as appropriate.
- Uncaught exceptions bubble to Express error middleware, returning `500` with sanitized message.
- `morgan` writes structured access logs.

## 4. Data Model

| Entity              | Fields (subset)                                                                                           | Notes |
|---------------------|------------------------------------------------------------------------------------------------------------|-------|
| `KeyRecord`         | `id`, `name`, `type`, `purpose`, `state`, `rotationPeriodDays`, `gracePeriodDays`, `currentVersion`        | Logical key metadata |
| `KeyVersionRecord`  | `id`, `keyId`, `version`, `state`, `wrappedMaterial`, `publicKeyPem`, `notAfter`, `gracePeriodDays`        | Envelope-wrapped material |
| `EnvelopeCiphertext`| `algorithm`, `ciphertext`, optional `iv`, `authTag`, `encryptionContext`, `metadata`                        | Allows AWS/local distinction |
| `GrantRecord`       | `principal`, `role`, `keyId` (`*` wildcard), `allowedOps`, `conditions`                                     | Conditions reserved for future policies |
| `AuditRecord`       | `actor`, `role`, `action`, `status`, `requestId`, `prevHash`, `hash`, `details`                             | Tamper-evident chain |

All metadata persists in MySQL tables; production deployments can swap the driver for other relational databases or deploy managed MySQL with backups.

## 5. Request Flows

### 5.1 Generate → Encrypt → Rotate → Revoke → Verify (core demo)
1. **Generate Key** (`POST /v1/keys`, admin)
   - Validate uniqueness → generate material → wrap via AWS/local → persist metadata/version → log `KEY_CREATE`.
2. **Encrypt** (`POST /v1/crypto/encrypt`, app)
   - RBAC check → load active version → unwrap material (potential AWS decrypt call) → encrypt payload → log `ENCRYPT`.
3. **Rotate** (`POST /v1/keys/:id/rotate`, admin)
   - Authorization → generate new material → disable previous version (grace window) → set new current version → log `KEY_ROTATE`.
4. **Revoke** (`POST /v1/keys/:id/versions/:v/revoke`, admin)
   - Authorization → mark version `REVOKED`, update logical key state if required → log `KEY_REVOKE`.
5. **Verify Logs** (`POST /v1/audit/verify`, auditor)
   - Recompute hash chain → log `AUDIT_VERIFY` with success/failure verdict.

### 5.2 Voice-Based Financial Scam Detector Integration
- Detector microservice requests encryption of extracted voice embeddings using dedicated AES key via `/v1/crypto/encrypt` (principal `scam-detector` with app role).
- Signed model inference results leverage RSA key for non-repudiation via `/v1/crypto/sign`.
- Rotations scheduled to maintain key hygiene and minimize compromise window; detector obtains new versions transparently via API.
- Audit trail provides forensic evidence for voice transaction analyses.

## 6. Security Considerations
- All key material stored encrypted at rest under MK or AWS KMS; plaintext only in-process.
- Adds AAD containing `keyId`/`version` to AES-GCM operations to mitigate misuse.
- Request-level RBAC prevents unauthorized operations; future extension to evaluate `conditions` (IP, time windows).
- Encourages TLS termination upstream (service assumes HTTPS fronting proxy).
- Audit chain defends against log tampering; recommend periodic anchoring to immutable storage.
- Environment secrets loaded via dotenv; ensure `.env` excluded from VCS.
- Scheduler operates under `admin` role to maintain consistent audit semantics.

## 7. Extensibility Notes
- Swap the MySQL driver for another SQL/relational backend by reimplementing `StorageService` with the same interface (e.g., PostgreSQL using `pg`).
- Introduce additional key types (e.g., Ed25519) by extending `KeyType` union and `generateKeyMaterial`/`CryptoService` branches.
- Add background job to auto-revoke versions after grace expiration.
- Extend `GrantService` to evaluate `conditions` for contextual ABAC enforcement.
- Provide gRPC or GraphQL adapters reusing services.

## 8. Deployment & Operations
- Build with `npm run build` (TypeScript → ESM). `npm start` executes compiled `dist/server.js`.
- Configure AWS credentials via standard environment (`AWS_PROFILE`, `AWS_ACCESS_KEY_ID`, etc.) when `KMS_USE_AWS=true`.
- Monitor logs for `scheduler-error` audit entries to detect rotation failures.
- Suggested tests: unit tests for crypto helpers, integration tests for lifecycle workflow, security tests asserting revoke behavior.
