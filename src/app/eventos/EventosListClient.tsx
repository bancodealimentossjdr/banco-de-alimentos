'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

type EventoStatus = 'RASCUNHO' | 'ATIVO' | 'ENCERRADO'

interface EventoListView {
  id: string
  nome: string
  descricao: string | null
  dataInicio: string
  dataFim: string | null
  status: EventoStatus
  integraEstoque: boolean
  counts: {
    recebimentos: number
    locais: number
    alimentos: number
  }
}

const STATUS_BADGE: Record<EventoStatus, { label: string; cls: string }> = {
  RASCUNHO: { label: '📝 Rascunho', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  ATIVO: { label: '🟢 Ativo', cls: 'bg-green-100 text-green-700 border-green-200' },
  ENCERRADO: { label: '⏹️ Encerrado', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
}

type Filtro = 'TODOS' | EventoStatus

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'ATIVO', label: '🟢 Ativos' },
  { id: 'RASCUNHO', label: '📝 Rascunhos' },
  { id: 'ENCERRADO', label: '⏹️ Encerrados' },
]

export default function EventosListClient({
  eventos,
  podeGerenciar,
}: {
  eventos: EventoListView[]
  podeGerenciar: boolean
}) {
  const [filtro, setFiltro] = useState<Filtro>('TODOS')
  const [busca, setBusca] = useState('')

  /** Formata 'YYYY-MM-DDTHH:mm:ss.sssZ' → 'DD/MM/YYYY' sem deslocamento de fuso */
  const formatDate = (date: string) => {
    const raw = date.includes('T') ? date.split('T')[0] : date
    const [year, month, day] = raw.split('-')
    if (!year || !month || !day) return '—'
    return `${day}/${month}/${year}`
  }

  const eventosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return eventos.filter((e) => {
      const passaStatus = filtro === 'TODOS' || e.status === filtro
      const passaBusca = termo === '' || e.nome.toLowerCase().includes(termo)
      return passaStatus && passaBusca
    })
  }, [eventos, filtro, busca])

  const filtroBtnCls = (id: Filtro) =>
    `px-3 py-1.5 text-sm font-medium rounded-lg transition whitespace-nowrap ${
      filtro === id ? 'bg-green-500 text-white' : 'text-gray-600 hover:bg-gray-100'
    }`

  return (
    <div>
      {/* ════════════ CABEÇALHO ════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">📅 Eventos</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {eventos.length}{' '}
            {eventos.length === 1 ? 'evento cadastrado' : 'eventos cadastrados'}
          </p>
        </div>

        {podeGerenciar && (
          <button
            disabled
            title="Função 'Novo evento' chega na próxima onda"
            className="bg-green-300 cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium shrink-0"
          >
            + Novo evento (em breve)
          </button>
        )}
      </div>

      {/* ════════════ FILTROS + BUSCA ════════════ */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              className={filtroBtnCls(f.id)}
              onClick={() => setFiltro(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="🔍 Buscar por nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400"
        />
      </div>

      {/* ════════════ LISTA ════════════ */}
      {eventosFiltrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-2">📅</p>
          <p>
            {eventos.length === 0
              ? 'Nenhum evento cadastrado ainda'
              : 'Nenhum evento encontrado para esse filtro'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {eventosFiltrados.map((e) => {
            const badge = STATUS_BADGE[e.status]
            return (
              <Link
                key={e.id}
                href={`/eventos/${e.id}`}
                className="group bg-white rounded-xl shadow-sm border p-4 hover:shadow-md hover:border-green-200 transition flex flex-col"
              >
                {/* Topo: nome + badge */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-gray-900 group-hover:text-green-700 transition min-w-0 truncate">
                    {e.nome}
                  </h3>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium border ${badge.cls}`}
                  >
                    {badge.label}
                  </span>
                </div>

                {/* Data */}
                <p className="text-sm text-gray-500">
                  {formatDate(e.dataInicio)}
                  {e.dataFim ? ` — ${formatDate(e.dataFim)}` : ''}
                </p>

                {/* Descrição */}
                {e.descricao && (
                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">{e.descricao}</p>
                )}

                {/* Rodapé: contadores */}
                <div className="mt-3 pt-3 border-t flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                  <span>📥 {e.counts.recebimentos} receb.</span>
                  <span>🏠 {e.counts.locais} locais</span>
                  <span>🥫 {e.counts.alimentos} alim.</span>
                  {e.integraEstoque && (
                    <span className="text-green-600 font-medium">📦 Integra estoque</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
