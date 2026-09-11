'use client'

import { useEffect, useState, useCallback } from 'react'
import PhoneLink from '@/components/PhoneLink'
import { usePermissions } from '@/hooks/usePermissions'
import { useFormSubmit } from '@/hooks/useFormSubmit'

interface Producer {
  id: string
  name: string
  phone: string
  address: string
  property: string
  active: boolean
  atendePaa: boolean
  createdAt: string
  _count?: { harvests: number; entregasPaa: number }
}

interface Cota {
  producerId: string
  nome: string
  teto: number
  usado: number
  saldo: number
  percentual: number
  origemTeto: 'override' | 'global'
  overrideNota: string | null
  status: 'ok' | 'alerta' | 'estourado'
  alertaPercentual: number
  ultimoResetAt: string | null
}

type PaaFilter = 'todos' | 'paa' | 'nao-paa'

const EMPTY_FORM = {
  name: '',
  phone: '',
  address: '',
  property: '',
  atendePaa: false,
}

const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (iso: string | null) => {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR')
}

const CORES_BARRA: Record<Cota['status'], string> = {
  ok: 'bg-green-500',
  alerta: 'bg-amber-500',
  estourado: 'bg-red-600',
}

const CORES_TEXTO: Record<Cota['status'], string> = {
  ok: 'text-green-700',
  alerta: 'text-amber-700',
  estourado: 'text-red-700',
}

