import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Fade as Hamburger } from 'hamburger-react';
import DashboardPage from './pages/DashboardPage';
import KeysPage from './pages/KeysPage';
import WizardPage from './pages/WizardPage';
import AuditPage from './pages/AuditPage';
import GrantsPage from './pages/GrantsPage';
import { NavLink } from 'react-router-dom';
import { GoHome } from "react-icons/go";
import { LiaKeySolid } from "react-icons/lia";
import { TbSettingsCog } from "react-icons/tb";
import { TbChecklist } from "react-icons/tb";
import { SlPeople } from "react-icons/sl";
import DashboardLogo from './pages/Images/DashboardLogo.svg'



import SideMenu from './pages/SideMenu';
import AuthPage from './pages/AuthPage';
import { AuthProvider, useAuth } from './actorContext';

function AppShell(): JSX.Element {
  const { session, logout } = useAuth();
  const [isOpen, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!session) {
    return <AuthPage />;
  }

  const roleLabel = session.user.role === 'user' ? 'app' : session.user.role;

  return (
    <div className="relative app-shell lg:grid justify-center items-center lg:items-start">
      <aside className="sidebar hidden lg:flex lg:flex-col">
        <h1 className='font-bold gap-1 text-2xl mb-4 pl-1 flex justify-start items-center'>
          <div className=''><img src={DashboardLogo} alt='logo'/></div>
          Keyforge</h1>
        <nav>
          <NavLink to="/" end className="flex gap-2">
          <div className='w-6 h-6 flex justify-center items-center'><GoHome className='w-full h-full object-cover' /></div>
          Dashboard</NavLink>

          <NavLink to="/keys" className="flex gap-2">
          <div className='w-6 h-6 flex justify-center items-center'><LiaKeySolid className='w-full h-full object-cover' /></div>
          Keys</NavLink>

          <NavLink to="/wizard" className="flex gap-2">
          <div className='w-6 h-6 flex justify-center items-center'><TbSettingsCog className='w-full h-full object-cover' /></div>
          Workflow Wizard</NavLink>

          <NavLink to="/audit" className="flex gap-2">
          <div className='w-6 h-6 flex justify-center items-center'><TbChecklist className='w-full h-full object-cover' /></div>
          Audit Trail</NavLink>

          <NavLink to="/grants" className="flex gap-2">
          <div className='w-5 h-5 flex justify-center items-center'><SlPeople className='w-full h-full object-cover' /></div>
          Grants</NavLink>
        </nav>

        <div className=' block lg:hidden'>
        <SideMenu user={session.user} onNavigate={() => setOpen(false)} onLogout={logout} />
        </div>
      </aside>

      <div className="lg:hidden">
        <div
          className={`fixed inset-0 bg-black z-10 transition-opacity duration-300 ${
            isOpen ? 'opacity-50 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setOpen(false)}
        />
        <div
          className={`fixed top-0 left-0 w-64 h-full z-20 transform transition-transform duration-300 ease-in-out ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <SideMenu user={session.user} onNavigate={() => setOpen(false)} onLogout={logout} />
        </div>
      </div>

      <main className="content">
        <section className="panel actor-bar">
          <div className="flex-between" style={{ gap: 16, flexWrap: 'wrap' }}>
            <div className="flex" style={{ alignItems: 'center', gap: 12 }}>
              <div className="lg:hidden">
                <Hamburger toggled={isOpen} toggle={setOpen} size={18} />
              </div>
              <div>
                <p style={{ margin: 0 }}>Signed in as <strong>{session.user.email}</strong></p>
                <small style={{ color: 'rgba(226,232,240,0.7)' }}>Role: {roleLabel}</small>
              </div>
            </div>
            <button className="button secondary" onClick={logout}>
              Log out
            </button>
          </div>
        </section>
        <Routes>
          <Route path="/" element={<DashboardPage isOpen={isOpen} setOpen={setOpen} />} />
          <Route path="/keys" element={<KeysPage isOpen={isOpen} setOpen={setOpen} />} />
          <Route path="/wizard" element={<WizardPage isOpen={isOpen} setOpen={setOpen} />} />
          <Route path="/audit" element={<AuditPage isOpen={isOpen} setOpen={setOpen} />} />
          <Route path="/grants" element={<GrantsPage isOpen={isOpen} setOpen={setOpen} />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
