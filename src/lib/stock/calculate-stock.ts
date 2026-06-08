import { prisma } from '@/lib/prisma'
import { endOfDayBrasilia } from '@/lib/date/day-boundaries'

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

    // 🇧🇷 Cutoff = fim do dia do marco em horário de BRASÍLIA.
    // Movimentações registradas NO MESMO DIA civil do marco são ignoradas
    // (já estão embutidas na pesagem física — decisão Onda 16.2).
    //
    // Antes (bug): endOfDayUTC pegava 23:59:59 UTC = 20:59:59 BSB
    // → movimentações entre 21h e 23h59 (BSB) entravam como "pós-marco".
    // Agora: endOfDayBrasilia pega 23:59:59 BSB = 02:59:59 UTC do dia seguinte.
    const cutoff = endOfDayBrasilia(baseMarker.date)

    // 2️⃣ Movimentações após o marco (estritamente após o fim do dia BSB do marco)
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
