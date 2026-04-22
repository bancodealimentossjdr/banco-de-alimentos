'use client'

import { useEffect, useState } from 'react'
import { usePermissions } from '@/hooks/usePermissions'

interface Product {
  id: string
  name: string
  category: string
  unit: string
  minStock: number // mantido no type (vem da API), mas não exibido
  _count?: { donationItems: number; distributionItems: number }
}

const CATEGORIES = [
  { value: 'hortifruti', label: 'Hortifruti' },
  { value: 'laticinios', label: 'Laticínios' },
  { value: 'graos', label: 'Grãos e Cereais' },
  { value: 'carnes', label: 'Carnes' },
  { value: 'padaria', label: 'Padaria' },
  { value: 'enlatados', label: 'Enlatados' },
  { value: 'bebidas', label: 'Bebidas' },
  { value: 'higiene', label: 'Higiene' },
  { value: 'limpeza', label: 'Limpeza' },
  { value: 'outros', label: 'Outros' },
]

// Unidades novas (abreviadas)
const UNITS = [
  { value: 'kg',  label: 'Quilograma (kg)' },
  { value: 'g',   label: 'Grama (g)' },
  { value: 'un',  label: 'Unidade (un)' },
  { value: 'dz',  label: 'Dúzia (dz)' },
  { value: 'L',   label: 'Litro (L)' },
  { value: 'ml',  label: 'Mililitro (ml)' },
  { value: 'cx',  label: 'Caixa (cx)' },
  { value: 'pct', label: 'Pacote (pct)' },
  { value: 'sc',  label: 'Saco (sc)' },
  { value: 'fd',  label: 'Fardo (fd)' },
]

// Valores legados (produtos antigos) — aparecem só se o produto já usar
const LEGACY_UNITS: Record<string, string> = {
  caixa:  'Caixa (legado)',
  pacote: 'Pacote (legado)',
  fardo:  'Fardo (legado)',
  saco:   'Saco (legado)',
}

const CATEGORY_ICONS: Record<string, string> = {
  hortifruti: '🥬',
  laticinios: '🧀',
  graos: '🌾',
  carnes: '🥩',
  padaria: '🍞',
  enlatados: '🥫',
  bebidas: '🥤',
  higiene: '🧴',
  limpeza: '🧹',
  outros: '📦',
}

export default function ProdutosPage() {
  const { canEdit } = usePermissions()
  const podeEditar = canEdit('produtos')

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', category: 'hortifruti', unit: 'kg',
  })

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/produtos')
      const data = await res.json()
      setProducts(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Erro ao buscar produtos:', error)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProducts() }, [])

  const resetForm = () => {
    setForm({ name: '', category: 'hortifruti', unit: 'kg' })
    setEditingId(null)
    setShowForm(false)
  }

  const startEdit = (product: Product) => {
    setForm({
      name: product.name,
      category: product.category,
      unit: product.unit,
    })
    setEditingId(product.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingId ? `/api/produtos/${editingId}` : '/api/produtos'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        resetForm()
        fetchProducts()
      } else {
        const data = await res.json()
        alert(data.error || 'Erro ao salvar')
      }
    } catch (error) {
      console.error('Erro ao salvar produto:', error)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir "${name}"?`)) return
    try {
      const res = await fetch(`/api/produtos/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchProducts()
      } else {
        const data = await res.json()
        alert(data.error || 'Erro ao excluir')
      }
    } catch (error) {
      console.error('Erro ao excluir:', error)
      alert('Erro ao excluir produto')
    }
  }

  const getCategoryLabel = (value: string) =>
    CATEGORIES.find(c => c.value === value)?.label || value

  const getCategoryIcon = (value: string) =>
    CATEGORY_ICONS[value] || '📦'

  // Lista de unidades a exibir no select — inclui legado se o produto usar
  const getUnitOptions = (currentUnit: string) => {
    const options = [...UNITS]
    // Se o produto atual usa uma unidade legada, adiciona ela na lista
    if (currentUnit && !UNITS.some(u => u.value === currentUnit)) {
      const legacyLabel = LEGACY_UNITS[currentUnit] || `${currentUnit} (legado)`
      options.push({ value: currentUnit, label: legacyLabel })
    }
    return options
  }

  return (
    <div>
      {/* Header da página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">📦 Produtos</h2>
        {podeEditar && (
          <button
            onClick={() => { if (showForm) resetForm(); else setShowForm(true) }}
            className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium transition w-full sm:w-auto text-center"
          >
            {showForm ? 'Cancelar' : '+ Novo Produto'}
          </button>
        )}
      </div>

      {/* Formulário */}
      {showForm && podeEditar && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-4 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {editingId ? '✏️ Editar Produto' : 'Novo Produto'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
              <select
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidade *</label>
              <select
                value={form.unit}
                onChange={e => setForm({ ...form, unit: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                {getUnitOptions(form.unit).map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium transition w-full sm:w-auto"
            >
              {editingId ? 'Atualizar Produto' : 'Salvar Produto'}
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-6xl mb-4">📦</p>
          <p className="text-xl">Nenhum produto cadastrado</p>
          {podeEditar && (
            <p className="text-sm mt-2">Clique em &quot;+ Novo Produto&quot; para começar</p>
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
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Categoria</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Unidade</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Movimentações</th>
                    {podeEditar && (
                      <th className="px-6 py-3 text-sm font-semibold text-gray-600">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {products.map(product => (
                    <tr key={product.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {getCategoryIcon(product.category)} {product.name}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          {getCategoryLabel(product.category)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{product.unit}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm">
                        {product._count
                          ? product._count.donationItems + product._count.distributionItems
                          : 0}
                      </td>
                      {podeEditar && (
                        <td className="px-6 py-4">
                          <div className="flex gap-3">
                            <button
                              onClick={() => startEdit(product)}
                              className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDelete(product.id, product.name)}
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
            {products.map(product => (
              <div key={product.id} className="bg-white rounded-xl shadow-sm border p-4">
                {/* Topo: ícone + nome + unidade */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-2xl shrink-0">{getCategoryIcon(product.category)}</span>
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{product.name}</h3>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        {getCategoryLabel(product.category)}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold">
                    {product.unit}
                  </span>
                </div>

                {/* Info: movimentações */}
                {product._count && (
                  <div className="flex items-center gap-3 text-sm text-gray-500 mb-3">
                    <span className="text-xs text-gray-400">
                      📊 {product._count.donationItems + product._count.distributionItems} movimentações
                    </span>
                  </div>
                )}

                {/* Ações — só aparecem pra quem pode editar */}
                {podeEditar && (
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => startEdit(product)}
                      className="flex-1 text-center text-blue-600 hover:bg-blue-50 py-2 rounded-lg text-sm font-medium transition"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => handleDelete(product.id, product.name)}
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
