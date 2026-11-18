'use client'

import Link from 'next/link'
import { useApi } from '@/hooks/useApi'
import { usePermissions } from '@/hooks/usePermissions'

type Fonte = 'legado' | 'app' | 'misto' | 'vazio'
interface Mes {
  mes: number
  doacaoKg: number
  colheitaKg: number
  distribuicaoKg: number
  fonte: Fonte
  parcial: boolean
}
interface ItemPend { id: string; date: string; nome: string }
interface Recent {
  id: string
  date: string
  items: { quantity: number; product: { name: string; unit: string } }[]
}
interface Agg { qtd: number; kg: number }
interface DashboardData {
  recentDonations: (Recent & { donor: { name: string } })[]
  recentDistributions: (Recent & { beneficiary: { name: string } })[]
  recentHarvests: (Recent & { producer: { name: string } })[]
  ano: number
  historico: Mes[]
  // 🛡️ Ausentes para visualizador (servidor não envia)
  pendencias?: {
    distribuicoes: { total: number; itens: ItemPend[] }
    paaRascunho: number | null
    termosSemNf: number | null
  }
  colheitasAgendadas?: { total: number; itens: ItemPend[] }
  // 📅 Só para visualizador
  resumo30d?: { doacoes: Agg; colheitas: Agg; distribuicoes: Agg }
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const kg = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg`

const formatDate = (date: string) => {
  const raw = date.includes('T') ? date.split('T')[0] : date
  const [y, m, d] = raw.split('-')
  return `${d}/${m}/${y}`
}

// 📅 Data de hoje no fuso de São Paulo
const hojeSP = () => {
  const agora = new Date()
  const semana = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long' }).format(agora)
  const data = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(agora)
  return { semana: semana.charAt(0).toUpperCase() + semana.slice(1), data }
}

const FONTE_LABEL: Record<Fonte, string> = {
  legado: '📜 planilha',
  app: '📱 app',
  misto: '📜+📱',
  vazio: '—',
}

// 🎨 Gradientes fixos (hex) — não dependem do Tailwind gerar classes
const ATALHOS = [
  { href: '/doacoes', label: 'Doação', icon: '📥', de: '#16a34a', ate: '#15803d', mod: 'doacoes' },
  { href: '/distribuicoes', label: 'Distribuição', icon: '📤', de: '#dc2626', ate: '#b91c1c', mod: 'distribuicoes' },
  { href: '/colheita-solidaria', label: 'Colheita', icon: '🌾', de: '#f59e0b', ate: '#d97706', mod: 'colheita-solidaria' },
  { href: '/paa', label: 'PAA', icon: '🌽', de: '#65a30d', ate: '#4d7c0f', mod: 'paa' },
] as const

export default function Home() {
  const { canEdit } = usePermissions()
  const { data, isLoading, error } = useApi<DashboardData>('/api/dashboard', {
    dedupingInterval: 30_000,
  })

  if (isLoading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <p className="text-sm text-gray-400">Carregando painel...</p>
      </div>
    )
  }

  if (error || !data) {
    return <p className="text-center text-red-600 py-16">Não foi possível carregar o painel.</p>
  }

  const hoje = hojeSP()

  const hist = data.historico ?? []
  const maxKg = Math.max(1, ...hist.flatMap((m) => [m.doacaoKg + m.colheitaKg, m.distribuicaoKg]))
  const totalEntrada = hist.reduce((s, m) => s + m.doacaoKg + m.colheitaKg, 0)
  const totalSaida = hist.reduce((s, m) => s + m.distribuicaoKg, 0)

  const p = data.pendencias
  const agenda = data.colheitasAgendadas
  const r30 = data.resumo30d
  const totalPend = p
    ? p.distribuicoes.total + (p.paaRascunho ?? 0) + (p.termosSemNf ?? 0)
    : 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">Painel de Controle</h2>
          <p className="text-gray-500 text-sm mt-0.5">Visão geral · {data.ano}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-gray-800">{hoje.semana}</p>
          <p className="text-xs md:text-sm text-gray-500">{hoje.data}</p>
        </div>
      </div>

      {/* ⚡ AÇÕES RÁPIDAS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ATALHOS
          .filter((a) => canEdit(a.mod))
          .map((a) => (
            <Link
              key={a.href}
              href={a.href}
              style={{ backgroundImage: `linear-gradient(to right, ${a.de}, ${a.ate})` }}
              className="rounded-xl shadow-sm p-4 text-white hover:shadow-md hover:brightness-110 transition active:scale-[0.98] flex items-center gap-3"
            >
              <span className="text-2xl">{a.icon}</span>
              <span className="font-bold text-sm md:text-base">+ {a.label}</span>
            </Link>
          ))}
      </div>

      {/* 📅 RESUMO 30 DIAS (visualizador) */}
      {r30 && (
        <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
          <h3 className="font-bold text-gray-900 mb-3">📅 Últimos 30 dias</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { t: '📥 Doações', a: r30.doacoes, cls: 'bg-green-50 border-green-100 text-green-700' },
              { t: '🌾 Colheitas', a: r30.colheitas, cls: 'bg-amber-50 border-amber-100 text-amber-700' },
              { t: '📤 Distribuições', a: r30.distribuicoes, cls: 'bg-red-50 border-red-100 text-red-600' },
            ].map((c) => (
              <div key={c.t} className={`rounded-lg border px-4 py-3 ${c.cls}`}>
                <p className="text-sm font-medium text-gray-700">{c.t}</p>
                <p className="text-2xl font-bold">{kg(c.a.kg)}</p>
                <p className="text-xs text-gray-500">{c.a.qtd} registro(s)</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ⏳ PENDÊNCIAS + 📅 AGENDA (demais roles) */}
      {p && agenda && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900">⏳ Pendências</h3>
              {totalPend > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                  {totalPend}
                </span>
              )}
            </div>

            {totalPend === 0 ? (
              <p className="text-sm text-emerald-700">✅ Nada pendente.</p>
            ) : (
              <div className="space-y-3">
                {p.distribuicoes.total > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1.5">
                      📤 {p.distribuicoes.total} distribuição(ões) sem comprovante
                    </p>
                    <div className="space-y-1.5">
                      {p.distribuicoes.itens.map((d) => (
                        <div key={d.id} className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-sm">
                          <span className="truncate text-gray-800">{d.nome}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-gray-500">{formatDate(d.date)}</span>
                            {canEdit('distribuicoes') && (
                              <Link
                                href={`/distribuicoes/${d.id}/finalizar`}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-2.5 py-1 rounded transition"
                              >
                                Finalizar
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {p.distribuicoes.total > p.distribuicoes.itens.length && (
                      <Link href="/distribuicoes" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                        Ver todas →
                      </Link>
                    )}
                  </div>
                )}

                {(p.paaRascunho ?? 0) > 0 && (
                  <Link href="/paa" className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-sm hover:bg-blue-100 transition">
                    <span>✍️ {p.paaRascunho} entrega(s) PAA aguardando assinatura</span>
                    <span className="text-blue-600">→</span>
                  </Link>
                )}

                {(p.termosSemNf ?? 0) > 0 && (
                  <Link href="/paa" className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-sm hover:bg-orange-100 transition">
                    <span>📄 {p.termosSemNf} termo(s) PAA sem nota fiscal</span>
                    <span className="text-orange-600">→</span>
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900">📅 Colheitas agendadas</h3>
              {agenda.total > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                  {agenda.total}
                </span>
              )}
            </div>
            {agenda.itens.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma colheita agendada.</p>
            ) : (
              <div className="space-y-1.5">
                {agenda.itens.map((h) => (
                  <Link
                    key={h.id}
                    href="/colheita-solidaria"
                    className="flex items-center justify-between gap-2 bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2 text-sm hover:bg-yellow-100 transition"
                  >
                    <span className="truncate text-gray-800">🚜 {h.nome}</span>
                    <span className="text-xs text-gray-500 shrink-0">{formatDate(h.date)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 📊 HISTÓRICO MENSAL */}
      <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-4">
          <div>
            <h3 className="font-bold text-gray-900">📊 Movimentação mensal · {data.ano}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Entrada = doações + colheitas realizadas · Saída = distribuições
            </p>
          </div>
          <div className="flex gap-4 text-sm">
            <span><span className="text-gray-500">Entrada:</span> <strong className="text-green-700">{kg(totalEntrada)}</strong></span>
            <span><span className="text-gray-500">Saída:</span> <strong className="text-red-600">{kg(totalSaida)}</strong></span>
          </div>
        </div>

        <div className="space-y-2">
          {hist.map((m) => {
            const entrada = m.doacaoKg + m.colheitaKg
            return (
              <div key={m.mes} className="grid grid-cols-[3rem_1fr] sm:grid-cols-[3rem_1fr_6rem] gap-2 items-center">
                <span className="text-xs font-medium text-gray-600">
                  {MESES[m.mes - 1]}
                  {m.parcial && <span className="text-amber-600">*</span>}
                </span>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden flex">
                      <div className="bg-green-500 h-full" style={{ width: `${(m.doacaoKg / maxKg) * 100}%` }} />
                      <div className="bg-amber-400 h-full" style={{ width: `${(m.colheitaKg / maxKg) * 100}%` }} />
                    </div>
                    <span className="text-xs text-gray-600 w-20 text-right shrink-0">{kg(entrada)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="bg-red-400 h-full" style={{ width: `${(m.distribuicaoKg / maxKg) * 100}%` }} />
                    </div>
                    <span className="text-xs text-gray-600 w-20 text-right shrink-0">{kg(m.distribuicaoKg)}</span>
                  </div>
                </div>
                <span className="hidden sm:block text-xs text-gray-400 text-right">{FONTE_LABEL[m.fonte]}</span>
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500" /> Doações</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400" /> Colheitas</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400" /> Distribuições</span>
          <span><span className="text-amber-600">*</span> mês em andamento (parcial)</span>
          <span>📜 planilha pré-app · 📱 registrado no app</span>
        </div>
      </div>

      {/* 🕘 ÚLTIMOS REGISTROS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { t: '📥 Últimas doações', rows: data.recentDonations.map((d) => ({ ...d, nome: d.donor.name })) },
          { t: '📤 Últimas distribuições', rows: data.recentDistributions.map((d) => ({ ...d, nome: d.beneficiary.name })) },
          { t: '🌱 Últimas colheitas', rows: data.recentHarvests.map((d) => ({ ...d, nome: d.producer.name })) },
        ].map((bloco) => (
          <div key={bloco.t} className="bg-white rounded-xl shadow-sm border p-4">
            <h3 className="font-bold text-gray-900 mb-3 text-sm">{bloco.t}</h3>
            {bloco.rows.length === 0 ? (
              <p className="text-gray-400 text-sm">Nenhum registro</p>
            ) : (
              <div className="space-y-2">
                {bloco.rows.map((r) => (
                  <div key={r.id} className="border-b pb-2 last:border-0 last:pb-0">
                    <div className="flex justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.nome}</p>
                      <span className="text-xs text-gray-400 shrink-0">{formatDate(r.date)}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {r.items.map((i) => `${i.product.name}: ${i.quantity}${i.product.unit}`).join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
