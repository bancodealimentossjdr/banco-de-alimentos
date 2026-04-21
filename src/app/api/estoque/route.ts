import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView } from '@/lib/auth-helpers'

// Nome do produto que deve sempre aparecer primeiro nas listagens
const PRIORITY_PRODUCT = 'hortifruti'

export async function GET() {
  const authResult = await requireView('estoque')
  if (authResult instanceof NextResponse) return authResult

  try {
    // 4 queries em paralelo — independente da quantidade de produtos
    const [products, donatedByProduct, harvestedByProduct, distributedByProduct] =
      await Promise.all([
        prisma.product.findMany({
          where: { active: true },
          orderBy: { name: 'asc' },
        }),
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

    // Mapas para lookup O(1)
    const donatedMap = new Map(
      donatedByProduct.map(d => [d.productId, d._sum.quantity || 0])
    )
    const harvestedMap = new Map(
      harvestedByProduct.map(h => [h.productId, h._sum.quantity || 0])
    )
    const distributedMap = new Map(
      distributedByProduct.map(d => [d.productId, d._sum.quantity || 0])
    )

    const stockItems = products.map(product => {
      const totalDonated = donatedMap.get(product.id) || 0
      const totalHarvested = harvestedMap.get(product.id) || 0
      const totalDistributed = distributedMap.get(product.id) || 0

      return {
        id: product.id,
        name: product.name,
        category: product.category,
        unit: product.unit,
        minStock: product.minStock,
        donated: totalDonated,
        harvested: totalHarvested,
        distributed: totalDistributed,
        stock: totalDonated + totalHarvested - totalDistributed,
      }
    })

    // Ordena com Hortifruti no topo, depois alfabético
    const sorted = stockItems.sort((a, b) => {
      const aIsPriority = a.name.trim().toLowerCase() === PRIORITY_PRODUCT
      const bIsPriority = b.name.trim().toLowerCase() === PRIORITY_PRODUCT
      if (aIsPriority && !bIsPriority) return -1
      if (!aIsPriority && bIsPriority) return 1
      return a.name.localeCompare(b.name, 'pt-BR')
    })

    return NextResponse.json(sorted)
  } catch (error) {
    console.error('Erro GET estoque:', error)
    return NextResponse.json({ error: 'Erro ao buscar estoque' }, { status: 500 })
  }
}
