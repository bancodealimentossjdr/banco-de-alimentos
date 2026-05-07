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
    <div className={`${color} rounded-lg shadow p-4 border border-gray-200`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">{label}</span>
        {emoji && <span className="text-2xl">{emoji}</span>}
      </div>
      <div className="mt-2">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {unit && <span className="text-sm text-gray-500 ml-1">{unit}</span>}
      </div>
    </div>
  );
}
