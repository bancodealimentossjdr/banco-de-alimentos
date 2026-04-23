'use client'

import { usePermissions } from '@/hooks/usePermissions'

interface PhoneLinkProps {
  phone: string | null | undefined
  /** Se true, mostra só o número sem os ícones (útil em contextos compactos) */
  textOnly?: boolean
  /** Classe CSS adicional */
  className?: string
}

/**
 * Limpa o telefone, mantendo só dígitos.
 * Ex: "(32) 99999-8888" → "32999998888"
 */
function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

/**
 * Formata o número pra exibição amigável.
 * Ex: "32999998888" → "(32) 99999-8888"
 * Ex: "3238221234"  → "(32) 3822-1234"
 */
function formatPhone(phone: string): string {
  const digits = cleanPhone(phone)
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  // Se não encaixa nos padrões BR, devolve original
  return phone
}

/**
 * Monta a URL do WhatsApp (assume DDI 55 se não tiver).
 */
function buildWhatsAppUrl(phone: string): string {
  const digits = cleanPhone(phone)
  const withCountryCode = digits.startsWith('55') ? digits : `55${digits}`
  return `https://wa.me/${withCountryCode}`
}

export default function PhoneLink({ phone, textOnly = false, className = '' }: PhoneLinkProps) {
  const { isVisualizador, isLoading } = usePermissions()

  if (!phone || !phone.trim()) {
    return <span className="text-gray-400">-</span>
  }

  const digits = cleanPhone(phone)
  const formatted = formatPhone(phone)
  const isMobile = digits.length === 11 // celular BR tem 11 dígitos (com DDD)

  // 🔒 Visualizador (ou enquanto carrega a sessão): só texto, sem ícones clicáveis
  // O número já vem mascarado do backend (ex: "(32) ****-8888"), então não faz
  // sentido oferecer "Ligar" ou "WhatsApp" — seria um link quebrado.
  if (textOnly || isVisualizador || isLoading) {
    return <span className={className}>{formatted}</span>
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Número formatado */}
      <span className="text-gray-700">{formatted}</span>

      {/* Botão de ligação */}
      <a
        href={`tel:${digits}`}
        title="Ligar"
        className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 transition"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm">📞</span>
      </a>

      {/* Botão de WhatsApp — só se for celular */}
      {isMobile && (
        <a
          href={buildWhatsAppUrl(phone)}
          target="_blank"
          rel="noopener noreferrer"
          title="Abrir no WhatsApp"
          className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-50 hover:bg-green-100 text-green-600 transition"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-sm">💬</span>
        </a>
      )}
    </div>
  )
}
