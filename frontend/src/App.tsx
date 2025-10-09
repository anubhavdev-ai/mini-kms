import { useMemo } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import KeysPage from './pages/KeysPage';
import WizardPage from './pages/WizardPage';
import AuditPage from './pages/AuditPage';
import GrantsPage from './pages/GrantsPage';
import { ActorProvider, useActor, type Role } from './actorContext';

function ActorToolbar() {
  const { actor, update } = useActor();
  const roles: Role[] = useMemo(() => ['admin', 'app', 'auditor'], []);

  return (
    <section className="panel actor-bar">
      <div className="grid two">
        <div>
          <label>Principal</label>
          <input
            className="input"
            value={actor.principal}
            onChange={(event) => update({ principal: event.target.value })}
            placeholder="e.g. demo-admin"
          />
        </div>
        <div>
          <label>Role</label>
          <select
            className="select"
            value={actor.role}
            onChange={(event) => update({ role: event.target.value as Role })}
          >
            {roles.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="actor-hint">
        Requests are issued as <strong>{actor.principal || 'unknown'}</strong> with{' '}
        <strong>{actor.role}</strong> privileges.
      </p>
    </section>
  );
}

export default function App() {
  return (
    <ActorProvider>
      <div className="app-shell">
        <aside className="sidebar">
          <h1>Mini KMS</h1>
          <nav>
            <NavLink to="/" end>
              Dashboard
            </NavLink>
            <NavLink to="/keys">Keys</NavLink>
            <NavLink to="/wizard">Workflow Wizard</NavLink>
            <NavLink to="/audit">Audit Trail</NavLink>
            <NavLink to="/grants">Grants</NavLink>
          </nav>
        </aside>
        <main className="content">
          <ActorToolbar />
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/keys" element={<KeysPage />} />
            <Route path="/wizard" element={<WizardPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/grants" element={<GrantsPage />} />
          </Routes>
        </main>
      </div>
    </ActorProvider>
  );
}
