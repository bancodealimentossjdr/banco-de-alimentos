'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'
import AssinaturaCanvas, {
  type AssinaturaCanvasRef,
} from '@/components/AssinaturaCanvas'

interface DistributionItem {
  id: string
  quantity: number
  boxes: number | null
  product: { name: string; unit: string }
}

interface Distribution {
  id: string
  date: string
  status: string
  legacy: boolean
  notes: string | null
  beneficiary: { id: string; name: string } | null
  items: DistributionItem[]
}

export default function FinalizarDistribuicaoPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const sigRef = useRef<AssinaturaCanvasRef>(null)

  const [distribution, setDistribution] = useState<Distribution | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form
  const [recipientName, setRecipientName] = useState('')
  const [notes, setNotes] = useState('')
  const [signatureEmpty, setSignatureEmpty] = useState(true)

  // 🔄 Busca os dados da distribuição
  useEffect(() => {
    if (!id) return
    let active = true

    async function load() {
      try {
        const res = await fetch(`/api/distribuicoes/${id}`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Distribuição não encontrada')
        }
        const data: Distribution = await res.json()
        if (!active) return

        // 🛡️ Guardas de coerência
        if (data.legacy) {
          setLoadError('Distribuições legadas já estão concluídas.')
        } else if (data.status === 'ENTREGUE') {
          setLoadError('Esta distribuição já foi finalizada.')
        }

        setDistribution(data)
      } catch (err) {
        if (active) {
          setLoadError(
            err instanceof Error ? err.message : 'Erro ao carregar distribuição',
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [id])

  function formatDate(date: string) {
    const raw = date.includes('T') ? date.split('T')[0] : date
    const [year, month, day] = raw.split('-')
    return `${day}/${month}/${year}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validações no cliente (a API revalida tudo)
    const nome = recipientName.trim()
    if (nome.length < 2) {
      toast.error('Informe o nome de quem recebeu (mínimo 2 caracteres).')
      return
    }

    const signatureData = sigRef.current?.toDataURL() ?? null
    if (!signatureData) {
      toast.error('A assinatura é obrigatória.')
      return
    }

    setSubmitting(true)
    const loadingToast = toast.loading('Finalizando distribuição...')

    try {
      const res = await fetch(`/api/distribuicoes/${id}/finalizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName: nome,
          signatureData,
          notes: notes.trim() || null,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao finalizar distribuição')
      }

      toast.success('Distribuição finalizada com sucesso!', { id: loadingToast })
      router.push('/distribuicoes')
      router.refresh()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Erro ao finalizar distribuição',
        { id: loadingToast },
      )
      setSubmitting(false)
    }
  }

  // ⏳ Loading
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-green-600" />
      </div>
    )
  }

  // ❌ Erro de carregamento / estado inválido
  if (loadError || !distribution) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4 text-center">
        <p className="text-5xl">⚠️</p>
        <p className="text-lg font-medium text-gray-700">
          {loadError || 'Distribuição não encontrada'}
        </p>
        <Link
          href="/distribuicoes"
          className="rounded-lg bg-green-600 px-5 py-2.5 font-medium text-white transition hover:bg-green-700"
        >
          ← Voltar às distribuições
        </Link>
      </div>
    )
  }

  const totalBoxes = distribution.items.reduce((sum, i) => sum + (i.boxes || 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 🟢 Header verde com logo Annonae */}
      <header className="bg-green-600 shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link
            href="/distribuicoes"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition hover:bg-green-700"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Voltar
          </Link>

          <Image
            src="/logos/annonae-color.png"
            alt="Annonae"
            width={120}
            height={36}
            priority
            className="h-9 w-auto object-contain"
          />
        </div>
      </header>

      {/* Conteúdo */}
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-1 text-xl font-bold text-gray-900 md:text-2xl">
          ✍️ Finalizar Distribuição
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          Confirme o recebimento coletando a assinatura de quem recebeu a doação.
        </p>

        {/* 📋 Resumo da entrega */}
        <div className="mb-6 rounded-xl border bg-white p-4 shadow-sm md:p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="font-bold text-gray-900">
              {distribution.beneficiary?.name ?? 'Instituição'}
            </h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              ⏳ Pendente
            </span>
            {totalBoxes > 0 && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                📦 {totalBoxes} cx
              </span>
            )}
          </div>

          <p className="mb-3 text-sm text-gray-500">
            📅 {formatDate(distribution.date)} ·{' '}
            {distribution.items.length}{' '}
            {distribution.items.length === 1 ? 'item' : 'itens'}
          </p>

          <div className="flex flex-wrap gap-2">
            {distribution.items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-green-100 bg-green-50 px-3 py-1.5 text-sm"
              >
                <span className="font-medium text-green-700">
                  {item.product.name}
                </span>
                <span className="mx-1 text-gray-400">•</span>
                <span className="text-gray-700">
                  {item.quantity} {item.product.unit}
                </span>
                {item.boxes ? (
                  <>
                    <span className="mx-1 text-gray-400">•</span>
                    <span className="font-medium text-blue-600">
                      {item.boxes}cx
                    </span>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {/* 📝 Formulário de finalização */}
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border bg-white p-4 shadow-sm md:p-6"
        >
          {/* Nome do recebedor (obrigatório pela API) */}
          <div className="mb-5">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nome de quem recebeu *
            </label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Nome completo do recebedor"
              maxLength={200}
              required
              className="w-full rounded-lg border px-3 py-2.5 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Canvas de assinatura */}
          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Assinatura *
            </label>
            <AssinaturaCanvas
              ref={sigRef}
              onChange={(empty) => setSignatureEmpty(empty)}
            />
          </div>

          {/* Observações */}
          <div className="mb-6">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Observações <span className="text-xs text-gray-400">(opcional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Alguma observação sobre a entrega..."
              className="w-full rounded-lg border px-3 py-2.5 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Ações */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/distribuicoes"
              className="rounded-lg bg-gray-200 px-6 py-2.5 text-center font-medium text-gray-700 transition hover:bg-gray-300"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={submitting || signatureEmpty || recipientName.trim().length < 2}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
            >
              {submitting ? (
                'Finalizando...'
              ) : (
                <>
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Finalizar Distribuição
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
