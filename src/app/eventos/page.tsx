'use client'
import { usePermissions } from '@/hooks/usePermissions'
import { useFormSubmit } from '@/hooks/useFormSubmit'
import { useApi } from '@/hooks/useApi'
import { useState } from 'react'
import Link from 'next/link'

type EventoStatus = 'RASCUNHO' | 'ATIVO' | 'ENCERRADO'

interface LocalForm { id?: string; nome: string; endereco: string }
interface Local {
  id: string
  nome: string
  endereco: string | null
  _count?: { recebimentos: number }
}

// 🔄 17.4 — alimento do evento agora aponta pra um Product
interface Alimento {
  id: string
  ordem: number
  product: { id: string; name: string; unit: string }
}

// 🆕 17.4 — produto do catálogo global (para o <select>)
interface Product {
  id: string
  name: string
  unit: string
  active: boolean
}

interface Evento {
  id: string
  nome: string
  descricao: string | null
  dataInicio: string
  dataFim: string | null
  status: EventoStatus
  integraEstoque: boolean
  locais: Local[]
  alimentos?: Alimento[]
  criadoPor?: { id: string; name: string } | null
  encerradoPor?: { id: string; name: string } | null
  encerradoEm?: string | null
  _count?: { recebimentos: number; operadores: number; locais: number; alimentos: number }
}

interface EventoFormState {
  nome: string
  descricao: string
  dataInicio: string
  dataFim: string
  integraEstoque: boolean
}

