import { Prisma } from '@prisma/client'
import type { UserRole } from '@/types/next-auth'
import { maskProdutor, shouldMaskPersonalData } from '@/lib/mask-by-role'

// ============================================
// G1-8d — Núcleo do Termo de Recebimento PAA-MDS
// Regra SISPAA: 1 linha por produto + tipoCultivo
//   valor da linha = round(Σqtd × preço, 2) · valorTotal = Σ linhas
// ============================================

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

type Tx = Prisma.TransactionClient
type Num = Prisma.Decimal | number | string | null | undefined

export type ItemParaTermo = {
  productId: string
  tipoCultivo: string
  quantidade: Num
  precoUnitario: Num
  pesoKg: Num
  product?: { name?: string | null } | null
}

export type LinhaTermo = {
  productId: string
  tipoCultivo: string
  nome: string
  quantidade: Prisma.Decimal
  precoUnitario: Prisma.Decimal
  valor: Prisma.Decimal
  pesoKg: Prisma.Decimal
}

export type TotaisTermo = {
  linhas: LinhaTermo[]
  valorTotal: Prisma.Decimal
  quantidadeTotal: Prisma.Decimal
  pesoTotalKg: Prisma.Decimal
}

const D = (v: Num) => new Prisma.Decimal(String(v ?? 0))
const rotuloCultivo = (t: string) => (t === 'ORGANICO' ? 'orgânico' : 'convencional')
const brl = (d: Prisma.Decimal) => `R$ ${d.toFixed(2).replace('.', ',')}`

/** Agrupa itens em linhas SISPAA. Recusa preços diferentes no mesmo grupo. */
export function calcularLinhasTermo(itens: ItemParaTermo[]): TotaisTermo | { error: string } {
  const grupos = new Map<string, LinhaTermo>()

  for (const i of itens) {
    const chave = `${i.productId}::${i.tipoCultivo}`
    const preco = D(i.precoUnitario)
    const g = grupos.get(chave)
    if (!g) {
      grupos.set(chave, {
        productId: i.productId,
        tipoCultivo: i.tipoCultivo,
        nome: i.product?.name ?? 'Produto',
        quantidade: D(i.quantidade),
        precoUnitario: preco,
        valor: new Prisma.Decimal(0),
        pesoKg: D(i.pesoKg),
      })
      continue
    }
    if (!g.precoUnitario.equals(preco)) {
      return {
        error: `"${g.nome}" (${rotuloCultivo(g.tipoCultivo)}) aparece com preços diferentes (${brl(
          g.precoUnitario,
        )} e ${brl(preco)}). Separe essas entregas em Termos distintos.`,
      }
    }
    g.quantidade = g.quantidade.add(D(i.quantidade))
    g.pesoKg = g.pesoKg.add(D(i.pesoKg))
  }

  let valorTotal = new Prisma.Decimal(0)
  let quantidadeTotal = new Prisma.Decimal(0)
  let pesoTotalKg = new Prisma.Decimal(0)

  const linhas = Array.from(grupos.values())
    .map((g) => {
      const quantidade = g.quantidade.toDecimalPlaces(3)
      const valor = quantidade.mul(g.precoUnitario).toDecimalPlaces(2)
      valorTotal = valorTotal.add(valor)
      quantidadeTotal = quantidadeTotal.add(quantidade)
      pesoTotalKg = pesoTotalKg.add(g.pesoKg)
      return { ...g, quantidade, valor, pesoKg: g.pesoKg.toDecimalPlaces(3) }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.tipoCultivo.localeCompare(b.tipoCultivo))

  return {
    linhas,
    valorTotal: valorTotal.toDecimalPlaces(2),
    quantidadeTotal: quantidadeTotal.toDecimalPlaces(3),
    pesoTotalKg: pesoTotalKg.toDecimalPlaces(3),
  }
}

/** Recalcula e grava os totais do Termo a partir das entregas vinculadas. Usar SEMPRE dentro de $transaction. */
export async function recalcularTotaisTermo(tx: Tx, termoId: string) {
  const itens = await tx.entregaPaaItem.findMany({
    where: { entregaPaa: { termoPaaId: termoId } },
    select: {
      productId: true,
      tipoCultivo: true,
      quantidade: true,
      precoUnitario: true,
      pesoKg: true,
      product: { select: { name: true } },
    },
  })
  const r = calcularLinhasTermo(itens)
  if ('error' in r) throw new HttpError(409, r.error)

  await tx.termoPaa.update({
    where: { id: termoId },
    data: {
      valorTotal: r.valorTotal,
      quantidadeTotal: r.quantidadeTotal,
      pesoTotalKg: r.pesoTotalKg,
    },
  })
  return { valorTotal: r.valorTotal, quantidadeTotal: r.quantidadeTotal, pesoTotalKg: r.pesoTotalKg, vazio: itens.length === 0 }
}

// ---------- Datas civis (colunas @db.Date) ----------
export const civilParaDate = (s: string) => new Date(`${s}T00:00:00.000Z`)
export const dateParaCivil = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null)
export const civilParaBR = (s: string) => s.split('-').reverse().join('/')

export const agoraBR = () =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date())

// ---------- Serialização e máscara ----------
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

export function serializeLinhas(linhas: LinhaTermo[]) {
  return linhas.map((l) => ({
    ...l,
    quantidade: num(l.quantidade),
    precoUnitario: num(l.precoUnitario),
    valor: num(l.valor),
    pesoKg: num(l.pesoKg),
  }))
}

export function serializeTermo(t: any) {
  return {
    ...t,
    valorTotal: num(t.valorTotal),
    quantidadeTotal: num(t.quantidadeTotal),
    pesoTotalKg: num(t.pesoTotalKg),
    dataTermo: dateParaCivil(t.dataTermo),
    ...('dataAteste' in t ? { dataAteste: dateParaCivil(t.dataAteste) } : {}),
    ...(Array.isArray(t.entregas)
      ? {
          entregas: t.entregas.map((e: any) => ({
            ...e,
            dataEntrega: dateParaCivil(e.dataEntrega),
            valorTotal: num(e.valorTotal),
            pesoTotalKg: num(e.pesoTotalKg),
            ...(Array.isArray(e.itens)
              ? {
                  itens: e.itens.map((i: any) => ({
                    ...i,
                    quantidade: num(i.quantidade),
                    precoUnitario: num(i.precoUnitario),
                    fatorKg: num(i.fatorKg),
                    pesoKg: num(i.pesoKg),
                    subtotal: num(i.subtotal),
                  })),
                }
              : {}),
          })),
        }
      : {}),
  }
}

/** Produtor sempre pela maskProdutor; valores e observação interna → null para visualizador. */
export function maskTermo<T extends Record<string, any>>(t: T, role: UserRole | undefined | null): T {
  const out: any = { ...t }
  if (out.producer) out.producer = maskProdutor(out.producer, role)
  if (!shouldMaskPersonalData(role)) return out

  out.valorTotal = null
  out.isMasked = true
  if ('observacaoInterna' in out) out.observacaoInterna = null
  if (Array.isArray(out.linhas)) {
    out.linhas = out.linhas.map((l: any) => ({ ...l, precoUnitario: null, valor: null }))
  }
  if (Array.isArray(out.entregas)) {
    out.entregas = out.entregas.map((e: any) => ({
      ...e,
      valorTotal: null,
      itens: Array.isArray(e.itens)
        ? e.itens.map((i: any) => ({ ...i, precoUnitario: null, subtotal: null }))
        : e.itens,
    }))
  }
  return out
}
