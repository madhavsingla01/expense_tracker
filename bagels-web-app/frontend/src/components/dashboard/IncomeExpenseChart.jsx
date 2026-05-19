import React, { useMemo, useState, useCallback } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell, ReferenceLine,
} from 'recharts';
import { fmt } from '../../utils/format';

// ═══════════════════════════════════════════════════════════
//  INTELLIGENT GROUPING ENGINE
// ═══════════════════════════════════════════════════════════

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function detectGrouping(transactions, globalRange) {
  if (!transactions?.length) return 'daily';

  let daySpan;
  if (globalRange?.start && globalRange?.end) {
    daySpan = (new Date(globalRange.end) - new Date(globalRange.start)) / 86400000;
  } else {
    const dates = transactions.map(t => new Date(t.date).getTime());
    daySpan = (Math.max(...dates) - Math.min(...dates)) / 86400000;
  }

  if (daySpan <= 31) return 'daily';
  if (daySpan <= 365) return 'monthly';
  return 'yearly';
}

function groupKey(dateStr, mode) {
  const d = new Date(dateStr);
  if (mode === 'daily') return dateStr;
  if (mode === 'monthly') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${d.getFullYear()}`;
}

function formatLabel(key, mode) {
  if (mode === 'daily') {
    const d = new Date(key);
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
  }
  if (mode === 'monthly') {
    const [y, m] = key.split('-');
    return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y.slice(2)}`;
  }
  return key; // yearly
}

function aggregateData(transactions, mode) {
  const buckets = {};

  transactions.forEach(t => {
    const key = groupKey(t.date, mode);
    if (!buckets[key]) {
      buckets[key] = { key, income: 0, expense: 0, count: 0 };
    }
    buckets[key].income += parseFloat(t.credit || 0);
    buckets[key].expense += parseFloat(t.debit || 0);
    buckets[key].count += 1;
  });

  return Object.values(buckets)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(b => ({
      ...b,
      label: formatLabel(b.key, mode),
      net: b.income - b.expense,
    }));
}

