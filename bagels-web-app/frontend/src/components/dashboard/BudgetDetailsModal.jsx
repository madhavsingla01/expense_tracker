import React, { useMemo } from 'react';
import { X, Activity, Store, Clock, AlertCircle } from 'lucide-react';
import { fmt } from '../../utils/format';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export default function BudgetDetailsModal({ category, limit, transactions, globalRange, onClose }) {
  const stats = useMemo(() => {
    const toDate = (value, endOfDay = false) => {
      if (!value) return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      if (endOfDay) date.setHours(23, 59, 59, 999);
      return date;
    };

    const resolveRange = () => {
      if (globalRange === 'ALL') {
        return { startDate: null, endDate: null, days: null };
      }

      if (globalRange && typeof globalRange === 'object') {
        const startDate = toDate(globalRange.start);
        const endDate = toDate(globalRange.end, true);
        const days = startDate && endDate
          ? Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)))
          : null;
        return { startDate, endDate, days };
      }

      const dayCount = Number.parseInt(globalRange, 10);
      if (Number.isFinite(dayCount)) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - dayCount);
        return { startDate, endDate: null, days: Math.max(1, dayCount) };
      }

      return { startDate: null, endDate: null, days: null };
    };

    const { startDate, endDate, days } = resolveRange();

    const filtered = transactions.filter(
      (t) => {
        const txDate = toDate(t.date);
        if (!txDate) return false;
        const inCategory = t.category === category && t.type === 'expense';
        const afterStart = !startDate || txDate >= startDate;
        const beforeEnd = !endDate || txDate <= endDate;
        return inCategory && afterStart && beforeEnd;
      }
    );

    let totalSpent = 0;
    const vendorMap = {};
    const dailyMap = {};

    filtered.forEach((t) => {
      const amt = parseFloat(t.debit || t.amount);
      totalSpent += amt;
      vendorMap[t.payee] = (vendorMap[t.payee] || 0) + amt;

      if (!dailyMap[t.date]) dailyMap[t.date] = 0;
      dailyMap[t.date] += amt;
    });

    const topVendors = Object.entries(vendorMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const trendData = Object.entries(dailyMap)
      .map(([date, expense]) => ({ date, expense }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const daysPassed = days || Math.max(1, trendData.length);
    const dailyAverage = totalSpent / daysPassed;

    const recentTxs = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

    return { totalSpent, topVendors, trendData, dailyAverage, recentTxs, txCount: filtered.length };
  }, [category, transactions, globalRange]);

  const pct = Math.min(100, (stats.totalSpent / limit) * 100);
  const isDanger = pct >= 100;
  const isWarn = pct > 85;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-8">
      <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-3xl p-6 w-full max-w-2xl max-h-full overflow-y-auto shadow-2xl animate-[scaleIn_0.2s_ease-out]">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[#FFFFFF]">{category}</h2>
            <p className="text-sm text-[#B0B0B0]">Budget Deep Dive</p>
          </div>
          <button onClick={onClose} className="p-2 bg-[#2A2A2A] rounded-full text-[#B0B0B0] hover:text-[#FFFFFF] transition">
            <X size={20} />
          </button>
        </div>

        {/* Health Bar */}
        <div className="bg-[#121212] p-5 rounded-2xl border border-[#2A2A2A] mb-6">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[#B0B0B0] uppercase tracking-wider text-xs font-semibold">Utilization</span>
            <span className="font-mono text-sm text-[#FFFFFF] font-bold">
              {fmt(stats.totalSpent)} <span className="opacity-50 text-[#7A7A7A]">/ {fmt(limit)}</span>
            </span>
          </div>
          <div className="h-4 bg-[#1E1E1E] rounded-full overflow-hidden border border-[#2A2A2A]">
            <div
              className={`h-full transition-all duration-1000 ${isDanger ? 'bg-[#EA4335]' : isWarn ? 'bg-[#FB8C00]' : 'bg-[#34A853]'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {isDanger && (
            <p className="text-xs text-[#EA4335] mt-3 font-medium flex items-center gap-1">
              <AlertCircle size={14} /> Limit severely exceeded
            </p>
          )}
        </div>

        {/* Bento Grid Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-[#121212] border border-[#2A2A2A] rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 text-[#4285F4] rounded-xl"><Clock size={20} /></div>
            <div>
              <p className="text-[10px] text-[#B0B0B0] uppercase tracking-wider font-semibold">Daily Avg</p>
              <p className="text-lg font-bold text-[#FFFFFF]">{fmt(stats.dailyAverage)}</p>
            </div>
          </div>
          <div className="bg-[#121212] border border-[#2A2A2A] rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 text-[#34A853] rounded-xl"><Activity size={20} /></div>
            <div>
              <p className="text-[10px] text-[#B0B0B0] uppercase tracking-wider font-semibold">Tx Count</p>
              <p className="text-lg font-bold text-[#FFFFFF]">{stats.txCount} <span className="text-[#7A7A7A] text-xs font-normal">entries</span></p>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-[#121212] border border-[#2A2A2A] rounded-2xl p-5 mb-6 h-64">
          <h3 className="text-sm font-semibold text-[#FFFFFF] mb-4 flex items-center gap-2">
            <Activity size={16} className="text-[#4285F4]" /> Spending Trend
          </h3>
          {stats.trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="80%">
              <LineChart data={stats.trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
                <XAxis dataKey="date" stroke="#7A7A7A" fontSize={10} tickMargin={10} />
                <YAxis stroke="#7A7A7A" fontSize={10} tickFormatter={(val) => `$${val}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1E1E1E', borderColor: '#2A2A2A', borderRadius: '12px', color: '#FFF' }}
                  formatter={(val) => fmt(val)}
                />
                <Line type="monotone" dataKey="expense" stroke="#4285F4" strokeWidth={3} dot={{ r: 4, fill: '#1E1E1E', stroke: '#4285F4', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-[#7A7A7A] text-sm">No recent data</div>
          )}
        </div>

        {/* Top Vendors & Recent */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-[#FFFFFF] mb-4 flex items-center gap-2">
              <Store size={16} className="text-[#34A853]" /> Top Merchants
            </h3>
            <div className="space-y-3">
              {stats.topVendors.length > 0 ? stats.topVendors.map(([vendor, amt], idx) => (
                <div key={idx} className="flex justify-between items-center bg-[#121212] border border-[#2A2A2A] p-3 rounded-xl">
                  <span className="text-sm font-medium text-[#E0E0E0] truncate max-w-[120px]">{vendor}</span>
                  <span className="text-sm font-bold font-mono text-[#FFFFFF]">{fmt(amt)}</span>
                </div>
              )) : (
                <p className="text-sm text-[#7A7A7A]">No data</p>
              )}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#FFFFFF] mb-4 flex items-center gap-2">
              <Clock size={16} className="text-[#FB8C00]" /> Recent Activity
            </h3>
            <div className="space-y-3">
              {stats.recentTxs.length > 0 ? stats.recentTxs.slice(0,3).map((tx, idx) => (
                <div key={idx} className="flex flex-col bg-[#121212] border border-[#2A2A2A] p-3 rounded-xl">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-[#E0E0E0] truncate max-w-[120px]">{tx.payee}</span>
                    <span className="text-sm font-bold font-mono text-[#FFFFFF]">{fmt(tx.debit || tx.amount)}</span>
                  </div>
                  <span className="text-[10px] text-[#7A7A7A] mt-1">{tx.date}</span>
                </div>
              )) : (
                <p className="text-sm text-[#7A7A7A]">No data</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
