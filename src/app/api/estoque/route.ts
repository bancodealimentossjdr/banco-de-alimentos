import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView } from '@/lib/auth-helpers'

export async function GET() {
  const authResult = await requireView('estoque')
  if (authResult instanceof NextResponse) return authResult

  try {
    // 4 agregações simples em paralelo
    const [donatedAgg, harvestedAgg, distributedAgg, approvedAgg] =
      await Promise.all([
        prisma.donationItem.aggregate({ _sum: { quantity: true } }),
        prisma.harvestItem.aggregate({ _sum: { quantity: true } }),
        prisma.distributionItem.aggregate({ _sum: { quantity: true } }),
        prisma.dailyApproval.aggregate({ _sum: { approvedQty: true } }),
      ])

    const totalDonated = donatedAgg._sum.quantity || 0
    const totalHarvested = harvestedAgg._sum.quantity || 0
    const totalDistributed = distributedAgg._sum.quantity || 0
    const totalInColdRoom = approvedAgg._sum.approvedQty || 0

    // ✅ Aproveitado = câmara fria atual + tudo que já saiu pros beneficiários
    const totalApproved = totalInColdRoom + totalDistributed

    // ✅ Estoque = só o que está fisicamente na câmara fria
    const totalStock = totalInColdRoom

    // Descartado = entrou e não virou aproveitamento (foi pro lixo na triagem)
    const totalEntered = totalDonated + totalHarvested
    const totalDiscarded = Math.max(0, totalEntered - totalApproved)

    return NextResponse.json({
      totalDonated,
      totalHarvested,
      totalEntered,
      totalApproved,
      totalDistributed,
      totalStock,
      totalDiscarded,
    })
  } catch (error) {
    console.error('Erro GET estoque:', error)
    return NextResponse.json({ error: 'Erro ao buscar estoque' }, { status: 500 })
  }
}
