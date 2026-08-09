// src/app/eventos/loading.tsx
import AnnonaeLoader from '@/components/ui/AnnonaeLoader'

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <AnnonaeLoader size={80} label="Carregando eventos…" />
    </div>
  )
}
