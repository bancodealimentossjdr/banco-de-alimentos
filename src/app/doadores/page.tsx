'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import PhoneLink from '@/components/PhoneLink'
import ModalOcultar from '@/components/ModalOcultar'
import { usePermissions } from '@/hooks/usePermissions'
import { useFormSubmit } from '@/hooks/useFormSubmit'
import { useVisibilidade } from '@/hooks/useVisibilidade'

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
  hiddenAt?: string | null
  hiddenNota?: string | null
  _count: { donations: number }
}

const DONOR_CATEGORIES = [
  { value: 'supermercado', label: 'Supermercado' },
  { value: 'pessoa_fisica', label: 'Pessoa Física' },
  { value: 'produtor_rural', label: 'Produtor Rural' },
  { value: 'governo_federal', label: 'Governo Federal' },
  { value: 'outros', label: 'Outros' },
]

const estaOculto = (d: Donor) => Boolean(d.hiddenAt)

export default function DoadoresPage() {
  const { canEdit } = usePermissions()
  const podeEditar = canEdit('doadores')

  // 🔒 Trava de duplo clique
  const { isSubmitting, handleSubmit: runSubmit } = useFormSubmit()

  const [donors, setDonors] = useState<Donor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [alterandoId, setAlterandoId] = useState<string | null>(null)
  const [mostrarInativos, setMostrarInativos] = useState(true)
  const [form, setForm] = useState({
    name: '', type: 'PJ', category: 'supermercado',
    contact: '', phone: '', email: '', address: '',
  })

  // 👁️ visibilidade (exclusivo dev) — declarado depois do fetch por dependência
  const [verOcultosQs, setVerOcultosQs] = useState('')

  const fetchDonors = useCallback(async () => {
    try {
      const res = await fetch(`/api/doadores${verOcultosQs ? `?${verOcultosQs}` : ''}`)
      const data = await res.json()
      setDonors(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Erro ao buscar doadores:', err)
      setDonors([])
    } finally {
      setLoading(false)
    }
  }, [verOcultosQs])

  const vis = useVisibilidade<Donor>('doadores', fetchDonors)

  // 🔗 sincroniza a querystring do hook com a usada no fetch
  useEffect(() => { setVerOcultosQs(vis.qsOcultos) }, [vis.qsOcultos])
  useEffect(() => { setLoading(true); fetchDonors() }, [fetchDonors])

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

    await runSubmit(async () => {
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
          const data = await res.json().catch(() => ({}))
          toast.error(data.error || 'Erro ao salvar')
        }
      } catch (error) {
        console.error('Erro ao salvar doador:', error)
        toast.error('Falha de conexão')
      }
    })
  }

  // 🔁 Inativar / reativar sem apagar histórico
  const toggleStatus = async (donor: Donor) => {
    const aviso = donor.active
      ? `Inativar "${donor.name}"?\n\nEle deixará de aparecer no formulário de doações, mas o histórico é preservado.`
      : `Reativar "${donor.name}"?\n\nEle voltará a aparecer no formulário de doações.`
    if (!confirm(aviso)) return

    setAlterandoId(donor.id)
    try {
      const res = await fetch(`/api/doadores/${donor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !donor.active }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Erro ao alterar status')
        return
      }
      await fetchDonors()
    } catch (error) {
      console.error('Erro ao alterar status:', error)
      toast.error('Falha de conexão')
    } finally {
      setAlterandoId(null)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir "${name}"?\n\nSe houver doações vinculadas, prefira INATIVAR.`)) return
    try {
      const res = await fetch(`/api/doadores/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Doador excluído')
        fetchDonors()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Erro ao excluir')
      }
    } catch (error) {
      console.error('Erro ao excluir:', error)
      toast.error('Erro ao excluir doador')
    }
  }

  const getCategoryLabel = (value: string) =>
    DONOR_CATEGORIES.find(c => c.value === value)?.label || value

  const ocupado = (id: string) => alterandoId === id || vis.alterandoId === id

  const totalInativos = donors.filter(d => !d.active).length
  const totalOcultos = donors.filter(estaOculto).length
  const donorsVisiveis = mostrarInativos ? donors : donors.filter(d => d.active)

  return (
    <div>
      {/* Header da página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">🤝 Doadores</h2>
        {podeEditar && (
          <button
            onClick={() => { if (showForm) resetForm(); else setShowForm(true) }}
            className="bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-lg font-medium transition w-full sm:w-auto text-center"
          >
            {showForm ? 'Cancelar' : '+ Novo Doador'}
          </button>
        )}
      </div>

      {/* Formulário */}
      {showForm && podeEditar && (
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
                placeholder="(32) 99999-8888"
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
              disabled={isSubmitting}
              className="bg-green-500 hover:bg-green-600 disabled:bg-green-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium transition w-full sm:w-auto"
            >
              {isSubmitting ? 'Salvando...' : editingId ? 'Atualizar Doador' : 'Salvar Doador'}
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

      {/* Barra de controle: inativos + ocultos */}
      {!loading && (totalInativos > 0 || vis.podeOcultar) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-xl shadow-sm border px-4 py-3 mb-4">
          <span className="text-sm text-gray-600">
            {donorsVisiveis.length} exibido{donorsVisiveis.length !== 1 ? 's' : ''}
            {totalInativos > 0 && ` · ${totalInativos} inativo${totalInativos !== 1 ? 's' : ''}`}
            {vis.podeOcultar && vis.verOcultos && totalOcultos > 0 &&
              ` · ${totalOcultos} oculto${totalOcultos !== 1 ? 's' : ''}`}
          </span>

          <div className="flex flex-wrap gap-2">
            {totalInativos > 0 && (
              <button
                type="button"
                onClick={() => setMostrarInativos(v => !v)}
                className="text-sm font-medium text-green-600 hover:text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-50 transition"
              >
                {mostrarInativos ? 'Ocultar inativos' : 'Mostrar inativos'}
              </button>
            )}
            {vis.podeOcultar && (
              <button
                type="button"
                onClick={() => { setLoading(true); vis.setVerOcultos(v => !v) }}
                className={`text-sm font-medium px-3 py-1.5 rounded-lg transition border ${
                  vis.verOcultos
                    ? 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {vis.verOcultos ? '🚫 Vendo ocultos' : '👁️ Ver ocultos'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Listagem */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
        </div>
      ) : donorsVisiveis.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-6xl mb-4">🤝</p>
          <p className="text-xl">Nenhum doador cadastrado</p>
          {podeEditar && (
            <p className="text-sm mt-2">Clique em &quot;+ Novo Doador&quot; para começar</p>
          )}
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
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Tipo</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Categoria</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Telefone</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Doações</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Status</th>
                    {(podeEditar || vis.podeOcultar) && (
                      <th className="px-6 py-3 text-sm font-semibold text-gray-600">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {donorsVisiveis.map(donor => {
                    const oculto = estaOculto(donor)
                    return (
                      <tr
                        key={donor.id}
                        className={`border-b last:border-0 hover:bg-gray-50 ${
                          !donor.active ? 'opacity-60' : ''
                        } ${oculto ? 'bg-purple-50/40' : ''}`}
                      >
                        <td className="px-6 py-4 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            <span>{donor.name}</span>
                            {oculto && (
                              <span
                                title={donor.hiddenNota || undefined}
                                className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700 border border-dashed border-purple-300"
                              >
                                🚫 Oculto
                              </span>
                            )}
                          </div>
                          {oculto && donor.hiddenNota && (
                            <p className="text-xs text-purple-600 mt-1 italic">{donor.hiddenNota}</p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-600">{donor.type}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                            {getCategoryLabel(donor.category)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          <PhoneLink phone={donor.phone} />
                        </td>
                        <td className="px-6 py-4 text-gray-600">{donor._count.donations}</td>
                        <td className="px-6 py-4">
                          {podeEditar ? (
                            <button
                              onClick={() => toggleStatus(donor)}
                              disabled={ocupado(donor.id)}
                              title={donor.active ? 'Clique para inativar' : 'Clique para reativar'}
                              className={`px-2 py-1 rounded-full text-xs font-medium transition disabled:opacity-40 ${
                                donor.active
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-red-100 text-red-700 hover:bg-red-200'
                              }`}
                            >
                              {ocupado(donor.id) ? '…' : donor.active ? 'Ativo' : 'Inativo'}
                            </button>
                          ) : (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${donor.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {donor.active ? 'Ativo' : 'Inativo'}
                            </span>
                          )}
                        </td>
                        {(podeEditar || vis.podeOcultar) && (
                          <td className="px-6 py-4">
                            <div className="flex gap-3 items-center">
                              {podeEditar && (
                                <>
                                  <button onClick={() => startEdit(donor)} className="text-blue-500 hover:text-blue-700 text-sm font-medium">Editar</button>
                                  <button
                                    onClick={() => toggleStatus(donor)}
                                    disabled={ocupado(donor.id)}
                                    className="text-amber-600 hover:text-amber-700 text-sm font-medium disabled:opacity-40"
                                  >
                                    {donor.active ? 'Inativar' : 'Reativar'}
                                  </button>
                                  <button onClick={() => handleDelete(donor.id, donor.name)} className="text-red-500 hover:text-red-700 text-sm font-medium">Excluir</button>
                                </>
                              )}
                              {vis.podeOcultar && (
                                <button
                                  onClick={() => vis.acionar(donor)}
                                  disabled={ocupado(donor.id)}
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

          {/* ====== CARDS - mobile ====== */}
          <div className="md:hidden space-y-3">
            {donorsVisiveis.map(donor => {
              const oculto = estaOculto(donor)
              return (
                <div
                  key={donor.id}
                  className={`bg-white rounded-xl shadow-sm p-4 ${
                    !donor.active ? 'opacity-60' : ''
                  } ${oculto ? 'border-2 border-dashed border-purple-300 bg-purple-50/30' : 'border'}`}
                >
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
                      {oculto && (
                        <p className="text-xs text-purple-700 mt-1 font-medium">
                          🚫 Oculto{donor.hiddenNota ? ` · ${donor.hiddenNota}` : ''}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium ${donor.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {donor.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

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
                        <PhoneLink phone={donor.phone} />
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

                  {(podeEditar || vis.podeOcultar) && (
                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                      {podeEditar && (
                        <>
                          <button onClick={() => startEdit(donor)} className="flex-1 text-center text-blue-600 hover:bg-blue-50 py-2 rounded-lg text-sm font-medium transition">✏️ Editar</button>
                          <button
                            onClick={() => toggleStatus(donor)}
                            disabled={ocupado(donor.id)}
                            className="flex-1 text-center text-amber-600 hover:bg-amber-50 py-2 rounded-lg text-sm font-medium transition disabled:opacity-40"
                          >
                            {donor.active ? '🚫 Inativar' : '✅ Reativar'}
                          </button>
                          <button onClick={() => handleDelete(donor.id, donor.name)} className="flex-1 text-center text-red-600 hover:bg-red-50 py-2 rounded-lg text-sm font-medium transition">🗑️ Excluir</button>
                        </>
                      )}
                      {vis.podeOcultar && (
                        <button
                          onClick={() => vis.acionar(donor)}
                          disabled={ocupado(donor.id)}
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
      {vis.alvo && (
        <ModalOcultar
          nome={vis.alvo.name}
          label="doador"
          nota={vis.nota}
          onNotaChange={vis.setNota}
          onConfirmar={vis.confirmar}
          onCancelar={() => { vis.setAlvo(null); vis.setNota('') }}
          enviando={vis.alterandoId === vis.alvo.id}
        />
      )}
    </div>
  )
}
