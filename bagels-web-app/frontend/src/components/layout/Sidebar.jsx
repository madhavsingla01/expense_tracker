import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, List, PlusCircle,
  Smartphone, Camera, PieChart as PieChartIcon, UserCircle, Menu, FileUp
} from 'lucide-react';
import NavItem from '../ui/NavItem';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { path: '/', icon: <LayoutDashboard size={18} />, label: 'Insights' },
  { path: '/ledger', icon: <List size={18} />, label: 'Ledger' },
  { path: '/budgets', icon: <PieChartIcon size={18} />, label: 'Budgets' },
  { path: '/add', icon: <PlusCircle size={18} />, label: 'Add Record' },
];

const highlightItems = [
  { path: '/pay', icon: <Smartphone size={18} />, label: 'UPI Quick Pay' },
  { path: '/scan', icon: <Camera size={18} />, label: 'Scan Bill (OCR)' },
  { path: '/import', icon: <FileUp size={18} />, label: 'Import Statement' },
];

export default function Sidebar({ isOpen, onClose, isCollapsed, onToggleCollapse }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const handleNav = (path) => {
    navigate(path);
    onClose();
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-64 ${isCollapsed ? 'md:w-20' : 'md:w-64'} bg-zinc-900 border-r border-zinc-800 flex flex-col transform transition-[width,transform] duration-200 md:relative md:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        className="hidden md:block absolute inset-y-0 right-0 z-10 w-3 cursor-ew-resize hover:bg-indigo-500/20 transition"
        aria-label={isCollapsed ? 'Expand sidebar' : 'Minimize sidebar'}
        title={isCollapsed ? 'Expand sidebar' : 'Minimize sidebar'}
      />

      <div className={`p-5 border-b border-zinc-800 flex items-center ${isCollapsed ? 'md:justify-center md:px-4' : ''}`}>
        <button
          type="button"
          onClick={onToggleCollapse}
          className={`hidden md:inline-flex ml-auto p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition ${isCollapsed ? 'md:hidden' : ''}`}
          aria-label="Minimize sidebar"
        >
          <Menu size={18} />
        </button>
      </div>

      <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
        {isCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden md:flex w-full items-center justify-center px-3 py-3 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
            aria-label="Expand sidebar"
          >
            <Menu size={18} />
          </button>
        )}
        {navItems.map((item) => (
          <NavItem
            key={item.path}
            icon={item.icon}
            label={item.label}
            isActive={location.pathname === item.path}
            onClick={() => handleNav(item.path)}
            collapsed={isCollapsed}
          />
        ))}
        <div className="my-4 border-t border-zinc-800/50" />
        {highlightItems.map((item) => (
          <NavItem
            key={item.path}
            icon={item.icon}
            label={item.label}
            isActive={location.pathname === item.path}
            onClick={() => handleNav(item.path)}
            highlight
            collapsed={isCollapsed}
          />
        ))}
        <div className="my-4 border-t border-zinc-800/50" />
        <NavItem
          icon={<UserCircle size={18} />}
          label="Profile"
          isActive={location.pathname === '/profile'}
          onClick={() => handleNav('/profile')}
          collapsed={isCollapsed}
        />
      </nav>


    </aside>
  );
}
