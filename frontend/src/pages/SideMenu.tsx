import { NavLink, Route, Routes } from 'react-router-dom';
import { GoHome } from "react-icons/go";
import { LiaKeySolid } from "react-icons/lia";
import { TbSettingsCog } from "react-icons/tb";
import { TbChecklist } from "react-icons/tb";
import { SlPeople } from "react-icons/sl";

type SideMenuProps = {
  onNavigate?: () => void;
};
export default function SideMenu({ onNavigate }: SideMenuProps) {
  return (
    <div className=" w-full h-screen flex gap-4 flex-col justify-start rounded-tr-2xl items-center bg-[#1b1b1b] p-2 pt-9 px-4">
        <div className="font-bold text-2xl w-full flex justify-start pl-20">Mini KMS</div>
        <NavLink to="/" end className ="w-full font-2xl px-3 py-4 rounded-2xl bg-[#94a3b81a] hover:bg-[#3b82f699] cursor-pointer flex justify-start items-center gap-4 ">
        <div className='w-6 h-6 flex justify-center items-center'><GoHome className='w-full h-full object-cover' /></div>
        Dashboard</NavLink>

        <NavLink to="/keys" className="w-full font-2xl px-3 py-4 rounded-2xl bg-[#94a3b81a] hover:bg-[#3b82f699] cursor-pointer flex justify-start items-center gap-4 ">
        <div className='w-6 h-6 flex justify-center items-center'><LiaKeySolid className='w-full h-full object-cover' /></div>
        Keys
        </NavLink>

        <NavLink to="/wizard" className="w-full font-2xl px-3 py-4 rounded-2xl bg-[#94a3b81a] hover:bg-[#3b82f699] cursor-pointer flex justify-start items-center gap-4 ">
        <div className='w-6 h-6 flex justify-center items-center'><TbSettingsCog className='w-full h-full object-cover' /></div>
        Workflow Wizard
        </NavLink>

        <NavLink to="/audit" className="w-full font-2xl px-3 py-4 rounded-2xl bg-[#94a3b81a] hover:bg-[#3b82f699] cursor-pointer flex justify-start items-center gap-4 ">
        <div className='w-6 h-6 flex justify-center items-center'><TbChecklist className='w-full h-full object-cover' /></div>
        Audit Trail
        </NavLink>

        <NavLink to="/grants" className="w-full font-2xl px-3 py-4 rounded-2xl bg-[#94a3b81a] hover:bg-[#3b82f699] cursor-pointer flex justify-start items-center gap-4 ">
        <div className='w-5 h-5 flex justify-center items-center'><SlPeople className='w-full h-full object-cover' /></div>
        Grants
        </NavLink>
    </div>
  )
}