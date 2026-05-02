import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView } from '@/lib/auth-helpers'

export async function GET() {
  const authResult = await requireView('dashboard')
  if (authResult instanceof NextResponse) return authResult

  try {
    const [
      totalProducts,
      totalDonors,
      totalBeneficiaries,
      totalEmployees,
      totalDonations,
      totalDistributions,
      totalProducers,
      totalHarvests,
      recentDonations,
      recentDistributions,
      recentHarvests,
      approvedAgg,
      distributedAgg,
    ] = await Promise.all([
      prisma.product.count({ where: { active: true } }),
      prisma.donor.count({ where: { active: true } }),
      prisma.beneficiary.count({ where: { status: 'ativo' } }),
      prisma.employee.count({ where: { active: true } }),
      prisma.donation.count(),
      prisma.distribution.count(),
      prisma.producer.count({ where: { active: true } }),
      prisma.solidarityHarvest.count(),

      prisma.donation.findMany({
        take: 5,
        orderBy: { date: 'desc' },
        include: {
          donor: { select: { name: true } },
          items: { include: { product: { select: { name: true, unit: true } } } },
        },
      }),
      prisma.distribution.findMany({
        take: 5,
        orderBy: { date: 'desc' },
        include: {
          beneficiary: { select: { name: true } },
          items: { include: { product: { select: { name: true, unit: true } } } },
        },
      }),
      prisma.solidarityHarvest.findMany({
        take: 5,
        orderBy: { date: 'desc' },
        include: {
          producer: { select: { name: true } },
          items: { include: { product: { select: { name: true, unit: true } } } },
        },
      }),

      // ✅ Novo cálculo de estoque (global)
      prisma.dailyApproval.aggregate({ _sum: { approvedQty: true } }),
      prisma.distributionItem.aggregate({ _sum: { quantity: true } }),
    ])

    const totalInColdRoom = approvedAgg._sum.approvedQty || 0
    const totalDistributedKg = distributedAgg._sum.quantity || 0

    const totalStock = totalInColdRoom
    const totalApproved = totalInColdRoom + totalDistributedKg

    return NextResponse.json({
      totalProducts,
      totalDonors,
      totalBeneficiaries,
      totalEmployees,
      totalDonations,
      totalDistributions,
      totalProducers,
      totalHarvests,
      totalStock,
      totalApproved,
      stockItems: [],     // ⚠️ vazio (não há mais granularidade)
      notifications: [],  // ⚠️ vazio (sem alertas por produto)
      recentDonations,
      recentDistributions,
      recentHarvests,
    })
  } catch (error) {
    console.error('Erro GET dashboard:', error)
    return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 })
  }
}
