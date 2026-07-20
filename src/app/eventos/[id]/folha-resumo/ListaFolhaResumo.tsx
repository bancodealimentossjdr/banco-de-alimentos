'use client'

import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'

interface Registro {
  id: string
  codigoFamiliar: string
  cpf: string
  rendaPerCapita: number
  createdAt: string
}

type Props = {
  eventoId: string
  isDev?: boolean
  refreshKey?: number
}

export default function ListaFolhaResumo({
  eventoId,
  isDev = false,
  refreshKey = 0,
}: Props) {
  const [registros, setRegistros] = useState<Registro[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [semAcesso, setSemAcesso] = useState(false)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/eventos/${eventoId}/folha-resumo`)

      if (res.status === 403) {
        setSemAcesso(true)
        setRegistros([])
        return
      }

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao carregar')

      setSemAcesso(false)
      setRegistros(data.registros ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [eventoId])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const excluir = async (id: string, codigo: string) => {
    if (!confirm(`Excluir o registro "${codigo}"? Esta ação não pode ser desfeita.`))
      return
    setExcluindoId(id)
    try {
      const res = await fetch(`/api/eventos/${eventoId}/folha-resumo`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registroId: id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Erro ao excluir')
      toast.success('Registro excluído')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir')
    } finally {
      setExcluindoId(null)
    }
  }

  if (semAcesso) return null

  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          📋 Últimos registros
        </h3>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
        >
          {loading ? 'Atualizando…' : '🔄 Atualizar'}
        </button>
      </div>

      {error && (
        <div className="rounded bg-red-50 p-2 text-sm text-red-600">{error}</div>
      )}

      {!error && loading && registros.length === 0 && (
        <div className="py-4 text-sm text-gray-400">Carregando…</div>
      )}

      {!error && !loading && registros.length === 0 && (
        <div className="py-4 text-sm text-gray-400">Nenhum registro ainda.</div>
      )}

      {registros.length > 0 && (
        <div className="space-y-2">
          {registros.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">
                  🏷️ {r.codigoFamiliar}
                </p>
                <p className="text-xs tabular-nums text-gray-500">
                  CPF {r.cpf} ·{' '}
                  {new Date(r.createdAt).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-semibold tabular-nums text-green-700">
                  {r.rendaPerCapita.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </span>
                {isDev && (
                  <button
                    onClick={() => excluir(r.id, r.codigoFamiliar)}
                    disabled={excluindoId === r.id}
                    className="rounded-lg border border-red-100 bg-red-50 px-2 py-1 text-sm text-red-600 transition hover:bg-red-100 disabled:opacity-40 active:scale-95"
                  >
                    {excluindoId === r.id ? '…' : '🗑️'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
