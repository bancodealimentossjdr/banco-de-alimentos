'use client'

import { useState } from 'react'

export default function ExportarEventoPdf({
  eventoId,
  dataInicio,
  dataFim,
}: {
  eventoId: string
  dataInicio?: string // 17.5-a — YYYY-MM-DD
  dataFim?: string
}) {
  const [baixando, setBaixando] = useState(false)

  // ❌ ONDA 21.6 — prop `isAdmin` e o checkbox "sem censura" removidos:
  //    o relatório de evento não expõe mais dado sensível (operadores saíram
  //    na 21.4), então o parâmetro `mask` era órfão.
  const exportar = () => {
    setBaixando(true)

    const params = new URLSearchParams({ format: 'pdf' })
    if (dataInicio) params.set('inicio', dataInicio)
    if (dataFim) params.set('fim', dataFim)

    const a = document.createElement('a')
    a.href = `/api/eventos/${eventoId}/export?${params.toString()}`
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()

    setTimeout(() => setBaixando(false), 1200)
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:items-end">
      <button
        type="button"
        onClick={exportar}
        disabled={baixando}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {baixando ? '⏳ Gerando...' : '📄 Exportar PDF'}
      </button>
    </div>
  )
}
