import React, { useState } from 'react';
import { Search, Terminal, FileSpreadsheet, ScanLine, Wallet, ArrowRightLeft, Eye, Trash2, Copy, Tag, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCurrency } from '../context/CurrencyContext';
import TransactionDetailsModal from '../components/ui/TransactionDetailsModal';
import { useContextMenu } from '../context/ContextMenuContext';

const SOURCE_ICONS = {
  manual: Terminal,
  scan: ScanLine,
  statement: FileSpreadsheet,
  upi_intent: Wallet,
  payment: ArrowRightLeft,
};

const SOURCE_COLORS = {
  manual: 'text-zinc-500',
  scan: 'text-teal-400',
  statement: 'text-blue-400',
  upi_intent: 'text-amber-400',
  payment: 'text-indigo-400',
};

function SourceBadge({ source }) {
  const Icon = SOURCE_ICONS[source] || Terminal;
  const color = SOURCE_COLORS[source] || 'text-zinc-500';

  return (
    <span className={`text-[10px] uppercase flex items-center gap-1 mt-0.5 ${color}`}>
      <Icon size={10} /> {source}
    </span>
  );
}

function MobileTransactionCard({ tx, onOpen, onDelete, onDuplicate, onFilter, onImportOpen, bindContextMenu }) {
  const txId = tx.id || tx._id;
  const isCredit = tx.credit > 0;
  const { preferredCurrency, format } = useCurrency();
  const txCurrency = tx.currency || 'INR';
  const showOriginal = txCurrency !== preferredCurrency;


  return (
    <article
      onClick={onOpen}
      {...bindContextMenu([
        { label: 'View / Edit Details', icon: Eye, onClick: onOpen },
        { label: 'Filter by Merchant', icon: Filter, onClick: () => onFilter({ search: tx.payee }) },
        { label: 'Filter by Category', icon: Filter, onClick: () => onFilter({ category: tx.category }) },
        { label: 'Duplicate Entry', icon: Copy, onClick: () => onDuplicate?.(txId) },
        { divider: true },
        { label: 'Delete', icon: Trash2, danger: true, onClick: () => onDelete?.(txId) },
      ])}
      className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 active:scale-[0.99] transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-100 truncate">{tx.payee}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono text-zinc-500">{tx.date}</span>
            <SourceBadge source={tx.source} />
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`font-mono text-sm font-bold ${isCredit ? 'text-emerald-400' : 'text-red-400'}`}>
            {isCredit ? '+' : '-'}{format(isCredit ? tx.credit : tx.debit, txCurrency)}
          </p>
          {showOriginal && (
            <p className="mt-0.5 text-[9px] font-mono text-zinc-500">
              Orig: {new Intl.NumberFormat('en-US', { style: 'currency', currency: txCurrency }).format(isCredit ? tx.credit : tx.debit)}
            </p>
          )}
          <p className="mt-1 text-[10px] font-mono text-zinc-500">{format(tx.balanceAfter, txCurrency)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
          <Tag size={12} className="mr-1 text-indigo-400" /> {tx.category}
        </span>
        <span className="rounded-lg bg-zinc-900 px-2 py-1 text-xs text-zinc-400">{tx.accountName || 'Main'}</span>
        {tx.importBatchId && (
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onImportOpen(); }}
            className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-xs text-blue-400"
          >
            imported
          </button>
        )}
      </div>
    </article>
  );
}

