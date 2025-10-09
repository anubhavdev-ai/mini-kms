# Mini KMS Frontend — design notes for the console

The frontend is a lightweight companion to the API. It exists to tell the story of a key’s life cycle in a way that’s easy to demo, support, and extend. Here’s how it works under the hood.

---

## 1. Goals

- Give admins, app teams, and auditors a shared window into keys, versions, usage, grants, and audits.
- Offer a guided wizard that walks newcomers through “generate → encrypt → rotate → decrypt → revoke → verify”.
- Handle sign-in/registration and keep users scoped to the keys they own unless an admin grants elevated access.
- Surface operational signals (rotation alerts, audit health, usage stats) so you can spot trouble early.
- Leave plenty of hooks for future features (e.g., voice-scam detector dashboards).

---

## 2. Tech stack

- **Framework:** React 18 + Vite.
- **Routing:** React Router v6.
- **Data:** @tanstack/react-query for fetching, caching, polling, retries.
- **HTTP:** Axios with a shared client that attaches `Authorization: Bearer <token>` using the persisted session.
- **Styling:** Dark, utility-like CSS in `styles.css`.

---

## 3. Directory tour

src/
  main.tsx            # Bootstraps React + QueryClientProvider
  App.tsx             # Layout, navigation, actor context provider
  styles.css          # Global theme
  actorContext.tsx    # Principal/role state shared across the app

  api/
    client.ts         # Axios instance, session persistence, auth header injection
    auth.ts           # Register/login helpers
    keys.ts           # Queries + mutations for key lifecycle
    crypto.ts         # Encrypt/decrypt/sign/verify hooks
    audit.ts          # Audit log + verification hook
    grants.ts         # Grant CRUD hook
    ops.ts            # Operational metrics hook

  pages/
    AuthPage.tsx      # Sign-in / registration
    DashboardPage.tsx # Metrics dashboard + rotation alerts + audits
    KeysPage.tsx      # Key table, create form, version controls
    WizardPage.tsx    # Step-by-step lifecycle walkthrough
    AuditPage.tsx     # Log viewer + integrity + anchor receipts
    GrantsPage.tsx    # Grant list/editor (admin only)

React Query holds almost all shared state; components keep just enough local state for forms and selections.

---

## 4. Data access patterns

### 4.1 Axios client

- Base URL comes from `VITE_API_BASE_URL` (defaults to `/v1`).
- Persists `{ token, user }` sessions in `localStorage` so refreshes keep you signed in.
- Request interceptor adds `Authorization: Bearer <token>` when a session exists; a response interceptor clears the session on HTTP 401.

### 4.2 React Query hooks

- Keys and audit logs poll periodically (10s and 5s respectively) to keep the UI fresh.
- Mutations invalidate caches so tables update automatically.
- Errors bubble up to the components; pages display inline error states/messages where it matters (wizard, forms).

---

## 5. Page behaviour

### AuthPage

- Handles registration and sign-in, surfacing backend errors inline.
- On success, stores the returned session via the auth context which in turn updates Axios.

### Dashboard

- Combines `/v1/ops/metrics` with the audit log tail and key inventory.
- Shows rotation alerts, audit verification status, and usage counts for the last 24h / 30d.
- Provides a quick snapshot of key hygiene.

### Keys

- Lists keys with state, current version, rotation policy, and owner metadata (filtered to the signed-in user unless they’re an admin/auditor).
- Selecting a row loads detailed version history.
- Create form auto-tags the current user as owner and surfaces backend defaults (30-day rotation, 7-day grace).
- Rotate/disable/revoke buttons map to the respective API mutations.

### Lifecycle wizard

- Orchestrates the canonical workflow: create → encrypt → rotate → decrypt → revoke → verify.
- Persists intermediate outputs (ciphertext bundle) within component state.
- Each step shows live status (`idle`, `running`, `success`, `error`) and surfaces the API responses for transparency.

### Audit

- Displays the latest audit entries with action, status, hash snippet, and timestamp.
- “Verify integrity” button calls `/v1/audit/verify`, refreshes the table, and shows both the integrity verdict and any blockchain anchoring metadata (transaction hash, network) returned by the backend.

### Grants

- Reads grants via `useGrants` when the current user is an admin; renders an access message otherwise.
- Form lets admins upsert grants with comma-separated operations and JSON conditions.

---

## 6. Auth context

- `actorContext.tsx` (renamed in code to act as the auth provider) keeps the `{ token, user }` session in React state and persists it to `localStorage`.
- Exposes `login`, `logout`, and `updateUser` helpers so pages/components can react to authentication changes.
- When the session changes it updates the Axios client, ensuring all requests automatically include or drop the bearer token.

---

## 7. Security & UX considerations

- JWTs live in `localStorage`; pair them with HTTPS and rotate the signing secret in production.
- React Query data lives in memory only; no persistence beyond the session provider.
- UI nudges (alerts, rotation callouts, owner tags) encourage healthy lifecycle behaviour.
- Audit hashes (and anchoring receipts when available) are surfaced prominently to reinforce tamper-evidence.

---

## 8. Build & deploy

- Dev server: `npm run dev` (Vite) with proxy to `/v1`.
- Production build: `npm run build` → static assets in `dist/`.
- Environment variables go through Vite’s `import.meta.env` pipeline; never bake secrets into the client bundle.

---

## 9. Room to grow

- Layer in a component library (e.g., shadcn/ui) for richer visual affordances.
- Add charts and alert banners to the dashboard (e.g., rotation SLA breaches).
- Build a dedicated view for ML/scam-detector operators that bundles relevant keys, usage, and health metrics.
- Wire up Cypress tests for the lifecycle wizard and grants flow.
- Internationalise strings for broader deployments.

Use this blueprint when you extend or refactor the console so it stays friendly, expressive, and aligned with the backend.***
