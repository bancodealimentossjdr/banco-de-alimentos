'use client'

import { useEffect, useState } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { useFormSubmit } from '@/hooks/useFormSubmit'

interface Product {
  id: string
  name: string
  category: string
  unit: string
  minStock: number
  isPaa: boolean
  codigoConab: number | null
  codigoConabOrganico: number | null
  temOrganico: boolean
  paaConvencional: string | null
  paaOrganico: string | null
  paaUnidade: string | null
  paaFatorKg: string
  _count?: { donationItems: number; distributionItems: number }
}

const CATEGORIES = [
  { value: 'bebidas', label: 'Bebidas' },
  { value: 'carnes', label: 'Carnes' },
  { value: 'enlatados', label: 'Enlatados' },
  { value: 'fruta', label: 'Fruta' },
  { value: 'graos', label: 'Grãos e Cereais' },
  { value: 'higiene', label: 'Higiene' },
  { value: 'hortifruti', label: 'Hortifruti' },
  { value: 'ingredientes', label: 'Ingredientes Culinários' },
  { value: 'laticinios', label: 'Laticínios' },
  { value: 'limpeza', label: 'Limpeza' },
  { value: 'massa', label: 'Massa' },
  { value: 'padaria', label: 'Padaria' },
  { value: 'tuberculos', label: 'Tubérculos/Raízes' },
  { value: 'verdura', label: 'Verdura' },
  { value: 'outros', label: 'Outros' },
]

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

// Unidades da tabela CONAB (como o preço é cotado)
const PAA_UNIDADES = ['Kg', 'Dúzia', 'Litro', 'Maço', 'Unidade']

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
  massa: '🍝',
  tuberculos: '🥔',
  fruta: '🍎',
  verdura: '🥗',
  ingredientes: '🧂',
  outros: '📦',
}

type PaaFilter = 'todos' | 'paa' | 'nao-paa'

const EMPTY_FORM = {
  name: '',
  category: 'hortifruti',
  unit: 'kg',
  isPaa: false,
  codigoConab: '',
  paaConvencional: '',
  paaUnidade: 'Kg',
  paaFatorKg: '1',
  temOrganico: false,
  paaOrganico: '',
  codigoConabOrganico: '',
}

