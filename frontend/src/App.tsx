import { useMemo } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { useState, useEffect } from 'react';
import SideMenu from './pages/SideMenu';
import DashboardPage from './pages/DashboardPage';
import KeysPage from './pages/KeysPage';
import WizardPage from './pages/WizardPage';
import AuditPage from './pages/AuditPage';
import GrantsPage from './pages/GrantsPage';
import { ActorProvider, useActor, type Role } from './actorContext';
import { Fade as Hamburger } from 'hamburger-react';
import { GoHome } from "react-icons/go";
import { LiaKeySolid } from "react-icons/lia";
import { TbSettingsCog } from "react-icons/tb";
import { TbChecklist } from "react-icons/tb";
import { SlPeople } from "react-icons/sl";
import DashboardLogo from './pages/Images/DashboardLogo.svg'




interface ActorToolbarProps {
  isOpen: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}


function ActorToolbar({ isOpen, setOpen }: ActorToolbarProps) {
  const { actor, update } = useActor();
  const roles: Role[] = useMemo(() => ['admin', 'app', 'auditor'], []);
  //  const [isOpen, setOpen] = useState(false);

  return (
    <section className="panel actor-bar">
      <div className='z-40 absolute block lg:hidden '>
        <Hamburger toggled={isOpen} toggle={setOpen} />
      </div>
      <div className='pt-12'></div>
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
  const [isOpen, setOpen] = useState(false);

  // prevent background scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (

    <ActorProvider>
        <div className="relative app-shell lg:grid justify-center items-center lg:items-start">
      {/* Desktop sidebar */}
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
     <ActorToolbar isOpen={isOpen} setOpen={setOpen} />
        <Routes>
          <Route path="/" element={<DashboardPage isOpen={isOpen} setOpen={setOpen} />} />
          <Route path="/keys" element={<KeysPage  isOpen={isOpen} setOpen={setOpen} />} />
          <Route path="/wizard" element={<WizardPage isOpen={isOpen} setOpen={setOpen} />} />
          <Route path="/audit" element={<AuditPage isOpen={isOpen} setOpen={setOpen} />} />
          <Route path="/grants" element={<GrantsPage  isOpen={isOpen} setOpen={setOpen}/>} />
        </Routes>
      </main>
    </div>
    </ActorProvider>
  );
}
