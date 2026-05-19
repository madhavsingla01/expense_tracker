import React from 'react';
import { LayoutDashboard } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { fmt } from '../../utils/format';

export default function IncomeExpenseBar({ compareData }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl w-full">
      <h3 className="text-zinc-100 font-medium mb-6 flex items-center gap-2">
        <LayoutDashboard size={18} className="text-emerald-400" /> Income vs. Expense Comparison
      </h3>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={compareData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis dataKey="name" stroke="#52525b" fontSize={12} tickMargin={10} />
            <YAxis stroke="#52525b" fontSize={12} tickFormatter={(value) => `$${value}`} />
            <Tooltip
              cursor={{ fill: '#27272a', opacity: 0.4 }}
              contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }}
              formatter={(val) => fmt(val)}
            />
            <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
            <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} animationDuration={1500} />
            <Bar dataKey="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} animationDuration={1500} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