const brl = (v: string | null) =>
  v === null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function ProdutosPage() {
  const { canEdit } = usePermissions()
  const podeEditar = canEdit('produtos')

  const { isSubmitting, handleSubmit: runSubmit } = useFormSubmit()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<PaaFilter>('todos')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)

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
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(false)
  }

  const startEdit = (p: Product) => {
    setForm({
      name: p.name,
      category: p.category,
      unit: p.unit,
      isPaa: p.isPaa,
      codigoConab: p.codigoConab?.toString() ?? '',
      paaConvencional: p.paaConvencional ?? '',
      paaUnidade: p.paaUnidade ?? 'Kg',
      paaFatorKg: p.paaFatorKg ?? '1',
      temOrganico: p.temOrganico,
      paaOrganico: p.paaOrganico ?? '',
      codigoConabOrganico: p.codigoConabOrganico?.toString() ?? '',
    })
    setEditingId(p.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await runSubmit(async () => {
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
    })
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

  const getCategoryLabel = (v: string) => CATEGORIES.find(c => c.value === v)?.label || v
  const getCategoryIcon = (v: string) => CATEGORY_ICONS[v] || '📦'

  const getCategoryOptions = (current: string) => {
    const options = [...CATEGORIES]
    if (current && !CATEGORIES.some(c => c.value === current)) {
      options.push({ value: current, label: `${current} (legado)` })
    }
    return options
  }

  const getUnitOptions = (current: string) => {
    const options = [...UNITS]
    if (current && !UNITS.some(u => u.value === current)) {
      options.push({ value: current, label: LEGACY_UNITS[current] || `${current} (legado)` })
    }
    return options
  }

  const norm = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  const visible = products.filter(p => {
    if (filter === 'paa' && !p.isPaa) return false
    if (filter === 'nao-paa' && p.isPaa) return false
    if (search.trim() && !norm(p.name).includes(norm(search))) return false
    return true
  })

  const totalPaa = products.filter(p => p.isPaa).length

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
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

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar produto..."
          className="flex-1 border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {([
            ['todos', `Todos (${products.length})`],
            ['paa', `🌾 PAA (${totalPaa})`],
            ['nao-paa', `Sem PAA (${products.length - totalPaa})`],
          ] as [PaaFilter, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition whitespace-nowrap ${
                filter === value ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
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
                {getCategoryOptions(form.category).map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidade de estoque *</label>
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

          {/* ====== BLOCO PAA ====== */}
          <div className="mt-5 pt-5 border-t">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isPaa}
                onChange={e => setForm({ ...form, isPaa: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm font-semibold text-gray-800">
                🌾 Produto do PAA (Programa de Aquisição de Alimentos)
              </span>
            </label>

            {form.isPaa && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-xs text-green-800 mb-4">
                  Preços conforme <strong>Tabela CONAB</strong> vigente — Plano Operacional 05063-2025-3162500.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Código CONAB *</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={form.codigoConab}
                      onChange={e => setForm({ ...form, codigoConab: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Preço convencional (R$)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.paaConvencional}
                      onChange={e => setForm({ ...form, paaConvencional: e.target.value })}
                      placeholder="0,00"
                      className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unidade PAA *</label>
                    <select
                      value={form.paaUnidade}
                      onChange={e => setForm({ ...form, paaUnidade: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      {PAA_UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fator → kg *</label>
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={form.paaFatorKg}
                      onChange={e => setForm({ ...form, paaFatorKg: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">1 {form.paaUnidade} = {form.paaFatorKg || '?'} kg</p>
                  </div>
                </div>

                {/* Sub-bloco orgânico */}
                <div className="mt-4 pt-4 border-t border-green-200">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.temOrganico}
                      onChange={e => setForm({ ...form, temOrganico: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm font-medium text-gray-800">🍃 Tem versão orgânica</span>
                  </label>

                  {form.temOrganico && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Preço orgânico (R$) *</label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={form.paaOrganico}
                          onChange={e => setForm({ ...form, paaOrganico: e.target.value })}
                          placeholder="0,00"
                          className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Código CONAB orgânico
                        </label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={form.codigoConabOrganico}
                          onChange={e => setForm({ ...form, codigoConabOrganico: e.target.value })}
                          placeholder="Deixe vazio se for o mesmo código"
                          className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Só nos casos divergentes (ex.: Acerola 67 / 68).
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-5">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium transition w-full sm:w-auto"
            >
              {isSubmitting ? 'Salvando...' : editingId ? 'Atualizar Produto' : 'Salvar Produto'}
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-6xl mb-4">📦</p>
          <p className="text-xl">
            {products.length === 0 ? 'Nenhum produto cadastrado' : 'Nenhum produto encontrado'}
          </p>
          {podeEditar && products.length === 0 && (
            <p className="text-sm mt-2">Clique em &quot;+ Novo Produto&quot; para começar</p>
          )}
        </div>
      ) : (
        <>
          {/* ====== TABELA (md+) ====== */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Nome</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Categoria</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Unidade</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">PAA</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-600">Movim.</th>
                    {podeEditar && (
                      <th className="px-6 py-3 text-sm font-semibold text-gray-600">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visible.map(product => (
                    <tr key={product.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {getCategoryIcon(product.category)} {product.name}
                        {product.isPaa && (
                          <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs font-bold">
                            🌾 PAA
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          {getCategoryLabel(product.category)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{product.unit}</td>
                      <td className="px-6 py-4 text-xs text-gray-600 whitespace-nowrap">
                        {product.isPaa ? (
                          <>
                            <span className="text-gray-400">#{product.codigoConab}</span>
                            {' · '}
                            {brl(product.paaConvencional)}/{product.paaUnidade}
                            {product.temOrganico && (
                              <span className="block text-green-700">
                                🍃 {brl(product.paaOrganico)}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
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

          {/* ====== CARDS (mobile) ====== */}
          <div className="md:hidden space-y-3">
            {visible.map(product => (
              <div key={product.id} className="bg-white rounded-xl shadow-sm border p-4">
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

                {product.isPaa && (
                  <div className="mb-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-900">
                    <div className="font-bold mb-0.5">🌾 PAA · código {product.codigoConab}</div>
                    <div>Convencional: {brl(product.paaConvencional)} / {product.paaUnidade}</div>
                    {product.temOrganico && <div>🍃 Orgânico: {brl(product.paaOrganico)}</div>}
                    {product.paaFatorKg !== '1' && (
                      <div className="text-green-700">1 {product.paaUnidade} = {product.paaFatorKg} kg</div>
                    )}
                  </div>
                )}

                {product._count && (
                  <div className="flex items-center gap-3 text-sm text-gray-500 mb-3">
                    <span className="text-xs text-gray-400">
                      📊 {product._count.donationItems + product._count.distributionItems} movimentações
                    </span>
                  </div>
                )}

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
