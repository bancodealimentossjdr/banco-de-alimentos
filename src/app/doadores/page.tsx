'use client'

import { useEffect, useState } from 'react'

interface Donor {
  id: string
  name: string
  type: string
  category: string
  contact: string | null
  phone: string | null
  email: string | null
  address: string | null
  active: boolean
  _count: { donations: number }
}

const DONOR_CATEGORIES = [
  { value: 'supermercado', label: 'Supermercado' },
  { value: 'pessoa_fisica', label: 'Pessoa Física' },
  { value: 'produtor_rural', label: 'Produtor Rural' },
  { value: 'governo_federal', label: 'Governo Federal' },
  { value: 'outros', label: 'Outros' },
]

export default function DoadoresPage() {
  const [donors, setDonors] = useState<Donor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', type: 'PJ', category: 'supermercado',
    contact: '', phone: '', email: '', address: '',
  })

  const fetchDonors = async () => {
    try {
      const res = await fetch('/api/doadores')
      const data = await res.json()
      setDonors(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Erro ao buscar doadores:', err)
      setDonors([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDonors() }, [])

  const resetForm = () => {
    setForm({ name: '', type: 'PJ', category: 'supermercado', contact: '', phone: '', email: '', address: '' })
    setEditingId(null)
    setShowForm(false)
  }

  const startEdit = (donor: Donor) => {
    setForm({
      name: donor.name,
      type: donor.type,
      category: donor.category,
      contact: donor.contact || '',
      phone: donor.phone || '',
      email: donor.email || '',
      address: donor.address || '',
    })
    setEditingId(donor.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingId ? `/api/doadores/${editingId}` : '/api/doadores'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        resetForm()
        fetchDonors()
      } else {
        const data = await res.json()
        alert(data.error || 'Erro ao salvar')
      }
    } catch (error) {
      console.error('Erro ao salvar doador:', error)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir "${name}"?`)) return
    try {
      const res = await fetch(`/api/doadores/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchDonors()
      } else {
        const data = await res.json()
        alert(data.error || 'Erro ao excluir')
      }
    } catch (error) {
      console.error('Erro ao excluir:', error)
      alert('Erro ao excluir doador')
    }
  }

  const getCategoryLabel = (value: string) =>
    DONOR_CATEGORIES.find(c => c.value === value)?.label || value

  return (
    <div>
      {/* Header da página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">🤝 Doadores</h2>
        <button
          onClick={() => { if (showForm) resetForm(); else setShowForm(true) }}
          className="bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-lg font-medium transition w-full sm:w-auto text-center"
        >
          {showForm ? 'Cancelar' : '+ Novo Doador'}
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-4 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {editingId ? '✏️ Editar Doador' : 'Novo Doador'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
              <select
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
              >
                <option value="PJ">Pessoa Jurídica</option>
                <option value="PF">Pessoa Física</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
              <select
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
              >
                {DONOR_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Responsável/Contato</label>
              <input
                type="text"
                value={form.contact}
                onChange={e => setForm({ ...form, contact: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input
                type="text"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
              <input
                type="text"
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <button
              type="submit"
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-2.5 rounded-lg font-medium transition w-full sm:w-auto"
            >
              {editingId ? 'Atualizar Doador' : 'Salvar Doador'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2.5 rounded-lg font-medium transition w-full sm:w-auto"
              >
                Cancelar Edição
              </button>
            )}
          </div>
        </form>
      )}

      {/* Listagem */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
        </div>
      ) : donors.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-6xl mb-4">🤝</p>
          <p className="text-xl">Nenhum doador cadastrado</p>
          <p className="text-sm mt-2">Clique em &quot;+ Novo Doador&quot; para começar</p>
        </div>
      ) : (
        <>
          {/* ====== TABELA - só aparece em telas md+ ====== */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Nome</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Tipo</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Categoria</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Telefone</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Doações</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Status</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {donors.map(donor => (
                    <tr key={donor.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{donor.name}</td>
                      <td className="px-6 py-4 text-gray-600">{donor.type}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          {getCategoryLabel(donor.category)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{donor.phone || '-'}</td>
                      <td className="px-6 py-4 text-gray-600">{donor._count.donations}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${donor.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {donor.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-3">
                          <button
                            onClick={() => startEdit(donor)}
                            className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(donor.id, donor.name)}
                            className="text-red-500 hover:text-red-700 text-sm font-medium"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ====== CARDS - só aparece no mobile (< md) ====== */}
          <div className="md:hidden space-y-3">
            {donors.map(donor => (
              <div key={donor.id} className="bg-white rounded-xl shadow-sm border p-4">
                {/* Topo: nome + status */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{donor.name}</h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                        {donor.type}
                      </span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        {getCategoryLabel(donor.category)}
                      </span>
                    </div>
                  </div>
                  <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium ${donor.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {donor.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                {/* Informações */}
                <div className="space-y-1.5 text-sm text-gray-600 mb-3">
                  {donor.contact && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 w-5 text-center">👤</span>
                      <span>{donor.contact}</span>
                    </div>
                  )}
                  {donor.phone && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 w-5 text-center">📞</span>
                      <a href={`tel:${donor.phone}`} className="text-blue-600 underline">{donor.phone}</a>
                    </div>
                  )}
                  {donor.email && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 w-5 text-center">✉️</span>
                      <a href={`mailto:${donor.email}`} className="text-blue-600 underline truncate">{donor.email}</a>
                    </div>
                  )}
                  {donor.address && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 w-5 text-center">📍</span>
                      <span className="truncate">{donor.address}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 w-5 text-center">📦</span>
                    <span>{donor._count.donations} {donor._count.donations === 1 ? 'doação' : 'doações'}</span>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => startEdit(donor)}
                    className="flex-1 text-center text-blue-600 hover:bg-blue-50 py-2 rounded-lg text-sm font-medium transition"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={() => handleDelete(donor.id, donor.name)}
                    className="flex-1 text-center text-red-600 hover:bg-red-50 py-2 rounded-lg text-sm font-medium transition"
                  >
                    🗑️ Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
