'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import PhoneLink from '@/components/PhoneLink'
import { usePermissions } from '@/hooks/usePermissions'
import { useFormSubmit } from '@/hooks/useFormSubmit'

interface Employee {
  id: string
  name: string
  role: string | null
  phone: string | null
  active: boolean
  hiddenAt?: string | null
  hiddenNota?: string | null
  _count: {
    donationsAsEmployee1: number
    donationsAsEmployee2: number
    donationsAsEmployee3: number
    distributionsAsEmployee1: number
    distributionsAsEmployee2: number
    distributionsAsEmployee3: number
    harvestsAsEmployee1: number
    harvestsAsEmployee2: number
    harvestsAsEmployee3: number
  }
}

const getColetas = (emp: Employee) =>
  (emp._count?.donationsAsEmployee1 || 0) +
  (emp._count?.donationsAsEmployee2 || 0) +
  (emp._count?.donationsAsEmployee3 || 0)

const getEntregas = (emp: Employee) =>
  (emp._count?.distributionsAsEmployee1 || 0) +
  (emp._count?.distributionsAsEmployee2 || 0) +
  (emp._count?.distributionsAsEmployee3 || 0)

const getColheitas = (emp: Employee) =>
  (emp._count?.harvestsAsEmployee1 || 0) +
  (emp._count?.harvestsAsEmployee2 || 0) +
  (emp._count?.harvestsAsEmployee3 || 0)

const estaOculto = (emp: Employee) => Boolean(emp.hiddenAt)

