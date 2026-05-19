import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, AlertCircle, Trash2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function DeleteAccountModal({ isOpen, onClose }) {
  const { deleteAccount, getDeletionPreview } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState(null);

  // Reset state every time modal opens
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setConfirmText('');
      setError('');
      setDeleting(false);
      setPreview(null);
      getDeletionPreview?.()
        .then(setPreview)
        .catch(() => setPreview(null));
    }
  }, [isOpen]);

  const handleDelete = async () => {
    if (confirmText !== 'DELETE MY ACCOUNT') { setError('Please type DELETE MY ACCOUNT to confirm'); return; }
    if (!password) { setError('Password is required'); return; }
    setDeleting(true);
    setError('');
    try {
      await deleteAccount(password, confirmText);
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Deletion failed. Please try again.');
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-3 sm:px-4"
      onClick={() => { if (!deleting) onClose(); }}
    >
      <div
        className="bg-[#0a0a0c] border border-red-500/20 rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl animate-[fadeIn_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
            <AlertTriangle size={20} /> Delete Account
          </h3>
          <button
            onClick={() => { if (!deleting) onClose(); }}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Close delete confirmation"
          >
            <X size={20} />
          </button>
        </div>

        {/* Warning */}
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-5">
          <p className="text-sm text-red-300 font-medium mb-1">⚠️ This action is permanent and cannot be undone.</p>
          <p className="text-xs text-zinc-500">All your data — transactions, budgets, accounts, receipts, AI learning, and preferences — will be permanently erased.</p>
        </div>

        {/* Deletion Preview */}
        {preview && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-5">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Data to be deleted</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {preview.transactions > 0 && (
                <div className="flex justify-between text-zinc-400"><span>Transactions</span><span className="text-zinc-200 font-mono">{preview.transactions}</span></div>
              )}
              {preview.accounts > 0 && (
                <div className="flex justify-between text-zinc-400"><span>Accounts</span><span className="text-zinc-200 font-mono">{preview.accounts}</span></div>
              )}
              {preview.ledgerEntries > 0 && (
                <div className="flex justify-between text-zinc-400"><span>Ledger Entries</span><span className="text-zinc-200 font-mono">{preview.ledgerEntries}</span></div>
              )}
              {preview.budgets > 0 && (
                <div className="flex justify-between text-zinc-400"><span>Budgets</span><span className="text-zinc-200 font-mono">{preview.budgets}</span></div>
              )}
              {preview.payments > 0 && (
                <div className="flex justify-between text-zinc-400"><span>Payments</span><span className="text-zinc-200 font-mono">{preview.payments}</span></div>
              )}
              {preview.importBatches > 0 && (
                <div className="flex justify-between text-zinc-400"><span>Imports</span><span className="text-zinc-200 font-mono">{preview.importBatches}</span></div>
              )}
              {preview.receiptFiles > 0 && (
                <div className="flex justify-between text-zinc-400"><span>Receipt Files</span><span className="text-zinc-200 font-mono">{preview.receiptFiles}</span></div>
              )}
              {preview.aiLearningRecords > 0 && (
                <div className="flex justify-between text-zinc-400"><span>AI Records</span><span className="text-zinc-200 font-mono">{preview.aiLearningRecords}</span></div>
              )}
              {preview.feedbackRecords > 0 && (
                <div className="flex justify-between text-zinc-400"><span>Feedback</span><span className="text-zinc-200 font-mono">{preview.feedbackRecords}</span></div>
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-zinc-800 flex justify-between text-xs">
              <span className="text-zinc-300 font-medium">Total Records</span>
              <span className="text-red-400 font-bold font-mono">{preview.total}</span>
            </div>
          </div>
        )}

        {/* Password Input */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Enter your password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your account password"
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-colors"
            disabled={deleting}
          />
        </div>

        {/* Confirmation Text Input */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">
            Type <span className="text-red-400 font-bold">DELETE MY ACCOUNT</span> to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE MY ACCOUNT"
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-colors font-mono tracking-wider"
            disabled={deleting}
            autoComplete="off"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center gap-2">
            <AlertCircle size={16} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            disabled={deleting}
            className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting || confirmText !== 'DELETE MY ACCOUNT' || !password}
            className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:hover:bg-red-600 text-white font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-2"
          >
            {deleting ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Deleting...
              </>
            ) : (
              <>
                <Trash2 size={14} />
                Permanently Delete
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
