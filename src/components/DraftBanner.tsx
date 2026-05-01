'use client'

interface DraftBannerProps {
  savedAt: number | null
  onRestore: () => void
  onDiscard: () => void
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMin / 60)

  if (diffMin < 1) return 'agora há pouco'
  if (diffMin < 60) return `há ${diffMin} min`
  if (diffHours < 12) return `há ${diffHours}h`
  return 'há mais de 12h'
}

export default function DraftBanner({
  savedAt,
  onRestore,
  onDiscard,
}: DraftBannerProps) {
  if (!savedAt) return null

  return (
    <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 mb-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">💾</span>
            <h3 className="font-bold text-amber-900">
              Rascunho encontrado
            </h3>
          </div>
          <p className="text-sm text-amber-800">
            Você começou a preencher um formulário {formatRelativeTime(savedAt)} e
            não chegou a salvar. Deseja continuar de onde parou?
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onDiscard}
            className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium transition text-sm"
          >
            🗑️ Descartar
          </button>
          <button
            type="button"
            onClick={onRestore}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-medium transition text-sm shadow-sm"
          >
            ↩️ Recuperar
          </button>
        </div>
      </div>
    </div>
  )
}
