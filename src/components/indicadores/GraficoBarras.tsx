'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface Props {
  data: { nome: string; total: number }[];
  titulo: string;
  cor?: string;
}

const fmtTooltip = (value: unknown): string => {
  const num =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : 0;
  return `${(isNaN(num) ? 0 : num).toFixed(1)} kg`;
};

export default function GraficoBarras({
  data,
  titulo,
  cor = '#2563eb',
}: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
      <h3 className="text-lg font-semibold mb-3">📊 {titulo}</h3>
      {data.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          Sem dados no período selecionado
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="nome" width={120} />
            <Tooltip formatter={fmtTooltip as any} />
            <Bar dataKey="total" fill={cor} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
