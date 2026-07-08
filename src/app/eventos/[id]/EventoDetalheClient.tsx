'use client'

import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import GraficosEvento from './GraficosEvento'
import ExportarEventoPdf from './ExportarEventoPdf'

type EventoStatus = 'RASCUNHO' | 'ATIVO' | 'ENCERRADO'

interface LocalView {
  id: string
  nome: string
  endereco: string | null
  recebimentos: number
}
interface AlimentoView {
  id: string
  productId: string
  nome: string
  unit: string
  ordem: number
  refugoKg: number
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
// 🆕 17.6-g — usuário candidato ao vínculo (dropdown)
interface UsuarioVinculavel {
  id: string
  nome: string | null
  email: string
}
export interface EventoMetrics {
  totalKg: number
  totalRefugoKg: number
  totalLiquidoKg: number
  kgPorLocal: { nome: string; kg: number }[]
  kgPorTipo: { tipo: string; kg: number }[]
  kgPorDia: { dia: string; kg: number }[]
}

// 🆕 ONDA B
interface DoacaoProduto {
  nome: string
  unidade: string
  quantidade: number
}
interface DoacaoSubtotal {
  unidade: string
  quantidade: number
}
interface DoacaoLocal {
  id: string
  nome: string
  produtos: DoacaoProduto[]
  subtotais: DoacaoSubtotal[]
}
interface DoacoesView {
  porLocal: DoacaoLocal[]
  totalGeral: DoacaoSubtotal[]
}

interface EventoView {
  id: string
  nome: string
  descricao: string | null
  dataInicio: string
  dataFim: string | null
  status: EventoStatus
  integraEstoque: boolean
  obsRefugo: string | null // 🆕 17.6
  encerradoEm: string | null
  encerradoPor: { id: string; name: string } | null
  criadoPor: { id: string; name: string } | null
  locais: LocalView[]
  alimentos: AlimentoView[]
  operadores: OperadorView[]
  counts: { recebimentos: number; locais: number; operadores: number; alimentos: number }
  metrics: EventoMetrics
  doacoes: DoacoesView // 🆕 ONDA B
}

const STATUS_BADGE: Record<EventoStatus, { label: string; cls: string }> = {
  RASCUNHO: { label: '📝 Rascunho', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  ATIVO: { label: '🟢 Ativo', cls: 'bg-green-100 text-green-700 border-green-200' },
  ENCERRADO: { label: '⏹️ Encerrado', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
}

// 🔄 ORDEM: Resumo · Doações · Locais · Alimentos · Operadores · Gráficos
type Aba = 'resumo' | 'doacoes' | 'locais' | 'alimentos' | 'operadores' | 'graficos'

export default function EventoDetalheClient({
  evento,
  podeGerenciar,
  podeRegistrar,
  isAdmin,
  usuariosVinculaveis = [], // 🆕 17.6-g
}: {
  evento: EventoView
  podeGerenciar: boolean
  podeRegistrar: boolean
  isAdmin: boolean
  usuariosVinculaveis?: UsuarioVinculavel[] // 🆕 17.6-g
}) {
  const router = useRouter()
  const [aba, setAba] = useState<Aba>('resumo')
  const badge = STATUS_BADGE[evento.status]

  // 🆕 17.6 — estado local de edição de refugo
  const podeEditarRefugo = isAdmin && evento.status !== 'ENCERRADO'
  const [editandoRefugo, setEditandoRefugo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [refugoDraft, setRefugoDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(evento.alimentos.map((a) => [a.id, String(a.refugoKg ?? 0)])),
  )
  const [obsDraft, setObsDraft] = useState(evento.obsRefugo ?? '')

  // 🆕 17.6 — estado do encerramento
  const [encerrando, setEncerrando] = useState(false)

  // 🆕 estados das transições de status
  const [ativando, setAtivando] = useState(false)
  const [revertendo, setRevertendo] = useState(false)

  // 🆕 17.6-g — estado do vínculo de operadores
  const podeGerenciarOperadores = isAdmin && evento.status !== 'ENCERRADO'
  const [selUserId, setSelUserId] = useState('')
  const [vinculando, setVinculando] = useState(false)
  const [removendoId, setRemovendoId] = useState<string | null>(null)

  // 🆕 17.6-f — exclusão de alimento do evento
  const podeExcluirAlimento = isAdmin && evento.status !== 'ENCERRADO'
  const [excluindoAlimId, setExcluindoAlimId] = useState<string | null>(null)

  // ids já vinculados e ATIVOS → some do dropdown
  const idsAtivos = new Set(
    evento.operadores.filter((o) => o.ativo).map((o) => o.userId),
  )
  const candidatos = usuariosVinculaveis.filter((u) => !idsAtivos.has(u.id))

  // 🆕 pode voltar para rascunho? (só admin, ATIVO, sem doações)
  const podeReverter =
    isAdmin && evento.status === 'ATIVO' && evento.counts.recebimentos === 0

  const formatDate = (date: string) => {
    const raw = date.includes('T') ? date.split('T')[0] : date
    const [year, month, day] = raw.split('-')
    return `${day}/${month}/${year}`
  }

  const fmtKg = (n: number) =>
    `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`

  // 🆕 ONDA B
  const fmtQtd = (n: number, unidade: string) =>
    `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${unidade}`

  const tabBtn = (id: Aba) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition whitespace-nowrap ${
      aba === id ? 'bg-green-500 text-white' : 'text-gray-600 hover:bg-gray-100'
    }`

  const alimentosOrdenados = [...evento.alimentos].sort((a, b) => a.ordem - b.ordem)

  // 🆕 17.6 — salva refugo + obs via PUT (reaproveita o endpoint existente)
  const salvarRefugo = async () => {
    setSalvando(true)
    try {
      const payload = {
        // o PUT exige estes campos; reenviamos o estado atual do evento
        nome: evento.nome,
        descricao: evento.descricao,
        dataInicio: evento.dataInicio,
        dataFim: evento.dataFim,
        integraEstoque: evento.integraEstoque,
        obsRefugo: obsDraft, // 🆕
        locais: evento.locais.map((l) => ({
          id: l.id,
          nome: l.nome,
          endereco: l.endereco,
        })),
        // 🆕 reenvia alimentos por productId + refugoKg do draft
        alimentos: alimentosOrdenados.map((a) => ({
          productId: a.productId,
          refugoKg: Number(refugoDraft[a.id]?.replace(',', '.')) || 0,
        })),
      }

      const res = await fetch(`/api/eventos/${evento.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Erro ao salvar refugo')
      }

      toast.success('Refugo salvo com sucesso')
      setEditandoRefugo(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar refugo')
    } finally {
      setSalvando(false)
    }
  }

  // 🆕 17.6-f — excluir alimento do evento (backend bloqueia com 409 se houver recebimento)
  const excluirAlimento = async (idAlimento: string, nome: string) => {
    if (!confirm(`Remover "${nome}" deste evento?`)) return
    setExcluindoAlimId(idAlimento)
    try {
      const res = await fetch(
        `/api/eventos/${evento.id}/alimentos/${idAlimento}`,
        { method: 'DELETE' },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Erro ao remover alimento')
      toast.success('Alimento removido')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover alimento')
    } finally {
      setExcluindoAlimId(null)
    }
  }

  // 🆕 17.6-g — vincular operador
  const vincularOperador = async () => {
    if (!selUserId) {
      toast.error('Selecione um usuário')
      return
    }
    setVinculando(true)
    try {
      const res = await fetch(`/api/eventos/${evento.id}/operadores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selUserId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Erro ao vincular operador')
      }
      toast.success('Operador vinculado')
      setSelUserId('')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao vincular operador')
    } finally {
      setVinculando(false)
    }
  }

  // 🆕 17.6-g — desvincular operador (soft: ativo:false)
  const desvincularOperador = async (userId: string, nome: string | null) => {
    if (
      !confirm(
        `Desvincular ${nome ?? 'este usuário'}? Ele deixará de poder registrar doações neste evento.`,
      )
    )
      return
    setRemovendoId(userId)
    try {
      const res = await fetch(
        `/api/eventos/${evento.id}/operadores/${userId}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Erro ao desvincular operador')
      }
      toast.success('Operador desvinculado')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao desvincular operador')
    } finally {
      setRemovendoId(null)
    }
  }

  // 🆕 ativar evento (PATCH action:'ativar' → RASCUNHO → ATIVO)
  const ativarEvento = async () => {
    if (
      !confirm(
        'Ativar este evento? A partir daí, operadores poderão registrar doações.',
      )
    )
      return
    setAtivando(true)
    try {
      const res = await fetch(`/api/eventos/${evento.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ativar' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Erro ao ativar evento')
      }
      toast.success('Evento ativado')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao ativar evento')
    } finally {
      setAtivando(false)
    }
  }

  // 🆕 reverter evento (PATCH action:'reverter' → ATIVO → RASCUNHO)
  const reverterEvento = async () => {
    if (
      !confirm(
        'Voltar este evento para rascunho? Isso só é possível enquanto não houver doações registradas.',
      )
    )
      return
    setRevertendo(true)
    try {
      const res = await fetch(`/api/eventos/${evento.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reverter' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Erro ao voltar para rascunho')
      }
      toast.success('Evento voltou para rascunho')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao voltar para rascunho')
    } finally {
      setRevertendo(false)
    }
  }

  // 🆕 17.6 — encerrar evento (PATCH action:'encerrar')
  const encerrarEvento = async () => {
    if (
      !confirm(
        'Encerrar este evento? Após encerrado, não será mais possível registrar doações nem editar o refugo.',
      )
    )
      return
    setEncerrando(true)
    try {
      const res = await fetch(`/api/eventos/${evento.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'encerrar' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Erro ao encerrar evento')
      }
      toast.success('Evento encerrado')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao encerrar evento')
    } finally {
      setEncerrando(false)
    }
  }

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

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {/* 🆕 Ativar (só admin, só RASCUNHO) */}
          {isAdmin && evento.status === 'RASCUNHO' && (
            <button
              onClick={ativarEvento}
              disabled={ativando}
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg shadow-sm transition active:scale-95"
            >
              {ativando ? 'Ativando…' : '▶️ Ativar evento'}
            </button>
          )}

          {/* 🆕 Voltar para rascunho (só admin, ATIVO, sem doações) */}
          {podeReverter && (
            <button
              onClick={reverterEvento}
              disabled={revertendo}
              className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-60 text-gray-700 font-semibold px-4 py-2 rounded-lg shadow-sm transition active:scale-95"
            >
              {revertendo ? 'Revertendo…' : '↩️ Voltar para rascunho'}
            </button>
          )}

          {/* 🆕 17.6 — botão Encerrar (só admin, só evento ATIVO) */}
          {isAdmin && evento.status === 'ATIVO' && (
            <button
              onClick={encerrarEvento}
              disabled={encerrando}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg shadow-sm transition active:scale-95"
            >
              {encerrando ? 'Encerrando…' : '⏹️ Encerrar evento'}
            </button>
          )}
          <ExportarEventoPdf eventoId={evento.id} isAdmin={isAdmin} />
        </div>
      </div>

      {/* 🗂️ Abas */}
      <div className="flex gap-2 mb-6 border-b pb-3 overflow-x-auto">
        <button className={tabBtn('resumo')} onClick={() => setAba('resumo')}>
          📋 Resumo
        </button>
        <button className={tabBtn('doacoes')} onClick={() => setAba('doacoes')}>
          📥 Doações ({evento.counts.recebimentos})
        </button>
        <button className={tabBtn('locais')} onClick={() => setAba('locais')}>
          🏠 Locais ({evento.counts.locais})
        </button>
        <button className={tabBtn('alimentos')} onClick={() => setAba('alimentos')}>
          🥫 Alimentos ({evento.counts.alimentos})
        </button>
        {isAdmin && (
          <button className={tabBtn('operadores')} onClick={() => setAba('operadores')}>
            👥 Operadores ({evento.counts.operadores})
          </button>
        )}
        <button className={tabBtn('graficos')} onClick={() => setAba('graficos')}>
          📊 Gráficos
        </button>
      </div>

      {/* ════════════ ABA: RESUMO ════════════ */}
      {aba === 'resumo' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-3">
  <div className="min-w-0 bg-white rounded-xl shadow-sm border p-4">
    <p className="text-xs text-gray-500">Total recebido</p>
    <p className="text-2xl font-bold text-gray-900 truncate">{fmtKg(evento.metrics.totalKg)}</p>
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

          {/* 🆕 17.6 — observação geral de refugo (leitura no resumo) */}
          {evento.obsRefugo && (
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <p className="text-xs font-medium text-gray-500 mb-1">Observação de refugo</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{evento.obsRefugo}</p>
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

      {/* ════════════ ABA: DOAÇÕES (ONDA B) ════════════ */}
      {aba === 'doacoes' && (
        <div className="space-y-4">
          {podeRegistrar && evento.status === 'ATIVO' && (
            <div className="flex justify-end">
              <Link
                href={`/eventos/${evento.id}/campo`}
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-lg shadow-sm transition active:scale-95"
              >
                📥 Registrar Doação
              </Link>
            </div>
          )}

          {evento.status !== 'ATIVO' && (
            <p className="text-xs text-gray-400">
              ℹ️ Só é possível registrar doações em eventos com status <b>Ativo</b>.
            </p>
          )}

          {evento.doacoes.porLocal.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">📥</p>
              <p>Nenhuma doação registrada ainda</p>
            </div>
          ) : (
            <>
              {evento.doacoes.porLocal.map((local) => (
                <div key={local.id} className="bg-white rounded-xl shadow-sm border p-4">
                  <p className="font-semibold text-gray-900 mb-3">📍 {local.nome}</p>

                  <div className="space-y-1.5">
                    {local.produtos.map((p, i) => (
                      <div
                        key={`${p.nome}-${p.unidade}-${i}`}
                        className="flex items-center justify-between text-sm border-b border-dashed border-gray-100 pb-1.5"
                      >
                        <span className="text-gray-700">🥫 {p.nome}</span>
                        <span className="font-medium text-gray-900 tabular-nums">
                          {fmtQtd(p.quantidade, p.unidade)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-2 border-t flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500 uppercase">Subtotal</span>
                    <span className="text-sm font-bold text-gray-900 tabular-nums">
                      {local.subtotais.map((s) => fmtQtd(s.quantidade, s.unidade)).join(' · ')}
                    </span>
                  </div>
                </div>
              ))}

              <div className="bg-green-600 rounded-xl shadow-sm p-5 flex items-center justify-between text-white">
                <span className="font-semibold uppercase tracking-wide text-sm">Total geral</span>
                <span className="text-xl font-bold tabular-nums">
                  {evento.doacoes.totalGeral
                    .map((t) => fmtQtd(t.quantidade, t.unidade))
                    .join(' · ')}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ════════════ ABA: LOCAIS ════════════ */}
      {aba === 'locais' && (
        <div className="space-y-3">
          {isAdmin && (
            <div className="flex justify-end">
              <button
                disabled
                title="Função 'Adicionar local' chega na onda C"
                className="bg-green-300 cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                + Adicionar local (em breve)
              </button>
            </div>
          )}
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
        </div>
      )}

      {/* ════════════ ABA: ALIMENTOS (🆕 17.6 — refugo · 🆕 17.6-f — excluir) ════════════ */}
      {aba === 'alimentos' && (
        <div className="space-y-3">
          {/* Barra de ação de refugo (só admin, evento não encerrado) */}
          {podeEditarRefugo && (
            <div className="flex justify-end gap-2">
              {!editandoRefugo ? (
                <button
                  onClick={() => setEditandoRefugo(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition active:scale-95"
                >
                  ✏️ Lançar / editar refugo
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      // descarta alterações
                      setRefugoDraft(
                        Object.fromEntries(
                          evento.alimentos.map((a) => [a.id, String(a.refugoKg ?? 0)]),
                        ),
                      )
                      setObsDraft(evento.obsRefugo ?? '')
                      setEditandoRefugo(false)
                    }}
                    disabled={salvando}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={salvarRefugo}
                    disabled={salvando}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition active:scale-95"
                  >
                    {salvando ? 'Salvando…' : '💾 Salvar refugo'}
                  </button>
                </>
              )}
            </div>
          )}

          {alimentosOrdenados.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">🥫</p>
              <p>Nenhum alimento cadastrado</p>
            </div>
          ) : (
            alimentosOrdenados.map((a) => (
              <div key={a.id} className="bg-white rounded-xl shadow-sm border p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-gray-900">
                    🥫 {a.nome}{' '}
                    <span className="text-xs uppercase text-gray-400">({a.unit})</span>
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-3 py-1 bg-gray-50 border border-gray-100 rounded-lg text-sm text-gray-600">
                      {a.recebimentos}{' '}
                      {a.recebimentos === 1 ? 'recebimento' : 'recebimentos'}
                    </span>

                    {editandoRefugo ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          value={refugoDraft[a.id] ?? '0'}
                          onChange={(e) =>
                            setRefugoDraft((prev) => ({ ...prev, [a.id]: e.target.value }))
                          }
                          className="w-24 px-2 py-1 border border-amber-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                        <span className="text-sm text-gray-500">kg</span>
                      </div>
                    ) : (
                      a.refugoKg > 0 && (
                        <span className="px-3 py-1 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-700">
                          Refugo: {fmtKg(a.refugoKg)}
                        </span>
                      )
                    )}

                    {/* 🆕 17.6-f — excluir alimento (só admin, evento não encerrado, fora do modo refugo) */}
                    {podeExcluirAlimento && !editandoRefugo && (
                      <button
                        onClick={() => excluirAlimento(a.id, a.nome)}
                        disabled={excluindoAlimId === a.id}
                        title={
                          a.recebimentos > 0
                            ? 'Não é possível remover: há recebimentos registrados'
                            : 'Remover alimento do evento'
                        }
                        className="px-3 py-1 bg-red-50 hover:bg-red-100 disabled:opacity-60 border border-red-100 rounded-lg text-sm text-red-600 transition active:scale-95"
                      >
                        {excluindoAlimId === a.id ? '…' : '🗑️'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          {/* 🆕 17.6 — observação geral de refugo */}
          {(editandoRefugo || evento.obsRefugo) && (
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <p className="text-xs font-medium text-gray-500 mb-2">
                Observação geral de refugo
              </p>
              {editandoRefugo ? (
                <textarea
                  value={obsDraft}
                  onChange={(e) => setObsDraft(e.target.value)}
                  rows={3}
                  placeholder="Ex.: lote vencido descartado no local X, embalagens violadas no transporte…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-y"
                />
              ) : (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{evento.obsRefugo}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════ ABA: OPERADORES (SÓ ADMIN — 🆕 17.6-g) ════════════ */}
      {aba === 'operadores' && isAdmin && (
        <div className="space-y-3">
          {/* 🆕 17.6-g — vincular operador (só admin, evento não encerrado) */}
          {podeGerenciarOperadores ? (
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <p className="text-xs font-medium text-gray-500 mb-2">
                Vincular usuário visualizador como operador deste evento
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={selUserId}
                  onChange={(e) => setSelUserId(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                  <option value="">— selecione um usuário —</option>
                  {candidatos.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome ?? u.email}
                    </option>
                  ))}
                </select>
                <button
                  onClick={vincularOperador}
                  disabled={vinculando || !selUserId}
                  className="shrink-0 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition active:scale-95"
                >
                  {vinculando ? 'Vinculando…' : '+ Vincular'}
                </button>
              </div>
              {candidatos.length === 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  Nenhum usuário visualizador disponível para vincular.
                </p>
              )}
              <p className="text-xs text-gray-400 mt-2">
                ℹ️ Visualizadores só registram doações nos eventos em que estão vinculados.
                Admin e operador registram em qualquer evento ativo.
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              ℹ️ Evento encerrado não permite alterar operadores.
            </p>
          )}

          {evento.operadores.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">👥</p>
              <p>Nenhum operador vinculado a este evento</p>
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
                  {/* 🆕 17.6-g — desvincular (só ativos, evento não encerrado) */}
                  {podeGerenciarOperadores && op.ativo && (
                    <button
                      onClick={() => desvincularOperador(op.userId, op.nome)}
                      disabled={removendoId === op.userId}
                      className="text-red-500 hover:text-red-700 disabled:opacity-50 text-sm font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition"
                    >
                      {removendoId === op.userId ? '…' : '🗑️ Desvincular'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ════════════ ABA: GRÁFICOS ════════════ */}
      {aba === 'graficos' && <GraficosEvento metrics={evento.metrics} />}
    </div>
  )
}
