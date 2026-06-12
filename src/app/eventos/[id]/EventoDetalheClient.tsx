'use client'

import { useState } from 'react'
import Link from 'next/link'
import GraficosEvento from './GraficosEvento'
import ExportarEventoPdf from './ExportarEventoPdf'

type EventoStatus = 'RASCUNHO' | 'ATIVO' | 'ENCERRADO'

// 🆕 17.3 — rótulos legíveis do enum MotivoRefugo (espelha o PDF)
const MOTIVO_LABEL: Record<string, string> = {
  VALIDADE_VENCIDA: 'Validade vencida',
  EMBALAGEM_VIOLADA: 'Embalagem violada',
  AVARIA: 'Avaria',
  CONTAMINACAO: 'Contaminação',
  OUTRO: 'Outro',
}

interface LocalView {
  id: string
  nome: string
  endereco: string | null
  recebimentos: number
}
// 🆕 17.3 — alimento serializado pela page.tsx
interface AlimentoView {
  id: string
  nome: string
  ordem: number
  refugoKg: number
  motivoRefugo: string | null
  obsRefugo: string | null
  recebimentos: number
}
interface OperadorView {
  id: string
  ativo: boolean
  userId: string
  nome: string | null
  email: string
  role: string
}
export interface EventoMetrics {
  totalKg: number
  totalRefugoKg: number
  totalLiquidoKg: number
  kgPorLocal: { nome: string; kg: number }[]
  kgPorTipo: { tipo: string; kg: number }[]
  kgPorDia: { dia: string; kg: number }[]
}
interface EventoView {
  id: string
  nome: string
  descricao: string | null
  dataInicio: string
  dataFim: string | null
  status: EventoStatus
  integraEstoque: boolean
  encerradoEm: string | null
  encerradoPor: { id: string; name: string } | null
  criadoPor: { id: string; name: string } | null
  locais: LocalView[]
  alimentos: AlimentoView[] // 🆕 17.3
  operadores: OperadorView[]
  counts: { recebimentos: number; locais: number; operadores: number; alimentos: number } // 🆕 17.3
  metrics: EventoMetrics
}

