'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

type Alimento = { id: string; nome: string }
type Local = { id: string; nome: string }
type ShowOption = { value: string; artista: string; data: string }

type ItemRegistro = {
  id: string
  showDia: string
  alimentoNome: string
  quantidade: number
  numeroInicio: number
  numeroFim: number
}
type Registro = {
  id: string
  doadorNome: string
  doadorCpf: string | null
  localNome: string | null
  itens: ItemRegistro[]
}

// 🎤 Line-up FIXO do evento
const SHOWS: ShowOption[] = [
  { value: 'hugo-guilherme-13', artista: 'Hugo e Guilherme', data: '13/08' },
  { value: 'ana-castela-14', artista: 'Ana Castela', data: '14/08' },
  { value: 'daniel-15', artista: 'Daniel', data: '15/08' },
  { value: 'mariana-fagundes-16', artista: 'Mariana Fagundes', data: '16/08' },
]

function labelShow(v: string): string {
  const s = SHOWS.find((x) => x.value === v)
  return s ? `${s.data} — ${s.artista}` : v
}

type ItemForm = { showDia: string; alimentoId: string; quantidade: string }

export default function Client({
  eventoId,
  eventoNome,
  subtitulo,
}: {
  eventoId: string
  eventoNome: string
  subtitulo: string
}) {
  const [alimentos, setAlimentos] = useState<Alimento[]>([])
  const [locais, setLocais] = useState<Local[]>([])
  const [registros, setRegistros] = useState<Registro[]>([])
  const [totaisPorShow, setTotaisPorShow] = useState<Record<string, number>>({})
  const [podeEditar, setPodeEditar] = useState(false)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const [doadorNome, setDoadorNome] = useState('')
  const [doadorCpf, setDoadorCpf] = useState('')
  const [localId, setLocalId] = useState('')
  const [itens, setItens] = useState<ItemForm[]>([
    { showDia: '', alimentoId: '', quantidade: '' },
  ])

  const [editandoId, setEditandoId] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/eventos/${eventoId}/arrecadacao-extra`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setAlimentos(data.alimentos ?? [])
      setLocais(data.locais ?? [])
      setRegistros(data.registros ?? [])
      setTotaisPorShow(data.totaisPorShow ?? {})
      setPodeEditar(Boolean(data.podeEditar))
    } catch {
      toast.error('Erro ao carregar dados.')
    } finally {
      setLoading(false)
    }
  }, [eventoId])

  useEffect(() => {
    carregar()
  }, [carregar])

  function atualizarItem(idx: number, campo: keyof ItemForm, valor: string) {
    setItens((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, [campo]: valor } : it)),
    )
  }

  function adicionarItem() {
    setItens((prev) => [...prev, { showDia: '', alimentoId: '', quantidade: '' }])
  }

  function removerItem(idx: number) {
    setItens((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)))
  }

  function resetForm() {
    setDoadorNome('')
    setDoadorCpf('')
    setLocalId('')
    setItens([{ showDia: '', alimentoId: '', quantidade: '' }])
    setEditandoId(null)
  }

  function iniciarEdicao(r: Registro) {
    setEditandoId(r.id)
    setDoadorNome(r.doadorNome)
    setDoadorCpf(r.doadorCpf ?? '')
    const loc = locais.find((l) => l.nome === r.localNome)
    setLocalId(loc?.id ?? '')
    setItens(
      r.itens.map((i) => {
        const al = alimentos.find((a) => a.nome === i.alimentoNome)
        return {
          showDia: i.showDia,
          alimentoId: al?.id ?? '',
          quantidade: String(i.quantidade),
        }
      }),
    )
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este registro? Esta ação não pode ser desfeita.')) return
    const res = await fetch(
      `/api/eventos/${eventoId}/arrecadacao-extra/${id}`,
      { method: 'DELETE' },
    )
    if (res.ok) {
      toast.success('Registro excluído.')
      carregar()
    } else {
      toast.error('Erro ao excluir.')
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()

    if (doadorNome.trim().length < 2) {
      toast.error('Informe o nome do doador.')
      return
    }
    const itensPayload = itens
      .filter((it) => it.showDia && it.alimentoId && it.quantidade)
      .map((it) => ({
        showDia: it.showDia,
        alimentoId: it.alimentoId,
        quantidade: parseInt(it.quantidade, 10),
      }))

    if (itensPayload.length === 0) {
      toast.error('Preencha ao menos um item completo (show + alimento + quantidade).')
      return
    }
    if (itensPayload.some((it) => !Number.isInteger(it.quantidade) || it.quantidade < 1)) {
      toast.error('Quantidade inválida.')
      return
    }

    setSalvando(true)
    try {
      const payload = {
        doadorNome: doadorNome.trim(),
        doadorCpf: doadorCpf.trim() || null,
        localId: localId || null,
        itens: itensPayload,
      }

      const url = editandoId
        ? `/api/eventos/${eventoId}/arrecadacao-extra/${editandoId}`
        : `/api/eventos/${eventoId}/arrecadacao-extra`

      const res = await fetch(url, {
        method: editandoId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Erro ao salvar.')
      }

      toast.success(editandoId ? 'Registro atualizado!' : 'Registro salvo!')
      resetForm()
      carregar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  const totalGeral = Object.values(totaisPorShow).reduce((a, b) => a + b, 0)

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* topo */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link
            href={`/eventos/${eventoId}`}
            className="text-sm text-emerald-600 hover:underline"
          >
            ← Voltar ao evento
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{eventoNome}</h1>
          <p className="text-sm text-gray-500">{subtitulo}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 px-4 py-2 text-center">
          <div className="text-2xl font-bold text-emerald-700">{totalGeral}</div>
          <div className="text-xs text-emerald-600">cupons</div>
        </div>
      </div>

      {/* contadores por show */}
      {Object.keys(totaisPorShow).length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {SHOWS.map((s) => {
            const total = totaisPorShow[s.value] ?? 0
            return (
              <div
                key={s.value}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <span className="font-semibold text-gray-800">{s.artista}</span>
                <span className="text-gray-400"> · {s.data}</span>
                <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">
                  {total}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* formulário */}
      <form
        onSubmit={enviar}
        className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        {editandoId && (
          <div className="mb-4 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <span>✏️ Editando registro</span>
            <button type="button" onClick={resetForm} className="font-medium underline">
              Cancelar
            </button>
          </div>
        )}

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Nome do doador <span className="text-red-500">*</span>
          </label>
          <input
            value={doadorNome}
            onChange={(e) => setDoadorNome(e.target.value)}
            placeholder="Nome completo"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            CPF <span className="text-gray-400">(opcional)</span>
          </label>
          <input
            value={doadorCpf}
            onChange={(e) => setDoadorCpf(e.target.value)}
            placeholder="000.000.000-00"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
          />
        </div>

        <div className="mb-6">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Local da doação <span className="text-red-500">*</span>
          </label>
          <select
            value={localId}
            onChange={(e) => setLocalId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
          >
            <option value="">Selecione...</option>
            {locais.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
        </div>

        {/* caixa de itens (show + alimento + qtd) */}
        <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">🎤 Shows &amp; alimentos</h3>
            <button
              type="button"
              onClick={adicionarItem}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              + Adicionar
            </button>
          </div>

          <div className="space-y-3">
            {itens.map((it, idx) => (
              <div key={idx} className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Item {idx + 1}</span>
                  {itens.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removerItem(idx)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remover
                    </button>
                  )}
                </div>

                <div className="mb-2">
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Show <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={it.showDia}
                    onChange={(e) => atualizarItem(idx, 'showDia', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  >
                    <option value="">Selecione o show...</option>
                    {SHOWS.map((s) => (
                      <option key={s.value} value={s.value}>
                        🎤 {s.data} • {s.artista}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Alimento <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={it.alimentoId}
                      onChange={(e) => atualizarItem(idx, 'alimentoId', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="">Selecione...</option>
                      {alimentos.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Quantidade <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={it.quantidade}
                      onChange={(e) => atualizarItem(idx, 'quantidade', e.target.value)}
                      placeholder="Cada unidade = 1 cupom"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={salvando}
          className="w-full rounded-lg bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Registrar doação'}
        </button>
      </form>

      {/* lista de registros */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-bold text-gray-900">
          Registros ({registros.length})
        </h2>

        {loading ? (
          <p className="text-sm text-gray-500">Carregando...</p>
        ) : registros.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum registro ainda.</p>
        ) : (
          <div className="space-y-4">
            {registros.map((r) => (
              <div key={r.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-start justify-between border-b border-gray-100 pb-3">
                  <div>
                    <div className="text-base font-bold text-gray-900">{r.doadorNome}</div>
                    <div className="text-xs text-gray-500">
                      CPF: {r.doadorCpf ?? '—'}
                      {r.localNome && (
                        <>
                          {' '}· Local:{' '}
                          <span className="font-medium text-gray-700">{r.localNome}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {podeEditar && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => iniciarEdicao(r)}
                        className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => excluir(r.id)}
                        className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {r.itens.map((i) => (
                    <div
                      key={i.id}
                      className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="font-semibold text-emerald-700">{labelShow(i.showDia)}</span>
                        <span className="text-gray-400"> · {i.alimentoNome}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-mono text-xs font-bold text-emerald-700">
                          {i.numeroInicio}–{i.numeroFim}
                        </span>
                        <span className="text-xs text-gray-500">
                          {i.quantidade} cupom{i.quantidade > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
