'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import type { UserRole } from '@/types/next-auth'
import ListaFolhaResumo from './ListaFolhaResumo'

const LIMITE_RENDA = 810.55

type Props = {
  eventoId: string
  eventoNome: string
  eventoStatus: string
  role: UserRole
}

/** Formata "12345678901" ou parcial → 123.456.789-01 */
function formatCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export default function FolhaResumoClient({
  eventoId,
  eventoNome,
  eventoStatus,
  role,
}: Props) {
  const router = useRouter()

  const [codigoFamiliar, setCodigoFamiliar] = useState('')
  const [cpf, setCpf] = useState('')
  const [renda, setRenda] = useState('')
  const [salvando, setSalvando] = useState(false)

  // 🆕 força reload da lista após cada registro bem-sucedido
  const [refreshKey, setRefreshKey] = useState(0)

  const rendaNum = Number(renda.replace(',', '.'))
  const rendaValida = renda !== '' && Number.isFinite(rendaNum) && rendaNum >= 0
  const acimaLimite = rendaValida && rendaNum > LIMITE_RENDA
  const cpfDigits = cpf.replace(/\D/g, '')

  const podeEnviar =
    !salvando &&
    codigoFamiliar.trim() !== '' &&
    cpfDigits.length === 11 &&
    rendaValida &&
    !acimaLimite &&
    eventoStatus === 'ATIVO'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!podeEnviar) return

    setSalvando(true)
    try {
      const res = await fetch(`/api/eventos/${eventoId}/folha-resumo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigoFamiliar: codigoFamiliar.trim(),
          cpf: cpfDigits,
          rendaPerCapita: rendaNum,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao registrar ingresso')
        return
      }

      toast.success('Ingresso social registrado!')
      setCodigoFamiliar('')
      setCpf('')
      setRenda('')
      setRefreshKey((k) => k + 1) // 🆕 recarrega a lista abaixo
      router.refresh()
    } catch {
      toast.error('Falha de conexão. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/eventos/${eventoId}`}
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          ← Voltar ao evento
        </Link>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            eventoStatus === 'ATIVO'
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {eventoStatus}
        </span>
      </div>

      <h1 className="mb-1 text-2xl font-bold text-gray-900">📋 Folha Resumo</h1>
      <p className="mb-4 text-sm text-gray-500">{eventoNome}</p>

      {/* Card de lembrete */}
      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <strong>Lembrete:</strong> o ingresso social é único por família neste
        evento. Só é elegível quem tem renda per capita de até{' '}
        <strong>R$ {LIMITE_RENDA.toFixed(2).replace('.', ',')}</strong>. Confira
        os dados antes de confirmar — não há como retirar duas vezes.
      </div>

      {eventoStatus !== 'ATIVO' && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Este evento não está ATIVO. Não é possível registrar ingressos.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Código Familiar */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Código Familiar
          </label>
          <input
            type="text"
            value={codigoFamiliar}
            onChange={(e) => setCodigoFamiliar(e.target.value)}
            placeholder="Ex.: 000123456789"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>

        {/* CPF */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            CPF de quem retirou o ingresso
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
            placeholder="000.000.000-00"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          {cpf !== '' && cpfDigits.length !== 11 && (
            <p className="mt-1 text-xs text-red-600">CPF incompleto.</p>
          )}
        </div>

        {/* Renda per capita */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Renda per capita (R$)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={renda}
            onChange={(e) => setRenda(e.target.value)}
            placeholder="Ex.: 450,00"
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
              acimaLimite
                ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-green-500 focus:ring-green-500'
            }`}
          />
          {acimaLimite && (
            <p className="mt-1 text-xs font-medium text-red-600">
              🚫 Renda acima de R$ {LIMITE_RENDA.toFixed(2).replace('.', ',')}.
              Família não elegível — envio bloqueado.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!podeEnviar}
          className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {salvando ? 'Registrando...' : 'Confirmar ingresso social'}
        </button>
      </form>

      <ListaFolhaResumo
  eventoId={eventoId}
  isDev={role === 'dev'}
  refreshKey={refreshKey}
/>
    </div>
  )
}
