'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface Produto {
  id: string
  name: string
  unit: string
}

interface LocalDraft {
  key: string
  nome: string
  endereco: string
}

export default function NovoEventoForm({ produtos }: { produtos: Produto[] }) {
  const router = useRouter()

  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [integraEstoque, setIntegraEstoque] = useState(true)

  const [locais, setLocais] = useState<LocalDraft[]>([
    { key: crypto.randomUUID(), nome: '', endereco: '' },
  ])

  const [alimentosSel, setAlimentosSel] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)

  // ─── Locais ───
  const addLocal = () =>
    setLocais((prev) => [...prev, { key: crypto.randomUUID(), nome: '', endereco: '' }])

  const removeLocal = (key: string) =>
    setLocais((prev) => prev.filter((l) => l.key !== key))

  const updateLocal = (key: string, campo: 'nome' | 'endereco', valor: string) =>
    setLocais((prev) =>
      prev.map((l) => (l.key === key ? { ...l, [campo]: valor } : l)),
    )

  // ─── Alimentos (toggle chip) ───
  const toggleAlimento = (id: string) =>
    setAlimentosSel((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    )

  // ─── Submit ───
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validações espelhadas na API (feedback rápido no client)
    if (!nome.trim()) {
      toast.error('Informe o nome do evento')
      return
    }
    if (!dataInicio) {
      toast.error('Informe a data de início')
      return
    }
    if (dataFim && dataFim < dataInicio) {
      toast.error('A data de término não pode ser anterior à de início')
      return
    }
    if (alimentosSel.length === 0) {
      toast.error('Selecione ao menos um alimento')
      return
    }

    const locaisValidos = locais
      .filter((l) => l.nome.trim())
      .map((l) => ({ nome: l.nome.trim(), endereco: l.endereco.trim() || null }))

    const nomesLower = locaisValidos.map((l) => l.nome.toLowerCase())
    if (new Set(nomesLower).size !== nomesLower.length) {
      toast.error('Há locais com nomes repetidos')
      return
    }

    setSalvando(true)
    try {
      const res = await fetch('/api/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          descricao: descricao.trim() || null,
          dataInicio,
          dataFim: dataFim || null,
          integraEstoque,
          locais: locaisValidos,
          alimentos: alimentosSel.map((productId) => ({ productId })),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Erro ao criar evento')
      }

      const evento = await res.json()
      toast.success('Evento criado como rascunho')
      router.push(`/eventos/${evento.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar evento')
      setSalvando(false)
    }
  }

  const inputCls =
    'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400'

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      {/* Cabeçalho */}
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">📅 Novo evento</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          O evento nasce como <b>rascunho</b>. Ative-o depois na página de detalhes.
        </p>
      </div>

      {/* ── Dados básicos ── */}
      <div className="bg-white rounded-xl shadow-sm border p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nome do evento <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Campanha do Agasalho 2026"
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={3}
            placeholder="Opcional"
            className={`${inputCls} resize-y`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data de início <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data de término
            </label>
            <input
              type="date"
              value={dataFim}
              min={dataInicio || undefined}
              onChange={(e) => setDataFim(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={integraEstoque}
            onChange={(e) => setIntegraEstoque(e.target.checked)}
            className="w-4 h-4 accent-green-600"
          />
          📦 Integrar doações deste evento ao estoque geral
        </label>
      </div>

      {/* ── Locais ── */}
      <div className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-900">🏠 Locais de coleta</p>
          <button
            type="button"
            onClick={addLocal}
            className="text-sm font-medium text-green-600 hover:text-green-700"
          >
            + Adicionar local
          </button>
        </div>

        {locais.map((l) => (
          <div key={l.key} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={l.nome}
              onChange={(e) => updateLocal(l.key, 'nome', e.target.value)}
              placeholder="Nome do local"
              className={`${inputCls} sm:flex-1`}
            />
            <input
              type="text"
              value={l.endereco}
              onChange={(e) => updateLocal(l.key, 'endereco', e.target.value)}
              placeholder="Endereço (opcional)"
              className={`${inputCls} sm:flex-1`}
            />
            {locais.length > 1 && (
              <button
                type="button"
                onClick={() => removeLocal(l.key)}
                title="Remover local"
                className="shrink-0 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
              >
                🗑️
              </button>
            )}
          </div>
        ))}
        <p className="text-xs text-gray-400">
          Locais sem nome são ignorados. Os nomes não podem se repetir.
        </p>
      </div>

      {/* ── Alimentos ── */}
      <div className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-900">
            🥫 Alimentos <span className="text-red-500">*</span>
          </p>
          <span className="text-xs text-gray-500">
            {alimentosSel.length} selecionado(s)
          </span>
        </div>

        {produtos.length === 0 ? (
          <p className="text-sm text-gray-400">
            Nenhum produto ativo no catálogo. Cadastre em{' '}
            <Link href="/produtos" className="text-green-600 underline">
              Produtos
            </Link>
            .
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {produtos.map((p) => {
              const sel = alimentosSel.includes(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleAlimento(p.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                    sel
                      ? 'bg-green-500 text-white border-green-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {sel ? '✓ ' : ''}
                  {p.name}{' '}
                  <span className={sel ? 'text-green-100' : 'text-gray-400'}>
                    ({p.unit})
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Ações ── */}
      <div className="flex items-center justify-end gap-2">
        <Link
          href="/eventos"
          className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={salvando}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold px-5 py-2 rounded-lg shadow-sm transition active:scale-95"
        >
          {salvando ? 'Criando…' : '✅ Criar evento'}
        </button>
      </div>
    </form>
  )
}
