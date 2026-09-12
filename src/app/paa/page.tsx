'use client'

import { useState, useMemo } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { useFormSubmit } from '@/hooks/useFormSubmit'
import { useApi, invalidate } from '@/hooks/useApi'
import { useFuncionarios } from '@/hooks/useCadastros'
import { comSelecionado, sufixoInativo } from '@/lib/select-utils'
import CalculadoraPeso from '@/components/CalculadoraPeso'

interface ProdutoPaa {
  id: string
  name: string
  active: boolean
  temOrganico: boolean
  paaUnidade: string | null
  paaConvencional: string | number | null
  paaOrganico: string | number | null
  paaFatorKg: string | number
}

interface ProdutorPaa {
  id: string
  name: string
  active: boolean
}

interface EntregaItem {
  id: string
  productId: string
  tipoCultivo: 'CONVENCIONAL' | 'ORGANICO'
  quantidade: number
  precoUnitario: number | null
  fatorKg: number
  pesoKg: number
  subtotal: number | null
  product: { id: string; name: string; paaUnidade: string | null; unit: string }
}

interface Entrega {
  id: string
  dataEntrega: string
  numeroNota: string | null
  observacoes: string | null
  valorTotal: number | null
  pesoTotalKg: number
  isMasked?: boolean
  producer: { id: string; name: string }
  employee: { id: string; name: string } | null
  employee2: { id: string; name: string } | null
  itens: EntregaItem[]
}

interface FormItem {
  productId: string
  tipoCultivo: 'CONVENCIONAL' | 'ORGANICO'
  quantidade: number
}

const hoje = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * 🏷️ ONDA 23.7e-2 — abreviação cosmética da unidade do PAA.
 * NÃO altera cálculo: `paaFatorKg` continua sendo a fonte de verdade do peso.
 */
const abrevUnidade = (u: string | null | undefined): string => {
  const v = (u ?? 'Kg').trim().toLowerCase()
  if (v.startsWith('litro') || v === 'l') return 'L'
  if (v.startsWith('dúzia') || v.startsWith('duzia') || v === 'dz') return 'Dz'
  if (v.startsWith('maço') || v.startsWith('maco')) return 'Mç'
  if (v.startsWith('unid') || v === 'un') return 'Un'
  return 'Kg'
}

/**
 * 🧮 A calculadora devolve PESO LÍQUIDO em kg.
 * Só pode alimentar `quantidade` quando a unidade de negociação é o próprio kg.
 * Ovos (Dúzia) e Iogurte (Litro) são pagos por unidade de volume/contagem —
 * aplicar kg ali corromperia peso E valor.
 */
const aceitaCalculadora = (p: ProdutoPaa | undefined): boolean =>
  !!p && abrevUnidade(p.paaUnidade) === 'Kg'

const formInicial = () => ({
  producerId: '',
  dataEntrega: hoje(),
  numeroNota: '',
  observacoes: '',
  employeeId: '',
  employee2Id: '',
  itens: [{ productId: '', tipoCultivo: 'CONVENCIONAL' as const, quantidade: 0 }] as FormItem[],
})

