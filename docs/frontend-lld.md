# Mini KMS Frontend Low-Level Design

## 1. Goals & Scope
- Provide an admin-oriented console to exercise the KMS lifecycle: generate → use → rotate → revoke → verify.
- Offer visibility into key inventory, versions, grants, and audit logs.
- Deliver a guided workflow wizard for demos and onboarding.
- Expose configuration for principal/role headers to impersonate different actors.
- Serve as a control-plane companion for subsystems like the Voice-Based Financial Scam Detector by allowing operators to manage crypto assets backing the detector service.

## 2. Technology Stack
- **Framework**: React 18 with Vite bundler.
- **Routing**: React Router v6.
- **Data fetching**: @tanstack/react-query for caching, retries, polling.
- **HTTP client**: Axios with configurable base URL and default headers derived from Vite env.
- **Styling**: Custom CSS classes (`styles.css`) targeting a dark-themed admin shell.

## 3. Application Structure
```
src/
  App.tsx              # Layout + route composition
  main.tsx             # React bootstrap + QueryClientProvider
  styles.css           # Global theme
  api/
    client.ts          # Axios instance
    keys.ts            # Hooks for key CRUD & rotation
    crypto.ts          # Hooks for encrypt/decrypt/sign/verify
    audit.ts           # Hooks for audit log & integrity check
    grants.ts          # Hooks for grant CRUD
  pages/
    DashboardPage.tsx  # Summary metrics + recent audits
    KeysPage.tsx       # Key list, creation form, version controls
    WizardPage.tsx     # Guided lifecycle workflow
    AuditPage.tsx      # Audit viewer with verify action
    GrantsPage.tsx     # Grant listing + editor
  components/          # (future) shared widgets; not populated yet
```

## 4. Data Access Layer
### 4.1 Axios Client (`api/client.ts`)
- Reads `VITE_API_BASE_URL`, `VITE_DEFAULT_PRINCIPAL`, `VITE_DEFAULT_ROLE` from runtime env.
- Interceptor injects default headers if caller hasn’t set `x-principal` / `x-role`.
- Designed to simulate different caller personas (admin/app/auditor) without auth forms.

### 4.2 React Query Hooks
- Each API module exports `useQuery` / `useMutation` hooks that wrap axios calls and manage cache invalidation.
- Polling windows:
  - Keys: refetch every 10s
  - Audit log: refetch every 5s for near-real-time feedback
- Mutations trigger invalidation to ensure UI reflects server state post-operation.

## 5. Page Flows

### 5.1 `App.tsx`
- Defines sidebar navigation and main content area.
- Routes map to page components; default route `/` renders dashboard.

### 5.2 DashboardPage
- Aggregates counts (total/enabled/revoked) from `useKeys`.
- Displays last few audit events for situational awareness.
- Intended as launchpad for monitoring key health and scheduled activities.

### 5.3 KeysPage
- Combines key inventory table with creation form and version controls.
- Clicking a row loads detailed key info (versions) via `useKey`.
- Supports rotate/disable/revoke operations through dedicated mutations.
- Form defaults align with backend defaults (30-day rotation, 7-day grace).

### 5.4 WizardPage
- Implements canonical workflow to satisfy deliverable requirement: **generate → encrypt → rotate → decrypt → revoke → verify**.
- Maintains per-step statuses (`idle` | `running` | `success` | `error`) and messages.
- Captures ciphertext bundle for display and reuse during decrypt/revoke steps.
- After verification, triggers audit refetch to update UI with integrity check result.
- Extensible: future wizard steps can include voice-scam detector readiness checks (e.g., provisioning keys for ML pipeline).

### 5.5 AuditPage
- Tabular audit log viewer with timestamp, action, hash snippet.
- “Verify Integrity” button invokes `/v1/audit/verify` and surfaces results.
- Designed for auditors or SOC engineers to quickly validate tamper-resistance.

### 5.6 GrantsPage
- Lists existing grants with principal, role, key scope, allowed ops, created timestamp.
- Provides form for admins to upsert grants via comma-separated operations and JSON conditions.
- Conditions stored as raw JSON for forward compatibility with contextual policies.

## 6. State & UI Management
- Global state kept minimal; React Query handles caching & background refresh.
- Local component state used for forms, wizard status, and selection (e.g., `selectedKeyId`).
- UI uses semantic CSS utility classes for consistent styling across sections.
- Buttons display activity states (e.g., “Creating…”) based on mutation loading flags.

## 7. Security & Compliance Considerations
- No secrets stored in browser; authentication simulated via headers for demo.
- Encourage deployment behind authenticated reverse proxy (e.g., OIDC) to map identities to principals.
- Avoids localStorage for tokens; QueryClient in-memory only.
- Provides visibility into audit hashes, promoting tamper evidence for compliance.
- Encourages operators to rotate keys and verify logs regularly via UI cues.
- For the voice-based scam detector, UI can be extended with dedicated dashboards surfacing key/material health metrics that service depends on.

## 8. Environment & Build
- `.env.example` documents expected variables; actual `.env` should mirror but remain untracked.
- Vite dev server proxies `/v1` calls to backend (configured in `vite.config.ts`).
- Build flow: `npm run build` → static assets for deployment.

## 9. Extensibility Roadmap
- Component library integration (e.g., shadcn/ui) for richer UX.
- Role-awareness in UI (toggle between admin/app/auditor personas).
- Add charts for rotation cadence and audit results.
- Dedicated page for Problem Statement 2 to manage ML models, with controls to rotate keys used by voice analytics (leveraging existing API hooks).
- Internationalization support for broader deployments.

## 10. Testing Strategy (Planned)
- Component tests using React Testing Library for forms and wizard.
- Cypress end-to-end script to execute full lifecycle workflow.
- Visual regression snapshots for critical pages.

This design ensures the frontend cleanly orchestrates lifecycle operations, surfaces audit assurance, and remains ready to expand for adjacent solutions like the voice-based financial scam detector.