export default function FuncionariosPage() {
  const { canEdit, canToggleVisibility } = usePermissions()
  const podeEditar = canEdit('funcionarios')
  const podeOcultar = canToggleVisibility?.() ?? false

  const { isSubmitting, handleSubmit: runSubmit } = useFormSubmit()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [alterandoId, setAlterandoId] = useState<string | null>(null)
  const [mostrarInativos, setMostrarInativos] = useState(true)
  const [form, setForm] = useState({ name: '', role: '', phone: '' })

  // 👁️ visibilidade (exclusivo dev)
  const [verOcultos, setVerOcultos] = useState(false)
  const [modalOcultar, setModalOcultar] = useState<Employee | null>(null)
  const [notaOcultar, setNotaOcultar] = useState('')

  const fetchEmployees = async (incluirOcultos = verOcultos) => {
    try {
      const qs = incluirOcultos && podeOcultar ? '?ocultos=todos' : ''
      const res = await fetch(`/api/funcionarios${qs}`)
      const data = await res.json()
      setEmployees(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Erro ao buscar funcionários:', error)
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEmployees(verOcultos) }, [verOcultos])

  const resetForm = () => {
    setForm({ name: '', role: '', phone: '' })
    setEditingId(null)
    setShowForm(false)
  }

  const startEdit = (emp: Employee) => {
    setForm({ name: emp.name, role: emp.role || '', phone: emp.phone || '' })
    setEditingId(emp.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
          toast.error(data.error || 'Erro ao salvar')
        }
      } catch (error) {
        console.error('Erro ao salvar funcionário:', error)
      }
    })
  }

  const toggleStatus = async (emp: Employee) => {
    const acao = emp.active ? 'inativar' : 'reativar'
    const aviso = emp.active
      ? `Inativar "${emp.name}"?\n\nEle deixará de aparecer nos formulários de coleta, entrega e colheita, mas todo o histórico é preservado.`
      : `Reativar "${emp.name}"?\n\nEle voltará a aparecer nos formulários.`
    if (!confirm(aviso)) return

    setAlterandoId(emp.id)
    try {
      const res = await fetch(`/api/funcionarios/${emp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !emp.active }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || `Erro ao ${acao} funcionário`)
        return
      }
      await fetchEmployees()
    } catch (error) {
      console.error('Erro ao alterar status:', error)
      toast.error('Falha de conexão')
    } finally {
      setAlterandoId(null)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir "${name}"?\n\nSe houver histórico vinculado, prefira INATIVAR.`)) return
    try {
      const res = await fetch(`/api/funcionarios/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Funcionário excluído')
        fetchEmployees()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Erro ao excluir')
      }
    } catch (error) {
      console.error('Erro ao excluir:', error)
      toast.error('Erro ao excluir funcionário')
    }
  }

  const handleVisibilidade = (emp: Employee) => {
    if (estaOculto(emp)) {
      enviarVisibilidade(emp, false, null)
      return
    }
    setNotaOcultar('')
    setModalOcultar(emp)
  }

  const enviarVisibilidade = async (
    emp: Employee,
    ocultar: boolean,
    nota: string | null,
  ) => {
    setAlterandoId(emp.id)
    try {
      const res = await fetch(`/api/funcionarios/${emp.id}/visibilidade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ocultar, nota }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error(data.error || 'Erro ao alterar visibilidade')
        return
      }

      setModalOcultar(null)
      setNotaOcultar('')
      toast.success(
        ocultar
          ? `${emp.name} oculto para outros usuários`
          : `${emp.name} visível novamente`,
      )

      setEmployees(prev =>
        prev
          .map(e =>
            e.id === emp.id
              ? { ...e, hiddenAt: data.hiddenAt ?? null, hiddenNota: data.hiddenNota ?? null }
              : e,
          )
          .filter(e => (verOcultos ? true : !estaOculto(e))),
      )
    } catch (error) {
      console.error('Erro ao alterar visibilidade:', error)
      toast.error('Falha de conexão')
    } finally {
      setAlterandoId(null)
    }
  }

  const totalInativos = employees.filter(e => !e.active).length
  const totalOcultos = employees.filter(estaOculto).length
  const employeesVisiveis = employees.filter(e => mostrarInativos || e.active)

  return (
    <div>
      {/* Header */}
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
              {isSubmitting ? 'Salvando...' : editingId ? 'Atualizar Funcionário' : 'Salvar Funcionário'}
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

      {/* Barra de controle */}
      {!loading && (totalInativos > 0 || podeOcultar) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-xl shadow-sm border px-4 py-3 mb-4">
          <span className="text-sm text-gray-600">
            {employeesVisiveis.length} exibido{employeesVisiveis.length !== 1 ? 's' : ''}
            {totalInativos > 0 && ` · ${totalInativos} inativo${totalInativos !== 1 ? 's' : ''}`}
            {podeOcultar && verOcultos && totalOcultos > 0 && ` · ${totalOcultos} oculto${totalOcultos !== 1 ? 's' : ''}`}
          </span>

          <div className="flex flex-wrap gap-2">
            {totalInativos > 0 && (
              <button
                type="button"
                onClick={() => setMostrarInativos(v => !v)}
                className="text-sm font-medium text-amber-600 hover:text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition"
              >
                {mostrarInativos ? 'Ocultar inativos' : 'Mostrar inativos'}
              </button>
            )}
            {podeOcultar && (
              <button
                type="button"
                onClick={() => { setLoading(true); setVerOcultos(v => !v) }}
                className={`text-sm font-medium px-3 py-1.5 rounded-lg transition border ${
                  verOcultos
                    ? 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {verOcultos ? '🚫 Vendo ocultos' : '👁️ Ver ocultos'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Listagem */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
        </div>
      ) : employeesVisiveis.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-6xl mb-4">👷</p>
          <p className="text-xl">Nenhum funcionário cadastrado</p>
          {podeEditar && (
            <p className="text-sm mt-2">Clique em &quot;+ Novo Funcionário&quot; para começar</p>
          )}
        </div>
      ) : (
        <>
          {/* TABELA (md+) */}
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
                    {(podeEditar || podeOcultar) && (
                      <th className="px-6 py-3 text-sm font-semibold text-gray-600">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {employeesVisiveis.map(emp => {
                    const oculto = estaOculto(emp)
                    return (
                      <tr
                        key={emp.id}
                        className={`border-b last:border-0 hover:bg-gray-50 ${
                          !emp.active ? 'opacity-60' : ''
                        } ${oculto ? 'bg-purple-50/40' : ''}`}
                      >
                        <td className="px-6 py-4 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            <span>{emp.name}</span>
                            {oculto && (
                              <span
                                title={emp.hiddenNota || undefined}
                                className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700 border border-dashed border-purple-300"
                              >
                                🚫 Oculto
                              </span>
                            )}
                          </div>
                          {oculto && emp.hiddenNota && (
                            <p className="text-xs text-purple-600 mt-1 italic">{emp.hiddenNota}</p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-600">{emp.role || '-'}</td>
                        <td className="px-6 py-4 text-gray-600"><PhoneLink phone={emp.phone} /></td>
                        <td className="px-6 py-4 text-gray-600">{getColetas(emp)}</td>
                        <td className="px-6 py-4 text-gray-600">{getEntregas(emp)}</td>
                        <td className="px-6 py-4 text-gray-600">{getColheitas(emp)}</td>
                        <td className="px-6 py-4">
                          {podeEditar ? (
                            <button
                              onClick={() => toggleStatus(emp)}
                              disabled={alterandoId === emp.id}
                              title={emp.active ? 'Clique para inativar' : 'Clique para reativar'}
                              className={`px-2 py-1 rounded-full text-xs font-medium transition disabled:opacity-40 ${
                                emp.active
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-red-100 text-red-700 hover:bg-red-200'
                              }`}
                            >
                              {alterandoId === emp.id ? '…' : emp.active ? 'Ativo' : 'Inativo'}
                            </button>
                          ) : (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${emp.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {emp.active ? 'Ativo' : 'Inativo'}
                            </span>
                          )}
                        </td>
                        {(podeEditar || podeOcultar) && (
                          <td className="px-6 py-4">
                            <div className="flex gap-3 items-center">
                              {podeEditar && (
                                <>
                                  <button onClick={() => startEdit(emp)} className="text-blue-500 hover:text-blue-700 text-sm font-medium">Editar</button>
                                  <button
                                    onClick={() => toggleStatus(emp)}
                                    disabled={alterandoId === emp.id}
                                    className="text-amber-600 hover:text-amber-700 text-sm font-medium disabled:opacity-40"
                                  >
                                    {emp.active ? 'Inativar' : 'Reativar'}
                                  </button>
                                  <button onClick={() => handleDelete(emp.id, emp.name)} className="text-red-500 hover:text-red-700 text-sm font-medium">Excluir</button>
                                </>
                              )}
                              {podeOcultar && (
                                <button
                                  onClick={() => handleVisibilidade(emp)}
                                  disabled={alterandoId === emp.id}
                                  title={oculto ? 'Tornar visível' : 'Ocultar dos outros usuários'}
                                  className="text-purple-600 hover:text-purple-800 text-base disabled:opacity-40"
                                >
                                  {oculto ? '🚫' : '👁️'}
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* CARDS (mobile) */}
          <div className="md:hidden space-y-3">
            {employeesVisiveis.map(emp => {
              const coletas = getColetas(emp)
              const entregas = getEntregas(emp)
              const colheitas = getColheitas(emp)
              const totalAtividades = coletas + entregas + colheitas
              const oculto = estaOculto(emp)
              return (
                <div
                  key={emp.id}
                  className={`bg-white rounded-xl shadow-sm p-4 ${
                    !emp.active ? 'opacity-60' : ''
                  } ${oculto ? 'border-2 border-dashed border-purple-300 bg-purple-50/30' : 'border'}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{emp.name}</h3>
                      {emp.role && <span className="text-xs text-gray-500">{emp.role}</span>}
                      {oculto && (
                        <p className="text-xs text-purple-700 mt-1 font-medium">
                          🚫 Oculto{emp.hiddenNota ? ` · ${emp.hiddenNota}` : ''}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium ${emp.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {emp.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  {emp.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                      <span className="text-gray-400">📞</span>
                      <PhoneLink phone={emp.phone} />
                    </div>
                  )}

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

                  {(podeEditar || podeOcultar) && (
                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                      {podeEditar && (
                        <>
                          <button onClick={() => startEdit(emp)} className="flex-1 text-center text-blue-600 hover:bg-blue-50 py-2 rounded-lg text-sm font-medium transition">✏️ Editar</button>
                          <button
                            onClick={() => toggleStatus(emp)}
                            disabled={alterandoId === emp.id}
                            className="flex-1 text-center text-amber-600 hover:bg-amber-50 py-2 rounded-lg text-sm font-medium transition disabled:opacity-40"
                          >
                            {emp.active ? '🚫 Inativar' : '✅ Reativar'}
                          </button>
                          <button onClick={() => handleDelete(emp.id, emp.name)} className="flex-1 text-center text-red-600 hover:bg-red-50 py-2 rounded-lg text-sm font-medium transition">🗑️ Excluir</button>
                        </>
                      )}
                      {podeOcultar && (
                        <button
                          onClick={() => handleVisibilidade(emp)}
                          disabled={alterandoId === emp.id}
                          className="shrink-0 px-3 text-purple-600 hover:bg-purple-50 py-2 rounded-lg text-sm font-medium transition disabled:opacity-40"
                        >
                          {oculto ? '🚫' : '👁️'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Modal de ocultação */}
      {modalOcultar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-1">🚫 Ocultar funcionário</h3>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{modalOcultar.name}</strong> deixará de aparecer em listagens e
              formulários dos outros usuários. Todos os indicadores, extratos e exports
              permanecem <strong>inalterados</strong>.
            </p>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo * <span className="text-xs text-gray-400">(mín. 5 caracteres)</span>
            </label>
            <textarea
              value={notaOcultar}
              onChange={e => setNotaOcultar(e.target.value)}
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="Ex: cadastro duplicado, aguardando conferência"
            />

            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <button
                type="button"
                onClick={() => enviarVisibilidade(modalOcultar, true, notaOcultar.trim())}
                disabled={notaOcultar.trim().length < 5 || alterandoId === modalOcultar.id}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg font-medium transition"
              >
                {alterandoId === modalOcultar.id ? 'Ocultando...' : 'Confirmar'}
              </button>
              <button
                type="button"
                onClick={() => { setModalOcultar(null); setNotaOcultar('') }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2.5 rounded-lg font-medium transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
