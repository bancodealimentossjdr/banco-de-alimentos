'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import GraficosEvento, {
  type EventoMetrics,
  type Fato,
  type Range,
  derivarMetrics,
  filtrarFatos,
} from './GraficosEvento'
import ExportarEventoPdf from './ExportarEventoPdf'

// 🔁 re-export p/ compatibilidade com quem importava daqui
export type { EventoMetrics }

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
interface UsuarioVinculavel {
  id: string
  nome: string | null
  email: string
}

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
  encerradoEm: string | null
  encerradoPor: { id: string; name: string } | null
  criadoPor: { id: string; name: string } | null
  locais: LocalView[]
  alimentos: AlimentoView[]
  operadores: OperadorView[]
  counts: { recebimentos: number; locais: number; operadores: number; alimentos: number }
  metrics: EventoMetrics
  fatos: Fato[] // 🆕 17.5-a
  range: Range // 🆕 17.5-a
  doacoes: DoacoesView
}

const STATUS_BADGE: Record<EventoStatus, { label: string; cls: string }> = {
  RASCUNHO: { label: '📝 Rascunho', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  ATIVO: { label: '🟢 Ativo', cls: 'bg-green-100 text-green-700 border-green-200' },
  ENCERRADO: { label: '⏹️ Encerrado', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
}

// 🚧 17.8-h — aba "resumo" removida
type Aba = 'doacoes' | 'locais' | 'alimentos' | 'operadores' | 'graficos'

export default function EventoDetalheClient({
  evento,
  podeGerenciar,
  podeRegistrar,
  isAdmin,
  usuariosVinculaveis = [],
}: {
  evento: EventoView
  podeGerenciar: boolean
  podeRegistrar: boolean
  isAdmin: boolean
  usuariosVinculaveis?: UsuarioVinculavel[]
}) {
  const router = useRouter()
  const [aba, setAba] = useState<Aba>('doacoes')
  const badge = STATUS_BADGE[evento.status]

  // 🆕 17.5-a — filtro de período (aba Gráficos)
  const [inicio, setInicio] = useState(evento.range.defaultStart)
  const [fim, setFim] = useState(evento.range.defaultEnd)

  // 🆕 17.5-a — métricas reativas ao filtro (card de resumo + top3)
  const fatosFiltrados = useMemo(
    () => filtrarFatos(evento.fatos, inicio, fim),
    [evento.fatos, inicio, fim],
  )
  const metricsFiltradas = useMemo(
    () => derivarMetrics(fatosFiltrados),
    [fatosFiltrados],
  )

  // usa métricas filtradas quando na aba gráficos; senão, totais do evento
  const metricsResumo = aba === 'graficos' ? metricsFiltradas : evento.metrics

  const podeEditarRefugo = isAdmin && evento.status !== 'ENCERRADO'
  const [editandoRefugo, setEditandoRefugo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [refugoDraft, setRefugoDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(evento.alimentos.map((a) => [a.id, String(a.refugoKg ?? 0)])),
  )

  const [encerrando, setEncerrando] = useState(false)
  const [ativando, setAtivando] = useState(false)
  const [revertendo, setRevertendo] = useState(false)

  // 🆕 17.8-g — atualizar totais da aba Doações
  const [atualizando, setAtualizando] = useState(false)

  const podeGerenciarOperadores = isAdmin && evento.status !== 'ENCERRADO'
  const [selUserId, setSelUserId] = useState('')
  const [vinculando, setVinculando] = useState(false)
  const [removendoId, setRemovendoId] = useState<string | null>(null)

  const podeExcluirAlimento = isAdmin && evento.status !== 'ENCERRADO'
  const [excluindoAlimId, setExcluindoAlimId] = useState<string | null>(null)

  // 🆕 17.8-f — gestão de locais (adicionar + excluir); só admin, fora de ENCERRADO
  const podeGerenciarLocais = isAdmin && evento.status !== 'ENCERRADO'
  const [novoLocalNome, setNovoLocalNome] = useState('')
  const [novoLocalEndereco, setNovoLocalEndereco] = useState('')
  const [adicionandoLocal, setAdicionandoLocal] = useState(false)
  const [excluindoLocalId, setExcluindoLocalId] = useState<string | null>(null)

  const idsAtivos = new Set(evento.operadores.filter((o) => o.ativo).map((o) => o.userId))
  const candidatos = usuariosVinculaveis.filter((u) => !idsAtivos.has(u.id))

  const podeReverter =
    isAdmin && evento.status === 'ATIVO' && evento.counts.recebimentos === 0

  const formatDate = (date: string) => {
    const raw = date.includes('T') ? date.split('T')[0] : date
    const [year, month, day] = raw.split('-')
    return `${day}/${month}/${year}`
  }

  const fmtKg = (n: number) =>
    `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`

  const fmtQtd = (n: number, unidade: string) =>
    `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${unidade}`

  const alimentosOrdenados = [...evento.alimentos].sort((a, b) => a.ordem - b.ordem)

  // 🆕 17.8-h — top 3 locais (reativo ao filtro na aba gráficos)
  const top3Locais = [...metricsResumo.kgPorLocal]
    .sort((a, b) => b.kg - a.kg)
    .slice(0, 3)
  const medalhas = ['🥇', '🥈', '🥉']

  // 🆕 17.8-g — atualizar totais (server component via router.refresh)
  const atualizarDoacoes = () => {
    setAtualizando(true)
    router.refresh()
    toast.success('Totais atualizados')
    setTimeout(() => setAtualizando(false), 600)
  }

  const salvarRefugo = async () => {
    setSalvando(true)
    try {
      const payload = {
        nome: evento.nome,
        descricao: evento.descricao,
        dataInicio: evento.dataInicio,
        dataFim: evento.dataFim,
        integraEstoque: evento.integraEstoque,
        locais: evento.locais.map((l) => ({
          id: l.id,
          nome: l.nome,
          endereco: l.endereco,
        })),
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

  // 🆕 17.8-f — adicionar local
  const adicionarLocal = async () => {
    const nome = novoLocalNome.trim()
    if (!nome) {
      toast.error('Informe o nome do local')
      return
    }
    setAdicionandoLocal(true)
    try {
      const res = await fetch(`/api/eventos/${evento.id}/locais`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, endereco: novoLocalEndereco.trim() || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Erro ao adicionar local')
      toast.success('Local adicionado')
      setNovoLocalNome('')
      setNovoLocalEndereco('')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao adicionar local')
    } finally {
      setAdicionandoLocal(false)
    }
  }

  // 🆕 17.8-f — excluir local
  const excluirLocal = async (localId: string, nome: string, recebimentos: number) => {
    if (recebimentos > 0) {
      toast.error(`"${nome}" possui ${recebimentos} recebimento(s) e não pode ser removido.`)
      return
    }
    if (!confirm(`Remover o local "${nome}" deste evento?`)) return
    setExcluindoLocalId(localId)
    try {
      const res = await fetch(
        `/api/eventos/${evento.id}/locais/${localId}`,
        { method: 'DELETE' },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Erro ao remover local')
      toast.success('Local removido')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover local')
    } finally {
      setExcluindoLocalId(null)
    }
  }

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

  const ativarEvento = async () => {
    if (!confirm('Ativar este evento? A partir daí, operadores poderão registrar doações.'))
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

  // 🆕 17.8-i — abas SEM contadores no rótulo
  const abasDisponiveis: { id: Aba; label: string; icon: string }[] = [
    { id: 'doacoes', label: 'Doações', icon: '📥' },
    { id: 'locais', label: 'Locais', icon: '🏠' },
    { id: 'alimentos', label: 'Alimentos', icon: '🥫' },
    ...(isAdmin ? [{ id: 'operadores' as Aba, label: 'Operadores', icon: '👥' }] : []),
    { id: 'graficos', label: 'Gráficos', icon: '📊' },
  ]

  const tabCardCls = (id: Aba) =>
    `flex flex-col items-center justify-center gap-1 h-20 rounded-xl border text-sm font-medium transition active:scale-95 ${
      aba === id
        ? 'bg-green-500 text-white border-green-500 shadow-sm'
        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-green-200'
    }`

  // 🆕 17.8-i — card de contexto abaixo das abas (com shift; só 3 abas)
  const contexto: Record<string, string | null> = {
    doacoes: null,
    graficos: null,
    locais: `Locais cadastrados: ${evento.counts.locais}`,
    alimentos: `Alimentos cadastrados: ${evento.counts.alimentos}`,
    operadores: `Operadores vinculados: ${evento.counts.operadores}`,
  }
  const textoContexto = contexto[aba]

  return (
    <div className="min-w-0">
      {/* 🔙 Voltar */}
      <Link
        href="/eventos"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        ← Voltar para eventos
      </Link>

      {/* Cabeçalho */}
      <div className="mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 break-words">{evento.nome}</h2>
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

      {/* 🆕 17.8-c/#23 — botões de ação lado a lado */}
      <div className="flex flex-wrap gap-2 mb-4">
        {isAdmin && evento.status === 'RASCUNHO' && (
          <button
            onClick={ativarEvento}
            disabled={ativando}
            className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg shadow-sm transition active:scale-95"
          >
            {ativando ? 'Ativando…' : '▶️ Ativar evento'}
          </button>
        )}

        {podeReverter && (
          <button
            onClick={reverterEvento}
            disabled={revertendo}
            className="inline-flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-60 text-gray-700 font-semibold px-4 py-2 rounded-lg shadow-sm transition active:scale-95"
          >
            {revertendo ? 'Revertendo…' : '↩️ Voltar p/ rascunho'}
          </button>
        )}

        {isAdmin && evento.status === 'ATIVO' && (
          <button
            onClick={encerrarEvento}
            disabled={encerrando}
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg shadow-sm transition active:scale-95"
          >
            {encerrando ? 'Encerrando…' : '⏹️ Encerrar evento'}
          </button>
        )}
      </div>

      {/* 🆕 17.8-h/#23 — card de resumo (total reativo ao filtro na aba gráficos) */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-gray-500 flex items-center gap-1">
            📊 Total arrecadado
            {aba === 'graficos' && (
              <span className="text-xs font-normal text-gray-400">(no período)</span>
            )}
          </span>
          <span className="text-2xl font-bold text-green-700 tabular-nums">
            {fmtKg(metricsResumo.totalKg)}
          </span>
        </div>

        {top3Locais.length > 0 && (
          <>
            <div className="border-t my-3" />
            <p className="text-xs text-gray-400 mb-2">Locais que mais arrecadaram</p>
            <div className="space-y-1.5">
              {top3Locais.map((l, i) => (
                <div
                  key={l.nome}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="text-gray-700 min-w-0 truncate">
                    {medalhas[i]} {l.nome}
                  </span>
                  <span className="font-semibold text-gray-900 tabular-nums shrink-0">
                    {fmtKg(l.kg)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 🆕 17.8-b — grid de cards das abas */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
        {abasDisponiveis.map((t) => (
          <button key={t.id} className={tabCardCls(t.id)} onClick={() => setAba(t.id)}>
            <span className="text-lg leading-none">{t.icon}</span>
            <span className="leading-tight">{t.label}</span>
          </button>
        ))}
      </div>

      {/* 🆕 17.8-i/#25 — card de contexto */}
      {textoContexto && (
        <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5 mb-6 text-sm font-medium text-gray-600">
          {textoContexto}
        </div>
      )}
      {!textoContexto && <div className="mb-6" />}

      {/* ════════════ ABA: DOAÇÕES ════════════ */}
      {aba === 'doacoes' && (
        <div className="space-y-4">
          {/* 🆕 17.8-g — barra de ações: Atualizar + Registrar + Arrecadação Extra */}
          <div className="flex justify-end items-center gap-2 flex-wrap">
            <button
              onClick={atualizarDoacoes}
              disabled={atualizando}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 active:scale-95 disabled:opacity-60"
            >
              <span className={atualizando ? 'inline-block animate-spin' : ''}>🔄</span>
              {atualizando ? 'Atualizando…' : 'Atualizar'}
            </button>

            {podeRegistrar && evento.status === 'ATIVO' && (
              <>
                <Link
                  href={`/eventos/${evento.id}/campo`}
                  className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-lg shadow-sm transition active:scale-95"
                >
                  📥 Registrar Doação
                </Link>

                {/* 🆕 Arrecadação Extra — ao lado de Registrar Doação */}
                <Link
                  href={`/eventos/${evento.id}/arrecadacao-extra`}
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg shadow-sm transition active:scale-95"
                >
                  📤 Arrecadação Extra
                </Link>
              </>
            )}
          </div>

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
            evento.doacoes.porLocal.map((local) => (
              <div key={local.id} className="min-w-0 bg-white rounded-xl shadow-sm border p-4">
                <p className="font-semibold text-gray-900 mb-3 break-words">📍 {local.nome}</p>

                <div className="space-y-1.5">
                  {local.produtos.map((p, i) => (
                    <div
                      key={`${p.nome}-${p.unidade}-${i}`}
                      className="flex items-center justify-between gap-2 text-sm border-b border-dashed border-gray-100 pb-1.5"
                    >
                      <span className="text-gray-700 min-w-0 truncate">🥫 {p.nome}</span>
                      <span className="min-w-0 font-medium text-gray-900 tabular-nums text-right break-words">
                        {fmtQtd(p.quantidade, p.unidade)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 pt-2 border-t flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-gray-500 uppercase shrink-0">Subtotal</span>
                  <span className="min-w-0 text-sm font-bold text-gray-900 tabular-nums text-right break-words">
                    {local.subtotais
                      .map((s) => fmtQtd(s.quantidade, s.unidade))
                      .join(' · ')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ════════════ ABA: LOCAIS ════════════ */}
      {aba === 'locais' && (
        <div className="space-y-3">
          {/* 🆕 17.8-f — form adicionar local */}
          {podeGerenciarLocais && (
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <p className="text-xs font-medium text-gray-500 mb-2">
                Adicionar novo local de coleta
              </p>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={novoLocalNome}
                  onChange={(e) => setNovoLocalNome(e.target.value)}
                  placeholder="Nome do local (obrigatório)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={novoLocalEndereco}
                    onChange={(e) => setNovoLocalEndereco(e.target.value)}
                    placeholder="Endereço (opcional)"
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') adicionarLocal()
                    }}
                  />
                  <button
                    onClick={adicionarLocal}
                    disabled={adicionandoLocal || !novoLocalNome.trim()}
                    className="shrink-0 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition active:scale-95"
                  >
                    {adicionandoLocal ? 'Adicionando…' : '+ Adicionar'}
                  </button>
                </div>
              </div>
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
                  <p className="font-medium text-gray-900 truncate">📍 {local.nome}</p>
                  {local.endereco && (
                    <p className="text-sm text-gray-500 truncate">{local.endereco}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3 py-1 bg-gray-50 border border-gray-100 rounded-lg text-sm text-gray-600">
                    {local.recebimentos}{' '}
                    {local.recebimentos === 1 ? 'recebimento' : 'recebimentos'}
                  </span>

                  {podeGerenciarLocais && (
                    <button
                      onClick={() => excluirLocal(local.id, local.nome, local.recebimentos)}
                      disabled={excluindoLocalId === local.id || local.recebimentos > 0}
                      title={
                        local.recebimentos > 0
                          ? 'Não é possível remover: há recebimentos registrados'
                          : 'Remover local do evento'
                      }
                      className="px-3 py-1 bg-red-50 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed border border-red-100 rounded-lg text-sm text-red-600 transition active:scale-95"
                    >
                      {excluindoLocalId === local.id ? '…' : '🗑️'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ════════════ ABA: ALIMENTOS ════════════ */}
      {aba === 'alimentos' && (
        <div className="space-y-3">
          {podeEditarRefugo && (
            <div className="flex justify-end gap-2 flex-wrap">
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
                      setRefugoDraft(
                        Object.fromEntries(
                          evento.alimentos.map((a) => [a.id, String(a.refugoKg ?? 0)]),
                        ),
                      )
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
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 break-words">
                      🥫 {a.nome}{' '}
                      <span className="text-xs uppercase text-gray-400">({a.unit})</span>
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5 tabular-nums">
                      {fmtKg(a.recebimentos)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
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
        </div>
      )}

      {/* ════════════ ABA: OPERADORES (SÓ ADMIN) ════════════ */}
      {aba === 'operadores' && isAdmin && (
        <div className="space-y-3">
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

      {/* ════════════ ABA: GRÁFICOS (Exportar PDF só aqui — #26) ════════════ */}
      {aba === 'graficos' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <ExportarEventoPdf
              eventoId={evento.id}
              isAdmin={isAdmin}
              dataInicio={inicio}
              dataFim={fim}
            />
          </div>
          <GraficosEvento
            fatos={evento.fatos}
            range={evento.range}
            inicio={inicio}
            fim={fim}
            onInicioChange={setInicio}
            onFimChange={setFim}
          />
        </div>
      )}
    </div>
  )
}
