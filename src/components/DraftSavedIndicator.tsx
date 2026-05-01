'use client'

interface DraftSavedIndicatorProps {
  show: boolean
}

export default function DraftSavedIndicator({ show }: DraftSavedIndicatorProps) {
  if (!show) return null

  return (
    <div className="fixed bottom-4 right-4 z-40 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg flex items-center gap-1.5 animate-fade-in">
      <span>💾</span>
      <span className="font-medium">Rascunho salvo</span>
    </div>
  )
}
