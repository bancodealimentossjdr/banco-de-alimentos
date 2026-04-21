import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Nome do produto que deve sempre aparecer primeiro nas listagens
const PRIORITY_PRODUCT = 'hortifruti'

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    })

    const stockItems = await Promise.all(
      products.map(async (product) => {
        const donated = await prisma.donationItem.aggregate({
          where: { productId: product.id },
          _sum: { quantity: true },
        })
        const harvested = await prisma.harvestItem.aggregate({
          where: { productId: product.id },
          _sum: { quantity: true },
        })
        const distributed = await prisma.distributionItem.aggregate({
          where: { productId: product.id },
          _sum: { quantity: true },
        })

        const totalDonated = donated._sum.quantity || 0
        const totalHarvested = harvested._sum.quantity || 0
        const totalDistributed = distributed._sum.quantity || 0

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
    )

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
