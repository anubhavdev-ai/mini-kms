import { NavLink, Route, Routes } from 'react-router-dom';

type SideMenuProps = {
  onNavigate?: () => void;
};
export default function SideMenu({ onNavigate }: SideMenuProps) {
  return (
    <div className=" w-full h-screen flex gap-4 flex-col justify-start items-center bg-[#0f172a] p-2 pt-9 px-4">
        <div className="font-bold text-2xl w-full flex justify-start pl-20">Mini KMS</div>
        <NavLink to="/" end className ="w-full font-2xl px-3 py-4 rounded-2xl bg-[#94a3b81a] hover:bg-[#3b82f699] cursor-pointer ">Dashboard</NavLink>
        <NavLink to="/keys" className="w-full font-2xl px-3 py-4 rounded-2xl bg-[#94a3b81a] hover:bg-[#3b82f699] cursor-pointer ">Keys</NavLink>
        <NavLink to="/wizard" className="w-full font-2xl px-3 py-4 rounded-2xl bg-[#94a3b81a] hover:bg-[#3b82f699] cursor-pointer ">Workflow Wizard</NavLink>
        <NavLink to="/audit" className="w-full font-2xl px-3 py-4 rounded-2xl bg-[#94a3b81a] hover:bg-[#3b82f699] cursor-pointer ">Audit Trail</NavLink>
        <NavLink to="/grants" className="w-full font-2xl px-3 py-4 rounded-2xl bg-[#94a3b81a] hover:bg-[#3b82f699] cursor-pointer ">Grants</NavLink>
    </div>
  )
}