const STATUS_BADGE: Record<EventoStatus, { label: string; cls: string }> = {
  RASCUNHO: { label: '📝 Rascunho', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  ATIVO: { label: '🟢 Ativo', cls: 'bg-green-100 text-green-700 border-green-200' },
  ENCERRADO: { label: '⏹️ Encerrado', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
}

// 🔐 Aba "operadores" só existe na lista se for admin
type Aba = 'resumo' | 'graficos' | 'locais' | 'alimentos' | 'operadores'

export default function EventoDetalheClient({
  evento,
  podeGerenciar,
  podeRegistrar,
  isAdmin,
}: {
  evento: EventoView
  podeGerenciar: boolean
  podeRegistrar: boolean
  isAdmin: boolean
}) {
  const [aba, setAba] = useState<Aba>('resumo')
  const badge = STATUS_BADGE[evento.status]

  const formatDate = (date: string) => {
    const raw = date.includes('T') ? date.split('T')[0] : date
    const [year, month, day] = raw.split('-')
    return `${day}/${month}/${year}`
  }

  const fmtKg = (n: number) =>
    `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`

  // 🆕 17.3 — tradução do motivo de refugo (defensivo p/ enums futuros)
  const motivoLabel = (m: string | null) =>
    m ? MOTIVO_LABEL[m] ?? m : null

  const tabBtn = (id: Aba) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition whitespace-nowrap ${
      aba === id ? 'bg-green-500 text-white' : 'text-gray-600 hover:bg-gray-100'
    }`

  // 🆕 17.3 — alimentos ordenados (defensivo)
  const alimentosOrdenados = [...evento.alimentos].sort((a, b) => a.ordem - b.ordem)

  return (
    <div>
      {/* 🔙 Voltar */}
      <Link
        href="/eventos"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        ← Voltar para eventos
      </Link>

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">{evento.nome}</h2>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${badge.cls}`}>
              {badge.label}
            </span>
            {evento.integraEstoque && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-600 border border-green-100">
                📦 Integra estoque
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {formatDate(evento.dataInicio)}
            {evento.dataFim ? ` — ${formatDate(evento.dataFim)}` : ''}
          </p>
        </div>

        {/* 📄 Exportação (PDF mascarado p/ todos; admin pode sem censura) */}
        <ExportarEventoPdf eventoId={evento.id} isAdmin={isAdmin} />
      </div>

      {/* 🗂️ Abas */}
      <div className="flex gap-2 mb-6 border-b pb-3 overflow-x-auto">
        <button className={tabBtn('resumo')} onClick={() => setAba('resumo')}>
          📋 Resumo
        </button>
        <button className={tabBtn('graficos')} onClick={() => setAba('graficos')}>
          📊 Gráficos
        </button>
        <button className={tabBtn('locais')} onClick={() => setAba('locais')}>
          🏠 Locais ({evento.counts.locais})
        </button>
        {/* 🆕 17.3 — Aba Alimentos (todos veem) */}
        <button className={tabBtn('alimentos')} onClick={() => setAba('alimentos')}>
          🥫 Alimentos ({evento.counts.alimentos})
        </button>
        {/* 🔐 Aba Operadores: SÓ admin */}
        {isAdmin && (
          <button className={tabBtn('operadores')} onClick={() => setAba('operadores')}>
            👥 Operadores ({evento.counts.operadores})
          </button>
        )}
      </div>

      {/* ════════════ ABA: RESUMO ════════════ */}
      {aba === 'resumo' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <p className="text-xs text-gray-500">Total recebido</p>
              <p className="text-2xl font-bold text-gray-900">{fmtKg(evento.metrics.totalKg)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <p className="text-xs text-gray-500">Líquido (s/ refugo)</p>
              <p className="text-2xl font-bold text-green-700">
                {fmtKg(evento.metrics.totalLiquidoKg)}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <p className="text-xs text-gray-500">Refugo</p>
              <p className="text-2xl font-bold text-amber-600">
                {fmtKg(evento.metrics.totalRefugoKg)}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <p className="text-xs text-gray-500">Recebimentos</p>
              <p className="text-2xl font-bold text-gray-900">{evento.counts.recebimentos}</p>
            </div>
          </div>

          {evento.descricao && (
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <p className="text-xs font-medium text-gray-500 mb-1">Descrição</p>
              <p className="text-sm text-gray-700">{evento.descricao}</p>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border p-4 text-sm text-gray-500 space-y-1">
            {evento.criadoPor && <p>Criado por {evento.criadoPor.name}</p>}
            {evento.status === 'ENCERRADO' && evento.encerradoPor && evento.encerradoEm && (
              <p>
                Encerrado por {evento.encerradoPor.name} em {formatDate(evento.encerradoEm)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ════════════ ABA: GRÁFICOS ════════════ */}
      {aba === 'graficos' && <GraficosEvento metrics={evento.metrics} />}

      {/* ════════════ ABA: LOCAIS ════════════ */}
      {aba === 'locais' && (
        <div className="space-y-3">
          {evento.locais.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">🏠</p>
              <p>Nenhum local cadastrado</p>
            </div>
          ) : (
            evento.locais.map((local) => (
              <div
                key={local.id}
                className="bg-white rounded-xl shadow-sm border p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">📍 {local.nome}</p>
                  {local.endereco && (
                    <p className="text-sm text-gray-500 truncate">{local.endereco}</p>
                  )}
                </div>
                <span className="shrink-0 px-3 py-1 bg-gray-50 border border-gray-100 rounded-lg text-sm text-gray-600">
                  {local.recebimentos}{' '}
                  {local.recebimentos === 1 ? 'recebimento' : 'recebimentos'}
                </span>
              </div>
            ))
          )}
          {podeGerenciar && (
            <p className="text-xs text-gray-400 pt-2">
              ℹ️ A criação e edição de locais é feita na tela de edição do evento (lista → Editar).
            </p>
          )}
        </div>
      )}

      {/* ════════════ 🆕 ABA: ALIMENTOS ════════════ */}
      {aba === 'alimentos' && (
        <div className="space-y-3">
          {alimentosOrdenados.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">🥫</p>
              <p>Nenhum alimento cadastrado</p>
            </div>
          ) : (
            alimentosOrdenados.map((a) => {
              const motivo = motivoLabel(a.motivoRefugo)
              return (
                <div key={a.id} className="bg-white rounded-xl shadow-sm border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-gray-900">🥫 {a.nome}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-3 py-1 bg-gray-50 border border-gray-100 rounded-lg text-sm text-gray-600">
                        {a.recebimentos}{' '}
                        {a.recebimentos === 1 ? 'recebimento' : 'recebimentos'}
                      </span>
                      {a.refugoKg > 0 && (
                        <span className="px-3 py-1 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-700">
                          Refugo: {fmtKg(a.refugoKg)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Detalhe do refugo (read-only por enquanto) */}
                  {(motivo || a.obsRefugo) && (
                    <div className="mt-2 pt-2 border-t text-sm text-gray-500 space-y-0.5">
                      {motivo && (
                        <p>
                          <span className="font-medium text-gray-600">Motivo:</span> {motivo}
                        </p>
                      )}
                      {a.obsRefugo && (
                        <p>
                          <span className="font-medium text-gray-600">Obs:</span> {a.obsRefugo}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}

          {podeGerenciar && (
            <div className="flex justify-end pt-2">
              <button
                disabled
                title="Edição de alimentos e refugo chega na próxima onda (17.3.b)"
                className="bg-green-300 cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                ✏️ Registrar refugo (em breve)
              </button>
            </div>
          )}
          {podeGerenciar && (
            <p className="text-xs text-gray-400">
              ℹ️ A lista de alimentos é definida na criação/edição do evento. O refugo será
              preenchido no pós-evento (próxima onda).
            </p>
          )}
        </div>
      )}

      {/* ════════════ ABA: OPERADORES (SÓ ADMIN) ════════════ */}
      {aba === 'operadores' && isAdmin && (
        <div className="space-y-3">
          {podeGerenciar && (
            <div className="flex justify-end">
              <button
                disabled
                title="Vincular operadores chega na próxima onda (17.3.b)"
                className="bg-green-300 cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                + Vincular operador (em breve)
              </button>
            </div>
          )}

          {evento.operadores.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">👥</p>
              <p>Nenhum operador vinculado a este evento</p>
              <p className="text-xs mt-1">
                O vínculo é apenas organizacional — qualquer operador pode registrar recebimentos
                em eventos ativos.
              </p>
            </div>
          ) : (
            evento.operadores.map((op) => (
              <div
                key={op.id}
                className="bg-white rounded-xl shadow-sm border p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{op.nome ?? '—'}</p>
                  <p className="text-sm text-gray-500 truncate">{op.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                      op.ativo
                        ? 'bg-green-100 text-green-700 border-green-200'
                        : 'bg-gray-100 text-gray-500 border-gray-200'
                    }`}
                  >
                    {op.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                  {podeGerenciar && (
                    <button
                      disabled
                      title="Gerenciar vínculo chega na 17.3.b"
                      className="text-xs text-gray-300 cursor-not-allowed px-2 py-1"
                    >
                      Gerenciar
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
