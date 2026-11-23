import type { Product } from '@prisma/client'

/**
 * 🔒 Campos normativos do PAA (preço/código de referência).
 * Onda 24 (22/11): decisão 23.8 revista — admin E dev editam.
 * A fonte do preço varia por organização e é identificada pelos dados
 * institucionais (ver paa-fonte-preco.ts). O preço aplicado fica
 * congelado em EntregaPaaItem, então alterar aqui não afeta o passado.
 * Nome do arquivo mantido por compatibilidade de imports.
 */
export const CONAB_FIELDS = [
  'isPaa',
  'codigoConab',
  'codigoConabOrganico',
  'temOrganico',
  'paaConvencional',
  'paaOrganico',
  'paaUnidade',
  'paaFatorKg',
] as const

export type ConabField = (typeof CONAB_FIELDS)[number]

/** Normaliza para comparação: Decimal | number | string | null → string canônica */
function norm(v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  const n = Number(
    typeof v === 'object' && v !== null && 'toString' in v ? v.toString() : v
  )
  // Number.isNaN cobre strings não-numéricas (ex: paaUnidade = 'Dúzia')
  return Number.isNaN(n) ? String(v).trim() : String(n)
}

/**
 * Retorna os campos PAA normativos que o payload TENTA alterar.
 * Vazio = nada normativo mudou.
 * ⚠️ Enviar o mesmo valor NÃO é alteração.
 */
export function conabFieldsChanged(
  paaData: Record<string, unknown>,
  atual: Product | null
): ConabField[] {
  return CONAB_FIELDS.filter((f) => {
    if (!(f in paaData)) return false
    const novo = norm(paaData[f])
    const velho = atual ? norm((atual as Record<string, unknown>)[f]) : ''
    return novo !== velho
  })
}

/** Mensagem única para o 403 — mesma em POST e PUT. */
export function conabDeniedMessage(campos: ConabField[]): string {
  return `Apenas admin ou dev podem alterar os preços de referência do PAA (campos: ${campos.join(', ')}).`
}
