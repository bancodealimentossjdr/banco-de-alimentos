// src/components/indicadores/GraficoBarras.tsx
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

export interface SerieBarra {
  key: string;
  nome: string;
  cor: string;
}

interface Props {
  data: Record<string, unknown>[];
  titulo: string;
  cor?: string;
  /** 🌾 23.7d — quando informado, renderiza barras EMPILHADAS por origem. */
  series?: SerieBarra[];
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
  series,
}: Props) {
  const empilhado = !!series?.length;

  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
      <h3 className="text-lg font-semibold mb-3">📊 {titulo}</h3>
      {data.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          Sem dados no período selecionado
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={empilhado ? 360 : 320}>
          <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="nome" width={120} />
            <Tooltip formatter={fmtTooltip as never} />
            {empilhado ? (
              <>
                <Legend verticalAlign="bottom" height={28} />
                {series!.map((s, i) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.nome}
                    stackId="origem"
                    fill={s.cor}
                    radius={
                      i === series!.length - 1 ? [0, 4, 4, 0] : undefined
                    }
                  />
                ))}
              </>
            ) : (
              <Bar dataKey="total" fill={cor} radius={[0, 4, 4, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
