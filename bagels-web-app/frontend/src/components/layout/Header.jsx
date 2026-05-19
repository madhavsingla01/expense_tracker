import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, CalendarDays, CreditCard, FileText, Receipt, Tag, X, Settings, LogOut, MessageSquare, Trash2, Menu } from 'lucide-react';
import { fmt } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import { SERVER_URL } from '../../config/api';
import Avatar from '../ui/Avatar';
import DatePicker from '../ui/DatePicker';
import DeleteAccountModal from '../ui/DeleteAccountModal';
import { useNavigate } from 'react-router-dom';

const viewTitles = {
  '/': 'Insights',
  '/ledger': 'Ledger',
  '/budgets': 'Budgets',
  '/add': 'Add Record',
  '/scan': 'Scan Bill',
  '/pay': 'UPI Quick Pay',
  '/import': 'Import Statement',
  '/profile': 'Profile',
  '/feedback': 'Feedback',
};

export default function Header({
  globalRange,
  setGlobalRange,
  notifications,
  showNotifications,
  setShowNotifications,
  onDismissNotification,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
}) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const title = viewTitles[location.pathname] || 'Dashboard';
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const selectedTx = selectedNotification?.transaction;
  const selectedDetails = selectedNotification?.details;

  const profileMenuRef = useRef(null);
  const notificationMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      // Don't close if clicking inside a modal or portal that might be appended to body
      if (e.target.closest('[role="dialog"]') || e.target.closest('.fixed.z-\\[60\\]')) {
        return;
      }
      
      if (showProfileMenu && profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
      if (showNotifications && notificationMenuRef.current && !notificationMenuRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };

    if (showProfileMenu || showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileMenu, showNotifications, setShowNotifications]);

  const handleDismiss = (event, id) => {
    event.stopPropagation();
    onDismissNotification?.(id);
    if (selectedNotification?.id === id) setSelectedNotification(null);
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/50 px-4 md:px-8 py-3 md:py-4 flex flex-wrap items-center justify-between gap-3 min-w-0">
        
        {/* Left: Hamburger (Mobile) + Title */}
        <div className="flex items-center gap-3 min-w-0 order-1">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-colors"
            aria-label="Toggle navigation"
          >
            <Menu size={24} />
          </button>
          <h2 className="text-lg md:text-xl font-semibold text-zinc-100 capitalize truncate">{title}</h2>
        </div>

        {/* Center/Bottom: Date Range Filter */}
        <div className="flex flex-1 sm:flex-none justify-center sm:justify-start min-w-0 order-3 sm:order-2 w-full sm:w-auto mt-1 sm:mt-0">
          <DatePicker range={globalRange} onChange={setGlobalRange} />
        </div>

        {/* Right: Notifications & Profile */}
        <div className="flex items-center gap-1 sm:gap-3 min-w-0 order-2 sm:order-3 ml-auto sm:ml-0">
          {/* Smart Notifications */}
          <div className="relative" ref={notificationMenuRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-zinc-400 hover:text-white rounded-full relative"
              aria-label="Notifications"
            >
              <Bell size={20} />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 min-w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border border-zinc-950" />
              )}
            </button>
            {showNotifications && (
              <div className="fixed left-4 right-4 top-28 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl py-2 z-50">
                <div className="px-4 py-2 border-b border-zinc-800">
                  <h4 className="font-bold text-zinc-100">Smart Alerts</h4>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length > 0 ? (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedNotification(notification)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') setSelectedNotification(notification);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-zinc-800/50 border-b border-zinc-800/50 transition cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className={`text-sm font-semibold ${notification.type === 'danger' ? 'text-red-400' : 'text-amber-400'}`}>
                              {notification.title}
                            </p>
                            <p className="text-xs text-zinc-400 mt-0.5">{notification.message}</p>
                          </div>
                          <button
                            type="button"
                            onClick={(event) => handleDismiss(event, notification.id)}
                            className="shrink-0 p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700"
                            aria-label="Dismiss notification"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-center text-zinc-500 text-sm">No recent anomalies.</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile Dropdown */}
          <div className="relative hidden md:block" ref={profileMenuRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center outline-none ring-0 rounded-full hover:ring-2 hover:ring-indigo-500/50 transition-all"
              aria-label="Open profile menu"
            >
              <Avatar src={user?.avatar} name={user?.name} email={user?.email} size="sm" />
            </button>

            {showProfileMenu && (
              <div className="fixed right-4 top-16 mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl py-2 z-50 animate-[scaleIn_0.15s_ease-out]">
                <div className="px-4 py-3 border-b border-zinc-800/50 mb-1">
                  <p className="text-sm font-semibold text-zinc-100 truncate">{user?.name}</p>
                  <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
                </div>
                
                <button
                  onClick={() => { setShowProfileMenu(false); navigate('/profile'); }}
                  className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/50 transition flex items-center gap-2"
                >
                  <Settings size={16} className="text-zinc-400" /> Settings & Profile
                </button>
                <button
                  onClick={() => { setShowProfileMenu(false); navigate('/feedback'); }}
                  className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/50 transition flex items-center gap-2"
                >
                  <MessageSquare size={16} className="text-zinc-400" /> Give Feedback
                </button>
                
                <div className="my-1 border-t border-zinc-800/50" />
                
                <button
                  onClick={() => { setShowProfileMenu(false); logout(); }}
                  className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/50 transition flex items-center gap-2"
                >
                  <LogOut size={16} className="text-zinc-400" /> Logout
                </button>
                
                <div className="my-1 border-t border-zinc-800/50" />
                
                <button
                  onClick={() => { setShowProfileMenu(false); setShowDeleteModal(true); }}
                  className="w-full text-left px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-zinc-800/50 transition flex items-center gap-2"
                >
                  <Trash2 size={16} /> Delete Account
                </button>
              </div>
            )}
          </div>
        </div>
      </header>


      {selectedNotification && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-3 sm:px-4">
          <div className="bg-[#0a0a0c] border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 w-full max-w-md max-h-[88vh] overflow-y-auto custom-scrollbar shadow-2xl animate-[scaleIn_0.2s_ease-out]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <Receipt size={20} className="text-indigo-500" /> {selectedNotification.title}
              </h3>
              <button onClick={() => setSelectedNotification(null)} className="text-zinc-500 hover:text-zinc-300" aria-label="Close details">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5">
              <p className="text-sm text-zinc-400">{selectedNotification.message}</p>

              {selectedTx ? (
                <>
                  <div className="text-center">
                    <div className={`text-4xl font-bold tracking-tight mb-2 ${selectedTx.type === 'income' ? 'text-emerald-400' : 'text-zinc-100'}`}>
                      {selectedTx.credit > 0 ? '+' : '-'}{fmt(selectedTx.credit > 0 ? selectedTx.credit : selectedTx.debit)}
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#064e3b]/30 border border-[#059669]/50 text-[#34d399] rounded-full text-xs font-medium">
                      Purchase Detail
                    </div>
                  </div>

                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 space-y-4">
                    <div className="flex justify-between gap-4">
                      <span className="text-zinc-500 text-sm flex items-center gap-1"><CreditCard size={14} /> Merchant</span>
                      <span className="text-zinc-200 font-medium text-right">{selectedTx.payee}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-zinc-500 text-sm flex items-center gap-1"><CalendarDays size={14} /> Date</span>
                      <span className="text-zinc-200 font-medium">{new Date(selectedTx.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-zinc-500 text-sm flex items-center gap-1"><Tag size={14} /> Category</span>
                      <span className="text-zinc-200 font-medium">{selectedTx.category}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-zinc-500 text-sm">Source</span>
                      <span className="text-zinc-200 font-medium uppercase">{selectedTx.source}</span>
                    </div>
                    {selectedTx.notes && (
                      <div className="flex justify-between gap-4">
                        <span className="text-zinc-500 text-sm flex items-center gap-1"><FileText size={14} /> Note</span>
                        <span className="text-zinc-200 font-medium text-right max-w-[220px]">{selectedTx.notes}</span>
                      </div>
                    )}
                    {selectedTx.receiptUrl && (
                      <div className="pt-4 border-t border-zinc-800/50">
                        <span className="text-zinc-500 text-sm flex items-center gap-1 mb-3"><Receipt size={14} /> Attached Receipt</span>
                        <a href={`${SERVER_URL}${selectedTx.receiptUrl}`} target="_blank" rel="noopener noreferrer" className="block w-full overflow-hidden rounded-xl border border-zinc-700/50 hover:border-indigo-500/50 transition">
                          <img src={`${SERVER_URL}${selectedTx.receiptUrl}`} alt="Receipt" className="w-full h-auto max-h-48 object-contain bg-zinc-950/50" />
                        </a>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 space-y-4">
                  {selectedDetails?.category && (
                    <div className="flex justify-between gap-4">
                      <span className="text-zinc-500 text-sm">Category</span>
                      <span className="text-zinc-200 font-medium">{selectedDetails.category}</span>
                    </div>
                  )}
                  {selectedDetails?.spent !== undefined && (
                    <div className="flex justify-between gap-4">
                      <span className="text-zinc-500 text-sm">Spent</span>
                      <span className="text-zinc-200 font-medium">{fmt(selectedDetails.spent)}</span>
                    </div>
                  )}
                  {selectedDetails?.limit !== undefined && (
                    <div className="flex justify-between gap-4">
                      <span className="text-zinc-500 text-sm">Budget Limit</span>
                      <span className="text-zinc-200 font-medium">{fmt(selectedDetails.limit)}</span>
                    </div>
                  )}
                  {selectedDetails?.percentage !== undefined && (
                    <div className="flex justify-between gap-4">
                      <span className="text-zinc-500 text-sm">Share of Spending</span>
                      <span className="text-zinc-200 font-medium">{selectedDetails.percentage.toFixed(0)}%</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <DeleteAccountModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} />
    </>
  );
}
