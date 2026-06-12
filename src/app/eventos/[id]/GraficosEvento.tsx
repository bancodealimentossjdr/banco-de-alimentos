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
    <div className="space-y-6">
      {/* 📊 Barras — kg por local */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          📊 Quantidade recebida por local
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={metrics.kgPorLocal} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="nome" tick={{ fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => fmtKg(v)} />
            <Bar dataKey="kg" name="Recebido" radius={[6, 6, 0, 0]} fill="#22c55e" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 📈 Linha — evolução diária */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          📈 Evolução diária dos recebimentos
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={metrics.kgPorDia} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="dia" tickFormatter={fmtDia} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(v: number) => fmtKg(v)}
              labelFormatter={(l: string) => `Dia ${fmtDia(l)}`}
            />
            <Line type="monotone" dataKey="kg" name="Recebido" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 🥧 Pizza — kg por tipo (texto livre até a 17.4) */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">🥧 Distribuição por tipo</h3>
          <span className="text-[11px] text-gray-400">
            agrupado por descrição (catálogo na Onda 17.4)
          </span>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={pizzaData}
              dataKey="kg"
              nameKey="tipo"
              cx="50%"
              cy="50%"
              outerRadius={110}
              label={({ tipo, percent }) =>
                `${tipo} (${((percent ?? 0) * 100).toFixed(0)}%)`
              }
              labelLine={false}
            >
              {pizzaData.map((_, i) => (
                <Cell key={i} fill={CORES[i % CORES.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => fmtKg(v)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
