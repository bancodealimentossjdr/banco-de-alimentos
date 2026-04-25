'use client'
import { usePermissions } from '@/hooks/usePermissions'
import { useEffect, useState } from 'react'
import CalculadoraPeso from '@/components/CalculadoraPeso'

interface Product { id: string; name: string; unit: string }
interface Donor { id: string; name: string }
interface Employee { id: string; name: string }
interface FormItem { productId: string; quantity: number; boxes?: number }
interface DonationItem {
  id: string
  quantity: number
  boxes: number | null
  product: { name: string; unit: string }
}
interface Donation {
  id: string; date: string; notes: string | null
  donor: { id: string; name: string }
  employee: { id: string; name: string } | null
  employee2: { id: string; name: string } | null
  employee3: { id: string; name: string } | null
  items: DonationItem[]
}

export default function DoacoesPage() {
  const { canEdit } = usePermissions()
  const podeEditar = canEdit('doacoes')

  const [donations, setDonations] = useState<Donation[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [donors, setDonors] = useState<Donor[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    donorId: '',
    employeeId: '',
    employee2Id: '',
    employee3Id: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const [formItems, setFormItems] = useState<FormItem[]>([{ productId: '', quantity: 0 }])

  const [calcOpen, setCalcOpen] = useState<number | null>(null)

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
    setForm({
      donorId: '', employeeId: '', employee2Id: '', employee3Id: '',
      date: new Date().toISOString().split('T')[0], notes: '',
    })
    setFormItems([{ productId: '', quantity: 0 }])
    setEditingId(null)
    setShowForm(false)
    setCalcOpen(null)
  }

  const startEdit = (donation: Donation) => {
    setForm({
      donorId: donation.donor.id,
      employeeId: donation.employee?.id || '',
      employee2Id: donation.employee2?.id || '',
      employee3Id: donation.employee3?.id || '',
      date: donation.date.split('T')[0],
      notes: donation.notes || '',
    })
    setFormItems(
      donation.items.map(item => ({
        productId: products.find(p => p.name === item.product.name)?.id || '',
        quantity: item.quantity,
        boxes: item.boxes ?? undefined,
      }))
    )
    setEditingId(donation.id)
    setShowForm(true)
    setCalcOpen(null)
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

  const openCalc = (index: number) => setCalcOpen(index)
  const closeCalc = () => setCalcOpen(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.employeeId) {
      return alert('Selecione o funcionário responsável!')
    }

    // 🔍 Validação local: funcionários não podem se repetir
    const empIds = [form.employeeId, form.employee2Id, form.employee3Id].filter(Boolean)
    if (empIds.length !== new Set(empIds).size) {
      alert('Não é possível selecionar o mesmo funcionário mais de uma vez.')
      return
    }

    const validItems = formItems.filter(i => i.productId && i.quantity > 0)
    if (validItems.length === 0) return alert('Adicione pelo menos um produto!')

    try {
      const url = editingId ? '/api/doacoes/' + editingId : '/api/doacoes'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          employeeId: form.employeeId,
          employee2Id: form.employee2Id || null,
          employee3Id: form.employee3Id || null,
          items: validItems,
        }),
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

  // 🧑‍🤝‍🧑 Lista de funcionários da doação (filtra os nulos)
  const getDonationEmployees = (donation: Donation) => {
    return [donation.employee, donation.employee2, donation.employee3].filter(Boolean) as { id: string; name: string }[]
  }

  return (
    <div>
      {/* Header da página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">📥 Doações / Coletas</h2>
        {podeEditar && (
          <button
            onClick={() => { if (showForm) resetForm(); else setShowForm(true) }}
            className="bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-lg font-medium transition w-full sm:w-auto text-center"
          >
            {showForm ? 'Cancelar' : '+ Nova Doação'}
          </button>
        )}
      </div>

      {/* Formulário */}
      {showForm && podeEditar && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-4 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {editingId ? '✏️ Editar Doação' : 'Registrar Doação'}
          </h2>

          {/* Doador e Data */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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

          {/* 🧑‍🤝‍🧑 Funcionários da coleta (até 3) — padrão da colheita */}
          <div className="mt-2 mb-6">
            <h3 className="text-md font-semibold text-gray-800 mb-3">🧑‍🤝‍🧑 Funcionários da Coleta</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Funcionário 1 *</label>
                <select
                  value={form.employeeId}
                  onChange={e => setForm({ ...form, employeeId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                  required
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Funcionário 3 <span className="text-gray-400 text-xs">(opcional)</span>
                </label>
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
          {podeEditar && (
            <p className="text-sm mt-2">Clique em &quot;+ Nova Doação&quot; para começar</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {donations.map(donation => {
            const totalBoxes = donation.items.reduce((sum, i) => sum + (i.boxes || 0), 0)
            const donationEmployees = getDonationEmployees(donation)
            return (
              <div key={donation.id} className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
                {/* Cabeçalho do card */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-gray-900">{donation.donor.name}</h3>
                      {totalBoxes > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          📦 {totalBoxes} cx
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {formatDate(donation.date)}
                    </p>
                    {/* 🧑‍🤝‍🧑 Funcionários — badges roxos (igual colheita) */}
                    {donationEmployees.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {donationEmployees.map(emp => (
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

                  {/* Ações */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-medium text-green-600">
                      {donation.items.length} {donation.items.length === 1 ? 'item' : 'itens'}
                    </span>
                    {podeEditar && (
                      <>
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
                      </>
                    )}
                  </div>
                </div>

                {/* Tags dos itens — desktop em linha, mobile vertical (igual colheita) */}
                <div className="mb-3">
                  {/* Desktop */}
                  <div className="hidden sm:flex flex-wrap gap-2">
                    {donation.items.map(item => (
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
                      </div>
                    ))}
                  </div>

                  {/* Mobile */}
                  <div className="sm:hidden space-y-1.5">
                    {donation.items.map(item => (
                      <div key={item.id} className="flex items-center justify-between bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <span className="text-green-700 font-medium">{item.product.name}</span>
                          <span className="text-gray-500 ml-1">
                            ({item.quantity} {item.product.unit}
                            {item.boxes ? ` · ${item.boxes}cx` : ''})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Observações */}
                {donation.notes && (
                  <p className="text-sm text-gray-400 mt-2 italic">📝 {donation.notes}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
