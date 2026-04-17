import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Todas as contagens em paralelo
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
      products,
      donatedByProduct,
      harvestedByProduct,
      distributedByProduct,
    ] = await Promise.all([
      prisma.product.count({ where: { active: true } }),
      prisma.donor.count({ where: { active: true } }),
      prisma.beneficiary.count({ where: { status: 'ativo' } }),
      prisma.employee.count({ where: { active: true } }),
      prisma.donation.count(),
      prisma.distribution.count(),
      prisma.producer.count({ where: { active: true } }),
      prisma.solidarityHarvest.count(),

      // Recentes
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

      // Produtos ativos
      prisma.product.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
      }),

      // Totais agrupados por produto (3 queries no lugar de N*3)
      prisma.donationItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true },
      }),
      prisma.harvestItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true },
      }),
      prisma.distributionItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true },
      }),
    ])

    // Mapas para lookup rápido
    const donatedMap = new Map(donatedByProduct.map(d => [d.productId, d._sum.quantity || 0]))
    const harvestedMap = new Map(harvestedByProduct.map(h => [h.productId, h._sum.quantity || 0]))
    const distributedMap = new Map(distributedByProduct.map(d => [d.productId, d._sum.quantity || 0]))

    // Calcular estoque e notificações
    const stockItems = products.map(p => {
      const totalIn = (donatedMap.get(p.id) || 0) + (harvestedMap.get(p.id) || 0)
      const totalOut = distributedMap.get(p.id) || 0
      const stock = totalIn - totalOut
      return {
        id: p.id,
        name: p.name,
        unit: p.unit,
        minStock: p.minStock,
        stock,
      }
    })

    const totalStock = stockItems.reduce((acc, item) => acc + item.stock, 0)

    // Notificações de estoque
    const notifications = stockItems
      .filter(item => item.stock <= item.minStock)
      .map(item => {
        const isCritical = item.stock <= 0
        return {
          id: item.id,
          type: 'stock',
          severity: isCritical ? ('critical' as const) : ('warning' as const),
          title: isCritical
            ? `${item.name} — Estoque zerado!`
            : `${item.name} — Estoque baixo`,
          message: isCritical
            ? `O produto ${item.name} está com estoque zerado (0 ${item.unit}). Mínimo: ${item.minStock} ${item.unit}.`
            : `O produto ${item.name} está com ${item.stock} ${item.unit}. Mínimo: ${item.minStock} ${item.unit}.`,
        }
      })
      .sort((a, b) => {
        const order = { critical: 0, warning: 1, info: 2 }
        return order[a.severity] - order[b.severity]
      })

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
      stockItems,
      notifications,
      recentDonations,
      recentDistributions,
      recentHarvests,
    })
  } catch (error) {
    console.error('Erro GET dashboard:', error)
    return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 })
  }
}
