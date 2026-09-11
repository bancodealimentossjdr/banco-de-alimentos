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
    paaKg: number
    distributedKg: number
  }
  info: { donationsKg: number }
  currentStockKg: number
  calculatedAt: Date
}

const EMPTY_SNAPSHOT = (referenceDate: Date): StockSnapshot => ({
  hasMarker: false,
  baseMarker: null,
  movements: { approvedKg: 0, harvestKg: 0, paaKg: 0, distributedKg: 0 },
  info: { donationsKg: 0 },
  currentStockKg: 0,
  calculatedAt: referenceDate,
})

/**
 * 📦 Saldo do estoque a partir do último marco de calibração.
 *
 * ⏱️ RÉGUA DO LEDGER: `createdAt`, não `date`.
 *
 * O marco é uma FOTO do que o sistema sabia no instante da calibragem.
 * O peso digitado é o físico da câmara, que já reflete tudo lançado até ali.
 * Logo, só movimenta o saldo o que foi REGISTRADO depois: createdAt > marco.
 *
 * Isso garante as duas propriedades que a operação exige:
 *   1. Calibrar 0 às 14h  →  saldo exibido = 0,000 (nada anterior sobra)
 *   2. Produtor chega 15h →  lançamento entra no saldo
 *
 * ⚠️ Por que NÃO usar `date`:
 *    - DailyApproval.date e EntregaPaa.dataEntrega são @db.Date (sem hora),
 *      então não há como saber se ocorreram antes ou depois da calibragem
 *    - `date` é editável pelo operador; `createdAt` é imutável (@default(now))
 *    - a tentativa anterior (cutoff por dia civil) jogava as movimentações do
 *      próprio dia do marco para o lado errado e gerava saldo negativo
 *
 * ⚠️ Contrapartida aceita: lançamento retroativo posterior à calibragem entra
 *    no saldo. Se o item já estava fisicamente pesado no marco, recalibre —
 *    não é caso de ajustar a fórmula.
 */
export async function calculateStock(
  referenceDate: Date = new Date(),
): Promise<StockSnapshot> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(prisma as any).stockMarker) {
    console.warn(
      '[calculateStock] prisma.stockMarker indisponível. ' +
        'Rode: npx prisma generate && restart do dev server.',
    )
    return EMPTY_SNAPSHOT(referenceDate)
  }

  try {
    // 1️⃣ Marco base — o mais recente até a data de referência
    const baseMarker = await prisma.stockMarker.findFirst({
      where: { date: { lte: referenceDate } },
      orderBy: { date: 'desc' },
    })

    if (!baseMarker) return EMPTY_SNAPSHOT(referenceDate)

    // ⏱️ Instante da calibragem. Requer StockMarker.date como DateTime
    //    (migration 23.6a-bis). Enquanto era @db.Date valia meia-noite UTC,
    //    que em Brasília é o dia anterior às 21h — origem do bug.
    const cutoff = baseMarker.date

    // 2️⃣ Movimentações registradas APÓS o marco
    const [approvalAgg, distItems, harvestItems, donationItems, paaAgg] =
      await Promise.all([
        prisma.dailyApproval.aggregate({
          where: { createdAt: { gt: cutoff, lte: referenceDate } },
          _sum: { approvedQty: true },
        }),
        // 📤 Saída ÚNICA — toda distribuição
        // ⚠️ Exclui EVENTO: controlado por unidade, à parte do kg
        prisma.distributionItem.findMany({
          where: {
            origem: { not: 'EVENTO' },
            distribution: { createdAt: { gt: cutoff, lte: referenceDate } },
          },
          select: { quantity: true },
        }),
        prisma.harvestItem.findMany({
          where: {
            harvest: {
              createdAt: { gt: cutoff, lte: referenceDate },
              status: 'realizada',
            },
          },
          select: { quantity: true },
        }),
        // ℹ️ Informativo: entrada bruta. Não soma no saldo — quem entra é o
        //    aproveitado (DailyApproval), já descontado o refugo da triagem.
        prisma.donationItem.findMany({
          where: {
            donation: { createdAt: { gt: cutoff, lte: referenceDate } },
          },
          select: { quantity: true },
        }),
        // 🌾 ONDA 23.6a — PAA. Produto adquirido do produtor: não passa por
        //    triagem, não gera refugo. Entra 100%, igual à colheita.
        //    pesoTotalKg já vem congelado (quantidade × fatorKg).
        prisma.entregaPaa.aggregate({
          where: { createdAt: { gt: cutoff, lte: referenceDate } },
          _sum: { pesoTotalKg: true },
        }),
      ])

    const approvedKg = approvalAgg._sum.approvedQty ?? 0
    const harvestKg = sumQty(harvestItems)
    const distributedKg = sumQty(distItems)
    const donationsKg = sumQty(donationItems)
    const paaKg = decimalToNumber(paaAgg._sum.pesoTotalKg)

    // 📦 ESTOQUE ÚNICO: marco + (aproveitado + colheita + PAA) − distribuído
    const entradasKg = round3(approvedKg + harvestKg + paaKg)
    const currentStockKg = round3(
      baseMarker.quantityKg + entradasKg - distributedKg,
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
        paaKg: round3(paaKg),
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

// Prisma.Decimal | null → number (aceita Decimal, string ou number)
function decimalToNumber(value: unknown): number {
  if (value === null || value === undefined) return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}
