import React from 'react';
import { Calendar, PieChart as PieIcon, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { fmt } from '../../utils/format';

export default function InsightSummary({ insights }) {
  const isTrendUp = insights.trendPercentage > 0;
  const absTrend = Math.abs(insights.trendPercentage).toFixed(1);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl mb-6">
      <h3 className="text-zinc-100 font-medium mb-4 flex items-center gap-2">
        <Clock size={18} className="text-indigo-400" /> Current Month Intelligence
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Monthly Total */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <Calendar size={20} />
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">This Month</p>
            <p className="text-lg font-bold text-zinc-100">{fmt(insights.currentMonthExpense)}</p>
          </div>
        </div>

        {/* Top Category */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-fuchsia-500/10 text-fuchsia-400 rounded-lg">
            <PieIcon size={20} />
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Top Spend</p>
            <p className="text-lg font-bold text-zinc-100">
              {insights.topCategoryInfo ? insights.topCategoryInfo.name : 'N/A'}
            </p>
            {insights.topCategoryInfo && (
              <p className="text-[10px] text-zinc-500 mt-0.5">{fmt(insights.topCategoryInfo.amount)} ({insights.topCategoryInfo.percentage.toFixed(0)}%)</p>
            )}
          </div>
        </div>

        {/* Daily Average */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-lg">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Daily Average</p>
            <p className="text-lg font-bold text-zinc-100">{fmt(insights.dailyAverage)}<span className="text-xs text-zinc-500 font-normal ml-1">/ day</span></p>
          </div>
        </div>

        {/* Trend */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex items-center gap-4">
          <div className={`p-3 rounded-lg ${isTrendUp ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
            {isTrendUp ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">vs Last Month</p>
            <p className={`text-lg font-bold ${isTrendUp ? 'text-red-400' : 'text-emerald-400'}`}>
              {isTrendUp ? '+' : '-'}{absTrend}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
