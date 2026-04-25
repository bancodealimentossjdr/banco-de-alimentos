import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView } from '@/lib/auth-helpers'

export async function GET() {
  const authResult = await requireView('estoque')
  if (authResult instanceof NextResponse) return authResult

  try {
    // 🧮 4 queries em paralelo para somar tudo
    const [donationsAgg, harvestAgg, approvedAgg, distributedAgg] =
      await Promise.all([
        // 🏪 Total recebido das DOAÇÕES (soma DonationItem.quantity)
        prisma.donationItem.aggregate({
          _sum: { quantity: true },
        }),
        // 🌾 Total recebido da COLHEITA SOLIDÁRIA (soma HarvestItem.quantity)
        prisma.harvestItem.aggregate({
          _sum: { quantity: true },
        }),
        // ✅ Total APROVEITADO (soma DailyApproval.approvedQty)
        prisma.dailyApproval.aggregate({
          _sum: { approvedQty: true },
        }),
        // 📤 Total DISTRIBUÍDO (soma DistributionItem.quantity)
        prisma.distributionItem.aggregate({
          _sum: { quantity: true },
        }),
      ])

    const donations = donationsAgg._sum.quantity ?? 0
    const solidarityHarvest = harvestAgg._sum.quantity ?? 0
    const approved = approvedAgg._sum.approvedQty ?? 0
    const distributed = distributedAgg._sum.quantity ?? 0

    // 📦 Em Estoque = Aproveitado + Colheita - Distribuído
    const inStock = Math.max(0, approved + solidarityHarvest - distributed)

    return NextResponse.json({
      donations,
      solidarityHarvest,
      approved,
      distributed,
      inStock,
    })
  } catch (error) {
    console.error('[ESTOQUE_RESUMO]', error)
    return NextResponse.json(
      { error: 'Erro ao buscar resumo do estoque' },
      { status: 500 }
    )
  }
}
