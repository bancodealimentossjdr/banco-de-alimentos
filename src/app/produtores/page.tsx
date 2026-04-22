'use client'

import { useEffect, useState } from 'react'
import PhoneLink from '@/components/PhoneLink'
import { usePermissions } from '@/hooks/usePermissions'

interface Producer {
  id: string
  name: string
  phone: string
  address: string
  property: string
  active: boolean
  createdAt: string
}

export default function ProdutoresPage() {
  const { canEdit } = usePermissions()
  const podeEditar = canEdit('produtores')

  const [producers, setProducers] = useState<Producer[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    property: '',
  })

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
    setForm({ name: '', phone: '', address: '', property: '' })
    setEditingId(null)
    setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingId) {
        await fetch(`/api/produtores/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      } else {
        await fetch('/api/produtores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      }
      resetForm()
      fetchProducers()
    } catch (error) {
      console.error('Erro ao salvar produtor:', error)
    }
  }

  const handleEdit = (producer: Producer) => {
    setForm({
      name: producer.name,
      phone: producer.phone || '',
      address: producer.address || '',
      property: producer.property || '',
    })
    setEditingId(producer.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleToggleActive = async (producer: Producer) => {
    const action = producer.active ? 'desativar' : 'reativar'
    if (!confirm(`Deseja ${action} o produtor "${producer.name}"?`)) return
    try {
      await fetch(`/api/produtores/${producer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !producer.active }),
      })
      fetchProducers()
    } catch (error) {
      console.error('Erro ao alterar status:', error)
    }
  }

  const filtered = producers.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.address && p.address.toLowerCase().includes(search.toLowerCase())) ||
    (p.property && p.property.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div>
      {/* Header da página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">🚜 Produtores Rurais</h2>
          <p className="text-gray-500 text-sm mt-0.5">{producers.length} produtor(es) cadastrado(s)</p>
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
            <div className="md:col-span-2 flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-medium transition w-full sm:w-auto"
              >
                {editingId ? 'Salvar Alterações' : 'Cadastrar'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2.5 rounded-lg transition w-full sm:w-auto"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Busca */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="🔍 Buscar por nome, endereço ou propriedade..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
        />
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
            {search ? 'Nenhum produtor encontrado' : 'Nenhum produtor cadastrado'}
          </p>
          <p className="text-sm mt-2">
            {search
              ? 'Tente buscar com outros termos'
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
