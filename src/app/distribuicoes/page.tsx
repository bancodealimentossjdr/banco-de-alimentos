'use client'

import { useEffect, useState } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import CalculadoraPeso from '@/components/CalculadoraPeso'

interface Product { id: string; name: string; unit: string }
interface Beneficiary { id: string; name: string; type: string }
interface Employee { id: string; name: string }

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
  items: DistributionItem[]
}

interface FormItem {
  productId: string
  quantity: number
  boxes?: number
}

export default function DistribuicoesPage() {
  const { canEdit } = usePermissions()
  const podeEditar = canEdit('distribuicoes')

  const [distributions, setDistributions] = useState<Distribution[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    beneficiaryId: '', employeeId: '', date: new Date().toISOString().split('T')[0], notes: '',
  })
  const [formItems, setFormItems] = useState<FormItem[]>([{ productId: '', quantity: 0 }])

  const [calcOpen, setCalcOpen] = useState<number | null>(null)

  const fetchAll = async () => {
    try {
      const [distRes, prodRes, benefRes, empRes] = await Promise.all([
        fetch('/api/distribuicoes'),
        fetch('/api/produtos'),
        fetch('/api/beneficiarios'),
        fetch('/api/funcionarios'),
      ])
      const [dist, prod, benef, emp] = await Promise.all([
        distRes.json(), prodRes.json(), benefRes.json(), empRes.json(),
      ])
      setDistributions(Array.isArray(dist) ? dist : [])
      setProducts(Array.isArray(prod) ? prod : [])
      setBeneficiaries(Array.isArray(benef) ? benef : [])
      setEmployees(Array.isArray(emp) ? emp : [])
    } catch (error) {
      console.error('Erro ao buscar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const resetForm = () => {
    setForm({ beneficiaryId: '', employeeId: '', date: new Date().toISOString().split('T')[0], notes: '' })
    setFormItems([{ productId: '', quantity: 0 }])
    setEditingId(null)
    setShowForm(false)
    setCalcOpen(null)
  }

  const startEdit = (dist: Distribution) => {
    setForm({
      beneficiaryId: dist.beneficiary.id,
      employeeId: dist.employee?.id || '',
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
    const validItems = formItems.filter(i => i.productId && i.quantity > 0)
    if (validItems.length === 0) return alert('Adicione pelo menos um produto!')

    try {
      const url = editingId ? `/api/distribuicoes/${editingId}` : '/api/distribuicoes'
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          employeeId: form.employeeId || null,
          items: validItems,
        }),
      })
      if (res.ok) {
        resetForm()
        fetchAll()
      } else {
        const data = await res.json()
        alert(data.error || 'Erro ao salvar')
      }
    } catch (error) {
      console.error('Erro ao salvar distribuição:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta distribuição? O estoque será ajustado automaticamente.')) return
    try {
      const res = await fetch(`/api/distribuicoes/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchAll()
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

      {/* Formulário */}
      {showForm && podeEditar && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-4 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {editingId ? '✏️ Editar Distribuição' : 'Registrar Distribuição'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Funcionário (entrega)</label>
              <select
                value={form.employeeId}
                onChange={e => setForm({ ...form, employeeId: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
              >
                <option value="">Selecione...</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
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

          {/* Produtos entregues */}
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

                {/* Indicador de caixas (quando vier da calculadora) */}
                {item.boxes !== undefined && item.boxes > 0 && (
                  <p className="text-xs text-blue-600 mt-1 ml-1">
                    📦 {item.boxes} caixa{item.boxes > 1 ? 's' : ''} · peso líquido (tara descontada)
                  </p>
                )}

                {/* Calculadora (componente reutilizável) */}
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

          {/* Observações */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
              rows={2}
            />
          </div>

          {/* Botões */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-2.5 rounded-lg font-medium transition w-full sm:w-auto"
            >
              {editingId ? 'Atualizar Distribuição' : 'Registrar Distribuição'}
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
            return (
              <div key={dist.id} className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
                {/* Cabeçalho do card */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{dist.beneficiary.name}</h3>
                    <p className="text-sm text-gray-500">
                      {formatDate(dist.date)}
                      {dist.employee && (
                        <>
                          <span className="hidden sm:inline"> • Entrega: {dist.employee.name}</span>
                          <span className="block sm:hidden">Entrega: {dist.employee.name}</span>
                        </>
                      )}
                    </p>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-medium text-red-600">
                      {dist.items.length} {dist.items.length === 1 ? 'item' : 'itens'}
                    </span>
                    {totalBoxes > 0 && (
                      <span className="text-sm font-medium text-blue-600">
                        📦 {totalBoxes} cx
                      </span>
                    )}
                    {podeEditar && (
                      <>
                        <button
                          onClick={() => startEdit(dist)}
                          className="text-blue-500 hover:text-blue-700 text-sm font-medium px-2 py-1 rounded hover:bg-blue-50 transition"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(dist.id)}
                          className="text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition"
                        >
                          Excluir
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Tags dos itens */}
                <div className="flex flex-wrap gap-2">
                  {dist.items.map(item => (
                    <span
                      key={item.id}
                      className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs sm:text-sm"
                    >
                      {item.product.name}: {item.quantity} {item.product.unit}
                      {item.boxes ? ` · ${item.boxes}cx` : ''}
                    </span>
                  ))}
                </div>

                {/* Observações */}
                {dist.notes && (
                  <p className="text-sm text-gray-400 mt-2 italic">📝 {dist.notes}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