// ═══════════════════════════════════════════════════════════
//  CUSTOM TOOLTIP
// ═══════════════════════════════════════════════════════════

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const income = payload.find(p => p.dataKey === 'income')?.value || 0;
  const expense = payload.find(p => p.dataKey === 'expense')?.value || 0;
  const net = income - expense;

  return (
    <div className="bg-[#111113] border border-zinc-800 rounded-xl px-4 py-3 shadow-2xl min-w-[180px]">
      <p className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Income
          </span>
          <span className="text-xs font-mono font-semibold text-emerald-400">{fmt(income)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-red-400" /> Expense
          </span>
          <span className="text-xs font-mono font-semibold text-red-400">{fmt(expense)}</span>
        </div>
        <div className="border-t border-zinc-800 pt-1.5 flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-xs text-zinc-400">
            {net >= 0 ? <TrendingUp size={10} className="text-emerald-500" /> : <TrendingDown size={10} className="text-red-500" />}
            Net
          </span>
          <span className={`text-xs font-mono font-bold ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {net >= 0 ? '+' : ''}{fmt(net)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  CUSTOM LEGEND
// ═══════════════════════════════════════════════════════════

function ChartLegend() {
  return (
    <div className="flex items-center justify-center gap-5 mt-3">
      <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Income
      </span>
      <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
        <span className="w-2.5 h-2.5 rounded-sm bg-red-400" /> Expense
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  SUMMARY PILLS
// ═══════════════════════════════════════════════════════════

function SummaryPills({ data }) {
  const totals = useMemo(() => {
    let income = 0, expense = 0;
    data.forEach(d => { income += d.income; expense += d.expense; });
    return { income, expense, net: income - expense };
  }, [data]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
        <TrendingUp size={9} /> {fmt(totals.income)}
      </span>
      <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
        <TrendingDown size={9} /> {fmt(totals.expense)}
      </span>
      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
        totals.net >= 0
          ? 'bg-zinc-800 border-zinc-700 text-zinc-300'
          : 'bg-red-500/5 border-red-500/15 text-red-300'
      }`}>
        <Minus size={9} /> Net {fmt(totals.net)}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function IncomeExpenseChart({ transactions, globalRange, onBarClick }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const grouping = useMemo(
    () => detectGrouping(transactions, globalRange),
    [transactions, globalRange]
  );

  const chartData = useMemo(
    () => aggregateData(transactions || [], grouping),
    [transactions, grouping]
  );

  const groupLabel = grouping === 'daily' ? 'Daily' : grouping === 'monthly' ? 'Monthly' : 'Yearly';

  const handleBarClick = useCallback((data) => {
    if (!onBarClick || !data?.activePayload?.[0]) return;
    const payload = data.activePayload[0].payload;
    onBarClick({
      key: payload.key,
      label: payload.label,
      income: payload.income,
      expense: payload.expense,
      net: payload.net,
      count: payload.count,
      grouping,
    });
  }, [onBarClick, grouping]);

  // ── EMPTY STATE ──
  if (!chartData.length) {
    return (
      <div className="w-full h-full flex flex-col">
        <h3 className="text-white text-sm font-semibold mb-4 flex items-center gap-2">
          <BarChart3 size={16} className="text-zinc-500" /> Income vs Expense
        </h3>
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 min-h-[200px]">
          <BarChart3 size={40} className="opacity-20 mb-3" />
          <p className="text-sm">No data for this period.</p>
          <p className="text-xs text-zinc-700 mt-1">Add transactions or import a statement.</p>
        </div>
      </div>
    );
  }

  // Determine max for nice Y-axis
  const maxVal = Math.max(...chartData.map(d => Math.max(d.income, d.expense)), 1);
  const barSize = chartData.length <= 7 ? 18 : chartData.length <= 14 ? 12 : 8;

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
        <h3 className="text-white text-sm font-semibold flex items-center gap-2">
          <BarChart3 size={16} className="text-zinc-500" /> Income vs Expense
        </h3>
        <span className="text-[10px] text-zinc-500 bg-zinc-800/60 border border-zinc-800 rounded-full px-2 py-0.5 font-medium">
          {groupLabel}
        </span>
      </div>

      {/* Summary pills */}
      <div className="mb-3">
        <SummaryPills data={chartData} />
      </div>

      {/* Chart */}
      <div className="flex-1 w-full" style={{ minHeight: '260px' }}>
        <ResponsiveContainer width="100%" height="100%" minHeight={260}>
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 4, left: -8, bottom: 0 }}
            onClick={handleBarClick}
            barGap={2}
            barCategoryGap={chartData.length <= 7 ? '25%' : '15%'}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="#3f3f46"
              fontSize={10}
              tickMargin={8}
              minTickGap={20}
              axisLine={{ stroke: '#27272a' }}
              tickLine={false}
            />
            <YAxis
              stroke="#3f3f46"
              fontSize={10}
              tickFormatter={v => {
                if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
                if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
                return `₹${v}`;
              }}
              width={52}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: 'rgba(255,255,255,0.02)', radius: 6 }}
            />
            <ReferenceLine y={0} stroke="#27272a" />

            {/* Income bars */}
            <Bar
              dataKey="income"
              name="Income"
              radius={[4, 4, 0, 0]}
              maxBarSize={barSize}
              animationDuration={800}
              animationEasing="ease-out"
              onMouseEnter={(_, i) => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {chartData.map((_, i) => (
                <Cell
                  key={`inc-${i}`}
                  fill={hoveredIndex === i ? '#34d399' : '#10b981'}
                  opacity={hoveredIndex !== null && hoveredIndex !== i ? 0.4 : 1}
                  style={{ transition: 'opacity 0.2s, fill 0.2s' }}
                />
              ))}
            </Bar>

            {/* Expense bars */}
            <Bar
              dataKey="expense"
              name="Expense"
              radius={[4, 4, 0, 0]}
              maxBarSize={barSize}
              animationDuration={800}
              animationEasing="ease-out"
              animationBegin={100}
              onMouseEnter={(_, i) => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {chartData.map((_, i) => (
                <Cell
                  key={`exp-${i}`}
                  fill={hoveredIndex === i ? '#f87171' : '#ef4444'}
                  opacity={hoveredIndex !== null && hoveredIndex !== i ? 0.4 : 1}
                  style={{ transition: 'opacity 0.2s, fill 0.2s' }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <ChartLegend />
    </div>
  );
}