export default function ProdutoresPage() {
  const { canEdit, role } = usePermissions()
const podeEditar = canEdit('produtores')

const isDev = role === 'dev'
const podeResetar = role === 'dev' || role === 'admin'

  const { isSubmitting, handleSubmit: runSubmit } = useFormSubmit()

  const [producers, setProducers] = useState<Producer[]>([])
  const [cotas, setCotas] = useState<Record<string, Cota>>({})
  const [cotaPadrao, setCotaPadrao] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<PaaFilter>('todos')
  const [form, setForm] = useState(EMPTY_FORM)

  // 🪟 Modais de cota
  const [modalReset, setModalReset] = useState<Producer | null>(null)
  const [motivoReset, setMotivoReset] = useState('')
  const [modalCota, setModalCota] = useState<Producer | null>(null)
  const [cotaValor, setCotaValor] = useState('')
  const [cotaNota, setCotaNota] = useState('')
  const [savingModal, setSavingModal] = useState(false)

  const fetchProducers = useCallback(async () => {
    try {
      const res = await fetch('/api/produtores')
      const data = await res.json()
      setProducers(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Erro ao buscar produtores:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // 💰 Cotas vêm da fonte única: /api/paa/cota
  const fetchCotas = useCallback(async () => {
    try {
      const res = await fetch('/api/paa/cota')
      if (!res.ok) return // visualizador sem acesso a 'paa' → card sem bloco de cota
      const data = await res.json()
      const mapa: Record<string, Cota> = {}
      for (const c of (data.cotas ?? []) as Cota[]) mapa[c.producerId] = c
      setCotas(mapa)
      setCotaPadrao(data.config?.cotaPadrao ?? null)
    } catch (error) {
      console.error('Erro ao buscar cotas PAA:', error)
    }
  }, [])

  useEffect(() => {
    fetchProducers()
    fetchCotas()
  }, [fetchProducers, fetchCotas])

  const recarregar = () => {
    fetchProducers()
    fetchCotas()
  }

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    await runSubmit(async () => {
      try {
        const url = editingId ? `/api/produtores/${editingId}` : '/api/produtores'
        const method = editingId ? 'PUT' : 'POST'
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (res.ok) {
          resetForm()
          recarregar()
        } else {
          const data = await res.json().catch(() => ({}))
          alert(data.error || 'Erro ao salvar produtor')
        }
      } catch (error) {
        console.error('Erro ao salvar produtor:', error)
        alert('Erro ao salvar produtor')
      }
    })
  }

  const handleEdit = (producer: Producer) => {
    setForm({
      name: producer.name,
      phone: producer.phone || '',
      address: producer.address || '',
      property: producer.property || '',
      atendePaa: producer.atendePaa,
    })
    setEditingId(producer.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const patchProducer = async (id: string, body: object, erroPadrao: string) => {
    const res = await fetch(`/api/produtores/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || erroPadrao)
    }
  }

  const handleToggleActive = async (producer: Producer) => {
    const action = producer.active ? 'desativar' : 'reativar'
    if (!confirm(`Deseja ${action} o produtor "${producer.name}"?`)) return
    try {
      await patchProducer(producer.id, { active: !producer.active }, 'Erro ao alterar status')
      recarregar()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const handleTogglePaa = async (producer: Producer) => {
    try {
      await patchProducer(
        producer.id,
        { atendePaa: !producer.atendePaa },
        'Erro ao alterar flag PAA',
      )
      recarregar()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  // ♻️ Reset de cota (admin/dev) — exige motivo
  const confirmarReset = async () => {
    if (!modalReset) return
    if (motivoReset.trim().length < 5) {
      alert('Informe um motivo com pelo menos 5 caracteres.')
      return
    }
    setSavingModal(true)
    try {
      const res = await fetch('/api/paa/cota/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ producerId: modalReset.id, motivo: motivoReset.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao resetar cota')
      setModalReset(null)
      setMotivoReset('')
      recarregar()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSavingModal(false)
    }
  }

  // 🔒 Definir cota individual (dev)
  const abrirModalCota = (producer: Producer) => {
    const c = cotas[producer.id]
    setCotaValor(c?.origemTeto === 'override' ? String(c.teto) : '')
    setCotaNota(c?.overrideNota ?? '')
    setModalCota(producer)
  }

  const salvarCota = async (limpar = false) => {
    if (!modalCota) return
    setSavingModal(true)
    try {
      const body = limpar
        ? { cotaOverride: null }
        : { cotaOverride: Number(cotaValor.replace(',', '.')), cotaOverrideNota: cotaNota }
      await patchProducer(modalCota.id, body, 'Erro ao definir cota')
      setModalCota(null)
      recarregar()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSavingModal(false)
    }
  }

  const totalPaa = producers.filter(p => p.atendePaa).length

  const filtered = producers.filter(p => {
    if (filter === 'paa' && !p.atendePaa) return false
    if (filter === 'nao-paa' && p.atendePaa) return false
    if (!search.trim()) return true
    const q = norm(search)
    return (
      norm(p.name).includes(q) ||
      (p.address && norm(p.address).includes(q)) ||
      (p.property && norm(p.property).includes(q))
    )
  })

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">🚜 Produtores Rurais</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {producers.length} produtor(es) cadastrado(s) · {totalPaa} no PAA
            {cotaPadrao !== null && ` · cota padrão ${brl(cotaPadrao)}`}
          </p>
        </div>
        {podeEditar && (
          <button
            onClick={() => { if (showForm) resetForm(); else { resetForm(); setShowForm(true) } }}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-medium transition w-full sm:w-auto text-center"
          >
            {showForm ? 'Cancelar' : '+ Novo Produtor'}
          </button>
        )}
      </div>

      {/* Formulário */}
      {showForm && podeEditar && (
        <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {editingId ? '✏️ Editar Produtor' : '➕ Novo Produtor'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                placeholder="Nome do produtor"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input
                type="text"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Propriedade</label>
              <input
                type="text"
                value={form.property}
                onChange={e => setForm({ ...form, property: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                placeholder="Nome da fazenda, sítio, etc."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
              <input
                type="text"
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                placeholder="Endereço completo"
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-start gap-3 cursor-pointer select-none bg-green-50 border border-green-200 rounded-lg p-3">
                <input
                  type="checkbox"
                  checked={form.atendePaa}
                  onChange={e => setForm({ ...form, atendePaa: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-800">
                    🌾 Atende o PAA (Programa de Aquisição de Alimentos)
                  </span>
                  <span className="block text-xs text-green-800 mt-0.5">
                    Somente produtores marcados aparecem no registro de entregas PAA.
                  </span>
                </span>
              </label>
            </div>

            <div className="md:col-span-2 flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium transition w-full sm:w-auto"
              >
                {isSubmitting ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Cadastrar'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                disabled={isSubmitting}
                className="bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 px-6 py-2.5 rounded-lg transition w-full sm:w-auto"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Busca + filtro */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="🔍 Buscar por nome, endereço ou propriedade..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
        />
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {([
            ['todos', `Todos (${producers.length})`],
            ['paa', `🌾 PAA (${totalPaa})`],
            ['nao-paa', `Sem PAA (${producers.length - totalPaa})`],
          ] as [PaaFilter, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition whitespace-nowrap ${
                filter === value ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Listagem em cards */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border p-4 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-2/3 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-3/4 mb-4" />
              <div className="h-2 bg-gray-200 rounded w-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-6xl mb-4">🚜</p>
          <p className="text-xl">
            {search || filter !== 'todos' ? 'Nenhum produtor encontrado' : 'Nenhum produtor cadastrado'}
          </p>
          <p className="text-sm mt-2">
            {search || filter !== 'todos'
              ? 'Tente outros termos ou remova o filtro'
              : podeEditar
                ? 'Clique em "+ Novo Produtor" para começar'
                : 'Aguarde o cadastro por um administrador'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(producer => {
            const cota = cotas[producer.id]
            const barra = cota ? Math.min(cota.percentual, 100) : 0
            const excedente = cota ? Math.max(cota.usado - cota.teto, 0) : 0

            return (
              <div
                key={producer.id}
                className={`bg-white rounded-xl shadow-sm border p-4 flex flex-col ${
                  !producer.active ? 'opacity-60' : ''
                }`}
              >
                {/* Topo */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">👨‍🌾 {producer.name}</h3>
                    {producer.property && (
                      <p className="text-xs text-green-700 font-medium mt-0.5 truncate">
                        🏡 {producer.property}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        producer.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {producer.active ? 'Ativo' : 'Inativo'}
                    </span>
                    {producer.atendePaa && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">
                        🌾 PAA
                      </span>
                    )}
                  </div>
                </div>

                {/* Informações */}
                <div className="space-y-1.5 text-sm text-gray-600 mt-3">
                  {producer.phone && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 w-5 text-center">📞</span>
                      <PhoneLink phone={producer.phone} />
                    </div>
                  )}
                  {producer.address && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 w-5 text-center">📍</span>
                      <span className="truncate">{producer.address}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="text-gray-400 w-5 text-center">📊</span>
                    <span>
                      {producer._count?.harvests ?? 0} colheita(s) ·{' '}
                      {producer._count?.entregasPaa ?? 0} entrega(s) PAA
                    </span>
                  </div>
                </div>

                {/* 💰 Bloco de cota — só para quem atende PAA */}
                {producer.atendePaa && cota && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-gray-700">
                        💰 Cota PAA
                      </span>
                      <span className={`text-xs font-bold ${CORES_TEXTO[cota.status]}`}>
                        {cota.percentual.toFixed(1)}%
                      </span>
                    </div>

                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${CORES_BARRA[cota.status]}`}
                        style={{ width: `${barra}%` }}
                      />
                    </div>

                    <p className="text-xs text-gray-600 mt-1.5">
                      Consumido <strong>{brl(cota.usado)}</strong> · Saldo{' '}
                      <strong className={CORES_TEXTO[cota.status]}>{brl(cota.saldo)}</strong>
                      <span className="text-gray-400"> de {brl(cota.teto)}</span>
                    </p>

                    {excedente > 0 && (
                      <p className="text-xs text-red-700 font-semibold mt-1">
                        ⚠️ Estourou em {brl(excedente)}
                      </p>
                    )}
                    {cota.ultimoResetAt && (
                      <p className="text-xs text-gray-400 mt-1">
                        ♻️ Contando desde {fmtData(cota.ultimoResetAt)}
                      </p>
                    )}

                    {(podeResetar || isDev) && (
                      <div className="flex gap-2 mt-2.5">
                        {podeResetar && (
                          <button
                            onClick={() => { setMotivoReset(''); setModalReset(producer) }}
                            className="flex-1 text-xs font-medium text-amber-700 hover:bg-amber-50 border border-amber-200 rounded-lg py-1.5 transition"
                          >
                            ↺ Resetar cota
                          </button>
                        )}
                        {isDev && (
                          <button
                            onClick={() => abrirModalCota(producer)}
                            className="flex-1 text-xs font-medium text-purple-700 hover:bg-purple-50 border border-purple-200 rounded-lg py-1.5 transition"
                          >
                            🔒 Definir cota
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Ações de cadastro */}
                {podeEditar && (
                  <div className="flex gap-1 mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleEdit(producer)}
                      className="flex-1 text-center text-blue-600 hover:bg-blue-50 py-2 rounded-lg text-xs font-medium transition"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => handleTogglePaa(producer)}
                      className="flex-1 text-center text-green-700 hover:bg-green-50 py-2 rounded-lg text-xs font-medium transition"
                      title="Alternar participação no PAA"
                    >
                      {producer.atendePaa ? '🌾 Tirar' : '🌾 Pôr'}
                    </button>
                    <button
                      onClick={() => handleToggleActive(producer)}
                      className={`flex-1 text-center py-2 rounded-lg text-xs font-medium transition ${
                        producer.active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                      }`}
                    >
                      {producer.active ? '⛔ Desativar' : '✅ Reativar'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ♻️ Modal de reset */}
      {modalReset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-1">↺ Resetar cota PAA</h3>
            <p className="text-sm text-gray-600 mb-3">
              Produtor: <strong>{modalReset.name}</strong>
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 mb-3">
              ⚠️ <strong>Nenhuma entrega é apagada.</strong> Grava-se um marco datado; o
              acumulado passa a contar dessa data em diante. Histórico e auditoria
              preservados.
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo * <span className="text-gray-400 text-xs">(mín. 5 caracteres)</span>
            </label>
            <textarea
              value={motivoReset}
              onChange={e => setMotivoReset(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              placeholder="Ex.: início de novo ciclo do plano operacional 2027"
            />
           <div className="flex gap-2 mt-4">
  <button
  onClick={confirmarReset}
  disabled={savingModal || motivoReset.trim().length < 5}
  style={{ backgroundColor: '#016630', color: '#fff' }}
  className="flex-1 py-2.5 rounded-lg text-sm font-medium"
>
  {savingModal ? 'Resetando...' : 'Confirmar reset'}
</button>
  <button
    onClick={() => setModalReset(null)}
    disabled={savingModal}
    className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-700 py-2.5 rounded-lg text-sm font-medium transition"
  >
    Cancelar
  </button>
</div>
          </div>
        </div>
      )}

      {/* 🔒 Modal de cota individual (dev) */}
      {modalCota && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-1">🔒 Definir cota individual</h3>
            <p className="text-sm text-gray-600 mb-3">
              Produtor: <strong>{modalCota.name}</strong>
            </p>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-900 mb-3">
              🔒 Ação exclusiva do desenvolvedor. Sobrepõe a cota padrão global
              {cotaPadrao !== null && <> ({brl(cotaPadrao)})</>} apenas para este produtor.
            </div>

            <label className="block text-sm font-medium text-gray-700 mb-1">Cota em R$ *</label>
            <input
              type="text"
              inputMode="decimal"
              value={cotaValor}
              onChange={e => setCotaValor(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="15000"
            />

            <label className="block text-sm font-medium text-gray-700 mb-1 mt-3">
              Justificativa * <span className="text-gray-400 text-xs">(mín. 5 caracteres)</span>
            </label>
            <textarea
              value={cotaNota}
              onChange={e => setCotaNota(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Ex.: Motivo da alteração da cota individual para este produtor"
            />

            <div className="flex gap-2 mt-4">
              <button
  onClick={() => salvarCota(false)}
  disabled={savingModal || !cotaValor.trim() || cotaNota.trim().length < 5}
  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${
    savingModal || !cotaValor.trim() || cotaNota.trim().length < 5
      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
      : 'bg-purple-600 hover:bg-purple-700 text-white'
  }`}
>
  {savingModal ? 'Salvando...' : 'Salvar cota'}
</button>
              <button
                onClick={() => salvarCota(true)}
                disabled={savingModal || cotas[modalCota.id]?.origemTeto !== 'override'}
                className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 py-2.5 rounded-lg text-sm font-medium transition"
                title="Volta a usar a cota padrão global"
              >
                ↩️ Usar padrão
              </button>
            </div>
            <button
              onClick={() => setModalCota(null)}
              disabled={savingModal}
              className="w-full mt-2 text-gray-500 hover:text-gray-700 text-sm py-1.5"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
