// src/app/loading.tsx
// Cobre todas as rotas sem loading.tsx próprio (funcionarios, doadores, produtos...)
import AnnonaeLoader from '@/components/ui/AnnonaeLoader'

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <AnnonaeLoader size={80} label="Carregando…" />
    </div>
  )
}
