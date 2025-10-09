import { NavLink, Route, Routes } from 'react-router-dom';
import { useState, useEffect } from 'react';
import SideMenu from './pages/SideMenu';
import DashboardPage from './pages/DashboardPage';
import KeysPage from './pages/KeysPage';
import WizardPage from './pages/WizardPage';
import AuditPage from './pages/AuditPage';
import GrantsPage from './pages/GrantsPage';

export default function App() {
  const [isOpen, setOpen] = useState(false);

  // prevent background scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <div className="relative app-shell lg:grid justify-center items-center lg:items-start">
      {/* Desktop sidebar */}
      <aside className="sidebar hidden lg:flex lg:flex-col">
        <h1>Mini KMS</h1>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/keys">Keys</NavLink>
          <NavLink to="/wizard">Workflow Wizard</NavLink>
          <NavLink to="/audit">Audit Trail</NavLink>
          <NavLink to="/grants">Grants</NavLink>
        </nav>
      </aside>

      {/* Mobile overlay + sliding sidebar - always mounted so transitions run */}
      <div className="lg:hidden">
        {/* Backdrop: fade in/out via opacity */}
        <div
          className={
            `fixed inset-0 bg-black z-10 transition-opacity duration-300 ` +
            (isOpen ? 'opacity-50 pointer-events-auto' : 'opacity-0 pointer-events-none')
          }
          onClick={() => setOpen(false)}
        />

        {/* Sidebar: slide in/out via transform */}
        <div
          className={
            `fixed top-0 left-0 w-64 h-full z-20 transform transition-transform duration-300 ease-in-out ` +
            (isOpen ? 'translate-x-0' : '-translate-x-full')
          }
        >
          {/* Optional: pass a callback so SideMenu links can close the menu */}
          <SideMenu onNavigate={() => setOpen(false)} />
        </div>
      </div>

      <main className="content">
        <Routes>
          <Route path="/" element={<DashboardPage isOpen={isOpen} setOpen={setOpen} />} />
          <Route path="/keys" element={<KeysPage  isOpen={isOpen} setOpen={setOpen} />} />
          <Route path="/wizard" element={<WizardPage isOpen={isOpen} setOpen={setOpen} />} />
          <Route path="/audit" element={<AuditPage isOpen={isOpen} setOpen={setOpen} />} />
          <Route path="/grants" element={<GrantsPage  isOpen={isOpen} setOpen={setOpen}/>} />
        </Routes>
      </main>
    </div>
  );
}
