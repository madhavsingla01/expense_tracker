import React from 'react';

export default function NavItem({ icon, label, isActive, onClick, highlight, collapsed }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
        collapsed ? 'md:justify-center md:px-3' : ''
      } ${
        isActive
          ? highlight
            ? 'bg-fuchsia-500/20 text-fuchsia-300'
            : 'bg-indigo-500/10 text-indigo-300'
          : highlight
            ? 'text-fuchsia-400'
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
      }`}
    >
      {icon}
      <span className={collapsed ? 'md:hidden' : ''}>{label}</span>
    </button>
  );
}
