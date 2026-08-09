'use client'

import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'

interface Registro {
  id: string
  codigoFamiliar: string
  cpf: string
  rendaPerCapita: number
  show: string | null
  createdAt: string
}

type Props = {
  eventoId: string
  isDev?: boolean
  refreshKey?: number
}

/** Formata CPF cru para exibição (dev recebe 11 dígitos sem pontuação) */
function exibirCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return cpf // já mascarado
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export default function ListaFolhaResumo({
  eventoId,
  isDev = false,
  refreshKey = 0,
}: Props) {
  const [registros, setRegistros] = useState<Registro[]>([])
  const [totalGeral, setTotalGeral] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [semAcesso, setSemAcesso] = useState(false)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [exportando, setExportando] = useState<'xlsx' | 'csv' | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 🆕 ONDA 21.5 — dev pede a lista completa (?all=1).
      // O servidor valida o role: para os demais o param é ignorado.
      const qs = isDev ? '?all=1' : ''
      const res = await fetch(`/api/eventos/${eventoId}/folha-resumo${qs}`)

      if (res.status === 403) {
        setSemAcesso(true)
        setRegistros([])
        return
      }

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao carregar')

      setSemAcesso(false)
      setRegistros(data.registros ?? [])
      setTotalGeral(data.totalGeral ?? (data.registros?.length ?? 0))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [eventoId, isDev])

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

  // 🆕 ONDA 21.5 — export DEV-only. Gate real está no servidor.
  const exportar = (formato: 'xlsx' | 'csv') => {
    setExportando(formato)
    const url = `/api/eventos/${eventoId}/folha-resumo/export?format=${formato}`
    const a = document.createElement('a')
    a.href = url
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => setExportando(null), 1500)
  }

  if (semAcesso) return null

  return (
    <div className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-700">
          📋 {isDev ? 'Todos os registros' : 'Últimos registros'}
          {totalGeral > 0 && (
            <span className="ml-1.5 font-normal text-gray-400">
              ({totalGeral})
            </span>
          )}
        </h3>

        <div className="flex items-center gap-2">
          {/* ⬇️ Exportar — só DEV */}
          {isDev && (
            <>
              <button
                onClick={() => exportar('xlsx')}
                disabled={exportando !== null || registros.length === 0}
                title="Exportar planilha com CPF completo (uso restrito)"
                className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 transition hover:bg-teal-100 disabled:opacity-40 active:scale-95"
              >
                {exportando === 'xlsx' ? '⏳…' : '⬇️ Excel'}
              </button>
              <button
                onClick={() => exportar('csv')}
                disabled={exportando !== null || registros.length === 0}
                title="Exportar CSV com CPF completo (uso restrito)"
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-40 active:scale-95"
              >
                {exportando === 'csv' ? '⏳…' : '⬇️ CSV'}
              </button>
            </>
          )}

          <button
            onClick={load}
            disabled={loading}
            className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            {loading ? 'Atualizando…' : '🔄 Atualizar'}
          </button>
        </div>
      </div>

      {/* ⚠️ Aviso LGPD para o dev */}
      {isDev && registros.length > 0 && (
        <p className="mb-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          ⚠️ Você está vendo dados <b>não mascarados</b>. A exportação contém CPF
          completo — trate a planilha como documento sigiloso (LGPD).
        </p>
      )}

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
        <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
          {registros.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">
                  🏷️ {r.codigoFamiliar}
                </p>
                {r.show && (
                  <p className="truncate text-xs font-medium text-emerald-700">
                    🎤 {r.show}
                  </p>
                )}
                <p className="text-xs tabular-nums text-gray-500">
                  CPF {exibirCpf(r.cpf)} ·{' '}
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
