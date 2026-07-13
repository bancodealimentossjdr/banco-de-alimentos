// src/app/eventos/[id]/arrecadacao-extra/Client.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

type Alimento = { id: string; nome: string }
type Local = { id: string; nome: string }

type Registro = {
  id: string
  doadorNome: string
  quantidade: number
  numeroInicio: number
  numeroFim: number
  alimentoNome: string
  localNome: string
}

export default function ArrecadacaoExtraClient({
  eventoId,
  eventoNome,
  eventoAtivo,
  alimentos,
  locais,
  registrosIniciais,
  totalInicial,
}: {
  eventoId: string
  eventoNome: string
  eventoAtivo: boolean
  alimentos: Alimento[]
  locais: Local[]
  registrosIniciais: Registro[]
  totalInicial: number
}) {
  const [doadorNome, setDoadorNome] = useState('')
  const [doadorCpf, setDoadorCpf] = useState('')
  const [alimentoId, setAlimentoId] = useState('')
  const [localId, setLocalId] = useState('')
  const [quantidade, setQuantidade] = useState<number | ''>('')
  const [enviando, setEnviando] = useState(false)

  const [registros, setRegistros] = useState<Registro[]>(registrosIniciais)
  const [totalCupons, setTotalCupons] = useState(totalInicial)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (enviando) return

    if (doadorNome.trim().length < 2) {
      toast.error('Informe o nome do doador.')
      return
    }
    if (!localId) {
      toast.error('Selecione o local da doação.')
      return
    }
    if (!alimentoId) {
      toast.error('Selecione o alimento.')
      return
    }
    if (typeof quantidade !== 'number' || quantidade < 1) {
      toast.error('Quantidade deve ser ao menos 1.')
      return
    }

    setEnviando(true)
    const t = toast.loading('Registrando...')

    try {
      const res = await fetch(`/api/eventos/${eventoId}/arrecadacao-extra`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doadorNome: doadorNome.trim(),
          doadorCpf: doadorCpf.trim() || null,
          alimentoId,
          localId,
          quantidade,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data?.error ?? 'Erro ao registrar.', { id: t })
        return
      }

      toast.success(`Registrado! Cupons ${data.cupons}`, { id: t })

      const alimentoNome =
        alimentos.find((a) => a.id === alimentoId)?.nome ?? '—'
      const localNome = locais.find((l) => l.id === localId)?.nome ?? '—'

      setRegistros((prev) => [
        {
          id: data.registro.id,
          doadorNome: data.registro.doadorNome,
          quantidade: data.registro.quantidade,
          numeroInicio: data.registro.numeroInicio,
          numeroFim: data.registro.numeroFim,
          alimentoNome,
          localNome,
        },
        ...prev,
      ])
      setTotalCupons((prev) => prev + data.registro.quantidade)

      setDoadorNome('')
      setDoadorCpf('')
      setQuantidade('')
    } catch {
      toast.error('Falha de rede. Tente novamente.', { id: t })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      {/* Cabeçalho */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <Link
            href={`/eventos/${eventoId}`}
            className="text-sm text-emerald-700 hover:underline"
          >
            ← Voltar ao evento
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            Conheça seu Ídolo
          </h1>
          <p className="text-sm text-gray-500">{eventoNome}</p>
        </div>
        <div className="rounded-lg bg-emerald-50 px-4 py-2 text-center">
          <div className="text-2xl font-bold text-emerald-700">
            {totalCupons}
          </div>
          <div className="text-xs text-emerald-600">cupons</div>
        </div>
      </div>

      {!eventoAtivo && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          ⚠️ Este evento não está ativo — não é possível registrar.
        </div>
      )}

      {/* Formulário */}
      <form
        onSubmit={handleSubmit}
        className="mb-8 space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Nome do doador <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={doadorNome}
            onChange={(e) => setDoadorNome(e.target.value)}
            disabled={!eventoAtivo || enviando}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-100"
            placeholder="Nome completo"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            CPF <span className="text-gray-400">(opcional)</span>
          </label>
          <input
            type="text"
            value={doadorCpf}
            onChange={(e) => setDoadorCpf(e.target.value)}
            disabled={!eventoAtivo || enviando}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-100"
            placeholder="000.000.000-00"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Local da doação <span className="text-red-500">*</span>
          </label>
          <select
            value={localId}
            onChange={(e) => setLocalId(e.target.value)}
            disabled={!eventoAtivo || enviando}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-100"
          >
            <option value="">Selecione…</option>
            {locais.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Alimento <span className="text-red-500">*</span>
            </label>
            <select
              value={alimentoId}
              onChange={(e) => setAlimentoId(e.target.value)}
              disabled={!eventoAtivo || enviando}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-100"
            >
              <option value="">Selecione…</option>
              {alimentos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Quantidade <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={quantidade}
              onChange={(e) =>
                setQuantidade(e.target.value === '' ? '' : Number(e.target.value))
              }
              disabled={!eventoAtivo || enviando}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-100"
              placeholder="Cada unidade = 1 cupom"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!eventoAtivo || enviando}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando ? 'Registrando…' : 'Conheça seu Ídolo'}
        </button>
      </form>

      {/* Lista */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          Registros ({registros.length})
        </h2>

        {registros.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
            Nenhum registro ainda.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2">Cupons</th>
                  <th className="px-4 py-2">Doador</th>
                  <th className="px-4 py-2">Local</th>
                  <th className="px-4 py-2">Alimento</th>
                  <th className="px-4 py-2 text-right">Qtd</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {registros.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono font-medium text-emerald-700">
                      {r.numeroInicio}–{r.numeroFim}
                    </td>
                    <td className="px-4 py-2 text-gray-900">{r.doadorNome}</td>
                    <td className="px-4 py-2 text-gray-600">{r.localNome}</td>
                    <td className="px-4 py-2 text-gray-600">{r.alimentoNome}</td>
                    <td className="px-4 py-2 text-right font-medium">
                      {r.quantidade}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
