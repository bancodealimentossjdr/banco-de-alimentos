import { createHash } from 'crypto'
import { Prisma } from '@prisma/client'

// ============================================
// G1-8c — Impressão digital da entrega PAA no momento da assinatura.
// Formato canônico em ARRAYS (ordem fixa, sem depender da ordem de chaves).
// Decimais em string com casas fixas. Itens ordenados por id.
// Mudar este formato = nova versão ("v2"); nunca alterar a v1.
// ============================================

type Dec = Prisma.Decimal | number | string

const fx = (v: Dec, casas: number) => new Prisma.Decimal(String(v)).toFixed(casas)
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')

export interface EntregaParaHash {
  id: string
  producerId: string
  dataEntrega: Date
  valorTotal: Dec
  pesoTotalKg: Dec
  itens: {
    id: string
    productId: string
    tipoCultivo: string
    quantidade: Dec
    precoUnitario: Dec
    fatorKg: Dec
    pesoKg: Dec
    subtotal: Dec
  }[]
}

export interface AssinaturaParaHash {
  data: string // PNG base64
  em: Date
  porId: string
}

export function hashEntregaPaa(e: EntregaParaHash, a: AssinaturaParaHash): string {
  const itens = [...e.itens]
    .sort((x, y) => x.id.localeCompare(y.id))
    .map((i) => [
      i.id,
      i.productId,
      i.tipoCultivo,
      fx(i.quantidade, 3),
      fx(i.precoUnitario, 2),
      fx(i.fatorKg, 3),
      fx(i.pesoKg, 3),
      fx(i.subtotal, 2),
    ])

  const canonico = JSON.stringify([
    'v1',
    e.id,
    e.producerId,
    e.dataEntrega.toISOString().slice(0, 10),
    fx(e.valorTotal, 2),
    fx(e.pesoTotalKg, 3),
    itens,
    sha(a.data), // amarra a IMAGEM da assinatura
    a.em.toISOString(),
    a.porId,
  ])

  return sha(canonico)
}

/** Recalcula e compara — para auditoria/prestação de contas. */
export function verificarHashEntregaPaa(
  e: EntregaParaHash,
  a: AssinaturaParaHash,
  hashGravado: string,
): boolean {
  return hashEntregaPaa(e, a) === hashGravado
}
