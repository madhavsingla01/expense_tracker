import React, { useEffect, useState } from 'react';
import { X, MapPin, FileText, Receipt, CheckCircle2, Edit3, Save, Brain, Sparkles } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';
import { SERVER_URL } from '../../config/api';

const CATEGORIES = [
  'General', 'Food & Dining', 'Food & Delivery', 'Groceries', 'Shopping',
  'Transport', 'Travel', 'Utilities', 'Healthcare', 'Subscriptions',
  'Fuel', 'Bills & EMI', 'Health & Fitness', 'Education', 'Personal Care',
  'Donations', 'Cash Withdrawal', 'Transfer', 'Entertainment', 'Income',
];

function confidenceLabel(confidence) {
  if (!confidence) return null;
  if (confidence >= 0.9) return { text: 'High', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
  if (confidence >= 0.6) return { text: 'Medium', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
  return { text: 'Low', color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30' };
}

export default function TransactionDetailsModal({ transaction, onClose, onUpdate }) {
  const { format } = useCurrency();
  const [displayTx, setDisplayTx] = useState(transaction);
  const [isEditing, setIsEditing] = useState(false);
  const [editCategory, setEditCategory] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDisplayTx(transaction);
    setIsEditing(false);
    setEditCategory(transaction?.category || '');
    setIsSaving(false);
  }, [transaction]);

  if (!displayTx) return null;

  const handleCategorySave = async () => {
    if (!onUpdate || !displayTx || !editCategory || editCategory === displayTx.category) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    const success = await onUpdate(displayTx.id || displayTx._id, { category: editCategory });
    if (success) {
      setDisplayTx((prev) => ({ ...prev, category: editCategory }));
    }
    setIsSaving(false);
    setIsEditing(false);
  };

  const sourceTone = displayTx.source ? displayTx.source.toUpperCase() : '--';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-3 sm:px-4">
      <div className="bg-[#0a0a0c] border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 w-full max-w-md max-h-[88vh] overflow-y-auto custom-scrollbar shadow-2xl animate-[scaleIn_0.2s_ease-out]">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Receipt size={20} className="text-indigo-500" /> Transaction Details
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          <div className="text-center">
            <div className={`text-4xl font-bold tracking-tight mb-2 ${displayTx.credit > 0 ? 'text-emerald-400' : 'text-zinc-100'}`}>
              {displayTx.credit > 0 ? '+' : '-'}{format(displayTx.credit > 0 ? displayTx.credit : displayTx.debit, displayTx.currency || 'INR')}
            </div>
            <div className="text-sm font-mono text-zinc-500 mb-2">
              Balance After: {format(displayTx.balanceAfter, displayTx.currency || 'INR')}
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#064e3b]/30 border border-[#059669]/50 text-[#34d399] rounded-full text-xs font-medium">
              <CheckCircle2 size={12} /> Success
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 space-y-4">
            <div className="flex justify-between items-center gap-4">
              <span className="text-zinc-500 text-sm">Payee/Merchant</span>
              <span className="text-zinc-200 font-medium text-right">{displayTx.payee || displayTx.vendorName}</span>
            </div>
            <div className="flex justify-between items-center gap-4">
              <span className="text-zinc-500 text-sm">Account</span>
              <span className="text-zinc-200 font-medium text-right">{displayTx.accountName || 'Main'}</span>
            </div>

            <div className="flex justify-between items-center gap-4">
              <span className="text-zinc-500 text-sm">Date</span>
              <span className="text-zinc-200 font-medium text-right">{new Date(displayTx.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>

            <div className="flex justify-between items-center gap-4">
              <span className="text-zinc-500 text-sm flex items-center gap-1">
                Category
                {displayTx.confidence && (() => {
                  const label = confidenceLabel(displayTx.confidence);
                  return label ? (
                    <span className={`ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded border ${label.color}`}>
                      <Brain size={10} /> {label.text}
                    </span>
                  ) : null;
                })()}
              </span>
              {onUpdate ? (
                isEditing ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <select
                      value={editCategory}
                      onChange={(event) => setEditCategory(event.target.value)}
                      className="min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-zinc-200 text-sm focus:outline-none focus:border-indigo-500"
                    >
                      {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                    <button
                      onClick={handleCategorySave}
                      disabled={isSaving}
                      className="p-1 text-emerald-400 hover:text-emerald-300"
                    >
                      {isSaving ? <div className="w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /> : <Save size={16} />}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setIsEditing(true); setEditCategory(displayTx.category); }}
                    className="flex items-center gap-1.5 text-zinc-200 font-medium hover:text-indigo-400 transition group"
                  >
                    {displayTx.category}
                    <Edit3 size={12} className="opacity-0 group-hover:opacity-100 transition" />
                  </button>
                )
              ) : (
                <span className="text-zinc-200 font-medium text-right">{displayTx.category}</span>
              )}
            </div>

            <div className="flex justify-between items-center gap-4">
              <span className="text-zinc-500 text-sm">Source</span>
              <span className="text-zinc-200 font-medium uppercase text-right">{sourceTone}</span>
            </div>

            {displayTx.predictionSource && (
              <div className="flex justify-between items-center gap-4">
                <span className="text-zinc-500 text-sm flex items-center gap-1"><Sparkles size={14} /> AI Source</span>
                <span className="text-zinc-200 font-medium text-xs bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-2 py-0.5 rounded-full">{displayTx.predictionSource}</span>
              </div>
            )}

            {displayTx.notes && (
              <div className="flex justify-between items-center gap-4">
                <span className="text-zinc-500 text-sm flex items-center gap-1"><FileText size={14} /> Note</span>
                <span className="text-zinc-200 font-medium text-right max-w-[200px] truncate">{displayTx.notes}</span>
              </div>
            )}
            {displayTx.meta?.location && (
              <div className="flex justify-between items-center gap-4">
                <span className="text-zinc-500 text-sm flex items-center gap-1"><MapPin size={14} /> Location</span>
                <span className="text-zinc-200 font-medium text-right max-w-[200px] truncate">{displayTx.meta.location}</span>
              </div>
            )}
            {displayTx.receiptUrl && (
              <div className="mt-4 pt-4 border-t border-zinc-800/50">
                <span className="text-zinc-500 text-sm flex items-center gap-1 mb-3"><Receipt size={14} /> Attached Receipt</span>
                <a href={`${SERVER_URL}${displayTx.receiptUrl}`} target="_blank" rel="noopener noreferrer" className="block w-full overflow-hidden rounded-xl border border-zinc-700/50 hover:border-indigo-500/50 transition">
                  <img src={`${SERVER_URL}${displayTx.receiptUrl}`} alt="Receipt" className="w-full h-auto max-h-48 object-contain bg-zinc-950/50 hover:scale-105 transition-transform duration-300" />
                </a>
              </div>
            )}
          </div>

          {onUpdate && isEditing && (
            <div className="flex items-center gap-2 text-[11px] text-zinc-500 bg-zinc-900/50 rounded-xl px-3 py-2 border border-zinc-800/50">
              <Brain size={14} className="text-indigo-400 flex-shrink-0" />
              <span>Changing the category teaches the AI. Next time this merchant appears, the system will auto-assign your corrected category.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