export default function LedgerPage({ transactions, filters, setFilters, onUpdate, onDelete, onDuplicate }) {
  const [selectedTx, setSelectedTx] = useState(null);
  const navigate = useNavigate();
  const { bindContextMenu } = useContextMenu();
  const { preferredCurrency, format } = useCurrency();
  const categories = Array.from(new Set(transactions.map((t) => t.category)));

  // Count by source for filter badges
  const sourceCounts = transactions.reduce((acc, t) => {
    acc[t.source] = (acc[t.source] || 0) + 1;
    return acc;
  }, {});

  const sourceFilter = filters.source || 'All';

  const filtered = transactions.filter((t) => {
    const s = filters.search.toLowerCase();
    const ms = t.payee.toLowerCase().includes(s) || 
               t.category.toLowerCase().includes(s) ||
               t.date.includes(s) ||
               (t.amount && t.amount.toString().includes(s)) ||
               (t.meta?.note && t.meta.note.toLowerCase().includes(s)) ||
               (t.meta?.location && t.meta.location.toLowerCase().includes(s)) ||
               (t.source && t.source.toLowerCase().includes(s));
               
    const mt = filters.type === 'All' ? true : 
               filters.type === 'Debit' ? t.debit > 0 : 
               filters.type === 'Credit' ? t.credit > 0 : true;
    const mc = filters.category === 'All' ? true : filters.category === t.category;
    const msrc = sourceFilter === 'All' ? true : sourceFilter === t.source;
    return ms && mt && mc && msrc;
  });

  // Group imported transactions by batchId for count display
  const importBatchCount = new Map();
  transactions.forEach((t) => {
    if (t.importBatchId) {
      importBatchCount.set(t.importBatchId, (importBatchCount.get(t.importBatchId) || 0) + 1);
    }
  });

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-6 shadow-xl h-full min-h-0 flex flex-col overflow-hidden w-full">
      <div className="flex flex-col gap-4 mb-6 flex-shrink-0">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by payee, category, date, amount, note..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-3">
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none cursor-pointer text-sm min-h-[46px]"
            >
              <option value="All">All Entries</option>
              <option value="Debit">Debit (Out)</option>
              <option value="Credit">Credit (In)</option>
            </select>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none cursor-pointer text-sm min-h-[46px]"
            >
              <option value="All">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setFilters({ ...filters, source: e.target.value })}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none cursor-pointer text-sm min-h-[46px]"
            >
              <option value="All">All Sources</option>
              {Object.entries(sourceCounts).map(([src, count]) => (
                <option key={src} value={src}>{src} ({count})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Active filter count */}
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>{filtered.length} transaction{filtered.length !== 1 ? 's' : ''}</span>
          {sourceFilter !== 'All' && (
            <button
              onClick={() => setFilters({ ...filters, source: 'All' })}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 transition"
            >
              Source: {sourceFilter} ×
            </button>
          )}
        </div>
      </div>

      <div className="md:hidden flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-3 pr-1">
        {filtered.length > 0 ? (
          filtered.map((tx) => (
            <MobileTransactionCard
              key={tx.id || tx._id}
              tx={tx}
              onOpen={() => setSelectedTx(tx)}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onImportOpen={() => navigate('/import')}
              onFilter={(nextFilters) => setFilters({ ...filters, ...nextFilters })}
              bindContextMenu={bindContextMenu}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-8 text-center text-sm text-zinc-500">
            No matching entries found.
          </div>
        )}
      </div>

      <div className="hidden md:block overflow-auto rounded-xl border border-zinc-800 flex-1 min-h-0 custom-scrollbar bg-zinc-900/50">
        <table className="w-full min-w-[880px] text-left relative">
          <thead className="sticky top-0 z-10 shadow-sm bg-zinc-950/95 backdrop-blur-sm">
            <tr className="text-zinc-500 text-xs uppercase tracking-wider">
              <th className="p-4 font-medium bg-zinc-950">Date</th>
              <th className="p-4 font-medium bg-zinc-950">Payee</th>
              <th className="p-4 font-medium bg-zinc-950">Category</th>
              <th className="p-4 font-medium bg-zinc-950">Account</th>
              <th className="p-4 font-medium text-right bg-zinc-950">Debit</th>
              <th className="p-4 font-medium text-right bg-zinc-950">Credit</th>
              <th className="p-4 font-medium text-right bg-zinc-950">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50 bg-zinc-900/50">
            {filtered.length > 0 ? (
              filtered.map((tx) => (
                <tr 
                  key={tx.id || tx._id} 
                  onClick={() => setSelectedTx(tx)} 
                  {...bindContextMenu([
                    { label: 'View / Edit Details', icon: Eye, onClick: () => setSelectedTx(tx) },
                    { label: 'Filter by Merchant', icon: Filter, onClick: () => setFilters({ ...filters, search: tx.payee }) },
                    { label: 'Filter by Category', icon: Filter, onClick: () => setFilters({ ...filters, category: tx.category }) },
                    { label: 'Duplicate Entry', icon: Copy, onClick: () => onDuplicate?.(tx.id || tx._id) },
                    { divider: true },
                    { label: 'Delete', icon: Trash2, danger: true, onClick: () => onDelete(tx.id || tx._id) }
                  ])}
                  className="hover:bg-zinc-800/50 transition cursor-pointer group"
                >
                  <td className="p-4 font-mono text-sm text-zinc-400">{tx.date}</td>
                  <td className="p-4 font-medium text-zinc-200">
                    <div className="flex flex-col">
                      <span>{tx.payee}</span>
                      <div className="flex items-center gap-2">
                        <SourceBadge source={tx.source} />
                        {tx.importBatchId && (
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate('/import'); }}
                            className="text-[10px] text-blue-400/70 hover:text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded transition"
                          >
                            imported
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center px-2 py-1 rounded bg-zinc-800 text-zinc-300 text-xs border border-zinc-700">
                      {tx.category}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-xs text-zinc-400 px-2 py-1 rounded bg-zinc-800/50">
                      {tx.accountName || 'Main'}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-right">
                    {tx.debit > 0 ? (
                      <div className="flex flex-col items-end">
                        <span className="text-red-400/90">{format(tx.debit, tx.currency || 'INR')}</span>
                        {tx.currency && tx.currency !== preferredCurrency && (
                          <span className="text-[10px] text-zinc-500">{new Intl.NumberFormat('en-US', { style: 'currency', currency: tx.currency }).format(tx.debit)}</span>
                        )}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="p-4 font-mono text-right">
                    {tx.credit > 0 ? (
                      <div className="flex flex-col items-end">
                        <span className="text-emerald-400">{format(tx.credit, tx.currency || 'INR')}</span>
                        {tx.currency && tx.currency !== preferredCurrency && (
                          <span className="text-[10px] text-zinc-500">{new Intl.NumberFormat('en-US', { style: 'currency', currency: tx.currency }).format(tx.credit)}</span>
                        )}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="p-4 font-mono text-right text-zinc-300 font-semibold">{format(tx.balanceAfter, tx.currency || 'INR')}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="p-12 text-center text-zinc-500">
                  No matching entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedTx && <TransactionDetailsModal transaction={selectedTx} onClose={() => setSelectedTx(null)} onUpdate={onUpdate} />}
    </div>
  );
}
