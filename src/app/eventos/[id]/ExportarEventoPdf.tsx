'use client'

import { useState } from 'react'

export default function ExportarEventoPdf({
  eventoId,
  isAdmin,
}: {
  eventoId: string
  isAdmin: boolean
}) {
  const [semCensura, setSemCensura] = useState(false)
  const [baixando, setBaixando] = useState(false)

  const exportar = () => {
    setBaixando(true)

    const params = new URLSearchParams({ format: 'pdf' })
    // só admin pode pedir sem censura; o servidor REVALIDA a role
    if (isAdmin && semCensura) params.set('mask', 'false')

    const url = `/api/eventos/${eventoId}/export?${params.toString()}`

    const a = document.createElement('a')
    a.href = url
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()

    setTimeout(() => setBaixando(false), 1200)
  }

  return (
    // 🆕 17.6-e — min-w-0 permite encolher; sem shrink-0; largura máxima no mobile
    <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:items-end">
      <button
        type="button"
        onClick={exportar}
        disabled={baixando}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {baixando ? '⏳ Gerando...' : '📄 Exportar PDF'}
      </button>

      {isAdmin && (
        <label className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-gray-600 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={semCensura}
            onChange={(e) => setSemCensura(e.target.checked)}
            className="h-4 w-4 shrink-0 rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span>Exportar sem censura</span>
          <span className="text-xs text-amber-600">(dados sensíveis)</span>
        </label>
      )}
    </div>
  )
}
