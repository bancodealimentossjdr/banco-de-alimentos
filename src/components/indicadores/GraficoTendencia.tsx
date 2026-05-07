'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface Props {
  data: {
    mes: string;
    doacoes: number;
    distribuicoes: number;
    colheita: number;
  }[];
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

export default function GraficoTendencia({ data }: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
      <h3 className="text-lg font-semibold mb-3">📈 Evolução Mensal (kg)</h3>
      {data.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          Sem dados no período selecionado
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mes" />
            <YAxis />
            <Tooltip formatter={fmtTooltip as any} />
            <Legend />
            <Line
              type="monotone"
              dataKey="doacoes"
              name="Doações"
              stroke="#16a34a"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="distribuicoes"
              name="Distribuições"
              stroke="#2563eb"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="colheita"
              name="Colheita"
              stroke="#ea580c"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
