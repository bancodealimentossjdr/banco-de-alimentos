// src/lib/mask.ts

/** 000.000.000-00 */
export function fmtCPF(cpf: string | null | undefined): string {
  if (!cpf) return '—'
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return cpf
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** 123.***.***-45 — LGPD: mantém prefixo e dígitos verificadores */
export function maskCPF(cpf: string | null | undefined): string {
  if (!cpf) return '—'
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return '***.***.***-**'
  return `${d.slice(0, 3)}.***.***-${d.slice(9)}`
}

/** Aplica cru ou mascarado conforme decisão do servidor */
export function cpfPorRole(
  cpf: string | null | undefined,
  revelar: boolean,
): string {
  return revelar ? fmtCPF(cpf) : maskCPF(cpf)
}

/**
 * 🩹 ONDA 21.6 — funções abaixo eram REEXPORTADAS por mask-by-role.ts
 * mas NUNCA existiam aqui. O webpack só emitia warning; em runtime
 * viravam `undefined` → dado de beneficiário podia sair CRU ou quebrar.
 */

/** "Maria das Dores Silva" → "Maria d. D. S." */
export function maskContactName(nome: string | null | undefined): string {
  if (!nome) return '—'
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '—'
  const [primeiro, ...resto] = partes
  if (resto.length === 0) return primeiro
  const iniciais = resto.map((p) => `${p.charAt(0).toUpperCase()}.`).join(' ')
  return `${primeiro} ${iniciais}`
}

/** "(32) 99123-4567" → "(32) *****-4567" */
export function maskPhone(tel: string | null | undefined): string {
  if (!tel) return '—'
  const d = tel.replace(/\D/g, '')
  if (d.length < 8) return '****'
  const ddd = d.length >= 10 ? d.slice(0, 2) : null
  const ultimos = d.slice(-4)
  const meio = '*'.repeat(Math.max(d.length - (ddd ? 2 : 0) - 4, 1))
  return ddd ? `(${ddd}) ${meio}-${ultimos}` : `${meio}-${ultimos}`
}

/** "maria.silva@gmail.com" → "ma*********@gmail.com" */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '—'
  const [user, domain] = email.split('@')
  if (!domain) return '***'
  const visible = user.slice(0, 2)
  return `${visible}${'*'.repeat(Math.max(user.length - 2, 1))}@${domain}`
}

/** "Rua Tiradentes, 450 - Centro" → "Rua Tiradentes, *** - Centro" */
export function maskAddress(end: string | null | undefined): string {
  if (!end) return '—'
  // remove números (nº, CEP) preservando a referência de rua/bairro
  const semNumero = end.replace(/\d+/g, '***')
  return semNumero.length > 60 ? `${semNumero.slice(0, 60)}…` : semNumero
}
