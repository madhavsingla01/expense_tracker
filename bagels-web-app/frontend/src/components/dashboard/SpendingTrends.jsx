import React from 'react';
import { Activity, BarChart3, Filter } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts';
import { fmt } from '../../utils/format';

const CustomDot = (props) => {
  const { cx, cy, payload } = props;
  if (!cx || !cy || !Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  if (payload.anomaly) {
    return <circle cx={cx} cy={cy} r={6} stroke="#ef4444" strokeWidth={3} fill="#09090b" className="animate-pulse" />;
  }
  return <circle cx={cx} cy={cy} r={4} stroke="#6366f1" strokeWidth={2} fill="#18181b" />;
};

export default function SpendingTrends({ trendData, onPointClick, onFilterLedger }) {
  if (!trendData || trendData.length === 0) {
    return (
      <div className="w-full h-full flex flex-col">
        <h3 className="text-white text-sm font-semibold mb-4 flex items-center gap-2">
          <Activity size={16} className="text-[#4285F4]" /> Daily Spending Trends
        </h3>
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 min-h-[200px]">
          <BarChart3 size={40} className="opacity-30 mb-3" />
          <p className="text-sm">No spending data for this period.</p>
          <p className="text-xs text-zinc-700 mt-1">Import a statement or add transactions to see trends.</p>
        </div>
      </div>
    );
  }

  const handleChartClick = (data) => {
    if (onPointClick && data?.activePayload?.[0]) {
      const payload = data.activePayload[0].payload;
      onPointClick({ date: payload.date, expense: payload.expense, income: payload.income });
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white text-sm font-semibold flex items-center gap-2">
          <Activity size={16} className="text-[#4285F4]" /> Daily Spending Trends
        </h3>
        {onFilterLedger && (
          <button
            onClick={(e) => { e.stopPropagation(); onFilterLedger(); }}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition"
            title="View Full Ledger"
          >
            <Filter size={14} />
          </button>
        )}
      </div>
      <div className="flex-1 w-full" style={{ minHeight: '280px' }}>
        <ResponsiveContainer width="100%" height="100%" minHeight={280}>
          <LineChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} onClick={handleChartClick}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis dataKey="date" stroke="#52525b" fontSize={11} tickMargin={10} minTickGap={40} />
            <YAxis stroke="#52525b" fontSize={11} tickFormatter={(value) => `₹${value}`} width={60} />
            <Tooltip
              cursor={{ stroke: '#3f3f46', strokeWidth: 1 }}
              contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff', borderRadius: '12px', fontSize: '13px' }}
              itemStyle={{ color: '#fff' }}
              formatter={(val) => fmt(val)}
            />
            <Line
              type="monotone"
              dataKey="expense"
              stroke="#6366f1"
              strokeWidth={3}
              dot={<CustomDot />}
              activeDot={{ r: 8, stroke: '#818cf8', strokeWidth: 2, cursor: 'pointer' }}
              animationDuration={1500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-zinc-500 mt-3 text-center italic">
        *Red dots indicate anomalous spending spikes relative to standard daily averages.
      </p>
    </div>
  );
}
