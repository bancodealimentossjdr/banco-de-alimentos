'use client'

import { useEffect, useState } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { useFormSubmit } from '@/hooks/useFormSubmit'
import { useDraft } from '@/hooks/useDraft'
import CalculadoraPeso from '@/components/CalculadoraPeso'
import DraftBanner from '@/components/DraftBanner'
import DraftSavedIndicator from '@/components/DraftSavedIndicator'

interface Producer { id: string; name: string }
interface ProductOption { id: string; name: string; unit: string }
interface HarvestItem {
  id: string; productId: string; quantity: number; boxes: number | null
  product: { id: string; name: string; unit: string }
}
interface Harvest {
  id: string; date: string; status: string; notes: string | null
  indemnityValue: number | null
  producer: { id: string; name: string }
  employee: { id: string; name: string } | null
  employee2: { id: string; name: string } | null
  employee3: { id: string; name: string } | null
  items: HarvestItem[]
}

interface FormItem {
  productId: string
  quantity: number
  boxes?: number
}

interface ColheitaForm {
  producerId: string
  employeeId: string
  employee2Id: string
  employee3Id: string
  date: string
  status: string
  notes: string
  indemnityValue: number
  items: FormItem[]
}

const STATUS_OPTIONS = [
  { value: 'agendada', label: 'Agendada', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'realizada', label: 'Realizada', color: 'bg-green-100 text-green-700' },
  { value: 'cancelada', label: 'Cancelada', color: 'bg-red-100 text-red-700' },
]

