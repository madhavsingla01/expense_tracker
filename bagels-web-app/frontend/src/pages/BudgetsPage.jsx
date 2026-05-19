import React, { useState } from 'react';
import { AlertCircle, Loader2, PieChart, Target, Trash2, Edit2, Info } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';
import BudgetDetailsModal from '../components/dashboard/BudgetDetailsModal';
import { useContextMenu } from '../context/ContextMenuContext';

export default function BudgetsPage({ budgets, saveBudget, deleteBudget, insights, transactions, globalRange }) {
  const [cat, setCat] = useState('');
  const [lim, setLim] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [selectedBudget, setSelectedBudget] = useState(null);
  const { bindContextMenu } = useContextMenu();
  const { preferredCurrency, format } = useCurrency();

  const handleSave = async (e) => {
    e.preventDefault();
    if (!cat || !lim) return;
    setIsSaving(true);
    try {
      await saveBudget(cat, lim);
      setCat('');
      setLim('');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (e, category) => {
    e.stopPropagation();
    if (deletingCategory) return;
    setDeletingCategory(category);
    try {
      await deleteBudget(category);
    } finally {
      setDeletingCategory(null);
    }
  };

  const budgetEntries = Object.entries(budgets);

  return (
    <div className="h-full flex flex-col overflow-hidden space-y-6">
      {/* Create Budget Card */}
      <div className="flex-shrink-0 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 md:p-6 shadow-xl">
        <h3 className="text-lg font-bold text-zinc-100 mb-1 flex items-center gap-2">
          <Target size={18} className="text-indigo-400" /> Budget Architecture
        </h3>
        <p className="text-sm text-zinc-500 mb-5">
          Set spending limits per category. Exceeding triggers smart alerts.
        </p>
        <form onSubmit={handleSave} className="flex flex-col sm:flex-row gap-3">
          <input
            placeholder="Category (e.g. Food & Dining)"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition"
            required
          />
          <input
            type="number"
            placeholder="Budget Limit (₹)"
            value={lim}
            onChange={(e) => setLim(e.target.value)}
            className="w-full sm:w-36 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 font-mono text-sm focus:outline-none focus:border-indigo-500 transition"
            required
            min="1"
          />
          <button
            type="submit"
            disabled={isSaving || !cat || !lim}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSaving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : 'Set Budget'}
          </button>
        </form>
      </div>

      {/* Budget Cards */}
      {budgetEntries.length > 0 ? (
        <div className="flex-1 overflow-auto custom-scrollbar pb-6 pr-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {budgetEntries.map(([c, limit]) => {
            const spent = insights.categoryTotals[c] || 0;
            const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
            const isDanger = pct >= 100;
            const isWarn = pct > 85;
            const remaining = Math.max(0, limit - spent);
            const isBeingDeleted = deletingCategory === c;

            return (
              <div
                key={c}
                onClick={() => setSelectedBudget({ category: c, limit })}
                {...bindContextMenu([
                  { label: 'Edit Budget', icon: Edit2, onClick: () => { setCat(c); setLim(limit); window.scrollTo({ top: 0, behavior: 'smooth' }); } },
                  { label: 'More Info', icon: Info, onClick: () => setSelectedBudget({ category: c, limit }) },
                  { divider: true },
                  { label: 'Delete Budget', icon: Trash2, danger: true, onClick: (e) => handleDelete(e || { stopPropagation: () => {} }, c) }
                ])}
                className={`p-5 bg-zinc-900 rounded-2xl border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/80 transition cursor-pointer shadow-md relative group cursor-context-menu ${isBeingDeleted ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {/* Delete button */}
                <button
                  onClick={(e) => handleDelete(e, c)}
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="Delete budget"
                >
                  {isBeingDeleted ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>

                <div className="flex justify-between items-center mb-1 pr-8">
                  <span className="font-semibold text-zinc-200 text-sm">{c}</span>
                  {isDanger && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-400 bg-red-500/10 border border-red-500/30 px-2 py-0.5 rounded-full">
                      <AlertCircle size={10} /> Over
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-baseline mb-3">
                  <span className="font-mono text-lg font-bold text-zinc-100">{format(spent, preferredCurrency)}</span>
                  <span className="font-mono text-xs text-zinc-500">of {format(limit, preferredCurrency)}</span>
                </div>
                <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      isDanger ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
                        : isWarn ? 'bg-amber-400'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-[11px] text-zinc-500">{pct.toFixed(0)}% used</span>
                  <span className={`text-[11px] font-mono ${isDanger ? 'text-red-400' : 'text-zinc-500'}`}>
                    {isDanger ? `Over by ${format(spent - limit, preferredCurrency)}` : `${format(remaining, preferredCurrency)} left`}
                  </span>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
          <PieChart size={40} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-500 text-sm">No budgets set yet.</p>
          <p className="text-zinc-600 text-xs mt-1">Create a budget above to start tracking spending limits.</p>
        </div>
      )}

      {selectedBudget && (
        <BudgetDetailsModal
          category={selectedBudget.category}
          limit={selectedBudget.limit}
          transactions={transactions}
          globalRange={globalRange}
          onClose={() => setSelectedBudget(null)}
        />
      )}
    </div>
  );
}
