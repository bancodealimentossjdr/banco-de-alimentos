'use client';

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  emoji?: string;
  color?: string;
}

export default function KpiCard({
  label,
  value,
  unit,
  emoji,
  color = 'bg-white',
}: KpiCardProps) {
  return (
    <div
      className={`${color} rounded-lg shadow p-3 sm:p-4 border border-gray-200`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs sm:text-sm text-gray-600 leading-tight">
          {label}
        </span>
        {emoji && (
          <span className="text-xl sm:text-2xl flex-shrink-0">{emoji}</span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-1 flex-wrap">
        <span className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">
          {value}
        </span>
        {unit && (
          <span className="text-xs sm:text-sm text-gray-500">{unit}</span>
        )}
      </div>
    </div>
  );
}
