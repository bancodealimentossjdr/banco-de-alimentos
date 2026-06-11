// src/app/distribuicoes/[id]/comprovante/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { gerarComprovantePDF } from '@/lib/comprovante-pdf'

interface ReceiptItem {
  id: string
  quantity: number
  boxes: number | null
  product: { name: string; unit: string }
}

interface ComprovanteData {
  distribution: {
    id: string
    date: string
    status: string
    notes: string | null
    beneficiary: { id: string; name: string; address: string | null } | null
    items: ReceiptItem[]
  }
  receipt: {
    id: string
    recipientName: string
    signatureData: string
    notes: string | null
    finalizedAt: string
    finalizedBy: { id: string; name: string | null; email: string | null } | null
  }
}

export default function ComprovantePage() {
  const params = useParams()
  const id = params?.id as string

  const [data, setData] = useState<ComprovanteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!id) return
    let active = true

    async function load() {
      try {
        const res = await fetch(`/api/distribuicoes/${id}/comprovante`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || 'Erro ao carregar comprovante')
        }
        const body: ComprovanteData = await res.json()
        if (active) setData(body)
      } catch (err) {
        if (active) {
          setLoadError(
            err instanceof Error ? err.message : 'Erro ao carregar comprovante',
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

  function formatDateTime(date: string) {
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function handleDownload() {
    if (!data) return
    setGenerating(true)
    try {
      gerarComprovantePDF(data)
      toast.success('PDF gerado com sucesso!')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao gerar PDF.')
    } finally {
      setGenerating(false)
    }
  }

  // ⏳ Loading
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#0e6b39]" />
      </div>
    )
  }

  // ❌ Erro / sem acesso
  if (loadError || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4 text-center">
        <p className="text-5xl">⚠️</p>
        <p className="text-lg font-medium text-gray-700">
          {loadError || 'Comprovante não encontrado'}
        </p>
        <Link
          href="/distribuicoes"
          className="rounded-lg bg-[#0e6b39] px-5 py-2.5 font-medium text-white transition hover:bg-[#0b582f]"
        >
          ← Voltar às distribuições
        </Link>
      </div>
    )
  }

  const { distribution, receipt } = data
  const totalBoxes = distribution.items.reduce(
    (sum, i) => sum + (i.boxes || 0),
    0,
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 🟢 Header */}
      <header className="bg-[#0e6b39] shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link
            href="/distribuicoes"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#0b582f]"
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
            height={40}
            priority
            className="h-10 w-auto object-contain"
          />
        </div>
      </header>

      {/* 📄 Conteúdo */}
      <main className="mx-auto max-w-3xl px-4 py-6">
        {/* Botão de download */}
        <div className="mb-4 flex justify-end">
          <button
            onClick={handleDownload}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0e6b39] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0b582f] disabled:opacity-60"
          >
            {generating ? 'Gerando…' : '⬇️ Baixar PDF'}
          </button>
        </div>

        {/* Cartão do comprovante */}
        <div className="rounded-xl border bg-white p-4 shadow-sm md:p-6">
          {/* Instituição */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="font-bold text-gray-900">
              {distribution.beneficiary?.name ?? 'Instituição'}
            </h2>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              ✅ Entregue
            </span>
            {totalBoxes > 0 && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                📦 {totalBoxes} cx
              </span>
            )}
          </div>

          {distribution.beneficiary?.address && (
            <p className="mb-1 text-sm text-gray-500">
              📍 {distribution.beneficiary.address}
            </p>
          )}
          <p className="mb-4 text-sm text-gray-500">
            📅 {formatDate(distribution.date)}
          </p>

          {/* Itens */}
          <h3 className="mb-2 text-sm font-semibold text-gray-700">
            Itens entregues
          </h3>
          <div className="mb-6 flex flex-wrap gap-2">
            {distribution.items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-green-100 bg-green-50 px-3 py-1.5 text-sm"
              >
                <span className="font-medium text-[#0e6b39]">
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

          {/* Assinatura */}
          <h3 className="mb-2 text-sm font-semibold text-gray-700">
            Confirmação de recebimento
          </h3>
          <div className="mb-3 inline-block rounded-lg border bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={receipt.signatureData}
              alt="Assinatura do recebedor"
              className="h-32 w-auto object-contain"
            />
          </div>

          <p className="text-sm text-gray-700">
            <span className="font-medium">Recebido por:</span>{' '}
            {receipt.recipientName}
          </p>

          {receipt.notes && (
            <p className="mt-1 text-sm text-gray-500">
              <span className="font-medium">Obs.:</span> {receipt.notes}
            </p>
          )}

          {/* Auditoria */}
          <div className="mt-5 border-t pt-3 text-xs text-gray-400">
            Finalizado por{' '}
            <span className="font-medium text-gray-500">
              {receipt.finalizedBy?.name ?? '—'}
            </span>{' '}
            em {formatDateTime(receipt.finalizedAt)}
          </div>
        </div>
      </main>
    </div>
  )
}