export default function ColheitaSolidariaPage() {
  // 🔐 Pega também canEditRecord (trava temporal) e canDeleteRecord (só admin)
  const { canEdit, canEditRecord, canDelete } = usePermissions()
  const podeEditar = canEdit('colheita-solidaria')
  const podeExcluir = canDelete('colheita-solidaria')

  // 🔒 Trava de duplo clique
  const { isSubmitting, handleSubmit: runSubmit } = useFormSubmit()

  const [harvests, setHarvests] = useState<Harvest[]>([])
  const [producers, setProducers] = useState<Producer[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [form, setForm] = useState<ColheitaForm>({
    producerId: '',
    employeeId: '',
    employee2Id: '',
    employee3Id: '',
    date: new Date().toISOString().split('T')[0],
    status: 'agendada',
    notes: '',
    indemnityValue: 1.5,
    items: [{ productId: '', quantity: 0 }],
  })

  const [calcOpen, setCalcOpen] = useState<number | null>(null)

  // 💾 Rascunho local (só para criação nova)
  const {
    showSavedIndicator,
    hasDraft,
    draftSavedAt,
    restoreDraft,
    discardDraft,
    clearDraft,
  } = useDraft<ColheitaForm>({
    key: 'colheita-nova',
    state: form,
    onRestore: (data) => {
      setForm(data)
      setShowForm(true)
    },
    disabled: editingId !== null,
  })

  const fetchAll = async () => {
    try {
      const [hRes, pRes, prRes, eRes] = await Promise.all([
        fetch('/api/colheita-solidaria'), fetch('/api/produtores'), fetch('/api/produtos'), fetch('/api/funcionarios'),
      ])
      const [h, p, pr, e] = await Promise.all([hRes.json(), pRes.json(), prRes.json(), eRes.json()])
      setHarvests(Array.isArray(h) ? h : [])
      setProducers(Array.isArray(p) ? p : [])
      setProducts(Array.isArray(pr) ? pr : [])
      setEmployees(Array.isArray(e) ? e : [])
    } catch (err) {
      console.error('Erro ao buscar dados:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const resetForm = () => {
    setForm({
      producerId: '',
      employeeId: '',
      employee2Id: '',
      employee3Id: '',
      date: new Date().toISOString().split('T')[0],
      status: 'agendada',
      notes: '',
      indemnityValue: 1.5,
      items: [{ productId: '', quantity: 0 }],
    })
    setEditingId(null)
    setShowForm(false)
    setCalcOpen(null)
  }

  const startEdit = (harvest: Harvest) => {
    setForm({
      producerId: harvest.producer.id,
      employeeId: harvest.employee?.id || '',
      employee2Id: harvest.employee2?.id || '',
      employee3Id: harvest.employee3?.id || '',
      date: harvest.date.split('T')[0],
      status: harvest.status,
      notes: harvest.notes || '',
      indemnityValue: harvest.indemnityValue || 1.5,
      items: harvest.items.length > 0
        ? harvest.items.map(i => ({
            productId: i.productId,
            quantity: i.quantity,
            boxes: i.boxes ?? undefined,
          }))
        : [{ productId: '', quantity: 0 }],
    })
    setEditingId(harvest.id)
    setShowForm(true)
    setCalcOpen(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const addItem = () => setForm({ ...form, items: [...form.items, { productId: '', quantity: 0 }] })
  const removeItem = (index: number) => {
    if (form.items.length <= 1) return
    setForm({ ...form, items: form.items.filter((_, i) => i !== index) })
    if (calcOpen === index) setCalcOpen(null)
  }
  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...form.items]
    newItems[index] = { ...newItems[index], [field]: value }
    setForm({ ...form, items: newItems })
  }

  const openCalc = (index: number) => setCalcOpen(index)
  const closeCalc = () => setCalcOpen(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validItems = form.items.filter(i => i.productId !== '' && i.quantity > 0)
    if (validItems.length === 0) { alert('Adicione pelo menos um item com produto e quantidade.'); return }

    // 🔍 Validação local: funcionários não podem se repetir
    const empIds = [form.employeeId, form.employee2Id, form.employee3Id].filter(Boolean)
    if (empIds.length !== new Set(empIds).size) {
      alert('Não é possível selecionar o mesmo funcionário mais de uma vez.')
      return
    }

    // 🔒 Envolve a chamada de salvar na trava de duplo clique
    await runSubmit(async () => {
      try {
        const url = editingId ? '/api/colheita-solidaria/' + editingId : '/api/colheita-solidaria'
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
          clearDraft() // 🧹 Limpa o rascunho ao salvar com sucesso
          resetForm()
          fetchAll()
        }
        else { const data = await res.json(); alert(data.error || 'Erro ao salvar') }
      } catch (error) { console.error('Erro ao salvar colheita:', error) }
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta colheita?')) return
    try {
      const res = await fetch('/api/colheita-solidaria/' + id, { method: 'DELETE' })
      if (res.ok) fetchAll()
      else { const data = await res.json(); alert(data.error || 'Erro ao excluir') }
    } catch (error) { console.error('Erro ao excluir:', error); alert('Erro ao excluir colheita') }
  }

  const getStatusStyle = (status: string) => STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0]

  const formTotalKg = form.items.reduce((sum, item) => sum + (item.quantity || 0), 0)
  const formTotalIndemnity = formTotalKg * form.indemnityValue
  const formTotalBoxes = form.items.reduce((sum, item) => sum + (item.boxes || 0), 0)

  const getHarvestIndemnity = (harvest: Harvest) => {
    const total = harvest.items.reduce((sum, item) => sum + item.quantity, 0)
    const totalBoxes = harvest.items.reduce((sum, item) => sum + (item.boxes || 0), 0)
    const rate = harvest.indemnityValue || 1.5
    return { totalKg: total, totalBoxes, rate, totalValue: total * rate }
  }

  // 🧑‍🤝‍🧑 Lista de funcionários da colheita (filtra os nulos)
  const getHarvestEmployees = (harvest: Harvest) => {
    return [harvest.employee, harvest.employee2, harvest.employee3].filter(Boolean) as { id: string; name: string }[]
  }

  return (
    <div>
      {/* Header da página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">🌿 Colheita Solidária</h2>
        {podeEditar && (
          <button
            onClick={() => { if (showForm) resetForm(); else setShowForm(true) }}
            className="bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-lg font-medium transition w-full sm:w-auto text-center"
          >
            {showForm ? 'Cancelar' : '+ Nova Colheita'}
          </button>
        )}
      </div>

      {/* 💾 Banner de rascunho (aparece quando há rascunho válido) */}
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
            {editingId ? '✏️ Editar Colheita' : 'Nova Colheita'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Produtor *</label>
              <select
                value={form.producerId}
                onChange={e => setForm({ ...form, producerId: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                required
              >
                <option value="">Selecione um produtor</option>
                {producers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
              >
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">💰 Valor de Indenização (R$/kg)</label>
              <select
                value={form.indemnityValue}
                onChange={e => setForm({ ...form, indemnityValue: parseFloat(e.target.value) })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-amber-50 text-sm"
              >
                <option value={1.5}>R$ 1,50 / kg</option>
                <option value={1.0}>R$ 1,00 / kg</option>
              </select>
            </div>
            <div className="md:col-span-2 lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
              <textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                rows={1}
              />
            </div>
          </div>

          {/* 🧑‍🤝‍🧑 Funcionários (até 3) */}
          <div className="mt-6">
            <h3 className="text-md font-semibold text-gray-800 mb-3">🧑‍🤝‍🧑 Funcionários da Colheita</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Funcionário 1</label>
                <select
                  value={form.employeeId}
                  onChange={e => setForm({ ...form, employeeId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                >
                  <option value="">Selecione...</option>
                  {employees
                    .filter(emp => emp.id !== form.employee2Id && emp.id !== form.employee3Id)
                    .map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Funcionário 2 <span className="text-gray-400 text-xs">(opcional)</span></label>
                <select
                  value={form.employee2Id}
                  onChange={e => setForm({ ...form, employee2Id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                  disabled={!form.employeeId}
                >
                  <option value="">Selecione...</option>
                  {employees
                    .filter(emp => emp.id !== form.employeeId && emp.id !== form.employee3Id)
                    .map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Funcionário 3 <span className="text-gray-400 text-xs">(opcional)</span></label>
                <select
                  value={form.employee3Id}
                  onChange={e => setForm({ ...form, employee3Id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
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

          {/* Itens da Colheita */}
          <div className="mt-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-md font-semibold text-gray-800">📦 Itens da Colheita</h3>
              <button type="button" onClick={addItem} className="text-green-600 hover:text-green-700 text-sm font-medium">
                + Adicionar Item
              </button>
            </div>

            {/* Cabeçalho - só desktop */}
            <div className="hidden lg:flex gap-3 items-end mb-1 px-1">
              <div className="flex-1"><span className="text-xs text-gray-500">Produto *</span></div>
              <div className="w-32"><span className="text-xs text-gray-500">Quantidade *</span></div>
              <div className="w-28 text-right"><span className="text-xs text-gray-500">Indenização</span></div>
              <div className="w-20"></div>
            </div>

            <div className="space-y-3">
              {form.items.map((item, index) => (
                <div key={index}>
                  <div className="flex flex-col lg:flex-row gap-2 lg:gap-3 lg:items-center p-3 lg:p-0 bg-gray-50 lg:bg-transparent rounded-lg lg:rounded-none">
                    {/* Produto */}
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1 lg:hidden">Produto *</label>
                      <select
                        value={item.productId}
                        onChange={e => updateItem(index, 'productId', e.target.value)}
                        className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                      >
                        <option value="">Selecione um produto</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                      </select>
                    </div>

                    {/* Quantidade + Calculadora + Indenização + Remover */}
                    <div className="flex gap-2 items-center">
                      <div className="flex-1 lg:w-32 lg:flex-none">
                        <label className="block text-xs text-gray-500 mb-1 lg:hidden">Quantidade *</label>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          value={item.quantity || ''}
                          onChange={e => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                          placeholder="0"
                        />
                      </div>

                      {/* 🧮 Botão calculadora */}
                      <button
                        type="button"
                        onClick={() => calcOpen === index ? closeCalc() : openCalc(index)}
                        className={`shrink-0 p-2.5 rounded-lg border text-lg ${
                          calcOpen === index
                            ? 'bg-blue-100 border-blue-300'
                            : 'bg-white border-gray-200 hover:bg-blue-50'
                        }`}
                        title="Calculadora de peso"
                      >
                        🧮
                      </button>

                      {/* Indenização calculada */}
                      <div className="w-24 lg:w-28 text-right shrink-0">
                        <span className="block text-xs text-gray-500 mb-1 lg:hidden">Indenização</span>
                        <span className={`text-sm font-semibold ${item.quantity > 0 ? 'text-amber-700' : 'text-gray-300'}`}>
                          R$ {((item.quantity || 0) * form.indemnityValue).toFixed(2)}
                        </span>
                      </div>

                      {/* Remover */}
                      {form.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="shrink-0 p-2 rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 text-sm"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Indicador de caixas */}
                  {item.boxes !== undefined && item.boxes > 0 && (
                    <p className="text-xs text-blue-600 mt-1 ml-1">
                      📦 {item.boxes} caixa{item.boxes > 1 ? 's' : ''} · peso líquido (tara descontada)
                    </p>
                  )}

                  {/* Calculadora */}
                  {calcOpen === index && (
                    <div className="mt-2">
                      <CalculadoraPeso
                        onApply={(pesoLiquido, totalCaixas) => {
                          const newItems = [...form.items]
                          newItems[index] = {
                            ...newItems[index],
                            quantity: pesoLiquido,
                            boxes: totalCaixas,
                          }
                          setForm({ ...form, items: newItems })
                          setCalcOpen(null)
                        }}
                        onClose={closeCalc}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Resumo de Indenização */}
          {form.items.some(i => i.quantity > 0) && (
            <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-amber-800">💰 Resumo da Indenização</span>
                <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                  R$ {form.indemnityValue.toFixed(2)} / kg
                </span>
                {formTotalBoxes > 0 && (
                  <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                    📦 {formTotalBoxes} caixa{formTotalBoxes > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="space-y-1 mb-3">
                {form.items.filter(i => i.quantity > 0).map((item, idx) => {
                  const prod = products.find(p => p.id === item.productId)
                  return (
                    <div key={idx} className="flex justify-between text-sm gap-2">
                      <span className="text-gray-600 truncate">
                        {prod ? prod.name : 'Produto ' + (idx + 1)} — {item.quantity} kg
                        {item.boxes ? ` · ${item.boxes}cx` : ''}
                      </span>
                      <span className="font-medium text-amber-700 shrink-0">
                        R$ {(item.quantity * form.indemnityValue).toFixed(2)}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="border-t border-amber-300 pt-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="text-sm text-amber-700">
                  <span className="font-medium">Peso Total:</span> {formTotalKg.toFixed(1)} kg
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs text-amber-600 font-medium">VALOR TOTAL DA INDENIZAÇÃO</p>
                  <p className="text-2xl font-bold text-amber-700">
                    R$ {formTotalIndemnity.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-amber-200">
                <p className="text-xs text-gray-500">
                  ⚠️ <strong>Nota:</strong> Os preços de referência da Ação Colheita Solidária são definidos pelo DECRETO MUNICIPAL Nº 11.452, DE 25 OUTUBRO 2024, Prefeitura Municipal de São João del-Rei
                </p>
              </div>
            </div>
          )}

          {/* Botões */}
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-green-500 hover:bg-green-600 disabled:bg-green-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium transition w-full sm:w-auto"
            >
              {isSubmitting
                ? 'Salvando...'
                : editingId ? 'Atualizar Colheita' : 'Salvar Colheita'}
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
        </div>
      ) : harvests.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-6xl mb-4">🌿</p>
          <p className="text-xl">Nenhuma colheita registrada</p>
          {podeEditar && (
            <p className="text-sm mt-2">Clique em &quot;+ Nova Colheita&quot; para começar</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {harvests.map(harvest => {
            const statusStyle = getStatusStyle(harvest.status)
            const ind = getHarvestIndemnity(harvest)
            const harvestEmployees = getHarvestEmployees(harvest)

            // 🔐 Por registro: pode editar (admin sempre, operador só se date=hoje)
            // Excluir: só admin (regra global do módulo time-locked)
            const canEditThis = canEditRecord('colheita-solidaria', harvest.date)
            const canDeleteThis = podeExcluir

            return (
              <div key={harvest.id} className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
                {/* Cabeçalho do card */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-gray-900">{harvest.producer.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle.color}`}>
                        {statusStyle.label}
                      </span>
                      {ind.totalBoxes > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          📦 {ind.totalBoxes} cx
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {new Date(harvest.date).toLocaleDateString('pt-BR')}
                    </p>
                    {/* 🧑‍🤝‍🧑 Funcionários */}
                    {harvestEmployees.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {harvestEmployees.map(emp => (
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

                  {/* 🔐 Ações — Editar só se canEditThis; Excluir só admin */}
                  {(canEditThis || canDeleteThis) && (
                    <div className="flex items-center gap-2 shrink-0">
                      {canEditThis && (
                        <button
                          onClick={() => startEdit(harvest)}
                          className="text-blue-500 hover:text-blue-700 text-sm font-medium px-2 py-1 rounded hover:bg-blue-50 transition"
                        >
                          Editar
                        </button>
                      )}
                      {canDeleteThis && (
                        <button
                          onClick={() => handleDelete(harvest.id)}
                          className="text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition"
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Itens */}
                <div className="mb-3">
                  {/* Desktop: tags em linha */}
                  <div className="hidden sm:flex flex-wrap gap-2">
                    {harvest.items.map(item => (
                      <div key={item.id} className="px-3 py-1.5 bg-green-50 border border-green-100 rounded-lg text-sm">
                        <span className="text-green-700 font-medium">{item.product.name}</span>
                        <span className="text-gray-500 mx-1">•</span>
                        <span className="text-gray-700">{item.quantity} {item.product.unit}</span>
                        {item.boxes ? (
                          <>
                            <span className="text-gray-500 mx-1">•</span>
                            <span className="text-blue-600 font-medium">{item.boxes}cx</span>
                          </>
                        ) : null}
                        <span className="text-gray-500 mx-1">•</span>
                        <span className="text-amber-700 font-semibold">R$ {(item.quantity * ind.rate).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Mobile: lista vertical compacta */}
                  <div className="sm:hidden space-y-1.5">
                    {harvest.items.map(item => (
                      <div key={item.id} className="flex items-center justify-between bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <span className="text-green-700 font-medium">{item.product.name}</span>
                          <span className="text-gray-500 ml-1">
                            ({item.quantity} {item.product.unit}
                            {item.boxes ? ` · ${item.boxes}cx` : ''})
                          </span>
                        </div>
                        <span className="text-amber-700 font-semibold shrink-0 ml-2">
                          R$ {(item.quantity * ind.rate).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totais */}
                <div className="pt-3 border-t border-gray-100">
                  {/* Desktop: tudo em linha */}
                  <div className="hidden sm:flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Peso Total:</span>
                      <span className="text-sm font-bold text-gray-900">{ind.totalKg.toFixed(1)} kg</span>
                    </div>
                    {ind.totalBoxes > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Caixas:</span>
                        <span className="text-sm font-bold text-blue-600">📦 {ind.totalBoxes}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Valor/kg:</span>
                      <span className="text-sm font-medium text-amber-600">R$ {ind.rate.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-xs text-gray-500">Indenização Total:</span>
                      <span className="text-lg font-bold text-amber-700">
                        R$ {ind.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Mobile: empilhado com destaque no total */}
                  <div className="sm:hidden space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Peso Total</span>
                      <span className="font-bold text-gray-900">{ind.totalKg.toFixed(1)} kg</span>
                    </div>
                    {ind.totalBoxes > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Caixas</span>
                        <span className="font-bold text-blue-600">📦 {ind.totalBoxes}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Valor/kg</span>
                      <span className="font-medium text-amber-600">R$ {ind.rate.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center bg-amber-50 -mx-4 px-4 py-2 rounded-lg">
                      <span className="text-sm font-medium text-amber-700">Indenização Total</span>
                      <span className="text-xl font-bold text-amber-700">
                        R$ {ind.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Observações */}
                {harvest.notes && (
                  <p className="text-sm text-gray-400 mt-2 italic">📝 {harvest.notes}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 💾 Indicador discreto "Rascunho salvo" */}
      <DraftSavedIndicator show={showSavedIndicator} />
    </div>
  )
}
