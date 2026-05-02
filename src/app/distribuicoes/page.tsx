'use client'

import { useState } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { useFormSubmit } from '@/hooks/useFormSubmit'
import { useDraft } from '@/hooks/useDraft'
import { useApi, invalidate } from '@/hooks/useApi'
import { useProdutos, useBeneficiarios, useFuncionarios } from '@/hooks/useCadastros'
import CalculadoraPeso from '@/components/CalculadoraPeso'
import DraftBanner from '@/components/DraftBanner'
import DraftSavedIndicator from '@/components/DraftSavedIndicator'

interface DistributionItem {
  id: string
  quantity: number
  boxes: number | null
  product: { name: string; unit: string }
}

interface Distribution {
  id: string
  date: string
  notes: string | null
  beneficiary: { id: string; name: string; type: string }
  employee: { id: string; name: string } | null
  employee2: { id: string; name: string } | null
  employee3: { id: string; name: string } | null
  items: DistributionItem[]
}

interface FormItem {
  productId: string
  quantity: number
  boxes?: number
}

interface DistribuicaoForm {
  beneficiaryId: string
  employeeId: string
  employee2Id: string
  employee3Id: string
  date: string
  notes: string
}

export default function DistribuicoesPage() {
  // 🔐 Permissões
  const { canEdit, canEditRecord, canDelete } = usePermissions()
  const podeEditar = canEdit('distribuicoes')
  const podeExcluir = canDelete('distribuicoes')

  // 🔒 Trava de duplo clique
  const { isSubmitting, handleSubmit: runSubmit } = useFormSubmit()

  // 🚀 Cache global de cadastros (compartilhado com outras páginas)
  const { produtos: products } = useProdutos()
  const { beneficiarios: beneficiaries } = useBeneficiarios()
  const { funcionarios: employees } = useFuncionarios()

  // 📋 Lista de distribuições — cache local
  const {
    data: distributionsData,
    isLoading: loadingDistributions,
    mutate: mutateDistributions,
  } = useApi<Distribution[]>('/api/distribuicoes', {
    dedupingInterval: 10_000,
  })
  const distributions = distributionsData ?? []
  const loading = loadingDistributions && !distributionsData

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [form, setForm] = useState<DistribuicaoForm>({
    beneficiaryId: '',
    employeeId: '',
    employee2Id: '',
    employee3Id: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const [formItems, setFormItems] = useState<FormItem[]>([{ productId: '', quantity: 0 }])

  const [calcOpen, setCalcOpen] = useState<number | null>(null)

  // 💾 Rascunho local
  const {
    showSavedIndicator,
    hasDraft,
    draftSavedAt,
    restoreDraft,
    discardDraft,
    clearDraft,
  } = useDraft<{ form: DistribuicaoForm; formItems: FormItem[] }>({
    key: 'distribuicao-nova',
    state: { form, formItems },
    onRestore: (data) => {
      setForm(data.form)
      setFormItems(data.formItems)
      setShowForm(true)
    },
    disabled: editingId !== null,
  })

  const resetForm = () => {
    setForm({
      beneficiaryId: '',
      employeeId: '',
      employee2Id: '',
      employee3Id: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    })
    setFormItems([{ productId: '', quantity: 0 }])
    setEditingId(null)
    setShowForm(false)
    setCalcOpen(null)
  }

  const startEdit = (dist: Distribution) => {
    setForm({
      beneficiaryId: dist.beneficiary.id,
      employeeId: dist.employee?.id || '',
      employee2Id: dist.employee2?.id || '',
      employee3Id: dist.employee3?.id || '',
      date: dist.date.split('T')[0],
      notes: dist.notes || '',
    })
    setFormItems(
      dist.items.map(item => ({
        productId: products.find(p => p.name === item.product.name)?.id || '',
        quantity: item.quantity,
        boxes: item.boxes ?? undefined,
      }))
    )
    setEditingId(dist.id)
    setShowForm(true)
    setCalcOpen(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const addItem = () => setFormItems([...formItems, { productId: '', quantity: 0 }])

  const removeItem = (index: number) => {
    if (formItems.length > 1) {
      setFormItems(formItems.filter((_, i) => i !== index))
    }
    if (calcOpen === index) setCalcOpen(null)
  }

  const updateItem = (index: number, field: string, value: string | number) => {
    const updated = [...formItems]
    updated[index] = { ...updated[index], [field]: value }
    setFormItems(updated)
  }

  const openCalc = (index: number) => setCalcOpen(index)
  const closeCalc = () => setCalcOpen(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const empIds = [form.employeeId, form.employee2Id, form.employee3Id].filter(Boolean)
    if (empIds.length !== new Set(empIds).size) {
      alert('Não é possível selecionar o mesmo funcionário mais de uma vez.')
      return
    }

    const validItems = formItems.filter(i => i.productId && i.quantity > 0)
    if (validItems.length === 0) return alert('Adicione pelo menos um produto!')

    await runSubmit(async () => {
      try {
        const url = editingId ? `/api/distribuicoes/${editingId}` : '/api/distribuicoes'
        const method = editingId ? 'PUT' : 'POST'

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            employeeId: form.employeeId || null,
            employee2Id: form.employee2Id || null,
            employee3Id: form.employee3Id || null,
            items: validItems,
          }),
        })
        if (res.ok) {
          clearDraft()
          resetForm()
          mutateDistributions()
          // 🔄 Distribuição mexe no estoque, então invalida o resumo
          invalidate('/api/estoque/resumo')
        } else {
          const data = await res.json()
          alert(data.error || 'Erro ao salvar')
        }
      } catch (error) {
        console.error('Erro ao salvar distribuição:', error)
      }
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta distribuição? O estoque será ajustado automaticamente.')) return
    try {
      const res = await fetch(`/api/distribuicoes/${id}`, { method: 'DELETE' })
      if (res.ok) {
        mutateDistributions()
        invalidate('/api/estoque/resumo')
      } else {
        const data = await res.json()
        alert(data.error || 'Erro ao excluir')
      }
    } catch (error) {
      console.error('Erro ao excluir:', error)
      alert('Erro ao excluir distribuição')
    }
  }

  const formatDate = (date: string) => {
    const raw = date.includes('T') ? date.split('T')[0] : date
    const [year, month, day] = raw.split('-')
    return `${day}/${month}/${year}`
  }

  const getDistributionEmployees = (dist: Distribution) => {
    return [dist.employee, dist.employee2, dist.employee3].filter(Boolean) as { id: string; name: string }[]
  }

  return (
    <div>
      {/* Header da página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">📤 Distribuições</h2>
        {podeEditar && (
          <button
            onClick={() => { if (showForm) resetForm(); else setShowForm(true) }}
            className="bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-lg font-medium transition w-full sm:w-auto text-center"
          >
            {showForm ? 'Cancelar' : '+ Nova Distribuição'}
          </button>
        )}
      </div>

      {hasDraft && podeEditar && !editingId && (
        <DraftBanner
          savedAt={draftSavedAt}
          onRestore={restoreDraft}
          onDiscard={discardDraft}
        />
      )}

      {/* Formulário */}
      {showForm && podeEditar && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-4 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {editingId ? '✏️ Editar Distribuição' : 'Registrar Distribuição'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instituição *</label>
              <select
                value={form.beneficiaryId}
                onChange={e => setForm({ ...form, beneficiaryId: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                required
              >
                <option value="">Selecione...</option>
                {beneficiaries.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                required
              />
            </div>
          </div>

          <div className="mt-2 mb-6">
            <h3 className="text-md font-semibold text-gray-800 mb-3">🧑‍🤝‍🧑 Funcionários da Entrega</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Funcionário 1</label>
                <select
                  value={form.employeeId}
                  onChange={e => setForm({ ...form, employeeId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                >
                  <option value="">Selecione...</option>
                  {employees
                    .filter(emp => emp.id !== form.employee2Id && emp.id !== form.employee3Id)
                    .map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Funcionário 2 <span className="text-gray-400 text-xs">(opcional)</span>
                </label>
                <select
                  value={form.employee2Id}
                  onChange={e => setForm({ ...form, employee2Id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                  disabled={!form.employeeId}
                >
                  <option value="">Selecione...</option>
                  {employees
                    .filter(emp => emp.id !== form.employeeId && emp.id !== form.employee3Id)
                    .map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Funcionário 3 <span className="text-gray-400 text-xs">(opcional)</span>
                </label>
                <select
                  value={form.employee3Id}
                  onChange={e => setForm({ ...form, employee3Id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                  disabled={!form.employee2Id}
                >
                  <option value="">Selecione...</option>
                  {employees
                    .filter(emp => emp.id !== form.employeeId && emp.id !== form.employee2Id)
                    .map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
              </div>
            </div>
            {!form.employeeId && (form.employee2Id || form.employee3Id) && (
              <p className="text-xs text-amber-600 mt-2">⚠️ Selecione o Funcionário 1 antes dos demais.</p>
            )}
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-semibold text-gray-700">Produtos entregues *</label>
              <button type="button" onClick={addItem} className="text-sm text-red-600 hover:text-red-700 font-medium">
                + Adicionar produto
              </button>
            </div>

            {formItems.map((item, index) => (
              <div key={index} className="mb-3">
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-end">
                  <div className="flex-1">
                    {index === 0 && <label className="block text-xs text-gray-500 mb-1">Produto</label>}
                    <select
                      value={item.productId}
                      onChange={e => updateItem(index, 'productId', e.target.value)}
                      className="w-full border rounded-lg px-3 py-2.5 text-sm"
                      required
                    >
                      <option value="">Selecione o produto...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                    </select>
                  </div>

                  <div className="flex gap-2 items-end">
                    <div className="flex-1 sm:w-32 sm:flex-none">
                      {index === 0 && <label className="block text-xs text-gray-500 mb-1 hidden sm:block">Quantidade</label>}
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0.01"
                        value={item.quantity || ''}
                        onChange={e => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full border rounded-lg px-3 py-2.5 text-sm"
                        placeholder="Quantidade"
                        required
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => calcOpen === index ? closeCalc() : openCalc(index)}
                      className={`shrink-0 p-2.5 rounded-lg border text-lg ${
                        calcOpen === index
                          ? 'bg-blue-100 border-blue-300'
                          : 'bg-gray-50 border-gray-200 hover:bg-blue-50'
                      }`}
                      title="Calculadora de peso"
                    >
                      🧮
                    </button>
                    {formItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="shrink-0 p-2.5 rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 text-lg"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {item.boxes !== undefined && item.boxes > 0 && (
                  <p className="text-xs text-blue-600 mt-1 ml-1">
                    📦 {item.boxes} caixa{item.boxes > 1 ? 's' : ''} · peso líquido (tara descontada)
                  </p>
                )}

                {calcOpen === index && (
                  <CalculadoraPeso
                    onApply={(pesoLiquido, totalCaixas) => {
                      const updated = [...formItems]
                      updated[index] = {
                        ...updated[index],
                        quantity: pesoLiquido,
                        boxes: totalCaixas,
                      }
                      setFormItems(updated)
                      setCalcOpen(null)
                    }}
                    onClose={closeCalc}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
              rows={2}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-red-500 hover:bg-red-600 disabled:bg-red-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium transition w-full sm:w-auto"
            >
              {isSubmitting
                ? 'Salvando...'
                : editingId ? 'Atualizar Distribuição' : 'Registrar Distribuição'}
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
        </div>
      ) : distributions.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-6xl mb-4">📤</p>
          <p className="text-xl">Nenhuma distribuição registrada</p>
          {podeEditar && (
            <p className="text-sm mt-2">Clique em &quot;+ Nova Distribuição&quot; para começar</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {distributions.map(dist => {
            const totalBoxes = dist.items.reduce((sum, i) => sum + (i.boxes || 0), 0)
            const distEmployees = getDistributionEmployees(dist)
            const canEditThis = canEditRecord('distribuicoes', dist.date)
            const canDeleteThis = podeExcluir

            return (
              <div key={dist.id} className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-gray-900">{dist.beneficiary.name}</h3>
                      {totalBoxes > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          📦 {totalBoxes} cx
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {formatDate(dist.date)}
                    </p>
                    {distEmployees.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {distEmployees.map(emp => (
                          <span
                            key={emp.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100"
                          >
                            👤 {emp.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-medium text-red-600">
                      {dist.items.length} {dist.items.length === 1 ? 'item' : 'itens'}
                    </span>
                    {canEditThis && (
                      <button
                        onClick={() => startEdit(dist)}
                        className="text-blue-500 hover:text-blue-700 text-sm font-medium px-2 py-1 rounded hover:bg-blue-50 transition"
                      >
                        Editar
                      </button>
                    )}
                    {canDeleteThis && (
                      <button
                        onClick={() => handleDelete(dist.id)}
                        className="text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition"
                      >
                        Excluir
                      </button>
                    )}
                  </div>
                </div>

                <div className="mb-3">
                  <div className="hidden sm:flex flex-wrap gap-2">
                    {dist.items.map(item => (
                      <div key={item.id} className="px-3 py-1.5 bg-red-50 border border-red-100 rounded-lg text-sm">
                        <span className="text-red-700 font-medium">{item.product.name}</span>
                        <span className="text-gray-500 mx-1">•</span>
                        <span className="text-gray-700">{item.quantity} {item.product.unit}</span>
                        {item.boxes ? (
                          <>
                            <span className="text-gray-500 mx-1">•</span>
                            <span className="text-blue-600 font-medium">{item.boxes}cx</span>
                          </>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <div className="sm:hidden space-y-1.5">
                    {dist.items.map(item => (
                      <div key={item.id} className="flex items-center justify-between bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <span className="text-red-700 font-medium">{item.product.name}</span>
                          <span className="text-gray-500 ml-1">
                            ({item.quantity} {item.product.unit}
                            {item.boxes ? ` · ${item.boxes}cx` : ''})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {dist.notes && (
                  <p className="text-sm text-gray-400 mt-2 italic">📝 {dist.notes}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      <DraftSavedIndicator show={showSavedIndicator} />
    </div>
  )
}
