import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView } from '@/lib/auth-helpers'
import { auth } from '@/lib/auth'
import { shouldMaskPersonalData, maskContactName } from '@/lib/mask-by-role'

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

    // 🔐 LGPD — mascara nomes das listas recentes p/ visualizador (fail-secure)
    const session = await auth()
    const role = session?.user?.role
    const mask = shouldMaskPersonalData(role)

    const safeRecentDonations = mask
      ? recentDonations.map((d) => ({
          ...d,
          donor: d.donor ? { name: maskContactName(d.donor.name) } : d.donor,
        }))
      : recentDonations

    const safeRecentDistributions = mask
      ? recentDistributions.map((d) => ({
          ...d,
          beneficiary: d.beneficiary
            ? { name: maskContactName(d.beneficiary.name) }
            : d.beneficiary,
        }))
      : recentDistributions

    const safeRecentHarvests = mask
      ? recentHarvests.map((h) => ({
          ...h,
          producer: h.producer ? { name: maskContactName(h.producer.name) } : h.producer,
        }))
      : recentHarvests

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
      stockItems: [],
      notifications: [],
      recentDonations: safeRecentDonations,
      recentDistributions: safeRecentDistributions,
      recentHarvests: safeRecentHarvests,
    })
  } catch (error) {
    console.error('Erro GET dashboard:', error)
    return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 })
  }
}
