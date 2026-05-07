'use client';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#16a34a', '#2563eb', '#ea580c', '#9333ea', '#dc2626'];

interface Props {
  data: { nome: string; total: number }[];
  titulo: string;
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

const renderLabel = (props: any): string => {
  const nome = props?.nome ?? '';
  const total = typeof props?.total === 'number' ? props.total : 0;
  return `${nome} (${total.toFixed(0)}kg)`;
};

export default function GraficoPizza({ data, titulo }: Props) {
  const top5 = data.slice(0, 5);

  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
      <h3 className="text-lg font-semibold mb-3">🥧 {titulo}</h3>
      {top5.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          Sem dados no período selecionado
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={top5}
              dataKey="total"
              nameKey="nome"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={renderLabel}
            >
              {top5.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={fmtTooltip as any} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
