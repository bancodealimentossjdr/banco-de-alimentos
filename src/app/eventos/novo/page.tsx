'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useFormSubmit } from '@/hooks/useFormSubmit'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'

interface Product {
  id: string
  name: string
  unit: string
}

interface LocalForm {
  nome: string
  endereco: string
}

export default function NovoEventoPage() {
  const router = useRouter()
  const { isSubmitting, handleSubmit: runSubmit } = useFormSubmit()

  const [produtos, setProdutos] = useState<Product[]>([])
  const [loadingProdutos, setLoadingProdutos] = useState(true)

  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    dataInicio: '',
    dataFim: '',
    integraEstoque: true,
  })

  const [locais, setLocais] = useState<LocalForm[]>([])
  const [selectedProdutos, setSelectedProdutos] = useState<string[]>([])

  useEffect(() => {
    const fetchProdutos = async () => {
      try {
        const res = await fetch('/api/produtos')
        const data = await res.json()
        const list: Product[] = Array.isArray(data) ? data : []
        // só ativos, se vier o campo
        setProdutos(
          list.filter((p: any) => p.active === undefined || p.active === true)
        )
      } catch (err) {
        console.error('Erro ao buscar produtos:', err)
        setProdutos([])
      } finally {
        setLoadingProdutos(false)
      }
    }
    fetchProdutos()
  }, [])

  const addLocal = () => setLocais((prev) => [...prev, { nome: '', endereco: '' }])
  const removeLocal = (i: number) =>
    setLocais((prev) => prev.filter((_, idx) => idx !== i))
  const updateLocal = (i: number, field: keyof LocalForm, value: string) =>
    setLocais((prev) =>
      prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l))
    )

  const toggleProduto = (id: string) =>
    setSelectedProdutos((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // validações espelhadas do servidor
    if (!form.nome.trim()) {
      toast.error('Nome do evento é obrigatório')
      return
    }
    if (!form.dataInicio) {
      toast.error('Data de início é obrigatória')
      return
    }
    if (form.dataFim && new Date(form.dataFim) < new Date(form.dataInicio)) {
      toast.error('A data de término não pode ser anterior à de início')
      return
    }
    if (selectedProdutos.length === 0) {
      toast.error('Adicione pelo menos um alimento ao evento')
      return
    }

    runSubmit(async () => {
      const payload = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        dataInicio: new Date(form.dataInicio).toISOString(),
        dataFim: form.dataFim ? new Date(form.dataFim).toISOString() : null,
        integraEstoque: form.integraEstoque,
        locais: locais
          .filter((l) => l.nome.trim())
          .map((l) => ({ nome: l.nome.trim(), endereco: l.endereco.trim() || null })),
        alimentos: selectedProdutos.map((productId) => ({ productId })),
      }

      const res = await fetch('/api/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? 'Erro ao criar evento')
        return
      }

      const evento = await res.json()
      toast.success('Evento criado com sucesso!')
      router.push(`/eventos/${evento.id}`)
    })
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <Link
        href="/eventos"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft size={16} /> Voltar
      </Link>

      <h1 className="text-2xl font-bold text-gray-800 mb-6">Novo Evento</h1>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Dados básicos */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome *
            </label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              placeholder="Ex.: Colheita Solidária — Junho"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrição
            </label>
            <textarea
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data de início *
              </label>
              <input
                type="datetime-local"
                value={form.dataInicio}
                onChange={(e) => setForm({ ...form, dataInicio: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data de término
              </label>
              <input
                type="datetime-local"
                value={form.dataFim}
                onChange={(e) => setForm({ ...form, dataFim: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.integraEstoque}
              onChange={(e) =>
                setForm({ ...form, integraEstoque: e.target.checked })
              }
              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            Integrar recebimentos ao estoque
          </label>
        </div>

        {/* Locais (opcional) */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">Locais de coleta</h2>
            <button
              type="button"
              onClick={addLocal}
              className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
            >
              <Plus size={16} /> Adicionar
            </button>
          </div>

          {locais.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum local adicionado (opcional).</p>
          ) : (
            <div className="space-y-3">
              {locais.map((l, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 grid sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Nome do local"
                      value={l.nome}
                      onChange={(e) => updateLocal(i, 'nome', e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Endereço"
                      value={l.endereco}
                      onChange={(e) => updateLocal(i, 'endereco', e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLocal(i)}
                    className="text-red-500 hover:text-red-700 p-2"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alimentos (obrigatório ≥1) */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h2 className="font-semibold text-gray-800 mb-1">Alimentos *</h2>
          <p className="text-sm text-gray-500 mb-3">
            Selecione ao menos um alimento do catálogo.
          </p>

          {loadingProdutos ? (
            <p className="text-sm text-gray-400">Carregando produtos…</p>
          ) : produtos.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum produto disponível.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
              {produtos.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedProdutos.includes(p.id)}
                    onChange={() => toggleProduto(p.id)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span>
                    {p.name}{' '}
                    <span className="text-gray-400">({p.unit})</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Link
            href="/eventos"
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {isSubmitting ? 'Criando…' : 'Criar Evento'}
          </button>
        </div>
      </form>
    </div>
  )
}
