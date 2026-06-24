'use client'

import { useRouter } from 'next/navigation'
interface BotaoVoltarProps {
  /**
   * Rota de fallback caso não haja histórico de navegação
   * (ex: usuário entrou direto pelo link/PWA).
   * @example "/eventos"
   */
  fallbackHref: string
  /** Texto do botão. Padrão: "Voltar" */
  label?: string
  /** Classe extra opcional para posicionamento no container pai */
  className?: string
}

/**
 * 🔙 Botão "Voltar" reutilizável (Onda 17.5-B).
 *
 * Comportamento HÍBRIDO:
 *   1. Se houver histórico no navegador → router.back()
 *   2. Senão (entrou direto por link/PWA) → router.push(fallbackHref)
 *
 * Uso em páginas de DETALHE, no topo-esquerda.
 * Grande o suficiente para toque em campo (mobile/PWA).
 *
 * @example
 * <BotaoVoltar fallbackHref="/eventos" />
 * <BotaoVoltar fallbackHref="/distribuicoes" label="Voltar às distribuições" />
 */
export default function BotaoVoltar({
  fallbackHref,
  label = 'Voltar',
  className = '',
}: BotaoVoltarProps) {
  const router = useRouter()

  function handleClick() {
    // window.history.length > 1 indica que há para onde voltar.
    // Em PWA/entrada direta, costuma ser 1 → usa fallback.
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push(fallbackHref)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 active:bg-gray-200 ${className}`}
    >
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 19l-7-7 7-7"
        />
      </svg>
      {label}
    </button>
  )
}
