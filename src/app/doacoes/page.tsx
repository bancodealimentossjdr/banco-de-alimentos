'use client'

import { useEffect, useState } from 'react'

interface Product { id: string; name: string; unit: string }
interface Donor { id: string; name: string }
interface Employee { id: string; name: string }
interface FormItem { productId: string; quantity: number }
interface DonationItem { id: string; quantity: number; product: { name: string; unit: string } }
interface Donation {
  id: string; date: string; notes: string | null
  donor: { id: string; name: string }
  employee: { id: string; name: string } | null
  items: DonationItem[]
}

export default function DoacoesPage() {
  const [donations, setDonations] = useState<Donation[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [donors, setDonors] = useState<Donor[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    donorId: '', employeeId: '', date: new Date().toISOString().split('T')[0], notes: '',
  })
  const [formItems, setFormItems] = useState<FormItem[]>([{ productId: '', quantity: 0 }])

  const [calcOpen, setCalcOpen] = useState<number | null>(null)
  const [calcWeights, setCalcWeights] = useState<{ description: string; weight: number }[]>([
    { description: '', weight: 0 },
  ])

  const fetchAll = async () => {
    try {
      const [donRes, prodRes, donorRes, empRes] = await Promise.all([
        fetch('/api/doacoes'), fetch('/api/produtos'), fetch('/api/doadores'), fetch('/api/funcionarios'),
      ])
      const [don, prod, donor, emp] = await Promise.all([
        donRes.json(), prodRes.json(), donorRes.json(), empRes.json(),
      ])
      setDonations(Array.isArray(don) ? don : [])
      setProducts(Array.isArray(prod) ? prod : [])
      setDonors(Array.isArray(donor) ? donor : [])
      setEmployees(Array.isArray(emp) ? emp : [])
    } catch (error) {
      console.error('Erro ao buscar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const resetForm = () => {
    setForm({ donorId: '', employeeId: '', date: new Date().toISOString().split('T')[0], notes: '' })
    setFormItems([{ productId: '', quantity: 0 }])
    setEditingId(null)
    setShowForm(false)
    setCalcOpen(null)
    setCalcWeights([{ description: '', weight: 0 }])
  }

  const startEdit = (donation: Donation) => {
    setForm({
      donorId: donation.donor.id,
      employeeId: donation.employee?.id || '',
      date: donation.date.split('T')[0],
      notes: donation.notes || '',
    })
    setFormItems(
      donation.items.map(item => ({
        productId: products.find(p => p.name === item.product.name)?.id || '',
        quantity: item.quantity,
      }))
    )
    setEditingId(donation.id)
    setShowForm(true)
    setCalcOpen(null)
    // Scroll para o topo do formulário no mobile
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const addItem = () => setFormItems([...formItems, { productId: '', quantity: 0 }])
  const removeItem = (index: number) => {
    if (formItems.length > 1) setFormItems(formItems.filter((_, i) => i !== index))
    if (calcOpen === index) setCalcOpen(null)
  }
  const updateItem = (index: number, field: string, value: string | number) => {
    const updated = [...formItems]
    updated[index] = { ...updated[index], [field]: value }
    setFormItems(updated)
  }

  const openCalc = (index: number) => {
    setCalcOpen(index)
    setCalcWeights([{ description: '', weight: 0 }])
  }
  const closeCalc = () => { setCalcOpen(null); setCalcWeights([{ description: '', weight: 0 }]) }
  const addCalcWeight = () => setCalcWeights([...calcWeights, { description: '', weight: 0 }])
  const removeCalcWeight = (i: number) => {
    if (calcWeights.length > 1) setCalcWeights(calcWeights.filter((_, idx) => idx !== i))
  }
  const updateCalcWeight = (i: number, field: string, value: string | number) => {
    const updated = [...calcWeights]
    updated[i] = { ...updated[i], [field]: value }
    setCalcWeights(updated)
  }
  const calcTotal = calcWeights.reduce((sum, w) => sum + (w.weight || 0), 0)
  const applyCalcTotal = () => {
    if (calcOpen !== null) {
      updateItem(calcOpen, 'quantity', parseFloat(calcTotal.toFixed(2)))
      closeCalc()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validItems = formItems.filter(i => i.productId && i.quantity > 0)
    if (validItems.length === 0) return alert('Adicione pelo menos um produto!')
    try {
      const url = editingId ? '/api/doacoes/' + editingId : '/api/doacoes'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, employeeId: form.employeeId || null, items: validItems }),
      })
      if (res.ok) { resetForm(); fetchAll() }
      else { const data = await res.json(); alert(data.error || 'Erro ao salvar') }
    } catch (error) { console.error('Erro ao salvar:', error) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta doação? O estoque será ajustado automaticamente.')) return
    try {
      const res = await fetch('/api/doacoes/' + id, { method: 'DELETE' })
      if (res.ok) fetchAll()
      else { const data = await res.json(); alert(data.error || 'Erro ao excluir') }
    } catch (error) { console.error('Erro ao excluir:', error); alert('Erro ao excluir doação') }
  }

  const formatDate = (date: string) => {
    const raw = date.includes('T') ? date.split('T')[0] : date
    const [year, month, day] = raw.split('-')
    return day + '/' + month + '/' + year
  }

  return (
    <div>
      {/* Header da página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">📥 Doações / Coletas</h2>
        <button
          onClick={() => { if (showForm) resetForm(); else setShowForm(true) }}
          className="bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-lg font-medium transition w-full sm:w-auto text-center"
        >
          {showForm ? 'Cancelar' : '+ Nova Doação'}
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-4 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {editingId ? '✏️ Editar Doação' : 'Registrar Doação'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Doador *</label>
              <select
                value={form.donorId}
                onChange={e => setForm({ ...form, donorId: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                required
              >
                <option value="">Selecione...</option>
                {donors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Funcionário (coleta)</label>
              <select
                value={form.employeeId}
                onChange={e => setForm({ ...form, employeeId: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
              >
                <option value="">Selecione...</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
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
          </div>

          {/* Produtos recebidos */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-semibold text-gray-700">Produtos recebidos *</label>
              <button type="button" onClick={addItem} className="text-sm text-green-600 hover:text-green-700 font-medium">
                + Adicionar produto
              </button>
            </div>

            {formItems.map((item, index) => (
              <div key={index} className="mb-3">
                {/* Layout dos itens - empilha no mobile */}
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

                {/* Calculadora */}
                {calcOpen === index && (
                  <div className="mt-2 p-3 md:p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-sm font-semibold text-blue-700">🧮 Calculadora de Peso</p>
                      <button type="button" onClick={closeCalc} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
                    </div>
                    <p className="text-xs text-blue-500 mb-3 hidden sm:block">Some os pesos das caixas/sacolas</p>

                    <div className="space-y-2 mb-3">
                      {calcWeights.map((w, i) => (
                        <div key={i} className="flex flex-col sm:flex-row gap-2 sm:items-center">
                          <span className="text-xs font-medium text-blue-400 w-6 text-center hidden sm:block">{i + 1}.</span>
                          <input
                            type="text"
                            placeholder="Ex: Caixa de tomate"
                            value={w.description}
                            onChange={e => updateCalcWeight(i, 'description', e.target.value)}
                            className="flex-1 border rounded px-3 py-2 text-sm bg-white"
                          />
                          <div className="flex gap-2 items-center">
                            <div className="relative flex-1 sm:w-28 sm:flex-none">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={w.weight || ''}
                                onChange={e => updateCalcWeight(i, 'weight', parseFloat(e.target.value) || 0)}
                                className="w-full border rounded px-3 py-2 text-sm pr-8 bg-white"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">kg</span>
                            </div>
                            {calcWeights.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeCalcWeight(i)}
                                className="shrink-0 text-red-400 hover:text-red-600 p-1"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={addCalcWeight}
                      className="text-blue-600 hover:text-blue-700 text-xs font-medium mb-3 block"
                    >
                      + Adicionar pesagem
                    </button>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white rounded-lg px-4 py-3 border border-blue-200">
                      <div>
                        <span className="text-sm text-blue-600 font-medium">Total: </span>
                        <span className="text-lg font-bold text-blue-700">{calcTotal.toFixed(2)} kg</span>
                      </div>
                      <button
                        type="button"
                        onClick={applyCalcTotal}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition w-full sm:w-auto"
                      >
                        Aplicar peso
                      </button>
                    </div>
                  </div>
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
              className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
              rows={2}
            />
          </div>

          {/* Botões do formulário */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-2.5 rounded-lg font-medium transition w-full sm:w-auto"
            >
              {editingId ? 'Atualizar Doação' : 'Registrar Doação'}
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

      {/* Lista de doações */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
        </div>
      ) : donations.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-6xl mb-4">📥</p>
          <p className="text-xl">Nenhuma doação registrada</p>
          <p className="text-sm mt-2">Clique em &quot;+ Nova Doação&quot; para começar</p>
        </div>
      ) : (
        <div className="space-y-4">
          {donations.map(donation => (
            <div key={donation.id} className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
              {/* Cabeçalho do card */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-900 truncate">{donation.donor.name}</h3>
                  <p className="text-sm text-gray-500">
                    {formatDate(donation.date)}
                    {donation.employee && (
                      <>
                        <span className="hidden sm:inline"> • Coleta: {donation.employee.name}</span>
                        <span className="block sm:hidden">Coleta: {donation.employee.name}</span>
                      </>
                    )}
                  </p>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-medium text-green-600">
                    {donation.items.length} {donation.items.length === 1 ? 'item' : 'itens'}
                  </span>
                  <button
                    onClick={() => startEdit(donation)}
                    className="text-blue-500 hover:text-blue-700 text-sm font-medium px-2 py-1 rounded hover:bg-blue-50 transition"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(donation.id)}
                    className="text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition"
                  >
                    Excluir
                  </button>
                </div>
              </div>

              {/* Tags dos itens */}
              <div className="flex flex-wrap gap-2">
                {donation.items.map(item => (
                  <span
                    key={item.id}
                    className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs sm:text-sm"
                  >
                    {item.product.name}: {item.quantity} {item.product.unit}
                  </span>
                ))}
              </div>

              {/* Observações */}
              {donation.notes && (
                <p className="text-sm text-gray-400 mt-2 italic">📝 {donation.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
