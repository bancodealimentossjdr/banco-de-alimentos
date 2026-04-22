/**
 * Utilitários para mascarar dados pessoais sensíveis.
 * Aplicados no backend antes de retornar JSON para roles sem permissão total.
 */

export function maskCPF(cpf: string | null | undefined): string | null {
  if (!cpf) return cpf ?? null
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return '***.***.***-**'
  return `${digits.slice(0, 3)}.***.***-${digits.slice(9)}`
}

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return phone ?? null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) return '(**) ****-****'
  const ddd = digits.slice(0, 2)
  const last4 = digits.slice(-4)
  return `(${ddd}) ****-${last4}`
}

export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return email ?? null
  const [user, domain] = email.split('@')
  if (!domain) return '***@***'
  const visible = Math.min(2, user.length)
  const hidden = Math.max(3, user.length - visible)
  return `${user.slice(0, visible)}${'*'.repeat(hidden)}@${domain}`
}

/**
 * Mascara endereço em string única (formato comum no projeto).
 * Mantém apenas bairro/cidade quando conseguir identificar; caso contrário,
 * retorna um placeholder genérico.
 */
export function maskAddress(address: string | null | undefined): string | null {
  if (!address) return address ?? null
  // Estratégia simples: mostra apenas o último trecho (geralmente cidade/bairro)
  // e esconde números e detalhes iniciais.
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length <= 1) return '*** (endereço restrito)'
  // Pega os 2 últimos trechos (provável bairro + cidade) e mascara o resto
  const visiveis = parts.slice(-2).join(', ')
  return `***, ${visiveis}`
}

/** Mascara nome do responsável/contato pessoal (mantém primeiro nome). */
export function maskContactName(name: string | null | undefined): string | null {
  if (!name) return name ?? null
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return `${parts[0].slice(0, 2)}***`
  return `${parts[0]} ***`
}
