'use client'

import { useEffect, useState } from 'react'
import PhoneLink from '@/components/PhoneLink'
import { usePermissions } from '@/hooks/usePermissions'

interface Beneficiary {
  id: string
  name: string
  type: string
  address: string | null
  phone: string | null
  contact: string | null
  status: string
  notes: string | null
  _count: { distributions: number }
}

const INSTITUTION_TYPES = [
  { value: 'cras', label: 'CRAS' },
  { value: 'acolhimento', label: 'Instituição de Acolhimento' },
  { value: 'albergue', label: 'Albergue' },
  { value: 'casa_recuperacao', label: 'Casa de Recuperação' },
  { value: 'apae', label: 'APAE' },
  { value: 'creche', label: 'Creche' },
  { value: 'escola', label: 'Escola' },
  { value: 'igreja', label: 'Igreja / Paróquia' },
  { value: 'ong', label: 'ONG' },
  { value: 'asilo', label: 'Asilo / Lar de Idosos' },
  { value: 'outros', label: 'Outros' },
]

export default function BeneficiariosPage() {
  const { canEdit } = usePermissions()
  const podeEditar = canEdit('beneficiarios')

  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', type: 'cras', address: '', phone: '', contact: '', status: 'ativo', notes: '',
  })

  const fetchBeneficiaries = async () => {
    try {
      const res = await fetch('/api/beneficiarios')
      const data = await res.json()
      setBeneficiaries(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Erro ao buscar instituições:', error)
      setBeneficiaries([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBeneficiaries() }, [])

  const resetForm = () => {
    setForm({ name: '', type: 'cras', address: '', phone: '', contact: '', status: 'ativo', notes: '' })
    setEditingId(null)
    setShowForm(false)
  }

  const startEdit = (b: Beneficiary) => {
    setForm({
      name: b.name,
      type: b.type,
      address: b.address || '',
      phone: b.phone || '',
      contact: b.contact || '',
      status: b.status,
      notes: b.notes || '',
    })
    setEditingId(b.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingId ? `/api/beneficiarios/${editingId}` : '/api/beneficiarios'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        resetForm()
        fetchBeneficiaries()
      } else {
        const data = await res.json()
        alert(data.error || 'Erro ao salvar')
      }
    } catch (error) {
      console.error('Erro ao salvar instituição:', error)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir "${name}"?`)) return
    try {
      const res = await fetch(`/api/beneficiarios/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchBeneficiaries()
      } else {
        const data = await res.json()
        alert(data.error || 'Erro ao excluir')
      }
    } catch (error) {
      console.error('Erro ao excluir:', error)
      alert('Erro ao excluir instituição')
    }
  }

  const getTypeLabel = (value: string) =>
    INSTITUTION_TYPES.find(t => t.value === value)?.label || value

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'ativo': return 'bg-green-100 text-green-700'
      case 'suspenso': return 'bg-yellow-100 text-yellow-700'
      case 'inativo': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div>
      {/* Header da página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">👥 Instituições Atendidas</h2>
        {podeEditar && (
          <button
            onClick={() => { if (showForm) resetForm(); else setShowForm(true) }}
            className="bg-purple-500 hover:bg-purple-600 text-white px-5 py-2.5 rounded-lg font-medium transition w-full sm:w-auto text-center"
          >
            {showForm ? 'Cancelar' : '+ Nova Instituição'}
          </button>
        )}
      </div>

      {/* Formulário */}
      {showForm && podeEditar && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-4 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {editingId ? '✏️ Editar Instituição' : 'Nova Instituição'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                required
                placeholder="Ex: CRAS Norte"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
              <select
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
              >
                {INSTITUTION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
              >
                <option value="ativo">Ativo</option>
                <option value="suspenso">Suspenso</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
              <input
                type="text"
                value={form.contact}
                onChange={e => setForm({ ...form, contact: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input
                type="text"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                placeholder="(32) 99999-8888"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
              <input
                type="text"
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
              <textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                rows={2}
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <button
              type="submit"
              className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2.5 rounded-lg font-medium transition w-full sm:w-auto"
            >
              {editingId ? 'Atualizar Instituição' : 'Salvar Instituição'}
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        </div>
      ) : beneficiaries.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-6xl mb-4">👥</p>
          <p className="text-xl">Nenhuma instituição cadastrada</p>
          {podeEditar && (
            <p className="text-sm mt-2">Clique em &quot;+ Nova Instituição&quot; para começar</p>
          )}
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
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Responsável</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Telefone</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Entregas</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Status</th>
                    {podeEditar && (
                      <th className="px-6 py-3 text-sm font-semibold text-gray-600">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {beneficiaries.map(b => (
                    <tr key={b.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{b.name}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                          {getTypeLabel(b.type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{b.contact || '-'}</td>
                      <td className="px-6 py-4 text-gray-600">
                        <PhoneLink phone={b.phone} />
                      </td>
                      <td className="px-6 py-4 text-gray-600">{b._count.distributions}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusStyle(b.status)}`}>
                          {b.status}
                        </span>
                      </td>
                      {podeEditar && (
                        <td className="px-6 py-4">
                          <div className="flex gap-3">
                            <button
                              onClick={() => startEdit(b)}
                              className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDelete(b.id, b.name)}
                              className="text-red-500 hover:text-red-700 text-sm font-medium"
                            >
                              Excluir
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
            {beneficiaries.map(b => (
              <div key={b.id} className="bg-white rounded-xl shadow-sm border p-4 overflow-hidden">
                {/* Topo: nome + status */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-gray-900 break-words">{b.name}</h3>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                      {getTypeLabel(b.type)}
                    </span>
                  </div>
                  <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusStyle(b.status)}`}>
                    {b.status}
                  </span>
                </div>

                {/* Informações */}
                <div className="space-y-1.5 text-sm text-gray-600 mb-3">
                  {b.contact && (
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="text-gray-400 w-5 text-center shrink-0">👤</span>
                      <span className="min-w-0 break-words">{b.contact}</span>
                    </div>
                  )}
                  {b.phone && (
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="text-gray-400 w-5 text-center shrink-0">📞</span>
                      <div className="min-w-0 break-words">
                        <PhoneLink phone={b.phone} />
                      </div>
                    </div>
                  )}
                  {b.address && (
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="text-gray-400 w-5 text-center shrink-0">📍</span>
                      <span className="min-w-0 break-words">{b.address}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="text-gray-400 w-5 text-center shrink-0">📦</span>
                    <span className="min-w-0">{b._count.distributions} {b._count.distributions === 1 ? 'entrega' : 'entregas'}</span>
                  </div>
                </div>

                {/* Observações */}
                {b.notes && (
                  <p className="text-xs text-gray-400 italic mb-3 break-words">📝 {b.notes}</p>
                )}

                {/* Ações — só aparecem pra quem pode editar */}
                {podeEditar && (
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => startEdit(b)}
                      className="flex-1 text-center text-blue-600 hover:bg-blue-50 py-2 rounded-lg text-sm font-medium transition"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => handleDelete(b.id, b.name)}
                      className="flex-1 text-center text-red-600 hover:bg-red-50 py-2 rounded-lg text-sm font-medium transition"
                    >
                      🗑️ Excluir
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
