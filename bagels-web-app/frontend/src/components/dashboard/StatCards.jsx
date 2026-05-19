import React from 'react';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { fmt } from '../../utils/format';

export default function StatCards({ insights, globalRange }) {
  const getOutflowLabel = () => {
    if (globalRange === '7') return '7-Day Outflow';
    if (globalRange === '30') return '30-Day Outflow';
    return 'Period Outflow';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 text-emerald-500"><TrendingUp size={64} /></div>
        <h3 className="text-zinc-400 text-sm font-semibold uppercase tracking-wider relative z-10">Period Inflow</h3>
        <p className="text-3xl font-bold font-mono text-emerald-400 relative z-10">{fmt(insights.income)}</p>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 text-red-500"><TrendingDown size={64} /></div>
        <h3 className="text-zinc-400 text-sm font-semibold uppercase tracking-wider relative z-10">{getOutflowLabel()}</h3>
        <p className="text-3xl font-bold font-mono text-zinc-100 relative z-10">{fmt(insights.expense)}</p>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 text-indigo-500"><Wallet size={64} /></div>
        <h3 className="text-zinc-400 text-sm font-semibold uppercase tracking-wider relative z-10">Lifetime Balance</h3>
        <p className="text-3xl font-bold font-mono text-zinc-100 relative z-10">{fmt(insights.balance)}</p>
      </div>
    </div>
  );
}
