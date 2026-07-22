'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

type Opcao = { id: string; nome: string }

type Registro = {
  id: string
  quantidade: number
  unidade: string
  doadorCpf: string | null
  createdAt: string
  localId: string
  alimentoId: string
  localNome: string
  alimentoNome: string
  operadorNome: string
}

type Props = {
  eventoId: string
  eventoNome: string
  locais: Opcao[]
  alimentos: Opcao[]
}

const PER_PAGE = 50

function fmtCpf(cpf: string | null) {
  if (!cpf) return '—'
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return cpf
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function RegistrosList({
  eventoId,
  eventoNome,
  locais,
  alimentos,
}: Props) {
  const [registros, setRegistros] = useState<Registro[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [carregando, setCarregando] = useState(true)

  // filtros
  const [fLocal, setFLocal] = useState('')
  const [fAlimento, setFAlimento] = useState('')
  const [fCpf, setFCpf] = useState('')

  // edição inline
  const [editId, setEditId] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState<Partial<Registro>>({})
  const [salvando, setSalvando] = useState(false)

  const totalPaginas = Math.max(1, Math.ceil(total / PER_PAGE))

  const carregar = useCallback(async () => {
    setCarregando(true)
    const qs = new URLSearchParams({
      page: String(page),
      perPage: String(PER_PAGE),
    })
    if (fLocal) qs.set('localId', fLocal)
    if (fAlimento) qs.set('alimentoId', fAlimento)
    if (fCpf.replace(/\D/g, '')) qs.set('cpf', fCpf.replace(/\D/g, ''))

    try {
      const res = await fetch(`/api/eventos/${eventoId}/recebimentos?${qs}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar')
      setRegistros(data.registros)
      setTotal(data.total)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setCarregando(false)
    }
  }, [eventoId, page, fLocal, fAlimento, fCpf])

  useEffect(() => {
    carregar()
  }, [carregar])

  // reset pra página 1 ao mudar filtro
  useEffect(() => {
    setPage(1)
  }, [fLocal, fAlimento, fCpf])

  function iniciarEdicao(r: Registro) {
    setEditId(r.id)
    setRascunho({
      localId: r.localId,
      alimentoId: r.alimentoId,
      quantidade: r.quantidade,
      doadorCpf: r.doadorCpf ?? '',
    })
  }

  function cancelarEdicao() {
    setEditId(null)
    setRascunho({})
  }

  async function salvar(id: string) {
    setSalvando(true)
    try {
      const res = await fetch(`/api/eventos/${eventoId}/recebimentos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localId: rascunho.localId,
          alimentoId: rascunho.alimentoId,
          quantidade: Number(rascunho.quantidade),
          doadorCpf: rascunho.doadorCpf || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar')
      toast.success('Registro atualizado')
      cancelarEdicao()
      carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  async function remover(id: string) {
    if (!confirm('Remover este registro? Esta ação não pode ser desfeita.')) return
    try {
      const res = await fetch(`/api/eventos/${eventoId}/recebimentos/${id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao remover')
      toast.success('Registro removido')
      carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover')
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-4">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Registros — {eventoNome}</h1>
          <p className="text-sm text-gray-500">{total} recebimento(s)</p>
        </div>
        <Link
          href={`/eventos/${eventoId}/campo`}
          className="rounded-md border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          ← Voltar ao campo
        </Link>
      </header>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={fLocal}
          onChange={(e) => setFLocal(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Todos os locais</option>
          {locais.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nome}
            </option>
          ))}
        </select>

        <select
          value={fAlimento}
          onChange={(e) => setFAlimento(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Todos os alimentos</option>
          {alimentos.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </select>

        <input
          type="text"
          inputMode="numeric"
          placeholder="Filtrar por CPF"
          value={fCpf}
          onChange={(e) => setFCpf(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        />
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Local</th>
              <th className="px-3 py-2">Alimento</th>
              <th className="px-3 py-2">Qtd</th>
              <th className="px-3 py-2">CPF</th>
              <th className="px-3 py-2">Operador</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                  Carregando…
                </td>
              </tr>
            ) : registros.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              registros.map((r) => {
                const editando = editId === r.id
                return (
                  <tr key={r.id} className="border-t">
                    <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                      {fmtData(r.createdAt)}
                    </td>

                    {/* Local */}
                    <td className="px-3 py-2">
                      {editando ? (
                        <select
                          value={rascunho.localId}
                          onChange={(e) =>
                            setRascunho((d) => ({ ...d, localId: e.target.value }))
                          }
                          className="rounded border px-2 py-1"
                        >
                          {locais.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.nome}
                            </option>
                          ))}
                        </select>
                      ) : (
                        r.localNome
                      )}
                    </td>

                    {/* Alimento */}
                    <td className="px-3 py-2">
                      {editando ? (
                        <select
                          value={rascunho.alimentoId}
                          onChange={(e) =>
                            setRascunho((d) => ({ ...d, alimentoId: e.target.value }))
                          }
                          className="rounded border px-2 py-1"
                        >
                          {alimentos.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.nome}
                            </option>
                          ))}
                        </select>
                      ) : (
                        r.alimentoNome
                      )}
                    </td>

                    {/* Quantidade */}
                    <td className="px-3 py-2">
                      {editando ? (
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={rascunho.quantidade ?? ''}
                          onChange={(e) =>
                            setRascunho((d) => ({
                              ...d,
                              quantidade: Number(e.target.value),
                            }))
                          }
                          className="w-24 rounded border px-2 py-1"
                        />
                      ) : (
                        `${r.quantidade} ${r.unidade}`
                      )}
                    </td>

                    {/* CPF */}
                    <td className="px-3 py-2">
                      {editando ? (
                        <input
                          type="text"
                          inputMode="numeric"
                          value={rascunho.doadorCpf ?? ''}
                          onChange={(e) =>
                            setRascunho((d) => ({ ...d, doadorCpf: e.target.value }))
                          }
                          placeholder="CPF (opcional)"
                          className="w-36 rounded border px-2 py-1"
                        />
                      ) : (
                        fmtCpf(r.doadorCpf)
                      )}
                    </td>

                    <td className="px-3 py-2 text-gray-500">{r.operadorNome}</td>

                    {/* Ações */}
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        {editando ? (
                          <>
                            <button
                              onClick={() => salvar(r.id)}
                              disabled={salvando}
                              className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              Salvar
                            </button>
                            <button
                              onClick={cancelarEdicao}
                              className="rounded border px-2 py-1 text-xs"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => iniciarEdicao(r)}
                              className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => remover(r.id)}
                              className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                            >
                              Remover
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-gray-500">
          Página {page} de {totalPaginas}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded border px-3 py-1 disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))}
            disabled={page >= totalPaginas}
            className="rounded border px-3 py-1 disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  )
}
