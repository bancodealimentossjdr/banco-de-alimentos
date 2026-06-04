'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

/* ------------------------------------------------------------------ */
/* Contrato da SÉRIE (?serie=true)                                     */
/* ------------------------------------------------------------------ */

export interface SeriePoint {
  bucket: string;
  label: string;
  donationsKg: number;
  harvestKg: number;
  approvedKg: number;
  approvedTotalKg: number;
  distributedKg: number;
  lossKg: number;
}

export interface SerieData {
  granularity: 'day' | 'week' | 'month';
  hasEntityFilter: boolean;
  points: SeriePoint[];
}

interface Props {
  data: SerieData | null;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const fmtTooltip = (value: unknown): string => {
  const num =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : 0;
  return `${(isNaN(num) ? 0 : num).toFixed(1)} kg`;
};

const tituloPorGranularidade = (g?: 'day' | 'week' | 'month'): string => {
  if (g === 'day') return '📊 Evolução Diária (kg)';
  if (g === 'week') return '📊 Evolução Semanal (kg)';
  if (g === 'month') return '📊 Evolução Mensal (kg)';
  return '📊 Evolução (kg)';
};

/* ------------------------------------------------------------------ */
/* Componente                                                          */
/* ------------------------------------------------------------------ */

export default function GraficoTendencia({ data }: Props) {
  const points = data?.points ?? [];
  const titulo = tituloPorGranularidade(data?.granularity);
  const isDaily = data?.granularity === 'day';

  // 🔁 com muitos buckets diários, gira os labels pra não amassar
  const rotateLabels = isDaily && points.length > 12;

  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">{titulo}</h3>
        {data?.granularity && points.length > 0 && (
          <span className="text-xs text-gray-400">
            {points.length}{' '}
            {data.granularity === 'day'
              ? 'dias'
              : data.granularity === 'week'
                ? 'semanas'
                : 'meses'}
          </span>
        )}
      </div>

      {data?.hasEntityFilter ? (
        <div className="text-center py-12 text-gray-400">
          A evolução de aproveitamento não se aplica a filtros por
          doador/produtor/instituição/funcionário.
        </div>
      ) : points.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          Sem dados no período selecionado
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={rotateLabels ? 360 : 320}>
          <BarChart
            data={points}
            barCategoryGap="25%"
            barGap={2}
            margin={{ top: 8, right: 8, left: 0, bottom: rotateLabels ? 20 : 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              interval={isDaily && points.length > 20 ? 1 : 0}
              angle={rotateLabels ? -45 : 0}
              textAnchor={rotateLabels ? 'end' : 'middle'}
              height={rotateLabels ? 50 : 30}
              tick={{ fontSize: 12 }}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={fmtTooltip as never}
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            />
            <Legend />

            {/* 🌾 Colheita */}
            <Bar
              dataKey="harvestKg"
              name="Colheita"
              fill="#ea580c"
              radius={[2, 2, 0, 0]}
              maxBarSize={14}
            />

            {/* 📤 Distribuído */}
            <Bar
              dataKey="distributedKg"
              name="Distribuído"
              fill="#2563eb"
              radius={[2, 2, 0, 0]}
              maxBarSize={14}
            />

            {/* 🏪 Doações */}
            <Bar
              dataKey="donationsKg"
              name="Doações"
              fill="#86efac"
              radius={[2, 2, 0, 0]}
              maxBarSize={14}
            />

            {/* ✅ Aproveitado total — protagonista (verde escuro) */}
            <Bar
              dataKey="approvedTotalKg"
              name="Aproveitado total"
              fill="#15803d"
              radius={[2, 2, 0, 0]}
              maxBarSize={14}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
