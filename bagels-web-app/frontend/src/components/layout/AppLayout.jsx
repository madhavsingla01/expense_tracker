import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import { useAuth } from '../../context/AuthContext';

export default function AppLayout({
  globalRange,
  setGlobalRange,
  notifications,
  showNotifications,
  setShowNotifications,
  onDismissNotification,
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      <div className="flex flex-col md:flex-row h-screen overflow-hidden min-w-0">

        {isMobileMenuOpen && (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* SIDEBAR */}
        <Sidebar
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 h-full min-w-0 flex flex-col bg-zinc-950 relative overflow-hidden">
          <Header
            globalRange={globalRange}
            setGlobalRange={setGlobalRange}
            notifications={notifications}
            showNotifications={showNotifications}
            setShowNotifications={setShowNotifications}
            onDismissNotification={onDismissNotification}
            isMobileMenuOpen={isMobileMenuOpen}
            setIsMobileMenuOpen={setIsMobileMenuOpen}
          />
          <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 max-w-7xl mx-auto w-full flex flex-col pb-32 md:pb-8">
            <Outlet />
          </div>
        </main>
        
        {/* MOBILE BOTTOM NAVIGATION */}
        <BottomNav />
      </div>
    </div>
  );
}
