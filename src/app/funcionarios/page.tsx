'use client'

import { useEffect, useState } from 'react'
import PhoneLink from '@/components/PhoneLink'
import { usePermissions } from '@/hooks/usePermissions'
import { useFormSubmit } from '@/hooks/useFormSubmit'

interface Employee {
  id: string
  name: string
  role: string | null
  phone: string | null
  active: boolean
  _count: {
    donationsAsEmployee1: number
    donationsAsEmployee2: number
    donationsAsEmployee3: number
    distributions: number
    harvestsAsEmployee1: number
    harvestsAsEmployee2: number
    harvestsAsEmployee3: number
  }
}

// Helper: soma as 3 relações de coletas (doações)
const getColetas = (emp: Employee) =>
  (emp._count?.donationsAsEmployee1 || 0) +
  (emp._count?.donationsAsEmployee2 || 0) +
  (emp._count?.donationsAsEmployee3 || 0)

const getEntregas = (emp: Employee) => emp._count?.distributions || 0

// 🌾 Helper: soma as 3 relações de colheitas
const getColheitas = (emp: Employee) =>
  (emp._count?.harvestsAsEmployee1 || 0) +
  (emp._count?.harvestsAsEmployee2 || 0) +
  (emp._count?.harvestsAsEmployee3 || 0)

export default function FuncionariosPage() {
  const { canEdit } = usePermissions()
  const podeEditar = canEdit('funcionarios')

  // 🔒 Trava de duplo clique
  const { isSubmitting, handleSubmit: runSubmit } = useFormSubmit()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', role: '', phone: '' })

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/funcionarios')
      const data = await res.json()
      setEmployees(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Erro ao buscar funcionários:', error)
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEmployees() }, [])

  const resetForm = () => {
    setForm({ name: '', role: '', phone: '' })
    setEditingId(null)
    setShowForm(false)
  }

  const startEdit = (emp: Employee) => {
    setForm({
      name: emp.name,
      role: emp.role || '',
      phone: emp.phone || '',
    })
    setEditingId(emp.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 🔒 Envolve a chamada de salvar na trava de duplo clique
    await runSubmit(async () => {
      try {
        const url = editingId ? `/api/funcionarios/${editingId}` : '/api/funcionarios'
        const method = editingId ? 'PUT' : 'POST'
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (res.ok) {
          resetForm()
          fetchEmployees()
        } else {
          const data = await res.json()
          alert(data.error || 'Erro ao salvar')
        }
      } catch (error) {
        console.error('Erro ao salvar funcionário:', error)
      }
    })
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir "${name}"?`)) return
    try {
      const res = await fetch(`/api/funcionarios/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchEmployees()
      } else {
        const data = await res.json()
        alert(data.error || 'Erro ao excluir')
      }
    } catch (error) {
      console.error('Erro ao excluir:', error)
      alert('Erro ao excluir funcionário')
    }
  }

  return (
    <div>
      {/* Header da página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">👷 Funcionários</h2>
        {podeEditar && (
          <button
            onClick={() => { if (showForm) resetForm(); else setShowForm(true) }}
            className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-lg font-medium transition w-full sm:w-auto text-center"
          >
            {showForm ? 'Cancelar' : '+ Novo Funcionário'}
          </button>
        )}
      </div>

      {/* Formulário */}
      {showForm && podeEditar && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-4 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {editingId ? '✏️ Editar Funcionário' : 'Novo Funcionário'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Função</label>
              <input
                type="text"
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                placeholder="Ex: Motorista, Auxiliar, Coordenador"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input
                type="text"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                placeholder="(32) 99999-8888"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium transition w-full sm:w-auto"
            >
              {isSubmitting
                ? 'Salvando...'
                : editingId ? 'Atualizar Funcionário' : 'Salvar Funcionário'}
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

      {/* Listagem */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
        </div>
      ) : employees.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-6xl mb-4">👷</p>
          <p className="text-xl">Nenhum funcionário cadastrado</p>
          {podeEditar && (
            <p className="text-sm mt-2">Clique em &quot;+ Novo Funcionário&quot; para começar</p>
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
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Função</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Telefone</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Coletas</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Entregas</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Colheitas</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Status</th>
                    {podeEditar && (
                      <th className="px-6 py-3 text-sm font-semibold text-gray-600">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => (
                    <tr key={emp.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{emp.name}</td>
                      <td className="px-6 py-4 text-gray-600">{emp.role || '-'}</td>
                      <td className="px-6 py-4 text-gray-600">
                        <PhoneLink phone={emp.phone} />
                      </td>
                      <td className="px-6 py-4 text-gray-600">{getColetas(emp)}</td>
                      <td className="px-6 py-4 text-gray-600">{getEntregas(emp)}</td>
                      <td className="px-6 py-4 text-gray-600">{getColheitas(emp)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${emp.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {emp.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      {podeEditar && (
                        <td className="px-6 py-4">
                          <div className="flex gap-3">
                            <button
                              onClick={() => startEdit(emp)}
                              className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDelete(emp.id, emp.name)}
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
            {employees.map(emp => {
              const coletas = getColetas(emp)
              const entregas = getEntregas(emp)
              const colheitas = getColheitas(emp)
              const totalAtividades = coletas + entregas + colheitas
              return (
                <div key={emp.id} className="bg-white rounded-xl shadow-sm border p-4">
                  {/* Topo: nome + status */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{emp.name}</h3>
                      {emp.role && (
                        <span className="text-xs text-gray-500">{emp.role}</span>
                      )}
                    </div>
                    <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium ${emp.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {emp.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  {/* Telefone clicável */}
                  {emp.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                      <span className="text-gray-400">📞</span>
                      <PhoneLink phone={emp.phone} />
                    </div>
                  )}

                  {/* Contadores: coletas + entregas + colheitas + total */}
                  <div className="grid grid-cols-4 gap-2 text-center mb-3">
                    <div className="bg-blue-50 rounded-lg py-2">
                      <p className="text-[10px] text-blue-600 font-medium">Coletas</p>
                      <p className="text-base font-bold text-blue-700">{coletas}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg py-2">
                      <p className="text-[10px] text-orange-600 font-medium">Entregas</p>
                      <p className="text-base font-bold text-orange-700">{entregas}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg py-2">
                      <p className="text-[10px] text-green-600 font-medium">Colheitas</p>
                      <p className="text-base font-bold text-green-700">{colheitas}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg py-2">
                      <p className="text-[10px] text-gray-500 font-medium">Total</p>
                      <p className="text-base font-bold text-gray-700">{totalAtividades}</p>
                    </div>
                  </div>

                  {/* Ações — só aparecem pra quem pode editar */}
                  {podeEditar && (
                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                      <button
                        onClick={() => startEdit(emp)}
                        className="flex-1 text-center text-blue-600 hover:bg-blue-50 py-2 rounded-lg text-sm font-medium transition"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => handleDelete(emp.id, emp.name)}
                        className="flex-1 text-center text-red-600 hover:bg-red-50 py-2 rounded-lg text-sm font-medium transition"
                      >
                        🗑️ Excluir
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
