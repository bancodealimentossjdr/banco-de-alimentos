import { prisma } from '@/lib/prisma'

export type StockSnapshot = {
  hasMarker: boolean
  baseMarker: {
    id: string
    type: 'ZERO' | 'ADJUSTMENT'
    date: Date
    quantityKg: number
  } | null
  movements: {
    approvedKg: number
    harvestKg: number
    distributedKg: number
  }
  info: {
    donationsKg: number
  }
  currentStockKg: number
  calculatedAt: Date
}

const EMPTY_SNAPSHOT = (referenceDate: Date): StockSnapshot => ({
  hasMarker: false,
  baseMarker: null,
  movements: { approvedKg: 0, harvestKg: 0, distributedKg: 0 },
  info: { donationsKg: 0 },
  currentStockKg: 0,
  calculatedAt: referenceDate,
})

/**
 * 🕛 Retorna o "fim do dia" da data fornecida, em UTC.
 * Usado para que movimentações do MESMO DIA do marco sejam
 * IGNORADAS (já refletidas na pesagem física do marco).
 *
 * Ex.: marker.date = 2026-06-03 → retorna 2026-06-03T23:59:59.999Z
 *      Filtro `gt: endOfMarkerDay` pega apenas movimentações de 04/06 em diante.
 */
function endOfDayUTC(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(23, 59, 59, 999)
  return d
}

export async function calculateStock(
  referenceDate: Date = new Date(),
): Promise<StockSnapshot> {
  // 🛡️ Defesa: se o client ainda não conhece o model (cache velho),
  // retorna snapshot vazio em vez de quebrar a página.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(prisma as any).stockMarker) {
    console.warn(
      '[calculateStock] prisma.stockMarker indisponível. ' +
      'Rode: npx prisma generate && restart do dev server.',
    )
    return EMPTY_SNAPSHOT(referenceDate)
  }

  try {
    // 1️⃣ Marco base
    const baseMarker = await prisma.stockMarker.findFirst({
      where: { date: { lte: referenceDate } },
      orderBy: { date: 'desc' },
    })

    if (!baseMarker) return EMPTY_SNAPSHOT(referenceDate)

    // 🕛 Cutoff = fim do dia do marco.
    // Movimentações registradas NO MESMO DIA do marco são ignoradas,
    // pois já estão embutidas na pesagem física (decisão Onda 16.2).
    const cutoff = endOfDayUTC(baseMarker.date)

    // 2️⃣ Movimentações após o marco (estritamente após o fim do dia do marco)
    const [approvalAgg, distributionItems, harvestItems, donationItems] =
      await Promise.all([
        prisma.dailyApproval.aggregate({
          where: { date: { gt: cutoff, lte: referenceDate } },
          _sum: { approvedQty: true },
        }),
        prisma.distributionItem.findMany({
          where: {
            distribution: { date: { gt: cutoff, lte: referenceDate } },
          },
          select: { quantity: true },
        }),
        prisma.harvestItem.findMany({
          where: {
            harvest: {
              date: { gt: cutoff, lte: referenceDate },
              status: 'realizada',
            },
          },
          select: { quantity: true },
        }),
        prisma.donationItem.findMany({
          where: {
            donation: { date: { gt: cutoff, lte: referenceDate } },
          },
          select: { quantity: true },
        }),
      ])

    const approvedKg = approvalAgg._sum.approvedQty ?? 0
    const harvestKg = sumQty(harvestItems)
    const distributedKg = sumQty(distributionItems)
    const donationsKg = sumQty(donationItems)

    const currentStockKg = round3(
      baseMarker.quantityKg + approvedKg + harvestKg - distributedKg,
    )

    return {
      hasMarker: true,
      baseMarker: {
        id: baseMarker.id,
        type: baseMarker.type,
        date: baseMarker.date,
        quantityKg: baseMarker.quantityKg,
      },
      movements: {
        approvedKg: round3(approvedKg),
        harvestKg: round3(harvestKg),
        distributedKg: round3(distributedKg),
      },
      info: { donationsKg: round3(donationsKg) },
      currentStockKg,
      calculatedAt: referenceDate,
    }
  } catch (error) {
    console.error('[calculateStock] Erro inesperado:', error)
    return EMPTY_SNAPSHOT(referenceDate)
  }
}

function sumQty(items: { quantity: number }[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0)
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}
