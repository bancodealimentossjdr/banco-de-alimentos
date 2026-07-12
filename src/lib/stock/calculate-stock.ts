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
    distributedKg: number // 🔧 saídas DOACAO (compat)
    // 🆕 ONDA 19
    distributedDonationKg: number
    distributedHarvestKg: number
  }
  info: {
    donationsKg: number
  }
  // 🆕 ONDA 19 — gavetas separadas
  donationStockKg: number
  harvestStockKg: number
  currentStockKg: number
  calculatedAt: Date
}

const EMPTY_SNAPSHOT = (referenceDate: Date): StockSnapshot => ({
  hasMarker: false,
  baseMarker: null,
  movements: {
    approvedKg: 0,
    harvestKg: 0,
    distributedKg: 0,
    distributedDonationKg: 0,
    distributedHarvestKg: 0,
  },
  info: { donationsKg: 0 },
  donationStockKg: 0,
  harvestStockKg: 0,
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
    // 1️⃣ Marco base (só afeta a gaveta de DOAÇÃO)
    const baseMarker = await prisma.stockMarker.findFirst({
      where: { date: { lte: referenceDate } },
      orderBy: { date: 'desc' },
    })

    if (!baseMarker) return EMPTY_SNAPSHOT(referenceDate)

    // 🇧🇷 Cutoff = fim do dia do marco em horário de BRASÍLIA.
    const cutoff = endOfDayBrasilia(baseMarker.date)

    // 2️⃣ Movimentações após o marco (estritamente após o fim do dia BSB do marco)
    const [
      approvalAgg,
      donationDistItems,
      harvestDistItems,
      harvestItems,
      donationItems,
    ] = await Promise.all([
      prisma.dailyApproval.aggregate({
        where: { date: { gt: cutoff, lte: referenceDate } },
        _sum: { approvedQty: true },
      }),
      // 🥫 Saídas da gaveta DOAÇÃO
      prisma.distributionItem.findMany({
        where: {
          origem: 'DOACAO',
          distribution: { date: { gt: cutoff, lte: referenceDate } },
        },
        select: { quantity: true },
      }),
      // 🆕 ONDA 19 — 🌾 Saídas da gaveta COLHEITA
      prisma.distributionItem.findMany({
        where: {
          origem: 'COLHEITA',
          distribution: { date: { gt: cutoff, lte: referenceDate } },
        },
        select: { quantity: true },
      }),
      // 🌾 Entradas de colheita realizada
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
    const distributedDonationKg = sumQty(donationDistItems)
    const distributedHarvestKg = sumQty(harvestDistItems)
    const donationsKg = sumQty(donationItems)

    // 🥫 Gaveta DOAÇÃO: Marco Zero + aproveitado − saídas DOAÇÃO
    const donationStockKg = round3(
      baseMarker.quantityKg + approvedKg - distributedDonationKg,
    )

    // 🌾 Gaveta COLHEITA: nasce em 0 · entradas colheita − saídas COLHEITA
    const harvestStockKg = round3(harvestKg - distributedHarvestKg)

    const currentStockKg = round3(donationStockKg + harvestStockKg)

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
        distributedKg: round3(distributedDonationKg), // compat: saídas DOAÇÃO
        distributedDonationKg: round3(distributedDonationKg),
        distributedHarvestKg: round3(distributedHarvestKg),
      },
      info: { donationsKg: round3(donationsKg) },
      donationStockKg,
      harvestStockKg,
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
