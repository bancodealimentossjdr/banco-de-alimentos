'use client'

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { EventoMetrics } from './EventoDetalheClient'

const CORES = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#14b8a6', '#ec4899', '#84cc16', '#f97316', '#6366f1',
]

const fmtKg = (n: number) =>
  `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`

const fmtDia = (iso: string) => {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export default function GraficosEvento({ metrics }: { metrics: EventoMetrics }) {
  const semDados = metrics.totalKg === 0

  if (semDados) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-4xl mb-2">📊</p>
        <p>Ainda não há recebimentos para gerar gráficos.</p>
      </div>
    )
  }

  // limita a pizza aos 8 maiores + "Outros"
  const tipoTop = metrics.kgPorTipo.slice(0, 8)
  const tipoResto = metrics.kgPorTipo.slice(8)
  const outrosKg = tipoResto.reduce((s, t) => s + t.kg, 0)
  const pizzaData =
    outrosKg > 0
      ? [...tipoTop, { tipo: 'Outros', kg: Math.round(outrosKg * 100) / 100 }]
      : tipoTop

  return (
    // 🔧 FIX overflow: w-full + min-w-0 no wrapper raiz impede o Recharts de empurrar a página
    <div className="w-full min-w-0 space-y-6">
      {/* 📊 Barras — kg por local */}
      <div className="w-full min-w-0 overflow-hidden bg-white rounded-xl shadow-sm border p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          📊 Quantidade recebida por local
        </h3>
        {/* 🔧 wrapper com largura explícita + overflow-hidden força o ResponsiveContainer a medir certo */}
        <div className="w-full min-w-0 overflow-hidden">
          <ResponsiveContainer width="100%" height={300} minWidth={0}>
            <BarChart data={metrics.kgPorLocal} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="nome" tick={{ fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => fmtKg(Number(v) || 0)} />
              <Bar dataKey="kg" name="Recebido" radius={[6, 6, 0, 0]} fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 📈 Linha — evolução diária */}
      <div className="w-full min-w-0 overflow-hidden bg-white rounded-xl shadow-sm border p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          📈 Evolução diária dos recebimentos
        </h3>
        <div className="w-full min-w-0 overflow-hidden">
          <ResponsiveContainer width="100%" height={300} minWidth={0}>
            <LineChart data={metrics.kgPorDia} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="dia" tickFormatter={fmtDia} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(v) => fmtKg(Number(v))}
                labelFormatter={(l) => `Dia ${fmtDia(String(l))}`}
              />
              <Line type="monotone" dataKey="kg" name="Recebido" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 🥧 Pizza — kg por tipo */}
      <div className="w-full min-w-0 overflow-hidden bg-white rounded-xl shadow-sm border p-4">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-gray-700">🥧 Distribuição por tipo</h3>
          <span className="text-[11px] text-gray-400 shrink-0">
            agrupado por catálogo
          </span>
        </div>
        <div className="w-full min-w-0 overflow-hidden">
          <ResponsiveContainer width="100%" height={320} minWidth={0}>
            <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <Pie
                data={pizzaData}
                dataKey="kg"
                nameKey="tipo"
                cx="50%"
                cy="50%"
                // 🔧 raio relativo (%) em vez de fixo (110px) → nunca estoura em telas estreitas
                outerRadius="70%"
                // 🔧 labels fora da pizza são o principal vilão do overflow no mobile → só %
                label={(p) => {
                  const { percent } = p as { percent?: number }
                  return `${((percent ?? 0) * 100).toFixed(0)}%`
                }}
                labelLine={false}
              >
                {pizzaData.map((_, i) => (
                  <Cell key={i} fill={CORES[i % CORES.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => fmtKg(Number(v))} />
              {/* 🔧 legend com wrap + fonte menor não empurra largura */}
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
