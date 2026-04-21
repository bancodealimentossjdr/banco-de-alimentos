'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

type UserRole = 'admin' | 'operador' | 'visualizador'

interface User {
  id: string
  name: string
  email: string
  role: UserRole
  active: boolean
  createdAt: string
}

const USER_ROLES: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'operador', label: 'Operador' },
  { value: 'visualizador', label: 'Visualizador' },
]

const roleBadgeClass = (role: UserRole) => {
  switch (role) {
    case 'admin':
      return 'bg-purple-100 text-purple-700'
    case 'operador':
      return 'bg-blue-100 text-blue-700'
    case 'visualizador':
      return 'bg-gray-100 text-gray-700'
  }
}

const getRoleLabel = (value: string) =>
  USER_ROLES.find(r => r.value === value)?.label || value

export default function UsuariosPage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'operador' as UserRole,
  })

  // 🔒 Proteção: só admin entra
  useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user.role !== 'admin') {
      router.replace('/')
    }
  }, [session, status, router])

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/usuarios')
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Erro ao buscar usuários:', err)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user.role === 'admin') fetchUsers()
  }, [session])

  const resetForm = () => {
    setForm({ name: '', email: '', password: '', role: 'operador' })
    setEditingId(null)
    setShowForm(false)
  }

  const startEdit = (user: User) => {
    setForm({
      name: user.name,
      email: user.email,
      password: '', // senha opcional na edição
      role: user.role,
    })
    setEditingId(user.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingId ? `/api/usuarios/${editingId}` : '/api/usuarios'
      const method = editingId ? 'PUT' : 'POST'

      // Na edição, só envia senha se preenchida
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        role: form.role,
      }
      if (!editingId || form.password.trim() !== '') {
        payload.password = form.password
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        resetForm()
        fetchUsers()
      } else {
        const data = await res.json()
        alert(data.error || 'Erro ao salvar')
      }
    } catch (error) {
      console.error('Erro ao salvar usuário:', error)
      alert('Erro ao salvar usuário')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir "${name}"?`)) return
    try {
      const res = await fetch(`/api/usuarios/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchUsers()
      } else {
        const data = await res.json()
        alert(data.error || 'Erro ao excluir')
      }
    } catch (error) {
      console.error('Erro ao excluir:', error)
      alert('Erro ao excluir usuário')
    }
  }

  const handleToggleActive = async (user: User) => {
    const action = user.active ? 'desativar' : 'ativar'
    if (!confirm(`Deseja ${action} "${user.name}"?`)) return
    try {
      const res = await fetch(`/api/usuarios/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !user.active }),
      })
      if (res.ok) {
        fetchUsers()
      } else {
        const data = await res.json()
        alert(data.error || `Erro ao ${action}`)
      }
    } catch (error) {
      console.error(`Erro ao ${action}:`, error)
      alert(`Erro ao ${action} usuário`)
    }
  }

  // 🔒 Enquanto carrega ou redireciona
  if (status === 'loading' || !session || session.user.role !== 'admin') {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header da página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">👥 Usuários</h2>
        <button
          onClick={() => { if (showForm) resetForm(); else setShowForm(true) }}
          className="bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-lg font-medium transition w-full sm:w-auto text-center"
        >
          {showForm ? 'Cancelar' : '+ Novo Usuário'}
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-4 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {editingId ? '✏️ Editar Usuário' : 'Novo Usuário'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Senha {editingId ? '(deixe em branco para manter)' : '*'}
              </label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                placeholder={editingId ? '••••••' : 'Mínimo 6 caracteres'}
                required={!editingId}
                minLength={editingId ? undefined : 6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Função *</label>
              <select
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value as UserRole })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
              >
                {USER_ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <button
              type="submit"
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-2.5 rounded-lg font-medium transition w-full sm:w-auto"
            >
              {editingId ? 'Atualizar Usuário' : 'Salvar Usuário'}
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
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-6xl mb-4">👥</p>
          <p className="text-xl">Nenhum usuário cadastrado</p>
          <p className="text-sm mt-2">Clique em &quot;+ Novo Usuário&quot; para começar</p>
        </div>
      ) : (
        <>
          {/* ====== TABELA - md+ ====== */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Nome</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Email</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Função</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Status</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Criado em</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => {
                    const isSelf = session.user.id === user.id
                    return (
                      <tr key={user.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {user.name}
                          {isSelf && (
                            <span className="ml-2 text-xs text-gray-400">(você)</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-600">{user.email}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleBadgeClass(user.role)}`}>
                            {getRoleLabel(user.role)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => !isSelf && handleToggleActive(user)}
                            disabled={isSelf}
                            className={`px-2 py-1 rounded-full text-xs font-medium transition ${user.active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'} ${isSelf ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                            title={isSelf ? 'Você não pode alterar seu próprio status' : ''}
                          >
                            {user.active ? 'Ativo' : 'Inativo'}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-gray-600 text-sm">
                          {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-3">
                            <button
                              onClick={() => startEdit(user)}
                              className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => !isSelf && handleDelete(user.id, user.name)}
                              disabled={isSelf}
                              className={`text-sm font-medium ${isSelf ? 'text-gray-300 cursor-not-allowed' : 'text-red-500 hover:text-red-700'}`}
                              title={isSelf ? 'Você não pode excluir sua própria conta' : ''}
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ====== CARDS - mobile ====== */}
          <div className="md:hidden space-y-3">
            {users.map(user => {
              const isSelf = session.user.id === user.id
              return (
                <div key={user.id} className="bg-white rounded-xl shadow-sm border p-4">
                  {/* Topo: nome + status */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">
                        {user.name}
                        {isSelf && (
                          <span className="ml-2 text-xs font-normal text-gray-400">(você)</span>
                        )}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleBadgeClass(user.role)}`}>
                          {getRoleLabel(user.role)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => !isSelf && handleToggleActive(user)}
                      disabled={isSelf}
                      className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium transition ${user.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} ${isSelf ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                    >
                      {user.active ? 'Ativo' : 'Inativo'}
                    </button>
                  </div>

                  {/* Informações */}
                  <div className="space-y-1.5 text-sm text-gray-600 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 w-5 text-center">✉️</span>
                      <span className="truncate">{user.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 w-5 text-center">📅</span>
                      <span>Criado em {new Date(user.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => startEdit(user)}
                      className="flex-1 text-center text-blue-600 hover:bg-blue-50 py-2 rounded-lg text-sm font-medium transition"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => !isSelf && handleDelete(user.id, user.name)}
                      disabled={isSelf}
                      className={`flex-1 text-center py-2 rounded-lg text-sm font-medium transition ${isSelf ? 'text-gray-300 cursor-not-allowed' : 'text-red-600 hover:bg-red-50'}`}
                    >
                      🗑️ Excluir
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
