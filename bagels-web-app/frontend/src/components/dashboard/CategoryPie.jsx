import React, { useState } from 'react';
import { PieChart as PieChartIcon, Filter, Layers } from 'lucide-react';
import { useContextMenu } from '../../context/ContextMenuContext';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
} from 'recharts';
import { fmt } from '../../utils/format';

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6', '#ef4444'];

export default function CategoryPie({ topCategories, onDrilldown, onFilterLedger }) {
  const pieData = (topCategories || []).map(([name, value]) => ({ name, value }));
  const [hoveredSlice, setHoveredSlice] = useState(null);
  const { bindContextMenu } = useContextMenu();

  if (pieData.length === 0) {
    return (
      <div className="w-full h-full flex flex-col">
        <h3 className="text-white text-sm font-semibold mb-4 flex items-center gap-2">
          <PieChartIcon size={18} className="text-indigo-400" /> Category Split
        </h3>
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 min-h-[200px]">
          <PieChartIcon size={40} className="opacity-30 mb-3" />
          <p className="text-sm">No category data available.</p>
          <p className="text-xs text-zinc-700 mt-1">Add transactions to see your spending breakdown.</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="w-full h-full flex flex-col cursor-context-menu"
      {...bindContextMenu([
        { label: hoveredSlice ? `View ${hoveredSlice.name} Breakdown` : 'View General Breakdown', icon: PieChartIcon, onClick: () => onDrilldown(hoveredSlice?.name || pieData[0]?.name) },
        { label: hoveredSlice ? `Filter Ledger by ${hoveredSlice.name}` : 'Filter Ledger', icon: Filter, onClick: () => onFilterLedger && onFilterLedger(hoveredSlice?.name || pieData[0]?.name) },
        { divider: true },
        { label: 'Compare Data', icon: Layers, onClick: () => onDrilldown(hoveredSlice?.name || pieData[0]?.name) }
      ])}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white text-sm font-semibold flex items-center gap-2">
          <PieChartIcon size={18} className="text-indigo-400" /> Category Split
        </h3>
        {onFilterLedger && pieData.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); onFilterLedger(pieData[0].name); }}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition"
            title="Filter Ledger by Top Category"
          >
            <Filter size={14} />
          </button>
        )}
      </div>
      <div className="flex-1 w-full" style={{ minHeight: '320px' }}>
        <ResponsiveContainer width="100%" height="100%" minHeight={320}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="85%"
              paddingAngle={4}
              dataKey="value"
              stroke="none"
              cursor="pointer"
              onClick={(data) => onDrilldown(data.name)}
              onMouseEnter={(data) => setHoveredSlice(data)}
              onMouseLeave={() => setHoveredSlice(null)}
            >
              {pieData.map((e, i) => (
                <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} className="hover:opacity-80 transition-opacity outline-none" />
              ))}
            </Pie>
            <Tooltip
              formatter={(val) => fmt(val)}
              contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff', borderRadius: '12px', fontSize: '13px' }}
            />
            <Legend
              verticalAlign="bottom"
              align="center"
              layout="horizontal"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '11px', color: '#a1a1aa', paddingTop: '12px' }}
              formatter={(value, entry) => (
                <span
                  className="text-zinc-300 ml-1 font-medium text-xs cursor-pointer hover:text-white transition"
                  onClick={(e) => { e.stopPropagation(); onDrilldown(value); }}
                >
                  {value} <span className="text-zinc-500 font-normal">({fmt(entry.payload.value)})</span>
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
