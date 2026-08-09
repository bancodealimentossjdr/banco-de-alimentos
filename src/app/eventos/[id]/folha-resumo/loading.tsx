// src/app/eventos/[id]/folha-resumo/loading.tsx
import AnnonaeLoader from '@/components/ui/AnnonaeLoader'

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <AnnonaeLoader size={88} label="Abrindo folha resumo…" />
    </div>
  )
}
