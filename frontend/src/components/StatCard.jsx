import React from 'react';

export default function StatCard({ title, value, unit, subtitle, icon: Icon, color = 'blue' }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
  };

  const badgeClass = colorMap[color] || 'bg-zinc-100 text-zinc-600 border-zinc-200';

  return (
    <div className="bg-white rounded-lg p-4 border border-zinc-200 shadow-2xs flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-zinc-600">{title}</p>
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span className="text-2xl font-bold tracking-tight text-zinc-900">{value}</span>
          {unit && <span className="text-xs font-medium text-zinc-600">{unit}</span>}
        </div>
        {subtitle && <p className="mt-1 text-xs text-zinc-600">{subtitle}</p>}
      </div>
      {Icon && (
        <div className={`w-8 h-8 rounded-md flex items-center justify-center border ${badgeClass}`}>
          <Icon className="w-4 h-4" />
        </div>
      )}
    </div>
  );
}