const STATUS_BADGE: Record<EventoStatus, { label: string; cls: string }> = {
  RASCUNHO: { label: '📝 Rascunho', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  ATIVO: { label: '🟢 Ativo', cls: 'bg-green-100 text-green-700 border-green-200' },
  ENCERRADO: { label: '⏹️ Encerrado', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
}

export default function EventosPage() {
  const { canEdit, canDelete } = usePermissions()
  const podeGerenciar = canEdit('eventos')
  const podeExcluir = canDelete('eventos')

  const { isSubmitting, handleSubmit: runSubmit } = useFormSubmit()

  const {
    data: eventosData,
    isLoading,
    mutate: mutateEventos,
  } = useApi<Evento[]>('/api/eventos', { dedupingInterval: 10_000 })
  const eventos = eventosData ?? []
  const loading = isLoading && !eventosData

    // 🆕 17.4 — catálogo global de produtos ATIVOS para o <select>
  // Rota correta é /api/produtos (PT). Filtro ?active=true feito no servidor.
  const { data: productsData } = useApi<Product[]>('/api/produtos?active=true', {
    dedupingInterval: 30_000,
  })
  const produtos = productsData ?? []


  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [form, setForm] = useState<EventoFormState>({
    nome: '',
    descricao: '',
    dataInicio: new Date().toISOString().split('T')[0],
    dataFim: '',
    integraEstoque: true,
  })
  const [locais, setLocais] = useState<LocalForm[]>([{ nome: '', endereco: '' }])
  // 🔄 17.4 — agora guarda productId selecionado em cada linha
  const [alimentos, setAlimentos] = useState<string[]>([''])

  const resetForm = () => {
    setForm({
      nome: '', descricao: '',
      dataInicio: new Date().toISOString().split('T')[0],
      dataFim: '', integraEstoque: true,
    })
    setLocais([{ nome: '', endereco: '' }])
    setAlimentos([''])
    setEditingId(null)
    setShowForm(false)
  }

  const startEdit = (evento: Evento) => {
    setForm({
      nome: evento.nome,
      descricao: evento.descricao || '',
      dataInicio: evento.dataInicio.split('T')[0],
      dataFim: evento.dataFim ? evento.dataFim.split('T')[0] : '',
      integraEstoque: evento.integraEstoque,
    })
    setLocais(
      (evento.locais?.length ?? 0) > 0
        ? evento.locais.map(l => ({ id: l.id, nome: l.nome, endereco: l.endereco || '' }))
        : [{ nome: '', endereco: '' }]
    )
    // 🔄 17.4 — carrega productId de cada alimento, na ordem
    setAlimentos(
      (evento.alimentos?.length ?? 0) > 0
        ? [...evento.alimentos!].sort((a, b) => a.ordem - b.ordem).map(a => a.product.id)
        : ['']
    )

    setEditingId(evento.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 🏠 Locais dinâmicos
  const addLocal = () => setLocais([...locais, { nome: '', endereco: '' }])
  const removeLocal = (index: number) => {
    if (locais.length > 1) setLocais(locais.filter((_, i) => i !== index))
  }
  const updateLocal = (index: number, field: keyof LocalForm, value: string) => {
    const updated = [...locais]
    updated[index] = { ...updated[index], [field]: value }
    setLocais(updated)
  }

  // 🔄 17.4 — Alimentos dinâmicos (agora productId)
  const addAlimento = () => setAlimentos([...alimentos, ''])
  const removeAlimento = (index: number) => {
    if (alimentos.length > 1) setAlimentos(alimentos.filter((_, i) => i !== index))
  }
  const updateAlimento = (index: number, value: string) => {
    const updated = [...alimentos]
    updated[index] = value
    setAlimentos(updated)
  }

  // 💾 Salvar (criar ou editar)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.nome.trim()) return alert('Informe o nome do evento!')
    if (!form.dataInicio) return alert('Informe a data de início!')

    const validLocais = locais.filter(l => l.nome.trim())
    if (validLocais.length === 0) return alert('Adicione pelo menos um local de coleta!')

    // 🔄 17.4 — valida alimentos (productId selecionado)
    const validAlimentos = alimentos.filter(id => id && id.trim().length > 0)
    if (validAlimentos.length === 0) return alert('Selecione pelo menos um alimento para o evento!')

    if (new Set(validAlimentos).size !== validAlimentos.length) {
      return alert('Não é possível adicionar o mesmo alimento mais de uma vez!')
    }

    await runSubmit(async () => {
      try {
        const url = editingId ? '/api/eventos/' + editingId : '/api/eventos'
        const method = editingId ? 'PUT' : 'POST'
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            descricao: form.descricao || null,
            dataFim: form.dataFim || null,
            locais: validLocais.map(l => ({
              ...(l.id ? { id: l.id } : {}),
              nome: l.nome,
              endereco: l.endereco || null,
            })),
            // 🔄 17.4 — array de { productId }
            alimentos: validAlimentos.map(productId => ({ productId })),
          }),
        })
        if (res.ok) {
          resetForm()
          mutateEventos()
        } else {
          const data = await res.json().catch(() => ({}))
          alert(data.error || `Erro ao salvar (HTTP ${res.status})`)
        }
      } catch (error) {
        console.error('Erro ao salvar:', error)
        alert('Erro ao salvar evento')
      }
    })
  }

  const handleStatus = async (id: string, action: 'ativar' | 'encerrar') => {
    const msg =
      action === 'ativar'
        ? 'Ativar este evento? Ele passará a aceitar recebimentos.'
        : 'Encerrar este evento? Os operadores vinculados perderão o acesso e não será possível reabrir.'
    if (!confirm(msg)) return

    try {
      const res = await fetch('/api/eventos/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        mutateEventos()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || `Erro ao alterar status (HTTP ${res.status})`)
      }
    } catch (error) {
      console.error('Erro ao alterar status:', error)
      alert('Erro ao alterar status do evento')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita.')) return
    try {
      const res = await fetch('/api/eventos/' + id, { method: 'DELETE' })
      if (res.ok) {
        mutateEventos()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || `Erro ao excluir (HTTP ${res.status})`)
      }
    } catch (error) {
      console.error('Erro ao excluir:', error)
      alert('Erro ao excluir evento')
    }
  }

  const formatDate = (date: string) => {
    const raw = date.includes('T') ? date.split('T')[0] : date
    const [year, month, day] = raw.split('-')
    return day + '/' + month + '/' + year
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">🎪 Eventos de Arrecadação</h2>
        {podeGerenciar && (
          <button
            onClick={() => { if (showForm) resetForm(); else setShowForm(true) }}
            className="bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-lg font-medium transition w-full sm:w-auto text-center"
          >
            {showForm ? 'Cancelar' : '+ Novo Evento'}
          </button>
        )}
      </div>

      {/* Formulário */}
      {showForm && podeGerenciar && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-4 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {editingId ? '✏️ Editar Evento' : 'Criar Evento'}
          </h2>

          {/* Nome */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do evento *</label>
            <input
              type="text"
              value={form.nome}
              onChange={e => setForm({ ...form, nome: e.target.value })}
              className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
              placeholder="Ex: Natal Solidário 2026"
              required
            />
          </div>

          {/* Datas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data de início *</label>
              <input
                type="date"
                value={form.dataInicio}
                onChange={e => setForm({ ...form, dataInicio: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data de fim <span className="text-gray-400 text-xs">(opcional)</span>
              </label>
              <input
                type="date"
                value={form.dataFim}
                onChange={e => setForm({ ...form, dataFim: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
              />
            </div>
          </div>

          {/* Descrição */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <textarea
              value={form.descricao}
              onChange={e => setForm({ ...form, descricao: e.target.value })}
              className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
              rows={2}
            />
          </div>

          {/* Integra estoque */}
          <div className="mb-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.integraEstoque}
                onChange={e => setForm({ ...form, integraEstoque: e.target.checked })}
                className="w-4 h-4 text-green-500 rounded focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">
                Integrar recebimentos ao estoque do banco de alimentos
              </span>
            </label>
          </div>

          {/* 🏠 Locais de coleta */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-semibold text-gray-700">Locais de coleta *</label>
              <button type="button" onClick={addLocal} className="text-sm text-green-600 hover:text-green-700 font-medium">
                + Adicionar local
              </button>
            </div>

            {locais.map((local, index) => (
              <div key={index} className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-3 sm:items-end">
                <div className="flex-1">
                  {index === 0 && <label className="block text-xs text-gray-500 mb-1">Nome do local</label>}
                  <input
                    type="text"
                    value={local.nome}
                    onChange={e => updateLocal(index, 'nome', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2.5 text-sm"
                    placeholder="Ex: Supermercado Central"
                    required
                  />
                </div>
                <div className="flex-1">
                  {index === 0 && <label className="block text-xs text-gray-500 mb-1">Endereço (opcional)</label>}
                  <input
                    type="text"
                    value={local.endereco}
                    onChange={e => updateLocal(index, 'endereco', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2.5 text-sm"
                    placeholder="Rua, nº, bairro"
                  />
                </div>
                {locais.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLocal(index)}
                    className="shrink-0 p-2.5 rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 text-lg"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {editingId && (
              <p className="text-xs text-amber-600 mt-2">
                ⚠️ Locais que já têm recebimentos registrados não podem ser removidos.
              </p>
            )}
          </div>

          {/* 🔄 17.4 — 🥫 Alimentos do evento (agora <select> do catálogo) */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm font-semibold text-gray-700">Alimentos do evento *</label>
              <button type="button" onClick={addAlimento} className="text-sm text-green-600 hover:text-green-700 font-medium">
                + Adicionar alimento
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Selecione os produtos do catálogo aceitos neste evento. A ordem definida aqui é a que aparece na tela de campo.
            </p>

            {produtos.length === 0 ? (
              <p className="text-xs text-amber-600">
                ⚠️ Nenhum produto ativo no catálogo. Cadastre produtos na aba <strong>Produtos</strong> antes de criar o evento.
              </p>
            ) : (
              alimentos.map((productId, index) => {
                // produtos já escolhidos nas OUTRAS linhas (evita duplicar no select)
                const escolhidosEmOutras = alimentos.filter((_, i) => i !== index)
                return (
                  <div key={index} className="flex gap-2 mb-2 items-center">
                    <span className="shrink-0 w-6 text-center text-xs font-medium text-gray-400">
                      {index + 1}.
                    </span>
                    <select
                      value={productId}
                      onChange={e => updateAlimento(index, e.target.value)}
                      className="w-full border rounded-lg px-3 py-2.5 text-sm bg-white"
                    >
                      <option value="">— Selecione um produto —</option>
                      {produtos
                        .filter(p => p.id === productId || !escolhidosEmOutras.includes(p.id))
                        .map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.unit})
                          </option>
                        ))}
                    </select>
                    {alimentos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAlimento(index)}
                        className="shrink-0 p-2.5 rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 text-lg"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )
              })
            )}
            {editingId && (
              <p className="text-xs text-amber-600 mt-2">
                ⚠️ Alimentos que já têm recebimentos registrados não podem ser removidos.
              </p>
            )}
          </div>

          {/* Botões */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-green-500 hover:bg-green-600 disabled:bg-green-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium transition w-full sm:w-auto"
            >
              {isSubmitting ? 'Salvando...' : editingId ? 'Atualizar Evento' : 'Criar Evento'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                disabled={isSubmitting}
                className="bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 px-6 py-2.5 rounded-lg font-medium transition w-full sm:w-auto"
              >
                Cancelar Edição
              </button>
            )}
          </div>
        </form>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
        </div>
      ) : eventos.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-6xl mb-4">🎪</p>
          <p className="text-xl">Nenhum evento cadastrado</p>
          {podeGerenciar && (
            <p className="text-sm mt-2">Clique em &quot;+ Novo Evento&quot; para começar</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {eventos.map(evento => {
            const badge = STATUS_BADGE[evento.status]
            const totalRecebimentos = evento._count?.recebimentos ?? 0

            return (
              <div key={evento.id} className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
                {/* Cabeçalho do card */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-gray-900">{evento.nome}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${badge.cls}`}>
                        {badge.label}
                      </span>
                      {evento.integraEstoque && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-600 border border-green-100">
                          📦 Integra estoque
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {formatDate(evento.dataInicio)}
                      {evento.dataFim ? ' — ' + formatDate(evento.dataFim) : ''}
                    </p>
                    {evento.descricao && (
                      <p className="text-sm text-gray-400 mt-1 italic">{evento.descricao}</p>
                    )}
                  </div>

                  {/* Ações */}
                  {podeGerenciar && (
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <Link
                        href={`/eventos/${evento.id}`}
                        className="text-gray-600 hover:text-gray-900 text-sm font-medium px-2 py-1 rounded hover:bg-gray-100 transition"
                      >
                        👁️ Ver detalhes
                      </Link>

                      {evento.status === 'RASCUNHO' && (
                        <button
                          onClick={() => handleStatus(evento.id, 'ativar')}
                          className="text-green-600 hover:text-green-800 text-sm font-medium px-2 py-1 rounded hover:bg-green-50 transition"
                        >
                          ▶️ Ativar
                        </button>
                      )}

                      {evento.status === 'ATIVO' && (
                        <button
                          onClick={() => handleStatus(evento.id, 'encerrar')}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium px-2 py-1 rounded hover:bg-blue-50 transition"
                        >
                          ⏹️ Encerrar
                        </button>
                      )}

                      {evento.status !== 'ENCERRADO' && (
                        <button
                          onClick={() => startEdit(evento)}
                          className="text-blue-500 hover:text-blue-700 text-sm font-medium px-2 py-1 rounded hover:bg-blue-50 transition"
                        >
                          Editar
                        </button>
                      )}

                      {podeExcluir && totalRecebimentos === 0 && (
                        <button
                          onClick={() => handleDelete(evento.id)}
                          className="text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition"
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Métricas + locais + alimentos */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-sm text-gray-700">
                    📊 {totalRecebimentos} {totalRecebimentos === 1 ? 'recebimento' : 'recebimentos'}
                  </span>
                  <span className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-sm text-gray-700">
                    🏠 {(evento.locais?.length ?? 0)} {(evento.locais?.length ?? 0) === 1 ? 'local' : 'locais'}
                  </span>
                  <span className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-sm text-gray-700">
                    🥫 {(evento._count?.alimentos ?? evento.alimentos?.length ?? 0)} {(evento._count?.alimentos ?? evento.alimentos?.length ?? 0) === 1 ? 'alimento' : 'alimentos'}
                  </span>
                </div>

                {/* Tags dos locais */}
                {(evento.locais?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {evento.locais.map(local => (
                      <span
                        key={local.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100"
                      >
                        📍 {local.nome}
                      </span>
                    ))}
                  </div>
                )}

                {/* 🔄 17.4 — Tags dos alimentos (via product.name) */}
                {(evento.alimentos?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {[...evento.alimentos!].sort((a, b) => a.ordem - b.ordem).map(a => (
                      <span
                        key={a.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100"
                      >
                        🥫 {a.product.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Auditoria de encerramento */}
                {evento.status === 'ENCERRADO' && evento.encerradoPor && evento.encerradoEm && (
                  <p className="text-xs text-gray-400 mt-3">
                    Encerrado por {evento.encerradoPor.name} em {formatDate(evento.encerradoEm)}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
