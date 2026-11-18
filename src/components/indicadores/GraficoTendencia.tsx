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

/* 🙈 Oculto temporariamente (decisão do Vitor). NÃO remover:
 *    o cálculo segue na API. Para reexibir, troque para true. */
const MOSTRAR_APROVEITADO_TOTAL = false;

export interface SeriePoint {
  bucket: string;
  label: string;
  donationsKg: number;
  harvestKg: number;
  approvedKg: number;
  approvedTotalKg: number;
  distributedKg: number;
  lossKg: number;
  paaKg?: number;
  /* 📜 mês com volume vindo da planilha */
  planilha?: boolean;
}

export interface SerieData {
  granularity: 'day' | 'week' | 'month';
  hasEntityFilter: boolean;
  points: SeriePoint[];
  mesesPlanilha?: string[];
}

interface Props {
  data: SerieData | null;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const fmtMes = (k: string) => `${MESES[Number(k.slice(5, 7)) - 1]}/${k.slice(0, 4)}`;

const fmtTooltip = (value: unknown): string => {
  const num =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0;
  return `${(isNaN(num) ? 0 : num).toFixed(1)} kg`;
};

const tituloPorGranularidade = (g?: 'day' | 'week' | 'month'): string => {
  if (g === 'day') return '📊 Evolução Diária (kg)';
  if (g === 'week') return '📊 Evolução Semanal (kg)';
  if (g === 'month') return '📊 Evolução Mensal (kg)';
  return '📊 Evolução (kg)';
};

export default function GraficoTendencia({ data }: Props) {
  const points = (data?.points ?? []).map((p) => ({
    ...p,
    label: p.planilha ? `${p.label} 📜` : p.label,
  }));
  const titulo = tituloPorGranularidade(data?.granularity);
  const isDaily = data?.granularity === 'day';
  const rotateLabels = isDaily && points.length > 12;
  const temPaa = points.some((p) => (p.paaKg ?? 0) > 0);
  const mesesPlanilha = data?.mesesPlanilha ?? [];

  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">{titulo}</h3>
        {data?.granularity && points.length > 0 && (
          <span className="text-xs text-gray-400">
            {points.length}{' '}
            {data.granularity === 'day' ? 'dias' : data.granularity === 'week' ? 'semanas' : 'meses'}
          </span>
        )}
      </div>

      {mesesPlanilha.length > 0 && !data?.hasEntityFilter && (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          🟡 📜 Inclui o <strong>mês completo</strong> da planilha:{' '}
          {mesesPlanilha.map(fmtMes).join(', ')}. Esses meses entram nos totais,
          mas ficam fora do Aproveitamento % e da perda.
        </div>
      )}

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
            <Tooltip formatter={fmtTooltip as never} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
            <Legend />
            <Bar dataKey="harvestKg" name="Colheita" fill="#ea580c" radius={[2, 2, 0, 0]} maxBarSize={14} />
            {temPaa && (
              <Bar dataKey="paaKg" name="PAA" fill="#ca8a04" radius={[2, 2, 0, 0]} maxBarSize={14} />
            )}
            <Bar dataKey="distributedKg" name="Distribuído" fill="#2563eb" radius={[2, 2, 0, 0]} maxBarSize={14} />
            <Bar dataKey="donationsKg" name="Doações" fill="#86efac" radius={[2, 2, 0, 0]} maxBarSize={14} />
            {MOSTRAR_APROVEITADO_TOTAL && (
              <Bar dataKey="approvedTotalKg" name="Aproveitado total" fill="#15803d" radius={[2, 2, 0, 0]} maxBarSize={14} />
            )}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
