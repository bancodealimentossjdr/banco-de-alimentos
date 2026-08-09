// src/app/eventos/[id]/campo/loading.tsx
import AnnonaeLoader from '@/components/ui/AnnonaeLoader'

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <AnnonaeLoader size={88} label="Abrindo registro de campo…" />
    </div>
  )
}
