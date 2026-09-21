import type { Product } from '@prisma/client'

/**
 * 🔒 ONDA 23.8 — Campos normativos da tabela CONAB.
 * Só o dev altera: preço/código mudam por safra (ato da CONAB),
 * não por decisão da ONG. Base documental do Termo de Recebimento (23.9).
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
 * Retorna a lista de campos CONAB que o payload TENTA alterar.
 * Vazio = nada normativo mudou → não exige dev.
 *
 * ⚠️ Enviar o mesmo valor NÃO é alteração: admin pode salvar um produto
 * PAA (renomear, trocar categoria) sem cair no 403.
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
  return `Apenas o perfil dev pode alterar a tabela de preços CONAB (campos: ${campos.join(', ')}).`
}
