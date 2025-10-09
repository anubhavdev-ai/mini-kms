import { NavLink } from 'react-router-dom';
import { SessionUser } from '../api/client';

interface SideMenuProps {
  user: SessionUser;
  onNavigate?: () => void;
  onLogout: () => void;
}

export default function SideMenu({ user, onNavigate, onLogout }: SideMenuProps) {
  const handleNavigate = () => {
    if (onNavigate) {
      onNavigate();
    }
  };

  return (
    <div className="w-full h-full flex flex-col gap-4 justify-start items-start bg-[#0f172a] p-6">
      <div className="font-bold text-2xl">Mini KMS</div>
      <div style={{ fontSize: 14, color: 'rgba(226,232,240,0.7)' }}>
        {user.email}
      </div>
      <NavLink
        to="/"
        end
        className="w-full font-2xl px-3 py-4 rounded-2xl bg-[#94a3b81a] hover:bg-[#3b82f699] cursor-pointer"
        onClick={handleNavigate}
      >
        Dashboard
      </NavLink>
      <NavLink
        to="/keys"
        className="w-full font-2xl px-3 py-4 rounded-2xl bg-[#94a3b81a] hover:bg-[#3b82f699] cursor-pointer"
        onClick={handleNavigate}
      >
        Keys
      </NavLink>
      <NavLink
        to="/wizard"
        className="w-full font-2xl px-3 py-4 rounded-2xl bg-[#94a3b81a] hover:bg-[#3b82f699] cursor-pointer"
        onClick={handleNavigate}
      >
        Workflow Wizard
      </NavLink>
      <NavLink
        to="/audit"
        className="w-full font-2xl px-3 py-4 rounded-2xl bg-[#94a3b81a] hover:bg-[#3b82f699] cursor-pointer"
        onClick={handleNavigate}
      >
        Audit Trail
      </NavLink>
      <NavLink
        to="/grants"
        className="w-full font-2xl px-3 py-4 rounded-2xl bg-[#94a3b81a] hover:bg-[#3b82f699] cursor-pointer"
        onClick={handleNavigate}
      >
        Grants
      </NavLink>
      <button className="button secondary" style={{ marginTop: 'auto', width: '100%' }} onClick={onLogout}>
        Log out
      </button>
    </div>
  );
}