export default function PaaPage() {
  const { canEdit, canEditRecord, canDelete } = usePermissions()
  const podeEditar = canEdit('paa')
  const podeExcluir = canDelete('paa')

  const { isSubmitting, handleSubmit: runSubmit } = useFormSubmit()

  // 🌾 Cadastros filtrados pelo PAA — só carrega para quem edita
  const { data: produtosData } = useApi<ProdutoPaa[]>(
    podeEditar ? '/api/produtos?paa=true' : null
  )
  const { data: produtoresData } = useApi<ProdutorPaa[]>(
    podeEditar ? '/api/produtores?paa=true' : null
  )
  const { funcionarios: employees, funcionariosTodos: employeesAll } = useFuncionarios({
    enabled: podeEditar,
  })

  const produtos = useMemo(() => produtosData ?? [], [produtosData])
  const produtores = useMemo(() => produtoresData ?? [], [produtoresData])

  const {
    data: entregasData,
    isLoading: loadingEntregas,
    mutate: mutateEntregas,
  } = useApi<Entrega[]>('/api/paa', { dedupingInterval: 10_000 })

  const entregas = entregasData ?? []
  const loading = loadingEntregas && !entregasData

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(formInicial())

  // 🧮 Índice do item com a calculadora aberta (null = nenhuma)
  const [calcAberta, setCalcAberta] = useState<number | null>(null)

  // 🔍 Filtros
  const [filtroProducerId, setFiltroProducerId] = useState('')
  const [filtroDe, setFiltroDe] = useState('')
  const [filtroAte, setFiltroAte] = useState('')

  const temFiltroAtivo = !!(filtroProducerId || filtroDe || filtroAte)

  const entregasFiltradas = useMemo(() => {
    return entregas.filter((e) => {
      if (filtroProducerId && e.producer.id !== filtroProducerId) return false
      const data = e.dataEntrega.includes('T') ? e.dataEntrega.split('T')[0] : e.dataEntrega
      if (filtroDe && data < filtroDe) return false
      if (filtroAte && data > filtroAte) return false
      return true
    })
  }, [entregas, filtroProducerId, filtroDe, filtroAte])

  // Produtores do filtro — fallback derivado das entregas (visualizador não carrega cadastro)
  const produtoresFiltro = useMemo(() => {
    if (produtores.length > 0) return produtores
    const map = new Map<string, ProdutorPaa>()
    entregas.forEach((e) => {
      if (!map.has(e.producer.id)) {
        map.set(e.producer.id, { ...e.producer, active: true })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [produtores, entregas])

  const findProduto = (id: string) => produtos.find((p) => p.id === id)

  // 💡 Espelha o cálculo do servidor apenas para PREVIEW.
  //    A verdade é sempre o que o backend devolve.
  const calcLinha = (item: FormItem) => {
    const p = findProduto(item.productId)
    if (!p) return { preco: 0, fator: 1, pesoKg: 0, subtotal: 0, unidade: '', erro: '' }

    const preco = Number(
      item.tipoCultivo === 'ORGANICO' ? p.paaOrganico ?? 0 : p.paaConvencional ?? 0
    )
    const fator = Number(p.paaFatorKg ?? 1)
    const qtd = item.quantidade || 0

    let erro = ''
    if (item.tipoCultivo === 'ORGANICO' && !p.temOrganico) erro = 'Sem versão orgânica'
    else if (preco <= 0) erro = 'Sem preço cadastrado'

    return {
      preco,
      fator,
      pesoKg: qtd * fator,
      subtotal: qtd * preco,
      unidade: abrevUnidade(p.paaUnidade),
      erro,
    }
  }

  const totais = useMemo(() => {
    return form.itens.reduce(
      (acc, item) => {
        const c = calcLinha(item)
        return { pesoKg: acc.pesoKg + c.pesoKg, valor: acc.valor + c.subtotal }
      },
      { pesoKg: 0, valor: 0 }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.itens, produtos])

  const resetForm = () => {
    setForm(formInicial())
    setEditingId(null)
    setShowForm(false)
    setCalcAberta(null)
  }

  const startEdit = (e: Entrega) => {
    setForm({
      producerId: e.producer.id,
      dataEntrega: e.dataEntrega.split('T')[0],
      numeroNota: e.numeroNota || '',
      observacoes: e.observacoes || '',
      employeeId: e.employee?.id || '',
      employee2Id: e.employee2?.id || '',
      itens:
        e.itens.length > 0
          ? e.itens.map((i) => ({
              productId: i.productId,
              tipoCultivo: i.tipoCultivo,
              quantidade: i.quantidade,
            }))
          : [{ productId: '', tipoCultivo: 'CONVENCIONAL', quantidade: 0 }],
    })
    setEditingId(e.id)
    setShowForm(true)
    setCalcAberta(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const addItem = () =>
    setForm({
      ...form,
      itens: [...form.itens, { productId: '', tipoCultivo: 'CONVENCIONAL', quantidade: 0 }],
    })

  const removeItem = (index: number) => {
    if (form.itens.length <= 1) return
    setForm({ ...form, itens: form.itens.filter((_, i) => i !== index) })
    // 🧮 Reindexa a calculadora aberta para não vazar para a linha errada
    setCalcAberta((atual) => {
      if (atual === null) return null
      if (atual === index) return null
      return atual > index ? atual - 1 : atual
    })
  }

  const updateItem = (index: number, field: keyof FormItem, value: string | number) => {
    const itens = [...form.itens]
    itens[index] = { ...itens[index], [field]: value } as FormItem

    if (field === 'productId') {
      const p = findProduto(String(value))
      // Produto sem orgânico → força convencional
      if (p && !p.temOrganico) itens[index].tipoCultivo = 'CONVENCIONAL'
      // 🧮 Trocar para produto em L/Dz fecha a calculadora
      if (calcAberta === index && !aceitaCalculadora(p)) setCalcAberta(null)
    }
    setForm({ ...form, itens })
  }

  /** 🧮 Peso líquido em kg vira a quantidade — válido só em produtos por Kg */
  const aplicarPeso = (index: number, pesoLiquido: number) => {
    updateItem(index, 'quantidade', parseFloat(pesoLiquido.toFixed(3)))
    setCalcAberta(null)
  }

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()

    const validos = form.itens.filter((i) => i.productId && i.quantidade > 0)
    if (validos.length === 0) {
      alert('Adicione pelo menos um item com produto e quantidade.')
      return
    }
    if (validos.some((i) => calcLinha(i).erro)) {
      alert('Corrija os itens marcados em vermelho antes de salvar.')
      return
    }

    await runSubmit(async () => {
      try {
        const url = editingId ? `/api/paa/${editingId}` : '/api/paa'
        const res = await fetch(url, {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            employeeId: form.employeeId || null,
            employee2Id: form.employee2Id || null,
            itens: validos,
          }),
        })
        if (res.ok) {
          resetForm()
          mutateEntregas()
          invalidate('/api/estoque/resumo')
        } else {
          const data = await res.json()
          alert(data.error || 'Erro ao salvar')
        }
      } catch (err) {
        console.error('Erro ao salvar entrega PAA:', err)
        alert('Erro ao salvar entrega')
      }
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta entrega do PAA?')) return
    try {
      const res = await fetch(`/api/paa/${id}`, { method: 'DELETE' })
      if (res.ok) {
        mutateEntregas()
        invalidate('/api/estoque/resumo')
      } else {
        const data = await res.json()
        alert(data.error || 'Erro ao excluir')
      }
    } catch (err) {
      console.error('Erro ao excluir entrega PAA:', err)
      alert('Erro ao excluir entrega')
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">🌾 Entregas do PAA</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Programa de Aquisição de Alimentos · preços da tabela CONAB vigente
          </p>
        </div>
        {podeEditar && (
          <button
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            className="bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-lg font-medium transition w-full sm:w-auto"
          >
            {showForm ? 'Cancelar' : '+ Nova Entrega'}
          </button>
        )}
      </div>

      {showForm && podeEditar && (
        <form onSubmit={onSubmit} className="bg-white rounded-xl shadow-sm border p-4 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {editingId ? '✏️ Editar Entrega' : 'Nova Entrega'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Produtor (PAA) *
              </label>
              <select
                value={form.producerId}
                onChange={(e) => setForm({ ...form, producerId: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                required
              >
                <option value="">Selecione um produtor</option>
                {produtores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {sufixoInativo(p)}
                  </option>
                ))}
              </select>
              {produtores.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠️ Nenhum produtor com &quot;Atende PAA&quot; marcado. Ajuste no cadastro de
                  produtores.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
              <input
                type="date"
                value={form.dataEntrega}
                onChange={(e) => setForm({ ...form, dataEntrega: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nº da Nota <span className="text-gray-400 text-xs">(opcional)</span>
              </label>
              <input
                type="text"
                value={form.numeroNota}
                onChange={(e) => setForm({ ...form, numeroNota: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                placeholder="Ex: 001234"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Funcionário 1</label>
              <select
                value={form.employeeId}
                onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
              >
                <option value="">Selecione...</option>
                {comSelecionado(employees, employeesAll, form.employeeId)
                  .filter((emp) => emp.id !== form.employee2Id)
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                      {sufixoInativo(emp)}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Funcionário 2 <span className="text-gray-400 text-xs">(opcional)</span>
              </label>
              <select
                value={form.employee2Id}
                onChange={(e) => setForm({ ...form, employee2Id: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                disabled={!form.employeeId}
              >
                <option value="">Selecione...</option>
                {comSelecionado(employees, employeesAll, form.employee2Id)
                  .filter((emp) => emp.id !== form.employeeId)
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                      {sufixoInativo(emp)}
                    </option>
                  ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                rows={1}
              />
            </div>
          </div>

          {/* ITENS */}
          <div className="mt-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-md font-semibold text-gray-800">🥬 Itens da Entrega</h3>
              <button
                type="button"
                onClick={addItem}
                className="text-green-600 hover:text-green-700 text-sm font-medium"
              >
                + Adicionar Item
              </button>
            </div>

            <div className="hidden lg:flex gap-3 items-end mb-1 px-1">
              <div className="flex-1"><span className="text-xs text-gray-500">Produto *</span></div>
              <div className="w-36"><span className="text-xs text-gray-500">Cultivo</span></div>
              <div className="w-32"><span className="text-xs text-gray-500">Quantidade *</span></div>
              <div className="w-24 text-right"><span className="text-xs text-gray-500">Preço</span></div>
              <div className="w-24 text-right"><span className="text-xs text-gray-500">Peso (kg)</span></div>
              <div className="w-28 text-right"><span className="text-xs text-gray-500">Subtotal</span></div>
              <div className="w-10"></div>
            </div>

            <div className="space-y-3">
              {form.itens.map((item, index) => {
                const c = calcLinha(item)
                const prod = findProduto(item.productId)
                const podeCalcular = aceitaCalculadora(prod)

                return (
                  <div key={index}>
                    <div
                      className={`flex flex-col lg:flex-row gap-2 lg:gap-3 lg:items-center p-3 lg:p-0 rounded-lg lg:rounded-none ${
                        c.erro ? 'bg-red-50 lg:bg-red-50/60' : 'bg-gray-50 lg:bg-transparent'
                      }`}
                    >
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1 lg:hidden">Produto *</label>
                        <select
                          value={item.productId}
                          onChange={(e) => updateItem(index, 'productId', e.target.value)}
                          className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                        >
                          <option value="">Selecione um produto do PAA</option>
                          {produtos.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({abrevUnidade(p.paaUnidade)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="lg:w-36">
                        <label className="block text-xs text-gray-500 mb-1 lg:hidden">Cultivo</label>
                        <select
                          value={item.tipoCultivo}
                          onChange={(e) => updateItem(index, 'tipoCultivo', e.target.value)}
                          className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                          disabled={!prod?.temOrganico}
                        >
                          <option value="CONVENCIONAL">Convencional</option>
                          {prod?.temOrganico && <option value="ORGANICO">🍃 Orgânico</option>}
                        </select>
                      </div>

                      {/* Quantidade + 🧮 */}
                      <div className="lg:w-32">
                        <label className="block text-xs text-gray-500 mb-1 lg:hidden">
                          Quantidade * {c.unidade && `(${c.unidade})`}
                        </label>
                        <div className="flex gap-1.5">
                          <div className="relative flex-1">
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.001"
                              min="0"
                              value={item.quantidade || ''}
                              onChange={(e) =>
                                updateItem(index, 'quantidade', parseFloat(e.target.value) || 0)
                              }
                              className="w-full border rounded-lg px-3 py-2.5 pr-9 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                              placeholder="0"
                            />
                            {c.unidade && (
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                                {c.unidade}
                              </span>
                            )}
                          </div>
                          {podeCalcular && (
                            <button
                              type="button"
                              onClick={() =>
                                setCalcAberta(calcAberta === index ? null : index)
                              }
                              title="Calculadora de caixas (peso líquido)"
                              aria-label="Abrir calculadora de peso"
                              className={`shrink-0 px-2.5 rounded-lg border text-sm transition ${
                                calcAberta === index
                                  ? 'bg-blue-500 border-blue-500 text-white'
                                  : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'
                              }`}
                            >
                              🧮
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between lg:justify-end gap-3">
                        <div className="lg:w-24 text-right">
                          <span className="block text-xs text-gray-500 lg:hidden">Preço</span>
                          <span className="text-sm text-gray-600">
                            {c.preco > 0 ? brl(c.preco) : '—'}
                          </span>
                        </div>
                        <div className="lg:w-24 text-right">
                          <span className="block text-xs text-gray-500 lg:hidden">Peso</span>
                          <span className="text-sm font-medium text-green-700">
                            {c.pesoKg > 0 ? `${c.pesoKg.toFixed(3)} kg` : '—'}
                          </span>
                        </div>
                        <div className="lg:w-28 text-right">
                          <span className="block text-xs text-gray-500 lg:hidden">Subtotal</span>
                          <span className="text-sm font-semibold text-amber-700">
                            {c.subtotal > 0 ? brl(c.subtotal) : '—'}
                          </span>
                        </div>
                        {form.itens.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="shrink-0 p-2 rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 text-sm"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {c.erro && (
                        <p className="text-xs text-red-600 lg:hidden">⚠️ {c.erro}</p>
                      )}
                    </div>

                    {/* 🧮 Calculadora — mesmo componente de Doações/Distribuições/Colheita */}
                    {calcAberta === index && podeCalcular && (
                      <CalculadoraPeso
                        onApply={(pesoLiquido) => aplicarPeso(index, pesoLiquido)}
                        onClose={() => setCalcAberta(null)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* TOTAIS */}
          {(totais.pesoKg > 0 || totais.valor > 0) && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between gap-3">
              <div>
                <p className="text-xs text-green-600 font-medium">PESO TOTAL</p>
                <p className="text-2xl font-bold text-green-700">
                  {totais.pesoKg.toFixed(3)} kg
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs text-amber-600 font-medium">VALOR TOTAL REPASSADO</p>
                <p className="text-2xl font-bold text-amber-700">{brl(totais.valor)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  ⚠️ Valores recalculados no servidor pela tabela CONAB vigente
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-green-500 hover:bg-green-600 disabled:bg-green-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium transition w-full sm:w-auto"
            >
              {isSubmitting ? 'Salvando...' : editingId ? 'Atualizar Entrega' : 'Salvar Entrega'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                disabled={isSubmitting}
                className="bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-700 px-6 py-2.5 rounded-lg font-medium transition w-full sm:w-auto"
              >
                Cancelar Edição
              </button>
            )}
          </div>
        </form>
      )}

      {/* FILTROS */}
      {!showForm && entregas.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700">🔍 Filtros</label>
            {temFiltroAtivo && (
              <button
                type="button"
                onClick={() => {
                  setFiltroProducerId('')
                  setFiltroDe('')
                  setFiltroAte('')
                }}
                className="text-sm text-green-600 hover:text-green-700 font-medium px-3 py-1 rounded-lg hover:bg-green-50 transition"
              >
                Limpar filtros
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Produtor</label>
              <select
                value={filtroProducerId}
                onChange={(e) => setFiltroProducerId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm"
              >
                <option value="">Todos</option>
                {produtoresFiltro.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">De</label>
              <input
                type="date"
                value={filtroDe}
                onChange={(e) => setFiltroDe(e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Até</label>
              <input
                type="date"
                value={filtroAte}
                onChange={(e) => setFiltroAte(e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
          </div>
          {temFiltroAtivo && (
            <p className="text-xs text-gray-500 mt-3">
              {entregasFiltradas.length} entrega{entregasFiltradas.length !== 1 ? 's' : ''} encontrada
              {entregasFiltradas.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* LISTAGEM */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
        </div>
      ) : entregasFiltradas.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-6xl mb-4">🌾</p>
          <p className="text-xl">
            {temFiltroAtivo
              ? 'Nenhuma entrega encontrada com esses filtros'
              : 'Nenhuma entrega do PAA registrada'}
          </p>
          {podeEditar && !temFiltroAtivo && (
            <p className="text-sm mt-2">Clique em &quot;+ Nova Entrega&quot; para começar</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {entregasFiltradas.map((e) => {
            const masked = e.isMasked === true
            const podeEditarEsta = canEditRecord('paa', e.dataEntrega)
            const funcionarios = [e.employee, e.employee2].filter(Boolean) as {
              id: string
              name: string
            }[]

            return (
              <div key={e.id} className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-gray-900">{e.producer.name}</h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        🌾 PAA
                      </span>
                      {e.numeroNota && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          NF {e.numeroNota}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {new Date(e.dataEntrega).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                    </p>
                    {funcionarios.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {funcionarios.map((f) => (
                          <span
                            key={f.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100"
                          >
                            👤 {f.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {(podeEditarEsta || podeExcluir) && (
                    <div className="flex items-center gap-2 shrink-0">
                      {podeEditarEsta && (
                        <button
                          onClick={() => startEdit(e)}
                          className="text-blue-500 hover:text-blue-700 text-sm font-medium px-2 py-1 rounded hover:bg-blue-50 transition"
                        >
                          Editar
                        </button>
                      )}
                      {podeExcluir && (
                        <button
                          onClick={() => handleDelete(e.id)}
                          className="text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition"
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 mb-3">
                  {e.itens.map((i) => (
                    <div
                      key={i.id}
                      className="flex items-center justify-between bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-sm gap-2"
                    >
                      <div className="min-w-0">
                        <span className="text-green-700 font-medium">{i.product.name}</span>
                        {i.tipoCultivo === 'ORGANICO' && (
                          <span className="ml-1 text-xs text-emerald-600">🍃 orgânico</span>
                        )}
                        <span className="text-gray-500 ml-1">
                          {i.quantidade} {abrevUnidade(i.product.paaUnidade)} ·{' '}
                          {i.pesoKg.toFixed(3)} kg
                        </span>
                      </div>
                      {!masked && i.subtotal !== null && (
                        <span className="text-amber-700 font-semibold shrink-0">
                          {brl(i.subtotal)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-gray-100 flex flex-wrap gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Peso Total:</span>
                    <span className="text-sm font-bold text-gray-900">
                      {e.pesoTotalKg.toFixed(3)} kg
                    </span>
                  </div>
                  {!masked && e.valorTotal !== null && (
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-xs text-gray-500">Valor Total:</span>
                      <span className="text-lg font-bold text-amber-700">{brl(e.valorTotal)}</span>
                    </div>
                  )}
                  {masked && (
                    <span className="ml-auto text-xs text-gray-400 italic">
                      🔒 valores financeiros restritos
                    </span>
                  )}
                </div>

                {e.observacoes && (
                  <p className="text-sm text-gray-400 mt-2 italic">📝 {e.observacoes}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
