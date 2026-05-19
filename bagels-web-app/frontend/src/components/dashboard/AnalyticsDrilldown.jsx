import React, { useMemo, useState, useCallback } from 'react';
import {
  X, ChevronRight, ChevronLeft, TrendingUp, TrendingDown,
  Users, ArrowUpRight, ArrowDownRight, Calendar, Filter,
  Zap, Trash2, Tag, Clock, BarChart3, Loader2, Edit2,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, BarChart, Bar, Cell,
} from 'recharts';
import { fmt } from '../../utils/format';

const COLORS = ['#6366f1','#a855f7','#ec4899','#14b8a6','#f59e0b','#3b82f6','#ef4444','#10b981'];

function MiniTrend({ data }) {
  if (!data || data.length < 2) return null;
  return (
    <div style={{ width: '100%', height: 140 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -25, bottom: 0 }}>
          <defs>
            <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" vertical={false} />
          <XAxis dataKey="label" stroke="#3f3f46" fontSize={9} minTickGap={30} />
          <YAxis stroke="#3f3f46" fontSize={9} tickFormatter={v => `₹${v}`} />
          <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff', borderRadius: 10, fontSize: 11 }} formatter={v => fmt(v)} />
          <Area type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={2} fill="url(#dg)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function MerchantBars({ data }) {
  if (!data || !data.length) return null;
  return (
    <div style={{ width: '100%', height: Math.min(data.length * 32 + 20, 200) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.slice(0,6)} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
          <XAxis type="number" stroke="#3f3f46" fontSize={9} tickFormatter={v => `₹${v}`} />
          <YAxis type="category" dataKey="name" stroke="#3f3f46" fontSize={10} width={80} tick={{ fill: '#a1a1aa' }} />
          <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff', borderRadius: 10, fontSize: 11 }} formatter={v => fmt(v)} />
          <Bar dataKey="amount" radius={[0, 5, 5, 0]} animationDuration={600}>
            {data.slice(0,6).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function InsightCard({ icon: Icon, color, text }) {
  return (
    <div className="flex items-start gap-2.5 bg-zinc-900/40 border border-zinc-800/40 rounded-xl px-3 py-2">
      <Icon size={13} className={`${color} mt-0.5 flex-shrink-0`} />
      <p className="text-[11px] text-zinc-300 leading-relaxed">{text}</p>
    </div>
  );
}

function SummaryCard({ label, value, sub, accent }) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3">
      <p className="text-[9px] uppercase tracking-[0.12em] text-zinc-500 font-semibold">{label}</p>
      <p className={`text-base font-bold mt-0.5 font-mono ${accent || 'text-zinc-100'}`}>{value}</p>
      {sub && <p className="text-[9px] text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  CATEGORY MODE
// ══════════════════════════════════════════════════════════════════
function CategoryView({ category, transactions, allTransactions, totalExpense, categories, catIndex, onSwitch, onClose, onDelete, onUpdate }) {
  const [drillMerchant, setDrillMerchant] = useState(null);
  const [srcFilter, setSrcFilter] = useState('All');
  const [actionTxId, setActionTxId] = useState(null);
  const [editCat, setEditCat] = useState('');

  const txns = useMemo(() => {
    let f = transactions.filter(t => t.category === category && t.type === 'expense');
    if (srcFilter !== 'All') f = f.filter(t => t.source === srcFilter);
    if (drillMerchant) f = f.filter(t => t.payee === drillMerchant);
    return f.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, category, srcFilter, drillMerchant]);

  // ── Period comparison: compute this category's spend in the previous equivalent period
  const comparison = useMemo(() => {
    if (!allTransactions?.length) return null;
    const dates = transactions.filter(t => t.type === 'expense').map(t => new Date(t.date));
    if (!dates.length) return null;
    const minD = new Date(Math.min(...dates));
    const maxD = new Date(Math.max(...dates));
    const span = maxD - minD;
    if (span <= 0) return null;
    const prevStart = new Date(minD - span);
    const prevEnd = new Date(minD - 1);

    let prevAmount = 0;
    allTransactions.forEach(t => {
      if (t.type === 'expense' && t.category === category) {
        const d = new Date(t.date);
        if (d >= prevStart && d <= prevEnd) prevAmount += parseFloat(t.debit || t.amount);
      }
    });
    const currAmount = txns.reduce((s, t) => s + parseFloat(t.debit || t.amount), 0);
    if (prevAmount === 0) return null;
    const pct = ((currAmount - prevAmount) / prevAmount) * 100;
    return { prevAmount, pct };
  }, [allTransactions, transactions, txns, category]);

  const total = useMemo(() => txns.reduce((s, t) => s + parseFloat(t.debit || t.amount), 0), [txns]);
  const pct = totalExpense > 0 ? (total / totalExpense) * 100 : 0;

  const merchants = useMemo(() => {
    if (drillMerchant) return [];
    const m = {};
    txns.forEach(t => { const k = t.payee || 'Unknown'; if (!m[k]) m[k] = { name: k, amount: 0, count: 0 }; m[k].amount += parseFloat(t.debit || t.amount); m[k].count++; });
    return Object.values(m).sort((a, b) => b.amount - a.amount);
  }, [txns, drillMerchant]);

  const trend = useMemo(() => {
    const dm = {};
    txns.forEach(t => { if (!dm[t.date]) dm[t.date] = { label: t.date.slice(5), amount: 0 }; dm[t.date].amount += parseFloat(t.debit || t.amount); });
    return Object.values(dm).sort((a, b) => a.label.localeCompare(b.label));
  }, [txns]);

  // ── Smart insights computation
  const insights = useMemo(() => {
    const ins = [];
    // 1. Biggest contributor
    if (merchants.length > 0) {
      const top = merchants[0];
      const topPct = total > 0 ? ((top.amount / total) * 100).toFixed(0) : 0;
      ins.push({ icon: Users, color: 'text-indigo-400', text: `${top.name} is your #1 ${category} merchant — ${topPct}% of spend (${top.count} transactions)` });
    }
    // 2. Period comparison
    if (comparison) {
      const dir = comparison.pct > 0;
      ins.push({ icon: dir ? ArrowUpRight : ArrowDownRight, color: dir ? 'text-red-400' : 'text-emerald-400', text: `${category} spending ${dir ? 'up' : 'down'} ${Math.abs(comparison.pct).toFixed(0)}% vs previous period (was ${fmt(comparison.prevAmount)})` });
    }
    // 3. Frequency
    if (txns.length >= 2) {
      const dates = [...new Set(txns.map(t => t.date))];
      const avgGap = dates.length > 1 ? ((new Date(dates[0]) - new Date(dates[dates.length - 1])) / (dates.length - 1) / 86400000) : 0;
      if (avgGap > 0) {
        const freq = avgGap < 2 ? 'almost daily' : avgGap < 4 ? 'every few days' : avgGap < 8 ? 'weekly' : avgGap < 20 ? 'bi-weekly' : 'occasionally';
        ins.push({ icon: Clock, color: 'text-amber-400', text: `You spend on ${category} ${freq} — avg ${fmt(total / txns.length)} per transaction` });
      }
    }
    // 4. Concentration risk
    if (merchants.length >= 3) {
      const top2 = merchants.slice(0, 2).reduce((s, m) => s + m.amount, 0);
      const top2Pct = total > 0 ? (top2 / total) * 100 : 0;
      if (top2Pct > 70) {
        ins.push({ icon: Zap, color: 'text-orange-400', text: `${top2Pct.toFixed(0)}% of ${category} goes to just 2 merchants — consider diversifying` });
      }
    }
    return ins;
  }, [merchants, comparison, txns, total, category]);

  const sources = useMemo(() => { const s = new Set(); transactions.filter(t => t.category === category && t.type === 'expense').forEach(t => s.add(t.source)); return ['All', ...s]; }, [transactions, category]);

  const breadcrumb = drillMerchant
    ? [{ label: category, action: () => setDrillMerchant(null) }, { label: drillMerchant }]
    : [{ label: category }];

  const handleDelete = useCallback(async (txId) => {
    if (!onDelete) return;
    setActionTxId(txId);
    try { await onDelete(txId); } finally { setActionTxId(null); }
  }, [onDelete]);

  const handleRecategorize = useCallback(async (txId) => {
    if (!onUpdate || !editCat.trim()) return;
    setActionTxId(txId);
    try { await onUpdate(txId, { category: editCat.trim() }); setEditCat(''); } finally { setActionTxId(null); }
  }, [onUpdate, editCat]);

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800/60 flex-shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {categories.length > 1 && <button onClick={() => { setDrillMerchant(null); onSwitch(categories[catIndex <= 0 ? categories.length - 1 : catIndex - 1]); }} className="p-1 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition"><ChevronLeft size={15} /></button>}
          <div className="flex items-center gap-1 text-sm min-w-0">
            {breadcrumb.map((c, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight size={11} className="text-zinc-700" />}
                {c.action ? <button onClick={c.action} className="text-zinc-400 hover:text-zinc-100 transition truncate text-xs">{c.label}</button> : <span className="text-zinc-100 font-semibold truncate text-sm">{c.label}</span>}
              </React.Fragment>
            ))}
          </div>
          {categories.length > 1 && <button onClick={() => { setDrillMerchant(null); onSwitch(categories[catIndex >= categories.length - 1 ? 0 : catIndex + 1]); }} className="p-1 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition"><ChevronRight size={15} /></button>}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition"><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* ── 1. SUMMARY ────────────────── */}
        <div className="grid grid-cols-3 gap-2.5">
          <SummaryCard label="Total Spent" value={fmt(total)} sub={`${pct.toFixed(1)}% of expenses`} />
          <SummaryCard label="Transactions" value={txns.length} sub={drillMerchant || category} />
          <SummaryCard label="vs Prev Period" value={comparison ? `${comparison.pct > 0 ? '+' : ''}${comparison.pct.toFixed(0)}%` : '—'} sub={comparison ? fmt(comparison.prevAmount) + ' before' : 'Not enough data'} accent={comparison ? (comparison.pct > 0 ? 'text-red-400' : 'text-emerald-400') : undefined} />
        </div>

        {/* ── 2. SMART INSIGHTS ────────── */}
        {insights.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.15em] flex items-center gap-1"><Zap size={10} /> Insights</h4>
            {insights.map((ins, i) => <InsightCard key={i} {...ins} />)}
          </div>
        )}

        {/* ── 3. TREND ─────────────────── */}
        {trend.length >= 2 && (
          <div>
            <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.15em] mb-2 flex items-center gap-1"><TrendingUp size={10} /> Trend</h4>
            <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-xl p-2.5"><MiniTrend data={trend} /></div>
          </div>
        )}

        {/* ── 4. MERCHANT BREAKDOWN ────── */}
        {!drillMerchant && merchants.length > 0 && (
          <div>
            <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.15em] mb-2 flex items-center gap-1"><BarChart3 size={10} /> Breakdown</h4>
            <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-xl p-2.5 mb-2"><MerchantBars data={merchants} /></div>
            <div className="space-y-1">
              {merchants.slice(0, 6).map((m, i) => (
                <button key={m.name} onClick={() => setDrillMerchant(m.name)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-950/40 border border-zinc-800/30 hover:border-zinc-700 transition group text-left">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-xs text-zinc-300 flex-1 truncate group-hover:text-white">{m.name}</span>
                  <span className="text-[10px] text-zinc-600 font-mono">{m.count}x</span>
                  <span className="text-xs font-mono font-semibold text-zinc-300">{fmt(m.amount)}</span>
                  <ChevronRight size={11} className="text-zinc-700 group-hover:text-zinc-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── 5. FILTERS ───────────────── */}
        {sources.length > 2 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter size={10} className="text-zinc-600" />
            {sources.map(s => <button key={s} onClick={() => setSrcFilter(s)} className={`px-2 py-0.5 rounded text-[10px] font-medium border transition ${srcFilter === s ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}>{s}</button>)}
          </div>
        )}

        {/* ── 6. TRANSACTIONS (minimal) ── */}
        <div>
          <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.15em] mb-1.5">Transactions ({txns.length})</h4>
          {txns.length > 0 ? (
            <div className="space-y-0.5">
              {txns.slice(0, 20).map(tx => (
                <div key={tx.id || tx._id} className="group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-900/40 transition">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-zinc-300 truncate">{tx.payee}</p>
                    <p className="text-[9px] text-zinc-600">{tx.date}{tx.source !== 'manual' ? ` · ${tx.source}` : ''}</p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <p className="text-xs font-mono font-semibold text-red-400/90">-{fmt(tx.debit || tx.amount)}</p>
                    <p className="text-[9px] text-zinc-500 font-mono" title="Running Balance">Bal: {fmt(tx.balanceAfter)}</p>
                  </div>
                  {/* Actions */}
                  <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">
                    {onUpdate && (
                      <>
                        <button onClick={() => { const newCat = prompt('New category:', tx.category); if (newCat && newCat !== tx.category) onUpdate(tx.id || tx._id, { category: newCat }); }} className="p-1 rounded text-zinc-600 hover:text-indigo-400 hover:bg-indigo-500/10 transition" title="Recategorize"><Tag size={11} /></button>
                        <button onClick={() => { const newDesc = prompt('Edit description:', tx.payee || tx.description); if (newDesc && newDesc !== (tx.payee || tx.description)) onUpdate(tx.id || tx._id, { payee: newDesc, description: newDesc }); }} className="p-1 rounded text-zinc-600 hover:text-amber-400 hover:bg-amber-500/10 transition" title="Edit"><Edit2 size={11} /></button>
                      </>
                    )}
                    {onDelete && (
                      <button onClick={() => handleDelete(tx.id || tx._id)} disabled={actionTxId === (tx.id || tx._id)} className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-30" title="Delete">
                        {actionTxId === (tx.id || tx._id) ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {txns.length > 20 && <p className="text-center text-[10px] text-zinc-600 py-1">+{txns.length - 20} more</p>}
            </div>
          ) : <p className="text-center text-xs text-zinc-600 py-4">No transactions match.</p>}
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
//  DATE MODE
// ══════════════════════════════════════════════════════════════════
function DateView({ date, dateInfo, transactions, onClose, onCategoryClick, onDelete, onUpdate }) {
  const txns = useMemo(() => transactions.filter(t => t.date === date).sort((a, b) => parseFloat(b.debit || b.credit || 0) - parseFloat(a.debit || a.credit || 0)), [transactions, date]);
  const [actionTxId, setActionTxId] = useState(null);

  const summary = useMemo(() => {
    let exp = 0, inc = 0; const cats = {};
    txns.forEach(t => { 
      const debit = parseFloat(t.debit || 0); 
      const credit = parseFloat(t.credit || 0);
      if (debit > 0) { exp += debit; cats[t.category] = (cats[t.category] || 0) + debit; }
      if (credit > 0) inc += credit; 
    });
    return { exp, inc, cats: Object.entries(cats).sort(([,a],[,b]) => b - a), count: txns.length };
  }, [txns]);

  const zoomTrend = useMemo(() => {
    // 7-day zoom window ending on selected date
    const endD = new Date(date);
    const startD = new Date(endD);
    startD.setDate(endD.getDate() - 6);
    
    const dm = {};
    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split('T')[0];
      dm[ds] = { label: ds.slice(5), amount: 0 };
    }
    
    transactions.forEach(t => {
      const debit = parseFloat(t.debit || 0);
      if (debit > 0 && dm[t.date]) {
        dm[t.date].amount += debit;
      }
    });
    return Object.values(dm).sort((a, b) => a.label.localeCompare(b.label));
  }, [transactions, date]);

  const fmtDate = useMemo(() => { try { return new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); } catch { return date; } }, [date]);

  const handleDelete = useCallback(async (txId) => { if (!onDelete) return; setActionTxId(txId); try { await onDelete(txId); } finally { setActionTxId(null); } }, [onDelete]);

  return (
    <>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800/60 flex-shrink-0">
        <div className="flex items-center gap-2"><Calendar size={14} className="text-indigo-400" /><div><p className="text-sm font-semibold text-zinc-100">{fmtDate}</p><p className="text-[9px] text-zinc-600">Daily snapshot</p></div></div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition"><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div className="grid grid-cols-3 gap-2.5">
          <SummaryCard label="Spent" value={fmt(summary.exp)} accent="text-red-400" />
          <SummaryCard label="Earned" value={fmt(summary.inc)} accent="text-emerald-400" />
          <SummaryCard label="Entries" value={summary.count} />
        </div>

        {dateInfo?.anomaly && <InsightCard icon={ArrowUpRight} color="text-red-400" text="This day's spending was anomalously high vs your daily average." />}
        {summary.cats.length > 0 && <InsightCard icon={Zap} color="text-indigo-400" text={`Biggest spend: ${summary.cats[0][0]} at ${fmt(summary.cats[0][1])} (${summary.cats.length} categories)`} />}

        {zoomTrend.length > 0 && (
          <div>
            <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.15em] mb-2 flex items-center gap-1"><TrendingUp size={10} /> 7-Day Zoom View</h4>
            <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-xl p-2.5"><MiniTrend data={zoomTrend} /></div>
          </div>
        )}

        {summary.cats.length > 0 && (
          <div>
            <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.15em] mb-2">Category Breakdown</h4>
            <div className="space-y-1">
              {summary.cats.map(([cat, amt], i) => (
                <button key={cat} onClick={() => onCategoryClick(cat)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-950/40 border border-zinc-800/30 hover:border-zinc-700 transition group text-left">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-xs text-zinc-300 flex-1 truncate group-hover:text-white">{cat}</span>
                  <span className="text-xs font-mono font-semibold text-zinc-300">{fmt(amt)}</span>
                  <span className="text-[9px] text-zinc-600">{summary.exp > 0 ? ((amt/summary.exp)*100).toFixed(0) : 0}%</span>
                  <ChevronRight size={11} className="text-zinc-700 group-hover:text-zinc-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.15em] mb-1.5">Transactions ({txns.length})</h4>
          <div className="space-y-0.5">
            {txns.slice(0, 20).map(tx => (
              <div key={tx.id || tx._id} className="group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-900/40 transition">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-zinc-300 truncate">{tx.payee}</p>
                  <p className="text-[9px] text-zinc-600">{tx.category}{tx.source !== 'manual' ? ` · ${tx.source}` : ''}</p>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <p className={`text-xs font-mono font-semibold ${tx.credit > 0 ? 'text-emerald-400' : 'text-red-400/90'}`}>{tx.credit > 0 ? '+' : '-'}{fmt(tx.credit > 0 ? tx.credit : tx.debit)}</p>
                  <p className="text-[9px] text-zinc-500 font-mono" title="Running Balance">Bal: {fmt(tx.balanceAfter)}</p>
                </div>
                <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">
                  {onUpdate && (
                    <>
                      <button onClick={() => { const newCat = prompt('New category:', tx.category); if (newCat && newCat !== tx.category) onUpdate(tx.id || tx._id, { category: newCat }); }} className="p-1 rounded text-zinc-600 hover:text-indigo-400 hover:bg-indigo-500/10 transition" title="Recategorize"><Tag size={11} /></button>
                      <button onClick={() => { const newDesc = prompt('Edit description:', tx.payee || tx.description); if (newDesc && newDesc !== (tx.payee || tx.description)) onUpdate(tx.id || tx._id, { payee: newDesc, description: newDesc }); }} className="p-1 rounded text-zinc-600 hover:text-amber-400 hover:bg-amber-500/10 transition" title="Edit"><Edit2 size={11} /></button>
                    </>
                  )}
                  {onDelete && <button onClick={() => handleDelete(tx.id || tx._id)} disabled={actionTxId === (tx.id || tx._id)} className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-30"><Trash2 size={11} /></button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
//  MAIN EXPORT
// ══════════════════════════════════════════════════════════════════
export default function AnalyticsDrilldown({ mode, category, date, dateInfo, transactions, allTransactions, totalExpense, onClose, onSwitchCategory, onSwitchToCategory, categories, onDelete, onUpdate }) {
  const catIndex = (categories || []).indexOf(category);

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0b0b0d] border border-zinc-800/80 rounded-t-2xl sm:rounded-2xl w-full max-w-xl shadow-2xl animate-[slideUp_0.2s_ease-out] flex flex-col" style={{ maxHeight: '92vh' }} onClick={e => e.stopPropagation()}>
        {mode === 'date' ? (
          <DateView date={date} dateInfo={dateInfo} transactions={transactions} onClose={onClose} onCategoryClick={cat => onSwitchToCategory?.(cat)} onDelete={onDelete} onUpdate={onUpdate} />
        ) : (
          <CategoryView category={category} transactions={transactions} allTransactions={allTransactions} totalExpense={totalExpense} categories={categories || []} catIndex={catIndex} onSwitch={onSwitchCategory} onClose={onClose} onDelete={onDelete} onUpdate={onUpdate} />
        )}
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  );
}
