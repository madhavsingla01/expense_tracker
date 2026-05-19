import React from 'react';
import { Activity } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

export default function MiniChart({ title, data, dataKey, color }) {
  if (!data || data.length === 0) return null;
  return (
    <div className="mt-8 border-t border-zinc-800/50 pt-8">
      <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4 flex items-center justify-center gap-2">
        <Activity size={14} className={color.text} /> {title} Velocity
      </h4>
      <div className="h-24 w-full opacity-60">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color.hex} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color.hex} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color.hex}
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#gradient-${dataKey})`}
              isAnimationActive={true}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
