'use client'

import { useEffect, useState } from 'react'
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

export default function ProdutoresPage() {
  const { canEdit } = usePermissions()
  const podeEditar = canEdit('produtores')

  // 🔒 Trava de duplo clique
  const { isSubmitting, handleSubmit: runSubmit } = useFormSubmit()

  const [producers, setProducers] = useState<Producer[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<PaaFilter>('todos')
  const [form, setForm] = useState(EMPTY_FORM)

  const fetchProducers = async () => {
    try {
      const res = await fetch('/api/produtores')
      const data = await res.json()
      setProducers(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Erro ao buscar produtores:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducers()
  }, [])

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
          fetchProducers()
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

  const handleToggleActive = async (producer: Producer) => {
    const action = producer.active ? 'desativar' : 'reativar'
    if (!confirm(`Deseja ${action} o produtor "${producer.name}"?`)) return
    try {
      const res = await fetch(`/api/produtores/${producer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !producer.active }),
      })
      if (res.ok) {
        fetchProducers()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Erro ao alterar status')
      }
    } catch (error) {
      console.error('Erro ao alterar status:', error)
      alert('Erro ao alterar status')
    }
  }

  // 🌾 Toggle rápido da flag PAA direto na listagem
  const handleTogglePaa = async (producer: Producer) => {
    try {
      const res = await fetch(`/api/produtores/${producer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ atendePaa: !producer.atendePaa }),
      })
      if (res.ok) {
        fetchProducers()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Erro ao alterar flag PAA')
      }
    } catch (error) {
      console.error('Erro ao alterar flag PAA:', error)
      alert('Erro ao alterar flag PAA')
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
      {/* Header da página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">🚜 Produtores Rurais</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {producers.length} produtor(es) cadastrado(s) · {totalPaa} no PAA
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

            {/* 🌾 Flag PAA */}
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
                {isSubmitting
                  ? 'Salvando...'
                  : editingId ? 'Salvar Alterações' : 'Cadastrar'}
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

      {/* Busca + filtro PAA */}
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

      {/* Listagem */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
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
        <>
          {/* ====== TABELA - só aparece em telas md+ ====== */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Nome</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Propriedade</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Endereço</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Telefone</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">PAA</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                    {podeEditar && (
                      <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map(producer => (
                    <tr key={producer.id} className={`hover:bg-gray-50 ${!producer.active ? 'opacity-50' : ''}`}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{producer.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{producer.property || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{producer.address || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <PhoneLink phone={producer.phone} />
                      </td>
                      <td className="px-6 py-4">
                        {producer.atendePaa ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            🌾 Sim
                            {producer._count?.entregasPaa
                              ? ` · ${producer._count.entregasPaa}`
                              : ''}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${producer.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {producer.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      {podeEditar && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEdit(producer)}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleTogglePaa(producer)}
                              className="text-green-700 hover:text-green-900 text-sm font-medium"
                              title="Alternar participação no PAA"
                            >
                              {producer.atendePaa ? 'Tirar PAA' : 'Pôr no PAA'}
                            </button>
                            <button
                              onClick={() => handleToggleActive(producer)}
                              className={`text-sm font-medium ${producer.active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}
                            >
                              {producer.active ? 'Desativar' : 'Reativar'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ====== CARDS - só aparece no mobile (< md) ====== */}
          <div className="md:hidden space-y-3">
            {filtered.map(producer => (
              <div
                key={producer.id}
                className={`bg-white rounded-xl shadow-sm border p-4 ${!producer.active ? 'opacity-60' : ''}`}
              >
                {/* Topo: nome + status */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{producer.name}</h3>
                    {producer.property && (
                      <p className="text-xs text-green-700 font-medium mt-0.5">🏡 {producer.property}</p>
                    )}
                    {producer.atendePaa && (
                      <span className="inline-flex mt-1 px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-bold">
                        🌾 PAA
                        {producer._count?.entregasPaa
                          ? ` · ${producer._count.entregasPaa} entrega(s)`
                          : ''}
                      </span>
                    )}
                  </div>
                  <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-semibold ${producer.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {producer.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                {/* Informações */}
                <div className="space-y-1.5 text-sm text-gray-600 mb-3">
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
                </div>

                {/* Ações — só aparecem pra quem pode editar */}
                {podeEditar && (
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => handleEdit(producer)}
                      className="flex-1 text-center text-blue-600 hover:bg-blue-50 py-2 rounded-lg text-sm font-medium transition"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => handleToggleActive(producer)}
                      className={`flex-1 text-center py-2 rounded-lg text-sm font-medium transition ${
                        producer.active
                          ? 'text-red-600 hover:bg-red-50'
                          : 'text-green-600 hover:bg-green-50'
                      }`}
                    >
                      {producer.active ? '⛔ Desativar' : '✅ Reativar'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
