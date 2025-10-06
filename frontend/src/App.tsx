import { NavLink, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import KeysPage from './pages/KeysPage';
import WizardPage from './pages/WizardPage';
import AuditPage from './pages/AuditPage';
import GrantsPage from './pages/GrantsPage';

export default function App() {
  return (
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
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/keys" element={<KeysPage />} />
          <Route path="/wizard" element={<WizardPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/grants" element={<GrantsPage />} />
        </Routes>
      </main>
    </div>
  );
}
